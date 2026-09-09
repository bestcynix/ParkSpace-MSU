import type { Metadata } from "next";
import { AppHeader } from "@/components/layout/AppHeader";
import { PageTopbar } from "@/components/layout/PageTopbar";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { getCopy, isLocale, type Locale } from "@/lib/i18n";
import { projectInfo } from "@/lib/project-info";

export async function generateMetadata(): Promise<Metadata> { return { title: "Team members" }; }

export default async function TeamPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale: Locale = isLocale(rawLocale) ? rawLocale : "th";
  const t = getCopy(locale);
  return <div className="app-frame"><div className="page-wrap"><AppHeader locale={locale} /><PageTopbar locale={locale} title={t.team} subtitle={`${t.projectCourse} · ${t.semester}`} /><div className="project-info-card"><p className="eyebrow">ParkSpace MSU</p><h2>{t.projectTitle}</h2><p>{t.projectPurpose}</p><div className="project-meta"><span>{t.projectCourse}</span><span>{t.semester}</span></div></div><div className="section-heading"><div><h2>{t.teamMembersLabel}</h2><p>1</p></div></div><div className="team-grid team-grid-single"><div className="team-card"><span className="team-number">1</span><strong>{projectInfo.teamMember.name}</strong><span>{projectInfo.teamMember.studentId}</span><span>{t.teamMemberStudy}</span></div></div><p className="project-credit-note">{t.noPrivateData} · {t.teamMemberStudy}</p><PublicFooter locale={locale} /></div></div>;
}
