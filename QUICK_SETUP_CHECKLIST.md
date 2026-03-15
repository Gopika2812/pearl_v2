=# ⚡ QUICK SETUP CHECKLIST - OTP Authentication System

**Estimated Time: 20-30 minutes**

---

## 🎯 PRE-SETUP VERIFICATION

- [ ] Backend folder has `package.json` with dependencies installed
- [ ] Frontend folder has `package.json` with dependencies installed
- [ ] MongoDB connection working (check servers.js or .env)
- [ ] Backend runs without errors: `npm start` (backend folder)
- [ ] Frontend runs without errors: `npm run dev` (frontend folder)

---

## 📧 STEP 1: SET UP EMAILJS (10 minutes)

### 1.1 Create EmailJS Account
- [ ] Go to: https://dashboard.emailjs.com
- [ ] Sign up for free account
- [ ] Verify email
- [ ] Login to dashboard

### 1.2 Create Email Service
- [ ] Click "Email Services"
- [ ] Click "Add Service"
- [ ] Select Gmail (or your email provider)
- [ ] Enter your email & app password (or Gmail password)
- [ ] Click "Create Service"
- [ ] Copy **Service ID** - you'll need this
  ```
  Service ID: service_xxxxxxxxxxxx
  ```

### 1.3 Create Email Template
- [ ] Click "Email Templates"
- [ ] Click "Create New Template"
- [ ] Template Name: `OTP_Approval_Template` (important!)
- [ ] Subject: `New User Registration - OTP Approval Required`
- [ ] Paste the HTML from `EMAILJS_SETUP_GUIDE.md` section "Step 4.3"
- [ ] Click "Save"
- [ ] Copy **Template ID** - you'll need this
  ```
  Template ID: template_xxxxxxxxxxxx
  ```

### 1.4 Get API Keys
- [ ] Click "Account" (top right)
- [ ] Under API Keys section:
  - [ ] Copy **Public Key** 
    ```
    Public Key: abc123...
    ```
  - [ ] Copy **Access Token** (this is your Private Key)
    ```
    Access Token: very_long_string...
    ```

### 1.5 You Now Have 4 Keys
Write them down or have them ready:
```
EMAILJS_PUBLIC_KEY = ________________
EMAILJS_PRIVATE_KEY = ________________
EMAILJS_SERVICE_ID = ________________
EMAILJS_TEMPLATE_ID = ________________
```

---

## 🔑 STEP 2: ADD CREDENTIALS TO BACKEND (2 minutes)

### 2.1 Edit backend/.env
- [ ] Open file: `backend/.env`
- [ ] Add or update these 4 lines:
```env
EMAILJS_PUBLIC_KEY=<paste your public key>
EMAILJS_PRIVATE_KEY=<paste your access token>
EMAILJS_SERVICE_ID=<paste your service id>
EMAILJS_TEMPLATE_ID=<paste your template id>
```
- [ ] Save the file
- [ ] Close the file

### 2.2 Example (DO NOT COPY - use your actual keys)
```env
MONGODB_URI=mongodb://localhost:27017/pearls_erp
JWT_SECRET=your_secret_key_here
PORT=5000
FRONTEND_URL=http://localhost:5173

EMAILJS_PUBLIC_KEY=abc123def456ghi789
EMAILJS_PRIVATE_KEY=xyz_very_long_access_token_1234567890
EMAILJS_SERVICE_ID=service_1234567890
EMAILJS_TEMPLATE_ID=template_0987654321
```

---

## 👤 STEP 3: CREATE SUPERADMIN USER (1 minute)

### 3.1 Stop Backend (if running)
- [ ] Press `Ctrl+C` in backend terminal
- [ ] Wait for it to stop

### 3.2 Run Initialization Script
- [ ] Open terminal in workspace root
- [ ] Navigate to backend: `cd backend`
- [ ] Run: `node create-superadmin.js`
- [ ] You should see:
  ```
  ✅ SuperAdmin User Created Successfully!
  
  🔐 Login Credentials:
  - Username: superadmin
  - Password: SuperAdmin@123
  - Email: admin@pearlfoods.com
  ```

### 3.3 Save These Credentials
```
Username: superadmin
Password: SuperAdmin@123
Email: admin@pearlfoods.com
```

---

## 🚀 STEP 4: START SERVERS (1 minute)

### 4.1 Start Backend
- [ ] In backend terminal: `npm start`
- [ ] Wait for message: `✅ EmailJS initialized successfully`
- [ ] Look for: `Server running on port 5000`

### 4.2 Start Frontend
- [ ] In a new terminal, from workspace root: `npm run dev`
- [ ] Frontend ready at: `http://localhost:5173`

---

## ✅ STEP 5: TEST OTP WORKFLOW (5 minutes)

### 5.1 Test User Registration
- [ ] Open browser: http://localhost:5173/user-register
- [ ] Verify page loads
- [ ] Fill form:
  - Name: `Test User`
  - Username: `testuser123`
  - Email: `test@example.com`
  - Password: `Test@123`
  - Confirm Password: `Test@123`
  - Branch Code: `BR-001` (or existing branch code)
  - Role: `ADMIN`
- [ ] Click "Register"
- [ ] Verify message: "✅ Registration submitted! OTP sent to super admin."

### 5.2 Check Email Was Sent
- [ ] You should receive an email with OTP
- [ ] Email should contain:
  - User details (name, username, email, branch, role)
  - OTP code (6 digits) in yellow box
  - Says: "Valid for 5 minutes"
- [ ] **If NOT received:**
  - [ ] Check spam folder
  - [ ] Check EmailJS dashboard Logs tab
  - [ ] Search for entry from your email
  - [ ] If failed, note the error

