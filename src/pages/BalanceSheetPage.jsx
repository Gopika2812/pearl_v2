import { useEffect, useState } from "react";
import { FaDownload, FaPrint, FaSpinner } from "react-icons/fa";

const BalanceSheetPage = () => {
  const [assets, setAssets] = useState({ current: 0, fixed: 0, total: 0 });
  const [liabilities, setLiabilities] = useState({ current: 0, longTerm: 0, total: 0 });
  const [equity, setEquity] = useState(0);
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isBalanced, setIsBalanced] = useState(false);

  useEffect(() => {
    fetchBalanceSheet();
  }, []);

  const fetchBalanceSheet = async () => {
    try {
      setLoading(true);
      const response = await fetch("http://localhost:5000/api/financial-reports/balance-sheet");
      const data = await response.json();

      if (data.success) {
        const sheetData = data.data;
        
        setAssets(sheetData.assets || {});
        setLiabilities(sheetData.liabilities || {});
        setEquity(sheetData.equity?.total || 0);
        setDetails(sheetData);
        
        const assetsTotal = sheetData.assets?.total || 0;
        const liabEquity = (sheetData.liabilities?.total || 0) + (sheetData.equity?.total || 0);
        setIsBalanced(Math.abs(assetsTotal - liabEquity) < 0.01);
      } else {
        setError(data.message || "Failed to fetch balance sheet");
      }
    } catch (err) {
      setError("Error fetching balance sheet: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExport = () => {
    let csv = "BALANCE SHEET\n";
    csv += new Date().toLocaleDateString() + "\n\n";
    
    csv += "ASSETS\n";
    csv += `Current Assets,${assets.current || 0}\n`;
    csv += `Fixed Assets,${assets.fixed || 0}\n`;
    csv += `Total Assets,${assets.total || 0}\n\n`;
    
    csv += "LIABILITIES & EQUITY\n";
    csv += `Current Liabilities,${liabilities.current || 0}\n`;
    csv += `Long-term Liabilities,${liabilities.longTerm || 0}\n`;
    csv += `Total Liabilities,${liabilities.total || 0}\n`;
    csv += `Equity,${equity}\n`;
    csv += `Total Liabilities & Equity,${(liabilities.total || 0) + equity}\n`;

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `balance-sheet-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-100 flex items-center justify-center pt-20 md:pt-16 md:pl-64">
        <div className="text-center">
          <FaSpinner className="text-4xl text-purple-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 font-semibold">Loading Balance Sheet...</p>
        </div>
      </div>
    );
  }

  const assetsTotal = assets.total || 0;
  const liabilitiesTotal = liabilities.total || 0;
  const liabEquityTotal = liabilitiesTotal + equity;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-100 pt-20 md:pt-16 md:pl-64 pb-10">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
            <div>
              <h1 className="text-4xl font-bold text-gray-800 mb-2">Balance Sheet</h1>
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
                className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition"
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
          {isBalanced 
            ? "✓ Balance Sheet Balanced: Assets = Liabilities + Equity" 
            : "✗ Balance Sheet NOT Balanced"}
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-8">
          {/* ASSETS */}
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4 font-bold text-lg">
              ASSETS
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div className="flex justify-between pb-4 border-b">
                  <span className="text-gray-700 font-semibold">Current Assets</span>
                  <span className="text-gray-900 font-bold">
                    ₹{(assets.current || 0).toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })}
                  </span>
                </div>
                <div className="flex justify-between pb-4 border-b">
                  <span className="text-gray-700 font-semibold">Fixed Assets</span>
                  <span className="text-gray-900 font-bold">
                    ₹{(assets.fixed || 0).toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })}
                  </span>
                </div>
                <div className="flex justify-between pt-4 border-t-2 border-blue-600 bg-blue-50 p-4 rounded">
                  <span className="text-gray-900 font-bold">Total Assets</span>
                  <span className="text-blue-600 font-bold text-lg">
                    ₹{assetsTotal.toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* LIABILITIES & EQUITY */}
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="bg-gradient-to-r from-orange-600 to-orange-700 text-white px-6 py-4 font-bold text-lg">
              LIABILITIES & EQUITY
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div className="flex justify-between pb-4 border-b">
                  <span className="text-gray-700 font-semibold">Current Liabilities</span>
                  <span className="text-gray-900 font-bold">
                    ₹{(liabilities.current || 0).toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })}
                  </span>
                </div>
                <div className="flex justify-between pb-4 border-b">
                  <span className="text-gray-700 font-semibold">Long-term Liabilities</span>
                  <span className="text-gray-900 font-bold">
                    ₹{(liabilities.longTerm || 0).toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })}
                  </span>
                </div>
                <div className="flex justify-between pb-4 border-b">
                  <span className="text-gray-700 font-semibold">Equity</span>
                  <span className="text-gray-900 font-bold">
                    ₹{equity.toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })}
                  </span>
                </div>
                <div className="flex justify-between pt-4 border-t-2 border-orange-600 bg-orange-50 p-4 rounded">
                  <span className="text-gray-900 font-bold">Total Liab. & Equity</span>
                  <span className="text-orange-600 font-bold text-lg">
                    ₹{liabEquityTotal.toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Equation */}
        <div className="mt-8 bg-white rounded-lg shadow-lg p-6">
          <div className="text-center space-y-2">
            <p className="text-gray-600 text-sm">ACCOUNTING EQUATION:</p>
            <p className="text-xl font-bold text-gray-800">
              Assets = Liabilities + Equity
            </p>
            <p className="text-lg text-gray-700">
              ₹{assetsTotal.toLocaleString("en-IN", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              })} = ₹{liabilitiesTotal.toLocaleString("en-IN", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              })} + ₹{equity.toLocaleString("en-IN", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              })}
            </p>
            {isBalanced && (
              <p className="text-green-600 font-bold">✓ Equation Balance is Verified</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BalanceSheetPage;
