import { Suspense } from "react";
import Link from "next/link";
import { Bell, BookOpen } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { getCopy } from "@/lib/i18n";
import { Logo } from "@/components/brand/Logo";
import { LanguageToggle } from "@/components/layout/LanguageToggle";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { AuthAwareLink } from "@/components/auth/AuthAwareLink";
import { HeaderUserDropdown } from "@/components/layout/HeaderUserDropdown";

export function AppHeader({ locale }: { locale: Locale }) {
  const t = getCopy(locale);
  return (
    <header className="site-header">
      <Logo locale={locale} />
      <div className="header-actions">
        <Suspense fallback={<nav className="language-toggle" aria-label="Language"><span className="active">TH</span><span>EN</span></nav>}><LanguageToggle locale={locale} /></Suspense>
        <ThemeToggle locale={locale} />
        <Link
          href={`/${locale}/guide`}
          className="icon-button"
          title={locale === "th" ? "คู่มือและผังนำเสนอระบบ" : "Guide & Presentation"}
          aria-label={locale === "th" ? "คู่มือและผังนำเสนอระบบ" : "Guide & Presentation"}
          style={{ color: "#9a7800" }}
        >
          <BookOpen size={18} strokeWidth={2.1} />
        </Link>
        <AuthAwareLink className="icon-button" locale={locale} target={`/${locale}/app/notifications`} ariaLabel={t.notifications}>
          <Bell size={18} strokeWidth={2.1} />
        </AuthAwareLink>
        <HeaderUserDropdown locale={locale} />
      </div>
    </header>
  );
}
