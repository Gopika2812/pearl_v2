# Multi-Branch Login System - Setup Guide

## Overview

This document explains how to set up and manage multiple branches in the Pearl ERP system. Each branch operates with its own login and can access branch-specific data.

---

## Architecture

### Frontend Components

1. **BranchLoginPage** (`/branch-login`)
   - Left sidebar: Branch selection dropdown with branch details
   - Right side: Login form (username & password)
   - Displays branch name, location, address, phone, manager

2. **BranchContext** (`src/context/BranchContext.jsx`)
   - Manages selected branch globally
   - Manages user authentication state
   - Persists data in localStorage

3. **Updated Topbar**
   - Shows current branch name and code
   - "Switch Branch" option to go back to login
   - Logout functionality

### Backend Components

1. **Branch Model** (`backend/models/Branch.js`)
   - `name`: Branch display name
   - `code`: Unique branch code (e.g., "PF-TRV")
   - `location`: Branch location
   - `address`: Full address
   - `phone`: Branch phone number
   - `email`: Branch email
   - `manager`: Branch manager name
   - `status`: ACTIVE/INACTIVE
   - `color`: Branch theme color (for future UI customization)
   - `isMainBranch`: Boolean to mark main branch

2. **Branch Routes** (`backend/routes/branchRoutes.js`)
   - `GET /api/branches` - Fetch all active branches
   - `GET /api/branches/:id` - Fetch single branch
   - `POST /api/branches` - Create new branch
   - `PUT /api/branches/:id` - Update branch
   - `DELETE /api/branches/:id` - Delete branch

---

## Setup Instructions

### 1. Initialize Backend Routes

The branch routes are already integrated into `server.js`. No additional setup needed.

### 2. Initialize Database with Main Branch

Run this once to add the main branch:

```bash
# In your MongoDB or via API
POST /api/branches
{
  "name": "Pearl Foods & Frozen - Tirunelveli",
  "code": "PF-TRV",
  "location": "Tirunelveli",
  "address": "Main Office, Tirunelveli",
  "phone": "9429692970",
  "email": "tirunelveli@pearlfood.com",
  "manager": "Branch Manager",
  "isMainBranch": true,
  "status": "ACTIVE"
}
```

Or use the initialization script:

```javascript
// In backend/server.js (temporary)
import { initializeBranches } from "./utils/branchInitialization.js";

// Add this in MongoDB connection callback
initializeBranches();
```

Then comment it out after first run.

### 3. Deploy Frontend & Backend

```bash
# Backend
git push  # Render auto-deploys

# Frontend
npm run build
firebase deploy
```

---

## How to Use

### For Users

1. Go to `/branch-login`
2. Select your branch from dropdown
3. Enter username and password
4. Click "Login"
5. You'll be redirected to home with branch context active

### For Admins - Adding a New Branch

1. Use the API to add a new branch:

```bash
curl -X POST http://api.example.com/api/branches \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Pearl Foods & Frozen - Nagercoil",
    "code": "PF-NGC",
    "location": "Nagercoil",
    "address": "Branch Office, Nagercoil",
    "phone": "9429692971",
    "email": "nagercoil@pearlfood.com",
    "manager": "Manager Name",
    "isMainBranch": false,
    "status": "ACTIVE"
  }'
```

2. The branch will appear in the dropdown on next page load

---

## Branch-Specific Features (To Implement)

Currently, the system stores the selected branch. To make it fully functional:

### 1. Update Customer Model
```javascript
{
  branch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Branch"
  }
}
```

### 2. Filter Queries by Branch
```javascript
// In routes
const customers = await Customer.find({ 
  branch: req.user.branchId 
});
```

### 3. Update Sales Orders, Purchase Orders, etc.
Add branch reference to all transactional models.

---

## File Structure

```
backend/
  models/Brand.js                    ← New: Branch model
  routes/branchRoutes.js             ← New: Branch API routes
  utils/branchInitialization.js      ← New: Setup script

src/
  context/BranchContext.jsx          ← New: Branch state management
  pages/BranchLoginPage.jsx          ← New: Multi-branch login UI
  components/Topbar.jsx              ← Updated: Shows current branch
  App.jsx                            ← Updated: Added BranchProvider, /branch-login route
```

---

## Context API Usage

```javascript
import { useBranch } from "../context/BranchContext";

function MyComponent() {
  const { currentBranch, user, switchBranch, logout } = useBranch();
  
  // Use branch data
  return <div>{currentBranch?.name}</div>;
}
```

---

## Database Data Flow

1. **Login** → Fetch branch from `/api/branches/:id`
2. **Store** → Save in localStorage via BranchContext
3. **Use** → Access via `useBranch()` hook in components
4. **Filter** → Pass branchId to backend queries
5. **Logout** → Clear context and localStorage

---

## Security Considerations

⚠️ **Current State**: Basic implementation without backend authentication

To improve security:

1. **Add JWT Authentication**
   - Verify username/password against user database
   - Include branchId in JWT token
   - Validate branchId on all requests

2. **Backend Validation**
   - Verify user has access to requested branch
   - Filter all queries by branch

3. **User-Branch Mapping**
   - Create UserBranch model to map users to branches
   - Some users might access multiple branches

---

## Next Steps

1. ✅ Set up branch model and routes
2. ✅ Create BranchLoginPage
3. ✅ Create BranchContext
4. ✅ Update Topbar
5. 🔄 Add authentication (username/password validation)
6. 🔄 Update all data models to include branch reference
7. 🔄 Update all queries to filter by branch
8. 🔄 Create branch management admin page

---

## Questions?

For setting up additional branches or troubleshooting:

1. Verify branch exists: `GET /api/branches`
2. Check localStorage in browser DevTools
3. Verify BranchContext is wrapping the app
4. Check browser console for errors

---

**Version**: 1.0  
**Last Updated**: March 1, 2026
