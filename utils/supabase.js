import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// -------------------------------------------------------------
// SUPABASE SETUP GUIDE
// -------------------------------------------------------------
// 1. Create a free account at https://supabase.com
// 2. Click "New Project" and wait for the database to spin up.
// 3. Go to Project Settings -> API
// 4. Copy the "Project URL" and paste it into `supabaseUrl` below.
// 5. Copy the "anon public" key and paste it into `supabaseAnonKey`.
// -------------------------------------------------------------

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
