# Mqulima Admin Panel

A separate Vite SPA for the Mqulima platform admin.

## Overview

This is the **admin panel** for the Mqulima agricultural platform. It runs as a completely independent Vite application with its own authentication system (`mq_admin_session` JWT cookie), separate from the main farmer-facing app.

## Stack

- **Framework:** Vite + React 19 + TanStack Router
- **Styling:** Tailwind CSS v4 + Radix UI
- **Server Functions:** TanStack Start `createServerFn()`
- **Database:** PostgreSQL (shared with main app — same `DATABASE_URL`)
- **Auth:** Separate JWT session (`mq_admin_session`), requires `role = 'admin'` in profiles table

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy and fill env file
cp .env.example .env

# 3. Start dev server (default port: 3001)
npm run dev
```

## Environment Variables

```env
DATABASE_URL=postgresql://mqulima:password@localhost:5433/mqulima_dev
JWT_SECRET=your_jwt_secret_here          # Must match main app JWT_SECRET
VITE_APP_URL=http://localhost:3001
```

> ⚠️ The admin panel uses the **same** `JWT_SECRET` and `DATABASE_URL` as the main app. Do NOT use a different secret or you will break cross-system token validation.

## Admin Account

Create an admin user by setting `role = 'admin'` on a profile row:

```sql
UPDATE profiles SET role = 'admin' WHERE email = 'your@email.com';
```

## Deployment

Deploy as a separate Vercel project or on a subdomain (e.g., `admin.mqulima.com`).
