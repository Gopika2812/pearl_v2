const fs = require('fs');
const path = require('path');

const filename = path.join('e:', 'pearls-erp', 'src', 'components', 'inventory', 'InventorySalesOrderEntry.jsx');

try {
  let content = fs.readFileSync(filename, 'utf-8');
  
  // Normalize line endings to avoid \r\n vs \n mismatch on Windows!
  content = content.replace(/\r\n/g, '\n');

  // 1. Hide Product Group logic inside handleItemSelection so it doesn't break searches
  content = content.replace(
    `const pGroupId = product.productGroup?._id || product.productGroup || product.groupId?._id || product.groupId;\n    if (pGroupId && pGroupId !== productGroup) {\n      setProductGroup(pGroupId);\n      const groupObj = productGroups.find((g) => g._id === pGroupId);\n      if (groupObj) {\n        setProductGroupSearch(groupObj.name);\n      }\n    }`,
    `// const pGroupId = product.productGroup?._id || product.productGroup || product.groupId?._id || product.groupId;
    // if (pGroupId && pGroupId !== productGroup) {
    //   setProductGroup(pGroupId);
    //   const groupObj = productGroups.find((g) => g._id === pGroupId);
    //   if (groupObj) {
    //     setProductGroupSearch(groupObj.name);
    //   }
    // }`
  );

  const startMarker = `  return (\n    <div className="space-y-6 font-sans">`;
  const endMarker = `\n  );\n}`;

  // Let's use split or regex instead for maximum robustness
  const startIndex = content.indexOf(startMarker);
  const endIndex = content.lastIndexOf(endMarker);

  if (startIndex === -1 || endIndex === -1) {
    fs.writeFileSync('e:\\pearls-erp\\rewrite_error.log', 'Could not find markers! start=' + startIndex + ' end=' + endIndex);
    process.exit(1);
  }

  const newJsx = `  return (
    <div className="space-y-6 font-sans">

      <ToastContainer
        position="top-right"
        autoClose={2500}
        newestOnTop
        closeOnClick
        pauseOnHover
        theme="colored"
        toastStyle={{
          background: "rgba(49, 155, 171, 0.85)",
          color: "#fff",
          backdropFilter: "blur(6px)",
          borderRadius: "12px",
          boxShadow: "0 8px 20px rgba(49,155,171,0.25)",
        }}
      />

      {/* ROW 1: HEADER & CUSTOMER */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT: VOUCHER, INVOICE, WAREHOUSE */}
        <div className="lg:col-span-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-4 h-fit">
          <div>
            <label className={labelClass}>Voucher Type</label>
            <select className={selectClass} value={voucherType} onChange={(e) => setVoucherType(e.target.value)}>
              <option value="">-- Select --</option>
              {voucherTypes.map((v) => (
                <option key={v._id} value={v.name}>{v.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Invoice ID</label>
            <input className={\`\${inputClass} bg-gray-50 font-bold text-[#319bab]\`} value={invoiceId} readOnly />
          </div>
          <div>
            <label className={labelClass}>Warehouse</label>
            <select className={selectClass} value={warehouse} onChange={(e) => setWarehouse(e.target.value)}>
              <option value="">-- Select --</option>
              {warehouses.map((w) => (
                <option key={w._id} value={w.name}>{w.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* RIGHT: CUSTOMER DETAILS */}
        <div className="lg:col-span-8 bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-4 h-fit">
          <h3 className="text-[#319bab] font-black uppercase text-xs tracking-widest border-b pb-2 border-[#319bab]/30">
            Customer Details
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 relative">
              <label className={labelClass}>Customer</label>
              <input
                type="text"
                placeholder="Type to search or click to see all customers..."
                value={customerSearch}
                onChange={(e) => {
                  setCustomerSearch(e.target.value);
                  setShowCustomerDropdown(true);
                }}
                onFocus={() => setShowCustomerDropdown(true)}
                className={inputClass}
              />
              {/* CUSTOMER DROPDOWN */}
              {showCustomerDropdown && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
                  {searchingCustomers && (
                    <div className="px-3 py-2 text-gray-500 text-sm text-center">🔍 Searching...</div>
                  )}
                  {!searchingCustomers && fetchedCustomers
                    .map((c) => (
                      <div
                        key={c._id}
                        onClick={() => handleCustomerSelect(c._id)}
                        className="px-3 py-2 hover:bg-blue-50 cursor-pointer border-b text-sm"
                      >
                        <div className="font-semibold">{c.name}</div>
                        <div className="text-gray-500 text-xs">{c.whatsapp}</div>
                      </div>
                    ))}
                  {!searchingCustomers && fetchedCustomers.length === 0 && customerSearch && (
                    <div className="px-3 py-2 text-gray-500 text-sm">No customers found for "{customerSearch}"</div>
                  )}
                  {!searchingCustomers && fetchedCustomers.length === 0 && !customerSearch && (
                    <div className="px-3 py-2 text-gray-500 text-sm">Loading customers...</div>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className={labelClass}>GSTIN</label>
              <input className={inputClass} value={selectedCustomer?.gstin || ""} readOnly />
            </div>

            <div>
              <label className={labelClass}>Closing Balance</label>
              <input
                className={\`\${inputClass} font-bold \${selectedCustomer?.debit && selectedCustomer.debit > 0 ? "text-blue-600" : "text-gray-600"}\`}
                value={selectedCustomer ? \`₹\${(selectedCustomer.debit || 0).toFixed(2)}\` : ""}
                readOnly
              />
            </div>

            <div className="lg:col-span-2">
              <label className={labelClass}>Address</label>
              <input className={inputClass} value={selectedCustomer?.address || ""} readOnly />
            </div>
            
            <div className="hidden">
              <input className={inputClass} value={selectedCustomer?.whatsapp || ""} readOnly />
              <input className={\`\${inputClass} bg-gray-100\`} value={salesOwner || ""} readOnly />
              <input className={inputClass} value={selectedCustomer?.email || ""} readOnly />
              <input className={inputClass} value={selectedCustomer?.district || ""} readOnly />
              <input className={inputClass} value={selectedCustomer?.state || ""} readOnly />
              <input className={inputClass} value={selectedCustomer?.pincode || ""} readOnly />
            </div>
          </div>
        </div>
      </div>

      {/* ROW 2: ITEM ENTRY & ITEMS TABLE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
        
        {/* LEFT: ADD ITEM */}
        <div className="lg:col-span-4 bg-primary/5 p-5 rounded-2xl border border-primary/10 space-y-4 h-fit">
          <h3 className="text-[#319bab] font-black uppercase text-xs tracking-widest border-b pb-2 border-[#319bab]/30">
            Add Item
          </h3>

          {/* HIDDEN PRODUCT GROUP */}
          <div className="hidden">
            <input
              type="text"
              value={productGroupSearch}
              onChange={(e) => {
                setProductGroupSearch(e.target.value);
                setShowProductGroupDropdown(true);
              }}
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div className="relative">
              <label className={labelClass}>Item Name</label>
              <input
                type="text"
                placeholder="Type item name..."
                value={itemSearch}
                onChange={(e) => {
                  setItemSearch(e.target.value);
                  setShowItemDropdown(true);
                }}
                onFocus={() => setShowItemDropdown(true)}
                disabled={!warehouse}
                className={\`\${inputClass} \${(!warehouse) ? 'bg-gray-100 cursor-not-allowed' : ''}\`}
              />
              
              {showItemDropdown && warehouse && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
                  {productsWithStock
                    .filter(p => p.name.toLowerCase().includes(itemSearch.toLowerCase()))
                    .map((p) => {
                      const availableQty = availableQtyCache[p._id] ?? p.availableQty ?? 0;
                      const isOutOfStock = availableQty === 0;
                      return (
                        <div
                          key={p._id}
                          onClick={() => !isOutOfStock && handleItemSelection(p._id)}
                          className={\`px-3 py-2 border-b text-sm \${isOutOfStock ? 'bg-gray-50 cursor-not-allowed opacity-60' : 'hover:bg-blue-50 cursor-pointer'}\`}
                        >
                          <div className="font-semibold">{p.name} ({p.perQty || 1}:{p.units || ""})</div>
                          <div className={\`text-xs \${isOutOfStock ? 'text-red-500 font-semibold' : 'text-gray-500'}\`}>
                            Available: {availableQty} {isOutOfStock && '(Out of Stock)'}
                          </div>
                        </div>
                      );
                    })}
                  {productsWithStock.filter(p => p.name.toLowerCase().includes(itemSearch.toLowerCase())).length === 0 && (
                    <div className="px-3 py-2 text-gray-500 text-sm">No items found</div>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>HSN</label>
                <input className={inputClass} value={hsn} readOnly />
              </div>
              <div>
                <label className={labelClass}>Selling ₹</label>
                <input type="number" className={inputClass} value={sellingPrice} onChange={(e) => setSellingPrice(+e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Quantity</label>
                <input
                  type="number"
                  className={inputClass}
                  value={qty}
                  min={0}
                  max={availableQtyCache[selectedItem] ?? productsWithStock.find(p => p._id === selectedItem)?.availableQty ?? 0}
                  onChange={(e) => setQty(e.target.value === "" ? "" : +e.target.value)}
                  placeholder="0"
                />
              </div>
              <div>
                <label className={labelClass}>GST %</label>
                <input type="number" className={inputClass} value={gst} onChange={(e) => setGst(+e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Discount Type</label>
                <select className={selectClass} value={discountType} onChange={(e) => setDiscountType(e.target.value)}>
                  <option value="PERCENT">%</option>
                  <option value="AMOUNT">₹</option>
                </select>
              </div>
              {discountType === "PERCENT" ? (
                <div>
                  <label className={labelClass}>Discount %</label>
                  <input type="number" className={inputClass} value={discountPercent} min="0" max="100" onChange={(e) => setDiscountPercent(+e.target.value)} />
                </div>
              ) : (
                <div>
                  <label className={labelClass}>Discount ₹</label>
                  <input type="number" className={inputClass} value={discountAmountInput} min="0" onChange={(e) => setDiscountAmountInput(+e.target.value)} />
                </div>
              )}
            </div>

            <div className="flex items-center gap-4 py-1">
              <label className="flex items-center gap-2 text-xs font-bold text-gray-600">
                <input type="checkbox" checked={igst} onChange={(e) => setIgst(e.target.checked)} /> IGST
              </label>
              {!igst && (
                <>
                  <span className="text-xs font-bold text-gray-600">CGST {gst / 2}%</span>
                  <span className="text-xs font-bold text-gray-600">SGST {gst / 2}%</span>
                </>
              )}
            </div>

            <div>
              <label className={labelClass}>Total ₹</label>
              <input className={\`\${inputClass} font-bold text-[#319bab] text-lg\`} value={displayPrice.toFixed(2)} readOnly />
            </div>

            <button onClick={addItem} className="w-full bg-[#319bab] text-white h-[42px] rounded-xl font-bold flex items-center justify-center hover:bg-[#257f87] transition shadow-lg cursor-pointer active:scale-95">
              <FaPlus className="mr-2" /> ADD ITEM
            </button>
          </div>
        </div>

        {/* RIGHT: ITEMS TABLE */}
        <div className="lg:col-span-8 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden h-fit flex flex-col">
          <h3 className="text-[#319bab] font-black uppercase text-xs tracking-widest p-5 border-b border-gray-100 bg-gray-50/50">
            Added Items Phase
          </h3>
          {items.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 uppercase text-[11px] font-bold">
                  <tr>
                    <th className="px-4 py-3 text-left">Item</th>
                    <th className="px-4 py-3 text-center">Qty</th>
                    <th className="px-4 py-3 text-right">Rate</th>
                    <th className="px-4 py-3 text-right">Discount</th>
                    <th className="px-4 py-3 text-right">Tax</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {items.map((item, index) => (
                    <tr key={index}>
                      <td className="px-4 py-3 font-semibold">
                        {item.name}
                        <div className="text-[10px] text-gray-400">HSN: {item.hsn}</div>
                      </td>
                      <td className="px-4 py-3 text-center">{item.qty}</td>
                      <td className="px-4 py-3 text-right">₹{item.sellingPrice}</td>
                      <td className="px-4 py-3 text-right text-red-500">₹{item.discountAmount.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right">
                        {item.igst ? \`IGST \${item.gst}%\` : \`CGST \${item.cgst}% + SGST \${item.sgst}%\`}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-[#319bab]">₹{item.total.toFixed(2)}</td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => removeItem(index)} className="text-red-500 hover:text-red-700">
                          <FaTrash />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center text-gray-400 text-sm font-semibold">
              No items added yet.
            </div>
          )}
        </div>

      </div>

      {/* ROW 3: SAMPLES, EXPENSES AND E-WAY */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
        
        {/* LEFT: SAMPLES AND EXPENSES */}
        <div className="lg:col-span-6 space-y-6">
          <div className="bg-yellow-50 border-2 border-yellow-200 p-6 rounded-2xl space-y-4 shadow-sm">
            <h3 className="text-yellow-700 font-black uppercase text-sm tracking-widest border-b border-yellow-200 pb-2">
              🎁 Sample Products (Not Billed)
            </h3>
            <p className="text-xs text-yellow-600">Sample products are tracked but do not affect the bill total</p>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
              <div className="relative md:col-span-2">
                <label className={labelClass}>Item</label>
                <input
                  type="text"
                  placeholder="Type item name..."
                  value={sampleItemSearch}
                  onChange={(e) => {
                    setSampleItemSearch(e.target.value);
                    setShowSampleItemDropdown(true);
                  }}
                  onFocus={() => setShowSampleItemDropdown(true)}
                  className={inputClass}
                />
                {showSampleItemDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
                    {loadingSampleProducts && <div className="px-3 py-2 text-gray-500 text-sm text-center">🔍 Loading products...</div>}
                    {!loadingSampleProducts && filteredSampleProducts
                      .filter(p => p.name.toLowerCase().includes(sampleItemSearch.toLowerCase()))
                      .map((p) => {
                        const availableQty = p.totalQty || 0;
                        const isOutOfStock = availableQty === 0;
                        return (
                          <div
                            key={p._id}
                            onClick={() => !isOutOfStock && handleSampleItemSelection(p._id)}
                            className={\`px-3 py-2 border-b text-sm \${isOutOfStock ? 'bg-gray-50 cursor-not-allowed opacity-60' : 'hover:bg-yellow-50 cursor-pointer'}\`}
                          >
                            <div className="font-semibold">{p.name}</div>
                            <div className={\`text-xs \${isOutOfStock ? 'text-red-500 font-semibold' : 'text-gray-500'}\`}>
                              Available: {availableQty} {isOutOfStock && '(Out of Stock)'}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
              <div>
                <label className={labelClass}>Qty</label>
                <input type="number" className={inputClass} value={sampleQty} onChange={(e) => setSampleQty(e.target.value === "" ? "" : +e.target.value)} placeholder="0" />
              </div>
              <button onClick={addSampleItem} className="bg-yellow-500 text-white h-[42px] rounded-xl font-bold flex items-center justify-center hover:bg-yellow-600 transition shadow-lg active:scale-95">
                <FaPlus className="mr-2" /> ADD
              </button>
            </div>

            {sampleItems.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-yellow-200 overflow-hidden mt-4">
                <table className="w-full text-sm">
                  <thead className="bg-yellow-100 text-yellow-700 uppercase text-[10px] font-bold">
                    <tr>
                      <th className="px-3 py-2 text-left">Item</th>
                      <th className="px-3 py-2 text-center">Qty</th>
                      <th className="px-3 py-2 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y border-t border-yellow-100">
                    {sampleItems.map((item, index) => (
                      <tr key={index} className="hover:bg-yellow-50">
                        <td className="px-3 py-2 font-semibold text-yellow-900">{item.name}</td>
                        <td className="px-3 py-2 text-center font-bold">{item.qty}</td>
                        <td className="px-3 py-2 text-center">
                          <button onClick={() => removeSampleItem(index)} className="text-red-500 hover:text-red-700"><FaTrash /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="bg-orange-50 p-6 rounded-2xl border border-orange-200 shadow-sm space-y-4">
             <div className="flex justify-between items-center text-sm">
              <div>
                <span className="text-orange-700 font-black tracking-widest uppercase border-b border-orange-200 pb-1 text-sm">💰 Extra Expenses</span>
                <div className="text-xs text-orange-600 mt-1">
                  {extraExpenses.length > 0 ? \`\${extraExpenses.length} expense(s) - ₹\${roundedExtraExpenseAmount.toFixed(2)}\` : "Miscellaneous charges"}
                </div>
              </div>
              <button onClick={() => setShowExtraExpensesModal(true)} className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg font-bold transition">
                + Add Expense
              </button>
            </div>
            
            {extraExpenses.length > 0 && (
              <div className="space-y-2 mt-4">
                {extraExpenses.map((exp) => (
                  <div key={exp.id} className="flex items-center justify-between bg-white p-3 rounded-lg border border-orange-100">
                    <div>
                      <p className="font-semibold text-gray-800 text-sm">{exp.expenseName}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <p className="font-bold text-orange-600">₹{(exp.totalPrice || 0).toFixed(2)}</p>
                      <button onClick={() => handleRemoveExtraExpense(exp.id)} className="text-red-500 hover:bg-red-50 p-2 rounded-full transition"><FaTrash /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: E-WAY BILL */}
        <div className="lg:col-span-6 bg-white p-6 rounded-3xl shadow-sm border border-gray-100 h-fit space-y-4">
          <div className="flex items-center justify-between border-b pb-2 border-gray-100">
            <h3 className="text-[#319bab] font-black uppercase text-xs tracking-widest">
              E-Way Bill Details
            </h3>
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={enableEway} onChange={(e) => setEnableEway(e.target.checked)} />
              <span className="text-xs font-bold text-gray-600">Enable E-Way</span>
            </div>
          </div>

          {enableEway ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>E-Way Bill No</label>
                <input type="text" className={inputClass} value={ewayBillNo} onChange={(e) => setEwayBillNo(e.target.value)} placeholder="Enter E-Way No" />
              </div>
              <div>
                <label className={labelClass}>E-Way Date</label>
                <input type="date" className={inputClass} value={ewayDate} onChange={(e) => setEwayDate(e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Vehicle No</label>
                <input type="text" className={inputClass} value={vehicleNo} onChange={(e) => setVehicleNo(e.target.value)} placeholder="TN09AB1234" />
              </div>
              <div>
                <label className={labelClass}>Transport Mode</label>
                <select className={selectClass} value={transportMode} onChange={(e) => setTransportMode(e.target.value)}>
                  <option value="Road">Road</option>
                  <option value="Rail">Rail</option>
                  <option value="Air">Air</option>
                  <option value="Ship">Ship</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className={labelClass}>Transporter</label>
                <input type="text" className={inputClass} value={transporterName} onChange={(e) => setTransporterName(e.target.value)} placeholder="ABC Logistics" />
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-gray-400 text-sm font-semibold">
              Enable E-Way Bill to add transport details
            </div>
          )}
        </div>
      </div>

      {/* ROW 4: SALES PERSONNEL & SUMMARY */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
        
        {/* LEFT: PERSONNEL */}
        <div className="lg:col-span-6 bg-white p-6 rounded-3xl shadow-sm border border-gray-100 h-fit space-y-4">
          <h3 className="text-[#319bab] font-black uppercase text-xs tracking-widest border-b pb-2 border-[#319bab]/30">
            Order Processors
          </h3>
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className={labelClass}>Sales Man</label>
              <select className={selectClass} value={salesMan} onChange={(e) => setSalesMan(e.target.value)}>
                <option value="">-- Select Sales Man --</option>
                {salesMen.map((sm) => (<option key={sm._id} value={sm._id}>{sm.name} ({sm.phone})</option>))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Delivery Man</label>
              <select className={selectClass} value={deliveryMan} onChange={(e) => setDeliveryMan(e.target.value)}>
                <option value="">-- Select Delivery Man --</option>
                {deliveryMen.map((dm) => (<option key={dm._id} value={dm._id}>{dm.name} ({dm.phone})</option>))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Billing Person</label>
              <select className={selectClass} value={billingPerson} onChange={(e) => setBillingPerson(e.target.value)}>
                <option value="">-- Select --</option>
                {salesOwners.length > 0 && (<><option disabled>--- Sales Owners ---</option>{salesOwners.map((so) => (<option key={\`so-\${so._id}\`} value={so._id}>{so.name} (Owner)</option>))}</>)}
                {salesMen.length > 0 && (<><option disabled>--- Sales Men ---</option>{salesMen.map((sm) => (<option key={\`sm-\${sm._id}\`} value={sm._id}>{sm.name} (Sales Man)</option>))}</>)}
                {deliveryMen.length > 0 && (<><option disabled>--- Delivery Men ---</option>{deliveryMen.map((dm) => (<option key={\`dm-\${dm._id}\`} value={dm._id}>{dm.name} (Delivery Man)</option>))}</>)}
              </select>
            </div>
          </div>
        </div>

        {/* RIGHT: ORDER SUMMARY */}
        <div className="lg:col-span-6 bg-white p-8 rounded-3xl shadow-xl border border-primary/5 h-fit text-lg">
          <h3 className="text-[#319bab] font-black uppercase text-sm tracking-widest mb-6 border-b pb-2 border-[#319bab]/30">
            Order Summary
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Subtotal</span>
              <span className="font-bold">₹{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Discount</span>
              <span className="font-bold text-red-500">-₹{totalDiscount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Tax Amount</span>
              <span className="font-bold">₹{totalTax.toFixed(2)}</span>
            </div>
            {extraExpenses.length > 0 && (
              <div className="flex justify-between text-sm bg-orange-50 px-3 py-2 rounded-lg">
                <span className="text-orange-700 font-semibold">Extra Expenses</span>
                <span className="font-bold text-orange-600">₹{roundedExtraExpenseAmount.toFixed(2)}</span>
              </div>
            )}
            {sampleItems.length > 0 && (
              <div className="pt-2 border-t border-yellow-200 mt-2">
                <div className="flex justify-between text-xs text-yellow-700 font-semibold">
                  <span>📦 Sample Items: {sampleItems.reduce((s, i) => s + i.qty, 0)} units (Not in total)</span>
                </div>
              </div>
            )}
            <div className="pt-4 border-t border-gray-200 mt-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-800 font-black text-sm uppercase">Grand Total</span>
                <span className="text-4xl font-black text-[#319bab] italic">₹{roundedGrandTotal.toFixed(2)}</span>
              </div>
            </div>
            <div className="mt-8">
              <button onClick={handleFinalAction} className="w-full bg-[#319bab] hover:bg-[#257f87] text-white py-4 rounded-2xl font-black uppercase tracking-widest text-sm transition shadow-2xl hover:shadow-primary/50 cursor-pointer active:scale-95">
                Place Sales Order
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* Extra Expenses Modal */}
      {showExtraExpensesModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Add Extra Expense</h3>
            <div className="space-y-4">
              <div>
                <label className={labelClass}>Expense Name</label>
                <input type="text" className={inputClass} value={expenseName} onChange={(e) => setExpenseName(e.target.value)} placeholder="e.g., Loading Charge, Packing Charge" />
              </div>
              <div>
                <label className={labelClass}>Amount (₹)</label>
                <input type="number" className={inputClass} value={expensePrice} onChange={(e) => setExpensePrice(e.target.value)} placeholder="0.00" min="0" step="0.01" />
              </div>
              <div className="grid grid-cols-2 gap-3 pt-4">
                <button onClick={() => setShowExtraExpensesModal(false)} className="w-full border-2 border-gray-300 text-gray-700 py-2 rounded-lg font-bold hover:bg-gray-50 transition">Cancel</button>
                <button onClick={handleAddExtraExpense} disabled={!expenseName.trim() || !expensePrice} className="w-full bg-orange-500 text-white py-2 rounded-lg font-bold hover:bg-orange-600 transition disabled:opacity-50 disabled:cursor-not-allowed">Add Expense</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RIGHT SIDE RECENT ORDERS PANEL */}
      {showRecentPanel && recentOrders.length > 0 && (
        <div className="hidden lg:flex fixed top-24 right-4 z-40 w-96 max-h-[70vh] bg-white rounded-2xl shadow-2xl border border-gray-200 flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h4 className="text-[#319bab] font-black text-xs uppercase tracking-widest">Recent Orders</h4>
            <button onClick={() => setShowRecentPanel(false)} className="text-gray-400 hover:text-red-500 text-lg font-bold">×</button>
          </div>
          <div className="overflow-y-auto px-4 py-2">
            <table className="w-full text-sm">
              <thead className="text-gray-500 text-[10px] uppercase font-bold sticky top-0 bg-white">
                <tr>
                  <th className="text-left py-1">Invoice</th>
                  <th className="text-center">Rate</th>
                  <th className="text-center">Qty</th>
                  <th className="text-right">Total</th>
                  <th className="text-right">Date</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order) => {
                  const item = order.items.find(i => String(i.productId) === String(selectedItem));
                  return (
                    <tr key={order._id} className="border-t text-xs">
                      <td className="py-1 font-semibold">{order.invoiceId}</td>
                      <td className="text-center">{item?.sellingPrice}</td>
                      <td className="text-center">{item?.qty}</td>
                      <td className="text-right text-[#319bab] font-bold">₹{item?.total.toFixed(2)}</td>
                      <td className="text-right text-gray-700">{new Date(order.createdAt).toLocaleDateString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
`;

  // Use the native Windows \r\n explicitly before reassembling or keep \n since JSX handles both.
  const newContent = content.substring(0, startIndex) + newJsx + "\\n  );\\n}\\n";
  
  // Save with original EOLs possibly missing, but React doesn't care about \n vs \r\n mostly
  fs.writeFileSync(filename, newContent, 'utf-8');
  console.log("SUCCESSFULLY OVERWRITTEN FILE");
  
} catch (e) {
  console.error("Error modifying file:", e);
}
