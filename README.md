# Full Stack Loan Management System (Gold & Silver Finance Management PWA)

A production-ready, full-stack Progressive Web Application (PWA) built for finance shops, pawn brokers, and gold/silver loan businesses.

## Tech Stack

- **Frontend**: React, Vite, TypeScript, Tailwind CSS, React Router, React Hook Form, TanStack Table, Framer Motion, Lucide Icons, html2pdf.js, PWA Service Worker (VitePWA), IndexedDB offline storage (`idb`).
- **Backend**: Node.js, Express.js REST API.
- **Database & ORM**: PostgreSQL / SQLite powered by Prisma ORM.

## Key Features

1. **Database & Customer Management**:
   - Store customers with relationship type (S/O, D/O, W/O), father/husband name, village, mobile, address, and remarks.
   - Instant search while typing by Customer Name, Mobile Number, or Village.

2. **Pledged Loan Item Records (Gold & Silver)**:
   - Track pledged items with Metal category (Gold / Silver), Weight in grams, Loan Date, Principal, Interest Rate, Compound Frequency, Loan Period, and Remarks.
   - Visual distinction for `RELEASED` items (light green background, zero outstanding balance, released badge).

3. **Custom Financial Calendar & Compound Interest Engine**:
   - Strict 360-day calendar math: **30 Days = 1 Month**, **12 Months = 1 Year** (360 Days = 1 Year).
   - Interest formula: `Interest = Principal * Interest Rate * Days / 3000`.
   - Cycle steps for Monthly (30d), 3 Months (90d), 6 Months (180d), and Yearly (360d).
   - Applied `Math.floor()` at every compound step and remaining duration. Never uses mathematical rounding (`Math.round`).

4. **Multi-Loan Selection & Batch Calculator**:
   - Select multiple pledged items using checkboxes.
   - Auto-imports selected loans into the Multi-Loan Calculator with live interactive inputs and Grand Summary.
   - Updates existing database records without creating duplicate loan entries.

5. **Release & Payment History Workflow**:
   - Record partial or full payments.
   - Auto-updates release status to `RELEASED` when payment satisfies final payable amount.
   - Maintains full payment transaction logs per loan item.

6. **Professional PDF Reports & PWA**:
   - Generates 2 loan calculation reports per page with shop header, numeric breakdown, grand summary, and page numbers.
   - PWA Installable app with offline IndexedDB caching.

---

## Local Development Setup

### 1. Backend Setup
```bash
cd backend
npm install
npx prisma db push
npm run prisma:seed
npm run dev
```
Backend runs on `http://localhost:5000`.

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
Frontend runs on `http://localhost:3000`.

---

## Production Deployment

- **Backend Deployment**: Deploy the `backend/` directory to **Render** or **Railway**. Configure `DATABASE_URL` environment variable for PostgreSQL.
- **Frontend Deployment**: Deploy the `frontend/` directory to **Vercel** or **GitHub Pages**.
