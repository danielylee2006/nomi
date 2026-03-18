import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { env } from "@/lib/env";

type CookieEntry = {
  name: string;
  value: string;
  options?: Record<string, unknown>;
};

export async function updateSession(request: NextRequest) {
  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookieEntries: CookieEntry[]) {
        cookieEntries.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookieEntries.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  await supabase.auth.getUser();
  return response;
}
