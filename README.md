## Steelix Final — CRM + Transactions + WhatsApp Inbox

Steelix Final is a **real-estate sales CRM** built as a full-stack TypeScript monorepo. It includes **lead/prospect management**, a **transaction pipeline with commission workflows**, a **WhatsApp inbox + auto-replies**, and an **admin portal** for agent management and reporting.

### What you can do (Product)

- **CRM (Prospects)**
  - Add and manage prospects (buyers/tenants)
  - Track pipeline stages (Kanban) and lead type (**personal** vs **company**)
  - Claim unassigned company leads
  - Add notes/timeline entries per prospect
  - Categorize prospects with admin-managed **projects** and **tags**

- **Transactions & Commission Workflow**
  - Create transactions as **drafts** and progressively complete details (property, client, co-broking, commission, documents)
  - Submit transactions for review, track statuses: `draft → submitted → under_review → approved/rejected → completed`
  - Calculate commission breakdowns (supports **agent tiers** and **leadership bonus** logic)
  - Upload and manage transaction documents (via Supabase Storage when configured)

- **WhatsApp Inbox**
  - View conversations + messages synced to the database
  - Send outbound messages (Kapso integration)
  - Auto-assign conversations to agents on first reply/send
  - Unread filters and real-time-ish refresh polling in the UI

- **Auto Reply Rules**
  - Create rules based on trigger types (`contains`, `equals`, `starts_with`, `regex`)
  - Separate rule sets for “tenant” vs “owner” message context

- **Calendar & Announcements**
  - Org calendar events (admin-managed) and announcements visible to agents

- **Admin Portal**
  - Manage agents (roles, tiers, team/agency, commission split, goals, activity)
  - Commission approval queue + approvals workflow
  - Reports & analytics (performance/financial/transaction/co-broking summaries)

### Roles & access model (high level)

- **Agents**: work in CRM, transactions, WhatsApp inbox, auto-replies, calendar viewing.
- **Admins**: manage tags/projects/agents, approvals queue, reports, tier configuration.
- **Bootstrap**: the **first user created** is automatically assigned `admin` (see server auth hook).

### Tech stack

- **Web**: Next.js + React, TailwindCSS, shadcn/ui, TanStack Query, tRPC client
- **Server**: Hono + tRPC, Better Auth, Drizzle ORM
- **Database**: PostgreSQL (Drizzle schema)
- **Runtime / tooling**: Bun, Turborepo, Biome, Husky
- **Integrations**: Kapso (WhatsApp), Supabase Storage (documents), Telegram (feedback)

### Project structure

```bash
steelix-final/
├── apps/
│   ├── web/         # Next.js frontend (port 3001)
│   ├── native/      # Expo app (optional)
│   └── server/      # Hono + tRPC API (default port 8080)
└── packages/        # Shared packages (if present)
```

## Getting started (local dev)

### Prerequisites

- Bun installed (`bun --version`)
- PostgreSQL database (local or hosted)

### Install dependencies

```bash
bun install
```

### Configure environment variables

Create `apps/server/.env` with at least:

- **`DATABASE_URL`**: PostgreSQL connection string
- **`BETTER_AUTH_URL`**: backend base URL (local: `http://localhost:8080`)
- **`BETTER_AUTH_SECRET`**: a strong secret for auth
- **`CORS_ORIGIN`**: comma-separated frontend origins (local: `http://localhost:3001`)

Optional (feature-specific):

- **WhatsApp (Kapso)**: `KAPSO_API_KEY`, `KAPSO_PHONE_NUMBER_ID`, optionally `KAPSO_API_URL`
- **Documents (Supabase)**: server-side Supabase admin env vars (see `apps/server/src/lib/supabase-admin.ts`)
- **Feedback (Telegram)**: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`

### Setup database (Drizzle)

```bash
bun db:push
```

### Run the apps

```bash
bun dev
```

### URLs

- **Web app**: `http://localhost:3001`
- **API (tRPC + auth)**: `http://localhost:8080`
  - Health: `GET /health`
  - Auth: `/api/auth/*`
  - tRPC: `/trpc/*`

## Scripts

- **`bun dev`**: run all apps (turborepo)
- **`bun dev:web`**: run only web
- **`bun dev:server`**: run only server
- **`bun dev:native`**: run Expo/native app
- **`bun build`**: build all apps
- **`bun check`**: Biome format/lint
- **`bun check-types`**: typecheck all apps
- **`bun db:push`**: push schema to DB
- **`bun db:generate`**: generate migrations
- **`bun db:migrate`**: run migrations
- **`bun db:studio`**: open Drizzle Studio
