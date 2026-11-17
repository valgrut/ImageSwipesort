# v8 — safe-area header spacing

- Wrap React Native screen in `SafeAreaProvider` and `SafeAreaView` from `react-native-safe-area-context`.
- Honor the phone's real top/bottom safe areas, including Android status bar, front camera cutout and bottom gesture system navigation.
- Add 10 px of breathing room below the safe area (rather than hard-coded 16 px Android / 44 px iOS offsets).
- Apply safe-area padding to the initial loading screen too.
- Adjust browser demo for `env(safe-area-inset-top)` / `env(safe-area-inset-bottom)` when installed as a PWA.
- No changes to media loading, swipe gestures, crop math or file operations.

## Update existing Expo Go project

Replace `App.js` with the v8 version, then run:

```
npx expo install react-native-safe-area-context
npx expo start -c
```

If using the full v8 ZIP, the dependency is included in `package.json`; use `npm install` and `npx expo start -c` as before.
