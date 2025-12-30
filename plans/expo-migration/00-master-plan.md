# Expo Migration - Master Plan

## Feature Overview

Migrate the Notropolis frontend from React (Vite) to React Native (Expo) to enable a single codebase for Web, iOS, and Android.

**Why:**
- Mobile apps are a "must have later"
- Building once in React Native avoids future rewrites
- Expo provides web support via React Native Web

**Current state:**
- Working auth system (login, magic link, 2FA, password reset)
- Backend API on Cloudflare Workers (unchanged)
- React + Tailwind + React Router frontend

**Target state:**
- Expo project with React Native
- Same auth flows working on iOS, Android, and Web
- NativeWind for Tailwind-like styling

---

## Success Criteria

1. Login with email/password works on iOS simulator
2. Login with email/password works on Android emulator
3. Login with email/password works on web browser
4. Magic link flow works (request → email → code entry)
5. 2FA flow works (code entry after password)
6. Forgot password flow works
7. Auth state persists across app restarts
8. Protected routes redirect to login when unauthenticated
9. Logout clears state and redirects to login

---

## Dependencies & Prerequisites

| Dependency | Status | Notes |
|------------|--------|-------|
| Node.js 18+ | Required | For Expo CLI |
| Expo CLI | Install | `npx create-expo-app` |
| Xcode | Optional | For iOS simulator |
| Android Studio | Optional | For Android emulator |
| Backend API | Complete | No changes needed |

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| AsyncStorage vs localStorage | Low | Medium | Abstract storage behind interface |
| Navigation differences | Medium | Low | Use Expo Router (file-based, familiar) |
| Styling migration | Medium | Medium | Use NativeWind (Tailwind for RN) |
| Web-specific features | Low | Low | Platform checks where needed |

---

## Stage Index

| Stage | Name | Description |
|-------|------|-------------|
| 01 | Project Setup | Create Expo project, configure NativeWind |
| 02 | API & Storage | Port API client, abstract storage |
| 03 | Auth Context | Port AuthContext with RN-compatible storage |
| 04 | Login Screen | Build login form with email/password |
| 05 | Magic Link Flow | Magic link request and code verification |
| 06 | 2FA Flow | Two-factor authentication screen |
| 07 | Navigation | Protected routes, auth flow navigation |
| 08 | Home Screen | Basic authenticated home screen |

---

## Out of Scope

- Game features (map, buildings, etc.) - separate plan
- Admin features
- Settings page
- Full UI polish (focus on functionality first)
- App store deployment

---

## Technical Decisions

**Expo Router** over React Navigation:
- File-based routing (similar to Next.js)
- Built-in web support
- Less boilerplate

**NativeWind** for styling:
- Tailwind syntax you already know
- Works on all platforms
- className prop like web

**Axios** stays:
- Works in React Native
- Keep existing interceptors

**AsyncStorage** for tokens:
- Standard for React Native
- Works on all platforms

---

## File Structure (Target)

```
notropolis-expo/
├── app/                    # Expo Router pages
│   ├── _layout.tsx         # Root layout with providers
│   ├── index.tsx           # Redirect to /login or /home
│   ├── login.tsx           # Login page
│   ├── magic-link.tsx      # Magic link verification
│   ├── two-factor.tsx      # 2FA verification
│   └── (authenticated)/    # Protected route group
│       ├── _layout.tsx     # Auth check wrapper
│       └── home.tsx        # Home screen
├── components/
│   ├── ui/                 # Button, Input, etc.
│   └── auth/               # LoginForm, etc.
├── contexts/
│   └── AuthContext.tsx     # Auth state
├── services/
│   ├── api.ts              # API client
│   └── storage.ts          # AsyncStorage wrapper
├── app.json                # Expo config
├── tailwind.config.js      # NativeWind config
└── package.json
```

---

## References

- [Ref: src/contexts/AuthContext.tsx] - Current auth logic to port
- [Ref: src/services/api.ts] - Current API client to port
- [Ref: src/pages/LoginPage.tsx] - Current login UI to rebuild
- [Ref: src/components/auth/LoginForm.tsx] - Current form to rebuild
