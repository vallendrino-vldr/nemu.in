'use client'

import * as React from 'react'

/**
 * A blast door around decorative components.
 *
 * WHY THIS EXISTS
 * ───────────────
 * The landing page crashed to the global error screen on Brave. Nothing
 * was wrong on the server — the logs were clean — because the failure was
 * the 3D globe: Brave's fingerprinting protection can refuse a WebGL
 * context, cobe throws, and React unwinds to the nearest boundary. With
 * no nearer boundary than the route's own error.tsx, one piece of
 * ornament took down the entire page.
 *
 * Anything purely visual belongs inside this. A globe that fails should
 * cost the user a globe, never the product.
 */
interface SafeWidgetProps {
  children: React.ReactNode
  /** Rendered instead when the child throws. Keep it cheap and static. */
  fallback?: React.ReactNode
  /** Shown in the console so a real failure is still diagnosable. */
  label?: string
}

interface SafeWidgetState {
  failed: boolean
}

export class SafeWidget extends React.Component<SafeWidgetProps, SafeWidgetState> {
  state: SafeWidgetState = { failed: false }

  static getDerivedStateFromError(): SafeWidgetState {
    return { failed: true }
  }

  componentDidCatch(error: Error) {
    console.warn(`[safe-widget] ${this.props.label ?? 'widget'} failed:`, error.message)
  }

  render() {
    if (this.state.failed) return this.props.fallback ?? null
    return this.props.children
  }
}
