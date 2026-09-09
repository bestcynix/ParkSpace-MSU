import Link from "next/link";
import { Suspense } from "react";
import { Bell, CircleUserRound } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { getCopy } from "@/lib/i18n";
import { Logo } from "@/components/brand/Logo";
import { LanguageToggle } from "@/components/layout/LanguageToggle";

export function AppHeader({ locale }: { locale: Locale }) {
  const t = getCopy(locale);
  return (
    <header className="site-header">
      <Logo locale={locale} />
      <div className="header-actions">
        <Suspense fallback={<nav className="language-toggle" aria-label="Language"><span className="active">TH</span><span>EN</span></nav>}><LanguageToggle locale={locale} /></Suspense>
        <Link className="icon-button" href={`/${locale}/app/notifications`} aria-label={t.notifications}>
          <Bell size={18} strokeWidth={2.1} />
        </Link>
        <Link className="icon-button" href={`/${locale}/app/profile`} aria-label={t.profile}>
          <CircleUserRound size={19} strokeWidth={2.1} />
        </Link>
      </div>
    </header>
  );
}
