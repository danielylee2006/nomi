import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { env } from "@/lib/env";

type CookieEntry = {
  name: string;
  value: string;
  options?: Record<string, unknown>;
};

export async function createSupabaseServerClient() {
  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    return null;
  }

  const cookieStore = await cookies();

  return createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookieEntries: CookieEntry[]) {
        cookieEntries.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options);
        });
      },
    },
  });
}
