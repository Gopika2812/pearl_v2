# ✅ Invoice System - Deployment Checklist

Use this checklist to ensure everything is properly deployed and tested.

---

## PRE-DEPLOYMENT (Before Going Live)

### Backend Setup
- [ ] Node.js and npm installed
- [ ] MongoDB connection verified (`MONGO_URI` in `.env`)
- [ ] Backend dependencies installed (`npm install`)
- [ ] No syntax errors in new files:
  - [ ] `backend/models/Invoice.js`
  - [ ] `backend/routes/invoiceRoutes.js`
- [ ] `backend/server.js` updated correctly:
  - [ ] Line 22: `import invoiceRoutes from "./routes/invoiceRoutes.js";`
  - [ ] Line 81: `app.use("/api/invoices", invoiceRoutes);`

### Frontend Files
- [ ] React installed and running (`npm run dev`)
- [ ] No syntax errors in new files:
  - [ ] `src/components/InvoiceGeneratorModal.jsx`
  - [ ] `src/pages/branch/BranchInvoicedOrders.jsx`
- [ ] Tailwind CSS available (used in InvoiceGeneratorModal)
- [ ] React Icons library available (FaEdit, FaPrint, FaWhatsapp, etc.)

### Documentation
- [ ] All 5 markdown files created:
  - [ ] `INVOICE_SYSTEM_README.md` (navigation guide)
  - [ ] `INVOICE_SYSTEM_SETUP.md` (quick start)
  - [ ] `INVOICE_GENERATION_GUIDE.md` (technical details)
  - [ ] `INVOICE_VISUAL_GUIDE.md` (layout examples)
  - [ ] `INVOICE_NEW_VS_OLD_SYSTEM.md` (comparison)

---

## BACKEND TESTING

### Start Backend
```bash
cd backend
npm start
# Should see: "Server running on 5000"
# Should see: "MongoDB Connected"
```
- [ ] Backend starts without errors
- [ ] MongoDB connection successful
- [ ] No "Cannot find module" errors
- [ ] Console shows no warnings for new routes

### Test API Endpoints
Using Postman or similar tool, test these:

```
GET /api/sales-orders?branchId=YOUR_BRANCH_ID
```
- [ ] Returns list of sales orders (200 OK)
- [ ] Each order has `_id`, `invoiceId`, `items`, `customer`

```
GET /api/invoices/prepare/SALES_ORDER_ID
```
- [ ] Returns sales order with `salesOrder` + `backOrderItems`
- [ ] No 404 errors
- [ ] Response includes financial year

```
POST /api/invoices/preview/SALES_ORDER_ID
Body: {
  items: [...],
  notes: "test note",
  invoiceType: "ORDER_DETAILS"
}
```
- [ ] Returns preview data (200 OK)
- [ ] Includes `subtotal`, `totalTax`, `grandTotal`
- [ ] Tax calculations correct

```
POST /api/invoices/finalize/SALES_ORDER_ID
Body: {
  items: [...],
  notes: "test note",
  invoiceType: "ORDER_DETAILS"
}
```
- [ ] Creates invoice in MongoDB (200 OK)
- [ ] Returns `invoice._id`, `invoiceNumber`
- [ ] Check MongoDB - new Invoice document exists
- [ ] SalesOrder `invoiceGenerated` = true

### Verify Database
Open MongoDB and check:
- [ ] New `invoices` collection created
- [ ] First invoice has all required fields
- [ ] `invoiceNumber`, `items`, `grandTotal` present
- [ ] No null/undefined critical fields

---

## FRONTEND TESTING

### Load Application
```bash
cd project_root
npm run dev
# Visit: http://localhost:5173
```
- [ ] App loads without errors
- [ ] No console errors about missing components
- [ ] Branch context available
- [ ] Navigation menu works

### Navigate to Feature
```
Branch Dashboard → Sales Orders to Invoice
```
- [ ] Page loads correctly
- [ ] Table shows sales orders
- [ ] "Generate Invoice" button visible
- [ ] Access to multiple sales orders

### Test Modal - EDIT TAB
- [ ] Click "Generate Invoice" on a sales order
- [ ] Modal opens without errors
- [ ] Shows 3 tabs: EDIT, PREVIEW, SUCCESS
- [ ] Quantity table displays all items
- [ ] Can edit quantities in input fields:
  - [ ] Type new number
  - [ ] Verify back order auto-updates
- [ ] Notes field is editable
- [ ] Invoice type radio buttons work:
  - [ ] Can select "Order Details"
  - [ ] Can select "Tax Invoice"
  - [ ] Can select "Back Order"
