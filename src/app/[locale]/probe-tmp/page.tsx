// TEMPORARY DIAGNOSTIC — delete after use.
// Renders the signed-in shell with mock data so the authenticated screens
// can be inspected without credentials.
import { setRequestLocale } from 'next-intl/server'

import { AppShell } from '@/components/app-shell'
import type { Lead, Profile } from '@/lib/database.types'

export const dynamic = 'force-dynamic'

const profile: Profile = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'probe@nemu.in',
  full_name: 'Probe User',
  avatar_url: null,
  role: 'super_admin',
  credits: 30,
  lifetime_spent: 12,
  locale: 'id',
  created_at: new Date().toISOString(),
  last_seen_at: new Date().toISOString(),
  banned_at: null,
  ban_reason: null,
  notice: null,
  notice_at: null,
  bill_admin: false,
}

const leads: Lead[] = Array.from({ length: 6 }, (_, i) => ({
  id: `lead-${i}`,
  user_id: profile.id,
  place_id: `place-${i}`,
  name: ['Kopi Kenangan Senja', 'Bengkel Jaya Motor', 'Klinik Gigi Sehat', 'Laundry Kilat', 'Barbershop Gagah', 'Katering Bu Sri'][i]!,
  category: ['Kedai kopi', 'Bengkel motor', 'Klinik gigi', 'Laundry', 'Barbershop', 'Katering'][i]!,
  address: 'Jl. Kaliurang KM 5, Sleman, DIY',
  area: 'Sleman',
  phone: '0812-3456-7890',
  phone_e164: i % 3 === 0 ? '6281234567890' : null,
  phone_dial: i % 3 === 1 ? '62274123456' : null,
  website: null,
  rating: 4.3,
  review_count: 128,
  lat: -7.75,
  lng: 110.37,
  maps_uri: 'https://maps.google.com',
  ai_score: i % 2 === 0 ? 78 : null,
  ai_verdict: i % 2 === 0 ? 'Rating bagus tapi nggak punya website — calon kuat.' : null,
  ai_angle: null,
  pitch: i === 0 ? 'Halo Kopi Kenangan Senja, saya lihat ratingnya 4.3 dari 128 ulasan…' : null,
  pitch_tone: i === 0 ? 'warm' : null,
  contact_tier: (['whatsapp', 'phone', 'visit'] as const)[i % 3]!,
  status: i === 0 ? 'contacted' : 'new',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}))

export default async function ProbePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  return <AppShell profile={profile} initialLeads={leads} />
}
