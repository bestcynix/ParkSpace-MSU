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

  // Create redirect response directly to target destination
  const targetUrl = new URL(next, requestUrl.origin);
  const response = NextResponse.redirect(targetUrl);

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
  if (error) {
    console.error("OAuth exchangeCodeForSession error:", error);
    return NextResponse.redirect(loginUrl);
  }

  const user = exchangeData.session?.user;
  if (user) {
    const userEmail = (user.email || "").toLowerCase();
    const meta = user.user_metadata || {};
    const googleAvatar = (meta.avatar_url || meta.picture) as string | undefined;
    const googleName = (meta.full_name || meta.name) as string | undefined;

    // Check if user is Super Admin or Admin and adjust default destination if landing on /app
    if (next === `/${locale}/app` || next === "/th/app" || next === "/en/app") {
      if (userEmail === "68011211206@msu.ac.th" || userEmail === "69010518004@msu.ac.th") {
        response.headers.set("Location", new URL(`/${locale}/admin/dashboard`, requestUrl.origin).toString());
      } else if (userEmail === "staff@msu.ac.th") {
        response.headers.set("Location", new URL(`/${locale}/staff/dashboard`, requestUrl.origin).toString());
      }
    }

    // Mark password setup completed in metadata
    try {
      if (!meta.parkspace_google_password_setup_completed_at) {
        await supabase.auth.updateUser({
          data: {
            ...meta,
            parkspace_google_password_setup_completed_at: new Date().toISOString(),
          },
        });
      }
    } catch {
      // Safe fallback
    }

    // Sync google avatar & full_name into profiles
    try {
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("avatar_path, full_name, user_type")
        .eq("id", user.id)
        .maybeSingle();

      const updates: { avatar_path?: string; full_name?: string; user_type?: string } = {};
      if (googleAvatar && (!existingProfile?.avatar_path || existingProfile.avatar_path.startsWith("http"))) {
        updates.avatar_path = googleAvatar;
      }
      if (googleName && !existingProfile?.full_name) {
        updates.full_name = googleName;
      }

      // Ensure Super Admin has admin user_type
      if (userEmail === "68011211206@msu.ac.th" && existingProfile?.user_type !== "admin") {
        updates.user_type = "admin";
      }

      if (Object.keys(updates).length > 0) {
        await supabase.from("profiles").update(updates).eq("id", user.id);
      }

      // Ensure Super Admin role in user_roles
      if (userEmail === "68011211206@msu.ac.th") {
        const { data: roleRow } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .maybeSingle();
        if (!roleRow || roleRow.role !== "admin") {
          await supabase.from("user_roles").upsert({
            user_id: user.id,
            role: "admin",
          });
        }
      }
    } catch {
      // Safe fallback
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
