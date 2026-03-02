# Quick Fix: 404 Error on Deployment

## What's Wrong?
```
pearls-erp-2026.onrender.com/api/branches → 404 (HTML response)
```

**This means:** Backend isn't deployed or isn't running on Render.

---

## ⚡ Quick Fix (5 minutes)

### Option 1: Redeploy Backend (Fastest)

1. Go to: https://dashboard.render.com
2. Find your backend service (likely `pearls-erp-2026`)
3. Click on it
4. In the "Deploys" tab, click **"Deploy latest commit"**
5. Wait for deployment to complete (1-3 minutes)
6. Refresh your app, test login

---

### Option 2: Check if Backend Exists on Render

1. Go to: https://dashboard.render.com
2. Look for a service named `pearls-erp-2026` (or similar)
3. **If it doesn't exist:**
   - You need to deploy the backend for the first time
   - Follow **"Initial Deployment"** section below
4. **If it exists but is red (failed):**
   - Check the logs for MongoDB connection error
   - Follow **"Verify Environment Variables"** section

---

### Option 3: Verify Environment Variables

1. In Render dashboard, click backend service
2. Click "Environment"
3. **Verify these variables exist:**
   - `MONGO_URI` = (your MongoDB connection string) ✓
   - `PORT` = `5000` ✓
   - `NODE_ENV` = `production` ✓

4. **If `MONGO_URI` is missing:**
   - Click "Add Environment Variable"
   - Name: `MONGO_URI`
   - Value: Get from MongoDB Atlas:
     - Go to https://www.mongodb.com/cloud/atlas
     - Click your cluster → Connect
     - Copy connection string
     - Replace `<password>` with your password
     - Paste the full string starting with `mongodb+srv://`

5. Service will auto-redeploy with new variables

---

## 🔄 Initial Deployment (First Time Only)

If backend service doesn't exist on Render:

### Step 1: Prepare GitHub
```bash
cd your-repo
git add .
git commit -m "Ready for deployment"
git push origin main
```

### Step 2: Create Service on Render

1. Go to: https://dashboard.render.com
2. Click "New +"
3. Select "Web Service"
4. Click "Connect Repository" → Select your repo
5. Name: `pearls-erp-2026`
6. Runtime: `Node`
7. Build Command:
   ```
   cd backend && npm install
   ```
8. Start Command:
   ```
   node backend/server.js
   ```
9. Region: Select closest to you

### Step 3: Add Environment Variables

1. Scroll down to "Environment"
2. Add these:

   | Name | Value |
   |------|-------|
   | `MONGO_URI` | `mongodb+srv://...` (from MongoDB Atlas) |
   | `PORT` | `5000` |
   | `NODE_ENV` | `production` |

### Step 4: Deploy
- Click "Create Web Service"
- Wait 2-5 minutes for deployment

---

## ✅ Verify It's Working

### In Browser Console Test:
```javascript
// Open DevTools (F12) → Console tab
fetch('https://pearls-erp-2026.onrender.com/api/branches')
  .then(r => r.json())
  .then(d => console.log(d))
```

### Expected Output:
```json
{
  "success": true,
  "data": [...]
}
```

### If you still see error:
```javascript
// Shows what's wrong
fetch('https://pearls-erp-2026.onrender.com/api/branches')
  .then(r => {
    console.log("Status:", r.status, r.statusText);
    return r.text();
  })
  .then(t => console.log(t.substring(0, 200)))
  .catch(e => console.log("Error:", e.message))
```

---

## 📱 Temporary Solution

While fixing deployment, use **local backend**:

1. Edit `.env`:
   ```
   VITE_API_BASE_URL=http://localhost:5000
   VITE_APP_ENV=development
   ```

2. Start backend:
   ```bash
   cd backend
   npm install
   npm start
   ```

3. Start frontend:
   ```bash
   npm run dev
   ```

4. Access: `http://localhost:5173`

---

## 🆘 Still Getting 404?

### Check Render Logs:
1. Dashboard → Your backend service
2. Click "Logs"
3. Look for:
   - ✓ "Server running on 5000" → Good
   - ✗ "MONGO_URI not defined" → Add env var
   - ✗ "Cannot connect to MongoDB" → Wrong connection string
   - ✗ "Error at startup" → Check full error message

### Get Backend Logs:
If not in Render UI, check recent deployments:
1. Render Dashboard → Your service
2. "Deploys" tab
3. Click latest deploy to see logs

---

## 🎯 What Needs to Happen

For deployment to work, these 3 things must connect:

```
Frontend (Firebase)
   ↓ (connects to)
Backend (Render)
   ↓ (connects to)
MongoDB (Atlas)
```

**If 404 error:** Backend connection is failing
**If MongoDB error:** Database connection is failing

---

## Check List

Before contacting support:
- [ ] Backend service exists on Render dashboard
- [ ] Backend service status is GREEN (Live)
- [ ] `MONGO_URI` environment variable is set
- [ ] Backend logs show "Server running on 5000"
- [ ] Can access `https://pearls-erp-2026.onrender.com/api/branches` (not 404)
- [ ] Frontend `.env` points to correct backend URL
- [ ] Frontend is redeployed after changing `.env`

---

## Need Help?

Check these files for detailed info:
- `DEPLOYMENT_TROUBLESHOOTING.md` - Full troubleshooting guide
- `backend/.env.example` - Backend env variables needed
- `ENVIRONMENT_CONFIGURATION.md` - Frontend env setup
