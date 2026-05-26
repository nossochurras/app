import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://slnjcoapvlosorqiftxa.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsbmpjb2Fwdmxvc29ycWlmdHhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzOTMzNzYsImV4cCI6MjA5NDk2OTM3Nn0.HIPXGmjWEwkzfJdIGSi2DB_RcgnWBPkEHGodHd-OeAY'

export const supabase = createClient(https://slnjcoapvlosorqiftxa.supabase.co, eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsbmpjb2Fwdmxvc29ycWlmdHhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzOTMzNzYsImV4cCI6MjA5NDk2OTM3Nn0.HIPXGmjWEwkzfJdIGSi2DB_RcgnWBPkEHGodHd-OeAY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce'
  }
})
