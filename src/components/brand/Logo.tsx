import Link from "next/link";
import type { Locale } from "@/lib/i18n";
import { getLocalizedTagline } from "@/lib/i18n";

export function Logo({ locale, dark = false }: { locale: Locale; dark?: boolean }) {
  const tagline = getLocalizedTagline(locale);
  return (
    <Link className="brand" href={`/${locale}`} aria-label="ParkSpace MSU home">
      <span className="brand-mark" aria-hidden="true">
        <svg width="32" height="32" viewBox="0 0 64 64" fill="none">
          <path d="M14 10h21c10 0 17 6 17 15s-7 15-17 15H24v13H14V10Zm10 9v12h10c5 0 8-2 8-6s-3-6-8-6H24Z" fill="white" />
          <path d="M46 10c6 0 9 4 9 9 0 8-9 17-9 17s-9-9-9-17c0-5 4-9 9-9Z" fill="#F8C928" />
          <circle cx="46" cy="19" r="3" fill="#222C38" />
        </svg>
      </span>
      <span className="brand-copy">
        <span className="brand-name" style={dark ? { color: "white" } : undefined}>ParkSpace <span style={{ color: "#dca900" }}>MSU</span></span>
        <span className="brand-tagline" style={dark ? { color: "#bac4ce" } : undefined}>{tagline.primary} · {tagline.secondary}</span>
      </span>
    </Link>
  );
}
