"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

export function OAuthCallbackClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("Connecting account · กำลังเชื่อมต่อบัญชี");

  useEffect(() => {
    let active = true;
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
      const { error } = await createSupabaseBrowserClient().auth.exchangeCodeForSession(code);
      if (error) {
        router.replace(`/${locale}/login?error=oauth`);
        return;
      }
      if (active) {
        setMessage("Account connected · เชื่อมต่อบัญชีแล้ว");
        router.replace(`/${locale}/auth/complete?provider=google&next=${encodeURIComponent(next)}`);
      }
    }
    void completeOAuth().catch(() => {
      const next = safeNextPath(searchParams.get("next"));
      router.replace(`/${localeForPath(next)}/login?error=oauth`);
    });
    return () => { active = false; };
  }, [router, searchParams]);

  return <div className="app-frame"><div className="empty-card"><div><p>{message}</p></div></div></div>;
}

function safeNextPath(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/th/app";
}

function localeForPath(path: string) {
  return path.startsWith("/en/") || path === "/en" ? "en" : "th";
}
