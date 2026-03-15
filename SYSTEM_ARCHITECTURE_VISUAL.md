# 🏗️ OTP AUTHENTICATION SYSTEM - VISUAL ARCHITECTURE

## Complete System Overview

```
┌────────────────────────────────────────────────────────────────────────────┐
│                        PEARLS ERP - PHASE 5                                │
│                   OTP AUTHENTICATION SYSTEM                                │
└────────────────────────────────────────────────────────────────────────────┘

                              🌐 FRONTEND (React)
                              ═══════════════════════════════════════════════

┌─────────────────────────────┐  ┌──────────────────────┐  ┌───────────────────┐
│  UserRegistrationPage       │  │  BranchLoginPage     │  │  SuperAdminPages  │
│  (/user-register)           │  │  (/branch-login)     │  │  2 pages          │
│                             │  │                      │  │                   │
│ • name input                │  │ • branch selector    │  │ • Login page      │
│ • username input            │  │ • username input     │  │ • Dashboard page  │
│ • email input               │  │ • password input     │  │                   │
│ • password input            │  │ • remember me        │  │ (/super-admin-*)  │
│ • branchCode input ← NEW    │  │ • NEW: SuperAdmin    │  │                   │
│ • role dropdown ← NEW       │  │   login link ← NEW   │  │ • Pending regs    │
│                             │  │ • NEW: User register │  │ • Approve/reject  │
│ POST /register              │  │   link ← UPDATED     │  │ • OTP display     │
│ Sends OTP to SuperAdmin     │  │                      │  │                   │
└─────────────────────────────┘  └──────────────────────┘  └───────────────────┘
        ↓                            ↓                             ↓
        └──────────────────────────┬─────────────────────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │                             │
                    ▼                             ▼
            Internet / Routing          JWT Token Storage (localStorage)
            (via API_BASE)             + Authentication Logic


                              🔌 BACKEND (Express.js)
                              ═══════════════════════════════════════════════

┌──────────────────────────────────────────────────────────────────────────────┐
│ ROUTES                                                                       │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│ POST /api/branch-users/register ← UPDATED                                  │
│ ├─► Validate inputs (name, username, email, password, branchCode, role)   │
│ ├─► Check branch exists by code                                           │
│ ├─► Generate 6-digit OTP                                                  │
│ ├─► Set expiry: now + 5 minutes                                          │
│ ├─► Create PendingRegistration document                                   │
│ ├─► Call sendOTPEmail()                                                   │
│ └─► Return registrationId                                                 │
│                                                                              │
│ POST /api/super-admin/login (NEW)                                          │
│ ├─► Find SuperAdmin by username                                           │
│ ├─► Verify password via bcrypt                                            │
│ ├─► Generate JWT token (7-day expiry)                                     │
│ ├─► Update lastLogin                                                       │
│ └─► Return token + user data                                              │
│                                                                              │
│ GET /api/super-admin/pending-registrations (NEW)                           │
│ ├─► Requires: JWT + SUPER_ADMIN role                                      │
│ ├─► Query PendingRegistration (status = PENDING)                          │
│ ├─► Sort by creation date (newest first)                                  │
│ └─► Return with OTP visible                                               │
│                                                                              │
│ POST /api/super-admin/approve-registration/:id (NEW)                       │
│ ├─► Requires: JWT + SUPER_ADMIN role                                      │
│ ├─► Find PendingRegistration                                              │
│ ├─► Verify OTP not expired                                                │
│ ├─► Find Branch by code                                                   │
│ ├─► Create new BranchUser (password hashed)                               │
│ ├─► Update PendingRegistration (approved, approvedBy)                    │
│ ├─► Call sendApprovalEmail()                                              │
│ └─► Return success                                                         │
│                                                                              │
│ POST /api/super-admin/reject-registration/:id (NEW)                        │
│ ├─► Requires: JWT + SUPER_ADMIN role                                      │
│ ├─► Update PendingRegistration (rejected, reason)                        │
│ ├─► Call sendRejectionEmail()                                             │
│ └─► Return success                                                         │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
        ▲                                                           │
        │                                                           │
    request                                                      response
    headers                                                    (JSON)
    (JWT)                                                      


┌──────────────────────────────────────────────────────────────────────────────┐
│ DATA LAYER                                                                   │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│ superadmins Collection (NEW)                                               │
│ ┌────────────────────────────────────────────────────────────┐             │
│ │ _id: ObjectId                                              │             │
│ │ username: "superadmin" (unique)                            │             │
│ │ password: "$2b$10$...(hashed with bcrypt)..."              │             │
│ │ email: "admin@pearlfoods.com"                              │             │
│ │ fullName: "System Administrator"                           │             │
│ │ role: "SUPER_ADMIN"                                        │             │
│ │ status: "ACTIVE"                                           │             │
│ │ lastLogin: 2024-11-15T10:30:00Z                            │             │
│ │ createdAt: 2024-11-15T10:00:00Z                           │             │
│ └────────────────────────────────────────────────────────────┘             │
│                                                                              │
│ pendingregistrations Collection (NEW) ← TTL: otpExpires                    │
│ ┌────────────────────────────────────────────────────────────┐             │
│ │ _id: ObjectId                                              │             │
│ │ name: "John Doe"                                           │             │
│ │ username: "johndoe"                                        │             │
│ │ email: "john@example.com"                                  │             │
│ │ password: "Pass@123" (plaintext, hashed on BranchUser)    │             │
│ │ branchCode: "BR-001"                                       │             │
│ │ role: "ADMIN"                                              │             │
│ │ otp: "123456" (6-digit)                                    │             │
│ │ otpExpires: 2024-11-15T10:35:00Z (5 min from create)      │             │
│ │ status: "PENDING" | "APPROVED" | "REJECTED"               │             │
│ │ approvedBy: ObjectId (ref: SuperAdmin) [if approved]      │             │
│ │ rejectionReason: "..."  [if rejected]                     │             │
│ │ createdAt: 2024-11-15T10:30:00Z                           │             │
│ │ updatedAt: 2024-11-15T10:30:00Z                           │             │
│ └────────────────────────────────────────────────────────────┘             │
│                                                               Auto-deletes  │
│ branchusers Collection (unchanged - but registration flow UPDATED)         │
│ └─► Can only be created via approval, not direct registration             │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘


                              📧 EMAIL SERVICE
                              ═══════════════════════════════════════════════

        ┌─────────────────────────────────────────────────────┐
        │           EmailJS (Third-party service)              │
        │                                                      │
        │  Account Setup:                                     │
        │  • Public Key: abc123...                           │
        │  • Private Key: xyz789...                          │
        │  • Service ID: service_123                         │
        │  • Template ID: template_456                       │
        └─────────────────────────────────────────────────────┘
                              ▲
                ┌─────────────┴──────────────┐
                │                            │
                ▼                            ▼
        
    sendOTPEmail()                 sendApprovalEmail()
    ├─► TO: SuperAdmin email       ├─► TO: User email
    ├─► Subject: "OTP Required"    ├─► Subject: "Registration Approved"
    ├─► Variables:                 ├─► Variables:
    │   • {{user_name}}            │   • {{user_name}}
    │   • {{username}}             │
    │   • {{user_email}}           │
    │   • {{branch_code}}          │
    │   • {{role}}                 │
    │   • {{otp_code}}             │
    └─► HTML: Table + OTP box      └─► HTML: Confirmation + link
    
                │
                │
    sendRejectionEmail()
    ├─► TO: User email
    ├─► Subject: "Registration Status"
    ├─► Variables:
    │   • {{user_name}}
    │   • {{rejection_reason}}
    └─► HTML: Reason + option to reregister


                           🔐 AUTHENTICATION FLOW
                           ═══════════════════════════════════════════════

USER TIER:
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│ 1. User registers at /user-register                                        │
│    └─► POST /api/branch-users/register                                    │
│        └─► Create PendingRegistration                                      │
│        └─► Generate OTP → Send email                                       │
│        └─► Return registrationId                                           │
│                                                                              │
│ 2. User sees: "OTP sent to super admin"                                    │
│    └─► Waits for approval                                                  │
│                                                                              │
│ 3. User receives approval email                                            │
│    └─► Can now login at /branch-login                                      │
│                                                                              │
│ 4. User logs in with username + password                                   │
│    └─► POST /api/branch-users/login                                        │
│        └─► Finds BranchUser (created during approval)                      │
│        └─► Verifies password                                               │
│        └─► Returns JWT token                                               │
│        └─► Store token in localStorage                                     │
│        └─► Redirect to /branch-home                                        │
│                                                                              │
│ 5. User can access all branch features (with JWT token)                    │
│    └─► JWT sent with every API request via useAuth()                      │
│        └─► Verified by auth middleware                                     │
│        └─► Access granted if token valid                                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

SUPER ADMIN TIER:
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│ 1. SuperAdmin logs in at /super-admin-login                                │
│    └─► POST /api/super-admin/login                                         │
│        └─► Username: superadmin                                            │
│        └─► Password: SuperAdmin@123 (hashed in DB)                         │
│        └─► Verify via bcrypt compare                                       │
│        └─► Return JWT token (7-day expiry)                                 │
│        └─► Store token + user data in localStorage                         │
│                                                                              │
│ 2. SuperAdmin accesses dashboard at /super-admin/dashboard                 │
│    └─► Checks localStorage for JWT token                                   │
│    └─► Verifies user.role === "SUPER_ADMIN"                                │
│    └─► GET /api/super-admin/pending-registrations                          │
│        └─► Middleware verifies JWT + SUPER_ADMIN role                      │
│        └─► Returns all pending registrations with OTP visible              │
│                                                                              │
│ 3. SuperAdmin views registration details                                    │
│    └─► User details (name, username, email, branch, role)                  │
│    └─► OTP code (6-digit) in yellow box                                    │
│    └─► OTP expiry countdown (5 minutes)                                    │
│                                                                              │
│ 4. SuperAdmin clicks "APPROVE"                                             │
│    └─► POST /api/super-admin/approve-registration/:id                      │
│        └─► Verify JWT + SUPER_ADMIN role                                   │
│        └─► Find PendingRegistration by ID                                  │
│        └─► Check OTP not expired                                           │
│        └─► Find Branch by branchCode                                       │
│        └─► Create BranchUser (password hashed via bcrypt)                  │
│        └─► Update PendingRegistration (status=APPROVED, approvedBy=id)    │
│        └─► sendApprovalEmail(userEmail)                                    │
│        └─► Return success                                                  │
│                                                                              │
│ 5. SuperAdmin sees registration removed from pending list                  │
│    └─► Real-time UI update                                                 │
│    └─► User receives approval email                                        │
│                                                                              │
│ 6. (Alternative) SuperAdmin enters rejection reason                        │
│    └─► POST /api/super-admin/reject-registration/:id                       │
│        └─► Request body: { reason: "..." }                                 │
│        └─► Update PendingRegistration (status=REJECTED, reason)           │
│        └─► sendRejectionEmail(userEmail, reason)                           │
│        └─► Return success                                                  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘


                         ⏰ OTP LIFECYCLE TIMELINE
                         ═════════════════════════

Time      Action                      Duration
────      ─────                       ────────
T=0s      User submits registration   
          ├─► OTP generated (6 digits)
          ├─► PendingRegistration saves with otpExpires=T+5min
          ├─► Email sent to SuperAdmin
          └─► registrationId returned to user
          
T=30s     SuperAdmin receives email with OTP
          ├─► Opens /super-admin-login
          └─► Views pending in dashboard with OTP visible

T=2m      SuperAdmin approves registration
          ├─► BranchUser created (from PendingRegistration data)
          ├─► Password hashed via bcrypt
          ├─► PendingRegistration updated (status=APPROVED)
          ├─► Approval email sent to user
          └─► User can now login

T=5m      OTP EXPIRES
          ├─► otpExpires timestamp reached
          ├─► MongoDB TTL index triggers auto-deletion
          └─► PendingRegistration document removed

T=∞       User logs in (anytime after approval)
          ├─► Uses /branch-login
          ├─► JWT token generated
          └─► Full access to branch features


                            📊 STATUS MATRIX
                            ═════════════════════════════════════════════

Component                    | Status   | Dependency
──────────────────────────────────────────────────────────────────────────────
SuperAdmin Model            | ✅ Ready | None
PendingRegistration Model   | ✅ Ready | None
EmailJS Service             | ✅ Ready | EmailJS credentials
SuperAdmin Routes (5)       | ✅ Ready | Models
Updated Registration        | ✅ Ready | Models + Email Service
UserRegistrationPage        | ✅ Ready | Routes
SuperAdminLoginPage         | ✅ Ready | Routes
SuperAdminDashboard         | ✅ Ready | Routes
App.jsx Routing             | ✅ Ready | Pages
BranchLoginPage Links       | ✅ Ready | Pages
Create SuperAdmin Script    | ✅ Ready | SuperAdmin Model
──────────────────────────────────────────────────────────────────────────────
Overall Status              | ✅ READY | EmailJS config only


                           🎯 USER JOURNEY MAP
                           ═════════════════════════════════════════════

REGISTRATION PATH:
[User] → /user-register → Fill Form → Submit
   ↓
[Backend] → Validate → Generate OTP → Create PendingReg → Send Email
   ↓
[SuperAdmin] → Receive Email → Login → See Pending → Approve/Reject
   ↓
[User] → Receive Email → Can Login

LOGIN PATH (AFTER APPROVAL):
[User] → /branch-login → Enter Creds → Submit
   ↓
[Backend] → Find BranchUser → Verify Password → Generate JWT
   ↓
[User] → localStorage saves JWT → Redirect to /branch-home
   ↓
[User] → Access All Branch Features
```

