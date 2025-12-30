# Stage 01: Project Setup

## Objective

Create a new Expo project with Expo Router and NativeWind configured, ready for development.

---

## Dependencies

**Requires:** None (first stage)

---

## Complexity

**Low** - Standard tooling setup

---

## Files to Create

| File | Purpose |
|------|---------|
| `notropolis-expo/` | New project directory |
| `app.json` | Expo configuration |
| `tailwind.config.js` | NativeWind configuration |
| `babel.config.js` | Babel with NativeWind preset |
| `app/_layout.tsx` | Root layout |
| `app/index.tsx` | Entry point redirect |

---

## Implementation Details

### 1. Create Expo Project

```bash
cd /Users/riki/notropolis
npx create-expo-app@latest notropolis-expo -t tabs
cd notropolis-expo
```

### 1b. Clean Up Template Files

The tabs template creates files we don't need. Remove them:

```bash
# Remove template app screens (we'll create our own)
rm -rf app/\(tabs\)
rm app/+not-found.tsx
rm app/+html.tsx 2>/dev/null || true

# Remove template components
rm -rf components/

# Keep assets folder but we'll add our own images later
```

### 2. Install Dependencies

```bash
# NativeWind (Tailwind for RN)
npm install nativewind tailwindcss

# Storage
npm install @react-native-async-storage/async-storage

# HTTP client (already familiar with)
npm install axios

# Expo secure store (for tokens - more secure than AsyncStorage)
npx expo install expo-secure-store
```

### 3. Configure Tailwind

```js
// tailwind.config.js
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
          950: '#082f49',
        },
        neutral: {
          0: '#ffffff',
          50: '#fafafa',
          100: '#f5f5f5',
          200: '#e5e5e5',
          300: '#d4d4d4',
          400: '#a3a3a3',
          500: '#737373',
          600: '#525252',
          700: '#404040',
          800: '#262626',
          900: '#171717',
          950: '#0a0a0a',
        },
      },
    },
  },
  plugins: [],
};
```

### 4. Configure Babel

```js
// babel.config.js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
  };
};
```

### 5. Configure Metro

```js
// metro.config.js
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, { input: "./global.css" });
```

### 6. Create Global CSS

```css
/* global.css */
@tailwind base;
@tailwind components;
@tailwind utilities;
```

### 7. Update App Entry

```tsx
// app/_layout.tsx
import { Stack } from 'expo-router';
import { useEffect } from 'react';
import "../global.css";

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="login" />
    </Stack>
  );
}
```

### 8. Create Index Redirect

```tsx
// app/index.tsx
import { Redirect } from 'expo-router';

export default function Index() {
  // For now, always redirect to login
  // Later: check auth state and redirect accordingly
  return <Redirect href="/login" />;
}
```

### 9. Create Placeholder Login

```tsx
// app/login.tsx
import { View, Text } from 'react-native';

export default function LoginScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-neutral-950">
      <Text className="text-white text-2xl">Login Screen</Text>
      <Text className="text-neutral-400 mt-2">Stage 01 Complete</Text>
    </View>
  );
}
```

### 10. Update app.json

```json
{
  "expo": {
    "name": "Notropolis",
    "slug": "notropolis",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/images/icon.png",
    "scheme": "notropolis",
    "userInterfaceStyle": "automatic",
    "splash": {
      "image": "./assets/images/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#0a0a0a"
    },
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.notropolis.app"
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/images/adaptive-icon.png",
        "backgroundColor": "#0a0a0a"
      },
      "package": "com.notropolis.app"
    },
    "web": {
      "bundler": "metro",
      "output": "single",
      "favicon": "./assets/images/favicon.png"
    },
    "plugins": ["expo-router", "expo-secure-store"],
    "experiments": {
      "typedRoutes": true
    }
  }
}
```

---

## Database Changes

None

---

## Test Cases

| Test | Input | Expected Output |
|------|-------|-----------------|
| Start dev server | `npx expo start` | Metro bundler runs |
| Open iOS simulator | Press `i` | App loads, shows "Login Screen" |
| Open Android emulator | Press `a` | App loads, shows "Login Screen" |
| Open web browser | Press `w` | App loads, shows "Login Screen" |
| NativeWind styles | Check dark background | bg-neutral-950 applies |

---

## Acceptance Checklist

- [ ] Expo project created at `/Users/riki/notropolis/notropolis-expo`
- [ ] NativeWind configured and working
- [ ] Expo Router working with file-based routing
- [ ] App runs on iOS simulator (or skip if no Xcode)
- [ ] App runs on Android emulator (or skip if no Android Studio)
- [ ] App runs in web browser
- [ ] Tailwind classes apply styling correctly
- [ ] TypeScript configured
- [ ] No console errors on startup

---

## Deployment

```bash
# Start development
cd /Users/riki/notropolis/notropolis-expo
npx expo start

# Test platforms
# i - iOS simulator
# a - Android emulator
# w - Web browser
```

---

## Handoff Notes

**For Stage 02 (API & Storage):**
- Project structure is ready
- NativeWind gives us Tailwind syntax
- `expo-secure-store` installed for token storage
- Axios installed for API calls

**Key differences from React web:**
- `className` works thanks to NativeWind
- No `<div>` - use `<View>`
- No `<span>` or `<p>` - use `<Text>`
- Navigation via Expo Router `<Link>` and `router.push()`
