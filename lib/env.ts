export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
};

export function hasSupabaseEnv() {
  return Boolean(env.supabaseUrl && env.supabaseAnonKey);
}
