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

  const { data: exchangeData, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(loginUrl);

  const user = exchangeData.session?.user;
  if (user) {
    const meta = user.user_metadata || {};
    const googleAvatar = (meta.avatar_url || meta.picture) as string | undefined;
    const googleName = (meta.full_name || meta.name) as string | undefined;
    const passwordCompleted = Boolean(meta.parkspace_google_password_setup_completed_at);

    // Sync google avatar & full_name into profiles
    try {
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("avatar_path, full_name")
        .eq("id", user.id)
        .maybeSingle();

      const updates: { avatar_path?: string; full_name?: string } = {};
      if (googleAvatar && (!existingProfile?.avatar_path || existingProfile.avatar_path.startsWith("http"))) {
        updates.avatar_path = googleAvatar;
      }
      if (googleName && !existingProfile?.full_name) {
        updates.full_name = googleName;
      }
      if (Object.keys(updates).length > 0) {
        await supabase.from("profiles").update(updates).eq("id", user.id);
      }
    } catch {
      // Safe fallback
    }

    // If password setup already completed, skip the complete page entirely!
    if (passwordCompleted) {
      return NextResponse.redirect(new URL(next, requestUrl.origin));
    }
  }

  return response;
}

function safeNextPath(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/th/app";
}

function localeForPath(path: string) {
  return path.startsWith("/en/") || path === "/en" ? "en" : "th";
}
