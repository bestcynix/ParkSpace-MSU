import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { getCopy } from "@/lib/i18n";

export function PageTopbar({ locale, title, subtitle, backHref }: { locale: Locale; title: string; subtitle?: string; backHref?: string }) {
  const t = getCopy(locale);
  return (
    <div className="page-topbar">
      <Link className="back-button" href={backHref ?? `/${locale}`} aria-label={t.back}><ArrowLeft size={18} /></Link>
      <div><h1>{title}</h1>{subtitle ? <p>{subtitle}</p> : null}</div>
    </div>
  );
}
