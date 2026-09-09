import Link from "next/link";
import type { Locale } from "@/lib/i18n";
import { getCopy } from "@/lib/i18n";

export function PublicFooter({ locale }: { locale: Locale }) {
  const t = getCopy(locale);
  return (
    <footer className="footer-note">
      <div>© 2026 ParkSpace MSU · Mahasarakham University</div>
      <div style={{ marginTop: 7 }}>
        <Link href={`/${locale}/privacy`}>{t.privacy}</Link> · <Link href={`/${locale}/terms`}>{t.terms}</Link> · <Link href={`/${locale}/help`}>{t.help}</Link>
      </div>
    </footer>
  );
}
