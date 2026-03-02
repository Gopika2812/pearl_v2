# 🆘 404 Error - Fix in 2 Minutes

You're seeing this error:
```
Failed to load resource: the server responded with a status of 404
Error fetching branches: SyntaxError: Unexpected token '<'
```

## The Problem
Backend at `https://pearls-erp-2026.onrender.com` isn't responding.

## The Solution

### Try This First (30 seconds):

1. Open: https://dashboard.render.com
2. Find your backend service (name: `pearls-erp-2026`)
3. **Is it red/failed?** → Click "Manual Deploy" and wait
4. **Is it green?** → Click it and go to "Environment" tab
5. **Check if `MONGO_URI` is set** → If not:
   - Click "Add Environment Variable"
   - Name: `MONGO_URI`
   - Value: Your MongoDB connection string (from MongoDB Atlas)
   - Submit

---

### Don't Have MongoDB URI? Get it in 1 minute:

1. Go: https://www.mongodb.com/cloud/atlas
2. Click your cluster
3. Click "Connect"
4. Click "Connect your application"
5. Copy the string
6. Replace `<password>` with your actual password
7. Paste into Render environment variables
8. Service redeploys (wait 1-2 mins)

---

### Still Broken? Redeploy Backend:

1. Render Dashboard → Your service
2. Click "Deploys" tab
3. Click "Deploy latest commit"
4. Wait 2-3 minutes
5. Refresh app

---

### Last Resort: Use Local Backend

While you fix production:

1. Edit `.env`:
   ```
   VITE_API_BASE_URL=http://localhost:5000
   ```

2. Start backend (new terminal):
   ```bash
   cd backend
   npm install
   npm start
   ```

3. Start frontend (different terminal):
   ```bash
   npm run dev
   ```

4. Visit: `http://localhost:5173`

---

## Check If It's Fixed

Open browser DevTools (F12) and click Console tab, run:

```javascript
fetch('https://pearls-erp-2026.onrender.com/api/branches')
  .then(r => r.json())
  .then(d => console.log('✅ Backend working!', d))
  .catch(e => console.log('❌ Still broken:', e.message))
```

**If you see:** `✅ Backend working!` → **SUCCESS!**

Refresh app, it should work now.

---

## For More Help

Read these files in order:
1. `QUICK_FIX_404_ERROR.md` - Detailed fixes
2. `DEPLOYMENT_TROUBLESHOOTING.md` - All issues
3. `backend/.env.example` - Environment setup

---

**Key Point:** The 404 error means **backend server isn't running**. Just deploy it on Render or start locally. Then refresh the app.
