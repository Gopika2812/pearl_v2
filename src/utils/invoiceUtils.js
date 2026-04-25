/**
 * 🧾 SHARED INVOICE TEMPLATE UTILITY
 * This provides the HTML structure for printing invoices directly.
 * Updated to follow the "1 copy = 2 pages" rule (Order Details + HSN Details).
 */

export const getInvoiceHTML = (previewData, numCopies = 2, order = {}, generatedInvoice = {}, mode = 'INVOICE') => {
    const isCN = mode === 'CREDIT_NOTE';
    const documentTitle = isCN ? "CREDIT NOTE" : "TAX INVOICE";
    const idLabel = isCN ? "Credit Note ID" : "Invoice No";
    const dateLabel = isCN ? "Note Date" : "Invoice Date";

    const style = `
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.5; color: #000; }
        .page { width: 148mm; min-height: 210mm; padding: 6mm; margin: 0 auto; page-break-after: always; background: white; border-bottom: 1px solid #eee; }
        .page-content { max-width: 136mm; margin: 0 auto; }
        
        .top-header { display: flex; gap: 12px; margin-bottom: 12px; border-bottom: 2px solid #000; padding-bottom: 8px; align-items: flex-start; }
        .logo-box { width: 60px; height: 60px; display: flex; align-items: center; justify-content: center; border-radius: 6px; flex-shrink: 0; overflow: hidden; }
        .logo-box img { width: 100%; height: 100%; object-fit: contain; }
        .company-header { flex: 1; }
        .company-name { font-size: 18px; font-weight: bold; color: #000; margin-bottom: 3px; text-transform: uppercase; }
        .company-address { font-size: 11px; color: #000; line-height: 1.3; margin-bottom: 3px; }
        .upi-qr-box { flex-shrink: 0; text-align: center; }
        .upi-qr-box img { width: 70px; height: 70px; display: block; border: 1px solid #ddd; border-radius: 4px; }
        .upi-qr-label { font-size: 7px; color: #374151; margin-top: 2px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.3px; }
        
        .order-header { display: flex; justify-content: space-between; margin: 10px 0; font-size: 11px; border-bottom: 1px dashed #000; padding-bottom: 8px; color: #000; }
        .order-header-col { flex: 1; }
        .section-title { 
          font-size: 13px; 
          font-weight: bold; 
          color: #fff; 
          background: ${isCN ? '#0d9488' : '#000'}; 
          padding: 4px 10px; 
          margin: 10px 0 8px 0;
          border-radius: 4px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 10px; }
        th { background: #000; color: white; padding: 6px; text-align: left; border: 1px solid #000; font-weight: 600; }
        td { border: 1px solid #000; padding: 5px 6px; color: #000; }
        
        .total-section { text-align: right; margin: 15px 0; font-size: 11px; line-height: 1.5; color: #000; }
        .grand-total { font-size: 16px; font-weight: bold; color: #000; margin-top: 8px; border-top: 2px solid #000; padding-top: 4px; }
        .footer { text-align: center; font-size: 10px; color: #94a3b8; margin-top: 20px; }
        .copy-label { 
          text-align: right; 
          font-weight: 800; 
          color: #dc2626; 
          font-size: 12px; 
          margin-top: 15px;
          border-top: 1px solid #e5e7eb;
          padding-top: 10px;
          letter-spacing: 1.1px;
          text-transform: uppercase;
        }
        .balance-info { background: #f8fafc; padding: 10px; margin: 12px 0; font-size: 11px; border-left: 4px solid #000; border-radius: 4px; }
        .sample-section { background: #fffbeb; padding: 10px; margin: 12px 0; border: 1px solid #fef3c7; border-radius: 6px; }
        
        .sender-buyer { display: flex; gap: 12px; margin: 10px 0; border: 1px solid #000; padding: 10px; border-radius: 6px; background: #f8fafc; color: #000; }
        .sender-buyer-col { flex: 1; font-size: 10px; line-height: 1.4; }
        .sender-buyer-col strong { font-size: 11px; display: block; margin-bottom: 3px; color: #000; }
        
        .quick-info { font-size: 9px; color: #000; margin-bottom: 5px; display: flex; justify-content: space-between; border-bottom: 1px dotted #000; padding-bottom: 2px; }
        
        @media print { 
          body { margin: 0; padding: 0; } 
          .page { margin: 0 auto; padding: 5mm; page-break-after: always !important; border-bottom: none; }
        }
      </style>
    `;

    let html = `<!DOCTYPE html><html><head><title>${documentTitle}</title><meta charset="UTF-8">${style}</head><body>`;

    const isReEdited = !!order.isReEdited || !!order.invoiceGenerated;
    let baseTitles = isCN 
      ? ["CN ORIGINAL", "CN OFFICE COPY", "CN EXTRA COPY"]
      : (isReEdited ? ["RE-EDIT ORIGINAL", "RE-EDIT COPY 1", "RE-EDIT COPY 2"] : ["ORIGINAL INVOICE", "OFFICE COPY", "EXTRA COPY"]);
    
    const copiesToGenerate = baseTitles.slice(0, numCopies);

    copiesToGenerate.forEach(copyTitle => {
        // --- PAGE 1: DOCUMENT DETAILS ---
        html += `
          <div class="page">
            <div class="page-content">
              <div class="quick-info">
                <span>${isCN ? 'CN' : 'INV'}: ${isCN ? (generatedInvoice?.creditNoteId || order?.creditNoteId) : (generatedInvoice?.invoiceNumber || order?.invoiceId || "PENDING")}</span>
              </div>
              <div class="top-header">
                <div class="logo-box"><img src="${previewData?.seller?.logo || "/logo.jpeg"}" alt="Logo" /></div>
                <div class="company-header">
                  <div class="company-name">${previewData?.seller?.name || "PEARL AGENCY"}</div>
                  <div class="company-address">
                    <strong>${previewData?.seller?.address || "12/13, South By-Pass Road, Vanarpettai, Tirunelveli - 627003, Tamil Nadu"}</strong><br/>
                    Mobile: ${previewData?.seller?.phone || "-"} | GSTIN: ${previewData?.seller?.gstin || "-"}<br/>
                  </div>
                </div>
                ${(!isCN && previewData?.seller?.upiId) ? `
                <div class="upi-qr-box">
                  <img src="https://api.qrserver.com/v1/create-qr-code/?size=70x70&data=${encodeURIComponent(`upi://pay?pa=${previewData.seller.upiId}&pn=${previewData.seller.name || 'Pearl Agency'}&cu=INR`)}" alt="UPI QR" />
                  <div class="upi-qr-label">Scan to Pay</div>
                </div>` : ''}
              </div>

              <div class="section-title">📋 ${documentTitle} DETAILS</div>

              <div class="order-header">
                <div class="order-header-col">
                  <strong>${idLabel}:</strong> ${isCN ? (generatedInvoice?.creditNoteId || order?.creditNoteId) : (generatedInvoice?.invoiceNumber || order?.invoiceId || "PENDING")}<br/>
                  <strong>${dateLabel}:</strong> ${new Date(previewData?.invoiceDate || generatedInvoice?.invoiceDate || order?.orderDate || order?.createdAt || new Date()).toLocaleDateString("en-IN")}
                </div>
                <div class="order-header-col" style="text-align: right;">
                  ${!isCN ? `
                    <strong>Customer:</strong> ${previewData?.customer?.name || "CASH CUSTOMER"}<br/>
                    <strong>Contact:</strong> ${previewData?.customer?.whatsapp || "-"}
                  ` : ''}
                </div>
              </div>

              <div class="sender-buyer">
                <div class="sender-buyer-col">
                  <strong>${isCN ? 'RETURN FROM' : 'BUYER (BILL TO)'}</strong>
                  ${previewData?.customer?.name}<br/>
                  ${previewData?.customer?.address || "N/A"}<br/>
                  ${previewData?.customer?.district ? previewData?.customer?.district + ', ' : ''}${previewData?.customer?.state || ""} ${previewData?.customer?.pincode || ""}<br/>
                  Mobile: ${previewData?.customer?.whatsapp || previewData?.customer?.customerId?.whatsapp || "-"}<br/>
                  GSTIN: ${previewData?.customer?.gstin || previewData?.customer?.customerId?.gstin || "N/A"}<br/>
                </div>
              </div>

              ${isCN && order?.originalInvoiceId ? `
                <div style="font-size: 10px; margin-top: -5px; margin-bottom: 10px; background: #f0fdfa; padding: 6px 10px; border: 1px solid #0d9488; border-radius: 4px; display: inline-block;">
                  <strong style="color: #0d9488;">ISSUED AGAINST INVOICE:</strong> ${order.originalInvoiceId} 
                  ${order.originalInvoiceDate ? ` | <strong>DATE:</strong> ${new Date(order.originalInvoiceDate).toLocaleDateString("en-IN")}` : ''}
                </div>
              ` : ''}

              <table>
                <thead>
                  <tr>
                    <th style="width: 5%; text-align: center;">#</th>
                    <th style="width: 32%;">${isCN ? 'Returned Product' : 'Product Name'}</th>
                    <th>HSN</th>
                    <th style="text-align: right;">Qty</th>
                    <th style="text-align: right;">Rate</th>
                    <th style="text-align: right;">Disc %</th>
                    <th style="text-align: right;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${(previewData?.items || []).filter(item => item.qty > 0).map((item, idx) => `
                    <tr>
                      <td style="text-align: center; color: #64748b; font-size: 10px;">${idx + 1}</td>
                      <td>${item.name}</td>
                      <td>${item.hsn || "-"}</td>
                      <td style="text-align: right;">${item.qty} ${item.unit || ""}</td>
                      <td style="text-align: right;">₹${item.sellingPrice?.toFixed(2) || 0}</td>
                      <td style="text-align: right;">${item.discountPercent || 0}%</td>
                      <td style="text-align: right;">₹${(item.total || (item.qty * item.sellingPrice)).toFixed(2)}</td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>
              
              <!-- SAMPLE PRODUCTS -->
              ${(!isCN && previewData?.sampleItems?.length > 0) ? `
                <div class="sample-section">
                  <strong style="font-size: 11px; color: #92400e;">🎁 SAMPLE PRODUCTS (NOT BILLED)</strong>
                  <table style="margin-top: 5px;">
                    <thead>
                      <tr>
                        <th style="width: 40%; background: #92400e;">Product Name</th>
                        <th style="background: #92400e;">HSN</th>
                        <th style="text-align: right; background: #92400e;">Qty</th>
                        <th style="text-align: right; background: #92400e;">Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${previewData.sampleItems.map(item => `
                        <tr>
                          <td>${item.name}</td>
                          <td>${item.hsn || "-"}</td>
                          <td style="text-align: right;">${item.qty} ${item.unit || ""}</td>
                          <td style="text-align: right;">₹${item.sellingPrice?.toFixed(2) || 0}</td>
                        </tr>
                      `).join("")}
                    </tbody>
                  </table>
                </div>
              ` : ""}

              <div class="total-section" style="display: flex; gap: 10px; margin-top: 15px;">
                <div style="flex: 1; text-align: left;">
                  ${!isCN ? `
                    <div style="background: #f8fafc; padding: 10px; margin: 12px 0; font-size: 13px; border-left: 4px solid #000; border-radius: 4px;">
                      <div><strong>Previous Balance:</strong> ${previewData?.formattedOpeningBalance || (previewData?.openingBalance >= 0 ? '₹' + (previewData?.openingBalance || 0).toFixed(2) + ' Dr' : '₹' + Math.abs(previewData?.openingBalance || 0).toFixed(2) + ' Cr')}</div>
                      <div style="margin-top: 4px;"><strong>Closing Balance:</strong> ${previewData?.formattedClosingBalance || (previewData?.closingBalance >= 0 ? '₹' + (previewData?.closingBalance || 0).toFixed(2) + ' Dr' : '₹' + Math.abs(previewData?.closingBalance || 0).toFixed(2) + ' Cr')}</div>
                    </div>
                  ` : ''}
                  ${isCN ? `<div style="font-size: 11px; color: #1e293b; margin-top: 10px; border-bottom: 2px solid #0d9488; padding-bottom: 4px; display: inline-block;"><strong>Reason for Return:</strong> ${order.reasonForReturn || 'Product Return'}</div>` : ''}
                </div>

                <div style="flex: 1; text-align: right;">
                  <div style="font-size: 11px;">Subtotal: <strong>₹${(previewData?.subtotal || 0).toFixed(2)}</strong></div>
                  ${(previewData?.totalTax?.igst > 0 || previewData?.totalTax?.total > 0) ? (
                    previewData?.totalTax?.igst > 0 ? 
                    `<div style="font-size: 11px;">IGST: <strong>₹${(previewData?.totalTax?.igst || 0).toFixed(2)}</strong></div>` : 
                    `<div style="font-size: 11px;">CGST: <strong>₹${(previewData?.totalTax?.cgst || 0).toFixed(2)}</strong></div>
                     <div style="font-size: 11px;">SGST: <strong>₹${(previewData?.totalTax?.sgst || 0).toFixed(2)}</strong></div>`
                  ) : ''}
                  ${(previewData?.totalTax?.total > 0) ? `<div style="font-size: 11px; margin-top: 2px; border-top: 1px dashed #ccc; padding-top: 2px;">Total Tax Value: <strong>₹${(previewData?.totalTax?.total || 0).toFixed(2)}</strong></div>` : ''}
                  ${(previewData?.commonDiscount || 0) > 0 ? `<div style="font-size: 11px; color: red;">Discount: -₹${Number(previewData.commonDiscount).toFixed(2)}</div>` : ""}
                  ${(previewData?.roundingOff || 0) !== 0 ? `<div style="font-size: 11px; color: #666;">Rounding Off: <strong>${previewData.roundingOff > 0 ? '+' : ''}₹${Number(previewData.roundingOff).toFixed(2)}</strong></div>` : ""}
                  <div class="grand-total">${isCN ? 'CREDIT AMOUNT' : 'GRAND TOTAL'}: ₹${(previewData?.grandTotal || 0).toFixed(2)}</div>
                  ${isCN && previewData?.totalTax?.total > 0 ? `<div style="font-size: 9px; margin-top: -2px; opacity: 0.8;">(Includes Total GST of ₹${(previewData?.totalTax?.total || 0).toFixed(2)})</div>` : ''}
                </div>
              </div>
              </div>

              <div class="copy-label">${copyTitle} - PAGE 1</div>
              <div class="footer">${isCN ? 'Credit details' : 'Order details'} generated on ${new Date().toLocaleString("en-IN")} (Record Date: ${new Date(order?.createdAt || new Date()).toLocaleDateString("en-IN")})</div>
            </div>
          </div>
        `;

        // --- PAGE 2: TAX SUMMARY (HSN) ---
        if (!isCN) {
          html += `
            <div class="page">
            <div class="page-content">
              <div class="quick-info">
                <span>${isCN ? 'CN' : 'INV'}: ${isCN ? (generatedInvoice?.creditNoteId || order?.creditNoteId) : (generatedInvoice?.invoiceNumber || order?.invoiceId || "PENDING")}</span>
              </div>
              <div class="top-header">
                <div class="logo-box"><img src="${previewData?.seller?.logo || "/logo.jpeg"}" alt="Logo" /></div>
                <div class="company-header">
                  <div class="company-name">${previewData?.seller?.name || "PEARL AGENCY"}</div>
                  <div class="company-address">
                    <strong>${previewData?.seller?.address || "12/13, South By-Pass Road, Vanarpettai, Tirunelveli - 627003, Tamil Nadu"}</strong><br/>
                    Mobile: ${previewData?.seller?.phone || "-"} | GSTIN: ${previewData?.seller?.gstin || "-"}<br/>
                  </div>
                </div>
              </div>

              <div class="section-title">🧾 ${isCN ? 'CREDIT NOTE' : 'TAX INVOICE'} - HSN SUMMARY</div>

              <div style="text-align: center; margin-bottom: 20px; font-size: 11px;">
                <strong>${idLabel}: ${isCN ? (generatedInvoice?.creditNoteId || order?.creditNoteId) : (generatedInvoice?.invoiceNumber || order?.invoiceId || "PENDING")}</strong> | Date: ${new Date(previewData?.invoiceDate || generatedInvoice?.invoiceDate || order?.orderDate || order?.createdAt || new Date()).toLocaleDateString("en-IN")}
              </div>

              <table>
                <thead>
                  <tr>
                    <th>HSN Code</th>
                    <th style="text-align: right;">Taxable Value</th>
                    <th style="text-align: right;">CGST (Amt)</th>
                    <th style="text-align: right;">SGST (Amt)</th>
                    <th style="text-align: right;">Total</th>
                  </tr>
                </thead>
                <tbody>
                   ${(() => {
                    const hsnMap = {};
                    (previewData?.items || []).forEach(item => {
                      const hsn = item.hsn || "N/A";
                      if (!hsnMap[hsn]) {
                        hsnMap[hsn] = { taxable: 0, cgst: 0, sgst: 0, total: 0 };
                      }
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
                        <td style="text-align: right;">₹${data.cgst.toFixed(2)}</td>
                        <td style="text-align: right;">₹${data.sgst.toFixed(2)}</td>
                        <td style="text-align: right;">₹${data.total.toFixed(2)}</td>
                      </tr>
                    `).join("");
                  })()}
                </tbody>
              </table>

              <div class="total-section">
                <div style="font-size: 10px;">Taxable Subtotal: <strong>₹${previewData?.subtotal?.toFixed(2) || 0}</strong></div>
                <div style="font-size: 10px;">Total GST: <strong>₹${(previewData?.totalTax?.total || 0).toFixed(2)}</strong></div>
                <div class="grand-total">${isCN ? 'TOTAL CREDIT' : 'TOTAL AMOUNT'}: ₹${previewData?.grandTotal?.toFixed(2) || 0}</div>
              </div>

              <div class="copy-label">${copyTitle} - PAGE 2</div>
              <div class="footer">Document generated as per GST regulations | Generated on ${new Date().toLocaleString("en-IN")}</div>
            </div>
          </div>
          `;
        }
    });

    html += "</body></html>";
    return html;
};

