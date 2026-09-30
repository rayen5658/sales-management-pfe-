# GestionVentes â€” Sales Management System

A full-stack B2B sales management application built as a final-year project (PFE). It covers the complete sales cycle: product catalog, client management, order lifecycle, real-time analytics, and a dedicated client portal â€” with role-based access control across three staff roles.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Zustand, Recharts, React Router v6 |
| Backend | Node.js, Express 5, PostgreSQL (raw SQL via `pg`) |
| Auth | JWT (separate tokens for staff and client portal) |
| PDF | jsPDF + jspdf-autotable |
| Styling | CSS custom properties, Lucide icons |

---

## Features

### Admin Portal (Staff)

**Three distinct roles with enforced permissions:**

| Role | Access |
|---|---|
| **Administrator** | Full access â€” all modules, users, audit logs, analytics |
| **Manager** | Business management â€” orders, products, clients, analytics (no user management) |
| **Sales Agent** | Personal view â€” own orders, own clients, create/edit pending orders only |

- Real-time dashboard with KPIs, revenue charts, Tunisia regional map, top products/clients
- Full order lifecycle: Pending â†’ Confirmed â†’ Shipped â†’ Delivered + cancel with stock restore
- First Delivery API integration (shipping simulation)
- PDF invoice generation
- Bulk order actions (Admin/Manager)
- Product CSV import/export
- Audit logs (Administrator only)
- AI chatbot (rule-based, zero API credits)

### Client Portal

- Browse product catalog with search, category and price filters
- Cart with localStorage persistence
- 3-step checkout with delivery information form
- Order history with real-time status tracking
- Reorder from history with stock validation
- Personal AI chatbot (answers questions about their own orders/account)

---

## Prerequisites

- Node.js 18+
- PostgreSQL 14+
- npm

---

## Setup

### 1. Database

Create a database and run migrations in order:

```bash
psql -U postgres -d your_db_name -f backend/migrations/001_add_order_tracking.sql
psql -U postgres -d your_db_name -f backend/migrations/002_client_portal.sql
psql -U postgres -d your_db_name -f backend/migrations/003_delivery_tracking.sql
psql -U postgres -d your_db_name -f backend/migrations/004_add_estimated_delivery.sql
psql -U postgres -d your_db_name -f backend/migrations/011_seed_tech_products.sql
psql -U postgres -d your_db_name -f backend/migrations/psql -U postgres -d your_db_name -f backend/migrations/006_local_images_only.sql
psql -U postgres -d your_db_name -f backend/migrations/007_update_jpg_images.sql
psql -U postgres -d your_db_name -f backend/migrations/009_seed_orders.sql
psql -U postgres -d your_db_name -f backend/migrations/010_seed_regional_clients_orders.sql
```

### 2. Backend

```bash
cd backend
cp .env.example .env
# Edit .env with your database credentials and JWT secret
npm install
npm start
```

Backend runs on **http://localhost:5000**

### 3. Frontend

```bash
cd frontend
cp .env.example .env
# Edit .env if backend URL differs from default
npm install
npm run dev
```

Frontend runs on **http://localhost:5173**

---

## Environment Variables

### Backend (`backend/.env`)

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=your_database_name
DB_USER=postgres
DB_PASSWORD=your_password

PORT=5000
JWT_SECRET=your_secret_key_here

# Optional â€” email notifications (Nodemailer)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@gmail.com
SMTP_PASS=your_app_password

# Optional â€” Gemini AI chatbot (leave empty to use rule-based fallback)
GEMINI_API_KEY=
```

### Frontend (`frontend/.env`)

```env
VITE_API_BASE_URL=http://localhost:5000/api
```

---

## Demo Credentials

### Admin / Staff Portal (`/login` â†’ Admin / Staff)

| Role | Email | Password |
|---|---|---|
| Administrator | `admin@test.com` | `admin123` |
| Manager | `manager@sales.com` | `manager123` |
| Sales Agent | `agent@sales.com` | `agent123` |

### Client Portal (`/login` â†’ Client Portal)

Clients must have portal access enabled by an Administrator or Manager from the Clients page.  
Default seeded client: contact your admin to enable portal access and set a password.

---

## Project Structure

```
GestionVentes/
â”œâ”€â”€ backend/
â”‚   â”œâ”€â”€ controllers.js       # Business logic
â”‚   â”œâ”€â”€ routes.js            # Express routes with RBAC middleware
â”‚   â”œâ”€â”€ middleware.js         # JWT verification + role authorization
â”‚   â”œâ”€â”€ validators.js         # express-validator rules
â”‚   â”œâ”€â”€ db.js                 # PostgreSQL pool
â”‚   â”œâ”€â”€ email.js              # Nodemailer order notifications
â”‚   â”œâ”€â”€ server.js             # Entry point
â”‚   â”œâ”€â”€ routes/
â”‚   â”‚   â”œâ”€â”€ clientPortal.js   # Client auth + portal endpoints
â”‚   â”‚   â”œâ”€â”€ chatbot.js        # Rule-based staff chatbot
â”‚   â”‚   â”œâ”€â”€ clientChatbot.js  # Rule-based client chatbot
â”‚   â”‚   â””â”€â”€ deliverySimulation.js
â”‚   â””â”€â”€ migrations/           # PostgreSQL schema + seed files
â””â”€â”€ frontend/
    â”œâ”€â”€ src/
    â”‚   â”œâ”€â”€ pages/            # One file per page (Dashboard, Orders, etc.)
    â”‚   â”œâ”€â”€ components/       # Shared UI components
    â”‚   â”œâ”€â”€ stores/           # Zustand state (auth, data)
    â”‚   â”œâ”€â”€ services/         # Axios API clients
    â”‚   â”œâ”€â”€ hooks/            # useSortableTable
    â”‚   â””â”€â”€ utils/            # PDF generation, helpers
    â””â”€â”€ public/products/      # Local product images
```

---

## API Overview

All staff endpoints require a valid JWT in `Authorization: Bearer <token>`.  
Client portal endpoints require a client JWT (issued by `/api/client-auth/login`).

| Method | Route | Access |
|---|---|---|
| POST | `/api/auth/login` | Public |
| GET | `/api/products` | All staff |
| POST | `/api/products` | Admin, Manager |
| DELETE | `/api/products/:id` | Admin only |
| GET | `/api/orders` | All staff (Sales Agent: own orders only) |
| POST | `/api/orders` | All staff |
| PUT | `/api/orders/:id/status` | Admin, Manager |
| GET | `/api/users` | Admin only |
| GET | `/api/audit-logs` | Admin only |
| GET | `/api/dashboard/stats` | All staff (Sales Agent: personal data) |
| POST | `/api/client-auth/login` | Public (client portal) |
| GET | `/api/client-portal/products` | Authenticated clients |
| POST | `/api/client-portal/orders` | Authenticated clients |

---

## Running Tests

```bash
cd frontend
npm test
```

Frontend tests use Vitest + React Testing Library.

---

## License

PFE project â€” Dynamix Services Â· 2026
