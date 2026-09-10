"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BookOpen, Calendar, ParkingSquare } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { getCopy } from "@/lib/i18n";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

export function HeroActions({ locale }: { locale: Locale }) {
  const t = getCopy(locale);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    async function checkAuth() {
      if (!isSupabaseConfigured()) {
        if (active) setIsLoggedIn(false);
        return;
      }
      try {
        const supabase = createSupabaseBrowserClient();
        const { data } = await supabase.auth.getSession();
        if (active) {
          setIsLoggedIn(Boolean(data.session));
        }
      } catch {
        if (active) setIsLoggedIn(false);
      }
    }
    void checkAuth();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="hero-actions">
      <Link className="secondary-button" href={`/${locale}/parking`}>
        {t.parking}
      </Link>
      {isLoggedIn === false && (
        <Link className="ghost-button" href={`/${locale}/login`}>
          {t.login}
        </Link>
      )}
      {isLoggedIn === true && (
        <Link
          className="ghost-button"
          href={`/${locale}/app/bookings`}
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <Calendar size={15} />
          <span>{t.bookings}</span>
        </Link>
      )}
      <Link
        className="ghost-button"
        href={`/${locale}/guide`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          background: "var(--gold-soft)",
          borderColor: "rgba(248, 201, 40, 0.4)",
          color: "#9a7800",
          fontWeight: 700,
        }}
      >
        <BookOpen size={15} />
        <span>{locale === "th" ? "คู่มือ & ผังพรีเซนต์" : "Guide & Slides"}</span>
      </Link>
    </div>
  );
}
