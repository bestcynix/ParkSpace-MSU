"use client";

import type { MouseEvent, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

export function AuthAwareLink({ locale, target, className, ariaLabel, children }: { locale: "th" | "en"; target: string; className?: string; ariaLabel?: string; children: ReactNode }) {
  const router = useRouter();
  const loginHref = `/${locale}/login?next=${encodeURIComponent(target)}`;

  async function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (!isSupabaseConfigured()) {
      router.push(loginHref);
      return;
    }
    try {
      const { data } = await createSupabaseBrowserClient().auth.getUser();
      router.push(data.user ? target : loginHref);
    } catch {
      router.push(loginHref);
    }
  }

  return <a className={className} href={loginHref} aria-label={ariaLabel} onClick={(event) => void handleClick(event)}>{children}</a>;
}
