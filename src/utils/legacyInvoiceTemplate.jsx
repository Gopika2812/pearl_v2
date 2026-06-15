export const getOriginalInvoiceHTML = (previewData, order) => {
  const generatedInvoice = previewData; // If it's already generated, previewData is basically the invoice

  const style = `
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.5; color: #000; }
      .page { width: 148mm; min-height: 210mm; padding: 6mm; margin: 0 auto; page-break-after: always; background: white; }
      .page-content { max-width: 136mm; margin: 0 auto; }
      
      .top-header { display: flex; gap: 12px; margin-bottom: 12px; border-bottom: 2px solid #000; padding-bottom: 8px; align-items: flex-start; }
      .logo-box { width: 60px; height: 60px; display: flex; align-items: center; justify-content: center; border-radius: 6px; flex-shrink: 0; overflow: hidden; }
      .logo-box img { width: 100%; height: 100%; object-fit: contain; }
      .company-header { flex: 1; }
      .company-name { font-size: 18px; font-weight: bold; color: #000; margin-bottom: 3px; text-transform: uppercase; }
      .company-address { font-size: 11px; color: #000; line-height: 1.3; margin-bottom: 3px; }
      
      .order-header { display: flex; justify-content: space-between; margin: 10px 0; font-size: 11px; border-bottom: 1px dashed #cbd5e1; padding-bottom: 8px; color: #000; }
      .order-header-col { flex: 1; }
      .section-title { 
        font-size: 13px; 
        font-weight: bold; 
        color: #fff; 
        background: #000; 
        padding: 4px 10px; 
        margin: 10px 0 8px 0;
        border-radius: 4px;
      }
      
      table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 12px; }
      th { background: #000; color: white; padding: 6px; text-align: left; border: 1px solid #1e3a8a; font-weight: 600; }
      td { border: 1px solid #000; padding: 5px 6px; color: #000; }
      
      .total-section { text-align: right; margin: 15px 0; font-size: 13px; line-height: 1.5; color: #000; }
      .grand-total { font-size: 18px; font-weight: bold; color: #000; margin-top: 8px; border-top: 2px solid #000; padding-top: 4px; }
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
      .balance-info { background: #f8fafc; padding: 10px; margin: 12px 0; font-size: 13px; border-left: 4px solid #000; border-radius: 4px; }
      
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
      }
      
      @media print { 
        body { margin: 0; padding: 0; } 
        .page { margin: 0 auto; padding: 5mm; page-break-after: always !important; position: relative; }
      }
    </style>
  `;

  let html = `<!DOCTYPE html><html><head><meta charset="UTF-8">${style}</head><body>`;

  const isReEdited = !!order?.isReEdited || !!order?.invoiceGenerated;
  const copyTitle = isReEdited ? "RE-EDIT ORIGINAL" : "ORIGINAL INVOICE";

  html += `
    <div class="page" style="position: relative; overflow: hidden;">
      <div class="page-content" style="position: relative; z-index: 1;">
        
        <!-- QUICK REF HEADER -->
        <div class="quick-info">
          <span>INV: ${generatedInvoice?.invoiceNumber || order?.invoiceId || "PENDING"}</span>
          <span>CUST: ${previewData?.customer?.name || "CASH CUSTOMER"}</span>
        </div>
        <!-- TOP HEADER WITH LOGO -->
        <div class="top-header">
          <div class="logo-box"><img src="${previewData?.seller?.logo || "/logo.jpeg"}" alt="Logo" /></div>
          <div class="company-header" style="display: flex; align-items: flex-start; gap: 8px;">
            <div style="flex: 1;">
              <div class="company-name">${previewData?.seller?.name || "PEARL AGENCY"}</div>
              <div class="company-address">
                <strong>${previewData?.seller?.address || "12/13, South By-Pass Road, Vanarpettai, Tirunelveli - 627003, Tamil Nadu"}</strong><br/>
                Mobile: ${previewData?.seller?.phone || "-"} | GSTIN: ${previewData?.seller?.gstin || "-"}<br/>
                GPAY No: ${previewData?.seller?.gpayNo || order?.branchId?.gpayNo || ""} | State: ${previewData?.seller?.state || "Tamil Nadu"} (Code: ${previewData?.seller?.stateCode || "33"})
              </div>
            </div>
            <div style="text-align: center; flex-shrink: 0;">
              <img src="https://quickchart.io/qr?size=300&text=${encodeURIComponent(generatedInvoice?.invoiceNumber || previewData?.invoiceNumber || order?.invoiceId || 'N/A')}" style="width: 20mm; height: 20mm; border: 2px solid #000; padding: 1mm;" alt="Delivery QR" />
              <div style="font-size: 7px; font-weight: 900; text-transform: uppercase; margin-top: 2px;">Delivery QR</div>
            </div>
          </div>
        </div>

        <div class="section-title" style="background: #000;">📋 PRODUCT DETAILS</div>

        <!-- BUYER (BILL TO) / ORDER INFO -->
        <div class="order-header">
          <div class="order-header-col">
            <div class="label" style="text-transform: uppercase; letter-spacing: 1px; font-size: 9px; margin-bottom: 2px;">Buyer (Bill To)</div>
            <div style="font-weight: bold; color: #000; font-size: 15px; margin-bottom: 4px;">${previewData?.customer?.name || "CASH CUSTOMER"}</div>
            <div style="font-size: 10px; color: #000; line-height: 1.4;">
              ${previewData?.customer?.address || "No Address Provided"}<br/>
              ${previewData?.customer?.district ? previewData?.customer?.district + ', ' : ''}${previewData?.customer?.state || ""} ${previewData?.customer?.pincode || ""}<br/>
              <strong>Phone:</strong> ${previewData?.customer?.whatsapp || previewData?.customer?.customerId?.whatsapp || "-"}<br/>
              <strong>GSTIN:</strong> ${previewData?.customer?.gstin || previewData?.customer?.customerId?.gstin || "N/A"}
            </div>
          </div>
          <div class="order-header-col" style="text-align: right; display: flex; flex-direction: column; justify-content: center;">
            <div class="label">Date:</div>
            <div style="font-weight: bold;">${new Date(previewData?.invoiceDate || generatedInvoice?.invoiceDate || order?.orderDate || order?.createdAt || new Date()).toLocaleDateString("en-IN")}</div>
            <div class="label" style="margin-top: 6px;">Invoice No:</div>
            <div style="font-weight: bold; color: #dc2626;">${generatedInvoice?.invoiceNumber || previewData?.invoiceNumber || order?.invoiceId || "PENDING"}</div>
            ${(() => {
              const groupObj = previewData?.customer?.customerGroup || previewData?.customer?.customerId?.customerGroup || order?.customer?.customerGroup || order?.customer?.customerId?.customerGroup;
              const groupName = typeof groupObj === 'object' ? groupObj.name : groupObj;
              if (!groupName) return '';
              return '<div style="font-weight: 900; color: #000; font-size: 16px; margin-top: 4px; text-align: right;">(' + String(groupName).charAt(0).toUpperCase() + ')</div>';
            })()}
          </div>
        </div>

        <!-- PRODUCT DETAILS TABLE -->
        <table>
          <thead>
            <tr>
              <th style="width: 5%; text-align: center;">#</th>
              <th style="width: 40%;">Product Name</th>
              <th>HSN</th>
              <th>GST</th>
              <th style="text-align: center;">Qty (Counts)</th>
              <th style="text-align: right;">Rate</th>
              <th style="text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${previewData?.items?.filter(item => (item.confirmedQty || item.qty) > 0)
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((item, idx) => `
              <tr>
                <td style="text-align: center; color: #64748b; font-size: 11px; font-weight: bold;">${idx + 1}</td>
                <td style="font-weight: 900; color: #000; font-size: 10px; text-transform: uppercase;">${item.name} (Req: ${item.originalQty || item.qty}, Confirm: ${item.confirmedQty || item.qty})</td>
                <td style="text-align: center; color: #000; font-weight: bold;">${item.hsn || "-"}</td>
                <td style="text-align: center; color: #000; font-weight: bold;">${item.gst || 0}%</td>
                <td style="text-align: center; font-weight: 900; color: #000; font-size: 10px;">${item.qty || item.confirmedQty} ${item.unit || ""}</td>
                <td style="text-align: right;">₹${item.sellingPrice?.toFixed(2) || 0}</td>
                <td style="text-align: right; font-weight: bold; color: #000;">₹${((item.qty || item.confirmedQty) * (item.sellingPrice || 0)).toFixed(2)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>

        <!-- TOTALS AND BALANCE -->
        <div style="display: flex; gap: 10px;">
             <!-- BALANCE INFO -->
             <div class="balance-info">
               <div><strong>Previous Balance:</strong> ${previewData?.formattedOpeningBalance || (previewData?.openingBalance >= 0 ? '₹' + (previewData?.openingBalance || 0).toFixed(2) + ' Dr' : '₹' + Math.abs(previewData?.openingBalance || 0).toFixed(2) + ' Cr')}</div>
               <div style="margin-top: 4px;"><strong>Closing Balance:</strong> ${previewData?.formattedClosingBalance || (previewData?.closingBalance >= 0 ? '₹' + (previewData?.closingBalance || 0).toFixed(2) + ' Dr' : '₹' + Math.abs(previewData?.closingBalance || 0).toFixed(2) + ' Cr')}</div>
             </div>

            <div class="total-section" style="flex: 1;">
              <div style="font-size: 11px;">Subtotal: <strong>₹${(previewData?.subtotal || 0).toFixed(2)}</strong></div>
              ${previewData?.totalTax?.igst > 0 ? `
                <div style="font-size: 11px;">IGST: <strong>₹${(previewData?.totalTax?.igst || 0).toFixed(2)}</strong></div>
              ` : `
                <div style="font-size: 11px;">CGST: <strong>₹${(previewData?.totalTax?.cgst || 0).toFixed(2)}</strong></div>
                <div style="font-size: 11px;">SGST: <strong>₹${(previewData?.totalTax?.sgst || 0).toFixed(2)}</strong></div>
              `}
              ${previewData?.commonDiscount > 0 ? `<div style="font-size: 11px; color: #dc2626; font-weight: bold;">Discount: <strong>-₹${previewData.commonDiscount.toFixed(2)}</strong></div>` : ""}
              ${previewData?.transportCharge > 0 ? `<div style="font-size: 11px;">Transport: <strong>₹${previewData.transportCharge.toFixed(2)}</strong></div>` : ""}
              <div class="grand-total" style="font-size: 16px;">GRAND TOTAL: ₹${(previewData?.grandTotal || 0).toFixed(2)}</div>
            </div>
        </div>

        <div class="certification">Certified that the particulars given above are true and correct.</div>
        <div class="copy-label">${copyTitle} - PAGE 1</div>
        <div class="quick-info" style="display:flex; flex-direction:column; align-items:center; margin-top:10px;">
           <img src="https://quickchart.io/qr?size=150&text=${encodeURIComponent(`upi://pay?pa=${previewData?.seller?.gpayNo || order?.branchId?.gpayNo || ''}&pn=${previewData?.seller?.name || 'Pearl Agency'}&cu=INR`)}" style="width:30mm; height:30mm;" alt="GPay QR"/>
           <div style="font-size:9px; font-weight:bold; color:#000; margin-top:4px;">Scan to Pay</div>
         </div>
         <div class="footer">E. & O.E. | Generated on ${new Date().toLocaleString("en-IN")}</div>
      </div>
    </div>`;

      const editedItems = previewData?.items || [];
      
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
              <div class="company-header" style="display: flex; align-items: flex-start; gap: 8px;">
                <div style="flex: 1;">
                  <div class="company-name">${previewData?.seller?.name || "PEARL AGENCY"}</div>
                  <div class="company-address">
                    <strong>${previewData?.seller?.address || "12/13, South By-Pass Road, Vanarpettai, Tirunelveli - 627003, Tamil Nadu"}</strong><br/>
                    Mobile: ${previewData?.seller?.phone || "-"} | GSTIN: ${previewData?.seller?.gstin || "-"}<br/>
                    GPAY No: ${previewData?.seller?.gpayNo || order?.branchId?.gpayNo || ""} | State: ${previewData?.seller?.state || "Tamil Nadu"} (Code: ${previewData?.seller?.stateCode || "33"})
                  </div>
                </div>
                <div style="text-align: center; flex-shrink: 0;">
                  <img src="https://quickchart.io/qr?size=300&text=${encodeURIComponent(generatedInvoice?.invoiceNumber || previewData?.invoiceNumber || order?.invoiceId || 'N/A')}" style="width: 20mm; height: 20mm; border: 2px solid #000; padding: 1mm;" alt="Delivery QR" />
                  <div style="font-size: 7px; font-weight: 900; text-transform: uppercase; margin-top: 2px;">Delivery QR</div>
                </div>
              </div>
            </div>

            <div class="section-title" style="background: #1e293b; color: #fff;">📊 HSN-WISE TAX SUMMARY</div>
            <div style="text-align: center; margin-bottom: 20px; font-size: 13px;">
              <strong>Invoice No: ${generatedInvoice?.invoiceNumber || previewData?.invoiceNumber || order?.invoiceId || "PENDING"}</strong> | Date: ${new Date(previewData?.invoiceDate || generatedInvoice?.invoiceDate || order?.orderDate || order?.createdAt || new Date()).toLocaleDateString("en-IN")}
              <div style="font-size: 10px; color: #666; margin-top: 5px;">
                Billing: ${previewData?.billingPerson || "-"} | Delivery: ${previewData?.deliveryMan || "-"}
              </div>
            </div>

             <table>
               <thead>
                 <tr>
                   <th>HSN Code</th>
                   <th style="text-align: right;">Taxable Value</th>
                   ${previewData?.totalTax?.igst > 0 ?
          '<th style="text-align: right;">IGST (Rate | Amt)</th>' :
          '<th style="text-align: right;">CGST (Rate | Amt)</th><th style="text-align: right;">SGST (Rate | Amt)</th>'
        }
                   <th style="text-align: right;">Total</th>
                 </tr>
               </thead>
               <tbody>
                  ${(() => {
          const hsnMap = {};
          (previewData?.items || []).forEach(item => {
            const hsn = item.hsn || "N/A";
            if (!hsnMap[hsn]) {
              hsnMap[hsn] = { taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0, cgstRate: item.cgst || 0, sgstRate: item.sgst || 0, igstRate: item.igst || 0 };
            }
            const totalInclusive = item.total || 0;
            const gstRate = (item.gst || 0);
            const taxable = totalInclusive / (1 + (gstRate / 100));

            hsnMap[hsn].taxable += taxable;
            hsnMap[hsn].cgst += (taxable * (item.cgst || 0)) / 100;
            hsnMap[hsn].sgst += (taxable * (item.sgst || 0)) / 100;
            hsnMap[hsn].igst += (taxable * (item.igst || 0)) / 100;
            hsnMap[hsn].total += totalInclusive;
          });
          return Object.entries(hsnMap).map(([hsn, data]) => '<tr><td>' + hsn + '</td><td style="text-align: right;">₹' + data.taxable.toFixed(2) + '</td>' + (previewData?.totalTax?.igst > 0 ? '<td style="text-align: right;">' + data.igstRate + '% | ₹' + data.igst.toFixed(2) + '</td>' : '<td style="text-align: right;">' + data.cgstRate + '% | ₹' + data.cgst.toFixed(2) + '</td><td style="text-align: right;">' + data.sgstRate + '% | ₹' + data.sgst.toFixed(2) + '</td>') + '<td style="text-align: right;">₹' + data.total.toFixed(2) + '</td></tr>').join("");
        })()}
              </tbody>
            </table>

            <div class="total-section" style="display: flex; justify-content: space-between; align-items: flex-start;">
              <div style="flex: 1;">
                 <div class="balance-info" style="display: flex; gap: 20px; align-items: center;">
                    <div>
                      <div><strong>Previous Balance:</strong> ${previewData?.formattedOpeningBalance || (previewData?.openingBalance >= 0 ? '₹' + (previewData?.openingBalance || 0).toFixed(2) + ' Dr' : '₹' + Math.abs(previewData?.openingBalance || 0).toFixed(2) + ' Cr')}</div>
                      <div style="margin-top: 4px;"><strong>Closing Balance:</strong> ${previewData?.formattedClosingBalance || (previewData?.closingBalance >= 0 ? '₹' + (previewData?.closingBalance || 0).toFixed(2) + ' Dr' : '₹' + Math.abs(previewData?.closingBalance || 0).toFixed(2) + ' Cr')}</div>
                    </div>
                    ${(previewData?.seller?.gpayNo || previewData?.seller?.upiId || order?.branchId?.gpayNo || order?.branchId?.upiId) ? `
                      <div style="text-align: center;">
                         <img src="https://quickchart.io/qr?size=150&text=${encodeURIComponent(`upi://pay?pa=${previewData?.seller?.gpayNo || previewData?.seller?.upiId || order?.branchId?.gpayNo || order?.branchId?.upiId}&pn=${previewData?.seller?.name || 'Pearl Agency'}&cu=INR`)}" style="width: 15mm; height: 15mm; border: 1px solid #e2e8f0; padding: 1mm; border-radius: 4px;" alt="GPay QR" />
                         <div style="font-size: 7px; font-weight: 800; margin-top: 1px;">SCAN TO PAY</div>
                      </div>
                    ` : ""}
                 </div>
              </div>
              <div style="text-align: right;">
                <div style="font-size: 11px;">Subtotal (Gross): <strong>₹${previewData?.subtotal?.toFixed(2) || 0}</strong></div>
                ${previewData?.totalTax?.igst > 0 ?
            `<div style="font-size: 11px;">IGST: <strong>₹${(previewData?.totalTax?.igst || 0).toFixed(2)}</strong></div>` :
            `<div style="font-size: 11px;">CGST: <strong>₹${(previewData?.totalTax?.cgst || 0).toFixed(2)}</strong></div>
                   <div style="font-size: 11px;">SGST: <strong>₹${(previewData?.totalTax?.sgst || 0).toFixed(2)}</strong></div>`
          }
                ${previewData?.commonDiscount > 0 ? `<div style="font-size: 11px;">Common Discount: <strong style="color: red;">-₹${previewData.commonDiscount.toFixed(2)}</strong></div>` : ""}
                ${previewData?.transportCharge > 0 ? `<div style="font-size: 11px;">Transport: <strong>₹${previewData.transportCharge.toFixed(2)}</strong></div>` : ""}
                ${previewData?.extraExpenseAmount > 0 ? `<div style="font-size: 11px;">Extra Expenses: <strong>₹${previewData.extraExpenseAmount.toFixed(2)}</strong></div>` : ""}
                ${previewData?.roundingOff !== 0 ? `<div style="font-size: 11px;">Rounding Off: <strong>${previewData.roundingOff > 0 ? '+' : ''}₹${previewData.roundingOff.toFixed(2)}</strong></div>` : ""}
                <div class="grand-total">TOTAL AMOUNT: ₹${previewData?.grandTotal?.toFixed(2) || 0}</div>
              </div>
            </div>

            <!-- BACK ORDER SECTION (if applicable) -->
  ${editedItems.some(item => item.backOrderQty > 0) ? `
    <div style="margin-top: 15px; padding-top: 10px; border-top: 2px solid #000;">
      <div class="section-title">📦 BACK ORDER SUMMARY</div>
      <table>
        <thead>
          <tr>
            <th style="width: 35%;">Product Name</th>
            <th>HSN Code</th>
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
              <td style="text-align: center;">${item.hsn || "-"}</td>
              <td style="text-align: right;">${item.originalQty || item.qty} ${item.altQty > 0 ? `(${item.altQty} ${item.altUnit})` : ""}</td>
              <td style="text-align: right;">${item.confirmedQty} ${item.altQty > 0 && (item.originalQty || item.qty) > 0 ? `(${(item.altQty * (item.confirmedQty / (item.originalQty || item.qty))).toFixed(0)} ${item.altUnit})` : (item.altQty > 0 ? `(0 ${item.altUnit})` : "")}</td>
              <td style="text-align: right; color: red; font-weight: bold;">${item.backOrderQty} ${item.altQty > 0 && (item.originalQty || item.qty) > 0 ? `(${(item.altQty * (item.backOrderQty / (item.originalQty || item.qty))).toFixed(0)} ${item.altUnit})` : (item.altQty > 0 ? `(${item.altQty} ${item.altUnit})` : "")}</td>
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
            <div class="footer">Tax Invoice as per GST regulations | Generated on ${new Date().toLocaleString("en-IN")} (Original Date: ${new Date(previewData?.invoiceDate || generatedInvoice?.invoiceDate || order?.orderDate || order?.createdAt || new Date()).toLocaleDateString("en-IN")})</div>
          </div>
        </div>
      `;

      html += "</body></html>";
      return html;
    };
