
Title
Implement real admin role gating and clean Team Switcher (Better Auth + tRPC)

Objective
- Enforce admin-only access to the Admin portal across server and web.
- Remove all mock role flags and fake “portal” switching.
- Team Switcher: show Portal Access (Agent always, Admin only when authorized), remove Teams list, keep “Add team”.
- Sidebar: path-based menus only; no role logic.

Non‑Negotiables (Better Auth)
- Use Better Auth React client: import { createAuthClient } from "better-auth/react"
- No SessionProvider. Use authClient.useSession() directly.
- Web client must pass credentials: "include" and baseURL = process.env.NEXT_PUBLIC_SERVER_URL.
- Server Better Auth baseURL must be the backend URL; configure trustedOrigins and CORS for cross-origin cookies.
- RBAC is enforced on the server (tRPC). The client mirrors UI state only.
- Admin access is strictly role === "admin" (not team_lead).

Paths to touch
- Server:
  - apps/server/src/lib/trpc.ts
  - apps/server/src/routers/admin.ts
- Web:
  - apps/web/src/components/team-switcher.tsx
  - apps/web/src/components/app-sidebar.tsx
  - apps/web/src/app/admin/settings/page.tsx

Implementation Steps

1) Server: enforce admin-only guards
- File: apps/server/src/lib/trpc.ts
  - In adminProcedure, change role check to admin-only:
  ```ts
  // Before:
  if (!userRole || !["admin", "team_lead"].includes(userRole)) { ... }

  // After:
  if (userRole !== "admin") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Admin access required",
      cause: `User role '${userRole}' is not authorized for admin operations`,
    })
  }
  ```
- File: apps/server/src/routers/admin.ts
  - In checkAdminRole, set admin-only:
  ```ts
  // Before:
  const isAdmin = userRole === "admin" || userRole === "team_lead"

  // After:
  const isAdmin = userRole === "admin"
  return { hasAdminAccess: isAdmin, role: userRole }
  ```

2) Web: Team Switcher — real role check and simplified UI
- File: apps/web/src/components/team-switcher.tsx
  - Remove any mock role flag (e.g., const isAdmin = true) and related comments.
  - Import and use Better Auth + tRPC:
  ```ts
  import { authClient } from "@/lib/auth-client"
  import { trpc } from "@/utils/trpc"

  const { data: session } = authClient.useSession()
  const { data: roleData } = trpc.admin.checkAdminRole.useQuery(undefined, {
    enabled: !!session,
    retry: false,
  })
  const hasAdminAccess = !!roleData?.hasAdminAccess
  ```
  - Compute current portal:
  ```ts
  const isInAdminPortal = pathname.startsWith("/admin")
  const currentPortal = isInAdminPortal ? "Admin Portal" : "Agent Dashboard"
  ```
  - Dropdown behavior:
    - Always show “Agent Dashboard” (router.push('/dashboard')); disabled when already in agent area.
    - Show “Admin Portal” only if hasAdminAccess (router.push('/admin')); disabled when already in admin area.
  - Remove Teams list entirely; keep only a single “Add team” item.
  - Do not early-return if teams is empty; default title to a fixed label (e.g., “InnovaCraft”).

3) Web: Sidebar — remove mocks, keep path-based menus
- File: apps/web/src/components/app-sidebar.tsx
  - Remove unused authClient import.
  - Replace sample teams with an empty array:
    - const data = { teams: [], navMain: [] }
  - Remove mock flags (e.g., const isAdmin = true).
  - Keep path-based switch only:
  ```ts
  const isCurrentlyInAdminPortal = pathname.startsWith("/admin")
  // Use isCurrentlyInAdminPortal to render Admin vs Agent groups
  ```
  - Do not add a portal toggle in the sidebar (Team Switcher handles switching).

4) Web: Admin Settings page — re-enable UI gating
- File: apps/web/src/app/admin/settings/page.tsx
  - Mirror the gating used in apps/web/src/app/admin/page.tsx:
  ```ts
  import { authClient } from "@/lib/auth-client"
  import { trpc } from "@/utils/trpc"

  const { data: session, isPending } = authClient.useSession()
  const { data: roleData, isLoading: isRoleLoading } =
    trpc.admin.checkAdminRole.useQuery(undefined, { enabled: !!session, retry: false })

  if (isPending || isRoleLoading) { /* show spinner */ }
  if (!session) { router.push("/login"); return null }
  if (!roleData?.hasAdminAccess) { /* render Access Denied + link to /dashboard */ }
  ```
  - Remove any temporary bypass blocks.

Environment Checklist
- Server env (apps/server/.env):
  - CORS_ORIGIN
  - BETTER_AUTH_SECRET
  - BETTER_AUTH_URL
  - DATABASE_URL
  - SUPABASE_URL
  - SUPABASE_SERVICE_ROLE_KEY
