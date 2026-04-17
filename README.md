# Telled CRM — Enterprise Operations Platform

Full-stack CRM + Operations + HR & Finance web application.

## Tech Stack

**Frontend:** React 18 + Vite, TypeScript, Tailwind CSS, Zustand, React Router v6, Axios, Recharts, Lucide Icons
**Backend:** Node.js + Express, TypeScript, MongoDB/Mongoose, JWT Auth, Nodemailer, PDFKit, Node-cron, Winston

---

## Getting Started

### Prerequisites
- Node.js 18+
- MongoDB (local or Atlas)
- SMTP credentials (Gmail / any provider)

---

### 1. Backend Setup

```bash
cd backend
npm install
cp .env.example .env
```

Edit `.env`:
```env
MONGODB_URI=mongodb://localhost:27017/telled-crm
PORT=5000
JWT_SECRET=your-super-secret-jwt-key-here
JWT_REFRESH_SECRET=your-refresh-secret-here
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=Telled CRM <your@gmail.com>
FRONTEND_URL=http://localhost:5173
```

Start backend:
```bash
npm run dev
```

Seed initial data (optional):
```bash
npm run seed
```

**Default seeded users:**
| Email | Password | Role |
|---|---|---|
| admin@telled.com | Admin@123 | Admin |
| sales1@telled.com | Sales@123 | Sales |
| sales2@telled.com | Sales@123 | Sales |
| eng1@telled.com | Eng@123 | Engineer |
| eng2@telled.com | Eng@123 | Engineer |
| hr@telled.com | HR@123 | HR Finance |

---

### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Open: http://localhost:5173

---

## Project Structure

```
telled-marketing/
├── backend/
│   ├── src/
│   │   ├── config/        # DB, Email, Constants
│   │   ├── controllers/   # Business logic (13 controllers)
│   │   ├── cron/          # Automated jobs (5 cron tasks)
│   │   ├── middleware/    # Auth, Role, Error, Upload
│   │   ├── models/        # Mongoose schemas (12 models)
│   │   ├── routes/        # Express routes (13 route files)
│   │   ├── services/      # Auth, Email, PDF services
│   │   └── utils/         # Logger, Helpers, Responses, Seed
│   └── package.json
└── frontend/
    └── src/
        ├── api/           # Axios API layer (per-module)
        ├── components/
        │   ├── common/    # Modal, Badge, Spinner, Confirm
        │   └── layout/    # Sidebar, Header, DashboardLayout
        ├── pages/         # 16 feature pages
        ├── store/         # Zustand auth store (persisted)
        ├── types/         # TypeScript interfaces
        └── utils/         # cn, formatters, permissions
```

---

## Features by Role

| Feature | Admin | Sales | Engineer | HR Finance |
|---|:---:|:---:|:---:|:---:|
| Dashboard | ✅ | ✅ | ✅ | ✅ |
| Leads (all) | ✅ | Own only | ❌ | ❌ |
| OEM Approval | ✅ Approve | ✅ Submit | ❌ | ❌ |
| Accounts | ✅ | ✅ | View | View |
| Quotations | ✅ | ✅ | ❌ | ❌ |
| Purchase Orders | ✅ | ✅ | ❌ | ❌ |
| Installations | ✅ | ❌ | ✅ | ❌ |
| Support Tickets | ✅ | ✅ | ✅ | ❌ |
| Invoices | ✅ | ❌ | ❌ | ✅ |
| Payments | ✅ | ❌ | ❌ | ✅ |
| Engineer Visits | ✅ Approve | ❌ | ✅ Log | ✅ Approve |
| Salary | ✅ | ❌ | ❌ | ✅ |
| Users | ✅ | ❌ | ❌ | ❌ |

---

## API Endpoints

Base: `http://localhost:5000/api`

- `POST /auth/login` — Login
- `POST /auth/refresh` — Refresh token
- `POST /auth/logout` — Logout
- `GET /auth/me` — Current user
- `GET /users` — List users (admin)
- `POST /users` — Create user (admin)
- `GET /leads` — List leads
- `POST /leads` — Create lead
- `GET /leads/:id` — Lead detail
- `PUT /leads/:id` — Update lead
- `DELETE /leads/:id` — Archive lead
- `GET /oem/lead/:leadId` — OEM attempts for lead
- `POST /oem` — Submit OEM attempt
- `PATCH /oem/:id/approve` — Approve OEM
- `PATCH /oem/:id/reject` — Reject OEM
- `PATCH /oem/:id/extend` — Extend OEM expiry
- `GET /accounts` — List accounts
- `POST /accounts/convert` — Convert lead to account
- `PATCH /accounts/:id/assign-engineer` — Assign engineer
- `GET /quotations` — List quotations
- `POST /quotations` — Create quotation (auto-PDF)
- `GET /purchase-orders` — List POs
- `POST /purchase-orders` — Create PO (with file upload)
- `GET /installations` — List installations
- `POST /installations` — Schedule installation
- `GET /support` — List tickets
- `POST /support` — Create ticket
- `POST /support/:id/notes` — Add internal note
- `GET /invoices` — List invoices
- `POST /invoices` — Create invoice (auto-PDF)
- `POST /invoices/:id/payments` — Record payment
- `GET /engineer-visits` — List visits
- `POST /engineer-visits` — Log visit
- `PATCH /engineer-visits/:id/approve` — HR approve/reject
- `GET /salaries` — List salaries
- `POST /salaries/calculate` — Calculate salary
- `PATCH /salaries/:id/pay` — Mark salary paid
- `GET /dashboard/admin` — Admin dashboard stats
- `GET /dashboard/engineer` — Engineer dashboard stats

---

## Automated Jobs (Cron)

| Schedule | Job |
|---|---|
| Every hour | Mark expired OEM attempts |
| Daily 9 AM | Send OEM expiry reminder emails (7 days before) |
| Daily 10 AM | Send invoice due reminder emails (3 days before) |
| Daily midnight | Mark overdue invoices |
| Every 6 hours | Auto-close stale support tickets (2 days no response) |

---

## OEM Approval State Machine

```
Lead → Submit OEM (Pending)
         ↓
    Admin Review
    ↙         ↘
Approved      Rejected
  ↓               ↓
Expiry Date    Lead can re-submit (new attempt)
  ↓
Expired (auto by cron) → Lead can re-submit
```

Rules:
- Only ONE Pending attempt at a time
- Cannot submit if already Approved and valid
- All attempts are preserved (never deleted)
- Extension history tracked per attempt

---

## Salary Formula

```
Final Salary = Base Salary + Visit Charges (approved) + Incentives − Deductions
```