- [ ] Print checkbox works
- [ ] WhatsApp checkbox works
- [ ] "Generate Preview" button clickable

### Test Modal - PREVIEW TAB
- [ ] Click "Generate Preview"
- [ ] Modal switches to "PREVIEW" tab
- [ ] Summary cards display:
  - [ ] Subtotal
  - [ ] CGST/SGST
  - [ ] Grand Total
- [ ] Numbers are recalculated (not original amounts)
- [ ] Back order warning appears (if applicable)
- [ ] Format selector shows 3 options:
  - [ ] Order Details (default)
  - [ ] Tax Invoice
  - [ ] Back Order
- [ ] Can switch between formats
- [ ] "Finalize & Generate" button visible

### Test Modal - SUCCESS TAB
- [ ] Click "Finalize & Generate"
- [ ] Modal switches to "SUCCESS" tab
- [ ] Shows confirmation checkmark ✅
- [ ] Displays invoice number
- [ ] Displays grand total
- [ ] Print button clickable
- [ ] WhatsApp button clickable

### Test Print Feature
- [ ] Click "Print Invoice" button
- [ ] Browser print dialog opens
- [ ] Preview shows multiple pages:
  - [ ] Page 1: ORDER DETAILS
  - [ ] Page 2: TAX INVOICE (HSN-wise)
  - [ ] Page 3: BACK ORDER (if applicable)
- [ ] Content is readable
- [ ] Formatting is correct:
  - [ ] Header visible
  - [ ] Tables properly formatted
  - [ ] Numbers correctly aligned
  - [ ] Company logo/name present
- [ ] Can print to PDF
- [ ] PDF saves without errors
- [ ] PDF is readable

### Test WhatsApp Feature
- [ ] Click "Send via WhatsApp" button
- [ ] New browser tab opens (WhatsApp Web or app)
- [ ] Message is pre-filled with:
  - [ ] Invoice number
  - [ ] Invoice amount
  - [ ] Customer greeting
- [ ] Customer phone number is correct
- [ ] Message is readable and professional

### Test Modal - Additional Features
- [ ] Close button works (X in corner)
- [ ] Can close modal without finalized
- [ ] Multiple orders can be processed in sequence
- [ ] Refresh after closes automatically restarts

---

## EDGE CASE TESTING

### Quantity Editing
- [ ] Edit qty to 0 (zero):
  - [ ] Back order = original qty
  - [ ] Invoice should still generate (all back ordered)
- [ ] Edit qty to original (no change):
  - [ ] Back order = 0
  - [ ] Invoice has full amount
- [ ] Edit qty to values:
  - [ ] Between 0 and original: Works ✓
  - [ ] Greater than original: Capped to original ✓
  - [ ] Negative values: Not allowed ✓

### Tax Calculations
- [ ] With different tax percentages:
  - [ ] 5% tax: Recalculates correctly
  - [ ] 12% tax: Recalculates correctly
  - [ ] 0% tax: Shows 0 correctly
- [ ] Multiple items with different taxes: Sum is correct
- [ ] Rounding errors: No precision issues in totals

### Balance Calculations
- [ ] Opening balance = 0:
  - [ ] Closing balance = Grand Total ✓
- [ ] Opening balance = positive (customer owes):
  - [ ] Closing balance = opening + new amount ✓
- [ ] Opening balance = negative (credit):
  - [ ] Closing balance = opening + new amount ✓

### Sample Items
- [ ] Order with sample items displays them
- [ ] Sample section marked "NOT BILLED"
- [ ] Sample qty doesn't affect totals
- [ ] Sample items appear in Order Details format
- [ ] Sample items NOT in Tax Invoice

### Back Orders
- [ ] When back order qty > 0:
  - [ ] Back order section visible ✓
  - [ ] Back order format shows in formats
  - [ ] Warning appears in preview ✓
- [ ] When back order qty = 0:
  - [ ] No warning displayed ✓
  - [ ] Back order format not in print ✓

---

## DATABASE INTEGRITY TESTING

After generating 5 test invoices:

### Check Invoices Collection
```javascript
db.invoices.find()
```
- [ ] 5 documents created
- [ ] Each has unique `invoiceNumber`
- [ ] Each references a `salesOrderId`
- [ ] Status is "FINALIZED"
- [ ] All monetary fields are numbers (not strings)
- [ ] No null critical fields

### Check SalesOrder Collection
```javascript
db.salesorders.find({invoiceGenerated: true})
```
- [ ] 5 orders marked as `invoiceGenerated: true`
- [ ] Invoice notes saved correctly
- [ ] Original items unchanged
- [ ] No duplicate orders created

