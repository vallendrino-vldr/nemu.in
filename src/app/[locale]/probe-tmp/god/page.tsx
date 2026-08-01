// TEMPORARY DIAGNOSTIC — delete after use.
import { setRequestLocale } from 'next-intl/server'

import { GodShell } from '@/components/god/god-shell'
import type { ApiKeyView, Profile } from '@/lib/database.types'
import type { GodStats } from '@/actions/admin'

export const dynamic = 'force-dynamic'

const me: Profile = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'vadlyvldr@gmail.com',
  full_name: 'Vadly',
  avatar_url: null,
  role: 'super_admin',
  credits: 412,
  lifetime_spent: 88,
  locale: 'id',
  created_at: new Date().toISOString(),
  last_seen_at: new Date().toISOString(),
  banned_at: null,
  ban_reason: null,
  notice: null,
  notice_at: null,
  bill_admin: false,
}

const stats: GodStats = {
  userCount: 128,
  bannedCount: 2,
  newUsersToday: 3,
  activeToday: 41,
  creditsInCirculation: 8420,
  creditsSpentToday: 260,
  leadCount: 3155,
  leadsToday: 91,
  waReadyCount: 612,
  contactedCount: 244,
  aiCallsToday: 47,
  sweepsToday: 12,
  cacheHits: 318,
  cachedQueries: 74,
  placesEnabled: true,
  geminiEnabled: false,
  notice: null,
  aiDailyBudget: 200,
  keysTotal: 3,
  keysActive: 2,
}

const users: Profile[] = [
  me,
  { ...me, id: 'u2', email: 'budi.dev@gmail.com', full_name: 'Budi Ardiansyah', role: 'user', credits: 18, bill_admin: false },
  { ...me, id: 'u3', email: 'sari@studio.id', full_name: 'Sari Wulandari', role: 'user', credits: 0, notice: 'Tolong berhenti spam pencarian yang sama.' },
  { ...me, id: 'u4', email: 'spam@bad.com', full_name: 'Akun Nakal', role: 'user', credits: 5, banned_at: new Date().toISOString(), ban_reason: 'Ternak akun' },
  { ...me, id: 'u5', email: 'rizky@web.co.id', full_name: 'Rizky Pratama', role: 'user', credits: 240 },
]

const keys: ApiKeyView[] = [
  { id: 'k1', provider: 'gemini', label: 'Akun utama', preview: 'AIzaSy••••3f9c', active: true, created_at: new Date().toISOString(), last_used_at: new Date().toISOString(), last_error: null },
  { id: 'k2', provider: 'gemini', label: 'Akun cadangan', preview: 'AIzaSy••••8b21', active: true, created_at: new Date().toISOString(), last_used_at: null, last_error: null },
  { id: 'k3', provider: 'gemini', label: 'Akun lama', preview: 'AIzaSy••••0d44', active: false, created_at: new Date().toISOString(), last_used_at: new Date().toISOString(), last_error: 'Kuota penuh (429)' },
]

export default async function ProbeGodPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  return <GodShell me={me} initialStats={stats} initialUsers={users} initialKeys={keys} />
}
