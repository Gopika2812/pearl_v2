import { useEffect, useState, useRef } from "react";
import {
    FaCheck,
    FaEdit,
    FaPlus,
    FaPrint,
    FaSpinner,
    FaTimes,
    FaTrash,
    FaWhatsapp,
} from "react-icons/fa";
import { toast } from "react-toastify";
import { API_BASE } from "../api";
import { useBranch } from "../context/BranchContext";

const InvoiceGeneratorModal = ({ order, onClose, onSuccess }) => {
  const { currentBranch, user } = useBranch();
  const [activeTab, setActiveTab] = useState("edit");
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Edit state
  const [editedItems, setEditedItems] = useState([]);
  const [notes, setNotes] = useState("");
  const [invoiceType, setInvoiceType] = useState("ORDER_DETAILS");
  const [commonDiscount, setCommonDiscount] = useState(0);

  // Customer Swap state
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [fetchedCustomers, setFetchedCustomers] = useState([]);
  const [searchingCustomers, setSearchingCustomers] = useState(false);

  // Add Item state
  const [itemSearch, setItemSearch] = useState("");
  const [showItemDropdown, setShowItemDropdown] = useState(false);
  const [fetchedProducts, setFetchedProducts] = useState([]);
  const [searchingProducts, setSearchingProducts] = useState(false);
  const qtyInputRef = useRef(null);

  const [newItem, setNewItem] = useState({
    productId: "",
    name: "",
    qty: "",
    sellingPrice: "",
    hsn: "",
    unit: "",
    gst: 0,
    mrp: 0
  });

  // Fetch initial data for dropdowns
  useEffect(() => {
    if (order?.branchId) {
      searchCustomers(""); // Load initial customers
      searchProducts("");  // Load initial products
    }
  }, [order?.branchId]);

  // Preview state
  const [previewData, setPreviewData] = useState(null);

  // Generated invoice
  const [generatedInvoice, setGeneratedInvoice] = useState(null);
  const [numCopies, setNumCopies] = useState(2);

  // Options
  const [shouldPrint, setShouldPrint] = useState(false);
  const [shouldWhatsApp, setShouldWhatsApp] = useState(false);

  // Initialize data
  useEffect(() => {
    if (order) {
      // If the order was already invoiced, load the items exactly as they were invoiced (invoiceItems)
      // We prefer invoiceItems because it contains the final structure saved to the bill.
      const sourceItems = order.invoiceGenerated 
        ? (order.invoiceItems?.length ? order.invoiceItems : (order.lastInvoicedItems || order.items))
        : order.items;
      
      if (sourceItems) {
        setEditedItems(
          sourceItems.map((item) => {
            // Recover name if missing (common in old local history)
            let name = item.name || item.productName || "";
            if (!name && item.productId) {
              const original = (order.items || []).find(so => so.productId?._id?.toString() === item.productId?.toString() || so.productId?.toString() === item.productId?.toString());
              if (original) name = original.name;
            }

            return {
              ...item,
              _id: item._id?.toString?.() || item._id,
              name: name, // Ensure name is always set
              confirmedQty: item.qty || 0,
              backOrderQty: 0,
              originalQty: item.qty || 0, // In recall mode, the "reference" quantity is what you last billed
            };
          })
        );
      }
      setNotes(order.notes || "");
      setCommonDiscount(order.commonDiscount || 0);
      setSelectedCustomer(order.customer);
      setCustomerSearch(order.customer?.name || "");
    }
  }, [order]);

  // Handle Search Customers
  const searchCustomers = async (query) => {
    try {
      setSearchingCustomers(true);
      const bid = currentBranch?._id || order.branchId?._id || order.branchId;
      const res = await fetch(`${API_BASE}/customers?branchId=${bid}&search=${query || ""}`);
      const data = await res.json();
      setFetchedCustomers(data.data || []);
    } catch (err) {
      console.error("error fetching customers:", err);
    } finally {
      setSearchingCustomers(false);
    }
  };

  // Handle Search Products
  const searchProducts = async (query) => {
    try {
      setSearchingProducts(true);
      const bid = currentBranch?._id || order.branchId?._id || order.branchId;
      const res = await fetch(`${API_BASE}/products?branchId=${bid}&search=${query || ""}`);
      const data = await res.json();
      setFetchedProducts(data.data || []);
      // If query is empty, it's an "initial load" - don't force show dropdown yet
    } catch (err) {
      console.error("error fetching products:", err);
    } finally {
      setSearchingProducts(false);
    }
  };

  const handleAddProduct = async (product) => {
    let price = product.sellingPrice || product.mrp || 0;
    
    // FETCH LOCKED PRICE FOR CUSTOMER
    try {
      const customerId = selectedCustomer?._id || order.customerId || order.customer?._id;
      const bid = currentBranch?._id || order.branchId?._id || order.branchId;
      
      if (customerId && bid && product._id) {
        const res = await fetch(`${API_BASE}/customer-locked-prices/${customerId}/${product._id}?branchId=${bid}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.data?.lockedPrice) {
            price = data.data.lockedPrice;
            toast.info(`Using locked price for ${selectedCustomer?.name || 'customer'}: ₹${price}`);
          }
        }
      }
    } catch (err) {
      console.warn("Locked price check failed:", err);
    }

    setNewItem({
      productId: product._id,
      name: product.name,
      hsn: product.hsnCode || product.hsncode || "",
      sellingPrice: price,
      unit: product.unit || product.units || "Kg",
      gst: product.gst || 0,
      mrp: product.mrp || 0,
      qty: 1, 
    });
    setItemSearch(product.name);
    setShowItemDropdown(false);
    
    // Focus on Qty input
    setTimeout(() => {
        qtyInputRef.current?.focus();
        qtyInputRef.current?.select();
    }, 100);
  };

  const confirmAddItem = () => {
    if (!newItem.productId || !newItem.qty || newItem.qty <= 0) {
      toast.warning("Please select a product and enter a valid quantity");
      return;
    }

    const itemToAdd = {
      productId: newItem.productId,
      name: newItem.name,
      hsn: newItem.hsn,
      sellingPrice: newItem.sellingPrice,
      unit: newItem.unit,
      gst: newItem.gst,
      cgst: newItem.gst / 2,
      sgst: newItem.gst / 2,
      igst: 0,
      qty: Number(newItem.qty),
      confirmedQty: Number(newItem.qty),
      backOrderQty: 0, 
      originalQty: Number(newItem.qty), 
      total: Math.round(newItem.sellingPrice * newItem.qty * 100) / 100,
    };

    setEditedItems([...editedItems, itemToAdd]);
    
    // Reset form
    setNewItem({
      productId: "",
      name: "",
      qty: "",
      sellingPrice: "",
      hsn: "",
      unit: "",
      gst: 0,
      mrp: 0
    });
    setItemSearch("");
    toast.success(`Added ${itemToAdd.name}`);
  };

  const handleDeleteProduct = (index) => {
    const updated = editedItems.filter((_, i) => i !== index);
    setEditedItems(updated);
  };

  // Handle quantity changes
  const handleQtyChange = (index, confirmedQty) => {
    const updated = [...editedItems];
    const original = updated[index].originalQty || updated[index].qty || 0;
    const confirmed = Math.max(0, confirmedQty);
    updated[index].confirmedQty = confirmed;
    updated[index].qty = confirmed;
    updated[index].backOrderQty = Math.max(0, original - confirmed);
    
    // Recalculate item total
    const price = updated[index].sellingPrice || 0;
    updated[index].total = Math.round(price * confirmed * 100) / 100;
    
    setEditedItems(updated);
  };

  // Handle price changes (Admin/Super Admin only)
  const handlePriceChange = (index, newPrice) => {
    const updated = [...editedItems];
    const price = Math.max(0, newPrice);
    updated[index].sellingPrice = price;
    
    // Recalculate item total
    const confirmed = updated[index].confirmedQty || 0;
    updated[index].total = Math.round(price * confirmed * 100) / 100;
    
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
            customerId: selectedCustomer?.customerId || selectedCustomer?._id, // Use swapped customer
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
            customerId: selectedCustomer?.customerId || selectedCustomer?._id, // Use swapped customer
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
        
        .top-header { display: flex; gap: 12px; margin-bottom: 12px; border-bottom: 2px solid #000; padding-bottom: 8px; }
        .logo-box { width: 60px; height: 60px; display: flex; align-items: center; justify-content: center; border-radius: 6px; flex-shrink: 0; overflow: hidden; }
        .logo-box img { width: 100%; height: 100%; object-fit: contain; }
        .company-header { flex: 1; }
        .company-name { font-size: 18px; font-weight: bold; color: #000; margin-bottom: 3px; text-transform: uppercase; }
        .company-address { font-size: 11px; color: #000; line-height: 1.3; margin-bottom: 3px; }
        .company-contact { font-size: 10px; color: #000; }
        
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
        
        .row { display: flex; gap: 15px; margin: 8px 0; font-size: 11px; }
        .col { flex: 1; }
        .label { font-weight: bold; color: #000; }
        
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
        .sample-section { background: #fffbeb; padding: 12px; margin: 15px 0; border: 1px solid #fef3c7; border-radius: 6px; }
        .back-order-section { background: #fef2f2; padding: 12px; margin: 15px 0; border: 1px solid #fee2e2; border-radius: 6px; }
        
        .sender-buyer { display: flex; gap: 12px; margin: 10px 0; border: 1px solid #000; padding: 10px; border-radius: 6px; background: #f8fafc; color: #000; }
        .sender-buyer-col { flex: 1; font-size: 10px; line-height: 1.4; }
        .sender-buyer-col strong { font-size: 11px; display: block; margin-bottom: 3px; color: #000; }
        
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
                  <div style="font-weight: bold; color: #000;">${generatedInvoice?.invoiceNumber || order?.invoiceId || "PENDING"}</div>
                </div>
                <div class="order-header-col">
                  <div class="label">Date:</div>
                  <div style="font-weight: bold;">${new Date(previewData?.invoiceDate || generatedInvoice?.invoiceDate || order?.orderDate || order?.createdAt || new Date()).toLocaleDateString("en-IN")}</div>
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
                   <!-- BALANCE INFO -->
                   <div class="balance-info">
                     <div><strong>Closing Balance:</strong> ${previewData?.formattedClosingBalance || (previewData?.closingBalance >= 0 ? '₹' + (previewData?.closingBalance || 0).toFixed(2) + ' Dr' : '₹' + Math.abs(previewData?.closingBalance || 0).toFixed(2) + ' Cr')}</div>
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
                  ${previewData?.roundingOff !== 0 ? `<div style="font-size: 11px;">Rounding Off: <strong>${previewData.roundingOff > 0 ? '+' : ''}₹${previewData.roundingOff.toFixed(2)}</strong></div>` : ""}
                  
                  <div class="grand-total">GRAND TOTAL: ₹${previewData?.grandTotal?.toFixed(2) || 0}</div>
                </div>
              </div>

              <div class="certification">Certified that the particulars given above are true and correct.</div>
              <div class="copy-label">${copyTitle} - PAGE 1</div>
              <div class="footer">E. & O.E. | Generated on ${new Date().toLocaleString("en-IN")} (Original Date: ${new Date(previewData?.invoiceDate || generatedInvoice?.invoiceDate || order?.orderDate || order?.createdAt || new Date()).toLocaleDateString("en-IN")})</div>
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
                <strong>Invoice No: ${generatedInvoice?.invoiceNumber || order?.invoiceId || "PENDING"}</strong> | Date: ${new Date(previewData?.invoiceDate || generatedInvoice?.invoiceDate || order?.orderDate || order?.createdAt || new Date()).toLocaleDateString("en-IN")}
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
                ${previewData?.roundingOff !== 0 ? `<div style="font-size: 11px;">Rounding Off: <strong>${previewData.roundingOff > 0 ? '+' : ''}₹${previewData.roundingOff.toFixed(2)}</strong></div>` : ""}
                <div class="grand-total">TOTAL AMOUNT: ₹${previewData?.grandTotal?.toFixed(2) || 0}</div>
              </div>

              <!-- BACK ORDER SECTION (if applicable) -->
    ${editedItems.some(item => item.backOrderQty > 0) ? `
      <div style="margin-top: 15px; padding-top: 10px; border-top: 2px solid #000;">
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
              <div class="footer">Tax Invoice as per GST regulations | Generated on ${new Date().toLocaleString("en-IN")} (Original Date: ${new Date(previewData?.invoiceDate || generatedInvoice?.invoiceDate || order?.orderDate || order?.createdAt || new Date()).toLocaleDateString("en-IN")})</div>
            </div>
          </div>
        `;
      }
    });

    html += "</body></html>";
    return html;
  };

  return (
    <div className="fixed inset-0 bg-white z-[60] flex flex-col overflow-hidden animate-in fade-in duration-300">
      <div className="w-full flex-1 flex flex-col overflow-hidden">
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
              {tab === "edit" && "📦 Back Order / Workbench"}
              {tab === "preview" && "👁️ Preview"}
              {tab === "success" && "🖨️ Print / Send"}
            </button>
          ))}
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-auto p-6">
          {/* EDIT TAB */}
          {activeTab === "edit" && (
            <div>
              <h3 className="text-xl font-black mb-1 bg-gradient-to-r from-blue-700 to-indigo-700 bg-clip-text text-transparent">
                📦 Invoicing Workbench & Back Order Management
              </h3>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-6">
                Edit quantities to create back orders | Add new items if required
              </p>

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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                {/* Customer Swapping */}
                <div className="relative">
                  <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-tight">Billing Customer (Swap Allowed):</label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={customerSearch}
                        onChange={(e) => {
                          setCustomerSearch(e.target.value);
                          searchCustomers(e.target.value);
                        }}
                        onFocus={() => setShowCustomerDropdown(true)}
                        onBlur={() => setTimeout(() => setShowCustomerDropdown(false), 200)}
                        placeholder="Select or search customer..."
                        className="w-full p-2 border-2 border-blue-100 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none font-semibold transition-all"
                      />
                      {showCustomerDropdown && (
                        <div className="absolute top-full left-0 right-0 bg-white border shadow-2xl z-[60] max-h-60 overflow-auto rounded-b-xl border-t-0 animate-in slide-in-from-top-1 duration-200">
                          {fetchedCustomers.length > 0 ? (
                            fetchedCustomers.map((c) => (
                              <div
                                key={c._id}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  setSelectedCustomer(c);
                                  setCustomerSearch(c.name);
                                  setShowCustomerDropdown(false);
                                  toast.info(`Swapped billing customer to: ${c.name}`);
                                }}
                                className="p-4 hover:bg-blue-50 cursor-pointer border-b last:border-0 transition-colors"
                              >
                                <div className="flex justify-between items-start">
                                  <div>
                                    <div className="font-black text-blue-900">{c.name}</div>
                                    <div className="text-[10px] text-gray-500 font-bold uppercase">{c.address || "No Address Provided"}</div>
                                  </div>
                                  <div className="text-right">
                                    <div className="text-xs font-black text-indigo-600">{c.whatsapp}</div>
                                    {c.debitBalance > 0 && (
                                      <div className="text-[9px] font-bold text-red-500">Bal: ₹{c.debitBalance.toFixed(2)}</div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="p-4 text-center text-gray-400 text-sm italic">No customers found...</div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 p-2 bg-blue-50 rounded border border-blue-100 text-[10px]">
                    <strong>Currently Billing:</strong> {selectedCustomer?.name || "N/A"}
                  </div>
                </div>

                {/* Add Item Workbench Form */}
                <div className="bg-green-50/50 p-6 rounded-xl border-2 border-green-100 shadow-sm">
                  <h3 className="text-sm font-black text-green-700 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                    Add Product to Invoice
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                    {/* Search Field */}
                    <div className="md:col-span-5 relative">
                      <label className="block text-[9px] font-black text-gray-500 uppercase mb-1 tracking-tighter">1. Search Product</label>
                      <input
                        type="text"
                        value={itemSearch}
                        onChange={(e) => {
                          setItemSearch(e.target.value);
                          searchProducts(e.target.value);
                          if (!e.target.value) {
                            setNewItem({...newItem, productId: "", name: ""});
                          }
                        }}
                        onFocus={() => setShowItemDropdown(true)}
                        onBlur={() => setTimeout(() => setShowItemDropdown(false), 200)}
                        placeholder="Select or search product..."
                        className="w-full p-2.5 border-2 border-green-100 rounded-lg bg-white focus:ring-2 focus:ring-green-500 outline-none font-bold text-gray-800 transition-all placeholder:text-gray-300"
                      />
                      {showItemDropdown && (
                        <div className="absolute top-full left-0 right-0 bg-white border shadow-2xl z-[60] max-h-60 overflow-auto rounded-b-xl border-t-0 animate-in slide-in-from-top-1 duration-200">
                          {fetchedProducts.length > 0 ? (
                            fetchedProducts.map((p) => (
                              <div
                                key={p._id}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  handleAddProduct(p);
                                }}
                                className="p-4 hover:bg-green-50 cursor-pointer border-b last:border-0 flex justify-between items-center transition-colors"
                              >
                                <div className="flex-1">
                                  <div className="font-black text-green-900">{p.name}</div>
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-bold">{p.hsnCode || p.hsncode}</span>
                                    <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-black uppercase tracking-wider">
                                      Stock: {p.availableQty || 0} {p.unit || "Units"}
                                    </span>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-sm font-black text-blue-600">₹{(p.sellingPrice || 0).toFixed(2)}</div>
                                  <div className="text-[9px] text-gray-400 font-bold">MRP: ₹{p.mrp || 0}</div>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="p-4 text-center text-gray-400 text-sm italic">No products found...</div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Qty Field */}
                    <div className="md:col-span-2">
                       <label className="block text-[9px] font-black text-gray-500 uppercase mb-1 tracking-tighter">2. Qty</label>
                       <input
                         ref={qtyInputRef}
                         type="number"
                         value={newItem.qty}
                         onChange={(e) => setNewItem({...newItem, qty: e.target.value})}
                         onKeyDown={(e) => e.key === 'Enter' && confirmAddItem()}
                         placeholder="0"
                         className="w-full p-2.5 border-2 border-green-100 rounded-lg bg-white focus:ring-2 focus:ring-green-500 outline-none font-black text-center text-green-700 transition-all"
                       />
                    </div>

                    {/* Rate Field */}
                    <div className="md:col-span-3">
                       <label className="block text-[9px] font-black text-gray-500 uppercase mb-1 tracking-tighter">3. Selling Rate (₹)</label>
                       <div className="relative">
                         <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">₹</span>
                         <input
                           type="number"
                           value={newItem.sellingPrice}
                           onChange={(e) => setNewItem({...newItem, sellingPrice: e.target.value})}
                           onKeyDown={(e) => e.key === 'Enter' && confirmAddItem()}
                           readOnly={!(user?.role?.toUpperCase() === "ADMIN" || user?.role?.toUpperCase() === "SUPER_ADMIN")}
                           className={`w-full p-2.5 pl-7 border-2 border-green-100 rounded-lg focus:ring-2 focus:ring-green-500 outline-none font-black text-blue-700 transition-all ${
                             !(user?.role?.toUpperCase() === "ADMIN" || user?.role?.toUpperCase() === "SUPER_ADMIN")
                               ? "bg-gray-50 cursor-not-allowed"
                               : "bg-white cursor-text focus:border-green-600"
                           }`}
                         />
                       </div>
                    </div>

                    {/* Add Button */}
                    <div className="md:col-span-2">
                       <button
                         onClick={confirmAddItem}
                         disabled={!newItem.productId}
                         className="w-full bg-green-600 text-white p-3 rounded-lg hover:bg-green-700 transition-all font-black uppercase text-xs shadow-lg shadow-green-200 flex items-center justify-center gap-2 disabled:opacity-50"
                       >
                         <FaPlus /> Add
                       </button>
                    </div>
                  </div>
                  
                  {newItem.productId && (
                    <div className="mt-4 flex gap-4 text-[10px] items-center bg-white/60 p-2 rounded-lg border border-dashed border-green-200">
                      <span className="font-bold text-gray-500">SELECTED: <span className="text-green-700">{newItem.name}</span></span>
                      <span className="font-bold text-gray-500 flex items-center gap-1">
                        UNIT: 
                        <input 
                          type="text" 
                          value={newItem.unit} 
                          onChange={(e) => setNewItem({...newItem, unit: e.target.value})}
                          className="w-16 p-1 border rounded bg-white font-black text-gray-700 uppercase outline-none focus:ring-1 focus:ring-green-400"
                          placeholder="Unit"
                        />
                      </span>
                      <span className="font-bold text-gray-500">HSN: <span className="text-gray-700">{newItem.hsn}</span></span>
                      <span className="ml-auto font-black text-blue-600">Total: ₹{(Number(newItem.qty || 0) * Number(newItem.sellingPrice || 0)).toFixed(2)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Items Table */}
              <div className="overflow-x-auto mb-6">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-blue-600 text-white">
                      <th className="p-3 text-left">Product</th>
                      <th className="p-3 text-right">Original Qty</th>
                      <th className="p-3 text-right">Confirmed Qty</th>
                      <th className="p-3 text-right">Back Order Qty</th>
                      <th className="p-3 text-right">Price (Locked)</th>
                      <th className="p-3 text-right">Total</th>
                      <th className="p-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {editedItems.map((item, idx) => (
                      <tr key={idx} className="border-b hover:bg-gray-50 transition">
                        <td className="p-3 font-medium">
                          {item.name || <span className="text-gray-400 italic text-xs">Product Name Missing</span>}
                        </td>
                        <td className="p-3 text-right text-gray-500">
                          <div className="flex flex-col items-end gap-1">
                            <span>{item.originalQty || item.qty}</span>
                            <input
                              type="text"
                              value={item.unit}
                              onChange={(e) => {
                                const updated = [...editedItems];
                                updated[idx].unit = e.target.value;
                                setEditedItems(updated);
                              }}
                              className="w-16 p-1 text-[10px] border rounded text-right uppercase bg-transparent hover:bg-white focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                            />
                          </div>
                        </td>
                        <td className="p-3">
                          <input
                            type="number"
                            min="0"
                            value={item.confirmedQty}
                            onChange={(e) => handleQtyChange(idx, parseFloat(e.target.value) || 0)}
                            className="w-24 p-2 border rounded text-right font-bold bg-white focus:ring-2 focus:ring-blue-400"
                          />
                        </td>
                        <td className="p-3 text-right font-bold text-red-600">
                          {item.backOrderQty} {item.unit}
                        </td>
                        <td className="p-3 text-right">
                          {(user?.role?.toUpperCase() === "ADMIN" || user?.role?.toUpperCase() === "SUPER_ADMIN") ? (
                            <div className="relative">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">₹</span>
                              <input
                                type="number"
                                step="0.01"
                                value={item.sellingPrice}
                                onChange={(e) => handlePriceChange(idx, parseFloat(e.target.value) || 0)}
                                className="w-24 p-2 pl-5 border rounded text-right font-bold text-blue-600 focus:ring-2 focus:ring-blue-400"
                              />
                            </div>
                          ) : (
                            <div className="font-mono text-gray-600 bg-gray-50 p-2 rounded">
                              ₹{(item.sellingPrice || 0).toFixed(2)}
                            </div>
                          )}
                        </td>
                        <td className="p-3 text-right font-mono font-bold">
                          ₹{(item.total || 0).toFixed(2)}
                        </td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => handleDeleteProduct(idx)}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-full transition"
                            title="Remove from invoice"
                          >
                            <FaTrash />
                          </button>
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

          {/* SUCCESS (PRINT / SEND) TAB */}
          {activeTab === "success" && generatedInvoice && (
            <div className="text-center py-8">
              <div className="text-6xl mb-4">🖨️</div>
              <h3 className="text-2xl font-black text-gray-800 mb-2 uppercase tracking-tight">
                Ready to Print & Send
              </h3>
              <p className="text-sm text-gray-500 font-bold mb-6">
                Invoice #{generatedInvoice.invoiceNumber} has been finalized.
              </p>

              <div className="bg-green-50 p-6 rounded-lg mb-6">
                <div className="text-lg mb-4">
                  Total Amount: <span className="font-bold text-2xl text-green-600">₹{previewData?.grandTotal?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-gray-600 font-medium">Closing Balance</span>
                  <span className={`font-black ${previewData?.closingBalance >= 0 ? 'text-blue-700' : 'text-red-600'}`}>
                    {previewData?.formattedClosingBalance}
                  </span>
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
