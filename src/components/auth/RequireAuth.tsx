"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Locale } from "@/lib/i18n";
import { getCopy } from "@/lib/i18n";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

export function RequireAuth({ locale, target, children }: { locale: Locale; target: string; children: ReactNode }) {
  const t = getCopy(locale);
  const [allowed, setAllowed] = useState(false);
  const loginHref = `/${locale}/login?next=${encodeURIComponent(target)}`;

  useEffect(() => {
    let active = true;
    async function checkSession() {
      if (!isSupabaseConfigured()) {
        window.location.replace(loginHref);
        return;
      }
      try {
        const { data } = await createSupabaseBrowserClient().auth.getUser();
        if (active && data.user) setAllowed(true);
        if (active && !data.user) window.location.replace(loginHref);
      } catch {
        window.location.replace(loginHref);
      }
    }
    void checkSession();
    return () => { active = false; };
  }, [loginHref]);

  if (!allowed) return <div className="empty-card auth-gate" role="status"><div><h2>{t.signInRequired}</h2><p>{isSupabaseConfigured() ? t.loginHint : `${t.accountNotConfigured} / ${t.accountNotConfiguredEn}`}</p><Link className="primary-button" href={loginHref}>{t.login}</Link></div></div>;
  return <>{children}</>;
}
