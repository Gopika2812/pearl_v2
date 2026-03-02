# 🚀 Deployment Status Checklist

Use this to quickly diagnose your deployment issues.

## Current Configuration

```
Frontend: https://pearlsfrontend.web.app
Backend: https://pearls-erp-2026.onrender.com
Database: MongoDB Atlas
```

---

## ❌ Error: Backend Returns 404

**Error Message:**
```
pearls-erp-2026.onrender.com/api/branches → 404
Error fetching branches: SyntaxError: Unexpected token '<'
```

**Cause:** Backend is either not deployed or not running.

### Quick Fixes:

- [ ] **Check Backend Exists**
  - Go to: https://dashboard.render.com
  - Look for service: `pearls-erp-2026`
  - If not found → Deploy backend (see QUICK_FIX_404_ERROR.md)

- [ ] **Check Backend Status**
  - Click service in Render dashboard
  - Check status indicator (should be GREEN)
  - If RED → Check logs for error
  - If DEPLOYING → Wait for completion

- [ ] **Check Environment Variables**
  - In Render dashboard → Click backend service → Environment
  - Verify `MONGO_URI` is set
  - Verify `PORT` is `5000`
  - If missing → Add and redeploy

- [ ] **Redeploy Backend**
  - Click "Deploys" tab
  - Click "Deploy latest commit"
  - Wait 2-3 minutes for deployment

---

## ✅ What Success Looks Like

When everything works:

1. ✓ Open https://pearlsfrontend.web.app
2. ✓ See BranchLoginPage (no loading errors)
3. ✓ Branches load in dropdown
4. ✓ Can select branch and login
5. ✓ Dashboard loads successfully
6. ✓ Can create products, customers, etc.

**Console (F12) should show:**
```
🔧 API Configuration:
   Environment: production
   Backend URL: https://pearls-erp-2026.onrender.com/api
```

---

## 🔍 For Developers

### Development Setup

```bash
# Terminal 1: Start Backend
cd backend
npm install
npm start
# Backend runs on http://localhost:5000

# Terminal 2: Start Frontend (new terminal)
npm run dev
# Frontend runs on http://localhost:5173
```

**Then edit `.env`:**
```
VITE_API_BASE_URL=http://localhost:5000
VITE_APP_ENV=development
```

### Production Setup

No changes needed - uses production URLs in `.env`:
```
VITE_API_BASE_URL=https://pearls-erp-2026.onrender.com
VITE_APP_ENV=production
```

---

## 📋 Troubleshooting Map

| Symptom | Cause | Fix |
|---------|-------|-----|
| 404 on `/api/branches` | Backend not deployed | Deploy on Render |
| 503 Service Unavailable | Backend crashed/restarting | Wait, then retry or check logs |
| CORS error in console | Frontend/Backend URL mismatch | Verify URLs in `.env` and backend CORS |
| Blank page on app load | Frontend deploy failed | Rebuild: `npm run build && firebase deploy` |
| MongoDB connection error | Wrong MONGO_URI in Render | Add/fix `MONGO_URI` env var in Render |
| Network error, can't reach backend | Wrong backend URL | Update `.env` with correct URL |
| Works locally but not on production | Different environments | Ensure production URLs used in `.env` |

---

## 📝 Important Files

- `QUICK_FIX_404_ERROR.md` - Fastest way to fix 404 error
- `DEPLOYMENT_TROUBLESHOOTING.md` - Detailed troubleshooting guide
- `ENVIRONMENT_CONFIGURATION.md` - Environment setup for dev/prod
- `backend/.env.example` - Backend environment variables
- `.env` - Frontend environment configuration

---

## 🆘 Emergency: Use Local Backend

If production backend isn't working but you need to test:

```bash
# Edit .env to use localhost
VITE_API_BASE_URL=http://localhost:5000
VITE_APP_ENV=development

# Start backend
cd backend && npm start

# Start frontend (new terminal)
npm run dev

# Visit localhost:5173
```

---

## ✅ Pre-Deployment Checklist

Before deploying:

- [ ] Backend code tested locally
- [ ] Backend pushed to GitHub
- [ ] MongoDB Atlas cluster created
- [ ] Backend deployed to Render with environment variables
- [ ] Frontend code tested locally with backend
- [ ] `.env` has correct production URLs
- [ ] Frontend built: `npm run build`
- [ ] Frontend deployed: `firebase deploy`
- [ ] Test app at https://pearlsfrontend.web.app
- [ ] Check browser console for errors

---

## Need More Help?

1. Read `QUICK_FIX_404_ERROR.md` for immediate fixes
2. Check `DEPLOYMENT_TROUBLESHOOTING.md` for detailed steps
3. Review `backend/.env.example` for required environment variables
4. Check Render logs for backend issues
5. Test backend directly: `https://pearls-erp-2026.onrender.com/api/branches`

---

## Commands Reference

```bash
# Development
npm run dev              # Start frontend dev server
cd backend && npm start  # Start backend server

# Production
npm run build            # Build for production
firebase deploy          # Deploy to Firebase

# Backend deployment
git add . && git commit -m "Deploy" && git push  # Push to GitHub
# Then redeploy from Render dashboard
```

---

**Last Updated:** March 2, 2026
**Status:** Production Deployment Active
