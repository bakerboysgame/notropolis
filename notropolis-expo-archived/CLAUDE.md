# Notropolis Expo App

## Branding

**App Name:** Notropolis

**Color Palette (Tailwind/NativeWind):**
- Primary: `primary-500` (#0ea5e9) - sky blue
- Background: `neutral-950` (#0a0a0a) - near black
- Surface: `neutral-900` (#171717) - dark gray cards
- Border: `neutral-800` (#262626) - subtle borders
- Text primary: `white`
- Text secondary: `neutral-400` (#a3a3a3)
- Error: `red-400` / `red-500`
- Success: `green-400`

**Theme:** Dark mode only (for now)

**Tagline:** "It's a dog eat dog world in there....."

---

## Build Stack

| Layer | Technology |
|-------|------------|
| Framework | Expo (React Native) |
| Routing | Expo Router (file-based) |
| Styling | NativeWind (Tailwind for RN) |
| HTTP Client | Axios |
| Storage | expo-secure-store (native) / localStorage (web) |
| State | React Context (AuthContext) |

**Targets:** Web, iOS, Android (single codebase)

---

## Project Structure

```
notropolis-expo/
├── app/                          # Expo Router pages
│   ├── _layout.tsx               # Root layout with AuthProvider
│   ├── index.tsx                 # Auth redirect
│   ├── login.tsx                 # Login screen
│   ├── magic-link.tsx            # Magic link verification
│   ├── two-factor.tsx            # 2FA verification
│   └── (authenticated)/          # Protected routes
│       ├── _layout.tsx           # Auth guard + ResponsiveLayout
│       └── home.tsx              # Home screen
├── components/
│   ├── ui/                       # Reusable UI components
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   └── CodeInput.tsx
│   └── layout/                   # Layout components
│       ├── ResponsiveLayout.tsx  # Desktop/mobile switcher
│       └── Sidebar.tsx           # Desktop sidebar
├── contexts/
│   └── AuthContext.tsx           # Auth state management
├── services/
│   ├── api.ts                    # Axios client + types
│   └── storage.ts                # Storage abstraction
└── config/
    └── environment.ts            # API URL config
```

---

## Key Patterns

### Responsive Layout
- Desktop (≥768px): Sidebar + content
- Mobile (<768px): Content only
- Use `useWindowDimensions()` for detection

### Auth Flow
1. App loads → check token in storage
2. No token → redirect to `/login`
3. Login → may return `requiresTwoFactor` or `requiresMagicLink`
4. Success → store token, redirect to `/(authenticated)/home`
5. 401 response → clear token, redirect to login

### Storage Abstraction
```typescript
// Native: SecureStore, Web: localStorage
import { tokenStorage } from './services/storage';
await tokenStorage.setToken(token);
await tokenStorage.getToken();
await tokenStorage.clearToken();
```

---

## API

**Base URL:** `https://api.notropolis.net`

**Key Endpoints:**
- `POST /api/auth/login` - email/password login
- `POST /api/auth/magic-link/request` - request magic link
- `POST /api/auth/magic-link/verify-code` - verify 6-digit code
- `POST /api/auth/2fa/request` - request 2FA code
- `POST /api/auth/2fa/verify` - verify 2FA code
- `GET /api/auth/me` - get current user

---

## Build & Deploy

```bash
# Development
npx expo start

# Build web
npx expo export --platform web

# Deploy to Cloudflare Pages
CLOUDFLARE_API_TOKEN="..." CLOUDFLARE_ACCOUNT_ID="..." \
npx wrangler pages deploy ./dist --project-name=notropolis-dashboard

# Build native apps
npx eas build --platform ios
npx eas build --platform android
```

---

## Related Projects

- `authentication-dashboard-system/` - Legacy React dashboard (archived)
- `notropolis-api/` - Cloudflare Workers backend
