/**
 * 🧾 SHARED INVOICE TEMPLATE UTILITY
 * This provides the HTML structure for printing invoices directly.
 * Updated to follow the "1 copy = 2 pages" rule (Order Details + HSN Details).
 */

export const getInvoiceHTML = (previewData, numCopies = 2, order = {}, generatedInvoice = {}, mode = 'INVOICE') => {
    const isCNProf = mode === 'CREDIT_NOTE_PROFESSIONAL';
    const isCNStd = mode === 'CREDIT_NOTE';
    const isDNProf = mode === 'DEBIT_NOTE_PROFESSIONAL';
    const isDNStd = mode === 'DEBIT_NOTE';
    
    const isCN = isCNProf || isCNStd;
    const isDN = isDNProf || isDNStd;
    const isReturn = isCN || isDN;
    const isProf = isCNProf || isDNProf;
    
    const documentTitle = isDN ? "PURCHASE RETURN / DEBIT NOTE" : (isCN ? "SALES RETURN / CREDIT NOTE" : "TAX INVOICE");
    const idLabel = isDN ? "Debit Note ID" : (isCN ? "Credit Note ID" : "Invoice No");
    const dateLabel = isReturn ? "Note Date" : "Invoice Date";
    
    // 🧮 Robust Tax Breakdown Helper
    const tax = (() => {
        if (typeof previewData?.totalTax === 'object' && previewData?.totalTax !== null) {
            return {
                cgst: previewData.totalTax.cgst || 0,
                sgst: previewData.totalTax.sgst || 0,
                igst: previewData.totalTax.igst || 0,
                total: previewData.totalTax.total || 0
            };
        }
        // Fallback for Credit Notes (Sum from items)
        const breakdown = { cgst: 0, sgst: 0, igst: 0, total: Number(previewData?.totalTax || 0) };
        (previewData?.items || []).forEach(item => {
            const qty = isDN ? (item.returnedQty || item.qty || 0) : (item.qty || 0);
            const price = isDN ? (item.purchasePrice || 0) : (item.sellingPrice || 0);
            
            // Check for explicit cgst/sgst fields or calculate from total tax
            const itemTax = Number(item.cgst !== undefined ? (item.cgst + item.sgst + (item.igst || 0)) : (item.tax || (item.total - (price * qty)) || 0));
            
            if (item.cgst !== undefined) {
                breakdown.cgst += Number(item.cgst || 0);
                breakdown.sgst += Number(item.sgst || 0);
                breakdown.igst += Number(item.igst || 0);
            } else if (itemTax > 0) {
                // If breakdown is missing but total item tax exists, assume 50/50 for CGST/SGST if not IGST
                if (item.igst_amount > 0 || item.igst > 0) {
                    breakdown.igst += itemTax;
                } else {
                    breakdown.cgst += itemTax / 2;
                    breakdown.sgst += itemTax / 2;
                }
            }
        });
        // If total is missing but breakdown is there
        if (!breakdown.total) breakdown.total = breakdown.cgst + breakdown.sgst + breakdown.igst;
        return breakdown;
    })();

    const style = `
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.4; color: #000; background: #fff; }
        .page { width: 210mm; min-height: 297mm; padding: 10mm; margin: 0 auto; page-break-after: always; background: white; }
        .page-content { width: 100%; }
        
        /* Layout Styles */
        .header-section { text-align: center; margin-bottom: 15px; position: relative; }
        .header-section h1 { font-size: 22px; font-weight: 900; text-decoration: underline; margin-bottom: 10px; }
        .cn-id-top { position: absolute; right: 0; top: 0; font-size: 18px; font-weight: 900; }
        
        .top-grid { display: flex; justify-content: space-between; gap: 20px; margin-bottom: 15px; align-items: flex-start; }
        .seller-info { flex: 1.5; font-size: 11px; }
        .seller-name { font-size: 14px; font-weight: 900; text-transform: uppercase; margin-bottom: 2px; }
        
        .info-box { flex: 1; border: 1px solid #000; padding: 10px; border-radius: 4px; font-size: 10px; }
        .net-amount-box { text-align: right; border-bottom: 1px solid #000; padding-bottom: 5px; margin-bottom: 8px; }
        .net-amount-label { font-size: 14px; font-weight: bold; margin-right: 10px; }
        .net-amount-val { font-size: 18px; font-weight: 900; }
        .info-row { display: flex; justify-content: flex-end; gap: 10px; margin-bottom: 3px; }
        .info-label { font-weight: bold; width: 100px; text-align: right; }
        .info-val { width: 120px; text-align: right; }
        .status-badge { background: #10b981; color: white; padding: 1px 6px; border-radius: 3px; font-weight: 900; font-size: 9px; text-transform: uppercase; }

        .bill-to { border: 1px solid #000; padding: 10px; border-radius: 4px; margin-bottom: 15px; font-size: 10px; background: #fff; }
        .bill-to-title { font-weight: 900; text-decoration: underline; margin-bottom: 4px; font-size: 11px; }
        
        table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
        th { border: 1px solid #000; padding: 4px; font-size: 9px; font-weight: 900; text-transform: uppercase; background: #f9fafb; text-align: center; }
        td { border: 1px solid #000; padding: 4px; font-size: 10px; vertical-align: middle; }
        
        .totals-section { display: flex; justify-content: flex-end; margin-top: 10px; }
        .totals-table { width: 300px; }
        .totals-table td { border: none; padding: 2px 0; text-align: right; font-size: 11px; }
        .totals-table .label { text-align: right; font-weight: bold; padding-right: 15px; text-transform: uppercase; }
        .totals-table .val { width: 100px; font-weight: 900; }
        .grand-total-row { border-top: 2px solid #000 !important; margin-top: 5px; padding-top: 5px; }

        .footer-grid { display: flex; justify-content: space-between; margin-top: 20px; font-size: 10px; }
        .bank-details { border: 1px solid #000; padding: 8px; border-radius: 4px; width: 250px; }
        .declaration { font-size: 9px; max-width: 500px; margin-top: 10px; }
        .signature-box { text-align: right; margin-top: 20px; }
        .signature-line { border-top: 1px solid #000; width: 180px; margin-top: 40px; display: inline-block; text-align: center; font-weight: bold; }

        @media print { 
          .page { margin: 0; padding: 10mm; } 
          @page { size: ${isProf ? 'A5 portrait' : 'A4 portrait'}; margin: 0; }
        }

        /* --- A5 OVERRIDES --- */
        .page.a5-page { width: 148mm; min-height: 210mm; padding: 5mm; font-size: 9px; line-height: 1.2; }
        .a5-page .header-section h1 { font-size: 16px; margin-bottom: 5px; }
        .a5-page .cn-id-top { font-size: 12px; }
        .a5-page .top-grid { margin-bottom: 8px; gap: 10px; }
        .a5-page .seller-info { font-size: 9px; }
        .a5-page .seller-name { font-size: 12px; }
        .a5-page .info-box { padding: 5px; font-size: 8px; }
        .a5-page .net-amount-label { font-size: 10px; }
        .a5-page .net-amount-val { font-size: 14px; }
        .a5-page .info-row { gap: 5px; margin-bottom: 2px; }
        .a5-page .info-label { width: 80px; }
        .a5-page .info-val { width: 100px; }
        .a5-page .bill-to { padding: 5px; font-size: 9px; margin-bottom: 8px; }
        .a5-page .bill-to-title { font-size: 10px; margin-bottom: 2px; }
        .a5-page table { margin-bottom: 5px; }
        .a5-page th { padding: 2px; font-size: 8px; }
        .a5-page td { padding: 2px; font-size: 8px; }
        .a5-page .totals-table { width: 220px; }
        .a5-page .totals-table td { font-size: 9px; padding: 1px 0; }
        .a5-page .grand-total-row .label { font-size: 10px !important; }
        .a5-page .grand-total-row .val { font-size: 12px !important; }
        .a5-page .footer-grid { margin-top: 10px; }
        .a5-page .bank-details { padding: 5px; width: 180px; font-size: 8px; }
        .a5-page .declaration { font-size: 8px; margin-top: 5px; }
        .a5-page .signature-box { margin-top: 10px; }
        .a5-page .signature-line { margin-top: 20px; width: 120px; font-size: 8px; }
        .a5-page .cn-footer { font-size: 9px; display: flex; justify-content: space-between; align-items: flex-end; margin-top: 10px; }

        /* --- STANDARD LAYOUT STYLES --- */
        .quick-info { text-align: left; font-size: 10px; margin-bottom: 5px; }
        .top-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 15px; border-bottom: 2px solid #000; padding-bottom: 10px; }
        .logo-box img { max-height: 80px; width: auto; object-fit: contain; }
        .company-header { flex: 1; text-align: center; padding: 0 20px; }
        .company-name { font-size: 24px; font-weight: 900; text-transform: uppercase; line-height: 1; margin-bottom: 5px; }
        .company-address { font-size: 11px; line-height: 1.3; }
        .upi-qr-box { text-align: center; min-width: 80px; }
        .upi-qr-label { font-size: 8px; font-weight: bold; margin-top: 2px; text-transform: uppercase; }
        
        .section-title { background: #000; color: #fff; padding: 6px; text-align: center; font-weight: 900; margin-bottom: 15px; font-size: 12px; letter-spacing: 1px; }
        
        .order-header { display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 15px; }
        .order-header-col { flex: 1; line-height: 1.5; }
        
        .sender-buyer { display: flex; gap: 0; margin-bottom: 15px; border: 1px solid #000; }
        .sender-buyer-col { flex: 1; padding: 8px; font-size: 11px; line-height: 1.4; }
        .sender-buyer-col:first-child { border-right: 1px solid #000; }
        
        .total-section { margin-top: 15px; font-size: 12px; }
        .grand-total { font-size: 18px; font-weight: 900; margin-top: 5px; border-top: 2px solid #000; padding-top: 5px; }
        
        .copy-label { text-align: center; font-size: 10px; font-weight: bold; color: #666; margin-top: 30px; text-transform: uppercase; border-top: 1px dashed #ccc; padding-top: 10px; }
      </style>
    `;

    let html = `<!DOCTYPE html><html><head><title>${documentTitle}</title><meta charset="UTF-8">${style}</head><body>`;

    const baseTitles = isCN 
      ? ["ORIGINAL COPY", "OFFICE COPY"] 
      : ["ORIGINAL INVOICE", "OFFICE COPY", "EXTRA COPY"];
    
    const copiesToGenerate = baseTitles.slice(0, numCopies);

    copiesToGenerate.forEach((copyTitle, copyIdx) => {
        const party = isDN ? (previewData?.vendor || {}) : (previewData?.customer || {});
        
        if (isProf) {
          // --- NEW PROFESSIONAL RETURN NOTE LAYOUT (A5) ---
          const returnId = isDN ? (generatedInvoice?.debitNoteId || order?.debitNoteId) : (generatedInvoice?.creditNoteId || order?.creditNoteId);
          
          html += `
            <div class="page a5-page">
              <div class="page-content">
                <div class="header-section">
                  <h1>${documentTitle}</h1>
                  <div class="cn-id-top">${returnId || "NEW"}</div>
                </div>

                <div class="top-grid">
                  <div class="seller-info">
                    <div class="seller-name">${previewData?.seller?.name || "PEARL AGENCY"}</div>
                    <div>${previewData?.seller?.address || "N/A"}</div>
                    <div>GST : ${previewData?.seller?.gstin || "N/A"}</div>
                  </div>
                  <div class="info-box">
                    <div class="net-amount-box">
                      <span class="net-amount-label">Net Amount :</span>
                      <span class="net-amount-val">₹${(previewData?.grandTotal || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                    </div>
                    <div class="info-row">
                      <span class="info-label">Return Status :</span>
                      <span class="info-val"><span class="status-badge">Returned</span></span>
                    </div>
                    <div class="info-row">
                      <span class="info-label">Return Invoice Date :</span>
                      <span class="info-val">${new Date(previewData?.invoiceDate || order?.createdAt || new Date()).toLocaleDateString("en-IN")}</span>
                    </div>
                    <div class="info-row">
                      <span class="info-label">Invoice No :</span>
                      <span class="info-val">${order?.originalInvoiceId || "-"}</span>
                    </div>
                    <div class="info-row">
                      <span class="info-label">Invoice Date :</span>
                      <span class="info-val">${order?.originalInvoiceDate ? new Date(order.originalInvoiceDate).toLocaleDateString("en-IN") : "-"}</span>
                    </div>
                    <div class="info-row">
                      <span class="info-label">Place of Supply :</span>
                      <span class="info-val">${previewData?.customer?.state || "Tamil Nadu"}(${previewData?.customer?.stateCode || "33"})</span>
                    </div>
                  </div>
                </div>

                <div class="bill-to">
                  <div class="bill-to-title">${isDN ? 'Vendor Info' : 'Bill To'}</div>
                  <div><strong>${party?.name || party?.vendorId?.name || "N/A"}</strong></div>
                  <div>${party?.address || party?.vendorId?.address || "N/A"}</div>
                  <div>GST : ${party?.gstin || party?.vendorId?.gstin || "N/A"}</div>
                  <div>Contact No : ${party?.whatsapp || party?.phone || party?.vendorId?.whatsapp || party?.vendorId?.phone || "-"}</div>
                </div>

                <table>
                  <thead>
                    <tr>
                      <th style="width: 30px;">#</th>
                      <th style="text-align: left;">ITEM</th>
                      <th>BRAND</th>
                      <th>HSN</th>
                      <th>REASON</th>
                      <th>BASE PRICE</th>
                      <th>NET PRICE</th>
                      <th>MRP</th>
                      <th>QTY</th>
                      <th>UOM</th>
                      <th>CGST</th>
                      <th>SGST</th>
                      <th>TOTAL</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${(previewData?.items || []).map((item, idx) => {
                      const qty = Number(isDN ? (item.returnedQty || item.qty || 0) : (item.qty || 0));
                      const rate = Number(isDN ? (item.purchasePrice || 0) : (item.sellingPrice || 0));
                      const gstRate = Number(item.gst || 0);
                      const discountP = Number(item.discountPercent || 0);
                      
                      const netPrice = rate * (1 - discountP/100);
                      const taxableTotal = netPrice * qty;
                      
                      return `
                        <tr>
                          <td style="text-align: center;">${idx + 1}</td>
                          <td style="font-weight: bold;">${item.name}</td>
                          <td style="text-align: center;">${item.brand || "-"}</td>
                          <td style="text-align: center;">${item.hsn || "-"}</td>
                          <td style="text-align: center;">${order?.reasonForReturn || "Good"}</td>
                          <td style="text-align: right;">${rate.toFixed(2)}</td>
                          <td style="text-align: right;">${(netPrice * (1 + gstRate/100)).toFixed(2)}</td>
                          <td style="text-align: right;">${((item.mrp || rate) * (1 + gstRate/100)).toFixed(2)}</td>
                          <td style="text-align: center;">${qty}</td>
                          <td style="text-align: center;">${item.unit || "Pcs"}</td>
                          <td style="text-align: center;">${(gstRate/2).toFixed(2)}%</td>
                          <td style="text-align: center;">${(gstRate/2).toFixed(2)}%</td>
                          <td style="text-align: right; font-weight: bold;">${(item.total || (taxableTotal * (1 + gstRate/100))).toFixed(2)}</td>
                        </tr>
                      `;
                    }).join("")}
                    <tr style="font-weight: 900; background: #f9fafb;">
                      <td colspan="8" style="text-align: left;">Total</td>
                      <td style="text-align: center;">${previewData?.items?.reduce((sum, i) => sum + Number(i.qty || 0), 0)}</td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td style="text-align: right;">₹${(previewData?.grandTotal || 0).toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>

                <div class="totals-section">
                  <table class="totals-table">
                    <tr>
                      <td class="label">TOTAL AMOUNT :</td>
                      <td class="val">₹${(previewData?.subtotal || 0).toFixed(2)}</td>
                    </tr>
                    <tr>
                      <td class="label">TOTAL DISCOUNT :</td>
                      <td class="val">(-)₹${(previewData?.commonDiscount || 0).toFixed(2)}</td>
                    </tr>
                    <tr>
                      <td class="label">CGST :</td>
                      <td class="val">₹${(tax.cgst || 0).toFixed(2)}</td>
                    </tr>
                    <tr>
                      <td class="label">SGST :</td>
                      <td class="val">₹${(tax.sgst || 0).toFixed(2)}</td>
                    </tr>
                    <tr>
                      <td class="label">IGST :</td>
                      <td class="val">₹${(tax.igst || 0).toFixed(2)}</td>
                    </tr>
                    <tr class="grand-total-row">
                      <td class="label" style="font-size: 12px; color: #000;">TOTAL AMOUNT (Inc Tax) :</td>
                      <td class="val" style="font-size: 14px; color: #000;">₹${(previewData?.grandTotal || 0).toFixed(2)}</td>
                    </tr>
                  </table>
                </div>

                <div class="footer-grid">
                  ${previewData?.seller?.bankName ? `
                  <div class="bank-details">
                    <strong>Bank Details</strong><br/>
                    Bank Name : ${previewData?.seller?.bankName}<br/>
                    Account No.: ${previewData?.seller?.accountNo}<br/>
                    Branch Name: ${previewData?.seller?.bankBranch}<br/>
                    IFSC Code : ${previewData?.seller?.ifsc}
                  </div>
                  ` : '<div style="flex: 1;"></div>'}
                  <div style="flex: 1; padding-left: 20px;">
                    <div class="bill-to-title">Declaration</div>
                    <div class="declaration">We declare that this invoice shows the actual price of the goods described and that particulars are true and correct</div>
                  </div>
                </div>

                <div class="cn-footer">
                   <div style="background: #f1f5f9; padding: 10px; border-radius: 8px; font-size: 11px;">
                      <div style="color: #64748b; font-weight: bold; margin-bottom: 2px;">CLOSING BALANCE</div>
                      <div style="font-size: 14px; font-weight: 900;">₹${(() => {
                        const actualParty = party?.customerId || party?.vendorId || party || {};
                        const debit = Number(actualParty.debit || 0);
                        const credit = Number(actualParty.credit || 0);
                        const bal = isDN ? (credit - debit) : (debit - credit);
                        const label = isDN 
                          ? (bal > 0 ? "Cr" : bal < 0 ? "Dr" : "") 
                          : (bal > 0 ? "Dr" : bal < 0 ? "Cr" : "");
                        return `${Math.abs(bal).toFixed(2)} ${label}`;
                      })()}</div>
                    </div>
                   <div class="signature-box">
                     <div style="font-weight: 900; font-size: 9px;">For ${previewData?.seller?.name || "PEARL AGENCY"}</div>
                     <div class="signature-line">Authorized Signature</div>
                   </div>
                </div>
                
                <div style="text-align: center; margin-top: 20px; font-size: 9px; color: #666; text-transform: uppercase; border-top: 1px dashed #ccc; padding-top: 5px;">
                  ${copyTitle} | Generated on ${new Date().toLocaleString("en-IN")}
                </div>
              </div>
            </div>
          `;
        } else {
          // --- EXISTING INVOICE LAYOUT ---
          html += `
            <div class="page">
              <div class="page-content">
                <div class="quick-info">
                  <span>${idLabel}: ${isDN ? (generatedInvoice?.debitNoteId || order?.debitNoteId) : (isCN ? (generatedInvoice?.creditNoteId || order?.creditNoteId) : (generatedInvoice?.invoiceNumber || order?.invoiceId || "PENDING"))}</span>
                </div>
                <div class="top-header">
                  <div class="logo-box"><img src="${previewData?.seller?.logo || "/logo.jpeg"}" alt="Logo" /></div>
                  <div class="company-header">
                    <div class="company-name">${previewData?.seller?.name || "PEARL AGENCY"}</div>
                    <div class="company-address">
                      <strong>${previewData?.seller?.address || "N/A"}</strong><br/>
                      Mobile: ${previewData?.seller?.phone || "-"} | GSTIN: ${previewData?.seller?.gstin || "-"}<br/>
                    </div>
                  </div>
                  ${previewData?.seller?.upiId ? `
                  <div class="upi-qr-box">
                    <img src="https://api.qrserver.com/v1/create-qr-code/?size=70x70&data=${encodeURIComponent(`upi://pay?pa=${previewData.seller.upiId}&pn=${previewData.seller.name || 'Pearl Agency'}&cu=INR`)}" alt="UPI QR" />
                    <div class="upi-qr-label">Scan to Pay</div>
                  </div>` : ''}
                </div>

                <div class="section-title">📋 ${documentTitle} DETAILS</div>

                <div class="order-header">
                  <div class="order-header-col">
                    <strong>${idLabel}:</strong> ${isDN ? (generatedInvoice?.debitNoteId || order?.debitNoteId) : (isCN ? (generatedInvoice?.creditNoteId || order?.creditNoteId) : (generatedInvoice?.invoiceNumber || order?.invoiceId || "PENDING"))}<br/>
                    <strong>${dateLabel}:</strong> ${new Date(previewData?.invoiceDate || generatedInvoice?.invoiceDate || order?.orderDate || order?.createdAt || new Date()).toLocaleDateString("en-IN")}
                  </div>
                  <div class="order-header-col" style="text-align: right;">
                    <strong>${isDN ? 'Vendor' : 'Customer'}:</strong> ${party?.name || party?.vendorId?.name || (isDN ? "N/A" : "CASH CUSTOMER")}<br/>
                    <strong>Contact:</strong> ${party?.whatsapp || party?.phone || party?.vendorId?.whatsapp || party?.vendorId?.phone || "-"}<br/>
                    ${!isReturn ? `<strong>Delivery:</strong> ${previewData?.deliveryMan?.name || previewData?.deliveryMan || order?.deliveryMan?.name || "-"}` : ''}
                  </div>
                </div>

                <div class="sender-buyer">
                  <div class="sender-buyer-col">
                    <strong>${isDN ? 'VENDOR (FROM)' : 'BUYER (BILL TO)'}</strong>
                    ${isDN ? (party?.name || party?.vendorId?.name || "N/A") : (party?.name || "N/A")}<br/>
                    ${isDN ? (party?.address || party?.vendorId?.address || "N/A") : (party?.address || "N/A")}<br/>
                    Mobile: ${isDN ? (party?.whatsapp || party?.phone || party?.vendorId?.whatsapp || party?.vendorId?.phone || "-") : (party?.whatsapp || "-")}<br/>
                    GSTIN: ${isDN ? (party?.gstin || party?.vendorId?.gstin || "N/A") : (party?.gstin || "N/A")}<br/>
                  </div>
                </div>

                <table>
                  <thead>
                    <tr>
                      <th style="width: 5%; text-align: center;">#</th>
                      <th style="width: 40%;">Product Name</th>
                      <th>HSN</th>
                      <th style="text-align: right;">Qty</th>
                      <th style="text-align: right;">Rate</th>
                      <th style="text-align: right;">Disc %</th>
                      <th style="text-align: right;">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${(previewData?.items || []).filter(item => (isDN ? (item.returnedQty || item.qty) : item.qty) > 0).map((item, idx) => {
                      const qty = isDN ? (item.returnedQty || item.qty || 0) : (item.qty || 0);
                      const price = isDN ? (item.purchasePrice || 0) : (item.sellingPrice || 0);
                      const rowTotal = item.total || (qty * price);
                      
                      return `
                        <tr>
                          <td style="text-align: center;">${idx + 1}</td>
                          <td>${item.name || item.productName || "N/A"}</td>
                          <td>${item.hsn || "-"}</td>
                          <td style="text-align: right;">${qty} ${item.unit || ""}</td>
                          <td style="text-align: right;">₹${Number(price).toFixed(2)}</td>
                          <td style="text-align: right;">${item.discountPercent || 0}%</td>
                          <td style="text-align: right;">₹${Number(rowTotal).toFixed(2)}</td>
                        </tr>
                      `;
                    }).join("")}
                  </tbody>
                </table>

                <div class="total-section" style="display: flex; gap: 10px;">
                  <div style="flex: 1; text-align: left;">
                    <div style="background: #f8fafc; padding: 10px; font-size: 11px; border-left: 4px solid #000; border-radius: 4px;">
                      <div><strong>Closing Balance:</strong> ₹${(() => {
                        const actualParty = party?.customerId || party?.vendorId || party || {};
                        const debit = Number(actualParty.debit || 0);
                        const credit = Number(actualParty.credit || 0);
                        
                        // For Vendors (isDN), Balance = Credit - Debit
                        // For Customers, Balance = Debit - Credit
                        const bal = isDN ? (credit - debit) : (debit - credit);
                        const absBal = Math.abs(bal).toFixed(2);
                        const label = isDN 
                          ? (bal > 0 ? "Cr" : bal < 0 ? "Dr" : "") 
                          : (bal > 0 ? "Dr" : bal < 0 ? "Cr" : "");
                        
                        return `${absBal} ${label}`;
                      })()}</div>
                    </div>
                  </div>
                  <div style="flex: 1; text-align: right;">
                    <div>Subtotal: <strong>₹${(previewData?.subtotal || 0).toFixed(2)}</strong></div>
                    ${tax.igst > 0 ? `<div>IGST: <strong>₹${tax.igst.toFixed(2)}</strong></div>` : `
                    <div>CGST: <strong>₹${tax.cgst.toFixed(2)}</strong></div>
                    <div>SGST: <strong>₹${tax.sgst.toFixed(2)}</strong></div>`}
                    <div class="grand-total">GRAND TOTAL: ₹${(previewData?.grandTotal || 0).toFixed(2)}</div>
                  </div>
                </div>
                
                <div class="copy-label">${copyTitle}</div>
              </div>
            </div>

            <!-- PAGE 2: HSN SUMMARY -->
            <div class="page">
              <div class="page-content">
                <div class="section-title">🧾 HSN SUMMARY</div>
                <table>
                  <thead>
                    <tr>
                      <th>HSN</th>
                      <th style="text-align: right;">Taxable Value</th>
                      <th style="text-align: right;">CGST</th>
                      <th style="text-align: right;">SGST</th>
                      <th style="text-align: right;">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${(() => {
                      const hsnMap = {};
                      (previewData?.items || []).forEach(item => {
                        const hsn = item.hsn || "N/A";
                        if (!hsnMap[hsn]) hsnMap[hsn] = { taxable: 0, cgst: 0, sgst: 0, total: 0 };
                        const total = item.total || 0;
                        const taxable = total / (1 + (item.gst / 100));
                        hsnMap[hsn].taxable += taxable;
                        hsnMap[hsn].cgst += (taxable * (item.gst/2)) / 100;
                        hsnMap[hsn].sgst += (taxable * (item.gst/2)) / 100;
                        hsnMap[hsn].total += total;
                      });
                      return Object.entries(hsnMap).map(([hsn, data]) => `
                        <tr>
                          <td>${hsn}</td>
                          <td style="text-align: right;">₹${data.taxable.toFixed(2)}</td>
                          <td style="text-align: right;">₹${data.cgst.toFixed(2)}</td>
                          <td style="text-align: right;">₹${data.sgst.toFixed(2)}</td>
                          <td style="text-align: right;">₹${data.total.toFixed(2)}</td>
                        </tr>
                      `).join("");
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          `;
        }
    });

    html += "</body></html>";
    return html;
};

