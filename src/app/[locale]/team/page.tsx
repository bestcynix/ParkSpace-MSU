import type { Metadata } from "next";
import { AppHeader } from "@/components/layout/AppHeader";
import { PageTopbar } from "@/components/layout/PageTopbar";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { getCopy, isLocale, type Locale } from "@/lib/i18n";
import { TeamDirectory } from "@/components/project/TeamDirectory";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale: Locale = isLocale(rawLocale) ? rawLocale : "th";
  const t = getCopy(locale);
  return {
    title: t.team,
    description: t.projectPurpose,
  };
}

export default async function TeamPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale: Locale = isLocale(rawLocale) ? rawLocale : "th";
  const t = getCopy(locale);
  return (
    <div className="app-frame">
      <div className="page-wrap">
        <AppHeader locale={locale} />
        <main>
          <PageTopbar locale={locale} title={t.team} subtitle={`${t.projectCourse} · ${t.semester}`} />
          <section className="project-info-card" aria-labelledby="team-project-title">
            <p className="eyebrow">ParkSpace MSU</p>
            <h2 id="team-project-title">{t.projectTitle}</h2>
            <p>{t.projectPurpose}</p>
            <div className="project-meta">
              <span>{t.projectCourse}</span>
              <span>{t.semester}</span>
            </div>
          </section>
          <TeamDirectory locale={locale} />
          <p className="project-credit-note">{t.noPrivateData}</p>
        </main>
        <PublicFooter locale={locale} />
      </div>
    </div>
  );
}
