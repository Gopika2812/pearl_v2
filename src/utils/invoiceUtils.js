/**
 * 🧾 SHARED INVOICE TEMPLATE UTILITY
 * This provides the HTML structure for printing invoices directly.
 * Updated to follow the "1 copy = 2 pages" rule (Order Details + HSN Details).
 */

export const getInvoiceHTML = (previewData, numCopies = 2, order = {}, generatedInvoice = {}) => {
    const style = `
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.5; color: #333; }
        .page { width: 148mm; min-height: 210mm; padding: 6mm; margin: 0 auto; page-break-after: always; background: white; border-bottom: 1px solid #eee; }
        .page-content { max-width: 136mm; margin: 0 auto; }
        
        .top-header { display: flex; gap: 12px; margin-bottom: 12px; border-bottom: 2px solid #1e40af; padding-bottom: 8px; }
        .logo-box { width: 60px; height: 60px; display: flex; align-items: center; justify-content: center; border-radius: 6px; flex-shrink: 0; overflow: hidden; }
        .logo-box img { width: 100%; height: 100%; object-fit: contain; }
        .company-header { flex: 1; }
        .company-name { font-size: 16px; font-weight: bold; color: #1e40af; margin-bottom: 3px; text-transform: uppercase; }
        .company-address { font-size: 10px; color: #333; line-height: 1.3; margin-bottom: 3px; }
        
        .order-header { display: flex; justify-content: space-between; margin: 10px 0; font-size: 10px; border-bottom: 1px dashed #cbd5e1; padding-bottom: 8px; }
        .order-header-col { flex: 1; }
        .section-title { 
          font-size: 12px; 
          font-weight: bold; 
          color: #fff; 
          background: #1e40af; 
          padding: 4px 10px; 
          margin: 10px 0 8px 0;
          border-radius: 4px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 9px; }
        th { background: #1e40af; color: white; padding: 6px; text-align: left; border: 1px solid #1e3a8a; font-weight: 600; }
        td { border: 1px solid #e5e7eb; padding: 5px 6px; color: #333; }
        
        .total-section { text-align: right; margin: 15px 0; font-size: 10px; line-height: 1.5; }
        .grand-total { font-size: 14px; font-weight: bold; color: #1e40af; margin-top: 8px; border-top: 2px solid #1e40af; padding-top: 4px; }
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
        .balance-info { background: #f8fafc; padding: 10px; margin: 12px 0; font-size: 11px; border-left: 4px solid #1e40af; border-radius: 4px; }
        
        .sender-buyer { display: flex; gap: 12px; margin: 10px 0; border: 1px solid #e5e7eb; padding: 10px; border-radius: 6px; background: #f8fafc; }
        .sender-buyer-col { flex: 1; font-size: 9px; line-height: 1.4; }
        .sender-buyer-col strong { font-size: 10px; display: block; margin-bottom: 3px; color: #1e40af; }
        
        .quick-info { font-size: 8px; color: #64748b; margin-bottom: 5px; display: flex; justify-content: space-between; border-bottom: 1px dotted #e2e8f0; padding-bottom: 2px; }
        
        @media print { 
          body { margin: 0; padding: 0; } 
          .page { margin: 0 auto; padding: 5mm; page-break-after: always !important; border-bottom: none; }
        }
      </style>
    `;

    let html = `<!DOCTYPE html><html><head><meta charset="UTF-8">${style}</head><body>`;

    const isReEdited = !!order.isReEdited || !!order.invoiceGenerated;
    const baseTitles = isReEdited 
      ? ["RE-EDIT ORIGINAL", "RE-EDIT COPY 1", "RE-EDIT COPY 2"] 
      : ["ORIGINAL INVOICE", "OFFICE COPY", "EXTRA COPY"];
    
    const copiesToGenerate = baseTitles.slice(0, numCopies);

    copiesToGenerate.forEach(copyTitle => {
        // --- PAGE 1: ORDER DETAILS ---
        html += `
          <div class="page">
            <div class="page-content">
              <div class="quick-info">
                <span>INV: ${generatedInvoice?.invoiceNumber || order?.invoiceId || "PENDING"}</span>
                <span>CUST: ${previewData?.customer?.name || "CASH CUSTOMER"}</span>
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

              <div class="section-title">📋 ORDER DETAILS</div>

              <div class="order-header">
                <div class="order-header-col">
                  <strong>Invoice No:</strong> ${generatedInvoice?.invoiceNumber || order?.invoiceId || "PENDING"}<br/>
                  <strong>Date:</strong> ${new Date().toLocaleDateString("en-IN")}
                </div>
                <div class="order-header-col" style="text-align: right;">
                  <strong>Customer:</strong> ${previewData?.customer?.name || "CASH CUSTOMER"}<br/>
                  <strong>Contact:</strong> ${previewData?.customer?.whatsapp || "-"}
                </div>
              </div>

              <div class="sender-buyer">
                <div class="sender-buyer-col">
                  <strong>BUYER (BILL TO)</strong>
                  ${previewData?.customer?.name}<br/>
                  ${previewData?.customer?.address || "N/A"}<br/>
                  ${previewData?.customer?.district ? previewData?.customer?.district + ', ' : ''}${previewData?.customer?.state || ""} ${previewData?.customer?.pincode || ""}<br/>
                  Mobile: ${previewData?.customer?.whatsapp || previewData?.customer?.customerId?.whatsapp || "-"}<br/>
                  GSTIN: ${previewData?.customer?.gstin || previewData?.customer?.customerId?.gstin || "N/A"}
                </div>
              </div>

              <table>
                <thead>
                  <tr>
                    <th style="width: 40%;">Product Name</th>
                    <th>HSN</th>
                    <th style="text-align: right;">Qty</th>
                    <th style="text-align: right;">Rate</th>
                    <th style="text-align: right;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${(previewData?.items || []).map(item => `
                    <tr>
                      <td>${item.name}</td>
                      <td>${item.hsn || "-"}</td>
                      <td style="text-align: right;">${item.qty} ${item.unit || ""}</td>
                      <td style="text-align: right;">₹${item.sellingPrice?.toFixed(2) || 0}</td>
                      <td style="text-align: right;">₹${(item.qty * item.sellingPrice).toFixed(2)}</td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>

              <div style="display: flex; gap: 10px; margin-top: 15px;">
                <div style="flex: 1;">
                  <div class="balance-info">
                    <div><strong>Opening Balance:</strong> ₹${previewData?.openingBalance?.toFixed(2) || 0}</div>
                    <div><strong>Closing Balance:</strong> ₹${previewData?.closingBalance?.toFixed(2) || 0}</div>
                  </div>
                </div>

                <div class="total-section" style="flex: 1;">
                  <div style="font-size: 11px;">Subtotal: <strong>₹${previewData?.subtotal?.toFixed(2) || 0}</strong></div>
                  <div style="font-size: 11px;">Tax Amount: <strong>₹${(previewData?.totalTax?.total || 0).toFixed(2)}</strong></div>
                  ${previewData?.commonDiscount > 0 ? `<div style="font-size: 11px; color: red;">Discount: -₹${previewData.commonDiscount.toFixed(2)}</div>` : ""}
                  <div class="grand-total">GRAND TOTAL: ₹${previewData?.grandTotal?.toFixed(2) || 0}</div>
                </div>
              </div>

              <div class="copy-label">${copyTitle} - PAGE 1</div>
              <div class="footer">Order details generated on ${new Date().toLocaleString("en-IN")}</div>
            </div>
          </div>
        `;

        // --- PAGE 2: TAX INVOICE (HSN SUMMARY) ---
        html += `
          <div class="page">
            <div class="page-content">
              <div class="quick-info">
                <span>INV: ${generatedInvoice?.invoiceNumber || order?.invoiceId || "PENDING"}</span>
                <span>CUST: ${previewData?.customer?.name || "CASH CUSTOMER"}</span>
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

              <div class="section-title">🧾 TAX INVOICE - HSN SUMMARY</div>

              <div style="text-align: center; margin-bottom: 20px; font-size: 11px;">
                <strong>Invoice No: ${generatedInvoice?.invoiceNumber || order?.invoiceId || "PENDING"}</strong> | Date: ${new Date().toLocaleDateString("en-IN")}
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
                <div class="grand-total">TOTAL AMOUNT: ₹${previewData?.grandTotal?.toFixed(2) || 0}</div>
              </div>

              <div class="copy-label">${copyTitle} - PAGE 2</div>
              <div class="footer">Tax Invoice as per GST regulations | Generated on ${new Date().toLocaleString("en-IN")}</div>
            </div>
          </div>
        `;
    });

    html += "</body></html>";
    return html;
};

