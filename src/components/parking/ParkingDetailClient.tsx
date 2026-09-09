"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Building2, Clock3, ExternalLink, Navigation, ParkingSquare, ShieldCheck } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { getCopy } from "@/lib/i18n";
import { getGoogleMapsNavigationUrl, officialSource, parkingAreas, type ParkingArea } from "@/lib/parking/demo-data";
import { MockupNotice } from "@/components/parking/MockupNotice";
import { InteractiveCampusMap } from "@/components/map/InteractiveCampusMap";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { LiveAreaStatus } from "@/components/parking/LiveAreaStatus";
import { AreaImage } from "@/components/parking/AreaImage";
import { CapacitySummary } from "@/components/parking/CapacitySummary";
import { PublicFooter } from "@/components/layout/PublicFooter";

export function ParkingDetailClient({ locale, area }: { locale: Locale; area: ParkingArea }) {
  const t = getCopy(locale);
  const [tab, setTab] = useState<"overview" | "map" | "photos" | "details">("overview");
  const [slotMode, setSlotMode] = useState(area.slotMode);
  const [verifiedPoint, setVerifiedPoint] = useState<{ latitude: number; longitude: number } | null>(null);
  const title = locale === "th" ? area.th : area.en;
  const detail = locale === "th" ? area.detailTh : area.detailEn;

  useEffect(() => {
    let active = true;
    async function loadLiveArea() {
      if (!isSupabaseConfigured()) return;
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase.from("parking_areas").select("slot_mode, latitude, longitude, data_status").eq("code", area.code).maybeSingle();
      if (active && (data?.slot_mode === "AREA_ONLY" || data?.slot_mode === "INDIVIDUAL_SLOT")) setSlotMode(data.slot_mode);
      const latitude = Number(data?.latitude);
      const longitude = Number(data?.longitude);
      if (active && data?.data_status === "VERIFIED" && Number.isFinite(latitude) && Number.isFinite(longitude)) {
        setVerifiedPoint({ latitude, longitude });
      } else if (active) {
        setVerifiedPoint(null);
      }
    }
    void loadLiveArea();
    return () => { active = false; };
  }, [area.code]);

  const canShowSlotLayout = slotMode === "INDIVIDUAL_SLOT" || area.prototypeSlotGrid;
  const bookingHref = canShowSlotLayout ? `/${locale}/parking/${area.id}/slots` : `/${locale}/app/bookings/new?area=${area.id}`;
  const bookingLabel = canShowSlotLayout ? t.selectSlot : t.reserveArea;

  return (
    <div className="app-frame">
      <div className="mobile-page page-wrap">
        <div className="page-topbar"><Link className="back-button" href={`/${locale}/parking`} aria-label={t.back}><ArrowLeft size={18} /></Link><div><h1>{t.details}</h1><p>{area.code} · {title}</p></div></div>
        <AreaImage areaCode={area.code} title={title} locale={locale} className="detail-image" loading="eager" />
        <main className="detail-content">
          <div className="detail-title-row"><div><h1>{title}<span>{locale === "th" ? area.en : area.th}</span></h1></div><LiveAreaStatus areaCode={area.code} locale={locale} fallback={area.status} /></div>
          <div className="inline-actions" style={{ marginTop: 13 }}><span className="data-badge"><ShieldCheck size={12} /> {t.officialMap}</span><span className="mockup-badge">{slotMode === "INDIVIDUAL_SLOT" ? t.individualSlot : t.areaOnly}</span><span className="data-badge">{verifiedPoint ? t.coordinateVerified : t.coordinateSearchFallback}</span></div>
          {area.estimatedCapacity ? <MockupNotice locale={locale} compact /> : null}
          <div className="stat-grid">
            <div className="stat-card"><strong>{area.estimatedCapacity ?? "—"}</strong><span>{t.estimatedCapacity}<br />{area.estimatedCapacity ? t.sampleData : t.notVerified}</span></div>
            <div className="stat-card"><strong>—</strong><span>{t.bookings}<br />{t.operationalData}</span></div>
            <div className="stat-card"><strong>—</strong><span>{t.occupied}<br />{t.operationalData}</span></div>
          </div>
          <div className="tabs" role="tablist">
            {([["overview", t.overview], ["map", t.map], ["photos", t.photos], ["details", t.detailsTab]] as const).map(([key, label]) => <button className={tab === key ? "active" : ""} key={key} onClick={() => setTab(key)} role="tab" aria-selected={tab === key}>{label}</button>)}
          </div>
          {tab === "map" ? <InteractiveCampusMap locale={locale} areas={parkingAreas} selectedAreaCode={area.code} showAreaPicker={false} /> : null}
          {tab === "photos" ? <div className="detail-photo-card"><AreaImage areaCode={area.code} title={title} locale={locale} className="detail-photo-image" /><div><strong>{t.customImage}</strong><p>{t.placeholderImageNote}</p><a className="text-link" href={officialSource} target="_blank" rel="noreferrer">{t.officialMap} · {t.realSource} <ExternalLink size={13} /></a></div></div> : null}
          {tab === "overview" ? <>
            <p className="page-subtitle" style={{ marginTop: 18 }}>{detail}</p>
            <ul className="detail-list">
              <li><Building2 size={16} />{t.officialMap} · {t.realDataNote}</li>
              <li><Clock3 size={16} />{t.operatingHours}: {t.notVerified}</li>
              <li><ParkingSquare size={16} />{t.vehicleTypes}: {t.notVerified}</li>
            </ul>
          </> : null}
          {tab === "details" ? <div className="info-card" style={{ padding: 18, marginTop: 18 }}><strong>{t.rules}</strong><p className="page-subtitle">{t.operationalData}</p></div> : null}
          {tab === "overview" ? <CapacitySummary areaCode={area.code} locale={locale} /> : null}
          <div className="sticky-action"><a className="secondary-button" href={getGoogleMapsNavigationUrl(area, verifiedPoint)} target="_blank" rel="noreferrer"><Navigation size={16} />{verifiedPoint ? t.navigate : t.openGoogleMaps}</a><Link className="primary-button" href={bookingHref}>{bookingLabel}</Link></div>
        </main>
      </div>
      <div className="page-wrap"><PublicFooter locale={locale} /></div>
    </div>
  );
}
