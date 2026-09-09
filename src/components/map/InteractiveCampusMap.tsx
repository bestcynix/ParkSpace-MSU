"use client";

import Link from "next/link";
import { ExternalLink, LocateFixed, MapPinned, RotateCcw, Satellite, ZoomIn, ZoomOut } from "lucide-react";
import { useRef, useState, type PointerEvent, type WheelEvent } from "react";
import type { Locale } from "@/lib/i18n";
import { getCopy } from "@/lib/i18n";
import type { ParkingArea } from "@/lib/parking/demo-data";

type MapMode = "google" | "satellite" | "diagram";

const officialMapImage = "https://building.msu.ac.th/uploads/news/news_img_20260623_041630_d386e933.png";
const officialGoogleMyMap = "https://www.google.com/maps/d/embed?mid=19EPtHszwxadv8Jst4jps9NbMakAC4rq1";
const officialGoogleMyMapLink = "https://www.google.com/maps/d/viewer?mid=19EPtHszwxadv8Jst4jps9NbMakAC4rq1";
const campusCenter = "16.24704,103.24936";
const mapSource = "https://building.msu.ac.th/news-detail.php?id=23";

export function InteractiveCampusMap({
  locale,
  areas,
  selectedAreaCode,
  showAreaPicker = true,
}: {
  locale: Locale;
  areas: ParkingArea[];
  selectedAreaCode?: string;
  showAreaPicker?: boolean;
}) {
  const t = getCopy(locale);
  const firstCode = selectedAreaCode ?? areas[0]?.code ?? "P01";
  const [mode, setMode] = useState<MapMode>("diagram");
  const [focusCode, setFocusCode] = useState(firstCode);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  const focusArea = areas.find((area) => area.code === focusCode) ?? areas[0];
  const focusName = focusArea ? (locale === "th" ? focusArea.th : focusArea.en) : t.map;
  const searchQuery = focusArea
    ? `${focusArea.code} ${focusArea.th} ${focusArea.en} มหาวิทยาลัยมหาสารคาม เขตพื้นที่ขามเรียง`
    : "มหาวิทยาลัยมหาสารคาม เขตพื้นที่ขามเรียง";
  const googleSearchUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(searchQuery)}`;
  const satelliteUrl = `https://www.google.com/maps/@?api=1&map_action=map&center=${encodeURIComponent(campusCenter)}&zoom=16&basemap=satellite`;
  const satelliteEmbedUrl = `https://maps.google.com/maps?q=${encodeURIComponent(campusCenter)}&t=k&z=16&ie=UTF8&iwloc=&output=embed`;

  function changeZoom(delta: number) {
    setZoom((current) => Math.min(2.6, Math.max(0.75, Number((current + delta).toFixed(2)))));
  }

  function resetView() {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }

  function handleWheel(event: WheelEvent<HTMLDivElement>) {
    event.preventDefault();
    changeZoom(event.deltaY < 0 ? 0.12 : -0.12);
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { startX: event.clientX, startY: event.clientY, originX: offset.x, originY: offset.y };
    setDragging(true);
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return;
    setOffset({
      x: dragRef.current.originX + event.clientX - dragRef.current.startX,
      y: dragRef.current.originY + event.clientY - dragRef.current.startY,
    });
  }

  function stopDragging(event: PointerEvent<HTMLDivElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    dragRef.current = null;
    setDragging(false);
  }

  return (
    <section className="interactive-map-card" aria-label={t.map}>
      <div className="map-mode-header">
        <div>
          <p className="eyebrow"><MapPinned size={14} />{t.map}</p>
          <h2>{t.mapMode}</h2>
          <p>{t.mapAreaNote}</p>
        </div>
        <span className="data-badge"><LocateFixed size={13} />{t.allAreas}</span>
      </div>

      <div className="map-mode-tabs" role="tablist" aria-label={t.mapMode}>
        <button type="button" className={mode === "google" ? "active" : ""} onClick={() => setMode("google")} role="tab" aria-selected={mode === "google"}>
          <MapPinned size={15} /><span>{t.googleMaps}</span><small>{t.interactive}</small>
        </button>
        <button type="button" className={mode === "satellite" ? "active" : ""} onClick={() => setMode("satellite")} role="tab" aria-selected={mode === "satellite"}>
          <Satellite size={15} /><span>{t.satellite}</span><small>Google Maps</small>
        </button>
        <button type="button" className={mode === "diagram" ? "active" : ""} onClick={() => { setMode("diagram"); resetView(); }} role="tab" aria-selected={mode === "diagram"}>
          <MapPinned size={15} /><span>{t.diagram2D}</span><small>{t.interactive}</small>
        </button>
      </div>

      {mode === "google" ? (
        <div className="map-embed-shell">
          <iframe title={`${t.googleMaps} · ${t.allAreas}`} src={officialGoogleMyMap} loading="lazy" allowFullScreen referrerPolicy="no-referrer-when-downgrade" />
          <div className="map-embed-footer"><span>{t.officialMap}</span><a className="text-link" href={officialGoogleMyMapLink} target="_blank" rel="noreferrer">{t.openGoogleMaps}<ExternalLink size={13} /></a></div>
        </div>
      ) : null}

      {mode === "satellite" ? (
        <div className="map-embed-shell">
          <iframe title={`${t.satellite} · Kham Riang Campus`} src={satelliteEmbedUrl} loading="lazy" allowFullScreen referrerPolicy="no-referrer-when-downgrade" />
          <div className="map-embed-footer"><span>{t.mapApproximateCenter}</span><a className="text-link" href={satelliteUrl} target="_blank" rel="noreferrer">{t.openGoogleMaps}<ExternalLink size={13} /></a></div>
        </div>
      ) : null}

      {mode === "diagram" ? (
        <div className="diagram-map-shell">
          <div
            className={`interactive-diagram ${dragging ? "is-dragging" : ""}`}
            role="application"
            aria-label={`${t.diagram2D} · ${t.dragMap}`}
            onWheel={handleWheel}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={stopDragging}
            onPointerCancel={stopDragging}
          >
            <div className="interactive-diagram-canvas" style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})` }}>
              {/* This is the official announcement image; the numbered markers are reference data, not live GPS pins. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={officialMapImage} alt={locale === "th" ? "แผนผัง MSU Car Park 28 พื้นที่" : "MSU Car Park map with 28 areas"} draggable={false} />
            </div>
            <div className="map-zoom-controls" aria-label={t.mapMode}>
              <button type="button" onClick={() => changeZoom(0.18)} aria-label={t.zoomIn}><ZoomIn size={17} /></button>
              <button type="button" onClick={() => changeZoom(-0.18)} aria-label={t.zoomOut}><ZoomOut size={17} /></button>
              <button type="button" onClick={resetView} aria-label={t.resetMap}><RotateCcw size={16} /></button>
            </div>
            <span className="diagram-map-hint">{t.dragMap}</span>
          </div>
          <div className="map-embed-footer"><span>{t.officialMap}</span><a className="text-link" href={mapSource} target="_blank" rel="noreferrer">{t.realSource}<ExternalLink size={13} /></a></div>
        </div>
      ) : null}

      {focusArea ? (
        <div className="selected-map-area">
          <div className="selected-map-area-copy"><span>{t.selectedArea}</span><strong>{focusArea.code} · {focusName}</strong><small>{t.mapAreaNote}</small></div>
          <div className="selected-map-area-actions"><Link className="secondary-button" href={`/${locale}/parking/${focusArea.id}`}>{t.details}</Link><a className="primary-button" href={googleSearchUrl} target="_blank" rel="noreferrer">{t.openGoogleMaps}<ExternalLink size={14} /></a></div>
        </div>
      ) : null}

      {showAreaPicker ? (
        <div className="map-area-picker">
          <div className="section-heading"><div><h3>{t.allAreas}</h3><p>{t.officialMap}</p></div></div>
          <div className="map-area-chip-grid">
            {areas.map((area) => <button type="button" key={area.code} className={focusArea?.code === area.code ? "active" : ""} onClick={() => setFocusCode(area.code)} aria-pressed={focusArea?.code === area.code}>{area.code}</button>)}
          </div>
        </div>
      ) : null}
    </section>
  );
}
