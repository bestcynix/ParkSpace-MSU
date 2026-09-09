import Link from "next/link";
import { ArrowRight, ExternalLink, MapPin } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { getCopy } from "@/lib/i18n";
import { getAreaDetail, getAreaName, getGoogleMapsSearchUrl, officialMapImage, type ParkingArea } from "@/lib/parking/demo-data";
import { LiveAreaStatus } from "@/components/parking/LiveAreaStatus";

export function ParkingCard({ area, locale }: { area: ParkingArea; locale: Locale }) {
  const t = getCopy(locale);
  const slotLayoutHref = area.slotMode === "INDIVIDUAL_SLOT" || area.prototypeSlotGrid ? `/${locale}/parking/${area.id}/slots` : `/${locale}/app/bookings/new?area=${area.id}`;
  const reserveLabel = area.slotMode === "INDIVIDUAL_SLOT" || area.prototypeSlotGrid ? t.selectSlot : t.reserve;
  return (
    <article className="parking-card">
      <div className="parking-image">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={officialMapImage} alt={`${t.officialMap} · ${getAreaName(area, locale)}`} loading="lazy" />
        <span className="image-label">{t.officialMap}</span>
      </div>
      <div className="parking-card-body">
        <div className="parking-card-top">
          <h3>
            {area.code} · {getAreaName(area, locale)}
            <span>{getAreaDetail(area, locale)}</span>
          </h3>
          <LiveAreaStatus areaCode={area.code} locale={locale} fallback={area.status} />
          </div>
        <a className="parking-detail-line text-link" href={getGoogleMapsSearchUrl(area)} target="_blank" rel="noreferrer"><MapPin size={13} />{t.openGoogleMaps}<ExternalLink size={12} /></a>
        {area.estimatedCapacity ? <div className="parking-detail-line">{t.estimatedCapacity}: {area.estimatedCapacity} {locale === "th" ? "คัน" : "vehicles"}</div> : null}
        <div className="inline-actions" style={{ marginTop: 10 }}>
          <span className="data-badge">{t.officialMap}</span>
          {area.estimatedCapacity ? <span className="mockup-badge">{t.sampleData}</span> : null}
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
