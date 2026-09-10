"use client";

import { useEffect } from "react";
import type { Locale } from "@/lib/i18n";
import { NotificationProvider } from "@/components/layout/NotificationProvider";

export function LocaleDocument({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  useEffect(() => {
    document.documentElement.lang = locale;

    function handleGlobalError(event: ErrorEvent) {
      if (
        event.message?.includes("startTime") ||
        event.message?.includes("reportAllChanges")
      ) {
        event.preventDefault();
        event.stopImmediatePropagation?.();
      }
    }

    window.addEventListener("error", handleGlobalError, true);
    return () => window.removeEventListener("error", handleGlobalError, true);
  }, [locale]);

  return <NotificationProvider><div data-locale={locale}>{children}</div></NotificationProvider>;
}
