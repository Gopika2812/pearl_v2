import { useEffect, useState } from "react";
import { FaBox, FaChartBar, FaList, FaThLarge, FaUser } from "react-icons/fa";
import { toast } from "react-toastify";
import { API_BASE, fetchWithAuth } from "../../api";
import { useBranch } from "../../context/BranchContext";

export default function BranchSalesReports() {
  const { branch, branchLoaded } = useBranch();
  const branchId = branch?._id;

  const [activeTab, setActiveTab] = useState("product"); // "product" or "customer"
  const [viewMode, setViewMode] = useState("table"); // \"table\" or \"card\"
  const [loading, setLoading] = useState(false);
  
  // Filters
  const [startDate, setStartDate] = useState(""); 
  const [endDate, setEndDate] = useState("");
  const [productFilter, setProductFilter] = useState("");
  const [customerFilter, setCustomerFilter] = useState("");

  // Data
  const [productSalesData, setProductSalesData] = useState([]);
  const [customerSalesData, setCustomerSalesData] = useState([]);

  // Fetch sales invoices and process data
  const fetchSalesReports = async () => {
    if (!branchId) return;

    setLoading(true);
    try {
      // Fetch all sales invoices for this branch
      const url = `${API_BASE}/sales-invoices?branchId=${branchId}&limit=10000`;
      const res = await fetchWithAuth(url);
      if (!res.ok) throw new Error("Failed to fetch invoices");

      const data = await res.json();
      let invoices = [];

      if (data?.data && Array.isArray(data.data)) {
        invoices = data.data;
      } else if (Array.isArray(data)) {
        invoices = data;
      }

      console.log(`✅ Fetched ${invoices.length} sales invoices`);

      // Process for Product-wise report
      const productReport = {};
      const customerReport = {};

      invoices.forEach((invoice) => {
        // Check date filter
        const invoiceDate = new Date(invoice.invoiceDate || invoice.createdAt);
        if (startDate && invoiceDate < new Date(startDate)) return;
        if (endDate && invoiceDate > new Date(endDate)) return;

        // Process items in invoice
        if (Array.isArray(invoice.items)) {
          invoice.items.forEach((item) => {
            const productName = item.name;
            const productId = item.productId?._id || item.productId;
            const qty = item.qty || 0;
            const total = item.total || 0;

            // Product-wise aggregation
            if (!productReport[productId]) {
              productReport[productId] = {
                productId,
                name: productName,
                totalQty: 0,
                invoiceCount: 0,
                totalAmount: 0,
                invoices: [],
              };
            }
            productReport[productId].totalQty += qty;
            productReport[productId].totalAmount += total;
            if (!productReport[productId].invoices.includes(invoice._id)) {
              productReport[productId].invoiceCount += 1;
              productReport[productId].invoices.push(invoice._id);
            }
          });
        }

        // Customer-wise aggregation
        const customerId = invoice.customer?.customerId?._id || invoice.customer?.customerId;
        const customerName = invoice.customer?.name;

        if (!customerReport[customerId]) {
          customerReport[customerId] = {
            customerId,
            name: customerName,
            totalQty: 0,
            invoiceCount: 0,
            totalAmount: 0,
            products: {},
            invoices: [],
          };
        }

        if (Array.isArray(invoice.items)) {
          invoice.items.forEach((item) => {
            const productName = item.name;
            const qty = item.qty || 0;
            const total = item.total || 0;

            customerReport[customerId].totalQty += qty;
            customerReport[customerId].totalAmount += total;

            if (!customerReport[customerId].products[productName]) {
              customerReport[customerId].products[productName] = 0;
            }
            customerReport[customerId].products[productName] += qty;
          });
        }

        if (!customerReport[customerId].invoices.includes(invoice._id)) {
          customerReport[customerId].invoiceCount += 1;
          customerReport[customerId].invoices.push(invoice._id);
        }
      });

      // Apply product filter
      const filteredProducts = Object.values(productReport)
        .filter((p) => !productFilter || p.name.toLowerCase().includes(productFilter.toLowerCase()))
        .sort((a, b) => b.totalQty - a.totalQty);

      // Apply customer filter
      const filteredCustomers = Object.values(customerReport)
        .filter((c) => !customerFilter || c.name.toLowerCase().includes(customerFilter.toLowerCase()))
        .sort((a, b) => b.totalQty - a.totalQty);

      setProductSalesData(filteredProducts);
      setCustomerSalesData(filteredCustomers);

      console.log(`📊 Product Report: ${filteredProducts.length} products`);
      console.log(`👥 Customer Report: ${filteredCustomers.length} customers`);
    } catch (err) {
      console.error("Error fetching sales reports:", err);
      toast.error("Failed to fetch sales data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (branchLoaded && branchId) {
      fetchSalesReports();
    }
  }, [branchId, branchLoaded, startDate, endDate, productFilter, customerFilter]);

  if (!branchLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 md:pl-20 pt-20 md:pt-6 px-4 md:px-6 pb-10">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl shadow-lg p-8 mb-8">
        <div className="flex items-center gap-4 mb-4">
          <FaChartBar className="text-4xl opacity-80" />
          <div>
            <h1 className="text-4xl font-bold">Sales Reports</h1>
            <p className="text-blue-100 mt-1">Track product and customer sales analytics</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              {activeTab === "product" ? "Product Name" : "Customer Name"}
            </label>
            <input
              type="text"
              placeholder={activeTab === "product" ? "Search product..." : "Search customer..."}
              value={activeTab === "product" ? productFilter : customerFilter}
              onChange={(e) => {
                if (activeTab === "product") {
                  setProductFilter(e.target.value);
                } else {
                  setCustomerFilter(e.target.value);
                }
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div className="flex items-end gap-2">
            <button
              onClick={() => {
                setStartDate("");
                setEndDate("");
                setProductFilter("");
                setCustomerFilter("");
              }}
              className="w-full px-4 py-2 bg-gray-400 text-white rounded-lg font-semibold hover:bg-gray-500 transition"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Tabs & View Toggle */}
      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <div className="flex gap-2 bg-gray-200 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab("product")}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition ${
              activeTab === "product"
                ? "bg-white text-purple-600 shadow-md"
                : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            <FaBox size={18} /> Product Sales
          </button>
          <button
            onClick={() => setActiveTab("customer")}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition ${
              activeTab === "customer"
                ? "bg-white text-purple-600 shadow-md"
                : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            <FaUser size={18} /> Customer Sales
          </button>
        </div>

        <div className="flex gap-2 bg-gray-200 p-1 rounded-lg ml-auto">
          <button
            onClick={() => setViewMode("table")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition ${
              viewMode === "table"
                ? "bg-white text-purple-600 shadow-md"
                : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            <FaList size={16} /> Table
          </button>
          <button
            onClick={() => setViewMode("card")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition ${
              viewMode === "card"
                ? "bg-white text-purple-600 shadow-md"
                : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            <FaThLarge size={16} /> Card
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <p className="text-gray-500">Loading sales data...</p>
        </div>
      ) : activeTab === "product" && viewMode === "card" ? (
        /* Product Card View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {productSalesData.length === 0 ? (
            <div className="col-span-full text-center py-8 text-gray-500">No products found</div>
          ) : (
            productSalesData.map((product) => (
              <div key={product.productId} className="bg-white rounded-lg shadow-md p-6 border-l-4 border-purple-500">
                <h3 className="text-lg font-bold text-gray-800 mb-4">{product.name}</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Quantity:</span>
                    <span className="font-bold text-purple-600">{product.totalQty} units</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Invoice Count:</span>
                    <span className="font-bold text-blue-600">{product.invoiceCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Amount:</span>
                    <span className="font-bold text-green-600">₹{product.totalAmount.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      ) : activeTab === "product" && viewMode === "table" ? (
        /* Product Table View */
        <div className="bg-white rounded-lg shadow-md overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-purple-600 to-blue-600 text-white">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-bold">Product Name</th>
                <th className="px-6 py-3 text-right text-sm font-bold">Total Quantity</th>
                <th className="px-6 py-3 text-right text-sm font-bold">Invoice Count</th>
                <th className="px-6 py-3 text-right text-sm font-bold">Total Amount</th>
              </tr>
            </thead>
            <tbody>
              {productSalesData.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-6 py-8 text-center text-gray-500">
                    No products found
                  </td>
                </tr>
              ) : (
                productSalesData.map((product, index) => (
                  <tr
                    key={product.productId}
                    className={`border-b ${index % 2 === 0 ? "bg-white" : "bg-gray-50"}`}
                  >
                    <td className="px-6 py-4 font-semibold text-gray-800">{product.name}</td>
                    <td className="px-6 py-4 text-right text-purple-600 font-bold">{product.totalQty}</td>
                    <td className="px-6 py-4 text-right text-blue-600 font-bold">{product.invoiceCount}</td>
                    <td className="px-6 py-4 text-right text-green-600 font-bold">₹{product.totalAmount.toFixed(2)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : activeTab === "customer" && viewMode === "card" ? (
        /* Customer Card View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
          {customerSalesData.length === 0 ? (
            <div className="col-span-full text-center py-8 text-gray-500">No customers found</div>
          ) : (
            customerSalesData.map((customer) => (
              <div key={customer.customerId} className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500">
                <h3 className="text-lg font-bold text-gray-800 mb-4">{customer.name}</h3>
                <div className="space-y-3 text-sm mb-4">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Quantity:</span>
                    <span className="font-bold text-blue-600">{customer.totalQty} units</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Invoice Count:</span>
                    <span className="font-bold text-purple-600">{customer.invoiceCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Amount:</span>
                    <span className="font-bold text-green-600">₹{customer.totalAmount.toFixed(2)}</span>
                  </div>
                </div>

                {/* Products bought */}
                <div className="border-t pt-4">
                  <p className="text-xs font-semibold text-gray-600 mb-2">Products Purchased:</p>
                  <div className="space-y-1 text-xs">
                    {Object.entries(customer.products).map(([productName, qty]) => (
                      <div key={productName} className="flex justify-between text-gray-700">
                        <span>{productName}</span>
                        <span className="font-semibold">{qty} units</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        /* Customer Table View */
        <div className="bg-white rounded-lg shadow-md overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-purple-600 to-blue-600 text-white">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-bold">Customer Name</th>
                <th className="px-6 py-3 text-right text-sm font-bold">Total Quantity</th>
                <th className="px-6 py-3 text-right text-sm font-bold">Invoice Count</th>
                <th className="px-6 py-3 text-right text-sm font-bold">Total Amount</th>
                <th className="px-6 py-3 text-left text-sm font-bold">Products Purchased</th>
              </tr>
            </thead>
            <tbody>
              {customerSalesData.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                    No customers found
                  </td>
                </tr>
              ) : (
                customerSalesData.map((customer, index) => (
                  <tr
                    key={customer.customerId}
                    className={`border-b ${index % 2 === 0 ? "bg-white" : "bg-gray-50"}`}
                  >
                    <td className="px-6 py-4 font-semibold text-gray-800">{customer.name}</td>
                    <td className="px-6 py-4 text-right text-blue-600 font-bold">{customer.totalQty}</td>
                    <td className="px-6 py-4 text-right text-purple-600 font-bold">{customer.invoiceCount}</td>
                    <td className="px-6 py-4 text-right text-green-600 font-bold">₹{customer.totalAmount.toFixed(2)}</td>
                    <td className="px-6 py-4 text-xs">
                      {Object.entries(customer.products)
                        .map(([name, qty]) => `${name} (${qty})`)
                        .join(", ")}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
