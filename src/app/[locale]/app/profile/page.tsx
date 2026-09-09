import type { Metadata } from "next";
import Link from "next/link";
import { Bell, Car, ChevronRight, CircleHelp, FileClock, LockKeyhole, LogOut, ShieldCheck, UserRound } from "lucide-react";
import { AppHeader } from "@/components/layout/AppHeader";
import { BottomNav } from "@/components/layout/BottomNav";
import { PageTopbar } from "@/components/layout/PageTopbar";
import { getCopy, isLocale, type Locale } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> { return { title: "Profile" }; }

export default async function ProfilePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale: Locale = isLocale(rawLocale) ? rawLocale : "th";
  const t = getCopy(locale);
  const items = [
    [UserRound, locale === "th" ? "ข้อมูลส่วนตัว" : "Personal information", "#"],
    [Car, t.myVehicles, `/${locale}/app/profile/vehicles`],
    [Bell, t.notifications, `/${locale}/app/notifications`],
    [FileClock, locale === "th" ? "ประวัติการจอง" : "Booking history", `/${locale}/app/bookings`],
    [LockKeyhole, locale === "th" ? "บัญชีและความปลอดภัย" : "Account & security", `/${locale}/privacy`],
    [ShieldCheck, t.privacy, `/${locale}/privacy`],
    [CircleHelp, t.help, `/${locale}/help`],
  ] as const;
  return <div className="app-frame"><div className="mobile-page page-wrap"><AppHeader locale={locale} /><PageTopbar locale={locale} title={t.profile} subtitle={t.signInRequired} /><div className="profile-card"><span className="profile-avatar"><UserRound size={28} /></span><div><strong>{t.signInRequired}</strong><span>{t.accountNotConfigured} / {t.accountNotConfiguredEn}</span></div></div><div className="menu-list">{items.map(([Icon, label, href]) => <Link href={href} key={label}><Icon size={18} /><span>{label}</span><ChevronRight className="menu-arrow" size={16} /></Link>)}<button type="button"><LogOut size={18} /><span>{locale === "th" ? "ออกจากระบบ" : "Log out"}</span><ChevronRight className="menu-arrow" size={16} /></button></div><p className="footer-note">{t.noPrivateData}</p></div><BottomNav locale={locale} active="profile" /></div>;
}
