import React, { useRef } from "react";
import { FaPrint, FaTimes, FaMapMarkerAlt, FaPhoneAlt, FaDownload } from "react-icons/fa";
import { QRCodeCanvas } from "qrcode.react";

const InvoiceQrModal = ({ invoice, onClose }) => {
  if (!invoice) return null;

  const qrRef = useRef();
  const branch = invoice.branchId || {};
  const logoUrl = branch.logo || "/logo.jpeg";

  const handlePrint = () => {
    const canvas = qrRef.current.querySelector("canvas");
    const qrDataUrl = canvas.toDataURL("image/png");

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Pop-up blocked! Please allow pop-ups to print.");
      return;
    }
    
    const html = `
      <html>
        <head>
          <title>QR Code - ${invoice.invoiceNumber}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
            body { 
              font-family: 'Inter', sans-serif; 
              display: flex; 
              flex-direction: column; 
              align-items: center; 
              justify-content: center; 
              height: 100vh; 
              margin: 0; 
              background: white;
            }
            .container { 
              text-align: center; 
              padding: 40px; 
              border: 1px solid #f1f5f9;
              border-radius: 50px; 
              max-width: 400px;
              background: #fff;
            }
            .header {
              display: flex;
              flex-direction: column;
              align-items: center;
              margin-bottom: 30px;
            }
            .logo {
              width: 70px;
              height: 70px;
              border-radius: 18px;
              margin-bottom: 12px;
              object-fit: contain;
              background: #fff;
            }
            .brand {
              font-size: 22px;
              font-weight: 900;
              letter-spacing: -0.5px;
              color: #0f172a;
              text-transform: uppercase;
            }
            .branch-name {
              font-size: 14px;
              font-weight: 700;
              color: #6366f1;
              margin-top: 2px;
            }
            .branch-address {
              font-size: 10px;
              color: #64748b;
              margin-top: 4px;
              font-weight: 500;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .qr-container {
              padding: 20px;
              background: #f8fafc;
              border-radius: 30px;
              display: inline-block;
              margin: 25px 0;
            }
            .qr-image {
              width: 220px;
              height: 220px;
            }
            .footer-info {
              margin-top: 10px;
            }
            .inv-label {
              font-size: 10px;
              font-weight: 800;
              color: #94a3b8;
              text-transform: uppercase;
              letter-spacing: 2px;
            }
            .inv-value {
              font-size: 18px;
              font-weight: 900;
              color: #1e293b;
            }
            @media print {
              .no-print { display: none; }
              body { margin: 0; }
              .container { border: none; }
            }
          </style>
        </head>
        <body onload="window.print(); setTimeout(() => window.close(), 500);">
          <div class="container">
            <div class="header">
              <img src="${logoUrl}" class="logo" />
              <div class="brand">PEARLS ERP</div>
              <div class="branch-name">${branch.name || 'Main Branch'}</div>
              <div class="branch-address">
                ${branch.address || ''}<br/>
                ${branch.district || ''}, ${branch.state || ''} ${branch.pincode || ''}
              </div>
            </div>

            <div class="qr-container">
              <img src="${qrDataUrl}" class="qr-image" />
            </div>

            <div class="footer-info">
              <div class="inv-label">Invoice Reference</div>
              <div class="inv-value">${invoice.invoiceNumber}</div>
            </div>
          </div>
        </body>
      </html>
    `;
    
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handleDownload = () => {
    const canvas = qrRef.current.querySelector("canvas");
    const link = document.createElement("a");
    link.download = `QR_${invoice.invoiceNumber}.png`;
    link.href = canvas.toDataURL();
    link.click();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[10000] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-[3rem] sm:rounded-[48px] w-full max-w-sm shadow-2xl overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-300 border border-slate-100">
        
        {/* Modal Header */}
        <div className="bg-slate-900 p-6 sm:p-8 flex items-center justify-between text-white">
          <div className="flex items-center gap-4">
             <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <FaPrint className="text-white text-lg sm:text-xl" />
             </div>
             <div>
               <h2 className="text-base sm:text-xl font-black uppercase tracking-tight leading-none">Invoice QR</h2>
               <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1.5 flex items-center gap-2">
                 <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span> Branded Assets
               </p>
             </div>
          </div>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 transition border-0 bg-transparent text-white cursor-pointer">
            <FaTimes />
          </button>
        </div>
        
        <div className="p-6 sm:p-8 flex flex-col items-center">
          
          {/* Branch Logo & Details */}
          <div className="flex flex-col items-center mb-6 sm:mb-8 text-center group">
             <div className="relative mb-4">
                <div className="absolute -inset-2 bg-indigo-500/10 rounded-3xl blur opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative w-20 h-20 sm:w-24 sm:h-24 bg-white rounded-3xl shadow-xl border-4 border-slate-50 flex items-center justify-center p-2 overflow-hidden">
                   <img 
                     src={logoUrl} 
                     alt="Pearls Logo" 
                     className="w-full h-full object-contain" 
                   />
                </div>
             </div>
             <h3 className="text-lg sm:text-xl font-black text-slate-800 uppercase tracking-tight leading-none">{branch.name || 'Pearls Branch'}</h3>
             <div className="flex flex-col gap-1.5 mt-3">
                <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase flex items-center justify-center gap-2 tracking-wide">
                  <FaMapMarkerAlt className="text-indigo-500" /> {branch.district || 'Tirunelveli'}
                </p>
                <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase flex items-center justify-center gap-2 tracking-wide">
                  <FaPhoneAlt className="text-emerald-500" /> {branch.phone || '94296 92970'}
                </p>
             </div>
          </div>

          {/* QR Code with Integrated Logo */}
          <div className="relative group mb-8 sm:mb-10" ref={qrRef}>
            <div className="absolute -inset-8 bg-gradient-to-tr from-indigo-500/10 to-violet-500/10 rounded-full blur-3xl group-hover:scale-110 transition-transform duration-1000"></div>
            <div className="relative bg-white p-4 sm:p-6 rounded-[2.5rem] sm:rounded-[40px] border border-slate-100 shadow-[0_10px_40px_-15px_rgba(0,0,0,0.1)] flex flex-col items-center">
               <div className="hidden sm:block">
                 <QRCodeCanvas
                   value={invoice.invoiceNumber}
                   size={200}
                   level={"H"}
                   includeMargin={false}
                   imageSettings={{
                     src: logoUrl,
                     x: undefined,
                     y: undefined,
                     height: 50,
                     width: 50,
                     excavate: true,
                   }}
                   className="mix-blend-multiply"
                 />
               </div>
               <div className="sm:hidden">
                 <QRCodeCanvas
                   value={invoice.invoiceNumber}
                   size={160}
                   level={"H"}
                   includeMargin={false}
                   imageSettings={{
                     src: logoUrl,
                     x: undefined,
                     y: undefined,
                     height: 40,
                     width: 40,
                     excavate: true,
                   }}
                   className="mix-blend-multiply"
                 />
               </div>
                <div className="mt-4 sm:mt-6 text-center border-t border-slate-50 pt-4 w-full">
                   <p className="text-[9px] font-black text-slate-300 uppercase tracking-[0.3em] mb-1">
                      {invoice.isBulk ? "Bulk Reference" : "Invoice Reference"}
                   </p>
                   <p className="text-xs sm:text-sm font-black text-slate-800 tracking-tighter truncate max-w-full px-4">
                      {invoice.invoiceNumber}
                   </p>
                </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="w-full grid grid-cols-1 gap-3 pb-6 sm:pb-0">
            <button
              onClick={handlePrint}
              className="w-full py-4 sm:py-5 bg-indigo-600 text-white rounded-[2rem] font-black uppercase tracking-widest text-[10px] sm:text-[11px] flex items-center justify-center gap-3 hover:bg-indigo-700 transition shadow-2xl shadow-indigo-200 active:scale-95 group"
            >
              <FaPrint size={14} className="group-hover:rotate-12 transition-transform" /> Print Branded QR
            </button>
            <div className="grid grid-cols-2 gap-3">
               <button
                 onClick={handleDownload}
                 className="py-3 sm:py-4 bg-slate-50 text-slate-600 rounded-2xl font-black uppercase tracking-widest text-[9px] hover:bg-slate-100 transition flex items-center justify-center gap-2"
               >
                 <FaDownload /> Image
               </button>
               <button
                 onClick={onClose}
                 className="py-3 sm:py-4 bg-white border border-slate-100 text-slate-400 rounded-2xl font-black uppercase tracking-widest text-[9px] hover:bg-slate-50 transition"
               >
                 Dismiss
               </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvoiceQrModal;
