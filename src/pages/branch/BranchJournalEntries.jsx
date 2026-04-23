import React, { useEffect, useState } from "react";
import { FaBook, FaPlus, FaUpload, FaSync, FaSearch } from "react-icons/fa";
import { toast } from "react-toastify";
import { API_BASE } from "../../api";
import { useBranch } from "../../context/BranchContext";
import CreateTallyJournalModal from "../../components/CreateTallyJournalModal";
import BulkUploadTallyGroupsModal from "../../components/BulkUploadTallyGroupsModal";
import BulkUploadTallyJournalsModal from "../../components/BulkUploadTallyJournalsModal";

const BranchJournalEntries = () => {
  const { currentBranch, user } = useBranch();
  const [journals, setJournals] = useState([]);
  const [loading, setLoading] = useState(false);

  // Permission helper
  const isFieldAllowed = (fieldId) => {
    if (!user) return false;
    if (user.role === "SUPER_ADMIN" || user.role === "ADMIN") return true;
    const key = `journals_${fieldId}`;
    return user.fieldPermissions?.[key] !== false;
  };
  const [searchTerm, setSearchTerm] = useState("");

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [bulkGroupsModalOpen, setBulkGroupsModalOpen] = useState(false);
  const [bulkJournalsModalOpen, setBulkJournalsModalOpen] = useState(false);

  const fetchJournals = async () => {
    if (!currentBranch?._id) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/tally-journals`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setJournals(data);
    } catch (err) {
      toast.error(err.message || "Failed to fetch journals");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJournals();
  }, [currentBranch?._id]);

  const filteredJournals = journals.filter(
    (j) =>
      j.journalName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      j.group?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50 pt-20 md:pt-4 md:pl-20">


      {/* MODALS */}
      <CreateTallyJournalModal 
        isOpen={createModalOpen} 
        onClose={() => setCreateModalOpen(false)} 
        onRefresh={fetchJournals} 
      />
      <BulkUploadTallyGroupsModal 
        isOpen={bulkGroupsModalOpen} 
        onClose={() => setBulkGroupsModalOpen(false)} 
        onRefresh={fetchJournals} 
      />
      <BulkUploadTallyJournalsModal 
        isOpen={bulkJournalsModalOpen} 
        onClose={() => setBulkJournalsModalOpen(false)} 
        onRefresh={fetchJournals} 
      />

      <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 py-4">
        {/* HEADER SECTION */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-6 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-[#319bab] to-[#257f87] rounded-xl flex items-center justify-center shadow-lg">
              <FaBook className="text-white text-xl" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-gray-800">
                Journal Master Data
              </h1>
              <p className="text-xs text-gray-500 tracking-wide">
                Synced Tally Prime ledgers & opening balances
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setCreateModalOpen(true)}
              className="flex items-center gap-2 bg-[#319bab] text-white px-4 py-2 rounded-lg hover:bg-[#257f87] transition shadow-sm"
            >
              <FaPlus /> Create Journal
            </button>
            <button
              onClick={() => setBulkGroupsModalOpen(true)}
              className="flex items-center gap-2 bg-blue-100 text-blue-700 px-4 py-2 rounded-lg hover:bg-blue-200 transition shadow-sm"
            >
              <FaUpload /> Upload Groups
            </button>
            <button
              onClick={() => setBulkJournalsModalOpen(true)}
              className="flex items-center gap-2 bg-green-100 text-green-700 px-4 py-2 rounded-lg hover:bg-green-200 transition shadow-sm"
            >
              <FaUpload /> Upload Journals
            </button>
            <button
              onClick={fetchJournals}
              className="p-2.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition"
              title="Refresh"
            >
              <FaSync className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {/* SEARCH & TABLE SECTION */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-gray-100 bg-gray-50/50">
            <div className="relative max-w-md">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by Ledger Name or Group..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#319bab] focus:border-transparent outline-none transition"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 uppercase text-[11px] font-bold">
                <tr>
                  {isFieldAllowed("name") && <th className="px-6 py-4 text-left">Ledger Name</th>}
                  {isFieldAllowed("group") && <th className="px-6 py-4 text-left">Under Group</th>}
                  {isFieldAllowed("gstin") && <th className="px-6 py-4 text-left">GSTIN</th>}
                  {isFieldAllowed("type") && <th className="px-6 py-4 text-center">Type</th>}
                  {isFieldAllowed("debit") && <th className="px-6 py-4 text-right bg-red-50/50">Debit (Dr)</th>}
                  {isFieldAllowed("credit") && <th className="px-6 py-4 text-right bg-green-50/50">Credit (Cr)</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading && journals.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                      <div className="animate-pulse flex flex-col items-center gap-2">
                        <div className="w-6 h-6 border-2 border-[#319bab] border-t-transparent rounded-full animate-spin"></div>
                        <p>Loading journals...</p>
                      </div>
                    </td>
                  </tr>
                ) : filteredJournals.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-12 text-center text-gray-400">
                      <FaBook className="text-4xl mx-auto mb-3 opacity-20" />
                      <p>No journals found</p>
                    </td>
                  </tr>
                ) : (
                  filteredJournals.map((journal) => (
                    <tr key={journal._id} className="hover:bg-gray-50/80 transition-colors">
                      {isFieldAllowed("name") && (
                        <td className="px-6 py-3">
                          <div className="font-semibold text-gray-800">
                            {journal.journalName}
                          </div>
                          {journal.state && (
                            <div className="text-[11px] text-gray-500">
                              {journal.state}
                            </div>
                          )}
                        </td>
                      )}
                      {isFieldAllowed("group") && (
                        <td className="px-6 py-3">
                          <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs font-medium">
                            {journal.group}
                          </span>
                        </td>
                      )}
                      {isFieldAllowed("gstin") && (
                        <td className="px-6 py-3 font-mono text-xs text-gray-500">
                          {journal.gstin || "-"}
                        </td>
                      )}
                      {isFieldAllowed("type") && (
                        <td className="px-6 py-3 text-center">
                          <span className="text-xs text-gray-500">
                            {journal.registrationType || "-"}
                          </span>
                        </td>
                      )}
                      {isFieldAllowed("debit") && (
                        <td className="px-6 py-3 text-right bg-red-50/10 font-medium text-red-600">
                          {journal.debit > 0 ? `₹${journal.debit.toLocaleString()}` : "-"}
                        </td>
                      )}
                      {isFieldAllowed("credit") && (
                        <td className="px-6 py-3 text-right bg-green-50/10 font-medium text-green-600">
                          {journal.credit > 0 ? `₹${journal.credit.toLocaleString()}` : "-"}
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BranchJournalEntries;
