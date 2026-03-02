# Customer Category Bulk Upload Excel Format

## Overview
This document describes the Excel file format required for bulk uploading customer categories into the system.

## Column Headers (First Row)
The Excel sheet must have these column headers in the **first row**:

| Column Name | Data Type | Required | Description | Example |
|---|---|---|---|---|
| **Name** | Text | ✅ Yes | Category name (must be unique per branch) | Retail |
| **Description** | Text | ❌ Optional | Category description | Local retail customers |

**Alternative Column Name:**
- The column can be named either **Name** or **CustomerCategory** - both work the same way

## Important Notes

### Required Fields
- **Name** (or CustomerCategory): Must be provided and unique per branch

### Optional Fields
- **Description**: Additional notes about the category

### Duplicate Handling
- **Name** + Branch = Unique (cannot upload duplicate category name in same branch)
- Duplicate rows will be **skipped** with reason "Already exists"

## Example Excel Data

### Minimum Format (Only Name)
```
| Name |
|---|
| Retail |
| Wholesale |
| Corporate |
| Ready Cash Customers |
```

### Full Format (With Description)
```
| Name | Description |
|---|---|
| Retail | Small retail shop customers |
| Wholesale | Bulk buyers and distributors |
| Corporate | Companies and organizations |
| Ready Cash Customers | Customers paying cash at delivery |
| Online | E-commerce customers |
```

### Alternative Format (Using CustomerCategory Column)
```
| CustomerCategory | Description |
|---|---|
| Retail | Small retail shop customers |
| Wholesale | Bulk buyers and distributors |
| Premium | High-value customers with special rates |
```

## Upload Response

**Success:**
```json
{
  "message": "Bulk upload completed",
  "insertedCount": 3,
  "skippedCount": 1,
  "skipped": [
    {
      "row": {"Name": "Retail", "Description": "..."},
      "reason": "Already exists"
    }
  ]
}
```

**Common Skipped Reasons:**
- ❌ Missing customer category name
- ❌ Category already exists in this branch (duplicate)

## Quick Tips

1. **Simplest Format**: Just create one column "Name" with your category names
2. **Column Name Flexibility**: You can use either "Name" or "CustomerCategory" as the column header
3. **Add Descriptions**: Optional second column "Description" for category details
4. **One Sheet Only**: Upload will use the first sheet in your Excel file
5. **No Empty Rows**: Skip any blank rows - they will be skipped automatically

## Common Mistakes to Avoid

❌ **Wrong column name**: Using "Category" instead of "Name" or "CustomerCategory"  
✅ **Correct**: "Name" or "CustomerCategory"

❌ **Duplicate names in same file**: Will skip duplicates in upload  
✅ **Correct**: Each category name appears only once

❌ **Special characters in Name**: May cause issues  
✅ **Correct**: Use simple names like "Retail", "Wholesale"
