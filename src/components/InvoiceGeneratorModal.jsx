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
import { useBranch } from "../context/BranchContext";

const InvoiceGeneratorModal = ({ order, onClose, onSuccess }) => {
  const { user } = useBranch();
  const [activeTab, setActiveTab] = useState("edit");
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Edit state
  const [editedItems, setEditedItems] = useState([]);
  const [notes, setNotes] = useState("");
  const [invoiceType, setInvoiceType] = useState("ORDER_DETAILS");
  const [commonDiscount, setCommonDiscount] = useState(0);

  // Preview state
  const [previewData, setPreviewData] = useState(null);

  // Generated invoice
  const [generatedInvoice, setGeneratedInvoice] = useState(null);
  const [numCopies, setNumCopies] = useState(2);

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
      setNotes(order.notes || "");
      setCommonDiscount(order.commonDiscount || 0);
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
            commonDiscount,
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
            commonDiscount,
            finalizedBy: user?.id || user?._id,
            finalizedByUsername: user?.username || user?.fullName || user?.name || "System",
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
      if (!printWindow) {
        toast.warning("🔔 Pop-up blocked! Please allow pop-ups for this site to print.");
        return;
      }
      printWindow.document.write(getInvoiceHTML());
      printWindow.document.close();
      setTimeout(() => {
        if (printWindow) printWindow.print();
      }, 250);

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
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.5; color: #000; }
        .page { width: 148mm; min-height: 210mm; padding: 6mm; margin: 0 auto; page-break-after: always; background: white; }
        .page-content { max-width: 136mm; margin: 0 auto; }
        
        .top-header { display: flex; gap: 12px; margin-bottom: 12px; border-bottom: 2px solid #1e40af; padding-bottom: 8px; }
        .logo-box { width: 60px; height: 60px; display: flex; align-items: center; justify-content: center; border-radius: 6px; flex-shrink: 0; overflow: hidden; }
        .logo-box img { width: 100%; height: 100%; object-fit: contain; }
        .company-header { flex: 1; }
        .company-name { font-size: 18px; font-weight: bold; color: #1e40af; margin-bottom: 3px; text-transform: uppercase; }
        .company-address { font-size: 11px; color: #000; line-height: 1.3; margin-bottom: 3px; }
        .company-contact { font-size: 10px; color: #000; }
        
        .order-header { display: flex; justify-content: space-between; margin: 10px 0; font-size: 11px; border-bottom: 1px dashed #cbd5e1; padding-bottom: 8px; color: #000; }
        .order-header-col { flex: 1; }
        .section-title { 
          font-size: 13px; 
          font-weight: bold; 
          color: #fff; 
          background: #1e40af; 
          padding: 4px 10px; 
          margin: 10px 0 8px 0;
          border-radius: 4px;
        }
        
        .row { display: flex; gap: 15px; margin: 8px 0; font-size: 11px; }
        .col { flex: 1; }
        .label { font-weight: bold; color: #1e40af; }
        
        table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 10px; }
        th { background: #1e40af; color: white; padding: 6px; text-align: left; border: 1px solid #1e3a8a; font-weight: 600; }
        td { border: 1px solid #000; padding: 5px 6px; color: #000; }
        
        .total-section { text-align: right; margin: 15px 0; font-size: 11px; line-height: 1.5; color: #000; }
        .grand-total { font-size: 16px; font-weight: bold; color: #1e40af; margin-top: 8px; border-top: 2px solid #1e40af; padding-top: 4px; }
        .footer { text-align: center; font-size: 10px; color: #94a3b8; margin-top: 20px; }
        .copy-label { 
          text-align: right; 
          font-weight: 800; 
          color: #dc2626; 
          font-size: 11px; 
          margin-top: 15px;
          border-top: 1px solid #e5e7eb;
          padding-top: 10px;
          letter-spacing: 1.1px;
          text-transform: uppercase;
        }
        .balance-info { background: #f8fafc; padding: 10px; margin: 12px 0; font-size: 13px; border-left: 4px solid #1e40af; border-radius: 4px; }
        .sample-section { background: #fffbeb; padding: 12px; margin: 15px 0; border: 1px solid #fef3c7; border-radius: 6px; }
        .back-order-section { background: #fef2f2; padding: 12px; margin: 15px 0; border: 1px solid #fee2e2; border-radius: 6px; }
        
        .sender-buyer { display: flex; gap: 12px; margin: 10px 0; border: 1px solid #000; padding: 10px; border-radius: 6px; background: #f8fafc; color: #000; }
        .sender-buyer-col { flex: 1; font-size: 10px; line-height: 1.4; }
        .sender-buyer-col strong { font-size: 11px; display: block; margin-bottom: 3px; color: #1e40af; }
        
        .certification { 
          font-size: 12px; 
          font-style: italic; 
          margin-top: 25px; 
          color: #000; 
          border-top: 1px solid #e5e7eb;
          padding-top: 10px;
          line-height: 1.5;
        }
        
        .quick-info { 
          font-size: 9px; 
          color: #000; 
          margin-bottom: 5px;
          display: flex;
          justify-content: space-between;
          border-bottom: 1px dotted #000;
          padding-bottom: 2px;
        }
        
        @media print { 
          body { margin: 0; padding: 0; } 
          .page { margin: 0 auto; padding: 5mm; page-break-after: always !important; }
        }
      </style>
    `;

    let html = `<!DOCTYPE html><html><head><meta charset="UTF-8">${style}</head><body>`;

    // If specific format requested, generate only that
    const formats = format ? [format] : ["ORDER_DETAILS", "TAX_INVOICE"];

    // Define copies to generate
    const isReEdited = !!order.isReEdited || !!order.invoiceGenerated;
    const baseTitles = isReEdited 
      ? ["RE-EDIT ORIGINAL", "RE-EDIT COPY 1", "RE-EDIT COPY 2"] 
      : ["ORIGINAL INVOICE", "OFFICE COPY", "EXTRA COPY"];
    
    const copiesToGenerate = baseTitles.slice(0, numCopies);

    copiesToGenerate.forEach(copyTitle => {
      // Invoice Format 1: ORDER DETAILS
      if (formats.includes("ORDER_DETAILS")) {
        html += `
          <div class="page">
            <div class="page-content">
              <!-- QUICK REF HEADER -->
              <div class="quick-info">
                <span>INV: ${generatedInvoice?.invoiceNumber || order?.invoiceId || "PENDING"}</span>
                <span>CUST: ${previewData?.customer?.name || "CASH CUSTOMER"}</span>
              </div>
              <!-- TOP HEADER WITH LOGO -->
              <div class="top-header">
                <div class="logo-box"><img src="${previewData?.seller?.logo || "/logo.jpeg"}" alt="Logo" /></div>
                <div class="company-header">
                  <div class="company-name">${previewData?.seller?.name || "PEARL AGENCY"}</div>
                  <div class="company-address">
                    <strong>${previewData?.seller?.address || "12/13, South By-Pass Road, Vanarpettai, Tirunelveli - 627003, Tamil Nadu"}</strong><br/>
                    Mobile: ${previewData?.seller?.phone || "-"} | GSTIN: ${previewData?.seller?.gstin || "-"}<br/>
                    GPAY No: ${previewData?.seller?.gpayNo || ""} | State: ${previewData?.seller?.state || "Tamil Nadu"} (Code: ${previewData?.seller?.stateCode || "33"})
                  </div>
                </div>
              </div>

              <div class="section-title">📋 ORDER DETAILS</div>

              <!-- ORDER INFO -->
              <div class="order-header">
                <div class="order-header-col">
                  <div class="label">Invoice No:</div>
                  <div style="font-weight: bold; color: #1e40af;">${generatedInvoice?.invoiceNumber || order?.invoiceId || "PENDING"}</div>
                </div>
                <div class="order-header-col">
                  <div class="label">Date:</div>
                  <div style="font-weight: bold;">${new Date().toLocaleDateString("en-IN")}</div>
                </div>
                <div class="order-header-col">
                  <div class="label">Billing:</div>
                  <div style="font-weight: bold;">${previewData?.billingPerson || "-"}</div>
                </div>
                <div class="order-header-col">
                  <div class="label">Delivery:</div>
                  <div style="font-weight: bold;">${previewData?.deliveryMan || "-"}</div>
                </div>
              </div>

              <!-- BUYER (BILL TO) -->
              <div class="sender-buyer">
                <div class="sender-buyer-col">
                  <strong>BUYER (BILL TO)</strong>
                  ${previewData?.customer?.name}<br/>
                  ${previewData?.customer?.address}<br/>
                  ${previewData?.customer?.district ? previewData?.customer?.district + ', ' : ''}${previewData?.customer?.state || ""} ${previewData?.customer?.pincode || ""}<br/>
                  Mobile: ${previewData?.customer?.whatsapp || previewData?.customer?.customerId?.whatsapp || "-"}<br/>
                  GSTIN: ${previewData?.customer?.gstin || previewData?.customer?.customerId?.gstin || "N/A"}
                </div>
              </div>

              <!-- PRODUCT DETAILS TABLE -->
              <div class="section-title">📦 PRODUCT DETAILS</div>
              <table>
                <thead>
                  <tr>
                    <th style="width: 30%;">Product Name</th>
                    <th>HSN</th>
                    <th>GST</th>
                    <th style="text-align: right;">Qty</th>
                    <th style="text-align: right;">Rate</th>
                    <th style="text-align: center;">Per</th>
                    <th style="text-align: right;">Discount</th>
                    <th style="text-align: right;">Total Amount (Qty × Rate)</th>
                  </tr>
                </thead>
                <tbody>
                  ${previewData?.items?.map(item => `
                    <tr>
                      <td>${item.name}</td>
                      <td>${item.hsn || "-"}</td>
                      <td style="text-align: center;">${item.gst || 0}%</td>
                      <td style="text-align: right;">${item.qty} ${item.unit || ""} ${item.altQty > 0 ? `(${item.altQty} ${item.altUnit})` : ""}</td>
                      <td style="text-align: right;">₹${item.sellingPrice?.toFixed(2) || 0}</td>
                      <td style="text-align: center; text-transform: uppercase;">${item.unit || ""}</td>
                      <td style="text-align: right;">${item.discountPercent || 0}% (-₹${(item.discountAmount || 0).toFixed(2)})</td>
                      <td style="text-align: right;">₹${(item.qty * item.sellingPrice).toFixed(2)}</td>
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
                        <th style="width: 40%;">Product Name</th>
                        <th>HSN</th>
                        <th style="text-align: right;">Qty</th>
                        <th style="text-align: right;">Rate</th>
                        <th style="text-align: center;">Per</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${previewData.sampleItems.map(item => `
                        <tr>
                          <td>${item.name}</td>
                          <td>${item.hsn || "-"}</td>
                          <td style="text-align: right;">${item.qty} ${item.unit || ""} ${item.altQty > 0 ? `(${item.altQty} ${item.altUnit})` : ""}</td>
                          <td style="text-align: right;">₹${item.sellingPrice?.toFixed(2) || 0}</td>
                          <td style="text-align: center; text-transform: uppercase;">${item.unit || ""}</td>
                        </tr>
                      `).join("")}
                    </tbody>
                  </table>
                </div>
              ` : ""}

              <!-- TOTALS AND BALANCE -->
              <div style="display: flex; gap: 10px;">
                <div style="flex: 1;">
                   <!-- BALANCE INFO -->
                  <div class="balance-info">
                    <div><strong>Opening Balance:</strong> ₹${previewData?.openingBalance?.toFixed(2) || 0}</div>
                    <div><strong>Closing Balance:</strong> ₹${previewData?.closingBalance?.toFixed(2) || 0}</div>
                  </div>
                  
                  <!-- NOTES -->
                  ${previewData?.notes ? `<div style="margin: 5px 0; padding: 5px; background: #f9f9f9; font-size: 7px; border: 1px solid #eee;"><strong>Notes:</strong> ${previewData.notes}</div>` : ""}
                </div>

                <div class="total-section" style="flex: 1;">
                  <div style="font-size: 11px;">Subtotal (Gross): <strong>₹${previewData?.subtotal?.toFixed(2) || 0}</strong></div>
                  
                  ${previewData?.totalTax?.igst > 0 ? 
                    `<div style="font-size: 11px;">IGST: <strong>₹${(previewData?.totalTax?.igst || 0).toFixed(2)}</strong></div>` : 
                    `<div style="font-size: 11px;">CGST: <strong>₹${(previewData?.totalTax?.cgst || 0).toFixed(2)}</strong></div>
                     <div style="font-size: 11px;">SGST: <strong>₹${(previewData?.totalTax?.sgst || 0).toFixed(2)}</strong></div>`
                  }
                  
                  ${previewData?.commonDiscount > 0 ? `<div style="font-size: 11px;">Common Discount: <strong style="color: red;">-₹${previewData.commonDiscount.toFixed(2)}</strong></div>` : ""}
                  ${previewData?.transportCharge > 0 ? `<div style="font-size: 11px;">Transport: <strong>₹${previewData.transportCharge.toFixed(2)}</strong></div>` : ""}
                  ${previewData?.extraExpenseAmount > 0 ? `<div style="font-size: 11px;">Extra Expenses: <strong>₹${previewData.extraExpenseAmount.toFixed(2)}</strong></div>` : ""}
                  
                  <div class="grand-total">GRAND TOTAL: ₹${previewData?.grandTotal?.toFixed(2) || 0}</div>
                </div>
              </div>

              <div class="certification">Certified that the particulars given above are true and correct.</div>
              <div class="copy-label">${copyTitle} - PAGE 1</div>
              <div class="footer">E. & O.E. | Generated on ${new Date().toLocaleString("en-IN")}</div>
            </div>
          </div>
        `;
      }

      // Invoice Format 2: TAX INVOICE (HSN-wise summary)
      if (formats.includes("TAX_INVOICE")) {
        html += `
          <div class="page">
            <div class="page-content">
              <!-- QUICK REF HEADER -->
              <div class="quick-info">
                <span>INV: ${generatedInvoice?.invoiceNumber || order?.invoiceId || "PENDING"}</span>
                <span>CUST: ${previewData?.customer?.name || "CASH CUSTOMER"}</span>
              </div>
              <!-- TOP HEADER WITH LOGO -->
              <div class="top-header">
                <div class="logo-box"><img src="${previewData?.seller?.logo || "/logo.jpeg"}" alt="Logo" /></div>
                <div class="company-header">
                  <div class="company-name">${previewData?.seller?.name || "PEARL AGENCY"}</div>
                  <div class="company-address">
                    <strong>${previewData?.seller?.address || "12/13, South By-Pass Road, Vanarpettai, Tirunelveli - 627003, Tamil Nadu"}</strong><br/>
                    Mobile: ${previewData?.seller?.phone || "-"} | GSTIN: ${previewData?.seller?.gstin || "-"}<br/>
                    GPAY No: ${previewData?.seller?.gpayNo || ""} | State: ${previewData?.seller?.state || "Tamil Nadu"} (Code: ${previewData?.seller?.stateCode || "33"})
                  </div>
                </div>
              </div>

              <div class="section-title">🧾 TAX INVOICE - HSN-WISE SUMMARY</div>

              <div style="text-align: center; margin-bottom: 20px; font-size: 13px;">
                <strong>Invoice No: ${generatedInvoice?.invoiceNumber || order?.invoiceId || "PENDING"}</strong> | Date: ${new Date().toLocaleDateString("en-IN")}
                <div style="font-size: 10px; color: #666; margin-top: 5px;">
                  Billing: ${previewData?.billingPerson || "-"} | Delivery: ${previewData?.deliveryMan || "-"}
                </div>
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
                   ${(() => {
                    const hsnMap = {};
                    (previewData?.items || []).forEach(item => {
                      const hsn = item.hsn || "N/A";
                      if (!hsnMap[hsn]) {
                        hsnMap[hsn] = { taxable: 0, cgst: 0, sgst: 0, total: 0, cgstRate: item.cgst || 0, sgstRate: item.sgst || 0 };
                      }
                      // Base calculation from inclusive total
                      const totalInclusive = item.total || 0;
                      const gstRate = (item.gst || 0);
                      const taxable = totalInclusive / (1 + (gstRate / 100));
                      const cgstAmt = (taxable * (item.cgst || 0)) / 100;
                      const sgstAmt = (taxable * (item.sgst || 0)) / 100;
                      
                      hsnMap[hsn].taxable += taxable;
                      hsnMap[hsn].cgst += cgstAmt;
                      hsnMap[hsn].sgst += sgstAmt;
                      hsnMap[hsn].total += totalInclusive;
                    });
                    return Object.entries(hsnMap).map(([hsn, data]) => `
                      <tr>
                        <td>${hsn}</td>
                        <td style="text-align: right;">₹${data.taxable.toFixed(2)}</td>
                        <td style="text-align: right;">${data.cgstRate}% | ₹${data.cgst.toFixed(2)}</td>
                        <td style="text-align: right;">${data.sgstRate}% | ₹${data.sgst.toFixed(2)}</td>
                        <td style="text-align: right;">₹${data.total.toFixed(2)}</td>
                      </tr>
                    `).join("");
                  })()}
                  <tr style="background: #f1f5f9; font-weight: bold;">
                    <td>TRANSPORT GST</td>
                    <td style="text-align: right;">₹${(previewData?.transportCharge || 0).toFixed(2)}</td>
                    <td style="text-align: right;">9% | ₹${((previewData?.transportCharge * 0.18 / 2) || 0).toFixed(2)}</td>
                    <td style="text-align: right;">9% | ₹${((previewData?.transportCharge * 0.18 / 2) || 0).toFixed(2)}</td>
                    <td style="text-align: right;">₹${((previewData?.transportCharge * 1.18) || 0).toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>

              <div class="total-section">
                <div style="font-size: 11px;">Subtotal (Gross): <strong>₹${previewData?.subtotal?.toFixed(2) || 0}</strong></div>
                ${previewData?.totalTax?.igst > 0 ? 
                  `<div style="font-size: 11px;">IGST: <strong>₹${(previewData?.totalTax?.igst || 0).toFixed(2)}</strong></div>` : 
                  `<div style="font-size: 11px;">CGST: <strong>₹${(previewData?.totalTax?.cgst || 0).toFixed(2)}</strong></div>
                   <div style="font-size: 11px;">SGST: <strong>₹${(previewData?.totalTax?.sgst || 0).toFixed(2)}</strong></div>`
                }
                ${previewData?.commonDiscount > 0 ? `<div style="font-size: 11px;">Common Discount: <strong style="color: red;">-₹${previewData.commonDiscount.toFixed(2)}</strong></div>` : ""}
                ${previewData?.transportCharge > 0 ? `<div style="font-size: 11px;">Transport: <strong>₹${previewData.transportCharge.toFixed(2)}</strong></div>` : ""}
                ${previewData?.extraExpenseAmount > 0 ? `<div style="font-size: 11px;">Extra Expenses: <strong>₹${previewData.extraExpenseAmount.toFixed(2)}</strong></div>` : ""}
                <div class="grand-total">TOTAL AMOUNT: ₹${previewData?.grandTotal?.toFixed(2) || 0}</div>
              </div>

              <!-- BACK ORDER SECTION (if applicable) -->
    ${editedItems.some(item => item.backOrderQty > 0) ? `
      <div style="margin-top: 15px; padding-top: 10px; border-top: 2px solid #1e40af;">
        <div class="section-title">📦 BACK ORDER SUMMARY</div>
        <table>
          <thead>
            <tr>
              <th style="width: 40%;">Product Name</th>
              <th style="text-align: right;">Req</th>
              <th style="text-align: right;">Conf</th>
              <th style="text-align: right;">Pend ⚠️</th>
              <th style="text-align: center;">Per</th>
            </tr>
          </thead>
          <tbody>
            ${editedItems.map((item, idx) => item.backOrderQty > 0 ? `
              <tr>
                <td>${item.name}</td>
                <td style="text-align: right;">${item.qty} ${item.altQty > 0 ? `(${item.altQty} ${item.altUnit})` : ""}</td>
                <td style="text-align: right;">${item.confirmedQty} ${item.altQty > 0 ? `(${(item.altQty * (item.confirmedQty / item.qty)).toFixed(0)} ${item.altUnit})` : ""}</td>
                <td style="text-align: right; color: red; font-weight: bold;">${item.backOrderQty} ${item.altQty > 0 ? `(${(item.altQty * (item.backOrderQty / item.qty)).toFixed(0)} ${item.altUnit})` : ""}</td>
                <td style="text-align: center; text-transform: uppercase;">${item.unit || ""}</td>
              </tr>
            ` : "").join("")}
          </tbody>
        </table>
      </div>
      ${previewData?.notes ? `<div style="margin-top: 15px; padding: 12px; background: #f8fafc; font-size: 13px; border: 1px dashed #cbd5e1; border-radius: 4px;"><strong>Notes:</strong> ${previewData.notes}</div>` : ""}
    ` : ""}

              <div class="certification">Certified that the particulars given above are true and correct.</div>
              <div class="copy-label">${copyTitle} - PAGE 2</div>
              <div class="footer">Tax Invoice as per GST regulations | Generated on ${new Date().toLocaleString("en-IN")}</div>
            </div>
          </div>
        `;
      }
    });

    html += "</body></html>";
    return html;
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* HEADER */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 flex items-center justify-between text-white">
          <div>
            <h2 className="text-2xl font-bold">📄 {order.invoiceGenerated ? "Re-edit Invoice" : "Invoice Generator"}</h2>
            <p className="text-sm opacity-90">SO: {order.invoiceId} {order.invoiceGenerated ? "(RE-EDITING)" : ""}</p>
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
                        <td className="border p-3 text-right font-semibold">
                          {item.qty} {item.unit || "Units"} <br/>
                          <span className="text-[10px] text-gray-400">{item.altQty > 0 && `(${item.altQty} ${item.altUnit})`}</span>
                        </td>
                        <td className="border p-3">
                          <div className="flex flex-col items-end">
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
                            <span className="text-[10px] text-blue-600 font-bold mt-1">
                              {item.altQty > 0 && `${(item.altQty * (item.confirmedQty / item.qty)).toFixed(1)} ${item.altUnit}`}
                            </span>
                          </div>
                        </td>
                        <td className="border p-3 text-right text-red-600 font-bold">
                          {item.backOrderQty} {item.unit || "Units"} <br/>
                          <span className="text-[10px] text-red-400 font-normal">
                             {item.altQty > 0 && `(${(item.altQty * (item.backOrderQty / item.qty)).toFixed(1)} ${item.altUnit})`}
                          </span>
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

              {/* Special Discount */}
              <div className="mb-6">
                <label className="block font-semibold mb-2">Special Discount (₹):</label>
                <div className="flex items-center gap-2">
                  <span className="text-xl text-gray-400 font-bold">₹</span>
                  <input
                    type="number"
                    value={commonDiscount}
                    onChange={(e) => setCommonDiscount(e.target.value === "" ? "" : parseFloat(e.target.value))}
                    placeholder="Enter special discount amount..."
                    className="flex-1 p-3 border-2 border-red-200 rounded-lg focus:border-red-500 focus:outline-none font-bold text-red-600 bg-red-50/30"
                    min="0"
                  />
                </div>
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

              {/* Number of Copies */}
              <div className="bg-blue-50 p-4 rounded-lg mt-6">
                <label className="block font-semibold mb-3">Number of Invoice Copies:</label>
                <div className="flex gap-4">
                  {[1, 2, 3].map((num) => (
                    <label key={num} className="flex items-center gap-2 cursor-pointer bg-white px-4 py-2 rounded-lg border hover:border-blue-500 transition">
                      <input
                        type="radio"
                        value={num}
                        checked={numCopies === num}
                        onChange={(e) => setNumCopies(parseInt(e.target.value))}
                        className="w-4 h-4"
                      />
                      <span className="font-bold">{num} Copy{num > 1 ? "ies" : ""}</span>
                    </label>
                  ))}
                </div>
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
                {previewData.commonDiscount > 0 ? (
                  <div className="p-4 bg-orange-50 rounded-lg">
                    <div className="text-sm text-gray-600">Special Discount</div>
                    <div className="text-xl font-bold text-orange-600">
                      -₹{previewData.commonDiscount?.toFixed(2)}
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-purple-50 rounded-lg">
                    <div className="text-sm text-gray-600">Extra Charges</div>
                    <div className="text-xl font-bold text-purple-600">
                      ₹{previewData.extraExpenseAmount?.toFixed(2)}
                    </div>
                  </div>
                )}
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
