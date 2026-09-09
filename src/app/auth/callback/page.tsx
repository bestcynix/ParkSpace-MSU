"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

export default function OAuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("Connecting account · กำลังเชื่อมต่อบัญชี");
  const hasStarted = useRef(false);

  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;

    async function completeOAuth() {
      const next = safeNextPath(searchParams.get("next"));
      const locale = localeForPath(next);
      const code = searchParams.get("code");
      if (!code) {
        router.replace(`/${locale}/login?error=oauth`);
        return;
      }
      if (!isSupabaseConfigured()) {
        router.replace(`/${locale}/login?error=setup`);
        return;
      }

      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        console.error(`[auth] OAuth callback failed: ${error.name}: ${error.message}`);
        router.replace(`/${locale}/login?error=oauth`);
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.error("[auth] OAuth callback completed without a session");
        router.replace(`/${locale}/login?error=oauth`);
        return;
      }

      setMessage("Account connected · เชื่อมต่อบัญชีแล้ว");
      // A full navigation makes the persisted Supabase session available to every
      // statically exported page and avoids a stale soft-navigation auth state.
      window.location.assign(new URL(`/${locale}/auth/complete?provider=google&next=${encodeURIComponent(next)}`, window.location.origin).toString());
    }
    void completeOAuth().catch((error: unknown) => {
      console.error(`[auth] OAuth callback exception: ${error instanceof Error ? `${error.name}: ${error.message}` : "unknown error"}`);
      const next = safeNextPath(searchParams.get("next"));
      router.replace(`/${localeForPath(next)}/login?error=oauth`);
    });
  }, [router, searchParams]);

  return <div className="app-frame"><div className="empty-card"><div><p>{message}</p></div></div><div className="page-wrap"><PublicFooter locale="th" /></div></div>;
}

function safeNextPath(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/th/app";
}

function localeForPath(path: string) {
  return path.startsWith("/en/") || path === "/en" ? "en" : "th";
}
