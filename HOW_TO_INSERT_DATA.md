# How to Insert Branches and Login Data

## Overview
This guide explains how to add branches and user login credentials to the Pearl ERP system.

---

## Prerequisites

1. **Backend running:** `npm run dev` in `backend/` folder
2. **MongoDB connection:** Verify in console: "MongoDB Connected"
3. **API Base URL:** `http://localhost:5000` (local) or your Render URL (production)

---

## Step 1: Install Required Dependencies

Run this once in backend folder:

```bash
cd backend
npm install
```

This installs `bcryptjs` for password hashing.

---

## Step 2: Create a Branch

### Method A: Using Postman/cURL

**POST** `http://localhost:5000/api/branches`

```json
{
  "name": "Pearl Foods & Frozen - Tirunelveli",
  "code": "PF-TRV",
  "location": "Tirunelveli",
  "address": "Main Head Office, Tirunelveli, Tamil Nadu",
  "phone": "9429692970",
  "email": "tirunelveli@pearlfood.com",
  "manager": "Manager Name",
  "isMainBranch": true,
  "status": "ACTIVE"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Branch created successfully",
  "data": {
    "_id": "65f1a2b3c4d5e6f7g8h9i0j1",
    "name": "Pearl Foods & Frozen - Tirunelveli",
    "code": "PF-TRV",
    ...
  }
}
```

### Method B: Using Browser Console

```javascript
fetch('http://localhost:5000/api/branches', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: "Pearl Foods & Frozen - Tirunelveli",
    code: "PF-TRV",
    location: "Tirunelveli",
    address: "Main Head Office, Tirunelveli",
    phone: "9429692970",
    email: "tirunelveli@pearlfood.com",
    manager: "Manager Name",
    isMainBranch: true,
    status: "ACTIVE"
  })
})
.then(res => res.json())
.then(data => {
  console.log("Branch created:", data.data._id);
  // Save this ID for next step!
})
```

### Branch Fields Explanation

| Field | Type | Required | Example |
|-------|------|----------|---------|
| name | String | ✅ Yes | "Pearl Foods & Frozen - Tirunelveli" |
| code | String | ✅ Yes | "PF-TRV" (uppercase, unique) |
| location | String | ❌ No | "Tirunelveli" |
| address | String | ❌ No | "Main Office Street, City" |
| phone | String | ❌ No | "9429692970" |
| email | String | ❌ No | "tirunelveli@pearlfood.com" |
| manager | String | ❌ No | "Manager Name" |
| isMainBranch | Boolean | ❌ No | true/false |
| status | String | ❌ No | "ACTIVE" or "INACTIVE" |

---

## Step 3: Get Branch ID

After creating the branch, save the `_id` from the response. This is needed for login credentials.

**Or fetch existing branches:**

```bash
GET http://localhost:5000/api/branches
```

Response shows all branches with their IDs.

---

## Step 4: Create Login User for Branch

### Method A: Using Postman/cURL

**POST** `http://localhost:5000/api/branch-users/register`

```json
{
  "username": "admin",
  "password": "password123",
  "email": "admin@pearlfood.com",
  "branchId": "65f1a2b3c4d5e6f7g8h9i0j1",
  "role": "ADMIN"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "id": "65f2a2b3c4d5e6f7g8h9i0j2",
    "username": "admin",
    "email": "admin@pearlfood.com",
    "branch": "Pearl Foods & Frozen - Tirunelveli",
    "role": "ADMIN"
  }
}
```

### Method B: Using Browser Console

```javascript
fetch('http://localhost:5000/api/branch-users/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    username: "admin",
    password: "password123",
    email: "admin@pearlfood.com",
    branchId: "65f1a2b3c4d5e6f7g8h9i0j1",  // From step 3
    role: "ADMIN"
  })
})
.then(res => res.json())
.then(data => console.log("User created:", data))
```

### User Fields Explanation

| Field | Type | Required | Example | Values |
|-------|------|----------|---------|--------|
| username | String | ✅ Yes | "admin" | Unique, lowercase |
| password | String | ✅ Yes | "password123" | Min 6 chars, hashed |
| email | String | ❌ No | "admin@email.com" | Valid email |
| branchId | String | ✅ Yes | "65f1a2b3c4d5..." | Branch _id |
| role | String | ❌ No | "ADMIN" | ADMIN, MANAGER, STAFF |

---

## Step 5: Test Login

### Method A: Using Postman

**POST** `http://localhost:5000/api/branch-users/login`

