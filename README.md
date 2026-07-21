# SplitKesh — Changes & Setup

This document covers everything added/
//version 10 and the steps to get it running.

## What was fixed / added

### 1. Create Group (was a placeholder `alert`)
- `app/src/pages/Groups.jsx` now opens a real **Create Group** modal: name, icon, colour, and a member picker. Wired to `POST /api/groups` (`groupsAPI.createWithMembers`).

### 2. Add members + contacts permission
- New reusable `app/src/components/MemberPicker.jsx`: search users by name/email/phone, or **import from phone contacts** via the browser Contact Picker API (`app/src/utils/contacts.js`). It asks the OS/browser for contacts permission, then matches them to existing app users through `POST /api/users/lookup-contacts`.
- `GroupDetail.jsx` Members tab now has **Add member** (group admins) and remove controls.
- Contacts are only read with the user's explicit permission, and only the **last 10 digits** are sent for matching.

### 3. Preferences (were static, non-working)
- Stored in a new `users.preferences` JSONB column.
- Endpoints: `GET/PUT /api/users/preferences`.
- `Profile.jsx` now has working Dark Mode, Currency, Language, and notification toggles, persisted to the backend.

### 4. Phone number constraint — exactly 10 digits
- Enforced in `routes/auth.js` (register) and `userController.updateProfile` (profile update), plus client-side in `Login.jsx`. Non-digits are stripped before validation.

### 5. Email, forgot-password & verification (using frameworks)
- **nodemailer** for SMTP email (`utils/email.js`), **crypto** for secure tokens (`utils/tokens.js`, only a SHA-256 hash is stored).
- Sign-in/refresh keep the existing **jsonwebtoken + bcryptjs** stack.
- New endpoints:
  - `POST /api/auth/forgot-password`
  - `POST /api/auth/reset-password`
  - `POST /api/auth/verify-email`
  - `POST /api/auth/resend-verification`
- New pages: `ResetPassword.jsx`, `VerifyEmail.jsx`, and a **Forgot password?** flow in `Login.jsx`.

### 6. Email notification on password change
- Both the logged-in change (`PUT /api/users/me/password`) and reset flow send a "your password was changed" email.

### 7. Notifications + payment reminders
- New `notifications` table, controller, routes (`/api/notifications...`), and `Notifications.jsx` page. The TopNav bell now shows real unread notifications.
- Notifications are created on settlements and member-adds.
- A **node-cron** job (`jobs/paymentReminders.js`) runs daily and creates payment-reminder notifications + emails for unpaid settlements, respecting each user's notification preferences.

### 8. App-wide super admin
- New `users.is_admin` flag, `adminOnly` middleware, `adminController.js`, and `/api/admin/*` routes (overview, users, groups, set-admin, metrics).
- New `Admin.jsx` dashboard (linked from Profile for admins) with overview, monitoring, users (grant/revoke admin), and groups tabs.

### 9. App monitoring
- `middleware/requestLogger.js` logs every request (method, path, status, latency) to the console and the `request_logs` table.
- `/api/health` now pings the DB and reports uptime.
- `/api/admin/metrics` summarises the last 24h (volume, error rate, avg/max latency, slowest requests) — shown in the Admin → Monitoring tab.

## Assumptions made
- "limit to 10" → **phone numbers must be exactly 10 digits**.
- "Admin" → **app-wide super admin** (group-admin role still exists separately).
- Email → **real SMTP via nodemailer**, with a console fallback when SMTP is not configured so flows still work in dev.

## Setup

```bash
cd api
npm install                 # installs nodemailer (newly added) + the rest
cp .env.example .env        # then fill in DB + JWT + SMTP values

# Fresh database:
npm run db:setup            # schema.sql now includes all new tables/columns

# OR existing database (apply just the new stuff):
psql -U postgres -d splitkesh -f db/migrations/001_features.sql

npm run dev
```

Frontend:

```bash
cd app
npm install
npm start
```

### Configure SMTP (`api/.env`)
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=you@gmail.com
SMTP_PASS=your_app_password      # Gmail: create an App Password
MAIL_FROM=SplitKesh <no-reply@splitkesh.app>
```
Leave `SMTP_HOST` blank to print emails to the server console instead of sending them.

### Make yourself an admin
There's no public way to self-promote. Grant the first admin directly in the DB, then use the Admin dashboard to manage others:
```sql
UPDATE users SET is_admin = TRUE WHERE email = 'you@example.com';
```

### Payment reminder schedule
Default is daily at 09:00 server time. Override in `.env`:
```
REMINDER_CRON=0 9 * * *
```

## Notes / things to verify on your machine
- The backend JS was all syntax-checked. The frontend (React/JSX) could not be compiled in this environment (no npm install), so run `npm start` once to confirm the build; the edits were kept self-contained and bracket-balanced.
- The Contact Picker API only works on supporting browsers (mainly Chrome on Android) over HTTPS/localhost. Where unsupported, the picker button is hidden and search still works.
