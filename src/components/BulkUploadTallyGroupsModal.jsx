import React, { useState } from "react";
import { FaTimes, FaUpload } from "react-icons/fa";
import { toast } from "react-toastify";
import { API_BASE } from "../api";
import Papa from "papaparse";

const BulkUploadTallyGroupsModal = ({ isOpen, onClose, onRefresh }) => {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = () => {
    if (!file) {
      toast.error("Please select a CSV file");
      return;
    }

    setLoading(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const formattedData = results.data.map((row) => {
            // Some CSVs from Tally might have trailing spaces in headers or values like "Group Name "
            // Let's create a clean version of the row keys
            const cleanRow = {};
            for (const key in row) {
              cleanRow[key.trim()] = row[key];
            }
            
            return {
              name: cleanRow["Under"] || cleanRow["Group Name"] || cleanRow["Group"] || cleanRow["Parent Group"] || cleanRow["GroupName"],
            };
          }).filter(g => g.name && String(g.name).trim() !== "");

          // deduplicate
          const uniqueGroups = Array.from(new Set(formattedData.map(a => a.name.trim())))
            .map(name => ({ name }));

          if (uniqueGroups.length === 0) {
            toast.error("No valid groups found in CSV. Check column headers (Expected: GroupName, Group Name or Under).");
            setLoading(false);
            return;
          }

          const res = await fetch(`${API_BASE}/tally-journals/groups/bulk`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
            body: JSON.stringify({ groups: uniqueGroups }),
          });

          const data = await res.json();
          if (!res.ok) throw new Error(data.message);

          toast.success(data.message);
          onRefresh();
          onClose();
        } catch (error) {
          toast.error(error.message || "Failed to upload groups");
        } finally {
          setLoading(false);
        }
      },
      error: (error) => {
        toast.error("Failed to parse CSV: " + error.message);
        setLoading(false);
      },
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl flex flex-col">
        <div className="flex justify-between items-center p-6 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-800">Bulk Upload Groups</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
            <FaTimes size={20} />
          </button>
        </div>

        <div className="p-6">
          <p className="text-sm text-gray-600 mb-4">
            Upload a CSV exported from Tally containing the groups. The system will look for columns named "Under", "Group Name", or "Group".
          </p>

          <input
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 border border-gray-200 rounded-lg p-2"
          />

          <div className="mt-6 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2 rounded-lg font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              onClick={handleUpload}
              className="flex items-center gap-2 px-6 py-2 rounded-lg font-semibold text-white bg-[#319bab] hover:bg-[#257f87] transition disabled:opacity-50"
              disabled={loading}
            >
              <FaUpload />
              {loading ? "Uploading..." : "Upload"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BulkUploadTallyGroupsModal;
