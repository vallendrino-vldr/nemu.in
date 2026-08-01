# Nemu.in — Design System

## 1. Product context

**Nemu.in** is a client-finding machine for Indonesian freelance web developers. It sweeps map data for small businesses (UMKM) that do **not** have a website, scores them with AI, and writes a WhatsApp opener that names the actual shop.

**Job to be done:** "It's Monday. Give me five businesses I can message *right now* who will plausibly pay me to build a site."

**Who uses it:** a solo freelancer or two-person agency in Indonesia, on a mid-range Android phone, often standing up. Not a desk tool. Dark mode is the default and the majority case.

**Key screens**
| Screen | Job |
|---|---|
| Hunt (default tab) | Start a sweep. Should open with *what you already have*, not an empty form. |
| Archive | Work the list — score, write the pitch, open WhatsApp |
| Map | See the sweep spatially |
| Account | Balance, prefs, price list |
| **God Mode** (`/god`, admin only) | Separate full-power control room — users, credits, API keys, kill switches |

**Non-negotiable product rules**
1. **Zero cost.** No paid service, ever. If a solution needs a credit card, find another way.
2. **The user presses send**, not the app. Only prefilled `wa.me` links — that is what keeps their WhatsApp number un-banned.
3. **Anti "AI slop."** *No image files ship with this app.* Texture, sheen and glow are all CSS. AI prompts explicitly ban openers like "Perkenalkan", "solusi terbaik", "di era digital ini".

## 2. What is wrong today (the brief)

Owner's verbatim verdict on the current dashboard: *"berantakan, murahan, ga berkelas, ga fresh, ga profesional, terlalu generik, AI SLOP, warnanya ga menarik"* — and he will not publish it.

That verdict is legitimate. Root causes:

1. **The Hunt tab is a form, not a screen.** Two labelled inputs stacked on a 4-button radius row inside one big grey panel. No hierarchy, no moment, no personality.
2. **No opening.** The first screen after sign-in asks you to fill something in instead of telling you what you already own.
3. **Dark mode is flat.** `canvas 6% → surface 9% → raised 13%` are too close; every panel reads as the same plane.
4. **One accent doing five jobs.** Ember is CTA *and* warning *and* badge *and* logo *and* glow. Nothing has a second voice.
5. **The lead card looks like a panel** instead of the product's hero object.

## 3. Visual direction — "Warm machine, cold room"

The room is cold and deep (obsidian, layered, ambient). The machine in it is warm (ember, brushed, physically pressable). Reference register: pro trading terminal / dev tool, not a SaaS marketing page.

Concretely:
- **Depth via layered surfaces + ambient light**, not via more borders. Two slow-drifting radial light blobs (ember and indigo) sit behind hero content at very low alpha. Everything else stacks on top with the existing named-elevation shadows.
- **Numbers are the hero.** Mono, tabular, big, animated on change. A screen that opens with `12` in 56px type is a status report; a screen that opens with two input labels is homework.
- **Skeuomorphic press stays.** Relief → pressed shadow swap + 1.5px translate + sheen fade. This is the app's signature and is not up for redesign.
- **Never pure black** (`#000` smears on OLED). Darkest surface bottoms out around 4–5% lightness with warmth left in it.

## 4. Colour

### Roles — every colour has exactly ONE job

| Role | Ramp | Used for |
|---|---|---|
| **Action / money** | `ember` (26 92% 51%) | Primary CTA, brand mark, credit meter, spend |
| **Intelligence** | `nila` (252 74% 60%) | **Second accent.** Anything the AI produced or is about to: score dial ring at high confidence, AI verdict rule, deep audit, admin console chrome |
| **Confirmed value** | `pandan` (158 64% 38%) | WhatsApp-ready, contacted, free, live switches, positive delta |
| **Destructive / empty** | `sambal` (3 78% 53%) | Delete, banned, out of credit, cut switches |

Ember and nila are the two voices. Pandan and sambal are **status only** — never chrome, never a CTA fill.

### Dark-mode surface ladder (WIDENED — this is the fix for §2.3)

| Token | Before | After | Why |
|---|---|---|---|
| `--canvas` | `24 14% 6%` | `24 16% 5%` | Room floor, a touch deeper and warmer |
| `--surface-sunken` | `24 16% 4%` | `24 18% 3.5%` | Carved-in wells read as genuinely below |
| `--surface` | `24 12% 9%` | `24 13% 9%` | unchanged in effect |
| `--surface-raised` | `26 11% 13%` | `26 12% 15%` | Cards lift clearly off the canvas |
| `--surface-float` | *(new)* | `28 12% 19%` | Sheets, popovers, the layer above cards |

Five distinct planes instead of three that all look alike.

### Light mode

Warm paper (`38 32% 95%` canvas, white raised). Unchanged — it already works. Light is the exception case; design decisions are made dark-first and checked light-second.

### Contrast — measured, not eyeballed

Every text token clears **4.5:1 against the worst surface in its theme**, verified with a contrast solver rather than by looking at it. The first pass failed badly and it was invisible until measured:

| Pair | Was | Now |
|---|---|---|
| `ink-faint` on a sunken well (light) | 2.67 ✗ | 4.5+ ✓ |
| `nila-500` as text on a raised card (dark) | 2.75 ✗ | 4.6 ✓ |
| `ember-500` as text on white | 2.87 ✗ | 4.53 ✓ |
| `ink-faint` on `surface-float` (dark) | 2.99 ✗ | 4.6 ✓ |

That "washed out, cheap" feeling in the first draft was largely this: labels sitting at 2.7:1.

