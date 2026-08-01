# Page dependency trees

## `/dashboard` — the app (PRIMARY DESIGN TARGET)

Entry: `src/app/[locale]/dashboard/page.tsx`

```
src/app/[locale]/dashboard/page.tsx
- src/components/app-shell.tsx                      ← layout, tab bar, header
  - src/components/credit-meter.tsx                 ← live balance pill
    - src/store/credit-store.ts
    - src/lib/supabase/client.ts
  - src/components/safe-widget.tsx                  ← error blast door
  - src/components/views/hunt-view.tsx              ← DEFAULT TAB, the weak one
    - src/components/ui/button.tsx
    - src/components/ui/primitives.tsx              ← Panel, Field, Badge
    - src/components/sonar-radar.tsx                ← full-panel scanning animation
    - src/hooks/use-paid-action.ts
    - src/store/lead-store.ts
    - src/actions/hunt.ts
    - src/lib/pricing.ts                            ← CREDIT_COST, RADIUS_LADDER
  - src/components/views/leads-view.tsx
    - src/components/lead-card.tsx                  ← the real product unit
      - src/components/ui/sheet.tsx
      - src/components/ghost-site.tsx
      - src/actions/enrich.ts
    - src/store/lead-store.ts                       ← sellableOf / visibleOf
  - src/components/views/map-view.tsx               ← mapbox-gl, tinted at runtime
  - src/components/views/profile-view.tsx
    - src/components/theme-toggle.tsx
    - src/components/locale-switch.tsx
  - src/components/views/god-view.tsx
    - src/components/god-console.tsx
    - src/actions/admin.ts
- src/lib/supabase/server.ts
- src/lib/database.types.ts
```

### Minimal context set for redesigning the Hunt screen

`hunt-view.tsx`, `button.tsx`, `primitives.tsx`, `app-shell.tsx`, `theme.md`, `tailwind.config.ts`.

### Minimal context set for redesigning the lead card

`lead-card.tsx`, `primitives.tsx`, `button.tsx`, `theme.md`.

## `/god` — admin console (NEW, being built)

Entry: `src/app/[locale]/god/page.tsx`

```
src/app/[locale]/god/page.tsx
- src/components/god/god-shell.tsx                  ← desk layout, own chrome, back to app
  - src/components/god/god-overview.tsx             ← vitals strip
  - src/components/god/god-users.tsx                ← user table + row actions
  - src/components/god/god-keys.tsx                 ← Gemini key manager
  - src/components/god/god-settings.tsx             ← kill switch, tester billing
- src/actions/admin.ts
```

## `/` — marketing landing

Entry: `src/app/[locale]/page.tsx`

```
src/app/[locale]/page.tsx
- src/components/site-header.tsx
- src/components/auth-panel.tsx
- src/components/globe.tsx                          ← WebGL, wrapped in SafeWidget
- src/components/ghost-site.tsx
- src/components/safe-widget.tsx
```

## Known design problems (owner's own words, verbatim)

> "berantakan, murahan, ga berkelas, ga fresh, ga profesional, terlalu generik, AI SLOP, warnanya ga menarik"

Diagnosis:
1. **Hunt tab is a form, not a screen.** Two stacked labelled inputs, a 4-button radius row, a location button and a submit button, all inside one big grey panel. No hierarchy, no moment, no personality.
2. **No opening.** The app's first screen after sign-in asks the user to fill something in, instead of telling them what they already have (how many WhatsApp-ready leads are waiting, how many are untouched today).
3. **Dark mode is flat.** canvas `6%` → surface `9%` → raised `13%` are too close together; every panel reads as the same plane.
4. **Single accent.** Ember carries CTA, warning, badge, logo and glow all at once. Nothing has a second voice.
5. **Lead card looks like a panel**, not like the product's hero object.
