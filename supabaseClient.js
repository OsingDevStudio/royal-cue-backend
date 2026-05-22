import { createClient } from "@supabase/supabase-js";

// Gunakan environment variables (lebih aman)
const SUPABASE_URL = process.env.SUPABASE_URL || "https://conhiaojhyalflkccsen.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);