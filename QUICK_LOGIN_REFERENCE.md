# Quick Login Reference

## Default Users

### Admin Account
```
Email:    admin@gmail.com
Password: admin
Phone:    +91-9876543210
Role:     Administrator
```

### Driver Account
```
Email:    driver@gmail.com
Password: driver
Phone:    +91-8765432109
Role:     Driver (Regular User)
```

---

## What Works Now

✅ **Login Authentication** - Users can login with email/password
✅ **Password Hashing** - All passwords are securely hashed using SHA256
✅ **User Management** - Admin can view, edit, and delete users
✅ **Search Users** - Search by name, email, or phone number
✅ **Change Password** - Admin can reset any user's password
✅ **Real-Time Updates** - All changes immediately reflect in database
✅ **Password Display** - Hashed passwords shown (first 8 chars) for reference
✅ **Password Editing** - Admin can enter new password when editing user
✅ **Phone Field** - Added to user profile with edit capability
✅ **All Fields Editable** - Name, email, phone, role, status

---

## How to Test

### Test 1: Login as Admin
1. Go to Login page
2. Email: `admin@gmail.com`
3. Password: `admin`
4. Click "Login"
5. You should see Admin Dashboard

### Test 2: Change a User's Password
1. Login as admin
2. Go to "User Management" page
3. Find "Demo Driver" user
4. Click "Edit" button (pencil icon)
5. Scroll to Password field
6. Enter new password (e.g., `newpass123`)
7. Click "Save"
8. User can now login with new password

### Test 3: Login as Driver with New Password
1. Logout from admin
2. Go to Login page
3. Email: `user@gami.com`
4. Password: `newpass123` (the new password you just set)
5. Click "Login"
6. Driver should login successfully

---

## Important Notes

- **Passwords are case-sensitive** - "Admin" is different from "admin"
- **No spaces allowed** - Don't add spaces before/after passwords
- **Password must be non-empty** - When editing, leave blank to keep current password
- **Changes are immediate** - No need to refresh, database updates instantly
- **Login uses hashed password** - Can't see actual password, only hash
- **Admin can reset passwords** - Users cannot change own password (only login page)

---

## File Locations

- **Backend Code:** `BACKEND/ClimaRouteAPI/Program.cs`
- **User Management UI:** `climaroute FRONT END/pages/admin/ManageUsers.tsx`
- **API Service:** `climaroute FRONT END/services/apiservice.ts`
- **Database:** `BACKEND/ClimaRouteAPI/climaroute.db`

---

## Start the Application

```bash
# Terminal 1: Start Backend
cd BACKEND/ClimaRouteAPI
dotnet run

# Terminal 2: Start Frontend
cd "climaroute FRONT END"
npm start
```

Backend runs on: http://localhost:5000
Frontend runs on: http://localhost:5173 (or http://localhost:3000)
