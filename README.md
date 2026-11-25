# Fit & Impact (`fitandimpact.com`)

Full-stack gym member, subscription, and biometric attendance management system optimized for the Supabase Free Tier.

## Architecture Principles

- **Zero DB queries on the public landing page:** `/` is 100% static marketing content to preserve database connection limits.
- **Strict route & data separation:** Public marketing routes (`/`, `/login`) are separated from authenticated admin routes (`/admin/*`) guarded by Supabase Auth and PostgreSQL Row Level Security (RLS).
- **Direct biometric hardware ingestion:** A Linux-based **ZKFace V4.0** terminal pushes ADMS / TA Push payloads over HTTP directly to a Supabase Edge Function (`supabase/functions/adms`).

## Tech Stack

- **Frontend:** React, Vite, Tailwind CSS, `react-router-dom`, `lucide-react`
- **Backend:** Supabase (PostgreSQL with RLS, Auth, Deno Edge Functions)
- **Hardware Integration:** ZKFace V4.0 (ADMS protocol)
- **Alerts:** WhatsApp membership expiration reminders

## Project Structure

```text
fit-and-impact/
├── src/
│   ├── components/
│   │   ├── layout/          # PublicNavbar, PublicFooter, AdminSidebar, AdminTopbar
│   │   ├── ui/              # Reusable UI primitives
│   │   └── ProtectedRoute.jsx
│   ├── context/
│   │   └── AuthContext.jsx
│   ├── lib/
│   │   └── supabase.js
│   └── pages/
│       ├── public/          # Landing.jsx, Login.jsx
│       └── admin/           # Dashboard.jsx, Members.jsx, Attendance.jsx
└── supabase/
    └── functions/
        └── adms/            # ADMS Edge Function for biometric punch ingestion
```

## Getting Started

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   Create a `.env` file in the project root with your Supabase credentials (never expose `service_role` keys in `VITE_*` variables):
   ```env
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

3. **Run the development server:**
   ```bash
   npm run dev
   ```

4. **Lint & build:**
   ```bash
   npm run lint
   npm run build
   ```
