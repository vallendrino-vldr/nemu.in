# Layouts

## AppShell — `src/components/app-shell.tsx`

The whole signed-in experience. Deliberately **not** a scrolling document:

- shell is exactly one viewport tall (`100dvh`, which accounts for mobile browser chrome that `100vh` does not)
- only the content column scrolls, with `overscroll-contain`
- tab bar sits inside `env(safe-area-inset-bottom)`, clear of the iOS home indicator and Android gesture bar
- tabs swap a client component — nothing navigates, so switching is a repaint, not a request

```tsx
type TabKey = 'hunt' | 'leads' | 'map' | 'profile' | 'god'

export function AppShell({ profile, initialLeads }: AppShellProps) {
  const [tab, setTab] = React.useState<TabKey>('hunt')
  const isAdmin = profile.role === 'super_admin'

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-canvas">
      <header
        className="flex shrink-0 items-center gap-3 border-b border-hairline/60 bg-canvas/85 px-4 backdrop-blur-xl"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="flex h-14 flex-1 items-center gap-2.5">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-chip bg-gradient-to-b from-ember-400 to-ember-600 shadow-ember-relief">
            <span className="font-display text-sm leading-none text-white">N</span>
          </span>
          <span className="truncate font-display text-lg leading-none tracking-tight text-ink">
            Nemu<span className="text-ember-500">.in</span>
          </span>
        </div>
        <SafeWidget label="credit-meter">
          <CreditMeter userId={profile.id} initialBalance={profile.credits} role={profile.role} />
        </SafeWidget>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={tab}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="px-4 pb-6 pt-4">
            {/* HuntView | LeadsView | MapView | ProfileView | GodView */}
          </motion.div>
        </AnimatePresence>
      </main>

      <nav className="shrink-0 border-t border-hairline/60 bg-canvas/90 backdrop-blur-xl"
           style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="flex h-16 items-stretch">
          {/* per tab: 44px min target, layoutId="tab-indicator" ember rule on top,
              lucide icon (strokeWidth 2.5 when active), 10px label, badge pill for lead count */}
        </div>
      </nav>
    </div>
  )
}
```

Icons: `Radar` (Berburu) · `Archive` (Arsip) · `MapIcon` (Peta) · `ShieldHalf` (God, admin only) · `User` (Akun). All lucide-react. **No emoji as icons** — the single exception is the deliberate 👻 on the Ghost Site button.

## Root layout — `src/app/[locale]/layout.tsx`

Loads the three fonts as CSS variables, mounts `next-themes` provider (class strategy, dark default), `NextIntlClientProvider`, `sonner` toaster, PWA manager. Applies `bg-canvas` and the full-viewport grain overlay via `body::before`.

## SiteHeader — `src/components/site-header.tsx`

Marketing header on the public landing page only. The signed-in app never renders it.
