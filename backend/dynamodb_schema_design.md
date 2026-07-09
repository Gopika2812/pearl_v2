# DynamoDB Single-Table Design Draft

To migrate the ~50 MongoDB collections into a single DynamoDB table, we must establish a consistent Partition Key (PK) and Sort Key (SK) strategy. Because data is mostly siloed per branch, we will use `BranchId` heavily in the PK.

## Table: `PearlERPTable`
- **PK** (String): Partition Key
- **SK** (String): Sort Key
- **GSI1PK** / **GSI1SK**: Global Secondary Index 1 (For secondary lookups like searching by name, GSTIN, or invoice dates).

### Entity: Branch
- **PK**: `BRANCH#<BranchId>`
- **SK**: `METADATA#<BranchId>`

### Entity: Product
- **PK**: `BRANCH#<BranchId>`
- **SK**: `PRODUCT#<ProductId>`
- **GSI1PK**: `BRANCH#<BranchId>`
- **GSI1SK**: `PRODUCT_NAME#<ProductName>` (For searching/sorting products by name)

### Entity: Customer
- **PK**: `BRANCH#<BranchId>`
- **SK**: `CUSTOMER#<CustomerId>`
- **GSI1PK**: `BRANCH#<BranchId>`
- **GSI1SK**: `CUSTOMER_NAME#<CustomerName>`

### Entity: Invoice
- **PK**: `BRANCH#<BranchId>`
- **SK**: `INVOICE#<InvoiceId>`
- **GSI1PK**: `CUSTOMER#<CustomerId>`
- **GSI1SK**: `INVOICE_DATE#<Date>` (To fetch all invoices for a specific customer)

### Entity: SalesOrder
- **PK**: `BRANCH#<BranchId>`
- **SK**: `SALES_ORDER#<OrderId>`
- **GSI1PK**: `CUSTOMER#<CustomerId>`
- **GSI1SK**: `ORDER_DATE#<Date>`

### Entity: ProductGroup / Category
- **PK**: `BRANCH#<BranchId>`
- **SK**: `PRODUCT_GROUP#<GroupId>`

## Access Patterns Addressed
1. **Get all products for a branch**: Query `PK = BRANCH#<BranchId>` and `SK begins_with "PRODUCT#"`
2. **Search products by name**: Query GSI1 `GSI1PK = BRANCH#<BranchId>` and `GSI1SK begins_with "PRODUCT_NAME#<SearchTerm>"`
3. **Get Customer Ledger (Invoices + Receipts)**: Query GSI1 `GSI1PK = CUSTOMER#<CustomerId>`. This will fetch invoices, receipts, and returns in a single query sorted by date if we use `GSI1SK = DATE#<Date>`.

This design effectively eliminates the need for MongoDB `$lookup` operations when fetching ledger data, as all related records for a customer are co-located in GSI1.
