# Environment Configuration Guide

## Overview
The Pearls ERP application uses environment variables to configure the backend API connection. This allows seamless switching between development (localhost) and production (live) environments.

## Environment Setup

### Production Setup (Default)
The `.env` file is already configured for production:

```bash
VITE_API_BASE_URL=https://pearls-erp-2026.onrender.com
VITE_FRONTEND_URL=https://pearlsfrontend.web.app
VITE_APP_ENV=production
```

**No additional configuration needed!** The application will automatically connect to the live production server.

### Development Setup (Local)
To work locally with the backend running on `localhost:5000`:

1. Open `.env` file in the project root
2. Replace the production URLs with:

```bash
VITE_API_BASE_URL=http://localhost:5000
VITE_FRONTEND_URL=http://localhost:5173
VITE_APP_ENV=development
```

3. Make sure your backend server is running:
   ```bash
   cd backend
   npm install
   npm start
   ```

4. Start the frontend development server:
   ```bash
   npm run dev
   ```

## Key Changes Made

### 1. Home Page Route
- **Before**: Home page was at `/` (Admin Dashboard)
- **After**: BranchLoginPage is now at `/` (Default entry point)
- Admin Dashboard moved to `/home`

### 2. Centralized API Configuration
- **File**: `src/api.js`
- **Purpose**: Centralized API endpoint management
- **Usage**: 
  ```javascript
  import { API_BASE } from "../api";
  const response = await axios.get(`${API_BASE}/endpoint`);
  ```

### 3. Environment Files
- **`.env`**: Current environment configuration (gitignored for production)
- **`.env.example`**: Template for developers to see what variables are needed

### 4. Components Updated
- `QuickLinksDataManager.jsx`: Now uses centralized API config
- `VendorSummary.jsx`: Error messages updated to reference `.env` configuration

## How to Switch Environments

### Command to Switch to Development:
```bash
# Edit .env file and uncomment development URLs
VITE_API_BASE_URL=http://localhost:5000
VITE_APP_ENV=development
```

### Command to Switch to Production:
```bash
# Edit .env file to production URLs
VITE_API_BASE_URL=https://pearls-erp-2026.onrender.com
VITE_APP_ENV=production
```

## Multi-Environment Support

The system supports three environments:

| Aspect | Development | Staging | Production |
|--------|-------------|---------|------------|
| Backend URL | `http://localhost:5000` | `https://pearls-erp-dev.onrender.com` | `https://pearls-erp-2026.onrender.com` |
| Frontend URL | `http://localhost:5173` | `https://pearls-staging.web.app` | `https://pearlsfrontend.web.app` |
| Database | Local/Dev | Development DB | Production DB |
| Entry Point | `/` (BranchLoginPage) | `/` (BranchLoginPage) | `/` (BranchLoginPage) |

## Verification Checklist

After setting up your environment:

1. ✅ Check `.env` file exists with correct URLs
2. ✅ Verify backend is running (if using localhost)
3. ✅ Start frontend: `npm run dev`
4. ✅ Should see BranchLoginPage at `http://localhost:5173`
5. ✅ Try logging into a branch - should connect to the correct backend

## Troubleshooting

### Error: "API_BASE is not configured"
- Check that `.env` file exists in project root
- Verify `VITE_API_BASE_URL` is set
- For development, ensure backend is running on `http://localhost:5000`

### Error: Connection refused to backend
- Verify you're using the correct backend URL in `.env`
- For localhost development: Check if backend server is running (`npm start` in backend folder)
- For production: Check internet connection and that backend domain is accessible

### CORS Error
- Backend at `backend/server.js` is configured to accept:
  - Frontend: `https://pearlsfrontend.web.app` and `http://localhost:5173`
  - If using different frontend URL, update CORS configuration in backend

## Build for Production

To build the application for production deployment:

```bash
npm run build
```

Ensure `.env` has production URLs before building:
```bash
VITE_API_BASE_URL=https://pearls-erp-2026.onrender.com
VITE_APP_ENV=production
```

The build will create a `dist/` folder ready for Firebase hosting deployment.

## Deploy to Firebase

```bash
firebase deploy
```

This will deploy the built application to `https://pearlsfrontend.web.app`.
