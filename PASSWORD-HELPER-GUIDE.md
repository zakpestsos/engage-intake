# Password Helper Functions Guide

## 🎯 Purpose
These helper functions allow you to generate hashed passwords and create test users in your authentication system.

---

## 📍 Location
Open your Apps Script project: **Leads CRM (Apps Script)**  
Look for the file: `hash-password-helper.gs`

---

## 🔧 Available Functions

### 1. **createFirstAdminUser()** ⭐ EASIEST METHOD

**Best for**: Quickly creating your first admin user

**Steps:**
1. Open `hash-password-helper.gs` in Apps Script editor
2. Find the `createFirstAdminUser()` function
3. Modify these lines (around line 69):
   ```javascript
   const userData = {
     email: 'zak@pest-sos.com',          // ← Your email
     password: 'admin123',                // ← Your password (will be hashed)
     firstName: 'Zak',                    // ← Your first name
     lastName: 'Pest',                    // ← Your last name
     role: 'Admin',                       // ← Role (Admin, Manager, or User)
     companyName: 'Dev Company',          // ← Must match Companies sheet
     active: true                         // ← Leave as true
   };
   ```
4. Select `createFirstAdminUser` from the function dropdown
5. Click **Run** ▶️
6. Check the **Execution log** for success message
7. **Done!** You can now login with that email/password

**Example Output:**
```
========================================
CREATING FIRST ADMIN USER
========================================
Email: zak@pest-sos.com
Name: Zak Pest
Role: Admin
Company: Dev Company

✅ SUCCESS!
User created successfully
You can now login with:
Email: zak@pest-sos.com
Password: admin123
========================================
```

---

### 2. **generateHashedPassword()** - Manual Hash Generation

**Best for**: Getting a hash to manually add to Users sheet

**Steps:**
1. Find the function (around line 17)
2. Change this line:
   ```javascript
   const plainTextPassword = 'MyPassword123';  // ← Change this
   ```
3. Select `generateHashedPassword` from dropdown
4. Click **Run** ▶️
5. Copy the hash from the execution log
6. Manually paste it into your Users sheet Password column

**Example Output:**
```
========================================
PASSWORD HASH GENERATOR
========================================
Plain text password: MyPassword123
Hashed password (SHA-256):
ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f
========================================
Copy the hashed password above and paste it into the
Password column in your Users sheet.
========================================
```

---

### 3. **generateMultiplePasswords()** - Batch Generation

**Best for**: Creating multiple users at once

**Steps:**
1. Find the function (around line 42)
2. Modify the passwords array:
   ```javascript
   const passwords = [
     { user: 'Admin User', password: 'admin123' },
     { user: 'Test User', password: 'test123' },
     { user: 'Manager User', password: 'manager123' }
   ];
   ```
3. Run the function
4. Copy all hashes from the log
5. Manually add rows to Users sheet with these hashes

---

### 4. **verifyUsersSheetSetup()** - Verify Setup

**Best for**: Checking if your Users sheet is correctly configured

**Steps:**
1. Select `verifyUsersSheetSetup` from dropdown
2. Click **Run** ▶️
3. Check the execution log for validation results

**Example Output:**
```
========================================
USERS SHEET VERIFICATION
========================================
✅ Users sheet found!

Expected columns:
Email | Password | First_Name | Last_Name | Role | Company_Name | Active

Actual columns:
Email | Password | First_Name | Last_Name | Role | Company_Name | Active

✅ All columns match perfectly!
Your Users sheet is correctly set up.

Existing users: 1

Current users in sheet:
1. Zak Pest (zak@pest-sos.com) - Admin - Dev Company - Active
========================================
```

---

## 🚀 Quick Start (Recommended Path)

### Step 1: Verify Setup
```
1. Run: verifyUsersSheetSetup()
2. Confirm all columns are correct
```

### Step 2: Create First User
```
1. Edit createFirstAdminUser() with your details
2. Run: createFirstAdminUser()
3. Check log for success message
```

### Step 3: Test Login
```
1. Open dashboard: http://localhost:8000/frontend-dashboard/?token=615e0a2323760bf9995c10b7c7ec44f8&env=staging
2. Login with the email/password you set
3. Dashboard should load!
```

---

## 🔐 Understanding Password Hashing

**Plain Text Password:**
```
admin123
```

**SHA-256 Hashed (what gets stored):**
```
240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9
```

**Key Points:**
- ✅ Same password always produces same hash
- ✅ Cannot reverse hash back to password (one-way)
- ✅ Even if someone sees the hash, they can't use it to login (they need the plain password)
- ✅ More secure than storing passwords in plain text

---

## ❓ Troubleshooting

### Error: "User with this email already exists"
**Solution:** Change the email address or delete the existing user from the sheet

### Error: "Company name does not match"
**Solution:** Make sure `companyName` exactly matches a company in your Companies sheet

### Error: "Users sheet columns are not set up correctly"
**Solution:** Run `verifyUsersSheetSetup()` to see which columns need fixing

### Users sheet columns in wrong order
**Required order:**
1. Email
2. Password
3. First_Name
4. Last_Name
5. Role
6. Company_Name
7. Active

---

## 📝 Example Test Users

Here are some example users you might want to create:

**Admin User:**
```javascript
{
  email: 'admin@yourcompany.com',
  password: 'admin123',
  firstName: 'Admin',
  lastName: 'User',
  role: 'Admin',
  companyName: 'Dev Company',
  active: true
}
```

**Manager User:**
```javascript
{
  email: 'manager@yourcompany.com',
  password: 'manager123',
  firstName: 'Manager',
  lastName: 'User',
  role: 'Manager',
  companyName: 'Dev Company',
  active: true
}
```

**Regular User:**
```javascript
{
  email: 'user@yourcompany.com',
  password: 'user123',
  firstName: 'Regular',
  lastName: 'User',
  role: 'User',
  companyName: 'Dev Company',
  active: true
}
```

---

## ✅ Next Steps After Creating Users

1. **Update Staging Deployment** in Apps Script to new version (Version 72+)
2. **Test Login** in browser
3. **Verify Session Persistence** (refresh page, should stay logged in)
4. **Test Logout** button
5. **Continue with Phase 2 implementation** (UI features)

---

**Helper functions are now live in your Apps Script project!**  
Located in: `hash-password-helper.gs`

