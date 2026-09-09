"use client";

import { useEffect } from "react";
import type { Locale } from "@/lib/i18n";
import { NotificationProvider } from "@/components/layout/NotificationProvider";

export function LocaleDocument({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return <NotificationProvider><div data-locale={locale}>{children}</div></NotificationProvider>;
}
