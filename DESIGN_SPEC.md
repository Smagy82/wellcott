# Handoff: Wellcott — “Medical Clean” Full App Redesign

## Overview
Complete visual + interaction redesign of the Wellcott clinic-finder app (Expo / expo-router / React Native, tested in **Expo Go**). Target look: “Medical Clean” — calm medical teal palette, Figtree type, soft layered shadows, Apple-style thin icons (Phosphor), springy micro-interactions, collapsing iOS-style header, floating glass tab bar.

## About the Design Files
The files in this bundle are **design references created in HTML** — prototypes showing intended look and behavior, **not production code to copy**. Your task is to **recreate this design in the existing Expo codebase** using its established patterns (expo-router tabs, `src/theme.ts`, i18n, existing components). Keep all business logic, data fetching, and EN/ES i18n intact — this is a reskin + interaction layer.

Reference file: `Wellcott — дизайн приложения.dc.html` (open in a browser). The screen labeled **3a** (top-left, interactive) is the target design. Section 2a is the same style, static. Ignore sections 1a–1c, 2b, 2c (older explorations).

## Fidelity
**High-fidelity.** Colors, typography, radii, shadows, spacing and interaction timings below are final. Recreate pixel-perfectly with RN equivalents.

## Constraints (Expo Go)
Use only Expo Go–compatible packages:
- `@expo-google-fonts/figtree` + `expo-font` — Figtree 400/500/600/700
- `phosphor-react-native` (+ `react-native-svg`) — icons, `weight="regular"` / `"fill"`
- `react-native-reanimated` — springs, collapsing header, shimmer
- `expo-blur` (`BlurView`) — glass header + tab bar
- `expo-haptics` — press feedback
- `expo-linear-gradient` — banner shimmer sweep
No custom native modules.

## Design Tokens (replace `src/theme.ts` contents)
Colors:
- `primary: #0891B2` (teal) · `primaryDark: #0F766E`
- `bg: #F0FDFA` · `card: #FFFFFF`
- `text: #134E4A` · `muted: #64748B` · `iconIdle: #8CA3A0` · `heartIdle: #9CB5B2`
- `banner: #134E4A` · `bannerAccent: #5EEAD4` · `bannerSub: #99F6E4`
- `tagGreenBg: #DCFCE7` / `tagGreenText: #16A34A`
- `tagTealBg: #CCFBF1` / `tagTealText: #0F766E`
- `tabPill: #CCFBF1` · `danger: #DC2626`
- shadow color base: `rgba(19,78,74,x)`; button glow: `rgba(8,145,178,0.28)`
Typography (Figtree everywhere, replaces Poppins):
- Large title 32/700, letter-spacing −0.6
- Small (collapsed) title 16/700
- Card title 16/700 · body/address 13/400 · chip & button 13/700 · tag 11/700 · tab label 10/600 (700 active)
Radii: card 16 · button 12 · search 14 · chip/tab-bar/toast 999
Shadows (RN: use `shadowColor #134E4A`, opacity ~0.08, radius 4, offset (0,2), elevation 2 for cards).
Spacing: screen H-padding 16 · card padding 16 · gap between cards 12 · chip padding 7×18.

## Screens
### 1. Clinics (`app/(tabs)/index.tsx`) — fully specified by prototype 3a
- Collapsing header: large title “Clinics” + subtitle “{city} · {count} clinics near you” scrolls away; past ~44px scroll, a 92px glass bar (BlurView, `rgba(240,253,250,0.86)` tint, hairline `rgba(19,78,74,0.08)`) fades in with centered small title. Status bar must stay readable (header below it).
- Search field: white card, radius 14, MagnifyingGlass icon, placeholder text muted.
- Radius chips 10/25/50 mi: pill; active = teal bg, white text, glow shadow, spring scale 1.05; inactive = white bg, `#0F766E` text.
- Prescription savings banner: dark `#134E4A` card radius 14, `Pill` (fill) icon `#5EEAD4`, title white 14/700 “Save up to 80% on prescriptions”, sub `#99F6E4` 12 “Free card · no insurance needed”, CaretRight. A subtle white gradient sweep (~16% opacity) loops across every 3.6s.
- Clinic card: white, radius 16; heart save button 38×38 circle `#F0FDFA` top-right; name 16/700 `#134E4A` (padding-right 44); MapPin 13 teal + address 13 muted + distance 13/700 teal on one row; tag pills; two buttons row: **Call** (teal bg, white text, Phone fill icon, glow) + **Directions** (bg `#F0FDFA`, text `#0F766E`, NavigationArrow icon).
- Keep FlatList virtualization; bottom content inset ~140 so list clears the floating tab bar.

