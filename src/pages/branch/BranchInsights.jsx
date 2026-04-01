import { useEffect, useMemo, useState } from "react";
import {
  FaBars, FaCalendarAlt, FaChartBar, FaChevronDown, FaChartPie, FaChartLine,
  FaHome, FaSyncAlt, FaTimes, FaUser, FaDownload, FaFileExcel, FaFilePdf,
  FaCheck, FaBox,
} from "react-icons/fa";
import { Link } from "react-router-dom";
import { useBranch } from "../../context/BranchContext";
import {
  PieChart, Pie, BarChart, Bar, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell,
} from "recharts";
import jsPDF from "jspdf";

import { API_BASE, fetchWithAuth } from "../../api";
const PAGE_SIZE = 10;
const CHART_PAGE_SIZE = 5;

const FILTER_OPTIONS = [
  { value: "item",      label: "Item Name" },
  { value: "group",     label: "Product Group" },
  { value: "warehouse", label: "Warehouse" },
];

function formatCurrency(v) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR",
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(v || 0);
}
function fmt2(v) {
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(v || 0);
}
function getMonthRange() {
  const now   = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end   = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const pad = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { startDate: pad(start), endDate: pad(end) };
}
function withGst(price, gst) { return price * (1 + (gst || 0) / 100); }

function buildRawRows(products, groupBy) {
  const map = new Map();
  for (const p of products) {
    const qty = Number(p.totalQty)        || 0;
    const pp  = Number(p.purchasingPrice) || 0;
    const sp  = Number(p.sellingPrice)    || 0;
    const gst = Number(p.gst)             || 0;
    let key =
      groupBy === "item"      ? (p.name || "Unknown") :
      groupBy === "group"     ? (p.productGroup?.name || "Ungrouped") :
                                (p.warehouse?.name    || "No Warehouse");
    if (!map.has(key)) map.set(key, { key, qty: 0, ppTaxpaid: 0, ppTaxless: 0, spTaxpaid: 0, spTaxless: 0 });
    const r = map.get(key);
    r.qty       += qty;
    r.ppTaxless += pp * qty;
    r.ppTaxpaid += withGst(pp, gst) * qty;
    r.spTaxless += sp * qty;
    r.spTaxpaid += withGst(sp, gst) * qty;
  }
  return [...map.values()];
}

function computeTable(rawRows, priceType) {
  const totalTaxless = rawRows.reduce((s, r) => s + (priceType === "purchase" ? r.ppTaxless : r.spTaxless), 0);
  return rawRows.map((r) => {
    const taxless    = priceType === "purchase" ? r.ppTaxless : r.spTaxless;
    const taxpaid    = priceType === "purchase" ? r.ppTaxpaid : r.spTaxpaid;
    const aspTaxless = r.qty > 0 ? taxless  / r.qty : 0;
    const aspTaxpaid = r.qty > 0 ? taxpaid  / r.qty : 0;
    const contrib    = totalTaxless > 0 ? (taxless / totalTaxless) * 100 : 0;
    return { name: r.key, qty: r.qty, taxpaid, taxless, aspTaxpaid, aspTaxless, contrib };
  }).sort((a, b) => b.taxless - a.taxless);
}

const COLORS = [
  "#FF6B6B", "#4ECDC4", "#45B7D1", "#FFA07A", "#98D8C8",
  "#F7DC6F", "#BB8FCE", "#85C1E2", "#F8B88B", "#A8E6CF",
  "#FFD3B6", "#FFAAA5", "#FF8B94", "#A8D8EA", "#AA96DA",
];

