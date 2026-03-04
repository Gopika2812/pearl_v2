# Customer Bulk Upload Excel Format

## Overview
This document describes the Excel file format required for bulk uploading customers into the system.

## Column Headers (First Row)
The Excel sheet must have these column headers in the **first row**:

| Column Name | Data Type | Required | Description | Example |
|---|---|---|---|---|
| **CustomerName** | Text | ✅ Yes | Customer's full name (must be unique per branch) | Rajesh Kumar |
| **WhatsApp** | Text | ❌ Optional | WhatsApp phone number | 9876543210 |
| **Email** | Text | ❌ Optional | Customer's email address | rajesh@example.com |
| **Address** | Text | ❌ Optional | Complete address | 123 Main Street, Downtown |
| **District** | Text | ❌ Optional | District/City name | Mumbai |
| **State** | Text | ❌ Optional | State/Province name | Maharashtra |
| **Country** | Text | ❌ Optional | Country name | India |
| **Pincode** | Text | ❌ Optional | Postal/ZIP code | 400001 |
| **RegistrationType** | Text | ❌ Optional | regular or unregistered | regular |
| **GSTIN** | Text | ❌ Optional | Goods and Services Tax Identification Number | 27AABCD1234H1Z0 |
| **CustomerCategories** | Text | ❌ Optional | Comma-separated category names (must exist in system) | Retail,Wholesale |
| **CustomerGroups** | Text | ❌ Optional | Comma-separated group names (must exist in system) | Premium Customers,VIP |
| **SalesOwner** | Text | ❌ Optional | Sales owner name (must exist in system) | John Smith |
| **Margin** | Number | ❌ Optional | Profit margin as percentage (positive/negative) | 15.5 |
| **Credit** | Number | ❌ Optional | Credit amount for customer account | 10000.00 |
| **Debit** | Number | ❌ Optional | Debit amount for customer account | 5000.00 |
| **AccountHolder** | Text | ❌ Optional | Bank account holder's name | Rajesh Kumar |
| **AccountNumber** | Text | ❌ Optional | Bank account number | 1234567890123456 |
| **IFSC** | Text | ❌ Optional | IFSC code for bank | ABCD0001234 |
| **Branch** | Text | ❌ Optional | Bank branch name | Mumbai Main Branch |
| **UPI** | Text | ❌ Optional | UPI address for digital payments | rajesh@upi |

## Important Notes

### Required Fields
- **CustomerName**: Must be unique per branch

### Optional Fields
- **WhatsApp**: Phone number (optional)
- **Email**: Email address (optional)
- **Address**: Physical address (optional)
- **District, State, Country, Pincode**: Location details (optional)
- **RegistrationType**: Either "regular" or "unregistered" (default: regular)
- **GSTIN**: GST identification number (optional)
- **CustomerCategories**: Multiple categories separated by commas. All must exist in system  
  Example: `Retail,Wholesale,E-commerce`
- **CustomerGroups**: Multiple groups separated by commas. All must exist in system  
  Example: `Premium Customers,VIP,Preferred`
- **SalesOwner**: Must exist in system if provided (case-insensitive)
- **Margin**: Can be positive, negative, or zero  
  Example: `15.5`, `-5`, `0`
- **Credit**: Account credit amount (can be 0)
- **Debit**: Account debit amount (can be 0)
- **AccountHolder**: Bank account holder name (optional)
- **AccountNumber**: Valid bank account number (optional)
- **IFSC**: Bank IFSC code (optional)
- **Branch**: Bank branch name (optional)
- **UPI**: Digital payment address (optional)

### Customer Category, Customer Group & Sales Owner Lookup
- **CustomerCategory**: System will lookup by name (case-insensitive). If the category doesn't exist, the row will be skipped.
- **CustomerGroup**: System will lookup by name (case-insensitive). If the group doesn't exist, the row will be skipped.
- **SalesOwner**: System will lookup by name (case-insensitive). If the sales owner doesn't exist, the row will be skipped.
- All three fields are **optional** - leave blank if not assigning to any category, group, or owner.

