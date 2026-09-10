import Link from "next/link";
import { ArrowRight, ExternalLink, MapPin } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { getCopy } from "@/lib/i18n";
import { getAreaDetail, getAreaName, getGoogleMapsSearchUrl, type ParkingArea } from "@/lib/parking/demo-data";
import { LiveAreaStatus, type LiveAreaSummary } from "@/components/parking/LiveAreaStatus";
import { AreaImage } from "@/components/parking/AreaImage";

export function ParkingCard({ area, locale, liveSummary = null }: { area: ParkingArea; locale: Locale; liveSummary?: LiveAreaSummary | null }) {
  const t = getCopy(locale);
  const slotLayoutHref = area.slotMode === "INDIVIDUAL_SLOT" || area.prototypeSlotGrid ? `/${locale}/parking/${area.id}/slots` : `/${locale}/app/bookings/new?area=${area.id}`;
  const reserveLabel = area.slotMode === "INDIVIDUAL_SLOT" || area.prototypeSlotGrid ? t.selectSlot : t.reserve;
  const title = getAreaName(area, locale);
  return (
    <article className="parking-card">
      <AreaImage areaCode={area.code} title={title} locale={locale} />
      <div className="parking-card-body">
        <div className="parking-card-top">
          <h3>
            {area.code} · {getAreaName(area, locale)}
            <span>{getAreaDetail(area, locale)}</span>
          </h3>
          <LiveAreaStatus areaCode={area.code} locale={locale} fallback={area.status} summary={liveSummary} />
          </div>
        <a className="parking-detail-line text-link" href={getGoogleMapsSearchUrl(area)} target="_blank" rel="noreferrer"><MapPin size={13} />{t.openGoogleMaps}<ExternalLink size={12} /></a>
        <div className="parking-detail-line" style={{ display: "flex", flexWrap: "wrap", gap: "4px 8px", alignItems: "center" }}>
          <span>
            {t.estimatedCapacity}: <strong>{liveSummary ? `${liveSummary.available} / ${liveSummary.total}` : `${area.estimatedCapacity}`}</strong> {locale === "th" ? "คัน" : "vehicles"}
          </span>
          {liveSummary && (liveSummary.reserved > 0 || liveSummary.occupied > 0) ? (
            <span style={{ fontSize: "0.82rem", color: "var(--muted, #64748b)" }}>
              ({locale === "th" ? "ว่าง" : "free"} {liveSummary.available}
              {liveSummary.reserved > 0 ? (
                <span style={{ color: "#b45309", fontWeight: 700 }}>
                  {" "}· {locale === "th" ? "จอง" : "res."} {liveSummary.reserved}
                </span>
              ) : null}
              {liveSummary.occupied > 0 ? (
                <span style={{ color: "#1d4ed8", fontWeight: 700 }}>
                  {" "}· {locale === "th" ? "จอด" : "parked"} {liveSummary.occupied}
                </span>
              ) : null})
            </span>
          ) : null}
        </div>
        <div className="inline-actions" style={{ marginTop: 10 }}>
          <span className="data-badge">{t.officialMap}</span>
        </div>
        <div className="card-actions">
          <Link className="secondary-button small-button" href={`/${locale}/parking/${area.id}`}>{t.details}</Link>
          <Link className="primary-button small-button" href={slotLayoutHref}>
            {reserveLabel} <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </article>
  );
}