function ProductTable({ title, rows, accent, page, setPage }) {
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const chartTotalPages = Math.max(1, Math.ceil(rows.length / CHART_PAGE_SIZE));
  const [chartPage, setChartPage] = useState(1);
  const slice = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const chartSlice = rows.slice((chartPage - 1) * CHART_PAGE_SIZE, chartPage * CHART_PAGE_SIZE);
  const [chartType, setChartType] = useState("table");
  const [dlOpen, setDlOpen] = useState(false);
  const [dataType, setDataType] = useState("taxless");

  // Prepare chart data from current page slice
  const chartData = chartSlice.map((row) => ({
    name: row.name.length > 20 ? row.name.substring(0, 20) + "..." : row.name,
    fullName: row.name,
    value: parseFloat((dataType === "taxless" ? row.taxless : row.taxpaid).toFixed(2)),
    qty: row.qty,
    taxpaid: row.taxpaid,
    taxless: row.taxless,
    aspTaxpaid: row.aspTaxpaid,
    aspTaxless: row.aspTaxless,
    contrib: row.contrib,
  }));

  const downloadCSV = () => {
    const headers = ["Item Name", "Qty", "Taxpaid (Rs)", "Taxless (Rs)", "ASP Taxpaid", "ASP Taxless", "Contrib %"];
    const csvContent = [
      headers.join(","),
      ...rows.map(r => [
        `"${r.name.replace(/"/g, '""')}"`,
        r.qty.toFixed(2), r.taxpaid.toFixed(2), r.taxless.toFixed(2),
        r.aspTaxpaid.toFixed(2), r.aspTaxless.toFixed(2), r.contrib.toFixed(2)
      ].join(","))
    ].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `${title.replace(/ /g, "_")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 10;
    let yPos = margin;

    // Title
    doc.setFontSize(16);
    doc.text(title, margin, yPos);
    yPos += 10;

    // Date
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, margin, yPos);
    yPos += 8;

    // Table headers
    doc.setFontSize(9);
    doc.setFont(undefined, "bold");
    const headers = ["Item Name", "Qty", "Taxpaid (Rs)", "Taxless (Rs)", "ASP Taxpaid", "ASP Taxless", "Contrib %"];
    const colWidth = (pageWidth - 2 * margin) / headers.length;
    
    headers.forEach((header, idx) => {
      doc.text(header, margin + idx * colWidth, yPos, { maxWidth: colWidth, align: "center" });
    });
    yPos += 8;
    doc.setFont(undefined, "normal");

    // Table data
    doc.setFontSize(8);
    rows.forEach((row) => {
      if (yPos > pageHeight - margin) {
        doc.addPage();
        yPos = margin;
      }
      const data = [
        row.name.substring(0, 15),
        row.qty.toFixed(2),
        row.taxpaid.toFixed(2),
        row.taxless.toFixed(2),
        row.aspTaxpaid.toFixed(2),
        row.aspTaxless.toFixed(2),
        row.contrib.toFixed(2) + "%"
      ];
      data.forEach((cell, idx) => {
        doc.text(String(cell), margin + idx * colWidth, yPos, { maxWidth: colWidth, align: "center" });
      });
      yPos += 6;
    });

    doc.save(`${title.replace(/ /g, "_")}.pdf`);
  };

  const renderChart = () => {
    if (chartType === "table") {
      return (
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[640px]">
            <thead className="bg-gray-50 text-gray-600 sticky top-0">
              <tr>
                <th className="text-left px-3 py-2 font-semibold w-44">Item Name</th>
                <th className="text-right px-3 py-2 font-semibold">Qty</th>
                <th className="text-right px-3 py-2 font-semibold">Taxpaid (Rs)</th>
                <th className="text-right px-3 py-2 font-semibold">Taxless (Rs)</th>
                <th className="text-right px-3 py-2 font-semibold">ASP Taxpaid</th>
                <th className="text-right px-3 py-2 font-semibold">ASP Taxless</th>
                <th className="text-right px-3 py-2 font-semibold">Contrib %</th>
              </tr>
            </thead>
            <tbody>
              {slice.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-10 text-gray-400">No data</td></tr>
              ) : (
                slice.map((row, idx) => (
                  <tr key={`${row.name}-${idx}`} className="border-t border-gray-100 hover:bg-blue-50/40 transition-colors">
                    <td className="px-3 py-2 text-gray-800 truncate max-w-[176px]" title={row.name}>{row.name}</td>
                    <td className="px-3 py-2 text-right text-gray-700">{fmt2(row.qty)}</td>
                    <td className="px-3 py-2 text-right text-gray-700">{fmt2(row.taxpaid)}</td>
                    <td className="px-3 py-2 text-right text-gray-700">{fmt2(row.taxless)}</td>
                    <td className="px-3 py-2 text-right text-gray-700">{fmt2(row.aspTaxpaid)}</td>
                    <td className="px-3 py-2 text-right text-gray-700">{fmt2(row.aspTaxless)}</td>
                    <td className="px-3 py-2 text-right font-semibold text-blue-700">{row.contrib.toFixed(2)}%</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      );
    } else if (chartType === "pie") {
      return (
        <ResponsiveContainer width="100%" height={350}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, value }) => `${name}: ${value.toFixed(0)}`}
              outerRadius={100}
              fill="#8884d8"
              dataKey="value"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => fmt2(value)} />
          </PieChart>
        </ResponsiveContainer>
      );
    } else if (chartType === "bar") {
      return (
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(value) => fmt2(value)} />
            <Bar dataKey="value" fill="#45B7D1" name="Amount (Taxless)" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      );
    } else if (chartType === "area") {
      return (
        <ResponsiveContainer width="100%" height={350}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#45B7D1" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#45B7D1" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(value) => fmt2(value)} />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#45B7D1"
              fillOpacity={1}
              fill="url(#colorValue)"
              name="Amount (Taxless)"
            />
          </AreaChart>
        </ResponsiveContainer>
      );
    }
  };

  return (
    <section className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden flex flex-col min-h-[550px]">
      <div className={`px-4 py-3 border-b border-gray-100 border-l-4 ${accent} flex items-center justify-between`}>
        <p className="font-semibold text-gray-800 text-sm">{title}</p>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-1">
            <button
              onClick={() => setChartType("table")}
              className={`px-2 py-1 rounded text-xs font-medium transition ${chartType === "table" ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-gray-200"}`}
              title="Table View"
            >
              ⊞
            </button>
            <button
              onClick={() => setChartType("pie")}
              className={`px-2 py-1 rounded text-xs font-medium transition ${chartType === "pie" ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-gray-200"}`}
              title="Pie Chart"
            >
              <FaChartPie />
            </button>
            <button
              onClick={() => setChartType("bar")}
              className={`px-2 py-1 rounded text-xs font-medium transition ${chartType === "bar" ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-gray-200"}`}
              title="Bar Chart"
            >
              <FaChartBar />
            </button>
            <button
              onClick={() => setChartType("area")}
              className={`px-2 py-1 rounded text-xs font-medium transition ${chartType === "area" ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-gray-200"}`}
              title="Area Chart"
            >
              <FaChartLine />
            </button>
          </div>
          <div className="relative">
            <button
              onClick={() => setDlOpen(!dlOpen)}
              className="p-1.5 rounded hover:bg-gray-100 text-gray-600 hover:text-gray-800 transition"
              title="Download"
            >
              <FaDownload className="text-sm" />
            </button>
            {dlOpen && (
              <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded shadow-lg z-10 min-w-[120px]">
                <button
                  onClick={() => {
                    downloadCSV();
                    setDlOpen(false);
                  }}
                  className="block w-full text-left px-3 py-2 text-xs hover:bg-gray-50 flex items-center gap-2"
                >
                  <FaFileExcel className="text-green-600 text-xs" /> Export CSV
                </button>
                <button
                  onClick={() => {
                    downloadPDF();
                    setDlOpen(false);
                  }}
                  className="block w-full text-left px-3 py-2 text-xs hover:bg-gray-50 flex items-center gap-2 border-t border-gray-100"
                >
                  <FaFilePdf className="text-red-600 text-xs" /> Export PDF
                </button>
              </div>
            )}
          </div>
          {chartType !== "table" && (
            <div className="ml-3 relative">
              <select
                value={dataType}
                onChange={(e) => {
                  setDataType(e.target.value);
                  setChartPage(1);
                }}
                className="h-8 px-2 rounded-lg border border-gray-300 bg-white text-xs text-gray-700 outline-none focus:border-blue-400 cursor-pointer"
              >
                <option value="taxless">Taxless</option>
                <option value="taxpaid">Taxpaid</option>
              </select>
            </div>
          )}
        </div>
      </div>

      <div className={`flex-1 flex overflow-hidden ${chartType === "table" ? "flex-col" : ""}`}>
        {/* Chart or Table */}
        <div className={`${chartType === "table" ? "flex-1" : "flex-1"} p-4 ${chartType !== "table" ? "border-r border-gray-100" : ""} overflow-auto`}>
          {chartData.length > 0 ? renderChart() : <div className="flex items-center justify-center h-full text-gray-400">No data</div>}
        </div>

        {/* Data List - Only show for charts, not for table */}
        {chartType !== "table" && (
          <div className="w-64 border-l border-gray-100 overflow-y-auto bg-gray-50">
            <div className="p-3 border-b border-gray-200 bg-white sticky top-0">
              <p className="text-xs font-semibold text-gray-600">Data ({chartSlice.length} items)</p>
            </div>
            <div className="divide-y divide-gray-200">
              {chartSlice.map((row, idx) => (
                <div key={idx} className="p-3 hover:bg-gray-100 transition">
                  <p className="text-xs font-medium text-gray-800 truncate" title={row.name}>
                    {row.name}
                  </p>
                  <div className="mt-2 space-y-1 text-xs text-gray-600">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Qty:</span>
                      <span className="font-medium text-gray-800">{fmt2(row.qty)}</span>
                    </div>
                    <div className={`flex justify-between px-2 py-1 rounded ${dataType === "taxless" ? "bg-blue-100" : "bg-gray-50"}`}>
                      <span className="text-gray-600">Taxless:</span>
                      <span className={`font-medium ${dataType === "taxless" ? "text-blue-700" : "text-gray-700"}`}>{fmt2(row.taxless)}</span>
                    </div>
                    <div className={`flex justify-between px-2 py-1 rounded ${dataType === "taxpaid" ? "bg-red-100" : "bg-gray-50"}`}>
                      <span className="text-gray-600">Taxpaid:</span>
                      <span className={`font-medium ${dataType === "taxpaid" ? "text-red-700" : "text-gray-700"}`}>{fmt2(row.taxpaid)}</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-gray-200">
                      <span className="text-gray-500">Contrib:</span>
                      <span className="font-semibold text-emerald-700">{row.contrib.toFixed(2)}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Pagination for Charts */}
      {chartType !== "table" && (
        <div className="px-4 py-2 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500 bg-gray-50">
          <span>Chart Page {chartPage} of {chartTotalPages} (5 items per page)</span>
          <div className="flex items-center gap-1">
            <button
              disabled={chartPage === 1}
              onClick={() => setChartPage((p) => Math.max(1, p - 1))}
              className="h-7 px-2 rounded border border-gray-200 hover:bg-white disabled:opacity-40"
            >
              prev
            </button>
            {Array.from({ length: Math.min(5, chartTotalPages) }, (_, i) => {
              const pg = chartPage <= 3 ? i + 1 : chartPage - 2 + i;
              if (pg < 1 || pg > chartTotalPages) return null;
              return (
                <button
                  key={pg}
                  onClick={() => setChartPage(pg)}
                  className={`h-7 w-7 rounded border text-xs ${
                    pg === chartPage
                      ? "bg-blue-600 text-white border-blue-600"
                      : "border-gray-200 hover:bg-white"
                  }`}
                >
                  {pg}
                </button>
              );
            })}
            <button
              disabled={chartPage === chartTotalPages}
              onClick={() => setChartPage((p) => Math.min(chartTotalPages, p + 1))}
              className="h-7 px-2 rounded border border-gray-200 hover:bg-white disabled:opacity-40"
            >
              next
            </button>
          </div>
        </div>
      )}

      {/* Pagination for Table */}
      {chartType === "table" && (
      <div className="px-4 py-2 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500 bg-gray-50">
        <span>
          Page {page} of {totalPages}
        </span>
        <div className="flex items-center gap-1">
          <button
            disabled={page === 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="h-7 px-2 rounded border border-gray-200 hover:bg-white disabled:opacity-40"
          >
            prev
          </button>
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            const pg = page <= 3 ? i + 1 : page - 2 + i;
            if (pg < 1 || pg > totalPages) return null;
            return (
              <button
                key={pg}
                onClick={() => setPage(pg)}
                className={`h-7 w-7 rounded border text-xs ${
                  pg === page
                    ? "bg-blue-600 text-white border-blue-600"
                    : "border-gray-200 hover:bg-white"
                }`}
              >
                {pg}
              </button>
            );
          })}
          <button
            disabled={page === totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="h-7 px-2 rounded border border-gray-200 hover:bg-white disabled:opacity-40"
          >
            next
          </button>
        </div>
      </div>
      )}
    </section>
  );
}

function PurchaseOrderTable({ title, rows, accent, page, setPage, columns, setColumns, chartField, setChartField }) {
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const chartTotalPages = Math.max(1, Math.ceil(rows.length / CHART_PAGE_SIZE));
  const [chartPage, setChartPage] = useState(1);
  const slice = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const chartSlice = rows.slice((chartPage - 1) * CHART_PAGE_SIZE, chartPage * CHART_PAGE_SIZE);
  const [chartType, setChartType] = useState("table");
  const [dlOpen, setDlOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [columnOpen, setColumnOpen] = useState(false);
  const [filters, setFilters] = useState({
    voucherTypes: [],
    products: [],
    purchasePriceBuckets: [],
    totalPriceBuckets: [],
  });

  // Get unique filter options
  const uniqueVouchers = [...new Set(rows.map(r => r.voucherType))];
  const uniqueProducts = [...new Set(rows.map(r => r.productName))];
  const purchasePriceBuckets = ["0-100", "100-500", "500-1000", "1000+"];
  const totalPriceBuckets = ["0-1000", "1000-5000", "5000-10000", "10000+"];

  // Apply filters
  const filteredRows = rows.filter(row => {
    if (filters.voucherTypes.length && !filters.voucherTypes.includes(row.voucherType)) return false;
    if (filters.products.length && !filters.products.includes(row.productName)) return false;
    if (filters.purchasePriceBuckets.length) {
      const price = row.purchasePrice;
      const match = filters.purchasePriceBuckets.some(bucket => {
        if (bucket === "0-100") return price >= 0 && price < 100;
        if (bucket === "100-500") return price >= 100 && price < 500;
        if (bucket === "500-1000") return price >= 500 && price < 1000;
        if (bucket === "1000+") return price >= 1000;
        return false;
      });
      if (!match) return false;
    }
    if (filters.totalPriceBuckets.length) {
      const tp = row.totalPrice;
      const match = filters.totalPriceBuckets.some(bucket => {
        if (bucket === "0-1000") return tp >= 0 && tp < 1000;
        if (bucket === "1000-5000") return tp >= 1000 && tp < 5000;
        if (bucket === "5000-10000") return tp >= 5000 && tp < 10000;
        if (bucket === "10000+") return tp >= 10000;
        return false;
      });
      if (!match) return false;
    }
    return true;
  });

  const currentSlice = filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const currentChartSlice = filteredRows.slice((chartPage - 1) * CHART_PAGE_SIZE, chartPage * CHART_PAGE_SIZE);
  const currentTotalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const currentChartTotalPages = Math.max(1, Math.ceil(filteredRows.length / CHART_PAGE_SIZE));

  // Get available numeric columns for chart
  const numericColumns = columns.filter(c => c.type === "number").map(c => c.key);

  const chartData = currentChartSlice.map((row) => ({
    name: row.productName.length > 18 ? row.productName.substring(0, 18) + "..." : row.productName,
    fullName: row.productName,
    value: parseFloat((row[chartField] || 0).toFixed(2)),
    ...row,
  }));

  const downloadCSV = () => {
    const visibleCols = columns.filter(c => c.visible);
    const headers = visibleCols.map(c => c.label);
    const csvContent = [
      headers.join(","),
      ...filteredRows.map(r => [
        ...visibleCols.map(col => {
          const val = r[col.key];
          if (typeof val === "string") return `"${val.replace(/"/g, '""')}"`;
          return val.toFixed ? val.toFixed(2) : val;
        })
      ].join(","))
    ].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "purchase-orders.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 8;
    let yPos = margin;
    const visibleCols = columns.filter(c => c.visible);

    doc.setFontSize(14);
    doc.text("Purchase Orders Report", margin, yPos);
    yPos += 8;

    doc.setFontSize(9);
    doc.text(`Generated: ${new Date().toLocaleString()}`, margin, yPos);
    yPos += 6;

    doc.setFontSize(8);
    doc.setFont(undefined, "bold");
    const colWidth = (pageWidth - 2 * margin) / visibleCols.length;
    
    visibleCols.forEach((col, idx) => {
      doc.text(col.label, margin + idx * colWidth, yPos, { maxWidth: colWidth, align: "center", fontSize: 7 });
    });
    yPos += 5;
    doc.setFont(undefined, "normal");

    doc.setFontSize(7);
    filteredRows.forEach((row) => {
      if (yPos > pageHeight - margin) {
        doc.addPage();
        yPos = margin;
      }
      visibleCols.forEach((col, idx) => {
        const val = row[col.key];
        const text = typeof val === "number" ? val.toFixed(2) : String(val);
        doc.text(text.substring(0, 12), margin + idx * colWidth, yPos, { maxWidth: colWidth, align: "center", fontSize: 7 });
      });
      yPos += 4;
    });

    doc.save("purchase-orders.pdf");
  };

  const renderChart = () => {
    if (chartType === "table") {
      const visibleCols = columns.filter(c => c.visible);
      return (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-gray-600 sticky top-0">
              <tr>
                {visibleCols.map(col => (
                  <th key={col.key} className={`text-left px-3 py-2 font-semibold ${col.type === "number" ? "text-right" : ""}`}>
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {currentSlice.length === 0 ? (
                <tr><td colSpan={visibleCols.length} className="text-center py-10 text-gray-400">No data</td></tr>
              ) : (
                currentSlice.map((row, idx) => (
                  <tr key={idx} className="border-t border-gray-100 hover:bg-blue-50/40 transition-colors">
                    {visibleCols.map(col => (
                      <td key={col.key} className={`px-3 py-2 ${col.type === "number" ? "text-right" : "text-left"} text-gray-700 truncate`}>
                        {col.type === "number" ? fmt2(row[col.key]) : row[col.key]}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      );
    } else if (chartType === "pie") {
      return (
        <ResponsiveContainer width="100%" height={350}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, value }) => `${name}: ${fmt2(value)}`}
              outerRadius={100}
              fill="#8884d8"
              dataKey="value"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => fmt2(value)} />
          </PieChart>
        </ResponsiveContainer>
      );
    } else if (chartType === "bar") {
      return (
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(value) => fmt2(value)} />
            <Bar dataKey="value" fill="#45B7D1" name={columns.find(c => c.key === chartField)?.label} radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      );
    } else if (chartType === "area") {
      return (
        <ResponsiveContainer width="100%" height={350}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="colorPOValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#45B7D1" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#45B7D1" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(value) => fmt2(value)} />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#45B7D1"
              fillOpacity={1}
              fill="url(#colorPOValue)"
              name={columns.find(c => c.key === chartField)?.label}
            />
          </AreaChart>
        </ResponsiveContainer>
      );
    }
  };

  const toggleFilter = (type, value) => {
    setFilters(prev => {
      const arr = prev[type];
      if (arr.includes(value)) {
        return { ...prev, [type]: arr.filter(v => v !== value) };
      } else {
        return { ...prev, [type]: [...arr, value] };
      }
    });
    setPage(1);
  };

  const toggleColumn = (key) => {
    setColumns(prev => prev.map(c => c.key === key ? { ...c, visible: !c.visible } : c));
  };

  return (
    <section className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden flex flex-col min-h-[550px]">
      <div className={`px-4 py-3 border-b border-gray-100 border-l-4 ${accent} flex items-center justify-between flex-wrap gap-2`}>
        <p className="font-semibold text-gray-800 text-sm">{title}</p>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-1">
            <button
              onClick={() => setChartType("table")}
              className={`px-2 py-1 rounded text-xs font-medium transition ${chartType === "table" ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-gray-200"}`}
              title="Table View"
            >
              ⊞
            </button>
            <button
              onClick={() => setChartType("pie")}
              className={`px-2 py-1 rounded text-xs font-medium transition ${chartType === "pie" ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-gray-200"}`}
              title="Pie Chart"
            >
              <FaChartPie />
            </button>
            <button
              onClick={() => setChartType("bar")}
              className={`px-2 py-1 rounded text-xs font-medium transition ${chartType === "bar" ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-gray-200"}`}
              title="Bar Chart"
            >
              <FaChartBar />
            </button>
            <button
              onClick={() => setChartType("area")}
              className={`px-2 py-1 rounded text-xs font-medium transition ${chartType === "area" ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-gray-200"}`}
              title="Area Chart"
            >
              <FaChartLine />
            </button>
          </div>

          <div className="relative">
            <button
              onClick={() => setFilterOpen(!filterOpen)}
              className="px-2 py-1.5 rounded border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-medium transition"
              title="Filter Data"
            >
              Filter
            </button>
            {filterOpen && (
              <div className="absolute right-0 top-10 bg-white border border-gray-200 rounded shadow-xl z-10 min-w-[250px] max-h-96 overflow-y-auto">
                <div className="p-3 border-b border-gray-200">
                  <p className="text-xs font-semibold text-gray-700 mb-2">Voucher Type</p>
                  <div className="space-y-1">
                    {uniqueVouchers.map(v => (
                      <label key={v} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
                        <input type="checkbox" checked={filters.voucherTypes.includes(v)} 
                          onChange={() => toggleFilter("voucherTypes", v)} className="w-4 h-4" />
                        <span className="text-xs text-gray-700">{v}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="p-3 border-b border-gray-200">
                  <p className="text-xs font-semibold text-gray-700 mb-2">Products</p>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {uniqueProducts.slice(0, 15).map(p => (
                      <label key={p} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
                        <input type="checkbox" checked={filters.products.includes(p)}
                          onChange={() => toggleFilter("products", p)} className="w-4 h-4" />
                        <span className="text-xs text-gray-700 truncate">{p}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="p-3 border-b border-gray-200">
                  <p className="text-xs font-semibold text-gray-700 mb-2">Purchase Price Range</p>
                  <div className="space-y-1">
                    {purchasePriceBuckets.map(b => (
                      <label key={b} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
                        <input type="checkbox" checked={filters.purchasePriceBuckets.includes(b)}
                          onChange={() => toggleFilter("purchasePriceBuckets", b)} className="w-4 h-4" />
                        <span className="text-xs text-gray-700">{b}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="p-3">
                  <p className="text-xs font-semibold text-gray-700 mb-2">Total Price Range</p>
                  <div className="space-y-1">
                    {totalPriceBuckets.map(b => (
                      <label key={b} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
                        <input type="checkbox" checked={filters.totalPriceBuckets.includes(b)}
                          onChange={() => toggleFilter("totalPriceBuckets", b)} className="w-4 h-4" />
                        <span className="text-xs text-gray-700">{b}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="relative">
            <button
              onClick={() => setColumnOpen(!columnOpen)}
              className="px-2 py-1.5 rounded border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-medium transition"
              title="Select Columns"
            >
              Columns
            </button>
            {columnOpen && (
              <div className="absolute right-0 top-10 bg-white border border-gray-200 rounded shadow-xl z-10 min-w-[220px] max-h-96 overflow-y-auto">
                <div className="p-3">
                  <p className="text-xs font-semibold text-gray-700 mb-2">Visible Columns</p>
                  <div className="space-y-1">
                    {columns.map(col => (
                      <label key={col.key} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
                        <input type="checkbox" checked={col.visible} 
                          onChange={() => toggleColumn(col.key)} className="w-4 h-4" />
                        <span className="text-xs text-gray-700">{col.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="relative">
            <button
              onClick={() => setDlOpen(!dlOpen)}
              className="p-1.5 rounded hover:bg-gray-100 text-gray-600 hover:text-gray-800 transition"
              title="Download"
            >
              <FaDownload className="text-sm" />
            </button>
            {dlOpen && (
              <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded shadow-lg z-10 min-w-[120px]">
                <button
                  onClick={() => {
                    downloadCSV();
                    setDlOpen(false);
                  }}
                  className="block w-full text-left px-3 py-2 text-xs hover:bg-gray-50 flex items-center gap-2"
                >
                  <FaFileExcel className="text-green-600 text-xs" /> Export CSV
                </button>
                <button
                  onClick={() => {
                    downloadPDF();
                    setDlOpen(false);
                  }}
                  className="block w-full text-left px-3 py-2 text-xs hover:bg-gray-50 flex items-center gap-2 border-t border-gray-100"
                >
                  <FaFilePdf className="text-red-600 text-xs" /> Export PDF
                </button>
              </div>
            )}
          </div>

          {chartType !== "table" && (
            <div className="relative">
              <select
                value={chartField}
                onChange={(e) => {
                  setChartField(e.target.value);
                  setChartPage(1);
                }}
                className="h-8 px-2 rounded-lg border border-gray-300 bg-white text-xs text-gray-700 outline-none focus:border-blue-400 cursor-pointer"
              >
                {columns.filter(c => c.type === "number").map(col => (
                  <option key={col.key} value={col.key}>{col.label}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      <div className={`flex-1 flex overflow-hidden ${chartType === "table" ? "flex-col" : ""}`}>
        <div className={`${chartType === "table" ? "flex-1" : "flex-1"} p-4 ${chartType !== "table" ? "border-r border-gray-100" : ""} overflow-auto`}>
          {chartData.length > 0 ? renderChart() : <div className="flex items-center justify-center h-full text-gray-400">No data</div>}
        </div>

        {chartType !== "table" && (
          <div className="w-64 border-l border-gray-100 overflow-y-auto bg-gray-50">
            <div className="p-3 border-b border-gray-200 bg-white sticky top-0">
              <p className="text-xs font-semibold text-gray-600">Data ({currentChartSlice.length} items)</p>
            </div>
            <div className="divide-y divide-gray-200">
              {currentChartSlice.map((row, idx) => {
                const visibleCols = columns.filter(c => c.visible && c.key !== "invoiceId");
                return (
                  <div key={idx} className="p-3 hover:bg-gray-100 transition">
                    <p className="text-xs font-medium text-gray-800 truncate" title={row.productName}>
                      {row.productName}
                    </p>
                    <div className="mt-2 space-y-1 text-xs text-gray-600">
                      {visibleCols.slice(0, 5).map(col => (
                        <div key={col.key} className={`flex justify-between px-2 py-1 rounded ${col.key === chartField ? "bg-blue-100" : "bg-gray-50"}`}>
                          <span className="text-gray-600">{col.label}:</span>
                          <span className={`font-medium ${col.key === chartField ? "text-blue-700" : "text-gray-700"}`}>
                            {col.type === "number" ? fmt2(row[col.key]) : String(row[col.key])}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Pagination for Charts */}
      {chartType !== "table" && (
        <div className="px-4 py-2 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500 bg-gray-50">
          <span>Chart Page {chartPage} of {currentChartTotalPages} (5 items per page)</span>
          <div className="flex items-center gap-1">
            <button
              disabled={chartPage === 1}
              onClick={() => setChartPage((p) => Math.max(1, p - 1))}
              className="h-7 px-2 rounded border border-gray-200 hover:bg-white disabled:opacity-40"
            >
              prev
            </button>
            {Array.from({ length: Math.min(5, currentChartTotalPages) }, (_, i) => {
              const pg = chartPage <= 3 ? i + 1 : chartPage - 2 + i;
              if (pg < 1 || pg > currentChartTotalPages) return null;
              return (
                <button
                  key={pg}
                  onClick={() => setChartPage(pg)}
                  className={`h-7 w-7 rounded border text-xs ${
                    pg === chartPage
                      ? "bg-blue-600 text-white border-blue-600"
                      : "border-gray-200 hover:bg-white"
                  }`}
                >
                  {pg}
                </button>
              );
            })}
            <button
              disabled={chartPage === currentChartTotalPages}
              onClick={() => setChartPage((p) => Math.min(currentChartTotalPages, p + 1))}
              className="h-7 px-2 rounded border border-gray-200 hover:bg-white disabled:opacity-40"
            >
              next
            </button>
          </div>
        </div>
      )}

      {/* Pagination for Table */}
      {chartType === "table" && (
        <div className="px-4 py-2 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500 bg-gray-50">
          <span>Page {page} of {currentTotalPages}</span>
          <div className="flex items-center gap-1">
            <button
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="h-7 px-2 rounded border border-gray-200 hover:bg-white disabled:opacity-40"
            >
              prev
            </button>
            {Array.from({ length: Math.min(5, currentTotalPages) }, (_, i) => {
              const pg = page <= 3 ? i + 1 : page - 2 + i;
              if (pg < 1 || pg > currentTotalPages) return null;
              return (
                <button
                  key={pg}
                  onClick={() => setPage(pg)}
                  className={`h-7 w-7 rounded border text-xs ${
                    pg === page
                      ? "bg-blue-600 text-white border-blue-600"
                      : "border-gray-200 hover:bg-white"
                  }`}
                >
                  {pg}
                </button>
              );
            })}
            <button
              disabled={page === currentTotalPages}
              onClick={() => setPage((p) => Math.min(currentTotalPages, p + 1))}
              className="h-7 px-2 rounded border border-gray-200 hover:bg-white disabled:opacity-40"
            >
              next
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function SalesOrderTable({ title, rows, accent, page, setPage, columns, setColumns, chartField, setChartField }) {
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const chartTotalPages = Math.max(1, Math.ceil(rows.length / CHART_PAGE_SIZE));
  const [chartPage, setChartPage] = useState(1);
  const slice = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const chartSlice = rows.slice((chartPage - 1) * CHART_PAGE_SIZE, chartPage * CHART_PAGE_SIZE);
  const [chartType, setChartType] = useState("table");
  const [dlOpen, setDlOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [columnOpen, setColumnOpen] = useState(false);
  const [filters, setFilters] = useState({
    voucherTypes: [],
    products: [],
    sellingPriceBuckets: [],
    totalPriceBuckets: [],
  });

  // Get unique filter options
  const uniqueVouchers = [...new Set(rows.map(r => r.voucherType))];
  const uniqueProducts = [...new Set(rows.map(r => r.productName))];
  const sellingPriceBuckets = ["0-250", "250-500", "500-1000", "1000+"];
  const totalPriceBuckets = ["0-1000", "1000-5000", "5000-10000", "10000+"];

  // Apply filters
  const filteredRows = rows.filter(row => {
    if (filters.voucherTypes.length && !filters.voucherTypes.includes(row.voucherType)) return false;
    if (filters.products.length && !filters.products.includes(row.productName)) return false;
    if (filters.sellingPriceBuckets.length) {
      const price = row.sellingPrice;
      const match = filters.sellingPriceBuckets.some(bucket => {
        if (bucket === "0-250") return price >= 0 && price < 250;
        if (bucket === "250-500") return price >= 250 && price < 500;
        if (bucket === "500-1000") return price >= 500 && price < 1000;
        if (bucket === "1000+") return price >= 1000;
        return false;
      });
      if (!match) return false;
    }
    if (filters.totalPriceBuckets.length) {
      const tp = row.totalPrice;
      const match = filters.totalPriceBuckets.some(bucket => {
        if (bucket === "0-1000") return tp >= 0 && tp < 1000;
        if (bucket === "1000-5000") return tp >= 1000 && tp < 5000;
        if (bucket === "5000-10000") return tp >= 5000 && tp < 10000;
        if (bucket === "10000+") return tp >= 10000;
        return false;
      });
      if (!match) return false;
    }
    return true;
  });

  const currentSlice = filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const currentChartSlice = filteredRows.slice((chartPage - 1) * CHART_PAGE_SIZE, chartPage * CHART_PAGE_SIZE);
  const currentTotalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const currentChartTotalPages = Math.max(1, Math.ceil(filteredRows.length / CHART_PAGE_SIZE));

  const numericColumns = columns.filter(c => c.type === "number").map(c => c.key);

  const chartData = currentChartSlice.map((row) => ({
    name: row.customerName.length > 18 ? row.customerName.substring(0, 18) + "..." : row.customerName,
    fullName: row.customerName,
    value: parseFloat((row[chartField] || 0).toFixed(2)),
    ...row,
  }));

  const downloadCSV = () => {
    const visibleCols = columns.filter(c => c.visible);
    const headers = visibleCols.map(c => c.label);
    const csvContent = [
      headers.join(","),
      ...filteredRows.map(r => [
        ...visibleCols.map(col => {
          const val = r[col.key];
          if (typeof val === "string") return `"${val.replace(/"/g, '""')}"`;
          return val.toFixed ? val.toFixed(2) : val;
        })
      ].join(","))
    ].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "sales-orders.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 8;
    let yPos = margin;
    const visibleCols = columns.filter(c => c.visible);

    doc.setFontSize(14);
    doc.text("Sales Orders Report", margin, yPos);
    yPos += 8;

    doc.setFontSize(9);
    doc.text(`Generated: ${new Date().toLocaleString()}`, margin, yPos);
    yPos += 6;

    doc.setFontSize(8);
    doc.setFont(undefined, "bold");
    const colWidth = (pageWidth - 2 * margin) / visibleCols.length;
    
    visibleCols.forEach((col, idx) => {
      doc.text(col.label, margin + idx * colWidth, yPos, { maxWidth: colWidth, align: "center", fontSize: 7 });
    });
    yPos += 5;
    doc.setFont(undefined, "normal");

    doc.setFontSize(7);
    filteredRows.forEach((row) => {
      if (yPos > pageHeight - margin) {
        doc.addPage();
        yPos = margin;
      }
      visibleCols.forEach((col, idx) => {
        const val = row[col.key];
        const text = typeof val === "number" ? val.toFixed(2) : String(val);
        doc.text(text.substring(0, 12), margin + idx * colWidth, yPos, { maxWidth: colWidth, align: "center", fontSize: 7 });
      });
      yPos += 4;
    });

    doc.save("sales-orders.pdf");
  };

  const renderChart = () => {
    if (chartType === "table") {
      const visibleCols = columns.filter(c => c.visible);
      return (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-gray-600 sticky top-0">
              <tr>
                {visibleCols.map(col => (
                  <th key={col.key} className={`text-left px-3 py-2 font-semibold ${col.type === "number" ? "text-right" : ""}`}>
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {currentSlice.length === 0 ? (
                <tr><td colSpan={visibleCols.length} className="text-center py-10 text-gray-400">No data</td></tr>
              ) : (
                currentSlice.map((row, idx) => (
                  <tr key={idx} className="border-t border-gray-100 hover:bg-blue-50/40 transition-colors">
                    {visibleCols.map(col => (
                      <td key={col.key} className={`px-3 py-2 ${col.type === "number" ? "text-right" : "text-left"} text-gray-700 truncate`}>
                        {col.type === "number" ? fmt2(row[col.key]) : row[col.key]}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      );
    } else if (chartType === "pie") {
      return (
        <ResponsiveContainer width="100%" height={350}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, value }) => `${name}: ${fmt2(value)}`}
              outerRadius={100}
              fill="#8884d8"
              dataKey="value"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => fmt2(value)} />
          </PieChart>
        </ResponsiveContainer>
      );
    } else if (chartType === "bar") {
      return (
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(value) => fmt2(value)} />
            <Bar dataKey="value" fill="#45B7D1" name={columns.find(c => c.key === chartField)?.label} radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      );
    } else if (chartType === "area") {
      return (
        <ResponsiveContainer width="100%" height={350}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="colorSOValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#45B7D1" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#45B7D1" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(value) => fmt2(value)} />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#45B7D1"
              fillOpacity={1}
              fill="url(#colorSOValue)"
              name={columns.find(c => c.key === chartField)?.label}
            />
          </AreaChart>
        </ResponsiveContainer>
      );
    }
  };

  const toggleFilter = (type, value) => {
    setFilters(prev => {
      const arr = prev[type];
      if (arr.includes(value)) {
        return { ...prev, [type]: arr.filter(v => v !== value) };
      } else {
        return { ...prev, [type]: [...arr, value] };
      }
    });
    setPage(1);
  };

  const toggleColumn = (key) => {
    setColumns(prev => prev.map(c => c.key === key ? { ...c, visible: !c.visible } : c));
  };

  return (
    <section className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden flex flex-col min-h-[550px]">
      <div className={`px-4 py-3 border-b border-gray-100 border-l-4 ${accent} flex items-center justify-between flex-wrap gap-2`}>
        <p className="font-semibold text-gray-800 text-sm">{title}</p>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-1">
            <button onClick={() => setChartType("table")} className={`px-2 py-1 rounded text-xs font-medium transition ${chartType === "table" ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-gray-200"}`} title="Table View">⊞</button>
            <button onClick={() => setChartType("pie")} className={`px-2 py-1 rounded text-xs font-medium transition ${chartType === "pie" ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-gray-200"}`} title="Pie Chart"><FaChartPie /></button>
            <button onClick={() => setChartType("bar")} className={`px-2 py-1 rounded text-xs font-medium transition ${chartType === "bar" ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-gray-200"}`} title="Bar Chart"><FaChartBar /></button>
            <button onClick={() => setChartType("area")} className={`px-2 py-1 rounded text-xs font-medium transition ${chartType === "area" ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-gray-200"}`} title="Area Chart"><FaChartLine /></button>
          </div>
          <div className="relative">
            <button onClick={() => setFilterOpen(!filterOpen)} className="px-2 py-1.5 rounded border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-medium transition" title="Filter Data">Filter</button>
            {filterOpen && (
              <div className="absolute right-0 top-10 bg-white border border-gray-200 rounded shadow-xl z-10 min-w-[250px] max-h-96 overflow-y-auto">
                <div className="p-3 border-b border-gray-200"><p className="text-xs font-semibold text-gray-700 mb-2">Voucher Type</p><div className="space-y-1">{uniqueVouchers.map(v => <label key={v} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded"><input type="checkbox" checked={filters.voucherTypes.includes(v)} onChange={() => toggleFilter("voucherTypes", v)} className="w-4 h-4" /><span className="text-xs text-gray-700">{v}</span></label>)}</div></div>
                <div className="p-3 border-b border-gray-200"><p className="text-xs font-semibold text-gray-700 mb-2">Products</p><div className="space-y-1 max-h-32 overflow-y-auto">{uniqueProducts.slice(0, 15).map(p => <label key={p} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded"><input type="checkbox" checked={filters.products.includes(p)} onChange={() => toggleFilter("products", p)} className="w-4 h-4" /><span className="text-xs text-gray-700 truncate">{p}</span></label>)}</div></div>
                <div className="p-3 border-b border-gray-200"><p className="text-xs font-semibold text-gray-700 mb-2">Selling Price Range</p><div className="space-y-1">{sellingPriceBuckets.map(b => <label key={b} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded"><input type="checkbox" checked={filters.sellingPriceBuckets.includes(b)} onChange={() => toggleFilter("sellingPriceBuckets", b)} className="w-4 h-4" /><span className="text-xs text-gray-700">{b}</span></label>)}</div></div>
                <div className="p-3"><p className="text-xs font-semibold text-gray-700 mb-2">Total Price Range</p><div className="space-y-1">{totalPriceBuckets.map(b => <label key={b} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded"><input type="checkbox" checked={filters.totalPriceBuckets.includes(b)} onChange={() => toggleFilter("totalPriceBuckets", b)} className="w-4 h-4" /><span className="text-xs text-gray-700">{b}</span></label>)}</div></div>
              </div>
            )}
          </div>
          <div className="relative">
            <button onClick={() => setColumnOpen(!columnOpen)} className="px-2 py-1.5 rounded border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-medium transition" title="Select Columns">Columns</button>
            {columnOpen && (
              <div className="absolute right-0 top-10 bg-white border border-gray-200 rounded shadow-xl z-10 min-w-[220px] max-h-96 overflow-y-auto">
                <div className="p-3"><p className="text-xs font-semibold text-gray-700 mb-2">Visible Columns</p><div className="space-y-1">{columns.map(col => <label key={col.key} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded"><input type="checkbox" checked={col.visible} onChange={() => toggleColumn(col.key)} className="w-4 h-4" /><span className="text-xs text-gray-700">{col.label}</span></label>)}</div></div>
              </div>
            )}
          </div>
          <div className="relative">
            <button onClick={() => setDlOpen(!dlOpen)} className="p-1.5 rounded hover:bg-gray-100 text-gray-600 hover:text-gray-800 transition" title="Download"><FaDownload className="text-sm" /></button>
            {dlOpen && (
              <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded shadow-lg z-10 min-w-[120px]">
                <button onClick={() => { downloadCSV(); setDlOpen(false); }} className="block w-full text-left px-3 py-2 text-xs hover:bg-gray-50 flex items-center gap-2"><FaFileExcel className="text-green-600 text-xs" /> Export CSV</button>
                <button onClick={() => { downloadPDF(); setDlOpen(false); }} className="block w-full text-left px-3 py-2 text-xs hover:bg-gray-50 flex items-center gap-2 border-t border-gray-100"><FaFilePdf className="text-red-600 text-xs" /> Export PDF</button>
              </div>
            )}
          </div>
          {chartType !== "table" && (
            <div className="relative">
              <select value={chartField} onChange={(e) => { setChartField(e.target.value); setChartPage(1); }} className="h-8 px-2 rounded-lg border border-gray-300 bg-white text-xs text-gray-700 outline-none focus:border-blue-400 cursor-pointer">
                {columns.filter(c => c.type === "number").map(col => <option key={col.key} value={col.key}>{col.label}</option>)}
              </select>
            </div>
          )}
        </div>
      </div>
      <div className={`flex-1 flex overflow-hidden ${chartType === "table" ? "flex-col" : ""}`}>
        <div className={`${chartType === "table" ? "flex-1" : "flex-1"} p-4 ${chartType !== "table" ? "border-r border-gray-100" : ""} overflow-auto`}>
          {chartData.length > 0 ? renderChart() : <div className="flex items-center justify-center h-full text-gray-400">No data</div>}
        </div>
        {chartType !== "table" && (
          <div className="w-64 border-l border-gray-100 overflow-y-auto bg-gray-50">
            <div className="p-3 border-b border-gray-200 bg-white sticky top-0"><p className="text-xs font-semibold text-gray-600">Data ({currentChartSlice.length} items)</p></div>
            <div className="divide-y divide-gray-200">
              {currentChartSlice.map((row, idx) => {
                const visibleCols = columns.filter(c => c.visible && c.key !== "invoiceId");
                return (
                  <div key={idx} className="p-3 hover:bg-gray-100 transition">
                    <p className="text-xs font-medium text-gray-800 truncate" title={row.customerName}>{row.customerName}</p>
                    <div className="mt-2 space-y-1 text-xs text-gray-600">
                      {visibleCols.slice(0, 5).map(col => (
                        <div key={col.key} className={`flex justify-between px-2 py-1 rounded ${col.key === chartField ? "bg-blue-100" : "bg-gray-50"}`}>
                          <span className="text-gray-600">{col.label}:</span>
                          <span className={`font-medium ${col.key === chartField ? "text-blue-700" : "text-gray-700"}`}>{col.type === "number" ? fmt2(row[col.key]) : String(row[col.key])}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
      {chartType !== "table" && (
        <div className="px-4 py-2 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500 bg-gray-50">
          <span>Chart Page {chartPage} of {currentChartTotalPages} (5 items per page)</span>
          <div className="flex items-center gap-1">
            <button disabled={chartPage === 1} onClick={() => setChartPage((p) => Math.max(1, p - 1))} className="h-7 px-2 rounded border border-gray-200 hover:bg-white disabled:opacity-40">prev</button>
            {Array.from({ length: Math.min(5, currentChartTotalPages) }, (_, i) => {
              const pg = chartPage <= 3 ? i + 1 : chartPage - 2 + i;
              if (pg < 1 || pg > currentChartTotalPages) return null;
              return (
                <button key={pg} onClick={() => setChartPage(pg)} className={`h-7 w-7 rounded border text-xs ${pg === chartPage ? "bg-blue-600 text-white border-blue-600" : "border-gray-200 hover:bg-white"}`}>{pg}</button>
              );
            })}
            <button disabled={chartPage === currentChartTotalPages} onClick={() => setChartPage((p) => Math.min(currentChartTotalPages, p + 1))} className="h-7 px-2 rounded border border-gray-200 hover:bg-white disabled:opacity-40">next</button>
          </div>
        </div>
      )}
      {chartType === "table" && (
        <div className="px-4 py-2 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500 bg-gray-50">
          <span>Page {page} of {currentTotalPages}</span>
          <div className="flex items-center gap-1">
            <button disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="h-7 px-2 rounded border border-gray-200 hover:bg-white disabled:opacity-40">prev</button>
            {Array.from({ length: Math.min(5, currentTotalPages) }, (_, i) => {
              const pg = page <= 3 ? i + 1 : page - 2 + i;
              if (pg < 1 || pg > currentTotalPages) return null;
              return (
                <button key={pg} onClick={() => setPage(pg)} className={`h-7 w-7 rounded border text-xs ${pg === page ? "bg-blue-600 text-white border-blue-600" : "border-gray-200 hover:bg-white"}`}>{pg}</button>
              );
            })}
            <button disabled={page === currentTotalPages} onClick={() => setPage((p) => Math.min(currentTotalPages, p + 1))} className="h-7 px-2 rounded border border-gray-200 hover:bg-white disabled:opacity-40">next</button>
          </div>
        </div>
      )}
    </section>
  );
}

export default function BranchInsights() {
  const { branch, user } = useBranch();
  const [menuOpen,           setMenuOpen]           = useState(false);
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(false);
  const [currentView, setCurrentView] = useState("snap");
  const defaultRange = useMemo(() => getMonthRange(), []);
  const [startDate,  setStartDate]  = useState(defaultRange.startDate);
  const [endDate,    setEndDate]    = useState(defaultRange.endDate);
  const [loading,    setLoading]    = useState(false);
  const [receivable, setReceivable] = useState(0);
  const [payable,    setPayable]    = useState(0);
  const [periodTotal,setPeriodTotal]= useState(0);
  const [products,   setProducts]   = useState([]);
  const [groupBy,    setGroupBy]    = useState("item");
  const [ppPage,     setPpPage]     = useState(1);
  const [spPage,     setSpPage]     = useState(1);
  const [poItems,    setPoItems]    = useState([]);
  const [poPage,     setPoPage]     = useState(1);
  const [poColumns, setPoColumns] = useState([
    { key: "invoiceId", label: "Invoice ID", type: "string", visible: true },
    { key: "voucherType", label: "Voucher Type", type: "string", visible: true },
    { key: "warehouse", label: "Warehouse", type: "string", visible: true },
    { key: "vendor", label: "Vendor", type: "string", visible: true },
    { key: "productName", label: "Product Name", type: "string", visible: true },
    { key: "productGroup", label: "Product Group", type: "string", visible: true },
    { key: "qty", label: "Qty", type: "number", visible: true },
    { key: "purchasePrice", label: "P.Price", type: "number", visible: true },
    { key: "sellingPrice", label: "S.Price", type: "number", visible: true },
    { key: "totalPrice", label: "Total Price", type: "number", visible: true },
    { key: "cgst", label: "CGST", type: "number", visible: true },
    { key: "sgst", label: "SGST", type: "number", visible: true },
    { key: "igst", label: "IGST", type: "number", visible: true },
    { key: "billingPerson", label: "Billing Person", type: "string", visible: true },
  ]);
  const [poChartField, setPoChartField] = useState("totalPrice");
  const [soItems,    setSoItems]    = useState([]);
  const [soPage,     setSoPage]     = useState(1);
  const [soColumns, setSoColumns] = useState([
    { key: "invoiceId", label: "Invoice ID", type: "string", visible: true },
    { key: "voucherType", label: "Voucher Type", type: "string", visible: true },
    { key: "warehouse", label: "Warehouse", type: "string", visible: true },
    { key: "customerName", label: "Customer", type: "string", visible: true },
    { key: "productName", label: "Product Name", type: "string", visible: true },
    { key: "productGroup", label: "Product Group", type: "string", visible: true },
    { key: "qty", label: "Qty", type: "number", visible: true },
    { key: "sellingPrice", label: "Selling Price", type: "number", visible: true },
    { key: "gst", label: "GST", type: "number", visible: true },
    { key: "totalPrice", label: "Total Price", type: "number", visible: true },
    { key: "salesOwner", label: "Sales Owner", type: "string", visible: true },
    { key: "salesMan", label: "Sales Man", type: "string", visible: true },
    { key: "deliveryMan", label: "Delivery Man", type: "string", visible: true },
  ]);
  const [soChartField, setSoChartField] = useState("totalPrice");

  const trialBalancePercent = useMemo(() => {
    const max = Math.max(receivable, payable);
    return max ? (Math.min(receivable, payable) / max) * 100 : 0;
  }, [receivable, payable]);

  const rawRows = useMemo(() => buildRawRows(products, groupBy), [products, groupBy]);
  const ppRows  = useMemo(() => computeTable(rawRows, "purchase"), [rawRows]);
  const spRows  = useMemo(() => computeTable(rawRows, "sell"),     [rawRows]);

  useEffect(() => { setPpPage(1); setSpPage(1); }, [groupBy]);

  const loadInsights = async () => {
    if (!branch?._id) return;
    setLoading(true);
    try {
      const [receiptRes, paymentRes, soRes, poRes, prodRes, groupRes, billingRes, salesmensRes, deliversRes] = await Promise.all([
        fetchWithAuth(`${API_BASE}/receipts`),
        fetchWithAuth(`${API_BASE}/payments`),
        fetchWithAuth(`${API_BASE}/sales-orders?branchId=${branch._id}`),
        fetchWithAuth(`${API_BASE}/purchase-orders?branchId=${branch._id}`),
        fetchWithAuth(`${API_BASE}/products?branchId=${branch._id}&limit=10000`),
        fetchWithAuth(`${API_BASE}/product-groups?branchId=${branch._id}`),
        fetchWithAuth(`${API_BASE}/sales-owners?branchId=${branch._id}`),
        fetchWithAuth(`${API_BASE}/sales-men?branchId=${branch._id}`),
        fetchWithAuth(`${API_BASE}/delivery-men?branchId=${branch._id}`),
      ]);

      if (!receiptRes.ok) {
        console.error("Receipt fetch failed:", receiptRes.status, receiptRes.statusText);
      }
      if (!paymentRes.ok) {
        console.error("Payment fetch failed:", paymentRes.status, paymentRes.statusText);
      }
      if (!soRes.ok) {
        console.error("Sales Order fetch failed:", soRes.status, soRes.statusText);
      }
      if (!poRes.ok) {
        console.error("Purchase Order fetch failed:", poRes.status, poRes.statusText);
      }
      if (!prodRes.ok) {
        console.error("Product fetch failed:", prodRes.status, prodRes.statusText);
      }

      const receiptJson  = receiptRes.ok ? await receiptRes.json() : { data: [] };
      const paymentJson  = paymentRes.ok ? await paymentRes.json() : { data: [] };
      const soJson       = soRes.ok ? await soRes.json() : [];
      const poJson       = poRes.ok ? await poRes.json() : [];
      const prodJson     = prodRes.ok ? await prodRes.json() : { data: [] };
      const groupJson    = groupRes.ok ? await groupRes.json() : { data: [] };
      const billingJson  = billingRes.ok ? await billingRes.json() : { data: [] };
      const salesmensJson  = salesmensRes.ok ? await salesmensRes.json() : { data: [] };
      const deliversJson  = deliversRes.ok ? await deliversRes.json() : { data: [] };

      const receipts       = receiptJson?.data  || [];
      const payments       = paymentJson?.data  || [];
      const salesOrders    = soJson              || [];
      const purchaseOrders = poJson              || [];
      const rawProds       = prodJson?.data || prodJson?.products || prodJson || [];
      const productGroups  = groupJson?.data    || [];
      const billingPersons = billingJson?.data  || [];
      const salesMens      = salesmensJson?.data || [];
      const deliveryMens   = deliversJson?.data || [];
      setProducts(Array.isArray(rawProds) ? rawProds : []);

      // Helper to extract ID string from various formats
      const extractId = (val) => {
        if (!val) return "";
        // String ID
        if (typeof val === 'string') return val.trim();
        // Object with _id property
        if (val._id) {
          const id = val._id;
          if (typeof id === 'string') return id.trim();
          if (typeof id === 'object' && id.$oid) return id.$oid; // MongoDB $oid format
          if (typeof id === 'object' && id.toString) return id.toString().trim();
          return String(id).trim();
        }
        // ObjectId object or similar with toString
        if (typeof val.toString === 'function' && !(val instanceof Array)) {
          return val.toString().trim();
        }
        return String(val).trim();
      };

      // Create mappings for ID to Name
      const groupMap = {};
      for (const g of productGroups) {
        const groupIdStr = extractId(g._id);
        if (groupIdStr) {
          groupMap[groupIdStr] = g.name;
        }
      }
      const billingMap = {};
      for (const b of billingPersons) {
        const billingIdStr = extractId(b._id);
        if (billingIdStr) {
          billingMap[billingIdStr] = b.name;
        }
      }
      const salesmansMap = {};
      for (const s of salesMens) {
        const sIdStr = extractId(s._id);
        if (sIdStr) {
          salesmansMap[sIdStr] = s.name;
        }
      }
      const deliveryMansMap = {};
      for (const d of deliveryMens) {
        const dIdStr = extractId(d._id);
        if (dIdStr) {
          deliveryMansMap[dIdStr] = d.name;
        }
      }

      // Process and flatten PO items
      const flattenedPoItems = [];
      for (const po of (purchaseOrders || [])) {
        const from = new Date(startDate);
        const to = new Date(endDate);
        from.setHours(0, 0, 0, 0);
        to.setHours(23, 59, 59, 999);
        const poDate = new Date(po.date || po.createdAt);
        if (poDate >= from && poDate <= to) {
          for (const item of (po.items || [])) {
            const groupIdStr = extractId(item.productGroup);
            const groupName = groupMap[groupIdStr] || "-";
            
            const billingIdStr = extractId(po.billingPerson);
            const billingName = billingMap[billingIdStr] || "-";
            
            flattenedPoItems.push({
              invoiceId: po.invoiceId || "-",
              voucherType: po.voucherType || "-",
              warehouse: po.warehouse || "-",
              vendor: po.vendor || "-",
              productName: item.name || "-",
              productGroup: groupName,
              qty: Number(item.qty) || 0,
              purchasePrice: Number(item.purchasePrice) || 0,
              sellingPrice: Number(item.sellingPrice) || 0,
              totalPrice: Number(item.total) || (Number(item.qty) || 0) * (Number(item.purchasePrice) || 0),
              cgst: Number(item.cgst) || 0,
              sgst: Number(item.sgst) || 0,
              igst: Number(item.igst) || 0,
              billingPerson: billingName,
            });
          }
        }
      }
      setPoItems(flattenedPoItems);

      // Process and flatten SO items
      const flattenedSoItems = [];
      for (const so of (salesOrders || [])) {
        const from = new Date(startDate);
        const to = new Date(endDate);
        from.setHours(0, 0, 0, 0);
        to.setHours(23, 59, 59, 999);
        const soDate = new Date(so.date || so.createdAt);
        if (soDate >= from && soDate <= to) {
          for (const item of (so.items || [])) {
            const groupIdStr = extractId(item.productGroup);
            const groupName = groupMap[groupIdStr] || "-";
            
            const salesManIdStr = extractId(so.salesMan);
            const salesManName = salesmansMap[salesManIdStr] || "-";
            
            const deliveryManIdStr = extractId(so.deliveryMan);
            const deliveryManName = deliveryMansMap[deliveryManIdStr] || "-";
            
            flattenedSoItems.push({
              invoiceId: so.invoiceId || "-",
              voucherType: so.voucherType || "-",
              warehouse: so.warehouse || "-",
              customerName: so.customer?.name || "-",
              productName: item.name || "-",
              productGroup: groupName,
              qty: Number(item.qty) || 0,
              sellingPrice: Number(item.sellingPrice) || 0,
              gst: Number(item.gst) || 0,
              totalPrice: Number(item.total) || (Number(item.qty) || 0) * (Number(item.sellingPrice) || 0),
              salesOwner: so.salesOwner || "-",
              salesMan: salesManName,
              deliveryMan: deliveryManName,
            });
          }
        }
      }
      setSoItems(flattenedSoItems);

      const soIds     = new Set((salesOrders    || []).map((s) => String(s._id)));
      const poIds     = new Set((purchaseOrders || []).map((p) => String(p._id)));
      const poInvoIds = new Set((purchaseOrders || []).map((p) => p.invoiceId).filter(Boolean));

      const from = new Date(startDate); from.setHours(0, 0, 0, 0);
      const to   = new Date(endDate);   to.setHours(23, 59, 59, 999);
      const inRange = (v) => { const d = new Date(v); return !Number.isNaN(d.getTime()) && d >= from && d <= to; };

      const filtRec = (receipts || []).filter((r) => {
        const soId = String(r.originalSalesOrderId?._id || r.originalSalesOrderId || "");
        return soIds.has(soId) && (!r.status || r.status === "confirmed") && inRange(r.createdAt || r.updatedAt);
      });
      const filtPay = (payments || []).filter((p) => {
        const poId  = String(p.purchaseOrder?.poId?._id || p.purchaseOrder?.poId || "");
        const invId = p.purchaseOrder?.invoiceId;
        return (poIds.has(poId) || (invId && poInvoIds.has(invId))) &&
               (!p.status || p.status === "completed") &&
               inRange(p.paymentDate || p.createdAt);
      });

      const rec = filtRec.reduce((s, r) => s + (Number(r.amount) || 0), 0);
      const pay = filtPay.reduce((s, r) => s + (Number(r.amount) || 0), 0);
      setReceivable(rec); setPayable(pay); setPeriodTotal(rec + pay);
    } catch (err) {
      console.error("Failed to load insights:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadInsights(); }, [branch?._id, startDate, endDate]);

  const showLabels = desktopSidebarOpen || menuOpen;

  return (
    <div className="min-h-screen bg-[#f3f5f9]">
      {/* mobile overlay */}
      <div className={`md:hidden fixed inset-0 z-40 bg-black/40 transition-opacity ${menuOpen ? "opacity-100 visible" : "opacity-0 invisible"}`}
        onClick={() => setMenuOpen(false)} />

      {/* Sidebar */}
      <aside className={`fixed top-0 left-0 z-50 h-full md:w-auto bg-[#112f63]/60 backdrop-blur-xl text-white border-r border-white/20 shadow-2xl transform transition-all duration-300 ${menuOpen ? "translate-x-0 w-72" : "-translate-x-full md:translate-x-0"}`}>
        <div className={`h-full transition-all duration-300 ${desktopSidebarOpen ? "md:w-72" : "md:w-20"}`}>
          <div className={`h-16 border-b border-white/15 flex items-center ${showLabels ? "px-5 justify-between" : "justify-center"}`}>
            {showLabels ? (
              <div>
                <p className="text-[10px] text-blue-200 uppercase tracking-widest">Insights</p>
                <p className="font-bold text-lg leading-tight">Analytics</p>
              </div>
            ) : <FaChartBar className="text-xl" />}
            <button className="md:hidden p-2" onClick={() => setMenuOpen(false)}><FaTimes /></button>
          </div>
          <nav className="p-3 space-y-1">
            <button onClick={() => { setCurrentView("snap"); setMenuOpen(false); }} title="Product View"
              className={`w-full rounded-xl font-semibold cursor-pointer transition-all duration-300 ${currentView === "snap" ? "bg-white text-[#112f63]" : "hover:bg-white/10 text-white/90"} ${showLabels ? "px-4 py-3 flex items-center gap-3" : "h-12 w-12 mx-auto flex items-center justify-center"}`}>
              <FaChartBar />{showLabels && <span>Product View</span>}
            </button>
            <button onClick={() => { setCurrentView("po"); setMenuOpen(false); }} title="Purchase Orders"
              className={`w-full rounded-xl font-semibold cursor-pointer transition-all duration-300 ${currentView === "po" ? "bg-white text-[#112f63]" : "hover:bg-white/10 text-white/90"} ${showLabels ? "px-4 py-3 flex items-center gap-3" : "h-12 w-12 mx-auto flex items-center justify-center"}`}>
              <FaBox />{showLabels && <span>Purchase Orders View</span>}
            </button>
            <button onClick={() => { setCurrentView("so"); setMenuOpen(false); }} title="Sales Orders"
              className={`w-full rounded-xl font-semibold cursor-pointer transition-all duration-300 ${currentView === "so" ? "bg-white text-[#112f63]" : "hover:bg-white/10 text-white/90"} ${showLabels ? "px-4 py-3 flex items-center gap-3" : "h-12 w-12 mx-auto flex items-center justify-center"}`}>
              <FaChartBar />{showLabels && <span>Sales Orders View</span>}
            </button>
            <Link to="/branch-home" title="Back to Branch Home"
              className={`rounded-xl hover:bg-white/10 text-white/90 transition-all duration-300 block ${showLabels ? "px-4 py-3 flex items-center gap-3" : "h-12 w-12 mx-auto flex items-center justify-center"}`}>
              <FaHome />{showLabels && <span>Back to Home</span>}
            </Link>
          </nav>
        </div>
      </aside>

      {/* Top bar */}
      <header className={`fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 z-30 px-4 md:px-6 transition-all duration-300 ${desktopSidebarOpen ? "md:left-72" : "md:left-20"}`}>
        <div className="h-full flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button className="p-2 rounded-lg hover:bg-gray-100"
              onClick={() => { if (window.innerWidth < 768) setMenuOpen(true); else setDesktopSidebarOpen((p) => !p); }}>
              <FaBars className="text-gray-700" />
            </button>
            <div>
              <p className="text-xs text-gray-500">Logged in user</p>
              <p className="font-semibold text-gray-800">{user?.username || "-"} ({user?.role || "-"})</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden lg:flex items-center gap-1 text-xs text-gray-500"><FaCalendarAlt /> Date Filter</span>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-9 px-2 rounded-lg border border-gray-300 text-sm" />
            <input type="date" value={endDate}   onChange={(e) => setEndDate(e.target.value)}   className="h-9 px-2 rounded-lg border border-gray-300 text-sm" />
            <button onClick={loadInsights} className="h-9 w-9 rounded-lg border border-gray-300 flex items-center justify-center hover:bg-gray-50" title="Refresh">
              <FaSyncAlt className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className={`pt-20 pb-8 px-3 md:px-6 transition-all duration-300 ${desktopSidebarOpen ? "md:pl-[19rem]" : "md:pl-24"}`}>
        <div className="max-w-[1500px] mx-auto">
          <div className="mb-5">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800">{currentView === "snap" ? "Product Analysis" : currentView === "po" ? "Purchase Orders" : "Sales Orders"}</h1>
            <p className="text-sm text-gray-500 mt-1">Branch: {branch?.name || "-"}</p>
          </div>

          {/* Show KPI cards and Product Analysis for Snap view */}
          {currentView === "snap" && (
          <>
          {/* KPI cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
            <div className="rounded-xl bg-white border border-gray-200 border-l-4 border-l-blue-500 shadow-sm p-4">
              <p className="text-sm font-semibold text-gray-600">Selected Period</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(periodTotal)}</p>
              <p className="text-xs text-gray-500 mt-2">{startDate} to {endDate}</p>
            </div>
            <div className="rounded-xl bg-white border border-gray-200 border-l-4 border-l-emerald-600 shadow-sm p-4">
              <p className="text-sm font-semibold text-gray-600">Receivable</p>
              <p className="text-2xl font-bold text-emerald-700 mt-1">{formatCurrency(receivable)}</p>
              <p className="text-xs text-gray-500 mt-2">Total of receipt amount</p>
            </div>
            <div className="rounded-xl bg-white border border-gray-200 border-l-4 border-l-amber-600 shadow-sm p-4">
              <p className="text-sm font-semibold text-gray-600">Payable</p>
              <p className="text-2xl font-bold text-amber-700 mt-1">{formatCurrency(payable)}</p>
              <p className="text-xs text-gray-500 mt-2">Total of payment amount</p>
            </div>
            <div className="rounded-xl bg-white border border-gray-200 border-l-4 border-l-violet-600 shadow-sm p-4">
              <p className="text-sm font-semibold text-gray-600">Trial Balance (%)</p>
              <p className="text-2xl font-bold text-violet-700 mt-1">{trialBalancePercent.toFixed(2)}%</p>
              <p className="text-xs text-gray-500 mt-2">Equalizing ratio of payable and receivable</p>
            </div>
          </div>

          {/* Product tables */}
          <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h2 className="text-xl font-bold text-gray-800">Product Analysis</h2>
            <div className="relative w-52">
              <select value={groupBy} onChange={(e) => setGroupBy(e.target.value)}
                className="w-full appearance-none h-9 pl-3 pr-8 rounded-lg border border-gray-300 bg-white text-sm text-gray-700 outline-none focus:border-blue-400 cursor-pointer">
                {FILTER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <FaChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <ProductTable title="Purchasing Price" rows={ppRows} accent="border-l-amber-500 bg-amber-50"   page={ppPage} setPage={setPpPage} />
            <ProductTable title="Selling Price"    rows={spRows} accent="border-l-emerald-500 bg-emerald-50" page={spPage} setPage={setSpPage} />
          </div>

          <div className="mt-5 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600 flex items-center gap-2">
            <FaUser className="text-blue-600 shrink-0" />
            <span>Showing <strong>{products.length}</strong> product(s) grouped by <strong>{FILTER_OPTIONS.find(o => o.value === groupBy)?.label}</strong>. Columns use available stock (totalQty), price with/without GST, average per-unit price and contribution percentage.</span>
          </div>
          </>
          )}

          {/* Show Purchase Order view */}
          {currentView === "po" && (
          <>
          <PurchaseOrderTable title="Purchase Orders" rows={poItems} accent="border-l-blue-600 bg-blue-50" page={poPage} setPage={setPoPage} columns={poColumns} setColumns={setPoColumns} chartField={poChartField} setChartField={setPoChartField} />

          <div className="mt-5 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600 flex items-center gap-2">
            <FaCheck className="text-green-600 shrink-0" />
            <span>Showing <strong>{poItems.length}</strong> purchase order items. Use filters to refine by voucher type, products, and price ranges. All filters can be combined for precise data analysis.</span>
          </div>
          </>
          )}

          {/* Show Sales Order view */}
          {currentView === "so" && (
          <>
          <SalesOrderTable title="Sales Orders" rows={soItems} accent="border-l-emerald-600 bg-emerald-50" page={soPage} setPage={setSoPage} columns={soColumns} setColumns={setSoColumns} chartField={soChartField} setChartField={setSoChartField} />

          <div className="mt-5 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600 flex items-center gap-2">
            <FaCheck className="text-green-600 shrink-0" />
            <span>Showing <strong>{soItems.length}</strong> sales order items. Use filters to refine by voucher type, products, and price ranges. Track sales information by customer, salesMan, and deliveryMan.</span>
          </div>
          </>
          )}
        </div>
      </main>
    </div>
  );
}

