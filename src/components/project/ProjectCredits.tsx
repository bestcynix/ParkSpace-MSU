"use client";

import { useState } from "react";
import { X } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { getCopy } from "@/lib/i18n";
import { projectInfo } from "@/lib/project-info";

export function ProjectCredits({ locale, compact = false }: { locale: Locale; compact?: boolean }) {
  const t = getCopy(locale);
  const [open, setOpen] = useState(false);
  return <>
    <div className={`project-credits${compact ? " compact" : ""}`}>
      <strong>{t.copyright}</strong>
      <span>{t.poweredBy} <button type="button" className="project-credit-link" onClick={() => setOpen(true)}>{projectInfo.poweredBy.name}</button></span>
      <small>{projectInfo.poweredBy.studentId} · {t.creatorStudy}</small>
    </div>
    {open ? <div className="credit-dialog-overlay" role="presentation" onMouseDown={() => setOpen(false)}>
      <section className="credit-dialog" role="dialog" aria-modal="true" aria-labelledby="creator-dialog-title" onMouseDown={(event) => event.stopPropagation()}>
        <button type="button" className="notification-close credit-dialog-close" onClick={() => setOpen(false)} aria-label={t.close}><X size={17} /></button>
        <p className="eyebrow">{t.poweredBy}</p>
        <h2 id="creator-dialog-title">{projectInfo.poweredBy.name}</h2>
        <p>{t.creatorInfo}</p>
        <div className="credit-detail-list"><span><b>{t.studentId}</b>{projectInfo.poweredBy.studentId}</span><span><b>{t.creatorStudyLabel}</b>{t.creatorStudy}</span><span><b>{t.creatorRole}</b>{t.developer}</span></div>
        <button type="button" className="primary-button" onClick={() => setOpen(false)}>{t.close}</button>
      </section>
    </div> : null}
  </>;
}
