'use client'

import * as React from 'react'
import { ThemeProvider } from 'next-themes'
import { Toaster } from 'sonner'
import { CreditBurstLayer } from '@/components/credit-burst-layer'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      storageKey="nemu-theme"
    >
      {children}
      <CreditBurstLayer />
      <Toaster
        position="top-center"
        offset={16}
        gap={10}
        toastOptions={{
          unstyled: true,
          classNames: {
            toast:
              'flex w-full items-start gap-3 rounded-well bg-surface-raised/85 p-4 shadow-floating backdrop-blur-xl backdrop-saturate-150 border border-white/10',
            title: 'text-sm font-semibold text-ink',
            description: 'mt-0.5 text-[0.8125rem] leading-relaxed text-ink-soft',
            actionButton:
              'ml-auto shrink-0 rounded-chip bg-ember-500 px-3 py-1.5 text-xs font-semibold text-white',
            icon: 'shrink-0',
          },
        }}
      />
    </ThemeProvider>
  )
}