- Web env (apps/web/.env.local):
  - NEXT_PUBLIC_SERVER_URL
- Cookies/CORS:
  - SameSite None + Secure true in prod (already configured)
  - credentials: "include" on client
  - trustedOrigins + CORS_ORIGIN must include web origins

Testing
- Push DB schema: bun run db:push
- Promote an admin for testing (optional):
  - apps/server/scripts/fix-admin-role.ts → set email; run with Bun
- Sign in as a non-admin:
  - “Admin Portal” is hidden in Team Switcher
  - Visiting /admin or /admin/settings shows “Access Denied”
- Sign in as an admin:
  - “Admin Portal” is visible and navigable
  - /admin and /admin/settings load successfully

Acceptance Criteria
- Server:
  - adminProcedure denies any non-admin user
  - checkAdminRole returns hasAdminAccess true only for role === "admin"
- Web:
  - Team Switcher shows “Agent Dashboard” always; “Admin Portal” only for admins; Teams list removed; “Add team” remains
  - Sidebar menus switch only by path (/admin vs /dashboard)
  - Admin settings page is gated consistently with admin page

Better Auth References
- Client concept (React): https://www.better-auth.com/docs/concepts/client
- Session management: https://www.better-auth.com/docs/concepts/session-management
- Basic usage: https://www.better-auth.com/docs/basic-usage
- Drizzle adapter: https://www.better-auth.com/docs/adapters/drizzle
- Configuration: https://www.better-auth.com/docs/configuration
- Next.js reference: https://www.better-auth.com/docs/frameworks/nextjs

Do / Don’t (to avoid rework)
- Do use better-auth/react with authClient.useSession(); no SessionProvider
- Do keep credentials: "include" and correct baseURL envs
- Do enforce admin-only on server and reflect it in UI via tRPC
- Don’t use better-auth/client or add custom providers
- Don’t leave any const isAdmin = true mocks
- Don’t refactor cookies or secure settings already present

## Sidebar Navigation 404 Elimination

This section documents how we stabilized all Admin/Agent sidebar links by scaffolding missing routes and fixing a small navigation bug — without changing the Team Switcher behavior.

### Current State and Route Inventory

