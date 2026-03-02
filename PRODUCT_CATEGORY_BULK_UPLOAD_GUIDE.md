# Product Category Bulk Upload Guide

## Overview
The Product Category feature allows you to quickly create multiple product categories using Excel bulk uploads, similar to the Product Group functionality.

## Quick Links Access
You can access the Product Category creation from:
- **BranchQuickLinks** → Click "Product Category" button
- **InventorySalesOrder** → Click "+ Category" button  
- **InventoryPurchaseOrder** → Click "+ Product Category" button

## How It Works

### Single Entry
1. Click the Product Category quick link
2. Enter the category name (e.g., "Fresh", "Organic", "Premium")
3. Click "Save"

### Bulk Upload via Excel
1. Click the Product Category quick link
2. Click the **Bulk Upload** section in the modal
3. Select an Excel file (.xlsx or .xls) with the following format:

## Excel Format

### Column Headers (Required)
- **Name** - The product category name (required)
- **Description** - Optional description of the category

### Example Format

| Name        | Description                    |
|-------------|--------------------------------|
| Fresh       | Freshly harvested items        |
| Organic     | Certified organic products     |
| Premium     | Premium quality items          |
| Budget      | Cost-effective options         |
| Seasonal    | Limited time offerings         |

## File Requirements

- **Format**: Excel (.xlsx or .xls)
- **Encoding**: UTF-8 (standard)
- **Headers**: Must include "Name" column
- **Max File Size**: 50MB
- **Max Rows**: Unlimited (but practical limit is ~1000 per upload)

## Features

✅ **Branch-Scoped**: Each category belongs to a specific branch
✅ **Duplicate Prevention**: Cannot create same category name within same branch
✅ **Bulk Processing**: Upload multiple categories at once
✅ **Error Handling**: Reports skipped rows with reasons
✅ **Success Summary**: Shows inserted count and skipped count

## Validation Rules

- Category name is required
- Maximum 1 category per row
- Duplicate names within the same branch are skipped
- Invalid rows are reported with error message

## API Endpoints

**Backend Routes**:
- `GET /api/product-categories` - Fetch categories (requires branchId query param)
- `POST /api/product-categories` - Create single category
- `POST /api/product-categories/bulk-upload` - Bulk upload via Excel
- `PUT /api/product-categories/:id` - Update category
- `DELETE /api/product-categories/:id` - Delete category

## Database Model

**ProductCategory** document structure:
```json
{
  "_id": "ObjectId",
  "branchId": "ObjectId (required)",
  "name": "String (required, unique per branch)",
  "description": "String (optional)",
  "createdAt": "Timestamp",
  "updatedAt": "Timestamp"
}
```

**Unique Index**: `{ branchId: 1, name: 1 }`
- Allows same category name in different branches
- Prevents duplicates within same branch

## Examples

### Valid Upload
```
Name        | Description
Fresh       | Freshly harvested items
Organic     | Certified organic products
```
✅ Result: 2 categories created

### Invalid Upload with Errors
```
Name        | Description
Fresh       | Freshly harvested items
Fresh       | Duplicate name
            | Missing name (skipped)
```
⚠️ Result: 1 created, 2 skipped

## Common Issues

**"branchId is required"**
- Make sure you're logged into a branch first
- The modal should automatically detect your branch

**"Category already exists in this branch"**
- The category name already exists for your current branch
- Try a different name or check if it was already created

**"Excel file required"**
- No file was selected
- Click the upload area and select a valid Excel file

## Tips

1. **Prepare your data**: Organize all categories before uploading
2. **Use consistent naming**: Avoid variations like "fresh" vs "Fresh"
3. **Test with small batches**: Upload a few categories first to test
4. **Check the report**: Review the success/skip summary after each upload
5. **Bulk is faster**: For 10+ categories, use bulk upload instead of individual entries

## Related Features

- **Product Groups**: Similar bulk upload feature for grouping products
- **Products**: Use categories when adding products
- **Branch Scoping**: Each branch has independent categories

## Support

For issues with bulk uploads or category management, check:
- Network connectivity
- File format (must be Excel)
- Branch selection (must have a branch selected)
- File size (max 50MB)