export const getMiniChallanHTML = (previewData) => {
    const style = `
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: monospace; font-size: 14px; padding: 20px; color: #000; }
        .header { margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 10px; }
        .customer { font-size: 18px; font-weight: bold; margin-bottom: 15px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th { text-align: left; border-bottom: 1px solid #000; padding: 5px; font-weight: bold; }
        td { padding: 8px 5px; border-bottom: 1px dotted #ccc; }
        .footer { margin-top: 30px; font-size: 12px; font-style: italic; }
      </style>
    `;

    let html = `<!DOCTYPE html><html><head><title>CHALLAN</title>${style}</head><body>`;
    
    html += `
      <div class="header">
        <div class="customer">CUSTOMER: ${previewData?.customer?.name || "CASH CUSTOMER"}</div>
        <div>Date: ${new Date().toLocaleDateString("en-IN")}</div>
      </div>
      
      <table>
        <thead>
          <tr>
            <th style="width: 70%;">PRODUCT</th>
            <th style="text-align: right;">COUNT</th>
          </tr>
        </thead>
        <tbody>
          ${(previewData?.items || []).filter(item => item.qty > 0).map(item => `
            <tr>
              <td>${item.name}</td>
              <td style="text-align: right;"><strong>${item.qty} ${item.unit || ""}</strong></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
      
      <div class="footer">
        Generated for internal verification.
      </div>
    </body></html>`;
    
    return html;
};

