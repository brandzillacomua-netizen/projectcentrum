import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true
  }
})

// Auto-authenticate as system worker to bypass RLS policies safely
supabaseAdmin.auth.signInWithPassword({
  email: process.env.AUDIT_EMAIL || 'alexinj@centrum.local',
  password: process.env.AUDIT_PASSWORD || '9eFAZQ6yaDjA-kwRp7dKkg!A9z'
}).catch(err => console.warn('[SupabaseAdmin] Auth init warning:', err.message))
