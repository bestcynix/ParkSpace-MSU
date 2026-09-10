import { Suspense } from "react";
import { Bell, CircleUserRound } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { getCopy } from "@/lib/i18n";
import { Logo } from "@/components/brand/Logo";
import { LanguageToggle } from "@/components/layout/LanguageToggle";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { AuthAwareLink } from "@/components/auth/AuthAwareLink";

export function AppHeader({ locale }: { locale: Locale }) {
  const t = getCopy(locale);
  return (
    <header className="site-header">
      <Logo locale={locale} />
      <div className="header-actions">
        <Suspense fallback={<nav className="language-toggle" aria-label="Language"><span className="active">TH</span><span>EN</span></nav>}><LanguageToggle locale={locale} /></Suspense>
        <ThemeToggle locale={locale} />
        <AuthAwareLink className="icon-button" locale={locale} target={`/${locale}/app/notifications`} ariaLabel={t.notifications}>
          <Bell size={18} strokeWidth={2.1} />
        </AuthAwareLink>
        <AuthAwareLink className="icon-button" locale={locale} target={`/${locale}/app/profile`} ariaLabel={t.profile}>
          <CircleUserRound size={19} strokeWidth={2.1} />
        </AuthAwareLink>
      </div>
    </header>
  );
}
