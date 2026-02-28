import { useEffect, useState } from "react";
import { FaDownload, FaPrint, FaSpinner } from "react-icons/fa";

const TrialBalancePage = () => {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [totalDebits, setTotalDebits] = useState(0);
  const [totalCredits, setTotalCredits] = useState(0);
  const [isBalanced, setIsBalanced] = useState(false);

  useEffect(() => {
    fetchTrialBalance();
  }, []);

  const fetchTrialBalance = async () => {
    try {
      setLoading(true);
      const response = await fetch("http://localhost:5000/api/financial-reports/trial-balance");
      const data = await response.json();

      if (data.success) {
        setAccounts(data.data.accounts || []);
        setTotalDebits(data.data.totalDebits || 0);
        setTotalCredits(data.data.totalCredits || 0);
        setIsBalanced(Math.abs(data.data.totalDebits - data.data.totalCredits) < 0.01);
      } else {
        setError(data.message || "Failed to fetch trial balance");
      }
    } catch (err) {
      setError("Error fetching trial balance: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExport = () => {
    // Create CSV content
    let csv = "Account Code,Account Name,Account Type,Debit,Credit\n";
    accounts.forEach((acc) => {
      const debit = acc.debitAmount || 0;
      const credit = acc.creditAmount || 0;
      csv += `${acc.accountCode},"${acc.accountName}",${acc.accountType},${debit},${credit}\n`;
    });
    csv += `\n,,Total,${totalDebits},${totalCredits}\n`;

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `trial-balance-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center pt-20 md:pt-16 md:pl-64">
        <div className="text-center">
          <FaSpinner className="text-4xl text-indigo-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 font-semibold">Loading Trial Balance...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 pt-20 md:pt-16 md:pl-64 pb-10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
            <div>
              <h1 className="text-4xl font-bold text-gray-800 mb-2">Trial Balance</h1>
              <p className="text-gray-600">
                Generated: {new Date().toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric"
                })}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
              >
                <FaPrint /> Print
              </button>
              <button
                onClick={handleExport}
                className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition"
              >
                <FaDownload /> Export
              </button>
            </div>
          </div>
        </div>

        {/* Status Card */}
        <div className={`mb-8 p-6 rounded-lg text-white font-bold text-lg ${
          isBalanced ? "bg-gradient-to-r from-green-500 to-green-600" : "bg-gradient-to-r from-red-500 to-red-600"
        }`}>
          {isBalanced ? "✓ Trial Balance is Balanced" : "✗ Trial Balance is NOT Balanced"}
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-indigo-600 text-white">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-bold">Account Code</th>
                  <th className="px-6 py-3 text-left text-sm font-bold">Account Name</th>
                  <th className="px-6 py-3 text-left text-sm font-bold">Account Type</th>
                  <th className="px-6 py-3 text-right text-sm font-bold">Debit (₹)</th>
                  <th className="px-6 py-3 text-right text-sm font-bold">Credit (₹)</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((acc, idx) => (
                  <tr
                    key={idx}
                    className={`border-t ${idx % 2 === 0 ? "bg-gray-50" : "bg-white"} hover:bg-indigo-50 transition`}
                  >
                    <td className="px-6 py-4 text-sm font-mono text-gray-900 font-bold">{acc.accountCode}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{acc.accountName}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
                        {acc.accountType}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-right text-gray-900 font-semibold">
                      {(acc.debitAmount || 0).toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })}
                    </td>
                    <td className="px-6 py-4 text-sm text-right text-gray-900 font-semibold">
                      {(acc.creditAmount || 0).toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })}
                    </td>
                  </tr>
                ))}
                {/* Total Row */}
                <tr className="bg-indigo-600 text-white font-bold text-lg">
                  <td colSpan="3" className="px-6 py-6 text-right">
                    TOTAL
                  </td>
                  <td className="px-6 py-6 text-right">
                    {totalDebits.toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })}
                  </td>
                  <td className="px-6 py-6 text-right">
                    {totalCredits.toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Verification Info */}
          <div className="bg-gray-100 px-6 py-4 border-t text-sm text-gray-700">
            <p>
              <span className="font-bold">Verification:</span> Total Debits (₹{totalDebits.toFixed(2)}) 
              {" "} {isBalanced ? "=" : "≠"} {" "} 
              Total Credits (₹{totalCredits.toFixed(2)})
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrialBalancePage;