**The rule that follows from it — two families, two jobs:**

- `ember` / `nila` / `pandan` / `sambal` ramps are for **fills, gradients, glows and tints**. Contrast rules there are about shape, not legibility.
- `ink-ember` / `ink-nila` / `ink-pandan` / `ink-sambal` are for **anything carrying words or a meaningful glyph**. They swap value per theme so the ratio holds in both.

Use `text-ink-nila`, never `text-nila-500`. Use `bg-nila-500/14`, never `bg-ink-nila/14`.

Ink ladder (all three steps clear 4.5:1 everywhere, with visible separation):

| Token | Light | Dark |
|---|---|---|
| `--ink` | `24 18% 11%` | `36 34% 95%` |
| `--ink-soft` | `24 9% 30%` | `32 10% 76%` |
| `--ink-faint` | `26 8% 41%` | `30 7% 60%` |

Status is never conveyed by colour alone — every tier badge carries an icon and a word.

## 5. Typography

| Family | Var | Job |
|---|---|---|
| Plus Jakarta Sans | `--font-jakarta` | All UI text. Body 16px min, line-height 1.5 |
| Instrument Serif | `--font-instrument` | Headings only. This is where the "class" lives — a serif display over a technical sans is the whole personality |
| JetBrains Mono | `--font-mono` | **Every number, always**, with `.tabular` so counters don't reflow |

Scale: `display-xl` `clamp(3rem,8vw,5.75rem)` · `display-lg` `clamp(2.25rem,5.5vw,3.75rem)` · `display-md` `clamp(1.75rem,3.5vw,2.5rem)` · `overline` 11px/0.18em uppercase.

Never introduce a fourth family. Never render a number in the sans face.

## 6. Layout & spacing

Dense/dashboard scale — this is a working tool, not a landing page:

`--space-1 4px` · `--space-2 8px` · `--space-3 12px` · `--space-4 16px` · `--space-6 24px` · `--space-8 32px`

- Shell is exactly `100dvh`. Only the content column scrolls. Tab bar inside `env(safe-area-inset-bottom)`.
- Touch targets **44×44px minimum**, 8px apart.
- Radii: `pill 999px` · `card 1.375rem` · `well 1rem` · `chip 0.75rem`. Nothing is a 4px rectangle.
- Breakpoints: 375 / 768 / 1024 / 1440. Mobile-first. No horizontal page scroll — wide content scrolls inside its own container.

## 7. Elevation

Named physical states, never t-shirt sizes: `relief` (catches light on top) · `pressed` (pushed in) · `well` (carved out) · `floating` (modal) · `ember-relief` / `ember-pressed` / `ember-glow` (lit from within). One authored multi-layer string per state; components never stack ad-hoc shadows.

The highlight/shadow ratio inverts between themes: light is lit from directly above; dark has no ambient light, so highlights drop to a whisper and shadows do the lifting.

## 8. Motion

- **Easing:** `ease-settle` `cubic-bezier(0.16,1,0.3,1)` (expo-out) for everything; `ease-physical` `cubic-bezier(0.34,1.4,0.5,1)` for objects that should overshoot and settle.
- **Durations:** 150–300ms for state, 300–450ms for entrance. Exit faster than enter.
- **Stagger:** list items 40–60ms apart, capped so item 30 doesn't wait a second.
- **Meaningful only.** Motion shows where a thing came from or that a number changed. No decorative loops except the two ambient light blobs and the credit meter's breathe.
- `prefers-reduced-motion` is globally honoured and must stay that way.
- Never animate `width`/`height` — transform and opacity only.

## 9. Iconography

**lucide-react, always.** No emoji as icons — the single deliberate exception is 👻 on the Ghost Site button, which is a product joke, not an icon. Stroke width 2 at rest, 2.4–2.6 when active or small. Icon-only buttons must carry an `aria-label`.

## 10. Signature patterns

**Spotlight sweep.** One search field, not three stacked ones. Natural-language input ("kedai kopi di Jogja") with a live-parsed chip showing what will actually be searched, plus tappable suggestion chips for cold starts. Radius and location are *secondary* controls revealed under the field, not peers of it.

**Status opening.** The Hunt screen opens with what you already have — WhatsApp-ready count, untouched-today count — in big mono numerals over the ambient bloom. The search sits under that. The user sees an asset before they see a task.

**The lead card is the hero object.** Score dial, business identity, tier badges, AI verdict, sunken action rail, expandable pitch. It should look like the most expensive thing on screen.

**Cost is always visible.** Every paid button carries its credit price in a mono pill. A price is never displayed as one number and billed as another — both read from `src/lib/pricing.ts`.

**God Mode is a different room.** The admin console must not look like the user app with extra buttons. Nila-led chrome, denser grid, monospace-heavy, an unmistakable "you are in the control room" feel — and one obvious way back out.

## 11. Hard constraints for any generated design

1. Use ONLY the fonts, colours, spacing and component styles defined above. Do not introduce any font, colour, or visual style not in this system.
2. Fonts are exactly: Instrument Serif (display), Plus Jakarta Sans (UI), JetBrains Mono (numbers). No serif body text, no decorative faces.
3. Accents are exactly ember (26 92% 51%) and nila (252 74% 60%); pandan and sambal are status-only. **No pink, no neon, no purple gradient washes, no teal.**
4. No image assets, no stock photography, no illustrations. Texture is CSS only.
5. No emoji as icons (except the one 👻).
6. Keep the skeuomorphic press physics and the named elevation states.
7. Dark-first. Every screen must also be legible in light mode.
