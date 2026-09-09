"use client";

import type { MouseEvent, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { getCopy } from "@/lib/i18n";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { useNotifications } from "@/components/layout/NotificationProvider";

export function AuthAwareLink({ locale, target, className, ariaLabel, children }: { locale: "th" | "en"; target: string; className?: string; ariaLabel?: string; children: ReactNode }) {
  const router = useRouter();
  const t = getCopy(locale);
  const { notify } = useNotifications();
  const loginHref = `/${locale}/login?next=${encodeURIComponent(target)}`;

  async function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (!isSupabaseConfigured()) {
      notify({ title: t.setupRequired, message: `${t.accountNotConfigured} / ${t.accountNotConfiguredEn}`, kind: "warning" });
      router.push(loginHref);
      return;
    }
    try {
      const { data } = await createSupabaseBrowserClient().auth.getSession();
      if (data.session) router.push(target);
      else {
        notify({ title: t.signInRequired, message: t.loginHint, kind: "info" });
        router.push(loginHref);
      }
    } catch {
      notify({ title: t.signInRequired, kind: "warning" });
      router.push(loginHref);
    }
  }

  return <a className={className} href={loginHref} aria-label={ariaLabel} onClick={(event) => void handleClick(event)}>{children}</a>;
}
