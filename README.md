# SplitKesh — Update (10)

## 1. Dark mode now actually toggles
- `app/src/styles/global.css` — added a full **light theme** (`html[data-theme="light"]`) plus smooth transitions.
- `app/src/context/AppContext.jsx` — theme is applied to `<html data-theme>`, persisted to `localStorage`, synced from the server preference on load, and exposed as `darkMode` / `setDarkMode` / `toggleDarkMode`.
- `app/src/pages/Profile.jsx` — the Dark Mode row uses the context toggle, so it switches the whole UI instantly.

## 2. Pay via M-Pesa / Equity / KCB → app download pages
- `app/src/pages/Settlement.jsx` — each button opens the official app store download page in a new tab.

## 3. Find people by @username (name & email no longer used or shown)
- DB: `api/db/migrations/002_username.sql` (+ mirrored in `schema.sql`) — new `username` column, backfilled from email, deduped, unique index. **Run this migration before using the feature.**
- `authController.register` — accepts/validates a username (auto-generates a unique one if omitted).
- `userController.searchUsers` — matches **@username only** and returns `{id,name,username,initials}` (no email/phone).
- `userController.lookupContacts` — returns username instead of email.
- `MemberPicker.jsx` — placeholder "Search by @username"; results show `@handle`.
- `Login.jsx` — sign-up form has a Username field. `Profile.jsx` shows/edits username.



## 5. Monthly spending is a line graph
- `app/src/pages/Dashboard.jsx` — the Monthly Spending bar chart is now a smooth **area/line** chart (recharts).

## 6. Custom split that must total the bill
- `AddExpense.jsx` — the "Custom" split lets each member enter their own amount, with a live "allocated vs total" banner; **Save is blocked** until it balances (a Percent mode requiring 100% is included too).
- `expenseController.createExpense` — server-side guard rejects exact splits that don't total the amount, or percentages that don't total 100%.

## 7. Delete group & Delete account (with "Sorry to see you go")
- `GroupDetail.jsx` — admin-only **Delete group** button (Members tab) → confirm → "👋 Sorry to see you go".
- `Profile.jsx` — **Delete Account** in the danger zone → confirm → "👋 Sorry to see you go", then logout.
- Backend: `DELETE /api/users/me` (`userController.deleteAccount`); existing `DELETE /api/groups/:id` reused. All related rows cascade.

## Notes
- Run the new migration: `psql -U <user> -d splitkesh -f api/db/migrations/002_username.sql` (or `npm run db:migrate`).
- Frontend was **not** build-verified here (no npm/network), but every changed file passes a TypeScript JSX parse and the backend passes `node --check`.

## Fix — Save Expense stuck disabled
- **Cause:** the Add Expense screen relied on `selectedGroup.members`, but the groups *list* API only returns a member count — the members array comes only from the single-group endpoint. So the group selected when the page opened had no members, leaving nobody to split between and the Save button permanently disabled (all split types).
- **Fix (`app/src/pages/AddExpense.jsx`):** on open, the page now fetches the full selected group (with members). Custom/Percent splits seed to an **exact** even split (parts always total the bill / 100%), and a **"Split evenly"** button lets you rebalance in one tap.

## Partial settlements, confirmations & disputes
**Run the new migration first:** `psql -U <user> -d splitkesh -f api/db/migrations/003_settlements_disputes.sql`

- **Partial payments** — on Settle Up, a debt (e.g. KSh 240) can be paid in parts. "Record payment" captures the **amount, payment method, and transaction ID**; the outstanding amount ("KSh 100 left") updates once confirmed, and recalculates everywhere (suggested settlements, IOUs, dashboard).
- **Confirm / Dispute** — the person owed sees each recorded payment with **Confirm ✓** and **Dispute ⚠** (reason via a collapsible menu: Money not received / Fake transaction ID / Incomplete amount / Others, plus an optional note). Only confirmed payments reduce balances.
- **Disputes page** (`/disputes`) + a **Disputes** quick action under New Group. A dispute is between the two members; **only the member who raised it can resolve it.**
- **Notifications** — the recipient is notified who paid what amount, via which method, in which group; the payer is notified on confirm/resolve.
- **Auto-refresh** — the Settle tab and the home dashboard refresh on open, on window focus, and on a short interval, so balances stay live.

New files: `api/controllers/disputeController.js`, `api/routes/disputes.js`, `api/db/migrations/003_settlements_disputes.sql`, `app/src/pages/Disputes.jsx`.
Changed: `settlementController.js`, `iouController.js`, `routes/settlements.js`, `server.js`, `schema.sql`, `api.js`, `AppContext.jsx`, `Settlement.jsx`, `Home.jsx`, `App.jsx`, `global.css`.

*Note:* real-time "pop" notifications use polling (no websockets in this build), so a new payment shows within a few seconds rather than instantly. Settlements are netted per group, so a notification names the group and amount rather than a single expense.

## History, per-expense breakdown, daily stats, leave/delete guards
*(No new migration needed — uses existing tables.)*

- **Transaction History** — new page at `/history` with a **History** quick action on the home screen. Lists every payment you sent or received: who, when, amount, group, payment method, transaction ID, and status.
- **Daily stats** — the Stats/Dashboard period selector now has a **Day** option (alongside Month/Quarter/Year); figures refetch when you switch.
- **Per-expense breakdown** — in a group's Expenses tab, tap an expense to expand it and see **what each member (including you) was supposed to pay**, with the payer marked.
- **Leave group** — a member can leave a group, but only after they've **settled everything they owe** in it (server-enforced). If an admin leaves, admin passes to the next member.
- **Delete group guard** — the admin-only Delete button now **refuses to delete a group that still has unsettled bills**.

Backend changed: `controllers/groupController.js` (expense splits, delete guard, `leaveGroup`, balance helper), `controllers/dashboardController.js` (day period), `routes/groups.js` (leave route).
Frontend changed: `api/api.js`, `pages/History.jsx` (new), `App.jsx`, `pages/Home.jsx`, `pages/Dashboard.jsx`, `pages/GroupDetail.jsx`.
