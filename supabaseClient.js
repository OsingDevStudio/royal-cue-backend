import { createClient } from "@supabase/supabase-js";

// Gunakan environment variables (lebih aman)
const SUPABASE_URL = process.env.SUPABASE_URL || "https://conhiaojhyalflkccsen.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvbmhpYW9qaHlhbGZsa2Njc2VuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxNTg4NDksImV4cCI6MjA5NDczNDg0OX0.vTVJEuAR8Fq75lIPoTpTc_WoOmpyXs5lNB4O_vwogL8";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);