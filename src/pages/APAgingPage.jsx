import { useEffect, useState } from "react";
import { FaDownload, FaPrint, FaSpinner } from "react-icons/fa";

const APAgingPage = () => {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [totals, setTotals] = useState({
    "0-30": 0,
    "31-60": 0,
    "61-90": 0,
    "90+": 0,
    total: 0
  });

  useEffect(() => {
    fetchAPaging();
  }, []);

  const fetchAPaging = async () => {
    try {
      setLoading(true);
      const response = await fetch("http://localhost:5000/api/financial-reports/ap-aging");
      const data = await response.json();

      if (data.success) {
        setVendors(data.data.vendors || []);
        setTotals(data.data.totals || {});
      } else {
        setError(data.message || "Failed to fetch AP Aging");
      }
    } catch (err) {
      setError("Error fetching AP Aging: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExport = () => {
    let csv = "ACCOUNTS PAYABLE AGING REPORT\n";
    csv += new Date().toLocaleDateString() + "\n\n";
    csv += "Vendor Name,0-30 Days,31-60 Days,61-90 Days,90+ Days,Total\n";
    
    vendors.forEach(v => {
      csv += `"${v.vendorName}",${v.aged0_30 || 0},${v.aged31_60 || 0},${v.aged61_90 || 0},${v.agedOver90 || 0},${v.totalPayable || 0}\n`;
    });
    
    csv += `\nTOTALS,${totals["0-30"] || 0},${totals["31-60"] || 0},${totals["61-90"] || 0},${totals["90+"] || 0},${totals.total || 0}\n`;

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ap-aging-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center pt-20 md:pt-16 md:pl-64">
        <div className="text-center">
          <FaSpinner className="text-4xl text-amber-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 font-semibold">Loading AP Aging Report...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 pt-20 md:pt-16 md:pl-64 pb-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
            <div>
              <h1 className="text-4xl font-bold text-gray-800 mb-2">Accounts Payable (AP) Aging</h1>
              <p className="text-gray-600">
                As of {new Date().toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric"
                })}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700 transition"
              >
                <FaPrint /> Print
              </button>
              <button
                onClick={handleExport}
                className="flex items-center gap-2 bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition"
              >
                <FaDownload /> Export
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg p-4 text-white">
            <p className="text-xs font-semibold mb-1 opacity-90">0-30 Days</p>
            <p className="text-2xl font-bold">
              ₹{(totals["0-30"] || 0).toLocaleString("en-IN", {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
              })}
            </p>
          </div>
          <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-lg shadow-lg p-4 text-white">
            <p className="text-xs font-semibold mb-1 opacity-90">31-60 Days</p>
            <p className="text-2xl font-bold">
              ₹{(totals["31-60"] || 0).toLocaleString("en-IN", {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
              })}
            </p>
          </div>
          <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg shadow-lg p-4 text-white">
            <p className="text-xs font-semibold mb-1 opacity-90">61-90 Days</p>
            <p className="text-2xl font-bold">
              ₹{(totals["61-90"] || 0).toLocaleString("en-IN", {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
              })}
            </p>
          </div>
          <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-lg shadow-lg p-4 text-white">
            <p className="text-xs font-semibold mb-1 opacity-90">90+ Days</p>
            <p className="text-2xl font-bold">
              ₹{(totals["90+"] || 0).toLocaleString("en-IN", {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
              })}
            </p>
          </div>
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow-lg p-4 text-white">
            <p className="text-xs font-semibold mb-1 opacity-90">Total Payable</p>
            <p className="text-2xl font-bold">
              ₹{(totals.total || 0).toLocaleString("en-IN", {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
              })}
            </p>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-amber-600 text-white">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-bold">Vendor Name</th>
                  <th className="px-6 py-3 text-right text-sm font-bold">0-30 Days (₹)</th>
                  <th className="px-6 py-3 text-right text-sm font-bold">31-60 Days (₹)</th>
                  <th className="px-6 py-3 text-right text-sm font-bold">61-90 Days (₹)</th>
                  <th className="px-6 py-3 text-right text-sm font-bold">90+ Days (₹)</th>
                  <th className="px-6 py-3 text-right text-sm font-bold">Total (₹)</th>
                </tr>
              </thead>
              <tbody>
                {vendors.map((vendor, idx) => (
                  <tr
                    key={idx}
                    className={`border-t ${idx % 2 === 0 ? "bg-gray-50" : "bg-white"} hover:bg-amber-50 transition`}
                  >
                    <td className="px-6 py-4 text-sm text-gray-900 font-semibold">{vendor.vendorName}</td>
                    <td className="px-6 py-4 text-sm text-right text-gray-900 font-semibold">
                      {(vendor.aged0_30 || 0).toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })}
                    </td>
                    <td className="px-6 py-4 text-sm text-right text-gray-900 font-semibold">
                      {(vendor.aged31_60 || 0).toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })}
                    </td>
                    <td className="px-6 py-4 text-sm text-right text-gray-900 font-semibold">
                      {(vendor.aged61_90 || 0).toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })}
                    </td>
                    <td className="px-6 py-4 text-sm text-right text-red-600 font-bold">
                      {(vendor.agedOver90 || 0).toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })}
                    </td>
                    <td className="px-6 py-4 text-sm text-right text-purple-600 font-bold">
                      {(vendor.totalPayable || 0).toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
              {/* Total Row */}
              <tfoot>
                <tr className="bg-amber-600 text-white font-bold text-lg border-t-2 border-amber-600">
                  <td className="px-6 py-6 text-left">TOTAL</td>
                  <td className="px-6 py-6 text-right">
                    {(totals["0-30"] || 0).toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })}
                  </td>
                  <td className="px-6 py-6 text-right">
                    {(totals["31-60"] || 0).toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })}
                  </td>
                  <td className="px-6 py-6 text-right">
                    {(totals["61-90"] || 0).toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })}
                  </td>
                  <td className="px-6 py-6 text-right">
                    {(totals["90+"] || 0).toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })}
                  </td>
                  <td className="px-6 py-6 text-right">
                    {(totals.total || 0).toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default APAgingPage;
