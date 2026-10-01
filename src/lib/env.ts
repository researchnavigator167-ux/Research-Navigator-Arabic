const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error(
    'VITE_SUPABASE_URL is missing. Ensure .env exists with VITE_SUPABASE_URL set before building.'
  );
}
if (!supabaseAnonKey) {
  throw new Error(
    'VITE_SUPABASE_ANON_KEY is missing. Ensure .env exists with VITE_SUPABASE_ANON_KEY set before building.'
  );
}

export { supabaseUrl, supabaseAnonKey };