### 5.3 Test Super Admin Login
- [ ] Go to: http://localhost:5173/super-admin-login
- [ ] Verify page loads with logo
- [ ] Enter:
  - Username: `superadmin`
  - Password: `SuperAdmin@123`
- [ ] Click "Login as Super Admin"
- [ ] Should redirect to: `/super-admin/dashboard`

### 5.4 Test Dashboard
- [ ] Dashboard loads
- [ ] You see "Pending Registrations" section
- [ ] Your test registration shows as a card with:
  - Username: testuser123
  - Email: test@example.com
  - Branch Code: BR-001
  - Role: ADMIN
  - **Yellow OTP box** with 6-digit code visible

### 5.5 Test Approval
- [ ] Click "Approve Registration" button
- [ ] Wait 2 seconds
- [ ] Card should disappear from pending list
- [ ] Test user should receive approval email with:
  - "Your registration has been approved"
  - Login link to `/branch-login`

### 5.6 Test User Can Login
- [ ] Go to: http://localhost:5173/branch-login
- [ ] Enter:
  - Username: `testuser123`
  - Password: `Test@123`
- [ ] Select branch: (any available)
- [ ] Click "Login"
- [ ] Should load branch home dashboard successfully

---

## 📊 VERIFICATION CHECKLIST

Does your system have:
- [ ] EmailJS account created
- [ ] 4 credentials added to backend/.env
- [ ] Backend running (`npm start`)
- [ ] Frontend running (`npm run dev`)
- [ ] SuperAdmin user created
- [ ] User registration page loads (`/user-register`)
- [ ] Super admin login page loads (`/super-admin-login`)
- [ ] Super admin dashboard loads (`/super-admin/dashboard`)
- [ ] OTP emails sending to super admin
- [ ] Registration approval working
- [ ] Approved users can login

✅ **All checked?** Your OTP system is ready!

---

## 🔴 TROUBLESHOOTING QUICK FIXES

### EmailJS Not Sending?
1. Check .env has credentials (no spaces, no quotes)
2. Verify Template Name in EmailJS is exactly: `OTP_Approval_Template`
3. Verify Service is ACTIVE (green checkmark)
4. Restart backend: `Ctrl+C` then `npm start`
5. Check backend console says: `✅ EmailJS initialized successfully`

### Login Fails?
1. Username: `superadmin` (lowercase)
2. Password: `SuperAdmin@123` (exact case)
3. Should be in MongoDB (check: `db.superadmins.findOne()`)

### OTP Not Showing in Dashboard?
1. Check PendingRegistration created in MongoDB
2. Verify you're logged in as SUPER_ADMIN
3. Refresh page (F5)
4. Check browser console for errors (F12)

### Wrong Email Format?
1. Go to EmailJS dashboard
2. Click Email Templates
3. Click `OTP_Approval_Template`
4. Check variables match exactly:
   - `{{user_name}}` NOT `{{name}}`
   - `{{username}}`
   - `{{user_email}}` NOT `{{email}}`
   - `{{otp_code}}`
   - `{{branch_code}}`
   - `{{role}}`

### Can't Find Template ID?
1. Go to EmailJS dashboard
2. Click "Email Templates"
3. Click your template
4. ID shown at top right corner
5. Example: `template_abc123xyz`

**Still having issues?** See:
- `EMAILJS_SETUP_GUIDE.md` → Troubleshooting section
- `OTP_AUTHENTICATION_SYSTEM.md` → Help section
- Backend console logs (terminal)

---

## 🌍 BEFORE DEPLOYING TO RENDER

- [ ] Test complete OTP flow locally (this checklist)
- [ ] All 4 EmailJS credentials in .env
- [ ] Backend runs without errors
- [ ] Emails send successfully
- [ ] User registration → Super admin approval → User login works
- [ ] All code is committed to Git
- [ ] No .env file uploaded to Git (should be in .gitignore)

### Deploy Steps
1. [ ] Push code: `git add . && git commit -m "..." && git push`
2. [ ] Go to Render → Your Service → Settings
3. [ ] Under Environment → Add variables:
   - [ ] `EMAILJS_PUBLIC_KEY`
   - [ ] `EMAILJS_PRIVATE_KEY`
   - [ ] `EMAILJS_SERVICE_ID`
   - [ ] `EMAILJS_TEMPLATE_ID`
4. [ ] Click Save (auto-deploys)
5. [ ] Check logs for: `✅ EmailJS initialized successfully`

---

## 📞 GETTING HELP

| Issue | Solution |
|-------|----------|
| Can't find API key | Check Account → API Keys in EmailJS |
| Template variables wrong | Verify in `.env` that variable names match template exactly |
| Backend won't start | Check .env syntax (no quotes around values) |
| User registration fails | Ensure Branch Code exists in database |
| Email not sent | Check EmailJS dashboard Logs tab for errors |
| Password incorrect | Username: `superadmin`, Password: `SuperAdmin@123` (exact case) |

---

## ✨ SUCCESS! 

When all green ✅:
```
✅ EmailJS Configured
✅ SuperAdmin Created
✅ Backend Running
✅ Frontend Running
✅ Registration Working
✅ Approval Working
✅ Email Sending
✅ Login Working

🎉 YOUR OTP SYSTEM IS LIVE!
```

---

**Time Tracker:**
- Step 1 (EmailJS): 10 min
- Step 2 (.env): 2 min
- Step 3 (SuperAdmin): 1 min
- Step 4 (Start servers): 1 min
- Step 5 (Test): 5 min
- **Total: 19 minutes** ⚡

**Ready? Let's go!** 🚀
