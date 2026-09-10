import { Info } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { getCopy } from "@/lib/i18n";

export function MockupNotice({ locale, compact = false }: { locale: Locale; compact?: boolean }) {
  const t = getCopy(locale);
  return (
    <div className="status-note mockup-note" role="note">
      <Info size={15} />
      <span>
        <strong>{t.sampleData} / {t.sampleDataEn}</strong>{compact ? " " : " — "}
        {t.estimateNote}
      </span>
    </div>
  );
}

export const LiveDataNotice = MockupNotice;