```json
{
  "username": "admin",
  "password": "password123"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "id": "65f2a2b3c4d5e6f7g8h9i0j2",
    "username": "admin",
    "email": "admin@pearlfood.com",
    "branch": {
      "id": "65f1a2b3c4d5e6f7g8h9i0j1",
      "name": "Pearl Foods & Frozen - Tirunelveli",
      "code": "PF-TRV",
      "location": "Tirunelveli"
    },
    "role": "ADMIN"
  }
}
```

### Method B: Using App Login Page

1. Go to `http://localhost:5173/branch-login`
2. Select "Pearl Foods & Frozen - Tirunelveli" from dropdown
3. Enter username: `admin`
4. Enter password: `password123`
5. Click "Login"

---

## Complete Example: Add 2 Branches with Users

### Step 1: Create Main Branch

```bash
curl -X POST http://localhost:5000/api/branches \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Pearl Foods & Frozen - Tirunelveli",
    "code": "PF-TRV",
    "location": "Tirunelveli",
    "address": "Main Head Office, Tirunelveli",
    "phone": "9429692970",
    "email": "tirunelveli@pearlfood.com",
    "manager": "Ramesh Kumar",
    "isMainBranch": true,
    "status": "ACTIVE"
  }'
```

**Save the `_id` from response** → Let's say it's `BRANCH1_ID`

### Step 2: Create Admin User for Main Branch

```bash
curl -X POST http://localhost:5000/api/branch-users/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "tirunelveli_admin",
    "password": "secure@123",
    "email": "admin@tirunelveli.com",
    "branchId": "BRANCH1_ID",
    "role": "ADMIN"
  }'
```

### Step 3: Create Secondary Branch

```bash
curl -X POST http://localhost:5000/api/branches \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Pearl Foods & Frozen - Nagercoil",
    "code": "PF-NGC",
    "location": "Nagercoil",
    "address": "Branch Office, Nagercoil",
    "phone": "9429692971",
    "email": "nagercoil@pearlfood.com",
    "manager": "Suresh Kumar",
    "isMainBranch": false,
    "status": "ACTIVE"
  }'
```

**Save the `_id`** → Let's say it's `BRANCH2_ID`

### Step 4: Create Users for Secondary Branch

```bash
# Manager user
curl -X POST http://localhost:5000/api/branch-users/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "nagercoil_manager",
    "password": "secure@123",
    "email": "manager@nagercoil.com",
    "branchId": "BRANCH2_ID",
    "role": "MANAGER"
  }'

# Staff user
curl -X POST http://localhost:5000/api/branch-users/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "nagercoil_staff",
    "password": "secure@123",
    "email": "staff@nagercoil.com",
    "branchId": "BRANCH2_ID",
    "role": "STAFF"
  }'
```

---

## API Endpoints Summary

### Branches
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/branches` | Get all active branches |
| GET | `/api/branches/:id` | Get single branch |
| POST | `/api/branches` | Create new branch |
| PUT | `/api/branches/:id` | Update branch |
| DELETE | `/api/branches/:id` | Delete branch |

### Branch Users
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/branch-users/register` | Register new user |
| POST | `/api/branch-users/login` | Login user |
| GET | `/api/branch-users/:id` | Get user by ID |
| GET | `/api/branch-users/branch/:branchId` | Get all users in branch |
| PUT | `/api/branch-users/:id` | Update user |
| DELETE | `/api/branch-users/:id` | Delete user |

---

## Troubleshooting

### Error: "Branch not found"
- Verify branch ID is correct
- Use `/api/branches` to get valid IDs

### Error: "Username already exists"
- Use a unique username
- Usernames are case-insensitive

### Error: "Invalid username or password"
- Double-check spelling
- Password is case-sensitive
- Verify user exists with GET endpoint

### Error: "MongoDB not connected"
- Check `MONGO_URI` in `.env`
- Start MongoDB service
- Restart backend server

---

## Next Steps

1. ✅ Create branches
2. ✅ Create users
3. 🔄 Update BranchLoginPage to use real login endpoint
4. 🔄 Add role-based access control (RBAC)
5. 🔄 Add JWT tokens for session management

---

## Security Notes

⚠️ **Important:**

1. **Passwords** are hashed with bcryptjs (not stored plain)
2. **Never share** production credentials
3. **Update** default passwords regularly
4. **Use HTTPS** in production
5. **Consider** JWT tokens for API calls

---

**Version**: 1.0  
**Date**: March 1, 2026
