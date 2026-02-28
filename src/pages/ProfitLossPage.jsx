import { useEffect, useState } from "react";
import { FaDownload, FaPrint, FaSpinner } from "react-icons/fa";

const ProfitLossPage = () => {
  const [revenue, setRevenue] = useState(0);
  const [expenses, setExpenses] = useState(0);
  const [netProfit, setNetProfit] = useState(0);
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchProfitLoss();
  }, []);

  const fetchProfitLoss = async () => {
    try {
      setLoading(true);
      const response = await fetch("http://localhost:5000/api/financial-reports/profit-loss");
      const data = await response.json();

      if (data.success) {
        const plData = data.data;
        setRevenue(plData.revenue?.total || 0);
        setExpenses(plData.expenses?.total || 0);
        setNetProfit(plData.netProfitLoss || 0);
        setDetails(plData);
      } else {
        setError(data.message || "Failed to fetch P&L");
      }
    } catch (err) {
      setError("Error fetching P&L: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const profitMargin = revenue > 0 ? ((netProfit / revenue) * 100).toFixed(2) : 0;

  const handlePrint = () => {
    window.print();
  };

  const handleExport = () => {
    let csv = "PROFIT & LOSS STATEMENT\n";
    csv += new Date().toLocaleDateString() + "\n\n";
    
    csv += "REVENUE\n";
    if (details?.revenue?.items) {
      details.revenue.items.forEach(item => {
        csv += `${item.accountName},${item.amount}\n`;
      });
    }
    csv += `Total Revenue,${revenue}\n\n`;
    
    csv += "EXPENSES\n";
    if (details?.expenses?.items) {
      details.expenses.items.forEach(item => {
        csv += `${item.accountName},${item.amount}\n`;
      });
    }
    csv += `Total Expenses,${expenses}\n\n`;
    csv += `Net Profit/Loss,${netProfit}\n`;
    csv += `Profit Margin %,${profitMargin}\n`;

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `profit-loss-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center pt-20 md:pt-16 md:pl-64">
        <div className="text-center">
          <FaSpinner className="text-4xl text-green-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 font-semibold">Loading Profit & Loss...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 pt-20 md:pt-16 md:pl-64 pb-10">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
            <div>
              <h1 className="text-4xl font-bold text-gray-800 mb-2">Profit & Loss Statement</h1>
              <p className="text-gray-600">
                For the period ending {new Date().toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric"
                })}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition"
              >
                <FaPrint /> Print
              </button>
              <button
                onClick={handleExport}
                className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition"
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

        {/* Revenue Section */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden mb-8">
          <div className="bg-gradient-to-r from-green-600 to-green-700 text-white px-6 py-4 font-bold text-lg">
            REVENUE
          </div>
          <div className="p-6">
            <div className="space-y-3">
              {details?.revenue?.items?.map((item, idx) => (
                <div key={idx} className="flex justify-between pb-2 border-b border-gray-200">
                  <span className="text-gray-700">{item.accountName}</span>
                  <span className="text-gray-900 font-semibold">
                    ₹{(item.amount || 0).toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })}
                  </span>
                </div>
              ))}
              <div className="flex justify-between pt-4 border-t-2 border-green-600 bg-green-50 p-4 rounded font-bold">
                <span className="text-gray-900">Total Revenue</span>
                <span className="text-green-600 text-lg">
                  ₹{revenue.toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Expenses Section */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden mb-8">
          <div className="bg-gradient-to-r from-red-600 to-red-700 text-white px-6 py-4 font-bold text-lg">
            EXPENSES
          </div>
          <div className="p-6">
            <div className="space-y-3">
              {details?.expenses?.items?.map((item, idx) => (
                <div key={idx} className="flex justify-between pb-2 border-b border-gray-200">
                  <span className="text-gray-700">{item.accountName}</span>
                  <span className="text-gray-900 font-semibold">
                    ₹{(item.amount || 0).toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })}
                  </span>
                </div>
              ))}
              <div className="flex justify-between pt-4 border-t-2 border-red-600 bg-red-50 p-4 rounded font-bold">
                <span className="text-gray-900">Total Expenses</span>
                <span className="text-red-600 text-lg">
                  ₹{expenses.toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Net Profit Section */}
        <div className={`rounded-lg shadow-lg overflow-hidden p-8 text-center text-white font-bold ${
          netProfit >= 0 
            ? "bg-gradient-to-r from-green-500 to-green-600" 
            : "bg-gradient-to-r from-red-500 to-red-600"
        }`}>
          <p className="text-sm mb-2">NET {netProfit >= 0 ? "PROFIT" : "LOSS"}</p>
          <p className="text-5xl mb-4">
            ₹{Math.abs(netProfit).toLocaleString("en-IN", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
            })}
          </p>
          <p className="text-lg">
            Profit Margin: <span className="font-extrabold">{profitMargin}%</span>
          </p>
        </div>

        {/* Summary Card */}
        <div className="mt-8 bg-white rounded-lg shadow-lg p-6">
          <div className="grid grid-cols-2 gap-6 text-center">
            <div>
              <p className="text-gray-600 text-sm font-semibold mb-2">TOTAL REVENUE</p>
              <p className="text-green-600 font-bold text-2xl">
                ₹{revenue.toLocaleString("en-IN", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                })}
              </p>
            </div>
            <div>
              <p className="text-gray-600 text-sm font-semibold mb-2">TOTAL EXPENSES</p>
              <p className="text-red-600 font-bold text-2xl">
                ₹{expenses.toLocaleString("en-IN", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                })}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfitLossPage;
