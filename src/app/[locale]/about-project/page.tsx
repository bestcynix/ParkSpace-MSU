import type { Metadata } from "next";
import { ArrowRight, Brain, Lightbulb, PencilRuler, Search, TestTube2, UserRound } from "lucide-react";
import { AppHeader } from "@/components/layout/AppHeader";
import { PageTopbar } from "@/components/layout/PageTopbar";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { getCopy, isLocale, type Locale } from "@/lib/i18n";
import { projectInfo } from "@/lib/project-info";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale: Locale = isLocale(rawLocale) ? rawLocale : "th";
  const t = getCopy(locale);

  return {
    title: locale === "th" ? "เกี่ยวกับโครงงาน" : "About the project",
    description: t.projectPurpose,
  };
}

export default async function AboutProjectPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale: Locale = isLocale(rawLocale) ? rawLocale : "th";
  const t = getCopy(locale);

  const steps = [
    [Brain, "Empathize", locale === "th" ? "เข้าใจผู้ใช้งาน" : "Understand users"],
    [Search, "Define", locale === "th" ? "กำหนดปัญหา" : "Frame the problem"],
    [Lightbulb, "Ideate", locale === "th" ? "สร้างแนวคิด" : "Generate ideas"],
    [PencilRuler, "Prototype", locale === "th" ? "สร้างต้นแบบ" : "Build a prototype"],
    [TestTube2, "Test", locale === "th" ? "ทดสอบและปรับปรุง" : "Test and improve"],
  ] as const;
  const teamMemberName = locale === "th" ? projectInfo.teamMember.name : "Natthaphon Phankon";

  return (
    <div className="app-frame">
      <div className="page-wrap">
        <AppHeader locale={locale} />
        <PageTopbar locale={locale} title={t.projectTitle} subtitle={`${t.projectCourse} · ${t.semester}`} />

        <main>
          <section className="hero" style={{ marginTop: 20 }}>
            <div className="hero-content">
              <p className="eyebrow">ParkSpace MSU</p>
              <h1>{t.tagline}</h1>
              <p>
                {t.projectPurpose}
                {locale === "th" ? <><br />Mahasarakham University</> : null}
              </p>
            </div>
          </section>

          <section className="project-info-card" aria-labelledby="project-summary-title">
            <p className="eyebrow">{t.projectCourse}</p>
            <h2 id="project-summary-title">{t.projectTitle}</h2>
            <p className="project-summary-meta"><span>{t.semester}</span><span aria-hidden="true">·</span><span>{t.teamMembersLabel} 1</span></p>
          </section>

          <section className="project-team-section" aria-labelledby="about-team-title">
            <div className="section-heading">
              <div>
                <h2 id="about-team-title">{t.teamMembersLabel}</h2>
                <p>1</p>
              </div>
            </div>
            <div className="team-grid team-grid-single">
              <article className="team-card team-member-card">
                <span className="team-number">1</span>
                <div className="team-member-heading">
                  <span className="team-avatar" aria-hidden="true"><UserRound size={20} /></span>
                  <div>
                    <strong>{teamMemberName}</strong>
                    <span>{projectInfo.teamMember.studentId}</span>
                  </div>
                </div>
                <span>{t.teamMemberStudy}</span>
                <div className="data-badge team-role-badge">{locale === "th" ? "สมาชิกทีม" : "Team member"}</div>
              </article>
            </div>
          </section>

          <section className="info-card" style={{ padding: 20, marginTop: 18 }} aria-labelledby="design-thinking-title">
            <h2 id="design-thinking-title" style={{ margin: 0, fontSize: 19 }}>{t.designThinkingTitle}</h2>
            <div className="team-grid process-grid">
              {steps.map(([Icon, title, subtitle], index) => (
                <div className="team-card" key={title}>
                  <span className="team-number">{index + 1}</span>
                  <div className="process-card-icon-row">
                    <Icon size={20} color="#9a7800" aria-hidden="true" />
                    {index < steps.length - 1 ? <ArrowRight size={14} color="#d0a900" aria-hidden="true" /> : <span aria-hidden="true" />}
                  </div>
                  <strong>{title}</strong>
                  <span className="process-card-subtitle">{subtitle}</span>
                </div>
              ))}
            </div>
          </section>
        </main>

        <PublicFooter locale={locale} />
      </div>
    </div>
  );
}
