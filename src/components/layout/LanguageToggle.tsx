"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { otherLocale, type Locale } from "@/lib/i18n";

export function LanguageToggle({ locale }: { locale: Locale }) {
  const pathname = usePathname() ?? `/${locale}`;
  const searchParams = useSearchParams();
  const query = new URLSearchParams(searchParams.toString());
  const localizedQuery = new URLSearchParams(query.toString());
  const next = localizedQuery.get("next");
  if (next) {
    localizedQuery.set("next", next.replace(/^\/(th|en)(?=\/|$)/, `/${otherLocale(locale)}`));
  }
  const queryString = query.toString() ? `?${query.toString()}` : "";
  const localizedQueryString = localizedQuery.toString() ? `?${localizedQuery.toString()}` : "";
  const nextPath = pathname.replace(/^\/(th|en)(?=\/|$)/, `/${otherLocale(locale)}`);
  const currentPath = `${pathname}${queryString}`;
  const localizedNextPath = `${nextPath}${localizedQueryString}`;

  return (
    <nav className="language-toggle" aria-label="Language">
      <Link className={locale === "th" ? "active" : ""} href={locale === "th" ? currentPath : localizedNextPath} hrefLang="th">TH</Link>
      <Link className={locale === "en" ? "active" : ""} href={locale === "en" ? currentPath : localizedNextPath} hrefLang="en">EN</Link>
    </nav>
  );
}