### Duplicate Handling
- **CustomerName** + Branch = Unique (cannot upload duplicate customer name in same branch)
- **WhatsApp** + Branch = Unique only if provided (if a customer has WhatsApp, no other customer in same branch can have same WhatsApp)
- If row has duplicate name or WhatsApp, it will be **skipped** with reason in upload report

## Example Excel Data

```
| CustomerName | WhatsApp | Email | Address | District | State | Pincode | GSTIN | CustomerCategory | SalesOwner | Margin | ClosingBalance | AccountHolderName | AccountNumber | IFSC | Branch | UPI |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Rajesh Kumar | 9876543210 | rajesh@example.com | 123 Main Street | Mumbai | Maharashtra | 400001 | 27AABCD1234H1Z0 | Retail | John Smith | 15.5 | 5000 | Rajesh Kumar | 1234567890123456 | ABCD0001234 | Mumbai Main | rajesh@upi |
| Priya Singh | 9876543211 | priya@example.com | 456 Park Ave | Bangalore | Karnataka | 560001 | | Wholesale | Jane Doe | 10 | 0 | Priya Singh | 9876543210123456 | DEFG0001234 | Bangalore Branch | |
| ABC Restaurant | 9876543212 | | 789 Food Street | Pune | Maharashtra | 411001 | 27XYZL1234Z0Z0 | Corporate | | 20 | 15000 | Admin ABC | 1111111111111111 | HIJK0001234 | Pune Branch | abc@upi |
| Simple Customer | 9876543213 | simple@email.com | | | | | | | | | 0 | Simple Customer | 2222222222222222 | LMNO0001234 | Default Branch | |
```

## Key Example Insights

| Example | Notes |
|---------|-------|
| **Rajesh Kumar** | Full data: All fields populated, belongs to "Retail" category, assigned to "John Smith" |
| **Priya Singh** | Missing GSTIN & UPI but has category & sales owner, positive margin (10%) |
| **ABC Restaurant** | Corporate customer, no sales owner assigned (left blank), higher margin (20%) |
| **Simple Customer** | Minimal data: Only required CustomerName field, everything else can be empty |
| **Just a Name** | Absolute minimum: Only CustomerName provided, no other fields needed |

## Upload Response

**Success:**
```json
{
  "message": "Bulk customer upload completed",
  "insertedCount": 3,
  "skippedCount": 1,
  "skipped": [
    {
      "row": {...},
      "reason": "Customer already exists"
    }
  ]
}
```

**Common Skipped Reasons:**
- ❌ Missing customer name
- ❌ Duplicate customer name in same branch
- ❌ Duplicate WhatsApp number (if WhatsApp was provided)
- ❌ Duplicate WhatsApp in same branch
- ❌ Customer Category not found (if provided)
- ❌ Sales Owner not found (if provided)
- ❌ Invalid email format (if provided)

## Best Practices

1. **Always backup data** before bulk upload
2. **Validate phone numbers** - Must be 10+ digits
3. **Test with small batch first** - Upload 5-10 customers to verify format
4. **Setup categories first** - Create CustomerCategories before bulk uploading
5. **Ensure sales owners exist** - Create SalesOwners before assigning to customers
6. **Avoid special characters** in sensitive fields (like IFSC)
7. **Keep category names consistent** - Use exact names as in system
8. **Check margin values** - Can be positive or negative

## Troubleshooting

| Error | Cause | Solution |
|-------|-------|----------|
| "All rows skipped" | Missing required columns | Check column headers match exactly |
| "Customer already exists" | Duplicate customer name or WhatsApp | Ensure name & WhatsApp are unique |
| "Category not found" | Category name doesn't exist in system | Create category first or use exact name |
| "Sales Owner not found" | Sales owner name doesn't match | Use exact name from system |
| "Invalid file format" | Not an Excel file | Use .xlsx or .xls format |
| "branchId is required" | Frontend not sending branch ID | Ensure branch is selected before upload |

## Tips for Large Uploads

- **For 1000+ customers**: Split into multiple Excel files (100-500 per file)
- **Use copy-paste**: Easier than typing in all data manually
- **Prepare in template**: Use copy of previous upload as template
- **Verify phone numbers**: Use formula `=TEXT(A1,"0000000000")` in Excel
- **Save before upload**: Keep backup of Excel file

