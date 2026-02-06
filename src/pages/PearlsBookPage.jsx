import axios from "axios";
import { Fragment, useEffect, useState } from "react";
import {
  FaBoxOpen,
  FaCalendarAlt,
  FaChevronDown,
  FaChevronUp,
  FaFileInvoice,
  FaFilter,
  FaRupeeSign,
  FaShoppingCart,
  FaTruckLoading,
  FaWarehouse,
} from "react-icons/fa";
import { API_BASE } from "../api";

const API = `${API_BASE}/pearls-book`;

export default function PearlsBookPage() {
  const [rows, setRows] = useState([]);
  const [expanded, setExpanded] = useState(null);

  const [filters, setFilters] = useState({
    fromDate: "",
    toDate: "",
    type: "ALL",
    warehouse: "ALL",
    item: "",
  });


  useEffect(() => {
    axios.get(API).then((res) => setRows(res.data));
  }, []);

  const filteredRows = rows.filter((r) => {
    // DATE FILTER
    const rowDate = new Date(r.date);
    if (filters.fromDate && rowDate < new Date(filters.fromDate)) return false;
    if (filters.toDate && rowDate > new Date(filters.toDate)) return false;

    // TYPE
    if (filters.type !== "ALL" && r.type !== filters.type) return false;

    // WAREHOUSE
    if (
      filters.warehouse !== "ALL" &&
      r.warehouse !== filters.warehouse
    )
      return false;

    // ITEM NAME
    if (
      filters.item &&
      !r.items?.some((i) =>
        i.name.toLowerCase().includes(filters.item.toLowerCase())
      )
    )
      return false;

    return true;
  });

  const warehouses = [...new Set(filteredRows.map(r => r.warehouse))];
  const itemNames = [
    ...new Set(
      rows.flatMap(r => r.items?.map(i => i.name) || [])
    ),
  ];

  // console.log(
  //   rows.map(r => ({
  //     invoice: r.invoiceId,
  //     type: r.type,
  //     voucherType: r.voucherType,
  //     items: r.items?.length
  //   }))
  // );

  const getOrderType = (r) => {
    if (r.type) return r.type;

    if (r.invoiceId?.includes("PO")) return "PURCHASE";
    if (r.invoiceId?.includes("SI") || r.invoiceId?.includes("INV")) return "SALES";

    return "UNKNOWN";
  };


  const LOW_STOCK_LIMIT = 10;
  const stockMap = {};

  rows.forEach((r) => {
    const orderType = getOrderType(r);

    r.items?.forEach((i) => {
      stockMap[i.name] ??= 0;

      if (orderType === "PURCHASE") {
        stockMap[i.name] += i.qty;
      }

      if (orderType === "SALES") {
        stockMap[i.name] -= i.qty;
      }
    });
  });

  const lowStockItems = Object.entries(stockMap)
    .filter(([_, qty]) => qty < LOW_STOCK_LIMIT)
    .map(([name, qty]) => ({ name, qty }));



  const generateInvoice = async (id) => {
    try {
      const res = await axios.post(`${API}/generate-invoice/${id}`);

      // 🔔 LOW STOCK ALERT
      if (res.data.lowStockAlerts?.length) {
        const msg = res.data.lowStockAlerts
          .map(
            (a) =>
              `⚠️ LOW STOCK\n${a.product}\nWarehouse: ${a.warehouse}\nRemaining: ${a.remainingQty}`
          )
          .join("\n\n");

        alert(msg);
      }

      window.open(res.data.waUrl, "_blank");
    } catch (err) {
      alert(err.response?.data?.message || "Invoice generation failed");
    }
  };



  return (
    <div className="min-h-screen bg-gray-100 pt-20 md:pl-64 px-3 sm:px-6">
      {/* HEADER */}
      <div className="mb-6 max-w-[1400px] mx-auto">
        <h1 className="text-2xl font-bold text-primary">
          Pearls Book
        </h1>
        <p className="text-sm text-gray-500">
          Purchase & Sales Register
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-[1400px] mx-auto mb-6">
        <SummaryCard
          title="Sales Orders"
          value={filteredRows.filter(r => getOrderType(r) === "SALES").length}
          icon={<FaShoppingCart />}
        />

        <SummaryCard
          title="Purchase Orders"
          value={filteredRows.filter(r => getOrderType(r) === "PURCHASE").length}
          icon={<FaTruckLoading />}
        />

        <SummaryCard
          title="Sales Amount"
          value={`₹${filteredRows
            .filter(r => r.type === "SALES")
            .reduce((a, b) => a + b.grandTotal, 0)}`}
          icon={<FaRupeeSign />}
        />

        <SummaryCard
          title="Purchase Amount"
          value={`₹${filteredRows
            .filter(r => r.type === "PURCHASE")
            .reduce((a, b) => a + b.grandTotal, 0)}`}
          icon={<FaRupeeSign />}
        />


      </div>


      <div className="bg-white rounded-2xl shadow border p-5 mb-6 max-w-[1400px] mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 text-sm">

          {/* FROM DATE */}
          <div className="relative">
            <FaCalendarAlt className="absolute left-3 top-3.5 text-gray-400" />
            <input
              type="date"
              value={filters.fromDate}
              onChange={(e) =>
                setFilters({ ...filters, fromDate: e.target.value })
              }
              className="w-full border rounded-lg pl-9 pr-3 py-2 focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* TO DATE */}
          <div className="relative">
            <FaCalendarAlt className="absolute left-3 top-3.5 text-gray-400" />
            <input
              type="date"
              value={filters.toDate}
              onChange={(e) =>
                setFilters({ ...filters, toDate: e.target.value })
              }
              className="w-full border rounded-lg pl-9 pr-3 py-2 focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* TYPE */}
          <div className="relative">
            <FaFilter className="absolute left-3 top-3.5 text-gray-400" />
            <select
              value={filters.type}
              onChange={(e) =>
                setFilters({ ...filters, type: e.target.value })
              }
              className="w-full border rounded-lg pl-9 pr-3 py-2 focus:ring-1 focus:ring-primary"
            >
              <option value="ALL">All Types</option>
              <option value="SALES">Sales</option>
              <option value="PURCHASE">Purchase</option>
            </select>
          </div>

          {/* WAREHOUSE */}
          <div className="relative">
            <FaWarehouse className="absolute left-3 top-3.5 text-gray-400" />
            <select
              value={filters.warehouse}
              onChange={(e) =>
                setFilters({ ...filters, warehouse: e.target.value })
              }
              className="w-full border rounded-lg pl-9 pr-3 py-2 focus:ring-1 focus:ring-primary"
            >
              <option value="ALL">All Warehouses</option>
              {warehouses.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
          </div>

          {/* ITEM SEARCH */}
          <div className="relative">
            <FaBoxOpen className="absolute left-3 top-3.5 text-gray-400" />
            <input
              type="text"
              placeholder="Search Item"
              value={filters.item}
              onChange={(e) =>
                setFilters({ ...filters, item: e.target.value })
              }
              className="w-full border rounded-lg pl-9 pr-3 py-2 focus:ring-1 focus:ring-primary"
            />
          </div>

        </div>
      </div>


      {/* DESKTOP TABLE */}
      <div className="hidden md:block max-w-[1400px] mx-auto bg-white rounded-2xl shadow border overflow-visible">
        <table className="w-full text-sm">
          <thead className="bg-primary text-white sticky top-0 z-10">
            <tr>
              <th className="w-10 px-3 py-3"></th>
              <th className="px-4 py-3 text-left">Date</th>
              <th className="px-4 py-3 text-left">Invoice</th>
              <th className="px-4 py-3 text-left">Type</th>
              <th className="px-4 py-3 text-left">Party</th>
              <th className="px-4 py-3 text-left">Warehouse</th>
              <th className="px-4 py-3 text-right">Subtotal</th>
              <th className="px-4 py-3 text-right">Tax</th>
              <th className="px-4 py-3 text-right">Transport</th>
              <th className="px-4 py-3 text-right">Grand Total</th>
              <th className="px-4 py-3 text-right">Opening Bal</th>
              <th className="px-4 py-3 text-right">Closing Bal</th>
              <th className="px-4 py-3 text-center">Action</th>
            </tr>
          </thead>

          <tbody>
            {filteredRows.map((r) => (
              <Fragment key={r._id}>
                <tr className="border-b even:bg-gray-50 hover:bg-primary/5 transition relative">

                  <td className="text-center px-3 py-3">
                    <button
                      onClick={() =>
                        setExpanded(expanded === r._id ? null : r._id)
                      }
                      className="text-gray-600 hover:text-primary"
                    >
                      {expanded === r._id ? (
                        <FaChevronUp />
                      ) : (
                        <FaChevronDown />
                      )}
                    </button>
                  </td>

                  <td className="px-4 py-3">
                    {new Date(r.date).toLocaleDateString()}
                  </td>

                  <td className="px-4 py-3 font-semibold text-gray-800">
                    {r.invoiceId}
                  </td>

                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-bold ${r.type === "SALES"
                        ? "bg-green-100 text-green-700"
                        : "bg-blue-100 text-blue-700"
                        }`}
                    >
                      {r.type}
                    </span>
                  </td>

                  <td className="px-4 py-3">{r.party}</td>
                  <td className="px-4 py-3">{r.warehouse}</td>

                  <td className="px-4 py-3 text-right">
                    ₹{r.subtotal}
                  </td>
                  <td className="px-4 py-3 text-right">
                    ₹{r.totalTax}
                  </td>
                  <td className="px-4 py-3 text-right">
                    ₹{r.transportCharge}
                  </td>

                  <td className="px-4 py-3 text-right font-bold text-primary text-base">
                    ₹{r.grandTotal}
                  </td>

                  <td className="px-4 py-3 text-right text-sm">
                    {r.type === "SALES" ? `₹${r.openingBalance}` : "—"}
                  </td>

                  <td className="px-4 py-3 text-right font-bold text-sm">
                    {r.type === "SALES" ? `₹${r.closingBalance}` : "—"}
                  </td>


                  <td className="px-4 py-3 text-right">
                    <div className="relative flex items-center justify-end gap-2">
                      {/* MINI ITEMS ICON (ONLY FOR PURCHASE) */}
                      {r.type === "PURCHASE" && r.items?.length > 0 && (
                        <MiniItemsBadge items={r.items} />
                      )}

                      {r.type === "SALES" && (
                        <button
                          onClick={() => generateInvoice(r._id)}
                          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg 
                 bg-primary/10 text-primary font-semibold 
                 hover:bg-primary hover:text-white transition text-xs"
                        >
                          <FaFileInvoice />
                          Generate
                        </button>
                      )}
                    </div>
                  </td>

                </tr>

                {/* EXPANDED ROW */}
                {expanded === r._id && (
                  <tr>
                    <td colSpan="11" className="bg-primary/5 px-6 py-4">
                      <div className="bg-white rounded-xl shadow-sm border p-4">
                        <ExpandedItems row={r} />
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* MOBILE VIEW (UNCHANGED – ALREADY GOOD) */}
      <div className="md:hidden space-y-3">
        {filteredRows.map((r) => (
          <div
            key={r._id}
            className="bg-white rounded-xl shadow border p-4"
          >
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500">
                {new Date(r.date).toLocaleDateString()}
              </span>
              <span
                className={`text-xs font-bold px-2 py-1 rounded-full ${r.type === "SALES"
                  ? "bg-green-100 text-green-700"
                  : "bg-blue-100 text-blue-700"
                  }`}
              >
                {r.type}
              </span>
            </div>

            <div className="mt-2 font-semibold">
              {r.invoiceId}
            </div>

            <div className="text-sm text-gray-600">
              {r.party}
            </div>

            <div className="grid grid-cols-2 text-sm gap-2 mt-3">
              <div>
                <span className="text-gray-500">Total</span>
                <div className="font-bold text-primary">
                  ₹{r.grandTotal}
                </div>
              </div>
              <div>
                <span className="text-gray-500">Warehouse</span>
                <div>{r.warehouse}</div>
              </div>
            </div>

            <div className="flex gap-3 mt-4">
              <button
                onClick={() =>
                  setExpanded(expanded === r._id ? null : r._id)
                }
                className="flex-1 border rounded-lg py-2 text-sm"
              >
                {expanded === r._id ? "Hide Items" : "View Items"}
              </button>

              {r.type === "SALES" && (
                <button className="flex-1 bg-primary text-white rounded-lg py-2 text-sm">
                  Invoice
                </button>
              )}
            </div>

            {expanded === r._id && (
              <div className="mt-3">
                <ExpandedItems row={r} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>


  );
}

function MiniItemsBadge({ items }) {
  return (
    <div className="relative group">
      {/* ICON / BADGE */}
      <div className="cursor-pointer bg-primary/10 text-primary 
                      px-2 py-1 rounded-lg text-xs font-bold 
                      flex items-center gap-1">
        📦 {items.length}
      </div>

      {/* HOVER POPUP */}
      <div
        className="absolute right-0 top-8 z-[9999]
             opacity-0 scale-95 pointer-events-none
             group-hover:opacity-100 group-hover:scale-100
             group-hover:pointer-events-auto
             transition-all duration-150
             w-56 max-h-40 overflow-y-auto
             bg-white border rounded-xl shadow-xl p-3"
      >

        <h4 className="text-[11px] font-bold text-gray-500 mb-2">
          Items in Order
        </h4>

        <ul className="space-y-1 text-xs">
          {items.map((i, idx) => (
            <li
              key={idx}
              className="flex justify-between bg-gray-50 px-2 py-1 rounded"
            >
              <span className="truncate">{i.name}</span>
              <span className="font-bold">× {i.qty}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function ExpandedItems({ row }) {
  const isSales = row.type === "SALES";

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border rounded-lg overflow-hidden">
        <thead className="bg-primary/10 text-primary">
          <tr>
            <th className="px-3 py-2 text-left">Item</th>
            <th className="px-3 py-2">HSN</th>
            <th className="px-3 py-2 text-right">Price</th>
            <th className="px-3 py-2 text-right">Qty</th>
            {isSales && (
              <th className="px-3 py-2 text-right">Discount</th>
            )}
            <th className="px-3 py-2 text-right">GST</th>
            <th className="px-3 py-2 text-right">Total</th>
          </tr>
        </thead>

        <tbody>
          {row.items.map((i, idx) => (
            <tr key={idx} className="border-t hover:bg-gray-50">
              <td className="px-3 py-2">
                <div className="font-semibold">{i.name}</div>
                <div className="text-[11px] text-gray-500">
                  {i.productGroup}
                </div>
              </td>

              <td className="px-3 py-2">{i.hsn}</td>

              <td className="px-3 py-2 text-right">
                ₹{isSales ? i.sellingPrice : i.purchasePrice}
              </td>

              <td className="px-3 py-2 text-right">{i.qty}</td>

              {isSales && (
                <td className="px-3 py-2 text-right">
                  {i.discountType === "PERCENT"
                    ? `${i.discountPercent}%`
                    : `₹${i.discountAmount}`}
                </td>
              )}

              <td className="px-3 py-2 text-right">{i.gst}%</td>

              <td className="px-3 py-2 text-right font-bold text-primary">
                ₹{i.total}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* E-WAY BILL */}
      {isSales && row.ewayEnabled && (
        <div className="mt-4 text-xs bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <strong>E-Way Bill:</strong>{" "}
          {row.ewayDetails?.ewayBillNo} <br />
          Vehicle No: {row.ewayDetails?.vehicleNo}
        </div>
      )}
    </div>
  );
}

function SummaryCard({ title, value, icon }) {
  return (
    <div className="rounded-2xl bg-white border shadow-sm p-5 
                    hover:shadow-md transition">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-gray-500 uppercase tracking-wide">
            {title}
          </div>
          <div className="text-2xl font-bold text-primary mt-1">
            {value}
          </div>
        </div>

        <div className="w-11 h-11 rounded-xl bg-primary/10 
                        text-primary flex items-center justify-center text-lg">
          {icon}
        </div>
      </div>
    </div>
  );
}

function LowStockCard({ items }) {
  return (
    <div className="relative group rounded-2xl bg-white border shadow-sm p-5
                    hover:shadow-md transition cursor-pointer">

      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-red-500 uppercase tracking-wide font-semibold">
            Low Stock Items
          </div>
          <div className="text-2xl font-bold text-red-600 mt-1">
            {items.length}
          </div>
        </div>

        <div className="w-11 h-11 rounded-xl bg-red-100 
                        text-red-600 flex items-center justify-center text-lg">
          <FaBoxOpen />
        </div>
      </div>

      {/* 🔽 Hover Popup */}
      {items.length > 0 && (
        <div
          className="absolute left-0 top-full mt-2 z-[9999]
                     w-64 max-h-48 overflow-y-auto
                     bg-white border border-red-200 rounded-xl shadow-xl p-3
                     opacity-0 scale-95 pointer-events-none
                     group-hover:opacity-100 group-hover:scale-100
                     group-hover:pointer-events-auto
                     transition-all duration-150"
        >
          <h4 className="text-xs font-bold text-red-600 mb-2">
            Items below 10 qty
          </h4>

          <ul className="space-y-1 text-xs">
            {items.map((i, idx) => (
              <li
                key={idx}
                className="flex justify-between bg-red-50 px-2 py-1 rounded"
              >
                <span className="truncate">{i.name}</span>
                <span className="font-bold text-red-600">
                  {i.qty}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}



