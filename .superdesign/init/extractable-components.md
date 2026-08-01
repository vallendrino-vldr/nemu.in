# Extractable components

## Layout Components

### AppShell
- Source: `src/components/app-shell.tsx`
- Category: layout
- Description: Full-viewport signed-in shell — fixed header with brand + credit meter, one scrolling column, bottom tab bar inside the safe area
- Extractable props: `activeTab` (string, default `"hunt"`), `leadCount` (number, default `0`), `isAdmin` (boolean, default `false`), `credits` (number|"∞")
- Hardcoded: lucide icon set, tab labels, ember logo tile, `100dvh` structure, safe-area insets

### TabBar
- Source: `src/components/app-shell.tsx` (the `<nav>` block)
- Category: layout
- Description: 5-slot bottom navigation, 44px targets, framer `layoutId` ember indicator rule on the active tab
- Extractable props: `activeTab` (string, default `"hunt"`), `badgeCount` (number, default `0`), `showGodTab` (boolean, default `false`)
- Hardcoded: icons, labels, indicator animation, colours

### GodShell *(new)*
- Source: `src/components/god/god-shell.tsx`
- Category: layout
- Description: Standalone admin console chrome — dense sidebar/section nav, wide content area, an unmistakable "you are in the control room" treatment distinct from the user app
- Extractable props: `activeSection` (string, default `"overview"`), `adminName` (string)
- Hardcoded: section list, icons, colours

## Basic Components

### CreditMeter
- Source: `src/components/credit-meter.tsx`
- Category: basic
- Description: Glassy pill showing live credit balance with a breathing ember glow; `∞` for admins, sambal-red when depleted
- Extractable props: `balance` (number, default `30`), `unlimited` (boolean, default `false`), `depleted` (boolean, default `false`)
- Hardcoded: Zap/Infinity icons, glow gradient, breathe animation

### LeadCard
- Source: `src/components/lead-card.tsx`
- Category: basic
- Description: The product's hero object — score dial, business identity, contact-tier badges, AI verdict, sunken action rail, expandable generated pitch
- Extractable props: `score` (number|null, default `null`), `tier` (string, default `"whatsapp"`), `hasPitch` (boolean, default `false`), `contacted` (boolean, default `false`)
- Hardcoded: lucide icons, badge tones, dial geometry, all CSS

### ScoreDial
- Source: `src/components/lead-card.tsx` (inner `ScoreDial`)
- Category: basic
- Description: 56px SVG ring, colour keyed to score band (≥70 pandan, ≥45 ember, else sambal), animated sweep on mount
- Extractable props: `score` (number|null, default `null`)
- Hardcoded: radius, stroke width, colour bands

### Button
- Source: `src/components/ui/button.tsx`
- Category: basic
- Description: Skeuomorphic press — relief→pressed shadow swap, 1.5px translate, sheen strip fade
- Extractable props: `variant` (string, default `"surface"`), `size` (string, default `"md"`), `loading` (boolean, default `false`)
- Hardcoded: all variant CSS, spinner icon

### Panel
- Source: `src/components/ui/primitives.tsx`
- Category: basic
- Description: Surface container in four tones — raised (catches light), sunken (carved in), flat, glass
- Extractable props: `tone` (string, default `"raised"`), `pad` (string, default `"md"`)
- Hardcoded: shadow strings, radii

### Field
- Source: `src/components/ui/primitives.tsx`
- Category: basic
- Description: Input carved into the surface — sunken by default, ember focus ring stacked on the well shadow
- Extractable props: `placeholder` (string), `disabled` (boolean, default `false`)
- Hardcoded: height, radius, shadow composition

### Badge
- Source: `src/components/ui/primitives.tsx`
- Category: basic
- Description: Pill tag in five semantic tones (neutral / opportunity / warning / danger / ai)
- Extractable props: `tone` (string, default `"neutral"`), `label` (string)
- Hardcoded: tone colour map, radius, type scale

### SonarRadar
- Source: `src/components/sonar-radar.tsx`
- Category: basic
- Description: Full-panel scanning animation shown while a sweep runs — concentric ping rings plus a rotating sweep arm
- Extractable props: `label` (string), `sublabel` (string)
- Hardcoded: animation keyframes, ring geometry
