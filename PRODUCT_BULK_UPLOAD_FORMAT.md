# Product Bulk Upload Excel Format

## Overview
This document describes the Excel file format required for bulk uploading products into the system.

## Column Headers (First Row)
The Excel sheet must have these column headers in the **first row**:

| Column Name | Data Type | Required | Description | Example |
|---|---|---|---|---|
| **Name** | Text | ✅ Yes | Product name | Snacks |
| **ProductGroup** | Text | ✅ Yes | Product group name (must exist in system) | Beverages |
| **ProductCategories** | Text | ❌ Optional | Comma-separated category names (can assign to multiple categories) | Cafe Products, Hotel Products |
| **PerQty** | Number | ✅ Yes | Quantity per unit/packet | 250 |
| **Units** | Text | ✅ Yes | Unit of measurement | kg, gm, ltr, ml, pcs, pckts, units |
| **TotalQty** | Number | ❌ Optional | Total quantity in stock | 50 |
| **PurchasingPrice** | Number | ❌ Optional | Cost price per unit | 80.00 |
| **SellingPrice** | Number | ❌ Optional | Sales price per unit (if not provided, calculated from Margin) | 120.00 |
| **HSNCode** | Text | ✅ Yes | HSN (Harmonized System of Nomenclature) code | 19051900 |
| **GST** | Number | ❌ Optional | GST percentage (0-28) | 5 |
| **Margin** | Number | ❌ Optional | Profit margin as percentage (if no SellingPrice provided, sells price auto-calculated) | 25 |

## Important Notes

### Required Fields
- **Name**: Must be unique per branch
- **ProductGroup**: Must already exist in Product Groups master data
- **PerQty**: Positive number for packaging quantity
- **Units**: Must be one of: `kg`, `gm`, `ltr`, `ml`, `pcs`, `pckts`, `units`
- **HSNCode**: Any value (cannot be empty)

### Optional Fields
- **ProductCategories**: Comma-separated list of existing category names (e.g., "Cafe Products, Hotel Products")
- **TotalQty**: Defaults to 0 if not provided
- **PurchasingPrice**: Defaults to 0 if not provided
- **SellingPrice**: Can be omitted if Margin is provided
- **GST**: Defaults to 0 if not provided (must be 0-28%)
- **Margin**: Used to calculate SellingPrice if not explicitly provided

### Price Calculation
**Choose ONE of these approaches:**

1. **If using SellingPrice column**: Provide the exact selling price
   - Margin column can be empty
   
2. **If using Margin column**: Provide margin percentage (calculated automatically)
   ```
   Selling Price = Purchasing Price + (Purchasing Price × Margin% / 100)
   ```
   - SellingPrice column can be empty
   - System will auto-calculate from PurchasingPrice & Margin

3. **Both provided**: SellingPrice takes priority (Margin is ignored)

### Example Excel Data

**Note:** ProductCategories is optional - you can assign a product to zero, one, or multiple categories!

```
| Name | ProductGroup | ProductCategories | PerQty | Units | TotalQty | PurchasingPrice | SellingPrice | HSNCode | GST | Margin |
|---|---|---|---|---|---|---|---|---|---|---|
| Snacks Pack | Snacks | Cafe Products | 250 | gm | 50 | 80.00 | 100.00 | 19051900 | 5 | |
| Coffee Beans | Beverages | Beverages products, Hotel Products | 500 | gm | 30 | 150.00 | | 21011090 | 5 | 20 |
| Bread | Bakery | Bakery products | 1 | pcs | 100 | 40.00 | 60.00 | 19053090 | 5 | |
| Hotel Service | Hotel | Hotel Products, Cafe Products | 1 | units | 200 | 100.00 | 150.00 | 62109090 | 18 | |
| Generic Item | Snacks | | 100 | pcs | 0 | 50.00 | 75.00 | 00000000 | 0 | |
```

**Key Example Insights:**
- **Coffee Beans**: Multiple categories separated by comma → `Beverages products, Hotel Products`
- **Hotel Service**: Can appear in multiple categories simultaneously
- **Generic Item**: No categories assigned (completely optional)

## Best Practices

1. **Create Product Groups & Categories First**
   - Use the "+ Product Group" and "+ Product Category" quick links
   - Ensure exact name matches (case-sensitive)

2. **File Format**
   - Save as `.xlsx` or `.xls` format
   - Use UTF-8 encoding for special characters
   - No extra rows or columns

3. **Data Validation**
   - Keep ProductGroup and ProductCategory names exactly as stored in system
   - Use numeric values for prices (not text)
   - GST must be between 0-28

4. **Error Handling**
   - If upload fails, check the error message for specific row issues
   - Duplicate products (same name + group) will be skipped
   - Invalid values will be skipped with reason

## Units Reference

| Unit Code | Description | Use Case |
|---|---|---|
| kg | Kilogram | Bulk items like flour, sugar |
| gm | Gram | Small quantities like spices |
| ltr | Liter | Liquids like oil, milk |
| ml | Milliliter | Small liquid quantities |
| pcs | Pieces | Individual items like cookies |
| pckts | Packets | Pre-packaged items |
| units | Generic units | Any countable item |

## Upload Process

1. Go to **Quick Links** → **+ Product**
2. Click **📤 Bulk Upload Products (Excel)**
3. Select your Excel file
4. System will:
   - Validate all rows
   - Skip invalid/duplicate items
   - Insert valid products with auto-calculated selling prices
   - Show count of inserted vs skipped items

## Troubleshooting

### "Product Group not found"
- Check ProductGroup spelling exactly matches system
- Create the product group first if it doesn't exist

### "Product Category not found"
- Check ProductCategory spelling exactly matches system
- Create the product category first if it doesn't exist

### "Invalid GST value"
- GST must be number between 0-28

### "Already exists"
- A product with same name and group already exists in this branch
- Use unique names or different groups

