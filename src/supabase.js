import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://sqwbxmewymvmnegszzte.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNxd2J4bWV3eW12bW5lZ3N6enRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyODMzNzcsImV4cCI6MjA5Mzg1OTM3N30.z_vGOPEqZXTQp9hWaiAjU-7Q1s8vACwfseB4UWIrfgM'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
