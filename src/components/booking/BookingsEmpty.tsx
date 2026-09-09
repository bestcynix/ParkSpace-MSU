import Link from "next/link";
import { CalendarDays } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { getCopy } from "@/lib/i18n";

export function BookingsEmpty({ locale }: { locale: Locale }) {
  const t = getCopy(locale);
  return <div className="empty-card"><div><div className="empty-icon"><CalendarDays size={27} /></div><h2>{t.myBookingsEmpty}</h2><p>{t.myBookingsEmptySub}</p><Link className="primary-button" style={{ marginTop: 18 }} href={`/${locale}/parking`}>{t.parking}</Link></div></div>;
}
