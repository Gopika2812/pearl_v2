# 🚀 EmailJS Configuration Guide for Pearls ERP

## Overview
This guide walks you through setting up EmailJS to enable email notifications in the OTP approval system.

---

## Step 1: Create EmailJS Account

### 1.1 Sign Up
1. Go to: **https://dashboard.emailjs.com**
2. Click "Sign Up Free"
3. Choose your signup method (Email, Google, GitHub)
4. Complete registration

### 1.2 Verify Email
- Check your inbox for verification email
- Click the verification link

---

## Step 2: Get API Credentials

### 2.1 Find Your Public Key
1. Log in to EmailJS dashboard
2. Click on your **Account** (top menu or profile icon)
3. Under **API Keys**, you'll see:
   - **Public Key** - Copy this
4. Keep this tab open, you'll need all 4 values

### 2.2 Note: Private Key
- The private key is NOT separately shown in UI for non-Node.js usage
- For Node.js backend, you'll use the **Access Token** instead
- Or you can use a different authentication method (see Service Setup below)

---

## Step 3: Create Email Service

### 3.1 Add Email Service
1. In EmailJS dashboard, click **Email Services**
2. Click **Add Service**

### 3.2 Choose Provider (Recommended: Gmail)

#### Option A: Gmail (Easiest)
**Prerequisites:**
- Active Gmail account
- Enable "App Passwords" (if 2FA enabled):
  1. Go to: https://myaccount.google.com/apppasswords
  2. Select "Mail" and "Windows Computer" (or your device)
  3. Generate app password (you'll see a 16-char password)
  4. Save this password

**In EmailJS:**
1. Select **Gmail**
2. Name: `Gmail Service` (or any name)
3. Email: Your Gmail address
4. Password: The app password (or Gmail password if no 2FA)
5. Click **Create Service**

#### Option B: Outlook/Hotmail
Similar process, select **Outlook** instead

#### Option C: SendGrid/AWS SES (Advanced)
See your provider's documentation

### 3.3 Copy Service ID
1. After creating, click on the service you created
2. You'll see **Service ID** - Copy this
3. Example: `service_abc123xyz`

---

## Step 4: Create Email Template

### 4.1 Go to Email Templates
1. In EmailJS dashboard, click **Email Templates**
2. Click **Create New Template**

### 4.2 Template Configuration

**Template Details:**
- **Template Name:** `OTP_Approval_Template` (important: must match code)
- **Subject:** `New User Registration - OTP Approval Required`
- **Service ID:** Select the Gmail service you created above

### 4.3 Template Content

Copy and paste this HTML into the **email content** section:

```html
<div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; color: #333;">
  <!-- Header -->
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="margin: 0; font-size: 28px;">🔐 New User Registration</h1>
    <p style="margin: 10px 0 0 0; opacity: 0.9;">Approval Required</p>
  </div>

  <!-- Body -->
  <div style="background: white; padding: 30px 20px; border: 1px solid #e0e0e0; border-top: none;">
    <p style="margin-top: 0;">Hello Super Admin,</p>
    
    <p>A new user has registered and needs your approval to proceed. Review the details below:</p>

    <!-- User Details Table -->
    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
      <tr style="background: #f5f5f5;">
        <td style="padding: 12px; border: 1px solid #ddd; font-weight: bold; width: 40%;">Field</td>
        <td style="padding: 12px; border: 1px solid #ddd; font-weight: bold; width: 60%;">Value</td>
      </tr>
      <tr>
        <td style="padding: 12px; border: 1px solid #ddd;">Full Name</td>
        <td style="padding: 12px; border: 1px solid #ddd;">{{user_name}}</td>
      </tr>
      <tr style="background: #f9f9f9;">
        <td style="padding: 12px; border: 1px solid #ddd;">Username</td>
        <td style="padding: 12px; border: 1px solid #ddd;">{{username}}</td>
      </tr>
      <tr>
        <td style="padding: 12px; border: 1px solid #ddd;">Email</td>
        <td style="padding: 12px; border: 1px solid #ddd;">{{user_email}}</td>
      </tr>
      <tr style="background: #f9f9f9;">
        <td style="padding: 12px; border: 1px solid #ddd;">Branch Code</td>
        <td style="padding: 12px; border: 1px solid #ddd;">{{branch_code}}</td>
      </tr>
      <tr>
        <td style="padding: 12px; border: 1px solid #ddd;">Role</td>
        <td style="padding: 12px; border: 1px solid #ddd;">{{role}}</td>
      </tr>
    </table>

    <!-- OTP Display -->
    <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 20px; margin: 20px 0; border-radius: 4px;">
      <p style="margin: 0 0 10px 0; font-weight: bold; color: #856404;">🔑 OTP Code (Valid for 5 minutes):</p>
      <p style="margin: 0; font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #ffc107; text-align: center;">{{otp_code}}</p>
    </div>

    <p><strong>Next Steps:</strong></p>
    <ol style="margin: 10px 0; padding-left: 20px;">
      <li>Review the user registration details above</li>
      <li>Log in to your dashboard</li>
      <li>Go to the approval section</li>
      <li>Approve or reject the registration</li>
    </ol>

    <p style="margin: 20px 0 0 0; color: #666; font-size: 12px;">
      This OTP is valid for 5 minutes only. If the registration is not approved within this time, the user will need to register again.
    </p>
  </div>

  <!-- Footer -->
  <div style="background: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; color: #666; border-radius: 0 0 8px 8px;">
    <p style="margin: 0;">Pearls ERP System</p>
    <p style="margin: 5px 0 0 0;">Do not share this code with anyone</p>
  </div>
</div>
```

### 4.4 Template Variables

EmailJS will look for these variables enclosed in `{{}}`:
- `user_name` - Full name of registering user
- `username` - Username
- `user_email` - User's email address
- `branch_code` - Branch code (must be uppercase)
- `role` - User role (ADMIN, MANAGER, etc.)
- `otp_code` - 6-digit OTP

**Important:** Keep these exact names for the email to work correctly.

### 4.5 Save Template

1. Click **Save**
2. Copy the **Template ID** (shown at top, example: `template_abc123xyz`)
3. This is used in the backend code

---

## Step 5: Get All Credentials

You now should have 4 values:

```
EMAILJS_PUBLIC_KEY = Your public key (23 random chars)
EMAILJS_PRIVATE_KEY = Your access token (long string)
EMAILJS_SERVICE_ID = service_xxxxxxxxxxxx (from Email Services)
EMAILJS_TEMPLATE_ID = template_xxxxxxxxxxxx (from Email Templates)
```

### Where to Find Each:

| Credential | Location |
|-----------|----------|
| Public Key | **Account** → **API Keys** → **Public Key** |
| Private Key | **Account** → **API Keys** → **Access Token** (or use Public Key method) |
| Service ID | **Email Services** → Click your service → **Service ID** |
| Template ID | **Email Templates** → Click your template → **Template ID** (top right) |

---

## Step 6: Add to Backend .env

### 6.1 Edit backend/.env

Open the file: `backend/.env`

Add or update these lines:

```env
# EmailJS Configuration
EMAILJS_PUBLIC_KEY=your_emailjs_public_key_here
EMAILJS_PRIVATE_KEY=your_emailjs_access_token_here
EMAILJS_SERVICE_ID=service_xxxxxxxxxxxx
EMAILJS_TEMPLATE_ID=template_xxxxxxxxxxxx
```

### 6.2 Example .env (Complete)

```env
# MongoDB
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/pearls_erp

# JWT
JWT_SECRET=your_secret_key_here

# Port
PORT=5000

# Frontend
FRONTEND_URL=http://localhost:5173

# EmailJS Configuration
EMAILJS_PUBLIC_KEY=abc123def456ghi789jkl012mno
EMAILJS_PRIVATE_KEY=very_long_access_token_string_here_1234567890
EMAILJS_SERVICE_ID=service_1234567890abc
EMAILJS_TEMPLATE_ID=template_0987654321xyz
```

### 6.3 Save and Verify
1. Save the file
2. Backend will read these on startup
3. Check server logs: `✅ EmailJS initialized successfully` appearing on startup

---

## Step 7: Test the Setup

### 7.1 Start Backend & Frontend

```bash
# Terminal 1 - Backend
cd backend
npm start

# Terminal 2 - Frontend
cd .
npm run dev
```

### 7.2 Test Email Configuration

1. Access: http://localhost:5173/user-register
2. Fill registration form:
   - Name: Test User
   - Username: testuser123
   - Email: test@example.com
   - Password: Test@123
   - Branch Code: BR-001 (or existing branch)
   - Role: ADMIN
3. Click Register
4. Should see: "✅ Registration submitted! OTP sent to super admin."
5. Check EmailJS dashboard or super admin email for OTP

### 7.3 Check EmailJS Dashboard

1. Log in to EmailJS dashboard
2. Go to **Logs** (top menu)
3. You should see successful email sends
4. If failed, error will show here

### 7.4 Troubleshoot

**Email not sending?**
- Check .env has correct credentials (no extra spaces)
- Restart backend: `npm start` in backend folder
- Check backend console for errors
- Verify template ID matches exactly
- Try sending test email first via EmailJS dashboard

**Wrong template format?**
- Go back to Email Templates
- Edit template
- Ensure variable names match exactly: `{{user_name}}`, `{{otp_code}}`, etc.
- Test by sending a test email with sample data

**Credentials rejected?**
- Go to EmailJS Account page
- Copy keys again (watch for extra spaces)
- Update .env
- Restart backend

---

## Step 8: Create SuperAdmin User

Once EmailJS is working:

```bash
cd backend
node create-superadmin.js
```

Output should show:
```
✅ SuperAdmin User Created Successfully!

🔐 Login Credentials:
- URL: http://localhost:5173/super-admin-login
- Username: superadmin
- Password: SuperAdmin@123
- Email: admin@pearlfoods.com
```

---

## Step 9: Test Complete OTP Flow

1. **Register new user** (http://localhost:5173/user-register)
   - Fill form and submit
   - See: "OTP sent to super admin"

2. **Login as Super Admin** (http://localhost:5173/super-admin-login)
   - Login: `superadmin` / `SuperAdmin@123`
   - See dashboard with pending registration

3. **View pending registration**
   - See user details in card
   - OTP code displayed in yellow box

4. **Approve registration**
   - Click "Approve Registration"
   - User receives approval email
   - User can now login

5. **User logs in** (http://localhost:5173/branch-login)
   - Login with their new credentials
   - Select branch
   - Access branch dashboard

---

## Production Deployment

### For Render.com

1. **Add Environment Variables:**
   - Go to your Render service settings
   - Environment → Add these 4 variables:
     - `EMAILJS_PUBLIC_KEY`
     - `EMAILJS_PRIVATE_KEY`
     - `EMAILJS_SERVICE_ID`
     - `EMAILJS_TEMPLATE_ID`

2. **Deploy:**
   ```bash
   git add .
   git commit -m "Add EmailJS OTP system"
   git push
   ```

3. **Verify:**
   - Check Render logs for: `✅ EmailJS initialized successfully`

---

## Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| "EmailJS not initialized" | Add credentials to .env, restart backend |
| Email not sent | Check Service ID & Template ID match |
| Wrong email template | Verify variable names in template (case-sensitive!) |
| Credentials rejected | Copy/paste without extra spaces, verify in EmailJS UI |
| OTP not displaying | Check PendingRegistration in MongoDB was created |
| Backend won't start | Check .env syntax, ensure no quotes around values |

### Contact Support

- **EmailJS Issues:** https://www.emailjs.com/docs/
- **Our System:** Check backend console logs for error messages

---

## Summary

You now have:
✅ EmailJS account with credentials  
✅ Email service configured (Gmail/Outlook)  
✅ Email template created with OTP display  
✅ 4 environment variables ready  
✅ Backend ready to send emails  
✅ Frontend forms ready to trigger emails  

**Next:** Add credentials to .env and run `node create-superadmin.js` to complete setup!
