import { FaPrint, FaTimes, FaSpinner, FaDownload } from "react-icons/fa";
import { useState } from "react";

const EInvoicePrintModal = ({ invoice, onClose }) => {
  const [loading] = useState(false);

  if (!invoice) return null;

  // 🛡️ MULTI-LEVEL QR FETCHING LOGIC
  let qrImage = "";
  if (invoice.qrCodeUrl) {
    qrImage = invoice.qrCodeUrl.startsWith('http') ? invoice.qrCodeUrl : `https://my.gstzen.in${invoice.qrCodeUrl}`;
  } else if (invoice.signedQrCodeImgUrl) {
    qrImage = invoice.signedQrCodeImgUrl.startsWith('data:image') 
      ? invoice.signedQrCodeImgUrl 
      : `data:image/png;base64,${invoice.signedQrCodeImgUrl}`;
  } else if (invoice.signedQrCode) {
    qrImage = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(invoice.signedQrCode)}`;
  }

  // 📦 INTERNAL TRACKING QR (For warehouse scanning)
  const trackingData = invoice.isBulk ? invoice.invoiceNumber : (invoice.invoiceNumber || invoice.creditNoteId || "N/A");
  const trackingQr = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(trackingData)}`;

  // 🏪 ROBUST SELLER DATA (Fallback to BranchId if Seller Snapshot is missing)
  const seller = {
    name: invoice.seller?.name || invoice.branchId?.name || "PEARL AGENCY",
    address: invoice.seller?.address || invoice.branchId?.address || "Address Not Provided",
    gstin: invoice.seller?.gstin || invoice.branchId?.gstin || "N/A",
    phone: invoice.seller?.phone || invoice.branchId?.phone || "N/A",
    gpayNo: invoice.seller?.gpayNo || invoice.seller?.upiId || invoice.branchId?.gpayNo || invoice.branchId?.upiId || "",
    state: invoice.seller?.state || invoice.branchId?.state || "Tamil Nadu",
    stateCode: invoice.seller?.stateCode || invoice.branchId?.stateCode || "33",
  };

  // Print function
  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Pop-up blocked! Please allow pop-ups to print.");
      return;
    }
    printWindow.document.write(getEInvoiceHTML());
    printWindow.document.close();
    setTimeout(() => {
      if (printWindow) printWindow.print();
    }, 500);
  };

  const formatBalance = (val) => {
    const absVal = Math.abs(val).toLocaleString(undefined, { minimumFractionDigits: 2 });
    const label = val >= 0 ? "Dr" : "Cr";
    return `₹${absVal} ${label}`;
  };

  const getEInvoiceHTML = () => {
    const style = `
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Inter', sans-serif; line-height: 1.4; color: #1e293b; background: white; }
        .page { 
          width: 210mm; 
          min-height: 297mm; 
          padding: 10mm; 
          margin: 0 auto; 
          background: white;
          position: relative;
          page-break-after: always;
        }
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 5mm; border-bottom: 2px solid #334155; padding-bottom: 4mm; }
        .company-info { flex: 1; }
        .company-name { font-size: 20px; font-weight: 900; color: #0f172a; text-transform: uppercase; letter-spacing: -0.5px; }
        .company-details { font-size: 11px; color: #475569; margin-top: 2px; }
        .qr-section { width: 45mm; text-align: right; }
        .qr-code { width: 35mm; height: 35mm; object-fit: contain; border: 1px solid #e2e8f0; padding: 2px; }

        .invoice-title { 
          text-align: center; 
          font-size: 16px; 
          font-weight: 900; 
          padding: 2mm; 
          background: #f1f5f9; 
          border: 1px solid #cbd5e1; 
          margin-bottom: 5mm;
          letter-spacing: 2px;
          color: #1e293b;
        }

        .meta-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 5mm; margin-bottom: 5mm; font-size: 11px; }
        .meta-box { border: 1px solid #e2e8f0; padding: 3mm; border-radius: 4px; }
        .meta-label { font-weight: 700; color: #64748b; font-[10px]; text-transform: uppercase; margin-bottom: 1mm; display: block; }
        .meta-value { font-weight: 800; color: #0f172a; }

        .irn-box { 
          grid-column: span 2; 
          background: #f8fafc; 
          border: 1px dashed #cbd5e1; 
          padding: 3mm; 
          font-family: monospace; 
          font-size: 10px; 
          word-break: break-all;
          line-height: 1.2;
        }

        table { width: 100%; border-collapse: collapse; margin-bottom: 5mm; font-size: 11px; table-layout: fixed; }
        th { background: #334155; color: white; padding: 2.5mm 1.5mm; text-align: left; font-weight: 700; border: 1px solid #1e293b; }
        td { border: 1px solid #cbd5e1; padding: 2mm 1.5mm; vertical-align: top; }
        .text-right { text-align: right; }
        .text-center { text-align: center; }

        .totals-section { display: flex; justify-content: flex-end; margin-top: 5mm; }
        .totals-table { width: 70mm; border: none; }
        .totals-table td { border: none; padding: 1mm 0; }
        .grand-total { font-size: 16px; font-weight: 900; color: #0f172a; border-top: 2px double #334155 !important; padding-top: 2mm !important; }

        .certification { font-size: 9px; color: #64748b; font-style: italic; margin-top: 10mm; text-align: center; }
        .footer { position: absolute; bottom: 10mm; left: 10mm; right: 10mm; text-align: center; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 2mm; }

        @media print { 
          body { background: white; }
          .page { padding: 0; margin: 0; height: auto; width: 100%; }
        }
      </style>
    `;

    const irn = invoice.irn || "N/A";
    const ackNo = invoice.ackNo || "N/A";
    const ackDate = invoice.ackDate ? new Date(invoice.ackDate).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : "N/A";

    
    let html = `<!DOCTYPE html><html><head><meta charset="UTF-8">${style}</head><body>`;

    // FIRST PAGE - TAX INVOICE
    html += `
      <div class="page">
        <div class="header">
          <div class="company-info">
            <div style="display: flex; align-items: flex-start; gap: 6mm; margin-bottom: 2mm;">
              <div style="flex: 1;">
                <h1 class="company-name" style="margin: 0; line-height: 1.2;">${seller.name}</h1>
                <div class="company-details" style="margin-top: 2mm;">
                  ${seller.address} <br/>
                  GSTIN: <strong>${seller.gstin}</strong> | Mobile: ${seller.phone}${seller.gpayNo ? ` | GPay: ${seller.gpayNo}` : ""} <br/>
                  State: ${seller.state} (Code: ${seller.stateCode})
                </div>
              </div>
              <div style="text-align: center; flex-shrink: 0; margin-top: 1mm;">
                <img src="${trackingQr}" style="width: 20mm; height: 20mm; border: 2px solid #0f172a; padding: 1mm; background: white;" alt="Delivery QR" />
                <div style="font-size: 7px; font-weight: 900; text-transform: uppercase; margin-top: 2px; color: #0f172a;">Delivery QR</div>
              </div>
            </div>
            
            <div style="margin-top: 4mm; display: flex; gap: 8mm;">
              <div>
                <span class="meta-label">Bill To</span>
                <div class="meta-value" style="font-size: 13px;">${invoice.customer?.name}</div>
                <div class="company-details">
                  ${invoice.customer?.address || "Address Not Provided"} <br/>
                  ${invoice.customer?.district ? `${invoice.customer.district}, ` : ""}${invoice.customer?.state || "Tamil Nadu"} ${invoice.customer?.pincode || ""} <br/>
                  GSTIN: <strong>${invoice.customer?.gstin || "URP"}</strong> | Pos: ${invoice.customer?.stateCode || "33"}
                </div>
              </div>
            </div>
          </div>
          
          <div class="qr-section" style="width: 45mm;">
            <div style="display: flex; align-items: center; justify-content: flex-end;">
              ${qrImage ? `
                <div style="text-align: center;">
                  <img src="${qrImage}" class="qr-code" style="width: 25mm; height: 25mm;" alt="E-Invoice QR" />
                  <div style="font-size: 7px; font-weight: 800; text-transform: uppercase; margin-top: 1mm;">E-Invoice</div>
                </div>
              ` : ""}
            </div>
            
            <div style="margin-top: 3mm; text-align: right; border-top: 1px solid #e2e8f0; padding-top: 2mm;">
               <div style="font-size: 13px; font-weight: 900; color: #0f172a;">${invoice.invoiceNumber || invoice.creditNoteId}</div>
               <div style="font-size: 10px; font-weight: 700; color: #475569;">Date: ${new Date(invoice.invoiceDate || invoice.date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })}</div>
            </div>
          </div>
        </div>

        <div class="invoice-title">${invoice.creditNoteId ? "CREDIT NOTE" : "TAX INVOICE"}</div>

        <div class="meta-grid">
          <div class="meta-box">
             <span class="meta-label">Acknowledgement Number</span>
             <div class="meta-value">${ackNo}</div>
          </div>
          <div class="meta-box">
             <span class="meta-label">Acknowledgement Date</span>
             <div class="meta-value">${ackDate}</div>
          </div>
          <div class="irn-box">
             <span class="meta-label">Invoice Reference Number (IRN)</span>
             <div style="color: #0f172a; font-weight: bold;">${irn}</div>
          </div>
        </div>

        <table style="border-top: 2px solid #334155;">
          <thead>
            <tr>
              <th style="width: 5%;">#</th>
              <th style="width: 40%;">Product Name</th>
              <th style="width: 10%;">HSN</th>
              <th style="width: 15%;" class="text-right">Qty</th>
              <th style="width: 10%;" class="text-right">Rate</th>
              <th style="width: 5%;" class="text-center">GST</th>
              <th style="width: 15%;" class="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
             ${invoice.items
               .filter(item => item.qty > 0) // 🔥 Do not print zero value products
               .map((item, idx) => {
               const qtyDisplay = `${item.qty} ${item.unit || "NOS"}`;
               const rate = item.sellingPrice || 0;
               const total = item.total || 0;
               return `
                 <tr>
                   <td class="text-center">${idx + 1}</td>
                   <td style="font-weight: bold;">${item.name}</td>
                   <td class="text-center">${item.hsn || item.productId?.hsnCode || "-"}</td>
                   <td class="text-right">${qtyDisplay} ${item.altQty > 0 ? `(${item.altQty} ${item.altUnit})` : ""}</td>
                   <td class="text-right">₹${rate.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                   <td class="text-center">${item.gst || 0}%</td>
                   <td class="text-right font-bold">₹${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                 </tr>
               `;
             }).join("")}
          </tbody>
        </table>

        <div style="display: flex; gap: 10mm; margin-bottom: 20mm;">
           <div style="flex: 1;">
              <div style="font-size: 10px; border: 1px solid #e2e8f0; padding: 3mm; border-radius: 4px; background: #fffbeb; margin-bottom: 3mm;">
                <strong>Remarks / Notes:</strong><br/>
                <span id="amountWords" style="text-transform: capitalize;">${invoice.invoiceNotes || "N/A"}</span>
              </div>
              <div style="display: flex; gap: 5mm; align-items: center;">
                 <div style="background: #f8fafc; border-left: 4px solid #334155; padding: 2mm 4mm; border-radius: 4px; flex: 1;">
                    <span style="font-size: 8px; font-weight: 800; color: #64748b; text-transform: uppercase; display: block;">Previous Balance</span>
                    <span style="font-size: 12px; font-weight: 900; color: #0f172a;">${formatBalance(invoice.openingBalance || 0)}</span>
                 </div>
                 <div style="background: #f1f5f9; border-left: 4px solid #0f172a; padding: 2mm 4mm; border-radius: 4px; flex: 1;">
                    <span style="font-size: 8px; font-weight: 800; color: #64748b; text-transform: uppercase; display: block;">Closing Balance</span>
                    <span style="font-size: 12px; font-weight: 900; color: #0f172a;">${formatBalance(invoice.closingBalance || 0)}</span>
                 </div>
                 ${seller.gpayNo ? `
                   <div style="text-align: center; margin-left: 2mm;">
                      <img src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(`upi://pay?pa=${seller.gpayNo}&pn=${seller.name}&cu=INR`)}" style="width: 15mm; height: 15mm; border: 1px solid #e2e8f0; padding: 1mm; border-radius: 4px;" alt="GPay QR" />
                      <div style="font-size: 6px; font-weight: 800; color: #475569; margin-top: 1px;">GPAY: ${seller.gpayNo}</div>
                   </div>
                 ` : ""}
              </div>
           </div>
           <div class="totals-section">
              <table class="totals-table">
                <tr>
                  <td>Taxable Value:</td>
                  <td class="text-right">₹${(invoice.subtotal || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                </tr>
                <tr>
                  <td>CGST:</td>
                  <td class="text-right">₹${(typeof invoice.totalTax === 'object' ? (invoice.totalTax?.cgst || 0) : (invoice.totalTax || 0) / 2).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                </tr>
                <tr>
                  <td>SGST:</td>
                  <td class="text-right">₹${(typeof invoice.totalTax === 'object' ? (invoice.totalTax?.sgst || 0) : (invoice.totalTax || 0) / 2).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                </tr>
                ${invoice.totalTax?.igst > 0 ? `<tr><td>IGST:</td><td class="text-right">₹${invoice.totalTax.igst.toFixed(2)}</td></tr>` : ""}
                ${(invoice.commonDiscount || invoice.invoiceCommonDiscount) > 0 ? `<tr><td style="color: #dc2626; font-weight: bold;">Discount:</td><td class="text-right" style="color: #dc2626; font-weight: bold;">-₹${((invoice.commonDiscount || invoice.invoiceCommonDiscount) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td></tr>` : ""}
                ${invoice.transportCharge > 0 ? `<tr><td>Transport:</td><td class="text-right">₹${invoice.transportCharge.toFixed(2)}</td></tr>` : ""}
                <tr class="grand-total">
                  <td>Grand Total:</td>
                  <td class="text-right">₹${invoice.grandTotal?.toFixed(2)}</td>
                </tr>
              </table>
              
              <div style="margin-top: 10mm; text-align: center;">
                 <div style="font-size: 10px; font-weight: 800; color: #1e293b; margin-bottom: 12mm;">For ${seller.name}</div>
                 <div style="border-top: 1px solid #000; display: inline-block; padding-top: 1mm; width: 40mm; font-size: 9px; font-weight: 700;">Authorized Signature</div>
              </div>
           </div>
        </div>

        <div class="certification">This is a system generated e-invoice authorized by Govt of India GST Tax Portal. No physical signature is required.</div>
        <div class="footer">Powered by PEARL ERP | ${seller.name} | Generated on ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>

      </div>
    `;

    html += "</body></html>";
    return html;
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-6 flex items-center justify-between text-white">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center text-white">
              <FaDownload size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight text-white mb-0">${invoice.creditNoteId ? "CREDIT NOTE" : "TAX INVOICE"} Preview</h2>
              <p className="text-[10px] opacity-70 font-bold uppercase tracking-widest m-0">Standardized E-Invoice Format</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 transition text-white border-0 bg-transparent"
          >
            <FaTimes />
          </button>
        </div>

        <div className="p-12 overflow-y-auto max-h-[70vh] bg-slate-50 flex flex-col items-center gap-8 text-slate-800">
           <div className="bg-white shadow-xl rounded-lg p-8 w-full max-w-[210mm] border border-gray-100 transform origin-top scale-[0.85]">
              <div className="flex justify-between items-start border-b-2 pb-4 mb-4">
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div className="flex-1">
                      <div className="text-2xl font-black text-gray-800 uppercase tracking-tighter leading-tight">{seller.name}</div>
                      <div className="text-xs text-gray-500 font-bold mt-1 max-w-xs">{seller.address}</div>
                    </div>
                    <div className="w-20 h-20 bg-white border-2 border-slate-900 rounded-lg flex flex-col items-center justify-center overflow-hidden p-1 shrink-0 shadow-sm">
                      <img src={trackingQr} className="w-full h-full object-contain" alt="Internal QR" />
                      <span className="text-[6px] font-black uppercase text-slate-900 mt-1 tracking-tighter">Delivery QR</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    {qrImage && (
                      <div className="w-20 h-20 bg-gray-50 border border-gray-100 rounded-lg flex flex-col items-center justify-center overflow-hidden p-1">
                        <img src={qrImage} className="w-full h-full object-contain" alt="E-Inv QR" />
                        <span className="text-[6px] font-black uppercase text-gray-400 mt-0.5">E-Invoice</span>
                      </div>
                    )}
                  </div>
                  <div className="text-right bg-gray-50 px-4 py-2 rounded-xl border border-gray-100">
                     <span className="text-[12px] font-black text-slate-800 tracking-tight block">{invoice.invoiceNumber || invoice.creditNoteId}</span>
                     <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Date: {new Date(invoice.invoiceDate || invoice.date).toLocaleDateString('en-IN')}</span>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 mb-6">
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="text-left font-bold">
                    <span className="text-gray-400 block font-bold uppercase tracking-widest text-[9px]">IRN (Tax Portal Hash)</span>
                    <div className="font-mono text-[9px] break-all leading-tight mt-1">{invoice.irn || "IRN PENDING"}</div>
                  </div>
                  <div className="text-right">
                    <span className="text-gray-400 block font-bold uppercase tracking-widest text-[9px]">Ack Details</span>
                    <div className="font-bold text-gray-800">{invoice.ackNo || "N/A"}</div>
                    <div className="text-gray-500 font-black tracking-tighter">{invoice.ackDate ? new Date(invoice.ackDate).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : ""}</div>

                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="bg-amber-50/50 border border-amber-100 p-3 rounded-lg">
                  <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest block mb-1">Remarks / Notes</span>
                  <p className="text-xs font-bold text-amber-900">{invoice.invoiceNotes || "N/A"}</p>
                </div>
                
                <div className="flex gap-3 items-center">
                   <div className="bg-slate-50 border-l-4 border-slate-400 p-3 rounded-r-lg flex-1">
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Previous Balance</span>
                      <span className="text-xs font-black text-slate-700">{formatBalance(invoice.openingBalance || 0)}</span>
                   </div>
                   <div className="bg-indigo-50 border-l-4 border-indigo-600 p-3 rounded-r-lg flex-1">
                      <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest block mb-0.5">Closing Balance</span>
                      <span className="text-xs font-black text-indigo-900">{formatBalance(invoice.closingBalance || 0)}</span>
                   </div>
                   {seller.gpayNo && (
                      <div className="flex flex-col items-center gap-1 pl-2">
                        <img 
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(`upi://pay?pa=${seller.gpayNo}&pn=${seller.name}&cu=INR`)}`} 
                          className="w-10 h-10 border border-gray-100 p-1 rounded" 
                          alt="GPay QR" 
                        />
                        <span className="text-[6px] font-black text-gray-400 uppercase">GPAY</span>
                      </div>
                   )}
                </div>
              </div>
           </div>
           
           <div className="text-center max-w-md">
             <h3 className="text-xl font-black text-slate-800 mb-2">Invoice Data Captured</h3>
             <p className="text-gray-500 text-sm font-medium">The document is now branded as "TAX INVOICE" and includes the required IRS data, QR code, and Authorized Signature block.</p>
           </div>
        </div>

        <div className="bg-white p-8 border-t border-slate-100 flex items-center justify-center gap-4">
          <button
            onClick={onClose}
            className="px-8 py-3 rounded-xl border border-gray-200 bg-white text-gray-500 font-black text-sm hover:bg-gray-50 transition shadow-sm"
          >
            CANCEL
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-3 bg-[#319bab] text-white border-0 px-10 py-4 rounded-2xl hover:bg-slate-800 transition-all font-black text-sm shadow-[#319bab]/20 shadow-xl scale-110 cursor-pointer"
          >
            {loading ? <FaSpinner className="animate-spin" /> : <FaPrint />}
            PRINT ${invoice.creditNoteId ? "CREDIT NOTE" : "TAX INVOICE"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EInvoicePrintModal;
