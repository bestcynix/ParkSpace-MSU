import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = safeNextPath(requestUrl.searchParams.get("next"));
  const locale = localeForPath(next);
  const loginUrl = new URL(`/${locale}/login?error=oauth`, requestUrl.origin);

  if (!code) return NextResponse.redirect(loginUrl);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.redirect(new URL(`/${locale}/login?error=setup`, requestUrl.origin));
  }

  const response = NextResponse.redirect(
    new URL(`/${locale}/auth/complete?provider=google&next=${encodeURIComponent(next)}`, requestUrl.origin),
  );

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(loginUrl);
  return response;
}

function safeNextPath(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/th/app";
}

function localeForPath(path: string) {
  return path.startsWith("/en/") || path === "/en" ? "en" : "th";
}
