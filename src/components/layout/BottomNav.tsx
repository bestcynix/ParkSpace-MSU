import Link from "next/link";
import { CalendarDays, CircleUserRound, Home, ParkingSquare } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { getCopy } from "@/lib/i18n";

export function BottomNav({ locale, active }: { locale: Locale; active: "home" | "parking" | "bookings" | "profile" }) {
  const t = getCopy(locale);
  const items = [
    { key: "home" as const, href: `/${locale}`, label: t.home, icon: Home },
    { key: "parking" as const, href: `/${locale}/parking`, label: t.parking, icon: ParkingSquare },
    { key: "bookings" as const, href: `/${locale}/app/bookings`, label: t.bookings, icon: CalendarDays },
    { key: "profile" as const, href: `/${locale}/app/profile`, label: t.profile, icon: CircleUserRound },
  ];

  return (
    <nav className="bottom-nav" aria-label="Primary navigation">
      <div className="bottom-nav-inner">
        {items.map(({ key, href, label, icon: Icon }) => (
          <Link className={active === key ? "active" : ""} href={href} key={key}>
            <Icon size={19} strokeWidth={active === key ? 2.5 : 2} />
            <span>{label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
