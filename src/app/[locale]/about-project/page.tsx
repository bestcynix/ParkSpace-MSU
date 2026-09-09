import type { Metadata } from "next";
import { ArrowRight, Brain, CheckCircle2, Lightbulb, PencilRuler, Search, TestTube2 } from "lucide-react";
import { AppHeader } from "@/components/layout/AppHeader";
import { PageTopbar } from "@/components/layout/PageTopbar";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { getCopy, isLocale, type Locale } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> { return { title: "About the project" }; }

export default async function AboutProjectPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale: Locale = isLocale(rawLocale) ? rawLocale : "th";
  const t = getCopy(locale);
  const steps = [[Brain, "Empathize", locale === "th" ? "เข้าใจผู้ใช้งาน" : "Understand users"], [Search, "Define", locale === "th" ? "กำหนดปัญหา" : "Frame the problem"], [Lightbulb, "Ideate", locale === "th" ? "สร้างแนวคิด" : "Generate ideas"], [PencilRuler, "Prototype", locale === "th" ? "สร้างต้นแบบ" : "Build a prototype"], [TestTube2, "Test", locale === "th" ? "ทดสอบและปรับปรุง" : "Test and improve"]] as const;
  return <div className="app-frame"><div className="page-wrap"><AppHeader locale={locale} /><PageTopbar locale={locale} title={t.projectTitle} subtitle={t.projectCourse} /><div className="hero" style={{ marginTop: 20 }}><div className="hero-content"><p className="eyebrow">ParkSpace MSU</p><h1>{t.tagline}</h1><p>{t.projectCourse} · {t.semester}<br />Mahasarakham University</p></div></div><div className="info-card" style={{ padding: 20, marginTop: 18 }}><h2 style={{ margin: 0, fontSize: 19 }}>{locale === "th" ? "กระบวนการ Design Thinking" : "Design Thinking flow"}</h2><div className="team-grid process-grid">{steps.map(([Icon, title, subtitle], index) => <div className="team-card" key={title}><span className="team-number">{index + 1}</span><Icon size={20} color="#9a7800" style={{ display: "block", marginTop: 14 }} /><strong>{title}</strong><span>{subtitle}</span>{index < steps.length - 1 ? <ArrowRight size={14} color="#d0a900" style={{ float: "right", marginTop: -15 }} /> : null}</div>)}</div></div><PublicFooter locale={locale} /></div></div>;
}
