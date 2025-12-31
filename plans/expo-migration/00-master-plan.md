# Frontend Strategy - Master Plan

## Current Direction: React Web

**Stack:** React 18 + Vite + TypeScript + Tailwind CSS

**Deployed to:** Cloudflare Pages

---

## Decision: React Web Over Expo (Dec 2024)

We attempted an Expo (React Native) migration to support web, iOS, and Android from a single codebase. After implementation, we reverted to React web.

**Why Expo didn't work for us now:**
- Desktop and mobile experience wasn't good enough
- Added complexity without immediate benefit
- Mobile apps are not a priority yet

**When to revisit mobile:**
- When there's clear user demand for native mobile apps
- When the web product is stable and feature-complete
- Consider: Expo, Capacitor, or separate native apps

---

## Current State

### Completed Features
- Authentication (email/password, magic link, 2FA/TOTP)
- Password reset flow
- User management (CRUD, roles, permissions)
- Company management
- Dashboard with analytics/charts
- Settings page
- Audit logs
- Protected routes with role-based access
- Responsive layout with collapsible sidebar

### Tech Stack
| Layer | Technology |
|-------|------------|
| Framework | React 18 |
| Build | Vite |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Routing | React Router v6 |
| HTTP | Axios |
| Charts | Recharts |
| Icons | Lucide React |
| Testing | Vitest + Testing Library |
| Hosting | Cloudflare Pages |

### File Structure
```
authentication-dashboard-system/
├── src/
│   ├── App.tsx              # Routes + providers
│   ├── main.tsx             # Entry point
│   ├── brand.ts             # Branding config
│   ├── components/
│   │   ├── auth/            # Login, MagicLink, 2FA, TOTP
│   │   ├── ui/              # Button, Input, Modal, Toast
│   │   ├── charts/          # Dashboard charts
│   │   ├── modals/          # User/Company modals
│   │   ├── Layout.tsx       # Main layout wrapper
│   │   ├── Sidebar.tsx      # Navigation sidebar
│   │   └── Header.tsx       # Top header
│   ├── contexts/
│   │   ├── AuthContext.tsx  # Auth state + methods
│   │   ├── PermissionsContext.tsx
│   │   └── ThemeContext.tsx
│   ├── hooks/
│   │   └── useFeatureFlags.ts
│   ├── pages/
│   │   ├── LoginPage.tsx
│   │   ├── Home.tsx
│   │   ├── Dashboard.tsx
│   │   ├── Analytics.tsx
│   │   ├── Reports.tsx
│   │   ├── Settings.tsx
│   │   ├── UserManagement.tsx
│   │   ├── CompanyUserManagement.tsx
│   │   └── AuditLogsPage.tsx
│   ├── services/
│   │   └── api.ts           # API client
│   └── config/
│       └── environment.ts
├── worker/                  # Cloudflare Worker backend
├── migrations/              # D1 database migrations
└── package.json
```

---

## Future Considerations

### Mobile (When Ready)
Options to evaluate:
1. **Expo/React Native** - Full native, but more complexity
2. **Capacitor** - Wrap existing React app in native shell
3. **PWA** - Progressive Web App (no app store)
4. **Separate native apps** - iOS (Swift), Android (Kotlin)

### Frontend Improvements (Backlog)
- Dark mode toggle
- Improved mobile responsiveness
- Offline support (service worker)
- Performance optimization
- E2E testing with Playwright

---

## Archived Plans

The original Expo migration plans (stages 01-07) are preserved below for reference if we revisit mobile in the future.

- [01-project-setup.md](./01-project-setup.md) - Expo + NativeWind setup
- [02-api-storage.md](./02-api-storage.md) - API client + secure storage
- [03-auth-context.md](./03-auth-context.md) - Auth context for RN
- [04-login-screen.md](./04-login-screen.md) - Login UI
- [05-magic-link.md](./05-magic-link.md) - Magic link flow
- [06-two-factor.md](./06-two-factor.md) - 2FA flow
- [07-navigation.md](./07-navigation.md) - Navigation + protected routes
