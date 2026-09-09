import type { Locale } from "@/lib/i18n";
import { getCopy } from "@/lib/i18n";
import { projectInfo } from "@/lib/project-info";

export function ProjectCredits({ locale, compact = false }: { locale: Locale; compact?: boolean }) {
  const t = getCopy(locale);
  return <div className={`project-credits${compact ? " compact" : ""}`}>
    <strong>{t.copyright}</strong>
    <span>{t.poweredBy} {projectInfo.poweredBy.name}</span>
    <small>{projectInfo.poweredBy.studentId} · {t.creatorStudy}</small>
  </div>;
}
