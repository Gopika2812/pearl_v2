# Deployment Troubleshooting Guide

## Current Error
```
404 Error: pearls-erp-2026.onrender.com/api/branches returns HTML instead of JSON
```

This means the backend isn't responding correctly. Check the following:

---

## ✅ Step 1: Check Backend Deployment Status

### Visit Render Dashboard:
1. Go to https://dashboard.render.com
2. Find service: `pearls-erp-2026` (or similar name)
3. Check the status:
   - **Green (Live):** Service is running
   - **Red (Failed):** Service crashed
   - **Yellow (Deploying):** Wait for deployment to finish

### Check Recent Deploys:
- Click on your backend service
- Go to "Logs" tab
- Look for errors related to:
  - MongoDB connection failed
  - Missing environment variables
  - Port issues

---

## ✅ Step 2: Verify Environment Variables on Render

The backend needs these environment variables set in Render dashboard:

### Go to Dashboard > Service > Environment:

1. **MONGO_URI** (Required)
   ```
   mongodb+srv://username:password@cluster.mongodb.net/pearls-erp
   ```
   This connects to your MongoDB Atlas database

2. **PORT** (Optional)
   ```
   5000
   ```

3. **NODE_ENV** (Recommended)
   ```
   production
   ```

### How to add them:
1. Click "Environment" in your Render service
2. Click "Add Environment Variable"
3. Paste the variable name and value
4. Service will auto-redeploy

---

## ✅ Step 3: Common Causes & Solutions

### A. MongoDB Connection Failed
**Error in logs:** `"Mongo Error: ..."` or `"MONGO_URI not found"`

**Solution:**
1. In Render dashboard, go to Environment Variables
2. Add `MONGO_URI` with your MongoDB connection string
3. Redeploy

**Get MongoDB URI:**
- Go to MongoDB Atlas (https://www.mongodb.com/cloud/atlas)
- Click "Connect"
- Copy connection string
- Replace `<password>` with your actual password
- Example: `mongodb+srv://admin:pass123@cluster.mongodb.net/pearls-erp`

---

### B. Service Not Deployed
**Error:** Backend service doesn't exist on Render at all

**Solution:** Deploy the backend from GitHub:
1. Go to https://dashboard.render.com
2. Click "New +"
3. Select "Web Service"
4. Connect your GitHub repository
5. Configure:
   - **Name:** `pearls-erp-2026`
   - **Runtime:** `Node`
   - **Build Command:** `cd backend && npm install`
   - **Start Command:** `node backend/server.js`
6. Add environment variables (see Step 2)
7. Deploy

---

### C. Wrong Backend URL
**Error:** Frontend can't find backend

**Current Setup:**
- **Frontend:** `https://pearlsfrontend.web.app`
- **Backend:** `https://pearls-erp-2026.onrender.com`

**If backend URL is different:**
1. Get actual Render backend URL from dashboard
2. Update `.env` file:
   ```
   VITE_API_BASE_URL=https://your-actual-render-url.onrender.com
   VITE_APP_ENV=production
   ```
3. Rebuild and deploy frontend

---

## ✅ Step 4: Test Backend Directly

### In Browser, visit:
```
https://pearls-erp-2026.onrender.com/api/branches
```

### Expected Response:
```json
{
  "success": true,
  "data": [...]
}
```

### If you get HTML error page:
- Backend is running but no response
- Check logs for errors
- Verify MongoDB connection

### If page doesn't load:
- Backend service isn't deployed
- Follow Step 3 to deploy

---

## ✅ Step 5: Force Redeploy Backend

If backend is stuck:

1. In Render dashboard
2. Click your service
3. Go to "Deploys" tab
4. Click "Deploy latest commit"
5. Wait for deployment to finish
6. Check logs for errors

---

## 📝 Quick Checklist

```
□ Backend service exists on Render
□ Backend service status is "Live" (green)
□ MONGO_URI environment variable is set
□ MongoDB Atlas connection is working
□ Backend logs show "Server running on PORT"
□ Can access backend API directly (no 404)
□ Frontend .env has correct backend URL
□ Frontend is redeployed after .env change
```

---

## 🔧 Debug Steps

### 1. Check if backend is deployed:
```bash
curl -I https://pearls-erp-2026.onrender.com
```
Should return 200 or 404 to a route, not a blankkeyboard
### 2. Check Render logs:
- Open Render dashboard
- Click your backend service
- View "Logs" to see what's happening

### 3. Check MongoDB connection:
- Verify `MONGO_URI` in Render environment
- Test connection in MongoDB Atlas

### 4. Redeploy frontend:
```bash
npm run build
firebase deploy
```

---

## 🚨 Emergency: Use Local Backend

Temporarily use local backend while fixing production:

1. Edit `.env`:
   ```
   VITE_API_BASE_URL=http://localhost:5000
   VITE_APP_ENV=development
   ```

2. Start backend locally:
   ```bash
   cd backend
   npm install
   npm start
   ```

3. Start frontend:
   ```bash
   npm run dev
   ```

4. Access at: `http://localhost:5173`

---

## Need Help?

### Common Error Messages:

| Error | Cause | Fix |
|-------|-------|-----|
| 404 HTML page | Backend not responding | Deploy/restart backend |
| MONGO_URI not found | Missing env var | Add to Render environment |
| Cannot GET /api/branches | Service crashed | Check logs, redeploy |
| CORS error | Frontend/Backend mismatch | Update CORS in `backend/server.js` |

---

## Production Checklist Before Going Live

- [ ] Backend deployed on Render
- [ ] MongoDB Atlas cluster created and connected
- [ ] All env variables configured in Render
- [ ] Backend service is in "Live" status
- [ ] Frontend can reach backend API
- [ ] Firebase hosting deployment successful
- [ ] Test login on https://pearlsfrontend.web.app
- [ ] Test creating data (products, customers, etc.)
- [ ] Check error logs for any issues
