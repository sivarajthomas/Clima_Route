# ClimaRoute Application - Users and Login Credentials

## Current Seeded Users

The application automatically creates two users when the database initializes. These are the default credentials:

### 1. **Administrator User**
- **Email:** `admin@gmail.com`
- **Password:** `admin`
- **Phone:** `+91-9876543210`
- **Role:** `admin`
- **Status:** `Active`
- **Purpose:** Full access to admin dashboard, user management, fleet monitoring

### 2. **Driver User**
- **Email:** `user@gami.com`
- **Password:** `driver`
- **Phone:** `+91-8765432109`
- **Role:** `user` (Driver)
- **Status:** `Active`
- **Purpose:** Regular driver who performs deliveries and can track routes

---

## How Authentication Works

### Password Storage & Security
- Passwords are stored in **two ways**:
  1. **Hashed version** (SHA256) - Used for login verification
  2. **Plain text version** - Displayed to admin in User Management for reference
- During login, the entered password is hashed and compared with the stored hash
- Passwords can only be changed by:
  1. Users during signup (initial password)
  2. Admin via User Management page

### Database Integration
The authentication flow works as follows:

```
User enters password in Login page
    ↓
Frontend sends: { email, password }
    ↓
Backend receives and hashes: SHA256(password)
    ↓
Backend looks up user: WHERE email = ? AND passwordHash = ?
    ↓
If match found → Login success with token
If no match → Login failed
```

---

## Real-Time Features

### User Management Changes Reflect Everywhere
When an admin changes a user's information in the **User Management** page:

1. **Name Change:** Immediately appears in admin dashboard and history logs
2. **Email Change:** User must login with new email (old email no longer works)
3. **Phone Change:** Reflected in delivery notifications and contact info
4. **Password Change:** **User must use the new password to login next time**
5. **Role Change:** Permissions update on next login
6. **Status Change:** Active/Inactive status affects login and visibility

### Database Synchronization
- All changes are immediately saved to SQLite database
- No caching or delays - changes are live
- All pages fetch fresh data from database (no stale data)

---

## Admin User Management Page

### Accessing User Management
1. Login as **admin@gmail.com / admin**
2. Go to **Admin Dashboard**
3. Click **Manage Users** tab

### Features in User Management
| Feature | Description |
|---------|-------------|
| **Search** | Filter users by name, email, or phone number |
| **View All Fields** | Name, Email, Phone, Password Hash, Role, Status |
| **Edit Fields** | Click Edit button to modify user information |
| **Change Password** | Admins can change any user's password (user will use new password to login) |
| **Delete User** | Remove user from system (they cannot login after deletion) |
| **Save Changes** | All changes are saved to database immediately |

### Editing a User
1. Click **Edit** button (pencil icon)
2. Modify any field:
   - **Name:** User's display name
   - **Email:** Login email (must be unique)
   - **Phone:** Contact number
   - **Password:** Change password (plain text shown for editing)
   - **Role:** admin or user (driver)
   - **Status:** Active or Inactive
3. Click **Save** to persist changes to database
4. Changes take effect immediately

---

## Testing the Complete Flow

### Test 1: Login with Default Credentials
```
1. Go to Login page
2. Email: admin@gmail.com
3. Password: admin
4. Click Login
→ Expected: Redirected to Admin Dashboard
```

### Test 2: Driver Login
```
1. Go to Login page
2. Email: user@gami.com
3. Password: driver
4. Click Login
→ Expected: Redirected to Driver Dashboard / Navigation page
```

### Test 3: Admin Changes Driver Password
```
1. Login as admin@gmail.com / admin
2. Go to User Management
3. Find "Demo Driver" user
4. Click Edit
5. Enter new password (e.g., "newpassword123")
6. Click Save
7. Logout
8. Try to login as user@gami.com with old password "driver"
→ Expected: Login fails
9. Login as user@gami.com with new password "newpassword123"
→ Expected: Login succeeds
```

### Test 4: Search Functionality
```
1. In User Management, type "demo" in search box
→ Expected: Shows "Demo Driver" user
2. Clear search, type "+91-9876"
→ Expected: Shows "Administrator" user (by phone)
3. Clear search, type "admin@"
→ Expected: Shows "Administrator" user (by email)
```