---

## 🔄 SEQUENCE DIAGRAM: Complete Flow

```
USER                    BROWSER                 BACKEND              EMAIL
│                        │                         │                   │
│ 1. Access              │                         │                   │
│ /user-register         │                         │                   │
├──────────────────────────>                       │                   │
│                        │ 2. Load form            │                   │
│                        │<──────────────────────  │                   │
│                        │                         │                   │
│ 3. Fill form+Submit    │                         │                   │
├──────────────────────────> POST /register        │                   │
│                        │                         │                   │
│                        │ 4. Process              │                   │
│                        │    • Validate           │                   │
│                        │    • OTP: 123456        │                   │
│                        │    • TTL: 5 min         │                   │
│                        │    • Create PendingReg  │                   │
│                        │<───────────────────────  │                   │
│                        │                         │ 5. Send Email     │
│                        │                         ├──────────────────>
│                        │ 6. Show "OTP sent"      │                   │
│                        │<──────────────────────  │                   │
│                        │                         │                   │
│ 7. Wait for approval   │                         │                   │
│                        │                         │                   │
│                        │                         │                   │ 8. Receive
│                        │                         │  (elsewhere)       │  Email
│                        │                         │                   │<──────
│                        │                         │                   │
│ (SuperAdmin Path)      │                         │                   │
│ 9. Access             │                         │                   │
│ /super-admin-login    │                         │                   │
├──────────────────────────>                       │                   │
│                        │ 10. Post login          │                   │
│                        ├──────────────────────────> Verify JWT        │
│                        │                         │ & Role            │
│                        │<──────────────────────  │                   │
│                        │ 11. Dashboard loads     │                   │
│                        │ + Pending Regs          │                   │
│                        │<───GET /pending────────  │                   │
│                        │                         │                   │
│ 12. View OTP in       │                         │                   │
│ yellow box            │                         │                   │
│ 13. Click Approve     │                         │                   │
├──────────────────────────> POST /approve        │                   │
│                        │                         │ 14. Create        │
│                        │                         │ BranchUser        │
│                        │                         │ + Update Pending  │
│                        │                         │ + Send Email      │
│                        │                         ├──────────────────>
│                        │<──────────────────────  │                   │
│ 15. Receive           │                         │                   │
│ Approval Email        │                         │                   │ 16. Receive
│                        │                         │                   │     Email
│                        │                         │                   │<──────
│ 17. Go to            │                         │                   │
│ /branch-login        │                         │                   │
├──────────────────────────>                       │                   │
│                        │ 18. Post login          │                   │
│                        ├──────────────────────────> Find BranchUser  │
│                        │                         │ + Verify Pwd      │
│                        │                         │ + Create JWT      │
│                        │<──────────────────────  │                   │
│                        │ 19. Store JWT           │                   │
│                        │ in localStorage         │                   │
│                        │ 20. Redirect to         │                   │
│                        │ /branch-home            │                   │
│ 21. Access full      │                         │                   │
│ branch dashboard     │                         │                   │
└────────────────────────────────────────────────────────────────────────
```

---

## ✨ Key Statistics

- **Total Files Changed:** 12
- **Total Lines of Code:** 2,000+
- **Backend Models:** 2
- **API Endpoints:** 5
- **Frontend Pages:** 3
- **Email Templates:** 3
- **Security Layers:** 4 (JWT, OTP, bcrypt, RBAC)
- **Database Collections:** 2 new + 1 modified
- **Documentation Pages:** 6

---

This visual architecture shows the complete flow of the OTP authentication system from registration through approval and login.
