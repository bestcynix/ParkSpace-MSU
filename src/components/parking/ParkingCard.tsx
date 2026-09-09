import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { getCopy } from "@/lib/i18n";
import { getAreaDetail, getAreaName, type ParkingArea } from "@/lib/parking/demo-data";
import { MockupNotice } from "@/components/parking/MockupNotice";
import { StatusBadge } from "@/components/parking/StatusBadge";

export function ParkingCard({ area, locale }: { area: ParkingArea; locale: Locale }) {
  const t = getCopy(locale);
  const slotLayoutHref = area.slotMode === "INDIVIDUAL_SLOT" || area.prototypeSlotGrid ? `/${locale}/parking/${area.id}/slots` : `/${locale}/app/bookings/new?area=${area.id}`;
  const reserveLabel = area.slotMode === "INDIVIDUAL_SLOT" || area.prototypeSlotGrid ? t.selectSlot : t.reserve;
  return (
    <article className="parking-card">
      <div className="parking-image" aria-label={`${t.pendingImage} / ${t.pendingImageEn}`}>
        <span className="image-label">{t.pendingImage}</span>
      </div>
      <div className="parking-card-body">
        <div className="parking-card-top">
          <h3>
            {area.code} · {getAreaName(area, locale)}
            <span>{getAreaDetail(area, locale)}</span>
          </h3>
          <StatusBadge status={area.status} locale={locale} />
        </div>
        <div className="parking-detail-line"><MapPin size={13} />{area.distance ?? t.awaitingVerification}</div>
        {area.estimatedCapacity ? <div className="parking-detail-line">{t.estimatedCapacity}: {area.estimatedCapacity} {locale === "th" ? "คัน" : "vehicles"}</div> : null}
        <div className="inline-actions" style={{ marginTop: 10 }}>
          <span className="data-badge">{t.awaitingVerification}</span>
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
