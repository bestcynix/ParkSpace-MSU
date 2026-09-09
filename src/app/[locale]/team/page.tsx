import type { Metadata } from "next";
import { AppHeader } from "@/components/layout/AppHeader";
import { PageTopbar } from "@/components/layout/PageTopbar";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { getCopy, isLocale, type Locale } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> { return { title: "Team members" }; }

export default async function TeamPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale: Locale = isLocale(rawLocale) ? rawLocale : "th";
  const t = getCopy(locale);
  return <div className="app-frame"><div className="page-wrap"><AppHeader locale={locale} /><PageTopbar locale={locale} title={t.team} subtitle={locale === "th" ? "รองรับสมาชิกทีม 15 คน" : "Editable team page for 15 members"} /><div className="team-grid">{Array.from({ length: 15 }, (_, index) => <div className="team-card" key={index}><span className="team-number">{index + 1}</span><strong>{locale === "th" ? "รอข้อมูลสมาชิก" : "Member information pending"}</strong><span>{locale === "th" ? "ชื่อ-สกุล · รหัสนิสิต · สาขา · คณะ/วิทยาลัย" : "Full name · Student ID · Major · Faculty/College"}</span></div>)}</div><p className="mockup-note" style={{ marginTop: 18 }}>{locale === "th" ? "หน้านี้เป็นโครงสร้างสำหรับกรอกข้อมูลสมาชิกจริง ไม่ควรใส่ข้อมูลส่วนตัวโดยไม่ได้รับความยินยอม" : "This is a structure for approved team data. Do not add personal information without consent."}</p><PublicFooter locale={locale} /></div></div>;
}