- Sidebar component: [apps/web/src/components/app-sidebar.tsx](cci:7://file:///c:/Users/USER%201/Steelix-final-1/steelix-final/apps/web/src/components/app-sidebar.tsx:0:0-0:0)
- Admin links:
  - /admin
  - /admin/approvals
  - /admin/agents
  - /admin/reports
  - /admin/settings
- Agent links:
  - /dashboard
  - /dashboard/pipeline
  - /dashboard/transactions
  - /dashboard/settings

- Existing pages in [apps/web/src/app/](cci:7://file:///c:/Users/USER%201/Steelix-final-1/steelix-final/apps/web/src/app:0:0-0:0):
  - Present: `/admin`, `/admin/settings`, `/dashboard`, `/dashboard/pipeline`, `/dashboard/settings`, `/login`, `/`, `/sales`
  - Missing (causing 404s): `/admin/approvals`, `/admin/agents`, `/admin/reports`, `/dashboard/transactions`

- Bug to fix:
  - [apps/web/src/app/admin/page.tsx](cci:7://file:///c:/Users/USER%201/Steelix-final-1/steelix-final/apps/web/src/app/admin/page.tsx:0:0-0:0) has a redirect to `/agent-dashboard` (doesn’t exist). Should be `/dashboard`.

### Step-by-Step Implementation Plan

1) Create Agent Transactions route
- Path: `apps/web/src/app/dashboard/transactions/page.tsx`
- Shell: copy the pattern from [app/dashboard/page.tsx](cci:7://file:///c:/Users/USER%201/Steelix-final-1/steelix-final/apps/web/src/app/dashboard/page.tsx:0:0-0:0) or [app/dashboard/pipeline/page.tsx](cci:7://file:///c:/Users/USER%201/Steelix-final-1/steelix-final/apps/web/src/app/dashboard/pipeline/page.tsx:0:0-0:0)
- Must include:
  - `"use client"`
  - [SidebarProvider](cci:1://file:///c:/Users/USER%201/Steelix-final-1/steelix-final/apps/web/src/components/sidebar.tsx:48:0-136:1), [AppSidebar](cci:1://file:///c:/Users/USER%201/Steelix-final-1/steelix-final/apps/web/src/components/app-sidebar.tsx:35:0-178:1), [SidebarInset](cci:1://file:///c:/Users/USER%201/Steelix-final-1/steelix-final/apps/web/src/components/sidebar.tsx:281:0-292:1), [SidebarTrigger](cci:1://file:///c:/Users/USER%201/Steelix-final-1/steelix-final/apps/web/src/components/sidebar.tsx:229:0-255:1)
  - Breadcrumb to `/dashboard`
  - `UserDropdown`
  - A simple placeholder content block titled “Transactions”
- Auth: Optional for now (follow current agent routes). If needed, add `authClient.useSession()` for login gating.

2) Create Admin placeholder routes
- Paths:
  - `apps/web/src/app/admin/approvals/page.tsx`
  - `apps/web/src/app/admin/agents/page.tsx`
  - `apps/web/src/app/admin/reports/page.tsx`
- Shell: same composition as [app/admin/page.tsx](cci:7://file:///c:/Users/USER%201/Steelix-final-1/steelix-final/apps/web/src/app/admin/page.tsx:0:0-0:0) / [app/admin/settings/page.tsx](cci:7://file:///c:/Users/USER%201/Steelix-final-1/steelix-final/apps/web/src/app/admin/settings/page.tsx:0:0-0:0)
- Guards:
  - Use `authClient.useSession()` from [apps/web/src/lib/auth-client.ts](cci:7://file:///c:/Users/USER%201/Steelix-final-1/steelix-final/apps/web/src/lib/auth-client.ts:0:0-0:0)
  - Enforce role with `trpc.admin.checkAdminRole.useQuery(...)` as in [app/admin/page.tsx](cci:7://file:///c:/Users/USER%201/Steelix-final-1/steelix-final/apps/web/src/app/admin/page.tsx:0:0-0:0)
  - Provide loading state and Access Denied fallback (mirror [app/admin/page.tsx](cci:7://file:///c:/Users/USER%201/Steelix-final-1/steelix-final/apps/web/src/app/admin/page.tsx:0:0-0:0))

3) Fix Admin Access Denied redirect
- File: [apps/web/src/app/admin/page.tsx](cci:7://file:///c:/Users/USER%201/Steelix-final-1/steelix-final/apps/web/src/app/admin/page.tsx:0:0-0:0)
- Change `router.push('/agent-dashboard')` → `router.push('/dashboard')`

4) Keep the app stable
- All new pages must be client components (`"use client"`)
- Use the exact import patterns from existing dashboard/admin pages
- Do not alter [AppSidebar](cci:1://file:///c:/Users/USER%201/Steelix-final-1/steelix-final/apps/web/src/components/app-sidebar.tsx:35:0-178:1) logic. It already switches content by `pathname.startsWith('/admin')`.
- Ensure `.env.local` has `NEXT_PUBLIC_SERVER_URL` for Better Auth client

5) Commit policy
- Commit in small, reviewable chunks:
  - feat(web): add /dashboard/transactions placeholder
  - feat(web): add admin approvals/agents/reports placeholders
  - fix(web): correct admin Access Denied redirect
- Run the app and click through links after each commit

### QA Checklist

- Admin portal:
  - Open `/admin`
  - Click “Commission Approvals” → `/admin/approvals` (no 404)
  - Click “Agent Management” → `/admin/agents` (no 404)
  - Click “Reports & Analytics” → `/admin/reports` (no 404)
  - Click “Settings” → `/admin/settings`
- Agent portal:
  - Open `/dashboard`
  - Click “Pipeline” → `/dashboard/pipeline`
  - Click “Transactions” → `/dashboard/transactions` (no 404)
  - Click “Settings” → `/dashboard/settings`
- Access control:
  - Non-admin users see “Access Denied” on admin routes, with a working button to `/dashboard`
- Visuals:
  - Sidebar active state highlights the current route
  - No console errors

### Risks and Rollback

- Changes are additive and low-risk. Rollback by deleting newly added route directories.
- Ensure `NEXT_PUBLIC_SERVER_URL` is configured so `authClient` works; otherwise admin pages will redirect to `/login`.

### Future Enhancements (Optional)

- Use Next.js `Link` in [apps/web/src/components/app-sidebar.tsx](cci:7://file:///c:/Users/USER%201/Steelix-final-1/steelix-final/apps/web/src/components/app-sidebar.tsx:0:0-0:0) (replace `<a href>` with `<Link href>` with `asChild` on [SidebarMenuButton](cci:1://file:///c:/Users/USER%201/Steelix-final-1/steelix-final/apps/web/src/components/sidebar.tsx:462:0-509:1)) for SPA navigation.
- Extract a reusable page shell (header + breadcrumbs + sidebar) into a `components/page-shell.tsx` to DRY up pages.
- Add `layout.tsx` under `/dashboard` and `/admin` to centralize the shell.
- Add `app/not-found.tsx` (and optionally `app/admin/not-found.tsx`) for friendly 404s.

### Definition of Done

- All sidebar links route without 404
- Admin routes are gated by session + admin role
- Redirect button in admin Access Denied view points to `/dashboard`
- No changes to Team Switcher behavior
- No runtime console errors