# JWT & Role-Based Access Control (RBAC) Implementation Guide

## ✅ What I've Created

### Backend Files:
1. **`/backend/middleware/auth.js`** - JWT verification middleware
2. **`/backend/middleware/rbac.js`** - Role-based access control middleware
3. **Updated `/backend/routes/branchUserRoutes.js`** - Login endpoint now issues JWT tokens

### Frontend Files:
1. **`/src/hooks/useAuth.js`** - Authentication hook for managing login/logout
2. **`/src/components/ProtectedRoute.jsx`** - Route guard component
3. **`/src/utils/apiWithAuth.js`** - API utility that automatically adds JWT to requests

---

## 📋 Setup Instructions

### Step 1: Install JWT Package (Backend)
```bash
cd d:\pearls_erp_2026\backend
npm install jsonwebtoken
```

### Step 2: Create Backend .env File
Create `/backend/.env` with:
```env
# Database
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/pearls-erp

# Server
PORT=5000
NODE_ENV=production

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production_12345
JWT_EXPIRE=7d
```

**⚠️ Security Tip:** Use a strong random string for JWT_SECRET in production!

### Step 3: Update Backend Server
Add middleware imports to `/backend/server.js`:
```javascript
import auth from "./middleware/auth.js";
import rbac from "./middleware/rbac.js";
```

### Step 4: Protect Routes (Example)
Update your routes to use middleware:
```javascript
// Public routes (no auth needed)
router.post("/branch-users/login", loginController);
router.post("/branch-users/register", registerController);

// Protected routes (auth required)
router.get("/branch-users/:id", auth, getUserController);

// Admin-only routes
router.delete("/branch-users/:id", auth, rbac(["ADMIN"]), deleteUserController);

// Manager + Admin routes
router.put("/branch-users/:id", auth, rbac(["ADMIN", "MANAGER"]), updateUserController);
```

### Step 5: Deploy to Render
Update Render environment variables:
- `JWT_SECRET` → Set random secure string
- Other variables → Keep existing MongoDB URI

---

## 🔐 User Roles & Permissions

```
ADMIN
├── Full system access
├── User management
├── Branch management
├── All reports & analytics
└── All operations (Create, Read, Update, Delete)

MANAGER
├── Branch operations
├── Report viewing
├── Order management
├── Limited user creation
└── Cannot access admin settings

STAFF
├── Data entry
├── View own operations
├── Limited report access
├── Cannot create users
└── Cannot modify settings
```

---

## 💻 Frontend Usage Examples

### Login and Store JWT
```javascript
import useAuth from '@/hooks/useAuth';

function LoginPage() {
  const { login, loading, error } = useAuth();
  
  const handleLogin = async (username, password) => {
    try {
      await login(username, password, "https://your-api.com");
      // Redirect to dashboard
    } catch (err) {
      console.error("Login failed:", err);
    }
  };
  
  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      handleLogin(username, password);
    }}>
      {/* Form fields */}
    </form>
  );
}
```

### Using Protected Routes
```javascript
import ProtectedRoute from '@/components/ProtectedRoute';
import AdminDashboard from '@/pages/AdminDashboard';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      
      {/* Admin only */}
      <Route 
        path="/admin" 
        element={<ProtectedRoute 
          role={["ADMIN"]} 
          element={<AdminDashboard />} 
        />} 
      />
      
      {/* Manager + Admin */}
      <Route 
        path="/reports" 
        element={<ProtectedRoute 
          role={["ADMIN", "MANAGER"]} 
          element={<ReportsPage />} 
        />} 
      />
    </Routes>
  );
}
```

### Making API Calls with JWT
```javascript
import { api } from '@/utils/apiWithAuth';

async function fetchUsers() {
  try {
    // JWT automatically added to headers
    const response = await api.get('/branch-users/branch/123');
    console.log(response.data);
  } catch (error) {
    // 401 errors automatically redirect to login
    console.error(error);
  }
}

async function deleteUser(userId) {
  try {
    await api.delete(`/branch-users/${userId}`);
  } catch (error) {
    // Show permission error or redirect
  }
}
```

### Check User Permissions
```javascript
import useAuth from '@/hooks/useAuth';

function UserMenu() {
  const { user, isAdmin, hasRole, logout } = useAuth();
  
  return (
    <div>
      <p>Hello, {user?.username}</p>
      
      {isAdmin() && <AdminLink />}
      
      {hasRole(["ADMIN", "MANAGER"]) && <ManagerLink />}
      
      <button onClick={logout}>Logout</button>
    </div>
  );
}
```

---

## 🛡️ Automatic JWT Handling

The `apiWithAuth.js` utility automatically:
1. ✅ Adds JWT Bearer token to all requests
2. ✅ Handles 401 (expired token) → Redirects to login
3. ✅ Handles 403 (insufficient permissions) → Shows error
4. ✅ Handles 500 errors → Logs and throws

---

## 📝 Testing

### Test Login (with JWT):
```bash
curl -X POST http://localhost:5000/api/branch-users/login \
  -H "Content-Type: application/json" \
  -d '{"username":"saran","password":"your_password"}'
```

Response:
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "data": {
    "id": "69b50e90...",
    "username": "saran",
    "role": "ADMIN"
  }
}
```

### Test Protected Endpoint:
```bash
curl -X GET http://localhost:5000/api/branch-users/123 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"
```

---

## ⚡ Next Steps

1. [ ] Install `jsonwebtoken` in backend
2. [ ] Create `/backend/.env` with JWT_SECRET
3. [ ] Restart backend server (`npm start`)
4. [ ] Test login endpoint (should return JWT token)
5. [ ] Update other routes to use `auth` and `rbac` middleware
6. [ ] Update BranchContext to use JWT token
7. [ ] Replace old API calls with `apiWithAuth` utility
8. [ ] Deploy to Render with JWT_SECRET env variable

---

## 🚨 Common Issues

**"JWT_SECRET is not defined"**
- Solution: Add JWT_SECRET to `.env` file

**"Token not added to requests"**
- Solution: Use `apiWithAuth.js` instead of fetch directly

**"401 Unauthorized"**
- Solution: Token expired or invalid - user will auto-redirect to login

**"403 Forbidden"**
- Solution: User role doesn't have permission - check RBAC configuration

---

## 📚 Role Check Examples

```javascript
// In components:
hasRole("ADMIN") // Returns true if user is ADMIN
hasRole(["ADMIN", "MANAGER"]) // Returns true if user is ADMIN or MANAGER
isAdmin() // Shortcut for ADMIN check
isManager() // Shortcut for MANAGER check
isStaff() // Shortcut for STAFF check
```
