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
    // Direct Base64 Image from GSTZen
    qrImage = invoice.signedQrCodeImgUrl.startsWith('data:image') 
      ? invoice.signedQrCodeImgUrl 
      : `data:image/png;base64,${invoice.signedQrCodeImgUrl}`;
  } else if (invoice.signedQrCode) {
    // Fallback: Generate QR from Signed Tax String
    qrImage = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(invoice.signedQrCode)}`;
  }

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
        .qr-section { width: 40mm; text-align: right; }
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
    const ackDate = invoice.ackDate ? new Date(invoice.ackDate).toLocaleString() : "N/A";
    
    let html = `<!DOCTYPE html><html><head><meta charset="UTF-8">${style}</head><body>`;

    // FIRST PAGE - TAX INVOICE
    html += `
      <div class="page">
        <div class="header">
          <div class="company-info">
            <h1 class="company-name">${invoice.seller?.name || "PEARL AGENCY"}</h1>
            <div class="company-details">
              ${invoice.seller?.address || "Address Not Provided"} <br/>
              GSTIN: <strong>${invoice.seller?.gstin || "N/A"}</strong> | Mobile: ${invoice.seller?.phone || "N/A"} <br/>
              State: ${invoice.seller?.state || "Tamil Nadu"} (Code: ${invoice.seller?.stateCode || "33"})
            </div>
            
            <div style="margin-top: 4mm; display: flex; gap: 8mm;">
              <div>
                <span class="meta-label">Bill To</span>
                <div class="meta-value" style="font-size: 13px;">${invoice.customer?.name}</div>
                <div class="company-details">
                  ${invoice.customer?.address} <br/>
                  GSTIN: <strong>${invoice.customer?.gstin || "URP"}</strong> | Pos: ${invoice.customer?.stateCode || "33"}
                </div>
              </div>
              <div style="text-align: right; flex: 1;">
                 <span class="meta-label">Invoice Details</span>
                 <div class="meta-value"># ${invoice.invoiceNumber}</div>
                 <div class="meta-value" style="font-size: 11px;">Date: ${new Date(invoice.invoiceDate).toLocaleDateString()}</div>
              </div>
            </div>
          </div>
          
          <div class="qr-section">
            ${qrImage ? `<img src="${qrImage}" class="qr-code" alt="E-Invoice QR" />` : `<div class="qr-code" style="display:flex;align-items:center;justify-content:center;color:#ccc;font-size:8px;">[ QR CODE EMPTY ]</div>`}
            <div style="font-size: 8px; font-weight: bold; margin-top: 1mm; text-align: center;">E-INVOICE SIGNED</div>
          </div>
        </div>

        <div class="invoice-title">TAX INVOICE</div>

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
            ${invoice.items.map((item, idx) => `
              <tr>
                <td class="text-center">${idx + 1}</td>
                <td style="font-weight: bold;">${item.name}</td>
                <td class="text-center">${item.hsn || "-"}</td>
                <td class="text-right">${item.qty} ${item.unit} ${item.altQty > 0 ? `(${item.altQty} ${item.altUnit})` : ""}</td>
                <td class="text-right">₹${item.sellingPrice?.toFixed(2)}</td>
                <td class="text-center">${item.gst}%</td>
                <td class="text-right font-bold">₹${item.total?.toFixed(2)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>

        <div style="display: flex; gap: 10mm; margin-bottom: 20mm;">
           <div style="flex: 1;">
              <div style="font-size: 10px; border: 1px solid #e2e8f0; padding: 3mm; border-radius: 4px; background: #fffbeb;">
                <strong>Remarks / Notes:</strong><br/>
                <span id="amountWords" style="text-transform: capitalize;">${invoice.invoiceNotes || "N/A"}</span>
              </div>
           </div>
           <div class="totals-section">
              <table class="totals-table">
                <tr>
                  <td>Taxable Value:</td>
                  <td class="text-right">₹${invoice.subtotal?.toFixed(2)}</td>
                </tr>
                <tr>
                  <td>CGST:</td>
                  <td class="text-right">₹${(invoice.totalTax?.cgst || 0).toFixed(2)}</td>
                </tr>
                <tr>
                  <td>SGST:</td>
                  <td class="text-right">₹${(invoice.totalTax?.sgst || 0).toFixed(2)}</td>
                </tr>
                ${invoice.totalTax?.igst > 0 ? `<tr><td>IGST:</td><td class="text-right">₹${invoice.totalTax.igst.toFixed(2)}</td></tr>` : ""}
                ${invoice.transportCharge > 0 ? `<tr><td>Transport:</td><td class="text-right">₹${invoice.transportCharge.toFixed(2)}</td></tr>` : ""}
                <tr class="grand-total">
                  <td>Grand Total:</td>
                  <td class="text-right">₹${invoice.grandTotal?.toFixed(2)}</td>
                </tr>
              </table>
              
              <div style="margin-top: 10mm; text-align: center;">
                 <div style="font-size: 10px; font-weight: 800; color: #1e293b; margin-bottom: 12mm;">For ${invoice.seller?.name || "PEARL AGENCY"}</div>
                 <div style="border-top: 1px solid #000; display: inline-block; padding-top: 1mm; width: 40mm; font-size: 9px; font-weight: 700;">Authorized Signature</div>
              </div>
           </div>
        </div>

        <div class="certification">This is a system generated e-invoice authorized by Govt of India GST Tax Portal. No physical signature is required.</div>
        <div class="footer">Powered by PEARL ERP | ${invoice.seller?.name} | Generated on ${new Date().toLocaleString()}</div>
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
              <h2 className="text-xl font-black uppercase tracking-tight text-white mb-0">TAX INVOICE Preview</h2>
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
                <div>
                  <div className="text-2xl font-black text-gray-800 uppercase tracking-tighter">{invoice.seller?.name || "PEARL AGENCY"}</div>
                  <div className="text-xs text-gray-500 font-bold mt-1 max-w-xs">{invoice.seller?.address}</div>
                </div>
                
                <div className="w-24 h-24 bg-gray-50 border border-gray-100 rounded-lg flex items-center justify-center overflow-hidden">
                  {qrImage ? (
                    <img src={qrImage} className="w-full h-full object-contain p-1" alt="Preview QR" />
                  ) : (
                    <div className="text-[10px] text-gray-300 font-bold text-center p-2 underline decoration-red-500 decoration-2">
                       [ QR MISSING ]
                    </div>
                  )}
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
                    <div className="text-gray-500 font-black tracking-tighter">{invoice.ackDate ? new Date(invoice.ackDate).toLocaleDateString() : ""}</div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="h-4 bg-gray-100 rounded w-full"></div>
                <div className="h-4 bg-gray-50 rounded w-3/4"></div>
                <div className="h-4 bg-gray-100 rounded w-full"></div>
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
            PRINT TAX INVOICE
          </button>
        </div>
      </div>
    </div>
  );
};

export default EInvoicePrintModal;
