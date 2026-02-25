import axios from "axios";
import { Fragment, useEffect, useState } from "react";
import {
  FaBoxOpen,
  FaCheckCircle,
  FaChevronDown,
  FaChevronUp,
  FaFileInvoice,
  FaRupeeSign,
  FaShoppingCart,
  FaTruckLoading
} from "react-icons/fa";
import { API_BASE } from "../api";

const API = `${API_BASE}/pearls-book`;

export default function PearlsBookPage() {
  const [rows, setRows] = useState([]);
  const [expanded, setExpanded] = useState(null);

  const [searchField, setSearchField] = useState("type"); 
  const [searchValue, setSearchValue] = useState("ALL"); 
  const [activeFilters, setActiveFilters] = useState([]); 

  // Invoice preview & generation states
  const [previewOrder, setPreviewOrder] = useState(null);
  const [stockAdjustments, setStockAdjustments] = useState({});
  const [invoiceNotes, setInvoiceNotes] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedInvoiceImage, setGeneratedInvoiceImage] = useState(null);
  const [invoicePreviewImage, setInvoicePreviewImage] = useState(null);


  useEffect(() => {
    axios.get(API).then((res) => setRows(res.data));
  }, []);

  const baseFilteredRows = rows.filter((r) => {
    // Apply current search field filter
    if (searchField === "type" && searchValue !== "ALL") {
      return r.type === searchValue;
    }
    if (searchField === "warehouse" && searchValue !== "ALL") {
      return r.warehouse === searchValue;
    }
    if (searchField === "party" && searchValue) {
      return r.party.toLowerCase().includes(searchValue.toLowerCase());
    }
    if (searchField === "invoiceId" && searchValue) {
      return r.invoiceId.toLowerCase().includes(searchValue.toLowerCase());
    }
    if (searchField === "item" && searchValue) {
      return r.items?.some((i) =>
        i.name.toLowerCase().includes(searchValue.toLowerCase())
      );
    }
    // If no filter or searchValue is empty, show all rows
    return true;
  });

  // filteredRows now includes both SALES ORDER and SALES INVOICE records
  const filteredRows = baseFilteredRows;

  const warehouses = [...new Set(baseFilteredRows.map(r => r.warehouse))];
  const parties = [...new Set(rows.map(r => r.party))];
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
    if (r.type === "SALES ORDER" || r.type === "SALES INVOICE") return "SALES";
    if (r.type === "PURCHASE") return "PURCHASE";
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



  // Open preview modal for editing stock and notes before sending
  const openInvoicePreview = (orderId) => {
    const order = rows.find(r => r._id === orderId);
    if (order) {
      setPreviewOrder(order);
      // Initialize stock adjustments with original quantities
      const initialAdjustments = {};
      order.items?.forEach((item, idx) => {
        initialAdjustments[idx] = item.qty;
      });
      setStockAdjustments(initialAdjustments);
      setInvoiceNotes("");
    }
  };

  // Send invoice to WhatsApp with adjustments and notes
  const sendInvoiceToWhatsApp = async () => {
    if (!previewOrder) return;

    setIsGenerating(true);
    try {
      // Step 1: Generate invoice preview (no actions yet)
      const res = await axios.post(`${API}/generate-invoice/${previewOrder._id}`, {
        stockAdjustments,
        invoiceNotes,
      });

      // Store invoice details for preview
      setGeneratedInvoiceImage({
        image: res.data.invoiceImage,
        waUrl: res.data.waUrl,
        ewayImage: res.data.ewayImage,
      });
      
      // Show invoice preview modal with print and send options
      setInvoicePreviewImage(true);
    } catch (err) {
      alert(err.response?.data?.message || "Invoice generation failed");
    } finally {
      setIsGenerating(false);
    }
  };

  // Confirm invoice and perform final actions (stock reduction, balance update, etc.)
  const confirmInvoiceAction = async (actionType) => {
    if (!previewOrder) return;

    // If printing, open print dialog first
    if (actionType === "print" && generatedInvoiceImage?.image) {
      const printWindow = window.open();
      printWindow.document.write(`
        <html>
          <head>
            <title>Invoice Print</title>
            <style>
              body { margin: 0; padding: 0; }
              img { max-width: 100%; height: auto; display: block; }
            </style>
          </head>
          <body>
            <img src="${generatedInvoiceImage.image}" />
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }

    setIsGenerating(true);
    try {
      // Step 2: Confirm invoice - this will reduce stock, update balance, create commissions
      const confirmRes = await axios.post(`${API}/confirm-invoice/${previewOrder._id}`, {
        stockAdjustments,
        invoiceNotes,
      });

      // 🔔 LOW STOCK ALERT
      if (confirmRes.data.lowStockAlerts?.length) {
        const msg = confirmRes.data.lowStockAlerts
          .map(
            (a) =>
              `⚠️ LOW STOCK\n${a.product}\nWarehouse: ${a.warehouse}\nRemaining: ${a.remainingQty}`
          )
          .join("\n\n");

        alert(msg);
      }

      // If sending via WhatsApp
      if (actionType === "whatsapp" && generatedInvoiceImage?.waUrl) {
        window.open(generatedInvoiceImage.waUrl, "_blank");
      }

      // Update the order status
      setRows(rows.map(r => r._id === previewOrder._id ? { ...r, invoiceGenerated: true } : r));
      
      alert(`✅ Invoice ${actionType === "print" ? "printed" : "sent"}! Stock reduced and balance updated.`);
      
      // Reset all states
      setPreviewOrder(null);
      setStockAdjustments({});
      setInvoiceNotes("");
      setGeneratedInvoiceImage(null);
      setInvoicePreviewImage(false);
    } catch (err) {
      alert(err.response?.data?.message || "Invoice confirmation failed");
    } finally {
      setIsGenerating(false);
    }
  };

  // Send to WhatsApp after preview confirmation (old name, now calls confirmInvoiceAction)
  const confirmAndSendToWhatsApp = () => {
    confirmInvoiceAction("whatsapp");
  };

  // Close invoice preview without sending
  const closeInvoicePreview = () => {
    setInvoicePreviewImage(false);
    setGeneratedInvoiceImage(null);
  };



  return (
    <div className="min-h-screen bg-gray-100 pt-20 md:pt-16 md:pl-64 px-3 sm:px-6 pb-10">
      {/* HEADER */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-primary">
          Pearls Book
        </h1>
        <p className="text-sm text-gray-500">
          Purchase & Sales Register
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <SummaryCard
          title="Sales Orders"
          value={baseFilteredRows.filter(r => r.type === "SALES ORDER").length}
          icon={<FaShoppingCart />}
        />

        <SummaryCard
          title="Sales Invoices"
          value={baseFilteredRows.filter(r => r.type === "SALES INVOICE").length}
          icon={<FaFileInvoice />}
        />

        <SummaryCard
          title="Purchase Orders"
          value={baseFilteredRows.filter(r => r.type === "PURCHASE").length}
          icon={<FaTruckLoading />}
        />

        <SummaryCard
          title="Total Sales Amount"
          value={`₹${Math.round(
            baseFilteredRows
              .filter(r => r.type === "SALES ORDER" || r.type === "SALES INVOICE")
              .reduce((a, b) => a + b.grandTotal, 0) * 100
          ) / 100}`}
          icon={<FaRupeeSign />}
        />
      </div>


      <div className="bg-white rounded-2xl shadow border p-5 mb-6">
        <div className="space-y-4">
        
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    
            <div>
              <label className="text-xs font-bold text-gray-600 block mb-2">Invoice ID</label>
              <input
                type="text"
                placeholder="Enter invoice ID..."
                value={searchField === "invoiceId" ? searchValue : ""}
                onChange={(e) => {
                  setSearchField("invoiceId");
                  setSearchValue(e.target.value);
                }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-1 focus:ring-primary text-sm"
              />
            </div>

            {/* ORDER TYPE */}
            <div>
              <label className="text-xs font-bold text-gray-600 block mb-2">Order Type</label>
              <select
                value={searchField === "type" ? searchValue : "ALL"}
                onChange={(e) => {
                  setSearchField("type");
                  setSearchValue(e.target.value);
                }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-1 focus:ring-primary text-sm"
              >
                <option value="ALL">All Types</option>
                <option value="SALES ORDER">Sales Order</option>
                <option value="SALES INVOICE">Sales Invoice</option>
                <option value="PURCHASE">Purchase</option>
              </select>
            </div>

            {/* PARTY */}
            <div>
              <label className="text-xs font-bold text-gray-600 block mb-2">Party</label>
              <input
                type="text"
                placeholder="Enter party name..."
                value={searchField === "party" ? searchValue : ""}
                onChange={(e) => {
                  setSearchField("party");
                  setSearchValue(e.target.value);
                }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-1 focus:ring-primary text-sm"
              />
            </div>

            {/* WAREHOUSE */}
            <div>
              <label className="text-xs font-bold text-gray-600 block mb-2">Warehouse</label>
              <select
                value={searchField === "warehouse" ? searchValue : "ALL"}
                onChange={(e) => {
                  setSearchField("warehouse");
                  setSearchValue(e.target.value);
                }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-1 focus:ring-primary text-sm"
              >
                <option value="ALL">All Warehouses</option>
                {warehouses.map((w) => (
                  <option key={w} value={w}>{w}</option>
                ))}
              </select>
            </div>

            {/* ITEM NAME */}
            <div>
              <label className="text-xs font-bold text-gray-600 block mb-2">Item Name</label>
              <input
                type="text"
                placeholder="Enter item name..."
                value={searchField === "item" ? searchValue : ""}
                onChange={(e) => {
                  setSearchField("item");
                  setSearchValue(e.target.value);
                }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-1 focus:ring-primary text-sm"
              />
            </div>

            {/* CLEAR ALL BUTTON */}
            <div className="flex items-end">
              <button
                onClick={() => {
                  setSearchField("type");
                  setSearchValue("ALL");
                  setActiveFilters([]);
                }}
                className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-2 rounded-lg transition text-sm"
              >
                Reset All Filters
              </button>
            </div>
          </div>

          {/* RESULTS SUMMARY */}
          <div className="bg-gradient-to-r from-primary/10 to-blue-100 p-3 rounded-lg flex justify-between items-center text-sm">
            <span className="font-semibold text-gray-700">
              📊 Showing <span className="text-primary font-bold">{filteredRows.length}</span> of <span className="text-primary font-bold">{rows.length}</span> records
            </span>
            {filteredRows.length > 0 && (
              <span className="text-gray-600">
                💰 Total: <span className="font-bold text-primary">₹{(Math.round(filteredRows.reduce((a, b) => a + b.grandTotal, 0) * 100) / 100).toFixed(2)}</span>
              </span>
            )}
          </div>
        </div>
      </div>


      {/* DESKTOP TABLE */}
      <div className="hidden md:block bg-white rounded-2xl shadow border overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-primary text-white sticky top-0 z-10">
            <tr>
              <th className="w-8 px-2 py-2 sticky left-0 bg-primary z-20"></th>
              <th className="px-2 py-2 text-left whitespace-nowrap sticky left-8 bg-primary z-20 border-r">Date</th>
              <th className="px-2 py-2 text-left whitespace-nowrap min-w-[115px]">Invoice</th>
              <th className="px-2 py-2 text-left whitespace-nowrap">Type</th>
              <th className="px-2 py-2 text-left whitespace-nowrap min-w-[130px]">Party</th>
              <th className="px-2 py-2 text-left whitespace-nowrap">Warehouse</th>
              <th className="px-2 py-2 text-right whitespace-nowrap">Subtotal</th>
              <th className="px-2 py-2 text-right whitespace-nowrap">Tax</th>
              <th className="px-2 py-2 text-right whitespace-nowrap">Transport</th>
              <th className="px-2 py-2 text-right whitespace-nowrap font-bold">Total</th>
              <th className="px-2 py-2 text-right whitespace-nowrap text-xs">Open Bal</th>
              <th className="px-2 py-2 text-right whitespace-nowrap font-bold">Close Bal</th>
              <th className="px-2 py-2 text-center whitespace-nowrap">Action</th>
            </tr>
          </thead>

          <tbody>
            {filteredRows.map((r, idx) => (
              <Fragment key={`${r._id}-${idx}`}>
                <tr className={`border-b transition relative ${r.type === "SALES INVOICE" ? "bg-yellow-50" : "even:bg-gray-50"} hover:bg-primary/5`}>

                  <td className="text-center px-2 py-2 sticky left-0 z-10 border-r"
                      style={{backgroundColor: r.type === "SALES INVOICE" ? "#fffacd" : "white"}}>
                    <button
                      onClick={() =>
                        setExpanded(expanded === `${r._id}-${idx}` ? null : `${r._id}-${idx}`)
                      }
                      className="text-gray-600 hover:text-primary text-sm"
                    >
                      {expanded === `${r._id}-${idx}` ? (
                        <FaChevronUp />
                      ) : (
                        <FaChevronDown />
                      )}
                    </button>
                  </td>

                  <td className="px-2 py-2 sticky left-8 z-10 border-r whitespace-nowrap text-xs"
                      style={{backgroundColor: r.type === "SALES INVOICE" ? "#fffacd" : "white"}}>
                    {new Date(r.date).toLocaleDateString('en-GB')}
                  </td>

                  <td className="px-2 py-2 font-semibold text-gray-800 whitespace-nowrap text-xs">
                    {r.invoiceId}
                  </td>

                  <td className="px-2 py-2 whitespace-nowrap">
                    <span
                      className={`px-1.5 py-0.5 rounded text-xs font-bold ${r.type === "SALES ORDER" || r.type === "SALES INVOICE"
                        ? "bg-green-100 text-green-700"
                        : "bg-blue-100 text-blue-700"
                        }`}
                    >
                      {r.type}
                    </span>
                  </td>

                  <td className="px-2 py-2 whitespace-nowrap text-xs">
                    {r.party}
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap text-xs">{r.warehouse}</td>

                  <td className="px-2 py-2 text-right whitespace-nowrap text-xs">
                    ₹{(Math.round(r.subtotal * 100) / 100).toFixed(2)}
                  </td>
                  <td className="px-2 py-2 text-right whitespace-nowrap text-xs">
                    ₹{(Math.round(r.totalTax * 100) / 100).toFixed(2)}
                  </td>
                  <td className="px-2 py-2 text-right whitespace-nowrap text-xs">
                    ₹{r.transportCharge}
                  </td>

                  <td className="px-2 py-2 text-right font-bold text-primary text-xs whitespace-nowrap">
                    ₹{(Math.round(r.grandTotal * 100) / 100).toFixed(2)}
                  </td>

                  <td className="px-2 py-2 text-right text-xs whitespace-nowrap">
                   {r.type === "SALES ORDER" || r.type === "SALES INVOICE" ? `₹${Number(r.openingBalance || 0).toFixed(2)}` : "—"}
                  </td>

                  <td className="px-2 py-2 text-right font-bold text-xs whitespace-nowrap">
                    {r.type === "SALES ORDER" || r.type === "SALES INVOICE" ? `₹${(Math.round(r.closingBalance * 100) / 100).toFixed(2)}` : "—"}
                  </td>


                  <td className="px-2 py-2 text-center whitespace-nowrap">
                    <div className="flex items-center justify-center gap-1">
                      {/* MINI ITEMS ICON (ONLY FOR PURCHASE) */}
                      {r.type === "PURCHASE" && r.items?.length > 0 && (
                        <MiniItemsBadge items={r.items} />
                      )}

                      {(r.type === "SALES ORDER" || r.type === "SALES INVOICE") && (
                        <>
                          {r.type === "SALES INVOICE" ? (
                            <button
                              disabled
                              className="p-1.5 rounded bg-green-100 text-green-600 cursor-not-allowed hover:bg-green-200"
                              title="Invoice Generated"
                            >
                              <FaCheckCircle size={14} />
                            </button>
                          ) : r.type === "SALES ORDER" && r.invoiceGenerated ? (
                            <button
                              disabled
                              className="p-1.5 rounded bg-green-100 text-green-600 cursor-not-allowed hover:bg-green-200"
                              title="Invoice Generated"
                            >
                              <FaCheckCircle size={14} />
                            </button>
                          ) : (
                            // Only show button on ungenerated SALES ORDER
                            <button
                              onClick={() => openInvoicePreview(r._id)}
                              className="p-1.5 rounded bg-blue-100 text-blue-600 hover:bg-blue-200 transition"
                              title="Generate Invoice"
                            >
                              <FaFileInvoice size={14} />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>

                </tr>

                {/* EXPANDED ROW */}
                {expanded === `${r._id}-${idx}` && (
                  <tr>
                    <td colSpan="13" className="bg-primary/5 px-0 py-3 sticky left-0">
                      <div className="bg-white rounded-lg shadow-sm border mx-2">
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

      {/* MOBILE VIEW */}
      <div className="md:hidden space-y-3">
        {filteredRows.map((r, idx) => (
          <div
            key={`${r._id}-${idx}`}
            className={`rounded-xl shadow border p-4 ${r.type === "SALES INVOICE" ? "bg-yellow-50" : "bg-white"}`}
          >
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500">
                {new Date(r.date).toLocaleDateString()}
              </span>
              <span
                className={`text-xs font-bold px-2 py-1 rounded-full ${
                  r.type === "SALES ORDER" || r.type === "SALES INVOICE"
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
                  ₹{(Math.round(r.grandTotal * 100) / 100).toFixed(2)}
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
                  setExpanded(expanded === `${r._id}-${idx}` ? null : `${r._id}-${idx}`)
                }
                className="flex-1 border rounded-lg py-2 text-sm"
              >
                {expanded === `${r._id}-${idx}` ? "Hide Items" : "View Items"}
              </button>

              {(r.type === "SALES ORDER" || r.type === "SALES INVOICE") && (
                <>
                  {r.type === "SALES INVOICE" ? (
                    <button
                      disabled
                      className="flex-1 bg-green-600 text-white rounded-lg py-2 text-sm cursor-not-allowed opacity-75"
                      title="Invoice Generated"
                    >
                      ✓ Generated
                    </button>
                  ) : r.invoiceGenerated ? (
                    <button
                      disabled
                      className="flex-1 bg-green-600 text-white rounded-lg py-2 text-sm cursor-not-allowed opacity-75"
                      title="Invoice Generated"
                    >
                      ✓ Generated
                    </button>
                  ) : (
                    <button
                      onClick={() => openInvoicePreview(r._id)}
                      className="flex-1 bg-primary text-white rounded-lg py-2 text-sm hover:bg-blue-700 transition"
                      title="Generate Invoice"
                    >
                      Generate Invoice
                    </button>
                  )}
                </>
              )}
            </div>

            {expanded === `${r._id}-${idx}` && (
              <div className="mt-3">
                <ExpandedItems row={r} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* INVOICE PREVIEW MODAL */}
      {previewOrder && (
        <InvoicePreviewModal
          order={previewOrder}
          stockAdjustments={stockAdjustments}
          setStockAdjustments={setStockAdjustments}
          invoiceNotes={invoiceNotes}
          setInvoiceNotes={setInvoiceNotes}
          onClose={() => {
            setPreviewOrder(null);
            setStockAdjustments({});
            setInvoiceNotes("");
          }}
          onSendToWhatsApp={sendInvoiceToWhatsApp}
          isGenerating={isGenerating}
        />
      )}

      {/* GENERATED INVOICE IMAGE PREVIEW MODAL */}
      {invoicePreviewImage && generatedInvoiceImage && (
        <GeneratedInvoicePreviewModal
          invoiceImage={generatedInvoiceImage.image}
          waUrl={generatedInvoiceImage.waUrl}
          onConfirm={() => confirmInvoiceAction("whatsapp")}
          onPrint={() => confirmInvoiceAction("print")}
          onClose={closeInvoicePreview}
          isLoading={isGenerating}
        />
      )}
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
  const isSales = row.type === "SALES ORDER" || row.type === "SALES INVOICE";

  return (
    <div className="space-y-4">
      {/* MAIN ITEMS TABLE */}
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
                  ₹{((isSales ? (i.sellingPrice || 0) : (i.purchasePrice || 0)) || 0).toFixed(2)}
                </td>

                <td className="px-3 py-2 text-right">{i.qty}</td>

                {isSales && (
                  <td className="px-3 py-2 text-right">
                    {i.discountType === "PERCENT"
                      ? `${i.discountPercent}%`
                      : `₹${((i.discountAmount) || 0).toFixed(2)}`}
                  </td>
                )}

                <td className="px-3 py-2 text-right">{i.gst || 0}%</td>

                <td className="px-3 py-2 text-right font-bold text-primary">
                  ₹{((i.total) || 0).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* SAMPLE ITEMS TABLE */}
      {isSales && row.sampleItems && row.sampleItems.length > 0 && (
        <div className="overflow-x-auto bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <div className="text-xs font-bold text-yellow-700 mb-3">
            🎁 Sample Items (Not Billed)
          </div>
          <table className="w-full text-xs border-collapse">
            <thead className="bg-yellow-100 text-yellow-700">
              <tr>
                <th className="px-3 py-2 text-left border border-yellow-300">Item</th>
                <th className="px-3 py-2 border border-yellow-300">HSN</th>
                <th className="px-3 py-2 text-right border border-yellow-300">Price</th>
                <th className="px-3 py-2 text-right border border-yellow-300">Qty</th>
                <th className="px-3 py-2 text-right border border-yellow-300">Total</th>
              </tr>
            </thead>
            <tbody>
              {row.sampleItems.map((item, idx) => (
                <tr key={idx} className="border-t border-yellow-200 hover:bg-yellow-100">
                  <td className="px-3 py-2 border border-yellow-200">
                    <div className="font-semibold">{item.name}</div>
                    <div className="text-[11px] text-yellow-700">
                      HSN: {item.hsn}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-center border border-yellow-200">{item.hsn}</td>
                  <td className="px-3 py-2 text-right border border-yellow-200">
                    ₹{Number(item.sellingPrice || 0).toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-right border border-yellow-200">
                    {item.qty || 0}
                  </td>
                  <td className="px-3 py-2 text-right font-bold text-yellow-700 border border-yellow-200">
                    ₹{(((item.qty || 0) * (item.sellingPrice || 0))).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* E-WAY BILL */}
      {isSales && row.ewayEnabled && (
        <div className="text-xs bg-yellow-50 border border-yellow-200 rounded-lg p-3">
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

// GENERATED INVOICE PREVIEW MODAL COMPONENT
function GeneratedInvoicePreviewModal({
  invoiceImage,
  waUrl,
  onConfirm,
  onPrint,
  onClose,
  isLoading,
}) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[999] p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8">
        
        {/* HEADER */}
        <div className="bg-gradient-to-r from-primary to-blue-600 text-white p-6 rounded-t-2xl sticky top-0 z-10">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold">📄 Invoice Preview</h2>
              <p className="text-sm text-blue-100 mt-1">
                You can now print or send this invoice. Stock will be reduced after action.
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-white/20 p-2 rounded-lg transition"
            >
              ✕
            </button>
          </div>
        </div>

        {/* INVOICE IMAGE */}
        <div className="p-6 max-h-[calc(100vh-300px)] overflow-y-auto">
          <div className="bg-gray-100 rounded-lg overflow-hidden border">
            <img
              src={invoiceImage}
              alt="Generated Invoice"
              className="w-full h-auto"
              style={{ maxWidth: "100%" }}
            />
          </div>

          {/* PREVIEW INSTRUCTIONS */}
          <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm text-green-900">
              ✅ Invoice generated successfully! Choose to print or send via WhatsApp. Stock and customer balance will be updated immediately after your action.
            </p>
          </div>
        </div>

        {/* FOOTER - WITH PRINT AND SEND OPTIONS */}
        <div className="border-t bg-gray-50 px-6 py-4 rounded-b-2xl sticky bottom-0 flex gap-3 justify-end">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-6 py-2 border border-gray-300 rounded-lg font-semibold hover:bg-gray-100 transition disabled:opacity-50"
          >
            Back to Edit
          </button>
          <button
            onClick={onPrint}
            disabled={isLoading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition flex items-center gap-2 disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <span className="inline-block animate-spin">⏳</span>
                Processing...
              </>
            ) : (
              <>
                🖨️ Print & Confirm
              </>
            )}
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="px-6 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition flex items-center gap-2 disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <span className="inline-block animate-spin">⏳</span>
                Sending...
              </>
            ) : (
              <>
                📱 Send & Confirm
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}function LowStockCard({ items }) {
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

// INVOICE PREVIEW MODAL COMPONENT
function InvoicePreviewModal({
  order,
  stockAdjustments,
  setStockAdjustments,
  invoiceNotes,
  setInvoiceNotes,
  onClose,
  onSendToWhatsApp,
  isGenerating,
}) {
  const isSales = order.type === "SALES ORDER" || order.type === "SALES INVOICE";

  const handleQuantityChange = (itemIndex, newQty) => {
    setStockAdjustments({
      ...stockAdjustments,
      [itemIndex]: Math.max(0, parseFloat(newQty) || 0),
    });
  };

  const calculateAdjustedTotal = () => {
    let total = 0;
    order.items?.forEach((item, idx) => {
      const adjustedQty = stockAdjustments[idx] || item.qty;
      const price = isSales ? (item.sellingPrice || 0) : (item.purchasePrice || 0);
      const baseAmount = adjustedQty * price;
      
      if (isSales) {
        let discountAmount = 0;
        if (item.discountType === "PERCENT") {
          discountAmount = (baseAmount * item.discountPercent) / 100;
        } else {
          discountAmount = item.discountAmount || 0;
        }
        const gstRate = item.gst || item.cgst || item.sgst || 0;
        const gstAmount = ((baseAmount - discountAmount) * gstRate) / 100;
        total += baseAmount - discountAmount + gstAmount;
      } else {
        const gstRate = item.gst || item.cgst || item.sgst || 0;
        const gstAmount = (baseAmount * gstRate) / 100;
        total += baseAmount + gstAmount;
      }
    });
    return total || 0;
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[999] p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl my-8">
        
        {/* HEADER */}
        <div className="bg-gradient-to-r from-primary to-blue-600 text-white p-6 rounded-t-2xl sticky top-0 z-10">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold">{order.invoiceId}</h2>
              <p className="text-sm text-blue-100 mt-1">
                {isSales ? "Sales Order" : "Purchase Order"} • {order.party}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-white/20 p-2 rounded-lg transition"
            >
              ✕
            </button>
          </div>
        </div>

        {/* CONTENT */}
        <div className="p-6 space-y-6 max-h-[calc(100vh-300px)] overflow-y-auto">
          
          {/* ITEMS TABLE WITH STOCK ADJUSTMENT */}
          <div>
            <h3 className="text-lg font-bold text-gray-800 mb-4">📦 Order Items</h3>
            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left">Item</th>
                    <th className="px-4 py-3 text-right">Original Qty</th>
                    <th className="px-4 py-3 text-right border-l border-yellow-400 bg-yellow-50">
                      📊 Qty for Order
                    </th>
                    <th className="px-4 py-3 text-right">Price</th>
                    <th className="px-4 py-3 text-right">GST</th>
                    <th className="px-4 py-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items?.map((item, idx) => {
                    const adjustedQty = stockAdjustments[idx] !== undefined ? stockAdjustments[idx] : item.qty;
                    const originalQty = item.qty;
                    const isAdjusted = adjustedQty !== originalQty;
                    const price = isSales ? (item.sellingPrice || 0) : (item.purchasePrice || 0);
                    const gstRate = item.gst || item.cgst || item.sgst || 0;
                    
                    return (
                      <tr key={idx} className={`border-b ${isAdjusted ? 'bg-yellow-50' : 'hover:bg-gray-50'}`}>
                        <td className="px-4 py-3">
                          <div className="font-semibold">{item.name}</div>
                          <div className="text-xs text-gray-500">{item.productGroup}</div>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold">{originalQty}</td>
                        <td className="px-4 py-3 text-right border-l border-yellow-400 bg-yellow-50">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={adjustedQty}
                            onChange={(e) => handleQuantityChange(idx, e.target.value)}
                            className={`w-20 px-2 py-1 border rounded text-right font-semibold ${
                              isAdjusted ? 'border-orange-500 bg-orange-100' : 'border-gray-300'
                            }`}
                          />
                          {isAdjusted && (
                            <div className="text-xs text-red-600 font-bold mt-1">
                              ⚠️ Back Order: {(originalQty - adjustedQty).toFixed(2)}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">₹{price.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right">{gstRate}%</td>
                        <td className="px-4 py-3 text-right font-bold text-primary">
                          ₹{(adjustedQty * price * (1 + gstRate / 100)).toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ORDER SUMMARY */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-bold text-gray-800 mb-3">Order Summary</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span className="font-semibold">₹{order.subtotal?.toFixed(2) || "0.00"}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tax:</span>
                  <span className="font-semibold">₹{order.totalTax?.toFixed(2) || "0.00"}</span>
                </div>
                <div className="flex justify-between">
                  <span>Transport:</span>
                  <span className="font-semibold">₹{order.transportCharge?.toFixed(2) || "0.00"}</span>
                </div>
                <div className="border-t pt-2 mt-2 flex justify-between font-bold">
                  <span>Total:</span>
                  <span className="text-primary">₹{calculateAdjustedTotal().toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* BILLING NOTES */}
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <h4 className="font-bold text-gray-800 mb-3">📝 Billing Notes</h4>
              <textarea
                value={invoiceNotes}
                onChange={(e) => setInvoiceNotes(e.target.value)}
                placeholder="Add any special notes for this invoice..."
                className="w-full h-24 p-3 border border-purple-300 rounded-lg resize-none focus:ring-2 focus:ring-purple-500 outline-none text-sm"
              />
              <p className="text-xs text-gray-500 mt-2">
                These notes will appear on the WhatsApp message
              </p>
            </div>
          </div>

          {/* BACK ORDER WARNING */}
          {Object.entries(stockAdjustments).some(
            ([idx, qty]) => qty !== (order.items?.[idx]?.qty || 0)
          ) && (
            <div className="bg-orange-50 border-l-4 border-orange-400 p-4 rounded">
              <div className="flex gap-3">
                <span className="text-2xl">⚠️</span>
                <div>
                  <h4 className="font-bold text-orange-900">Back Order Created</h4>
                  <p className="text-sm text-orange-800 mt-1">
                    Some items have been adjusted. The remaining quantities will be marked as back order.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="border-t bg-gray-50 px-6 py-4 rounded-b-2xl sticky bottom-0 flex gap-3 justify-end">
          <button
            onClick={onClose}
            disabled={isGenerating}
            className="px-6 py-2 border border-gray-300 rounded-lg font-semibold hover:bg-gray-100 transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onSendToWhatsApp}
            disabled={isGenerating}
            className="px-6 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition flex items-center gap-2 disabled:opacity-50"
          >
            {isGenerating ? (
              <>
                <span className="inline-block animate-spin">⏳</span>
                Generating...
              </>
            ) : (
              <>
                📱 Send to WhatsApp
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
