import Link from "next/link";
import type { Locale } from "@/lib/i18n";
import { getCopy } from "@/lib/i18n";

export function PublicFooter({ locale }: { locale: Locale }) {
  const t = getCopy(locale);
  return (
    <footer className="footer-note">
      <strong className="footer-copyright">{t.copyright}</strong>
      <div style={{ marginTop: 7 }}>
        <Link href={`/${locale}/about-project`}>{t.projectTitle}</Link> · <Link href={`/${locale}/team`}>{t.team}</Link> · <Link href={`/${locale}/guide`}>{locale === "th" ? "คู่มือ & ผังระบบ" : "System Guide & Sitemap"}</Link> · <Link href={`/${locale}/privacy`}>{t.privacy}</Link> · <Link href={`/${locale}/terms`}>{t.terms}</Link> · <Link href={`/${locale}/help`}>{t.help}</Link> · <Link href={`/${locale}/report-bug`}>{t.reportBug}</Link> · <Link href={`/${locale}/feedback`}>{t.rateExperience}</Link>
      </div>
    </footer>
  );
}
