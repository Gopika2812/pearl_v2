import html2canvas from "html2canvas";
import { useEffect, useState } from "react";
import {
    FaCheck,
    FaEdit,
    FaPrint,
    FaSpinner,
    FaTimes,
    FaWhatsapp,
} from "react-icons/fa";
import { toast } from "react-toastify";
import { API_BASE } from "../api";

const InvoiceGeneratorModal = ({ order, onClose, onSuccess }) => {
  const [activeTab, setActiveTab] = useState("edit");
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Edit state
  const [editedItems, setEditedItems] = useState([]);
  const [notes, setNotes] = useState("");
  const [invoiceType, setInvoiceType] = useState("ORDER_DETAILS");

  // Preview state
  const [previewData, setPreviewData] = useState(null);

  // Generated invoice
  const [generatedInvoice, setGeneratedInvoice] = useState(null);

  // Options
  const [shouldPrint, setShouldPrint] = useState(false);
  const [shouldWhatsApp, setShouldWhatsApp] = useState(false);

  // Initialize edited items
  useEffect(() => {
    if (order && order.items) {
      setEditedItems(
        order.items.map((item) => ({
          ...item,
          _id: item._id?.toString?.() || item._id,
          confirmedQty: item.qty,
          backOrderQty: 0,
        }))
      );
    }
  }, [order]);

  // Handle quantity changes
  const handleQtyChange = (index, confirmedQty) => {
    const updated = [...editedItems];
    const originalQty = order.items[index].qty;
    const confirmed = Math.max(0, Math.min(originalQty, confirmedQty));
    updated[index].confirmedQty = confirmed;
    updated[index].backOrderQty = originalQty - confirmed;
    setEditedItems(updated);
  };

  // Generate preview
  const handleGeneratePreview = async () => {
    try {
      setGenerating(true);
      const res = await fetch(
        `${API_BASE}/invoices/preview/${order._id}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: editedItems,
            notes,
            invoiceType,
          }),
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      setPreviewData(data);
      setActiveTab("preview");
      toast.success("Invoice preview generated");
    } catch (error) {
      console.error("Error:", error);
      toast.error(error.message || "Failed to generate preview");
    } finally {
      setGenerating(false);
    }
  };

  // Finalize and save invoice
  const handleFinalize = async () => {
    try {
      setGenerating(true);
      const res = await fetch(
        `${API_BASE}/invoices/finalize/${order._id}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: editedItems,
            notes,
            invoiceType,
          }),
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      setGeneratedInvoice(data.invoice);
      setActiveTab("success");
      toast.success("Invoice finalized successfully!");

      // Auto print if selected
      if (shouldPrint) {
        setTimeout(() => handlePrint(), 500);
      }

      // Auto WhatsApp if selected
      if (shouldWhatsApp) {
        setTimeout(() => handleWhatsApp(), 500);
      }

      if (onSuccess) onSuccess();
    } catch (error) {
      console.error("Error:", error);
      toast.error(error.message || "Failed to finalize invoice");
    } finally {
      setGenerating(false);
    }
  };

  // Print function
  const handlePrint = async () => {
    try {
      const printWindow = window.open("", "_blank");
      printWindow.document.write(getInvoiceHTML());
      printWindow.document.close();
      setTimeout(() => printWindow.print(), 250);

      // Mark as printed
      if (generatedInvoice?._id) {
        await fetch(`${API_BASE}/invoices/${generatedInvoice._id}/print`, {
          method: "PUT",
        });
      }
    } catch (error) {
      console.error("Print error:", error);
      toast.error("Failed to print");
    }
  };

  // WhatsApp function with Cloudinary upload
  const handleWhatsApp = async () => {
    try {
      const phone = previewData?.customer?.whatsapp?.replace(/\D/g, "");
      
      // Show uploading toast
      const uploadToastId = toast.loading("📤 Uploading invoices to cloud...");

      // Generate images for each format
      const formats = ["ORDER_DETAILS", "TAX_INVOICE"]; // Back order now merged into TAX_INVOICE
      const cloudinaryUrls = {};

      for (const fmt of formats) {
        try {
          // Create temporary container
          const container = document.createElement("div");
          container.style.position = "fixed";
          container.style.top = "-9999px";
          container.style.left = "-9999px";
          container.style.width = "148mm"; // A5 width
          container.style.height = "210mm"; // A5 height
          container.innerHTML = getInvoiceHTML(fmt);
          document.body.appendChild(container);

          // Get the page element
          const pageElement = container.querySelector(".page");
          
          // Convert to canvas
          const canvas = await html2canvas(pageElement, {
            scale: 2,
            useCORS: true,
            backgroundColor: "#ffffff",
            logging: false,
          });

          // Convert canvas to blob
          const blob = await new Promise(resolve => 
            canvas.toBlob(resolve, "image/png", 0.95)
          );

          // Create FormData for upload
          const formData = new FormData();
          formData.append("file", blob, `invoice-${fmt}-${generatedInvoice.invoiceNumber}.png`);

          // Upload to Cloudinary via backend
          const uploadRes = await fetch(
            `${API_BASE}/invoices/${generatedInvoice._id}/upload-cloudinary`,
            {
              method: "POST",
              body: formData,
            }
          );

          if (!uploadRes.ok) throw new Error(`Upload failed for ${fmt}`);
          const uploadData = await uploadRes.json();
          cloudinaryUrls[fmt] = uploadData.url;

          // Clean up
          document.body.removeChild(container);
        } catch (err) {
          console.error(`Error processing ${fmt}:`, err);
          toast.error(`Failed to process ${fmt}`);
        }
      }

      toast.dismiss(uploadToastId);
      
      if (Object.keys(cloudinaryUrls).length === 0) {
        throw new Error("No invoices were uploaded successfully");
      }

      toast.success("✅ Invoices uploaded to cloud!");

      // Prepare WhatsApp message with links
      let waMessage = `Hi ${previewData?.customer?.name},\n\n`;
      waMessage += `Your invoice #${generatedInvoice.invoiceNumber} is ready!\n\n`;
      waMessage += `📋 Order Details:\n${cloudinaryUrls.ORDER_DETAILS}\n\n`;
      waMessage += `🧾 Tax Invoice (with Back Order if applicable):\n${cloudinaryUrls.TAX_INVOICE}`;
      waMessage += `\n\nTotal: ₹${previewData?.grandTotal?.toLocaleString?.() || 0}\nThank you!`;

      const waLink = `https://wa.me/${phone}?text=${encodeURIComponent(waMessage)}`;
      window.open(waLink, "_blank");

      // Mark as sent
      if (generatedInvoice?._id) {
        await fetch(`${API_BASE}/invoices/${generatedInvoice._id}/whatsapp`, {
          method: "PUT",
        });
      }
    } catch (error) {
      console.error("WhatsApp error:", error);
      toast.error("Failed to upload invoices or open WhatsApp");
    }
  };

  // Get invoice HTML for printing/preview (individual format or all)
  const getInvoiceHTML = (format = null) => {
    const style = `
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.3; }
        .page { width: 148mm; min-height: 210mm; padding: 5mm; margin: 0 auto; page-break-after: always; }
        .page-content { max-width: 136mm; margin: 0 auto; }
        
        .top-header { display: flex; gap: 10px; margin-bottom: 10px; border-bottom: 2px solid #1e40af; padding-bottom: 8px; }
        .logo-box { width: 45px; height: 45px; display: flex; align-items: center; justify-content: center; border-radius: 5px; flex-shrink: 0; overflow: hidden; }
        .logo-box img { width: 100%; height: 100%; object-fit: contain; }
        .company-header { flex: 1; }
        .company-name { font-size: 14px; font-weight: bold; color: #1e40af; margin-bottom: 2px; }
        .company-address { font-size: 8px; color: #333; line-height: 1.2; margin-bottom: 2px; }
        .company-contact { font-size: 7px; color: #666; }
        
        .order-header { display: flex; justify-content: space-between; margin: 8px 0; font-size: 8px; }
        .order-header-col { flex: 1; }
        .section-title { 
          font-size: 11px; 
          font-weight: bold; 
          color: #fff; 
          background: #1e40af; 
          padding: 4px 6px; 
          margin: 8px 0 6px 0;
        }
        
        .row { display: flex; gap: 15px; margin: 6px 0; font-size: 8px; }
        .col { flex: 1; }
        .label { font-weight: bold; color: #333; }
        
        table { width: 100%; border-collapse: collapse; margin: 6px 0; font-size: 8px; }
        th { background: #1e40af; color: white; padding: 3px 3px; text-align: left; border: 1px solid #ccc; }
        td { border: 1px solid #ddd; padding: 3px 3px; }
        
        .total-section { text-align: right; margin: 8px 0; font-size: 8px; }
        .grand-total { font-size: 10px; font-weight: bold; color: #1e40af; margin-top: 4px; }
        .footer { text-align: center; font-size: 7px; color: #999; margin-top: 10px; }
        .balance-info { background: #f0f0f0; padding: 4px; margin: 8px 0; font-size: 8px; }
        .sample-section { background: #fffacd; padding: 6px; margin: 8px 0; }
        .back-order-section { background: #ffcccc; padding: 6px; margin: 8px 0; }
        
        .sender-buyer { display: flex; gap: 10px; margin: 8px 0; border: 1px solid #ccc; padding: 6px; }
        .sender-buyer-col { flex: 1; font-size: 7px; }
        .sender-buyer-col strong { font-size: 8px; display: block; margin-bottom: 2px; }
        
        @media print { 
          body { margin: 0; padding: 0; } 
          .page { margin: 0; padding: 5mm; }
        }
      </style>
    `;

    let html = `<!DOCTYPE html><html><head><meta charset="UTF-8">${style}</head><body>`;

    // If specific format requested, generate only that
    const formats = format ? [format] : ["ORDER_DETAILS", "TAX_INVOICE"];

    // Invoice Format 1: ORDER DETAILS
    if (formats.includes("ORDER_DETAILS")) {
      html += `
        <div class="page">
          <div class="page-content">
            <!-- TOP HEADER WITH LOGO -->
            <div class="top-header">
              <div class="logo-box"><img src="/logo.jpeg" alt="Pearl Agency Logo" /></div>
              <div class="company-header">
                <div class="company-name">PEARL AGENCY</div>
                <div class="company-address">
                  <strong>12/13, South By-Pass Road, Vanarpettai, Tirunelveli - 627003, Tamil Nadu</strong><br/>
                  Mobile: ${previewData?.seller?.phone || "9429692970"} | GSTIN: ${previewData?.seller?.gstin || "33DULPS2600Q1Z6"}<br/>
                  GPAY No: ${previewData?.seller?.gpayNo || "8825847884"} | State: Tamil Nadu (Code: ${previewData?.seller?.stateCode || "33"})
                </div>
              </div>
            </div>

            <div class="section-title">📋 ORDER DETAILS</div>

            <!-- ORDER INFO -->
            <div class="order-header">
              <div class="order-header-col">
                <div class="label">Invoice No:</div>
                <div>${generatedInvoice?.invoiceNumber || "Generated Auto"}</div>
              </div>
              <div class="order-header-col">
                <div class="label">Date:</div>
                <div>${new Date().toLocaleDateString("en-IN")}</div>
              </div>
              <div class="order-header-col">
                <div class="label">Billing Person:</div>
                <div>${previewData?.billingPerson || "-"}</div>
              </div>
            </div>

            <!-- SENDER & BUYER -->
            <div class="sender-buyer">
              <div class="sender-buyer-col">
                <strong>SENDER (FROM)</strong>
                ${previewData?.seller?.name}<br/>
                ${previewData?.seller?.address}<br/>
                GSTIN: ${previewData?.seller?.gstin}<br/>
                Phone: ${previewData?.seller?.phone}
              </div>
              <div class="sender-buyer-col">
                <strong>BUYER (BILL TO)</strong>
                ${previewData?.customer?.name}<br/>
                ${previewData?.customer?.address}<br/>
                ${previewData?.customer?.district}, ${previewData?.customer?.state} ${previewData?.customer?.pincode}<br/>
                Mobile: ${previewData?.customer?.whatsapp || "-"}
              </div>
            </div>

            <!-- PRODUCT DETAILS TABLE -->
            <div class="section-title">📦 PRODUCT DETAILS</div>
            <table>
              <thead>
                <tr>
                  <th style="flex: 2;">Product Name</th>
                  <th>HSN</th>
                  <th style="text-align: right;">Qty</th>
                  <th style="text-align: right;">Price</th>
                  <th style="text-align: right;">Total</th>
                </tr>
              </thead>
              <tbody>
                ${previewData?.items?.map(item => `
                  <tr>
                    <td>${item.name}</td>
                    <td>${item.hsn || "-"}</td>
                    <td style="text-align: right;">${item.qty}</td>
                    <td style="text-align: right;">₹${item.sellingPrice?.toFixed(2) || 0}</td>
                    <td style="text-align: right;">₹${item.total?.toFixed(2) || 0}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>

            <!-- SAMPLE PRODUCTS TABLE -->
            ${previewData?.sampleItems?.length > 0 ? `
              <div class="sample-section">
                <strong>🎁 SAMPLE PRODUCTS (NOT BILLED)</strong>
                <table style="margin-top: 5px;">
                  <thead>
                    <tr>
                      <th>Product Name</th>
                      <th>HSN</th>
                      <th style="text-align: right;">Qty</th>
                      <th style="text-align: right;">Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${previewData.sampleItems.map(item => `
                      <tr>
                        <td>${item.name}</td>
                        <td>${item.hsn || "-"}</td>
                        <td style="text-align: right;">${item.qty}</td>
                        <td style="text-align: right;">₹${item.sellingPrice?.toFixed(2) || 0}</td>
                      </tr>
                    `).join("")}
                  </tbody>
                </table>
              </div>
            ` : ""}

            <!-- TOTALS -->
            <div class="total-section">
              <div>Subtotal: <strong>₹${previewData?.subtotal?.toFixed(2) || 0}</strong></div>
              <div>CGST (${previewData?.items?.[0]?.cgst || 0}%): <strong>₹${previewData?.totalTax?.cgst?.toFixed(2) || 0}</strong></div>
              <div>SGST (${previewData?.items?.[0]?.sgst || 0}%): <strong>₹${previewData?.totalTax?.sgst?.toFixed(2) || 0}</strong></div>
              ${previewData?.transportCharge > 0 ? `<div>Transport: <strong>₹${previewData.transportCharge.toFixed(2)}</strong></div>` : ""}
              ${previewData?.extraExpenseAmount > 0 ? `<div>Extra Expenses: <strong>₹${previewData.extraExpenseAmount.toFixed(2)}</strong></div>` : ""}
              <div class="grand-total">Grand Total: ₹${previewData?.grandTotal?.toFixed(2) || 0}</div>
            </div>

            <!-- BALANCE INFO -->
            <div class="balance-info">
              <div><strong>Opening Balance:</strong> ₹${previewData?.openingBalance?.toFixed(2) || 0}</div>
              <div><strong>Closing Balance:</strong> ₹${previewData?.closingBalance?.toFixed(2) || 0}</div>
            </div>

            <!-- NOTES -->
            ${previewData?.notes ? `<div style="margin: 10px 0; padding: 8px; background: #f9f9f9; font-size: 9px;"><strong>Notes:</strong> ${previewData.notes}</div>` : ""}

            <div class="footer">Invoice generated on ${new Date().toLocaleString("en-IN")}</div>
          </div>
        </div>
      `;
    }

    // Invoice Format 2: TAX INVOICE (HSN-wise summary)
    if (formats.includes("TAX_INVOICE")) {
      html += `
        <div class="page">
          <div class="page-content">
            <!-- TOP HEADER WITH LOGO -->
            <div class="top-header">
              <div class="logo-box"><img src="/logo.jpeg" alt="Pearl Agency Logo" /></div>
              <div class="company-header">
                <div class="company-name">PEARL AGENCY</div>
                <div class="company-address">
                  <strong>12/13, South By-Pass Road, Vanarpettai, Tirunelveli - 627003, Tamil Nadu</strong><br/>
                  Mobile: ${previewData?.seller?.phone || "9429692970"} | GSTIN: ${previewData?.seller?.gstin || "33DULPS2600Q1Z6"}<br/>
                  GPAY No: ${previewData?.seller?.gpayNo || "8825847884"} | State: Tamil Nadu (Code: ${previewData?.seller?.stateCode || "33"})
                </div>
              </div>
            </div>

            <div class="section-title">🧾 TAX INVOICE - HSN-WISE SUMMARY</div>

            <div style="text-align: center; margin-bottom: 12px; font-size: 9px;">
              <strong>Invoice No: ${generatedInvoice?.invoiceNumber || "Auto"}</strong> | Date: ${new Date().toLocaleDateString("en-IN")}
            </div>

            <table>
              <thead>
                <tr>
                  <th>HSN Code</th>
                  <th style="text-align: right;">Taxable Value</th>
                  <th style="text-align: right;">CGST (Rate | Amt)</th>
                  <th style="text-align: right;">SGST (Rate | Amt)</th>
                  <th style="text-align: right;">Total</th>
                </tr>
              </thead>
              <tbody>
                ${previewData?.items?.map((item, idx) => `
                  <tr>
                    <td>${item.hsn || "N/A"}</td>
                    <td style="text-align: right;">₹${item.total?.toFixed(2) || 0}</td>
                    <td style="text-align: right;">${item.cgst || 0}% | ₹${((item.total || 0) * (item.cgst || 0) / 100).toFixed(2)}</td>
                    <td style="text-align: right;">${item.sgst || 0}% | ₹${((item.total || 0) * (item.sgst || 0) / 100).toFixed(2)}</td>
                    <td style="text-align: right;">₹${(item.total + ((item.total || 0) * (item.cgst || 0) / 100) + ((item.total || 0) * (item.sgst || 0) / 100)).toFixed(2)}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>

            <div class="total-section">
              <div>Taxable Value: <strong>₹${previewData?.subtotal?.toFixed(2) || 0}</strong></div>
              <div>CGST (${previewData?.items?.[0]?.cgst || 0}%): <strong>₹${previewData?.totalTax?.cgst?.toFixed(2) || 0}</strong></div>
              <div>SGST (${previewData?.items?.[0]?.sgst || 0}%): <strong>₹${previewData?.totalTax?.sgst?.toFixed(2) || 0}</strong></div>
              <div class="grand-total">TOTAL AMOUNT: ₹${previewData?.grandTotal?.toFixed(2) || 0}</div>
            </div>

            <!-- BACK ORDER SECTION (if applicable) -->
            ${editedItems.some(item => item.backOrderQty > 0) ? `
              <div style="margin-top: 15px; padding-top: 10px; border-top: 2px solid #1e40af;">
                <div class="section-title">📦 BACK ORDER SUMMARY</div>
                <table>
                  <thead>
                    <tr>
                      <th>Product Name</th>
                      <th style="text-align: right;">Requested</th>
                      <th style="text-align: right;">Confirmed</th>
                      <th style="text-align: right;">Pending ⚠️</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${editedItems.map((item, idx) => item.backOrderQty > 0 ? `
                      <tr>
                        <td>${item.name}</td>
                        <td style="text-align: right;">${item.qty}</td>
                        <td style="text-align: right;">${item.confirmedQty}</td>
                        <td style="text-align: right; color: red; font-weight: bold;">${item.backOrderQty}</td>
                      </tr>
                    ` : "").join("")}
                  </tbody>
                </table>
                <div class="back-order-section">
                  <strong>Total Pending: ${editedItems.reduce((sum, item) => sum + (item.backOrderQty || 0), 0)} units</strong>
                  <div style="margin-top: 5px; font-size: 7px;">
                    📅 Expected delivery by ${new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString("en-IN")}
                  </div>
                </div>
              </div>
            ` : ""}

            <div class="footer">Tax Invoice as per GST regulations</div>
          </div>
        </div>
      `;
    }


    html += "</body></html>";
    return html;
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* HEADER */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 flex items-center justify-between text-white">
          <div>
            <h2 className="text-2xl font-bold">📄 Invoice Generator</h2>
            <p className="text-sm opacity-90">SO: {order.invoiceId}</p>
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
          {["edit", "preview", "success"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 font-semibold text-sm transition whitespace-nowrap ${
                activeTab === tab
                  ? "text-blue-600 border-b-2 border-blue-600 bg-white"
                  : "text-gray-600 hover:text-gray-800"
              }`}
            >
              {tab === "edit" && "✏️ Edit"}
              {tab === "preview" && "👁️ Preview"}
              {tab === "success" && "✅ Success"}
            </button>
          ))}
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-auto p-6">
          {/* EDIT TAB */}
          {activeTab === "edit" && (
            <div>
              <h3 className="text-lg font-bold mb-4">Edit Order Items</h3>

              {/* Invoice Type Selection */}
              <div className="bg-blue-50 p-4 rounded-lg mb-6">
                <label className="block font-semibold mb-3">Invoice Type:</label>
                <div className="flex flex-wrap gap-4">
                  {[
                    { val: "ORDER_DETAILS", label: "📋 Order Details" },
                    { val: "TAX_INVOICE", label: "🧾 Tax Invoice (with Back Order if applicable)" },
                  ].map((option) => (
                    <label key={option.val} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        value={option.val}
                        checked={invoiceType === option.val}
                        onChange={(e) => setInvoiceType(e.target.value)}
                        className="w-4 h-4"
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Items Table */}
              <div className="overflow-x-auto mb-6">
                <table className="w-full border">
                  <thead className="bg-blue-600 text-white">
                    <tr>
                      <th className="border p-3 text-left">Product</th>
                      <th className="border p-3 text-right">Original Qty</th>
                      <th className="border p-3 text-right">Confirmed Qty</th>
                      <th className="border p-3 text-right">Back Order Qty</th>
                      <th className="border p-3 text-right">Price</th>
                      <th className="border p-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {editedItems.map((item, idx) => (
                      <tr key={item._id} className="border hover:bg-gray-50">
                        <td className="border p-3">{item.name}</td>
                        <td className="border p-3 text-right font-semibold">{item.qty}</td>
                        <td className="border p-3">
                          <input
                            type="number"
                            min="0"
                            max={item.qty}
                            value={item.confirmedQty}
                            onChange={(e) =>
                              handleQtyChange(idx, parseInt(e.target.value) || 0)
                            }
                            className="w-20 p-2 border rounded text-right bg-blue-50"
                          />
                        </td>
                        <td className="border p-3 text-right text-red-600 font-bold">
                          {item.backOrderQty}
                        </td>
                        <td className="border p-3 text-right">₹{item.sellingPrice}</td>
                        <td className="border p-3 text-right font-semibold">
                          ₹{(item.total * (item.confirmedQty / item.qty)).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Notes */}
              <div className="mb-6">
                <label className="block font-semibold mb-2">Invoice Notes:</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add any notes or special instructions..."
                  className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  rows="4"
                />
              </div>

              {/* Options */}
              <div className="bg-amber-50 p-4 rounded-lg">
                <label className="flex items-center gap-2 cursor-pointer mb-3">
                  <input
                    type="checkbox"
                    checked={shouldPrint}
                    onChange={(e) => setShouldPrint(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="font-semibold">🖨️ Auto Print after generation</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={shouldWhatsApp}
                    onChange={(e) => setShouldWhatsApp(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="font-semibold">💬 Send via WhatsApp</span>
                </label>
              </div>
            </div>
          )}

          {/* PREVIEW TAB - Show All 3 Invoices */}
          {activeTab === "preview" && previewData && (
            <div>
              <h3 className="text-lg font-bold mb-4">📄 Preview All Invoices</h3>

              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <div className="text-sm text-gray-600">Subtotal</div>
                  <div className="text-xl font-bold text-blue-600">
                    ₹{previewData.subtotal?.toFixed(2)}
                  </div>
                </div>
                <div className="p-4 bg-green-50 rounded-lg">
                  <div className="text-sm text-gray-600">CGST + SGST</div>
                  <div className="text-xl font-bold text-green-600">
                    ₹{(previewData.totalTax?.total || 0).toFixed(2)}
                  </div>
                </div>
                <div className="p-4 bg-purple-50 rounded-lg">
                  <div className="text-sm text-gray-600">Extra Charges</div>
                  <div className="text-xl font-bold text-purple-600">
                    ₹{previewData.extraExpenseAmount?.toFixed(2)}
                  </div>
                </div>
                <div className="p-4 bg-red-50 rounded-lg">
                  <div className="text-sm text-gray-600">Grand Total</div>
                  <div className="text-2xl font-bold text-red-600">
                    ₹{previewData.grandTotal?.toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Back Order Alert */}
              {editedItems.some((item) => item.backOrderQty > 0) && (
                <div className="bg-red-50 border-2 border-red-300 p-4 rounded-lg mb-6">
                  <div className="font-bold text-red-700 mb-2">⚠️ Back Order Items</div>
                  <div className="text-sm text-red-600">
                    {editedItems
                      .filter((item) => item.backOrderQty > 0)
                      .map((item) => `${item.name}: ${item.backOrderQty}`)
                      .join(" | ")}
                  </div>
                </div>
              )}

              {/* All Invoices Preview */}
              <div className="border-2 border-gray-300 rounded-lg p-4 bg-gray-50 max-h-96 overflow-y-auto">
                <div dangerouslySetInnerHTML={{ __html: getInvoiceHTML() }} 
                     style={{ zoom: '0.75', transformOrigin: 'top left', width: '133.33%' }} />
              </div>
            </div>
          )}

          {/* SUCCESS TAB */}
          {activeTab === "success" && generatedInvoice && (
            <div className="text-center">
              <div className="text-6xl mb-4">✅</div>
              <h3 className="text-2xl font-bold text-green-600 mb-2">
                Invoice Generated Successfully!
              </h3>
              <p className="text-gray-600 mb-6">
                Invoice #{generatedInvoice.invoiceNumber}
              </p>

              <div className="bg-green-50 p-6 rounded-lg mb-6">
                <div className="text-lg mb-4">
                  Total Amount: <span className="font-bold text-2xl text-green-600">₹{previewData?.grandTotal?.toFixed(2)}</span>
                </div>
                <div className="text-sm text-gray-600">
                  Closing Balance: ₹{previewData?.closingBalance?.toFixed(2)}
                </div>
              </div>

              <div className="flex gap-4 justify-center">
                <button
                  onClick={handlePrint}
                  className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition font-semibold"
                >
                  <FaPrint /> Print Invoice
                </button>
                <button
                  onClick={handleWhatsApp}
                  className="flex items-center gap-2 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition font-semibold"
                >
                  <FaWhatsapp /> Send WhatsApp
                </button>
              </div>
            </div>
          )}
        </div>

        {/* FOOTER ACTIONS */}
        <div className="bg-gray-50 p-6 flex justify-between border-t">
          <button
            onClick={onClose}
            className="px-6 py-2 text-gray-700 border-2 border-gray-300 rounded-lg hover:bg-gray-100 transition font-semibold"
          >
            Close
          </button>

          <div className="flex gap-4">
            {activeTab === "edit" && (
              <button
                onClick={handleGeneratePreview}
                disabled={generating}
                className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 font-semibold"
              >
                {generating ? <FaSpinner className="animate-spin" /> : <FaEdit />}
                {generating ? "Generating..." : "Generate Preview"}
              </button>
            )}

            {activeTab === "preview" && (
              <button
                onClick={handleFinalize}
                disabled={generating}
                className="flex items-center gap-2 bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition disabled:opacity-50 font-semibold"
              >
                {generating ? <FaSpinner className="animate-spin" /> : <FaCheck />}
                {generating ? "Generating..." : "Finalize & Generate"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvoiceGeneratorModal;
