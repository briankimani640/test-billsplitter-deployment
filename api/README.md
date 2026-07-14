# SplitKesh API

Node.js + Express + PostgreSQL backend for the Bill Splitter app.

## Interactive API docs (Swagger)

Once the API is running, open the interactive documentation in a browser:

```
http://localhost:5000/api/docs
```

- Raw OpenAPI spec (JSON): `http://localhost:5000/api/docs.json`
- These docs are generated from `api/docs/swagger.js` and are the **authoritative, always-current** list of endpoints.

### How to test an endpoint from the docs
1. Start the server (`npm run dev`) and open `http://localhost:5000/api/docs`.
2. Expand **Auth → POST /api/auth/login**, click **Try it out**, enter your email/password, **Execute**, and copy the `accessToken` from the response.
3. Click the green **Authorize** button (top right), paste the token, and confirm. (Authorization is remembered between calls.)
4. Now open any secured endpoint (e.g. **Groups → GET /api/groups**), click **Try it out → Execute**, and read the live response.

> Tip: access tokens expire in ~15 minutes — if calls start returning 401, log in again or call `POST /api/auth/refresh`.

## Quick Start

### 1. Prerequisites
- Node.js 18+
- PostgreSQL 14+ running locally

### 2. Setup

```bash
# Install dependencies
npm install

# Copy env file
cp .env.example .env
# Edit .env — set DB_PASSWORD, JWT_SECRET etc.

# Create the database in PostgreSQL first:
# psql -U postgres -c "CREATE DATABASE splitkesh;"

# Run schema (creates all tables)
npm run db:setup

# Start dev server (with auto-reload)
npm run dev

# Or production start
npm start
```

Server runs on **http://localhost:5000**

---

## API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login, returns tokens |
| POST | `/api/auth/refresh` | Get new access token |
| POST | `/api/auth/logout` | Invalidate refresh token |
| GET  | `/api/auth/me` | Get current user |

### Users
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET  | `/api/users/me` | Get profile |
| PUT  | `/api/users/me` | Update name/phone |
| PUT  | `/api/users/me/password` | Change password |
| GET  | `/api/users/search?q=name` | Search users |

### Groups
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET    | `/api/groups` | List my groups |
| POST   | `/api/groups` | Create group |
| GET    | `/api/groups/:id` | Group details + members + expenses |
| PUT    | `/api/groups/:id` | Update group (admin) |
| DELETE | `/api/groups/:id` | Delete group (admin) |
| GET    | `/api/groups/:id/balances` | Per-member balances |
| POST   | `/api/groups/:id/leave` | Leave group (blocked if you still owe) |
| POST   | `/api/groups/:id/members` | Add member |
| DELETE | `/api/groups/:id/members/:userId` | Remove member |
| GET    | `/api/groups/:groupId/expenses` | List expenses |

### Expenses
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST   | `/api/expenses` | Add expense (supports receipt image upload) |
| GET    | `/api/expenses/:id` | Get expense + splits |
| PUT    | `/api/expenses/:id` | Update expense |
| DELETE | `/api/expenses/:id` | Delete expense |

### IOUs
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/ious` | All IOUs (both directions) |
| GET | `/api/ious/i-owe` | What I owe others |
| GET | `/api/ious/owed-to-me` | What others owe me |

### Settlements
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET  | `/api/settlements` | My settlement history |
| GET  | `/api/settlements/suggested` | Suggested payments (pairwise, net of confirmed) |
| GET  | `/api/settlements/pending` | Payments to confirm / awaiting the other side |
| POST | `/api/settlements` | Record a payment |
| PUT  | `/api/settlements/:id/confirm` | Confirm a payment you received |
| PUT  | `/api/settlements/:id/paid` | Deprecated alias for confirm |

### Disputes
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/disputes` | Disputes involving me |
| POST | `/api/disputes` | Raise a dispute on a received payment |
| PUT | `/api/disputes/:id/resolve` | Resolve a dispute (initiator only) |

### Stats / Dashboard
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/stats/summary?period=day\|month\|quarter\|year` | Total spent, owe, owed |
| GET | `/api/stats/by-category` | Spending by category |
| GET | `/api/stats/by-month` | Last 6 months |
| GET | `/api/stats/by-group` | Spending per group |

### OCR
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ocr/receipt` | Upload receipt image → returns amount + merchant |

---

## Auth

All endpoints except `/api/auth/register` and `/api/auth/login` require:

```
Authorization: Bearer <accessToken>
```

Access tokens expire in 15 minutes. Use `/api/auth/refresh` with your `refreshToken` to get a new one.

---

## Add Expense — Request Body

```json
{
  "groupId": "uuid",
  "description": "Dinner at Java",
  "amount": 3600,
  "paidBy": "user-uuid",
  "category": "Food",
  "emoji": "🍽️",
  "splitType": "equal",
  "date": "2024-06-15",
  "splits": []
}
```

For `splitType: "exact"` provide splits array:
```json
"splits": [
  { "userId": "uuid1", "amount": 1200 },
  { "userId": "uuid2", "amount": 1200 },
  { "userId": "uuid3", "amount": 1200 }
]
```

---

## New endpoints (this release)

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/forgot-password` | Email a password reset link |
| POST | `/api/auth/reset-password` | Reset password with token |
| POST | `/api/auth/verify-email` | Verify email with token |
| POST | `/api/auth/resend-verification` | Resend verification email |

### Users
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users/preferences` | Get preferences |
| PUT | `/api/users/preferences` | Update preferences (merged) |
| POST | `/api/users/lookup-contacts` | Match phone contacts to app users |

### Notifications
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/notifications` | List notifications |
| GET | `/api/notifications/unread-count` | Unread count |
| PUT | `/api/notifications/:id/read` | Mark one read |
| PUT | `/api/notifications/read-all` | Mark all read |
| DELETE | `/api/notifications/:id` | Delete one |

### Admin (super admin only)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/overview` | Counts + volume + signups |
| GET | `/api/admin/metrics` | Request monitoring (24h) |
| GET | `/api/admin/users` | List/search users |
| PUT | `/api/admin/users/:id/admin` | Grant/revoke admin |
| GET | `/api/admin/groups` | List all groups |