### Test 5: Admin Changes User Details
```
1. Login as admin@gmail.com
2. Go to User Management
3. Edit Demo Driver:
   - Change Name to "John Smith"
   - Change Phone to "+1-555-1234"
4. Click Save
5. Check that:
   - User Management shows updated info
   - Admin Dashboard reflects the name change
   - When logged in as that user, profile shows new phone
```

---

## Technical Implementation Details

### Backend (C# / ASP.NET Core)
**File:** `BACKEND/ClimaRouteAPI/Program.cs`

**Password Hashing Function:**
```csharp
static string HashPassword(string pwd)
{
    if (string.IsNullOrEmpty(pwd)) return "";
    using var sha = SHA256.Create();
    var bytes = sha.ComputeHash(Encoding.UTF8.GetBytes(pwd));
    return Convert.ToHexString(bytes);
}
```

**Login Endpoint:**
```csharp
POST /api/login
Input: { email, password }
Process: 
  1. Hash received password
  2. Find user with matching email
  3. Compare hashed password with stored hash
  4. Return token if match
```

**User Update Endpoints:**
```csharp
PUT/POST /api/users/{id}/update
Input: { name?, email?, phone?, password?, role?, status? }
Process:
  1. Find user by ID
  2. Update each provided field
  3. If password provided: hash it before saving
  4. Save all changes to database
```

**User List Endpoint:**
```csharp
GET /api/users
Returns: All users with fields: id, email, name, phone, password (hashed), role, status
Used by: User Management page to display all users
```

### Frontend (React / TypeScript)
**File:** `climaroute FRONT END/pages/admin/ManageUsers.tsx`

**Key Features:**
- Real-time search filtering (name/email/phone)
- Editable form fields for all user properties
- Password field accepts new passwords when editing
- Password field shows masked hash when not editing
- Changes are persisted via `apiService.updateUser()`
- Automatic refresh after save

**File:** `climaroute FRONT END/services/apiservice.ts`

**updateUser Method:**
```typescript
updateUser: async (id: number, data: { 
  name?, email?, phone?, password?, role?, status? 
}) => {
  POST /api/users/{id}/update with JSON body
  Returns: { success, user }
}
```

---

## Database Schema

### Users Table
```
| Column   | Type    | Notes                          |
|----------|---------|--------------------------------|
| Id       | int     | Primary key                    |
| Email    | string  | Unique, used for login         |
| Name     | string  | Display name                   |
| Password | string  | SHA256 hashed                  |
| Phone    | string  | Contact number                 |
| Role     | string  | "admin" or "user"              |
| Status   | string  | "Active" or "Inactive"         |
```

### Delivery History Table
```
| Column      | Type    | Notes                      |
|-------------|---------|----------------------------|
| Id          | int     | Primary key                |
| DriverEmail | string  | Email of driver            |
| Status      | string  | "Completed" or "In Progress"|
| Date        | string  | Delivery date              |
| Origin      | string  | Starting location          |
| Destination | string  | Ending location            |
| ... more    | ...     | Weather, coords, etc.      |
```

---

## Troubleshooting

### Issue: Login fails with correct credentials
**Solution:** Ensure passwords match exactly (case-sensitive, no extra spaces)

### Issue: Admin changes password but old password still works
**Solution:** This shouldn't happen - password hashing is immediate. Try clearing browser cache and login again.

### Issue: User search doesn't show results
**Solution:** Check spelling. Search is case-insensitive but must match exact text in name/email/phone fields.

### Issue: Changes in User Management don't appear elsewhere
**Solution:** Refresh the page. If still missing, check browser console for API errors.

### Issue: Can't delete a user
**Solution:** User may still have active deliveries. Complete or cancel those first, then try deleting.

---

## Security Notes

1. **Passwords are hashed using SHA256** for login verification - industry standard for authentication
2. **Plain passwords are stored in database** - visible to admin in User Management for reference
3. **All database communication is over HTTP** (in production, use HTTPS)
4. **Admin can see and change any user's password** - displayed in plain text for convenience
5. **Users cannot change their own password** - only admin can reset passwords via User Management
6. **No password recovery system** - admin must manage password resets manually

---

## Next Steps

1. **Test the application** with provided credentials
2. **Try changing a user's password** via User Management
3. **Verify admin dashboard** shows real delivery data
4. **Monitor database** to ensure all changes persist

For any issues, check the backend logs in the terminal where `dotnet run` is executing.