### 2. Tab bar (`app/(tabs)/_layout.tsx`) — custom `tabBar`
Floating pill: absolute, left/right 16, bottom ~26, height 58, radius 999, BlurView (`rgba(255,255,255,0.78)` tint), inner 1px white stroke, soft shadow. Sliding indicator pill `#CCFBF1` (width = bar/4, height 50) springs to active tab (spring ~ mass 1, damping 14, stiffness 180). Icons 23px Phosphor: FirstAidKit / MapTrifold / Lifebuoy / UserCircle — `fill` + `#0891B2` when active, `regular` + `#8CA3A0` idle. Labels keep i18n strings.

### 3. Map / Help / Profile screens
Prototype covers Clinics only. Apply the same system: bg `#F0FDFA`, white cards radius 16 with the card shadow, Figtree, teal accents, Phosphor icons (replace all Ionicons app-wide), same press-spring feedback. Profile: keep existing structure (avatar circle → teal `#0891B2`; icon tiles → use `#CCFBF1`/`#DCFCE7`/`#F0FDFA` tints with teal/green icons; Sign out stays red outline pill). Help: cards + pills in the same vocabulary. Map: keep map, restyle overlays/callouts to white radius-16 cards + teal buttons.

## Interactions & Behavior (all springs: `withSpring`, feel of cubic-bezier(0.34,1.56,0.64,1), ~200–380ms)
- **Every pressable**: scale spring on press-in (buttons 0.94, cards 0.98, tabs 0.88, heart 0.85) + `Haptics.impactAsync(Light)`.
- **Heart save**: toggles fill heart `#0891B2` with pop (scale 0.3→1.35→0.9→1, ~450ms) + expanding ring (2px teal border circle, scale 0.4→2, fade out, 600ms) + `Haptics.notificationAsync(Success)`. Persist saved ids (existing storage).
- **Call / Directions**: existing `Linking` behavior stays; additionally show **toast**: dark pill `rgba(19,78,74,0.94)`, white 13/600 text, teal icon, slides up from +14px with spring above tab bar, auto-hides after 1.9s. Texts: “Calling {name}…” / “Opening directions…”.
- **Chips**: spring recolor/scale; list refilters as today.
- **Scrolling**: smooth/momentum (native), `Animated.ScrollView`/FlatList `onScroll` drives header collapse; `contentInsetAdjustmentBehavior` off; overscroll natural.
- **Tab switch**: indicator pill springs; icon crossfades regular→fill.

## State Management
Local UI state only: `savedIds` (persist as today), `radius`, `toast {visible, text, icon}`, scroll offset (Reanimated shared value), active tab from router. No data-layer changes.

## Assets
No raster assets. Icons: phosphor-react-native. Font: Figtree via @expo-google-fonts/figtree. Everything else is code-drawn.

## Files
- `Wellcott - дизайн приложения.dc.html` (repo root) — HTML prototype for visual reference only. It may not open standalone; **this spec is self-sufficient — implement from the spec alone.**

## Definition of Done
- App runs in Expo Go with no red screens; all 4 tabs restyled, zero Ionicons/Poppins remaining.
- Clinics screen matches 3a side-by-side (colors, spacing, type, shadows).
- All listed micro-interactions + haptics work on device.
- EN/ES strings, navigation, data logic untouched.
