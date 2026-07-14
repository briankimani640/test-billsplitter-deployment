# SplitKesh Frontend

A mobile-first expense splitting app frontend built with React — matches the provided UI designs exactly.

## Stack

- **React 18** + React Router v6
- **Recharts** for data visualizations
- **Axios** for HTTP (wired to your backend)
- Pure CSS with CSS custom properties (no Tailwind/MUI dependency)

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Copy env and set your backend URL
cp .env.example .env
# Edit .env → REACT_APP_API_URL=http://your-backend.com/api

# 3. Start dev server
npm start
```

App runs on **http://localhost:3000**

---

## Pages & Routes

| Route            | Page           | Description                                      |
|------------------|----------------|--------------------------------------------------|
| `/`              | Home           | Balance summary, group list, recent activity     |
| `/groups`        | Groups         | All groups with balance filters                  |
| `/groups/:id`    | GroupDetail    | Expenses, members, balances tabs                 |
| `/add-expense`   | AddExpense     | 2-step form: details → split configuration       |
| `/ious`          | IOUs           | Who owes whom, broken down by expense            |
| `/dashboard`     | Dashboard      | Monthly chart, category breakdown, group stats   |
| `/settlement`    | Settlement     | Minimum-transaction settlement suggestions       |
| `/profile`       | Profile        | User info, stats, settings                       |

---

## Connecting Your Backend

All API calls are defined in **`src/api/api.js`**. Each endpoint maps to a REST resource:

```
GET    /api/auth/me
GET    /api/groups
POST   /api/groups
GET    /api/groups/:id
GET    /api/groups/:id/expenses
POST   /api/expenses
GET    /api/ious
GET    /api/settlements/suggested
POST   /api/settlements
GET    /api/stats/summary
```

### To switch from mock → real data

In each page, replace the mock hook data with an API call. Example for `Home.jsx`:

```js
// Before (mock):
const { groups } = useApp();           // reads from mock

// After (real API):
const [groups, setGroups] = useState([]);
useEffect(() => {
  groupsAPI.list().then(r => setGroups(r.data));
}, []);
```

---

## Auth

The API client (`src/api/api.js`) reads a JWT from `localStorage.getItem('token')` and attaches it as `Authorization: Bearer <token>` on every request.

On a 401 response, it clears the token and redirects to `/login`.

---

## Project Structure

```
src/
├── api/
│   ├── api.js          ← All axios API calls (wire to your backend here)
│   └── mockData.js     ← Dev data — delete when going live
├── context/
│   └── AppContext.jsx  ← Global state (user, groups, toast, helpers)
├── components/
│   ├── TopNav.jsx      ← App header with back button & notifications
│   └── BottomNav.jsx   ← Bottom tab bar
├── pages/
│   ├── Home.jsx
│   ├── Groups.jsx
│   ├── GroupDetail.jsx
│   ├── AddExpense.jsx
│   ├── IOUs.jsx
│   ├── Dashboard.jsx
│   ├── Settlement.jsx
│   └── Profile.jsx
└── styles/
    └── global.css      ← All styles, CSS variables, components
```

---

## Build for Production

```bash
npm run build
# Output in /build — serve with any static host (Nginx, Netlify, Vercel, etc.)
```

---

## Design Tokens (CSS Variables)

| Variable              | Value     | Usage                     |
|-----------------------|-----------|---------------------------|
| `--bg-primary`        | `#0a0a14` | App background            |
| `--bg-card`           | `#16162a` | Card backgrounds          |
| `--purple-primary`    | `#7c5cfc` | Brand color, CTAs         |
| `--red`               | `#f04848` | Owe badges                |
| `--green`             | `#22c55e` | Credit badges             |
| `--text-primary`      | `#ffffff` | Main text                 |
| `--text-muted`        | `#6b6b90` | Labels, metadata          |

Customize in `src/styles/global.css` under `:root`.