### Verify Relationships
```javascript
db.invoices.findOne({_id: "..."})
```
- [ ] Can find original salesOrderId
- [ ] Can find branchId
- [ ] Can find customer info
- [ ] Seller info populated
- [ ] All back order items tracked

---

## PERFORMANCE TESTING

### Load Testing
- [ ] Generate 10 invoices in 5 minutes:
  - [ ] No timeout errors ✓
  - [ ] Modal remains responsive ✓
  - [ ] Print still works ✓
- [ ] Print 5 invoices in sequence:
  - [ ] No memory leaks ✓
  - [ ] Browser remains responsive ✓

### API Response Times
Using browser developer tools (Network tab):

- [ ] `/prepare` endpoint: < 500ms
- [ ] `/preview` endpoint: < 500ms
- [ ] `/finalize` endpoint: < 1000ms
- [ ] No 504 timeout errors

### Browser Compatibility
- [ ] Chrome / Edge: Works ✓
- [ ] Firefox: Works ✓
- [ ] Safari: Works ✓
- [ ] Mobile browser: Responsive ✓

---

## TEAM TRAINING CHECKLIST

Once deployed, train your team:

### Trainer Setup
- [ ] Trainer has tested system
- [ ] Trainer understands 3-step process
- [ ] Trainer can explain each format
- [ ] Documentation available for reference

### User Training
For each team member:
- [ ] Read INVOICE_SYSTEM_SETUP.md (5 min)
- [ ] Watch demo of Generate Invoice flow (5 min)
- [ ] Practice with 3 test orders (10 min)
- [ ] Ask questions and clarify
- [ ] Sign off that they understand

### Team Knowledge
- [ ] All users know how to access feature
- [ ] All users know how to edit quantities
- [ ] All users know how to add notes
- [ ] All users know how to print
- [ ] All users know how to share via WhatsApp
- [ ] All users know what each format is for
- [ ] All users know how to handle errors

---

## PRODUCTION DEPLOYMENT

### Before Going Live
- [ ] All tests above passed ✅
- [ ] Team trained and confident
- [ ] Backup created of MongoDB
- [ ] Documented company details (GSTIN, phone, etc.)
- [ ] Test email configured (optional)

### Go Live
- [ ] Updated code pushed to production
- [ ] Backend restarted
- [ ] Frontend redeployed
- [ ] Tested one invoice end-to-end in production
- [ ] Team informed of rollout

### Post-Launch Monitoring (First Week)
- [ ] Check backend logs for errors
- [ ] Monitor MongoDB disk space
- [ ] Verify invoices are saving
- [ ] Collect team feedback
- [ ] Fix any issues quickly
- [ ] Document any customizations

### Success Metrics
After 1 week, you should see:
- ✅ 10+ invoices generated
- ✅ Zero printing failures
- ✅ Team confident in process
- ✅ Time per invoice < 2 minutes
- ✅ No data errors

---

## ROLLBACK PLAN

If issues occur:

### Immediate Rollback
```bash
# Stop the backend
# Revert server.js to previous version
# Remove invoiceRoutes import and usage
# Restart backend
```

### Database Safety
- [ ] No data loss (Invoice docs are new)
- [ ] SalesOrders are duplicated (have backup)
- [ ] No dependencies broken

### User Communication
- [ ] Notify team of temporary rollback
- [ ] Estimate fix time
- [ ] Provide workaround if needed

---

## SIGN-OFF CHECKLIST

Project Manager Sign-off:
- [ ] All systems tested
- [ ] Documentation complete
- [ ] Team trained
- [ ] Production ready

Developer Sign-off:
- [ ] Code tested and working
- [ ] No critical bugs
- [ ] Database schema sound
- [ ] Error handling in place

Team Lead Sign-off:
- [ ] Team capable of using
- [ ] Support available
- [ ] Feedback mechanism in place

---

## ONGOING MAINTENANCE

### Weekly
- [ ] Check error logs
- [ ] Monitor database size
- [ ] Answer user questions

### Monthly
- [ ] Review invoice statistics
- [ ] Gather improvement feedback
- [ ] Plan enhancements

### Quarterly
- [ ] Consider new formats if needed
- [ ] Update documentation
- [ ] Plan archival of old invoices

---

## Final Checklist Summary

**Total Items:** 150+

**Critical Path:**
- [ ] Backend tests pass (≥80%)
- [ ] Frontend tests pass (≥80%)
- [ ] Database tests pass (100%)
- [ ] Team training complete
- [ ] Production deployment go/no-go

**Status:** ✅ Ready for Deployment

---

**Last Updated:** March 2026  
**Maintained By:** Your Development Team  
**Next Review:** March 2027  
