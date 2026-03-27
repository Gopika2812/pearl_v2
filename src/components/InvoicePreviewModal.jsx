import { useState } from "react";
import { FaCheckCircle, FaChevronDown, FaChevronUp, FaEdit, FaPrint, FaTimes, FaWhatsapp } from "react-icons/fa";
import { toast } from "react-toastify";
import { API_BASE } from "../api";

const InvoicePreviewModal = ({ order, onClose }) => {
  const [activeTab, setActiveTab] = useState("edit");
  const [generating, setGenerating] = useState(false);
  const [invoiceData, setInvoiceData] = useState(null);
  
  // Edit state
  const [editedItems, setEditedItems] = useState(
    order.items?.map((item) => ({
      ...item,
      confirmedQty: item.qty,
      backOrderQty: 0,
    })) || []
  );
  const [notes, setNotes] = useState("");
  const [shouldPrint, setShouldPrint] = useState(false);
  const [shouldWhatsApp, setShouldWhatsApp] = useState(false);
  const [expandedItems, setExpandedItems] = useState({});

  // Calculate back order info
  const getBackOrderInfo = (item) => {
    const backOrderQty = item.qty - item.confirmedQty;
    return {
      backOrderQty: Math.max(0, backOrderQty),
      isPartial: backOrderQty > 0,
    };
  };

  const handleQtyChange = (idx, newQty) => {
    const qty = Math.max(0, Math.min(editedItems[idx].qty, newQty)); // Limit to original qty
    const updated = [...editedItems];
    updated[idx].confirmedQty = qty;
    setEditedItems(updated);
  };

  const handleGeneratePreview = async () => {
    try {
      setGenerating(true);
      const invoicePayload = {
        editedItems,
        notes,
      };
      
      const res = await fetch(
        `${API_BASE}/pearls-book/generate-invoice-preview/${order._id}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(invoicePayload),
        }
      );
      const data = await res.json();

      if (!res.ok) throw new Error(data.message || "Failed to generate preview");

      setInvoiceData(data);
      setActiveTab("preview");
      toast.success("Preview generated");
    } catch (err) {
      console.error("Error generating preview:", err);
      toast.error(err.message || "Failed to generate preview");
    } finally {
      setGenerating(false);
    }
  };

  const handleConfirmAndGenerate = async () => {
    try {
      setGenerating(true);
      const invoicePayload = {
        editedItems,
        notes,
      };

      const res = await fetch(
        `${API_BASE}/pearls-book/generate-invoice/${order._id}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(invoicePayload),
        }
      );
      const data = await res.json();

      if (!res.ok) throw new Error(data.message || "Failed to generate invoice");

      toast.success("Invoice generated successfully!");
      setInvoiceData(data);
      setActiveTab("success");

      // Auto-trigger print if checkbox was selected
      if (shouldPrint) {
        setTimeout(() => {
          const printWindow = window.open("", "_blank");
          const images = data.invoiceImages || [];
          printWindow.document.write(`
            <html>
              <head>
                <title>Invoice - ${order.invoiceId}</title>
                <style>
                  body { margin: 0; padding: 0; }
                  img { width: 100%; margin: 20px 0; page-break-after: always; }
                  @media print { body { margin: 0; } img { margin: 0; padding: 0; } }
                </style>
              </head>
              <body>
                ${images.map((img) => `<img src="${img}" alt="Invoice" />`).join("")}
              </body>
            </html>
          `);
          printWindow.document.close();
          printWindow.print();
          toast.info("Print dialog opened");
        }, 500);
      }

      // Auto-trigger WhatsApp if checkbox was selected
      if (shouldWhatsApp) {
        setTimeout(() => {
          handleWhatsApp();
        }, 500);
      }
    } catch (err) {
      console.error("Error generating invoice:", err);
      toast.error(err.message || "Failed to generate invoice");
    } finally {
      setGenerating(false);
    }
  };

  const handlePrint = () => {
    if (invoiceData?.invoiceImages) {
      const printWindow = window.open("", "_blank");
      const images = invoiceData.invoiceImages;

      printWindow.document.write(`
        <html>
          <head>
            <title>Invoice - ${order.invoiceId}</title>
            <style>
              body { margin: 0; padding: 0; }
              img { width: 100%; margin: 20px 0; }
              @media print { body { margin: 0; } }
            </style>
          </head>
          <body>
            ${images
              .map((img) => `<img src="${img}" alt="Invoice" />`)
              .join("")}
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
      toast.success("Print dialog opened");
    }
  };

  const handleWhatsApp = () => {
    if (invoiceData?.invoiceLinks) {
      const message = `*Invoice ${order.invoiceId}*\n\n📄 Bill Copies:\n${invoiceData.invoiceLinks
        .map((link, i) => `${i === 0 ? "📋 Order Details" : i === 1 ? "🧾 Tax Invoice" : "📦 Back Order Summary"}: ${link}`)
        .join("\n")}\n\nThank you!`;
      const waLink = `https://wa.me/${order.customer?.whatsapp?.replace(
        /\D/g,
        ""
      )}?text=${encodeURIComponent(message)}`;
      window.open(waLink, "_blank");
      toast.success("WhatsApp opened");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* HEADER */}
        <div className="bg-gradient-to-r from-[#319bab] to-[#257f87] p-6 flex items-center justify-between text-white">
          <div>
            <h2 className="text-xl font-bold">📄 Invoice Generator</h2>
            <p className="text-sm opacity-90">Order: {order.invoiceId}</p>
          </div>
          <button
            onClick={onClose}
            className="text-2xl hover:opacity-80 transition"
          >
            <FaTimes />
          </button>
        </div>

        {/* TABS */}
        <div className="flex border-b bg-gray-50 overflow-x-auto">
          <button
            onClick={() => setActiveTab("edit")}
            className={`px-6 py-3 font-semibold text-sm transition whitespace-nowrap ${
              activeTab === "edit"
                ? "text-[#319bab] border-b-2 border-[#319bab]"
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            ✏️ Edit Quantities
          </button>
          <button
            onClick={() => setActiveTab("preview")}
            className={`px-6 py-3 font-semibold text-sm transition whitespace-nowrap ${
              activeTab === "preview"
                ? "text-[#319bab] border-b-2 border-[#319bab]"
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            📄 Preview (Original & Copy)
          </button>
          <button
            onClick={() => setActiveTab("details")}
            className={`px-6 py-3 font-semibold text-sm transition whitespace-nowrap ${
              activeTab === "details"
                ? "text-[#319bab] border-b-2 border-[#319bab]"
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            📋 Order Summary
          </button>
          <button
            onClick={() => setActiveTab("success")}
            className={`px-6 py-3 font-semibold text-sm transition whitespace-nowrap ${
              activeTab === "success"
                ? "text-[#319bab] border-b-2 border-[#319bab]"
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            ✓ Generated
          </button>
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === "edit" && (
            <div className="space-y-6 max-w-4xl">
              {/* CUSTOMER INFO */}
              <div className="bg-gradient-to-r from-blue-50 to-cyan-50 p-4 rounded-lg border border-blue-200">
                <h3 className="font-bold text-gray-800 mb-2">📦 Customer</h3>
                <p className="text-sm"><span className="font-semibold">{order.customer?.name}</span> | {order.customer?.whatsapp}</p>
              </div>

              {/* EDIT ITEMS */}
              <div className="space-y-3">
                <h3 className="font-bold text-gray-800">Edit Item Quantities</h3>
                {editedItems.map((item, idx) => {
                  const backOrderInfo = getBackOrderInfo(item);
                  const isExpanded = expandedItems[idx];
                  
                  return (
                    <div key={idx} className="border rounded-lg bg-white">
                      {/* ITEM HEADER - CLICKABLE TO EXPAND */}
                      <div 
                        onClick={() => setExpandedItems({...expandedItems, [idx]: !isExpanded})}
                        className="p-4 flex items-center justify-between bg-gray-50 cursor-pointer hover:bg-gray-100"
                      >
                        <div className="flex-1">
                          <div className="font-semibold text-gray-800">{item.name}</div>
                          <div className="text-xs text-gray-600">HSN: {item.hsn}</div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-center">
                            <div className="text-xs text-gray-600">Ordered</div>
                            <div className="font-bold text-lg">{item.qty} {item.unit || 'Kg'}</div>
                          </div>
                          <div className="text-center">
                            <div className="text-xs text-gray-600">To Bill</div>
                            <div className="font-bold text-lg text-[#319bab]">{item.confirmedQty} {item.unit || 'Kg'}</div>
                          </div>
                          {backOrderInfo.isPartial && (
                            <div className="text-center bg-orange-100 px-2 py-1 rounded">
                              <div className="text-xs text-orange-700">Back Order</div>
                              <div className="font-bold text-orange-700">{backOrderInfo.backOrderQty} {item.unit || 'Kg'}</div>
                            </div>
                          )}
                          <button className="text-gray-600 hover:text-gray-800 text-xl">
                            {isExpanded ? <FaChevronUp /> : <FaChevronDown />}
                          </button>
                        </div>
                      </div>

                      {/* EXPANDABLE DETAILS */}
                      {isExpanded && (
                        <div className="p-4 border-t space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Confirm Quantity to Bill
                              </label>
                              <div className="flex gap-2 items-center">
                                <input
                                  type="number"
                                  min="0"
                                  max={item.qty}
                                  value={item.confirmedQty}
                                  onChange={(e) => handleQtyChange(idx, parseFloat(e.target.value) || 0)}
                                  className="flex-1 border border-gray-300 rounded px-3 py-2 text-center font-semibold"
                                />
                                <span className="text-gray-600 font-semibold">{item.unit || 'Kg'}</span>
                              </div>
                              <div className="mt-2 text-xs text-gray-600">
                                ℹ️ Original Order: {item.qty} {item.unit || 'Kg'}
                              </div>
                            </div>
                            <div>
                              <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Unit Price
                              </label>
                              <div className="bg-gray-100 border border-gray-200 rounded px-3 py-2">
                                <p className="text-center font-bold">₹{item.sellingPrice?.toFixed(2) || 0}</p>
                              </div>
                              <div className="mt-2 text-xs text-gray-600">
                                (Read-only)
                              </div>
                            </div>
                          </div>

                          {/* CALCULATED TOTALS */}
                          <div className="grid grid-cols-3 gap-4 bg-blue-50 p-3 rounded">
                            <div>
                              <div className="text-xs text-gray-600">Confirmed Total</div>
                              <div className="font-bold text-lg text-[#319bab]">
                                ₹{(item.confirmedQty * (item.sellingPrice || 0)).toFixed(2)}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs text-gray-600">Tax ({item.gst || 5}%)</div>
                              <div className="font-bold text-lg">
                                ₹{((item.confirmedQty * (item.sellingPrice || 0) * (item.gst || 5)) / 100).toFixed(2)}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs text-gray-600">Line Total</div>
                              <div className="font-bold text-lg">
                                ₹{(item.confirmedQty * (item.sellingPrice || 0) * (1 + (item.gst || 5) / 100)).toFixed(2)}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* NOTES SECTION */}
              <div className="space-y-2">
                <label className="block text-sm font-bold text-gray-800">📝 Notes for Back Order</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add any notes about back orders or special instructions..."
                  className="w-full border border-gray-300 rounded-lg p-3 text-sm font-medium resize-none"
                  rows="4"
                />
              </div>

              {/* TOTALS SECTION */}
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-lg border border-green-200">
                <h3 className="font-bold text-gray-800 mb-3">💰 Invoice Totals (Based on Confirmed Quantities)</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {(() => {
                    const subtotal = editedItems.reduce((sum, item) => sum + (item.confirmedQty * (item.sellingPrice || 0)), 0);
                    const tax = editedItems.reduce((sum, item) => sum + ((item.confirmedQty * (item.sellingPrice || 0) * (item.gst || 5)) / 100), 0);
                    const grandTotal = subtotal + tax + (order.transportCharge || 0);
                    
                    return (
                      <>
                        <div className="flex justify-between"><span>Subtotal:</span><span className="font-bold">₹{subtotal.toFixed(2)}</span></div>
                        <div className="flex justify-between"><span>Tax:</span><span className="font-bold">₹{tax.toFixed(2)}</span></div>
                        <div className="flex justify-between"><span>Transport:</span><span className="font-bold">₹{(order.transportCharge || 0).toFixed(2)}</span></div>
                        <div className="flex justify-between text-base font-bold border-t-2 border-green-300 pt-2"><span>Grand Total:</span><span className="text-[#319bab]">₹{grandTotal.toFixed(2)}</span></div>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}

          {activeTab === "preview" && (
            <div className="space-y-6">
              {invoiceData?.invoiceImages ? (
                <>
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <h3 className="font-bold text-gray-800 mb-2">📄 Multi-Copy Invoice Preview</h3>
                    <div className="text-sm text-gray-700">
                      <p className="mb-1"><strong>Original:</strong> Order Details & Tax Invoice</p>
                      <p className="mb-1"><strong>Copy 1:</strong> Duplicate Order Details & Tax Invoice</p>
                      <p><strong>Back Order:</strong> Pending items (if any)</p>
                    </div>
                  </div>
                  
                  <div className="space-y-6">
                    {invoiceData.invoiceImages.map((image, idx) => (
                      <div key={idx} className="border-2 border-gray-300 rounded-lg overflow-hidden bg-gray-50 shadow-lg">
                        <div className="bg-gray-200 p-2 text-center font-bold text-gray-700">
                          {(() => {
                            const labels = [
                              "Original: Order Details",
                              "Original: Tax Invoice",
                              "Copy 1: Order Details",
                              "Copy 1: Tax Invoice",
                              "Back Order Summary"
                            ];
                            return labels[idx] || `Page ${idx + 1}`;
                          })()}
                        </div>
                        <img
                          src={image}
                          alt={`Invoice Page ${idx + 1}`}
                          className="w-full"
                        />
                      </div>
                    ))}
                  </div>

                  {/* OPTIONS SECTION */}
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-3">
                    <h3 className="font-bold text-gray-800">📋 Actions</h3>
                    <div className="space-y-2">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={shouldPrint}
                          onChange={(e) => setShouldPrint(e.target.checked)}
                          className="w-5 h-5 text-[#319bab] rounded"
                        />
                        <span className="font-medium text-gray-800">🖨️ Print this invoice</span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={shouldWhatsApp}
                          onChange={(e) => setShouldWhatsApp(e.target.checked)}
                          className="w-5 h-5 text-green-600 rounded"
                        />
                        <span className="font-medium text-gray-800">📱 Send on WhatsApp</span>
                      </label>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <FaEdit className="text-5xl mx-auto mb-4 opacity-30" />
                  <p className="text-lg">Click "Preview Invoices" to generate all 3 pages</p>
                </div>
              )}
            </div>
          )}

          {activeTab === "details" && (
            <div className="space-y-6">
              {/* CUSTOMER INFO */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-bold text-gray-800 mb-3">Customer</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Name:</span>
                    <p className="font-semibold">{order.customer?.name}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Contact:</span>
                    <p className="font-semibold">{order.customer?.whatsapp}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-600">Address:</span>
                    <p className="font-semibold">{order.customer?.address}</p>
                  </div>
                </div>
              </div>

              {/* ORDER SUMMARY */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-bold text-gray-800 mb-3">Order Summary</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>₹{(order.subtotal || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Discount:</span>
                    <span className="text-red-500">
                      -₹{(order.totalDiscount || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tax:</span>
                    <span>₹{(order.totalTax || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between font-bold text-base border-t pt-2 mt-2">
                    <span>Grand Total:</span>
                    <span className="text-[#319bab]">
                      ₹{(order.grandTotal || 0).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* ITEMS */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-bold text-gray-800 mb-3">Items</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="text-gray-600 border-b">
                      <tr>
                        <th className="text-left py-2">Product</th>
                        <th className="text-center">Qty</th>
                        <th className="text-right">Rate</th>
                        <th className="text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(order.items || []).map((item, idx) => (
                        <tr key={idx} className="border-b">
                          <td className="py-2">{item.name}</td>
                          <td className="text-center">{item.qty}</td>
                          <td className="text-right">₹{item.sellingPrice}</td>
                          <td className="text-right font-semibold">
                            ₹{item.total.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === "success" && invoiceData && (
            <div className="text-center py-8">
              <FaCheckCircle className="text-green-500 text-6xl mx-auto mb-4" />
              <h3 className="text-2xl font-bold text-gray-800 mb-2">
                Invoice Generated Successfully!
              </h3>
              <p className="text-gray-600 mb-4">
                Invoice ID: <span className="font-bold">{order.invoiceId}</span>
              </p>
              <div className="space-y-4">
                {invoiceData?.invoiceLinks?.map((link, idx) => (
                  <div
                    key={idx}
                    className="bg-blue-50 p-3 rounded-lg text-sm break-all"
                  >
                    <p className="text-gray-600">Page {idx + 1}:</p>
                    <a
                      href={link}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#319bab] hover:underline font-semibold"
                    >
                      {link}
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* FOOTER ACTIONS */}
        <div className="bg-gray-50 p-6 border-t flex gap-3 justify-end flex-wrap">
          {activeTab === "edit" && (
            <>
              <button
                onClick={handleGeneratePreview}
                disabled={generating}
                className="px-6 py-2 bg-[#319bab] text-white rounded-lg hover:bg-[#257f87] transition disabled:opacity-50 font-bold text-sm"
              >
                {generating ? "Generating..." : "👁️ Preview Invoices"}
              </button>
              <button
                onClick={onClose}
                className="px-6 py-2 bg-gray-400 text-white rounded-lg hover:bg-gray-500 transition font-semibold text-sm"
              >
                Close
              </button>
            </>
          )}

          {activeTab === "preview" && (
            <>
              <button
                onClick={handleGeneratePreview}
                disabled={generating}
                className="px-6 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition disabled:opacity-50 font-semibold text-sm"
              >
                {generating ? "Regenerating..." : "🔄 Refresh"}
              </button>
              {shouldPrint && (
                <button
                  onClick={handlePrint}
                  disabled={generating || !invoiceData}
                  className="flex items-center gap-2 px-6 py-2 bg-[#319bab] text-white rounded-lg hover:bg-[#257f87] transition disabled:opacity-50 font-semibold text-sm"
                >
                  <FaPrint />
                  Print Now
                </button>
              )}
              {shouldWhatsApp && (
                <button
                  onClick={handleWhatsApp}
                  disabled={generating || !invoiceData}
                  className="flex items-center gap-2 px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition disabled:opacity-50 font-semibold text-sm"
                >
                  <FaWhatsapp />
                  Send WhatsApp
                </button>
              )}
              <button
                onClick={handleConfirmAndGenerate}
                disabled={generating}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 font-bold text-sm"
              >
                {generating ? "Processing..." : "✅ Generate & Save"}
              </button>
              <button
                onClick={onClose}
                className="px-6 py-2 bg-gray-400 text-white rounded-lg hover:bg-gray-500 transition font-semibold text-sm"
              >
                Close
              </button>
            </>
          )}

          {activeTab === "details" && (
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gray-400 text-white rounded-lg hover:bg-gray-500 transition font-semibold text-sm"
            >
              Close
            </button>
          )}

          {activeTab === "success" && (
            <>
              <button
                onClick={() => {
                  handlePrint();
                }}
                disabled={generating || !invoiceData}
                className="flex items-center gap-2 px-6 py-2 bg-[#319bab] text-white rounded-lg hover:bg-[#257f87] transition disabled:opacity-50 font-semibold text-sm"
              >
                <FaPrint />
                Print
              </button>
              <button
                onClick={handleWhatsApp}
                disabled={generating || !invoiceData}
                className="flex items-center gap-2 px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition disabled:opacity-50 font-semibold text-sm"
              >
                <FaWhatsapp />
                Send on WhatsApp
              </button>
              <button
                onClick={onClose}
                className="px-6 py-2 bg-gray-400 text-white rounded-lg hover:bg-gray-500 transition font-semibold text-sm"
              >
                Close
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default InvoicePreviewModal;
