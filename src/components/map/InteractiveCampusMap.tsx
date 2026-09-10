"use client";

import Link from "next/link";
import { Crosshair, ExternalLink, LocateFixed, MapPinned, RotateCcw, Satellite, Sliders, ZoomIn, ZoomOut } from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent, type WheelEvent } from "react";
import type { Locale } from "@/lib/i18n";
import { getCopy } from "@/lib/i18n";
import { campusCenter, getGoogleMapsNavigationUrl, getGoogleMapsSearchQuery, officialMapImage, officialMapMarkers, officialSource, type ParkingArea } from "@/lib/parking/demo-data";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

type MapMode = "google" | "satellite" | "diagram";

type LiveMapPoint = { latitude: number; longitude: number };
type LiveMapRow = { code: string; latitude: number | string | null; longitude: number | string | null; data_status: string | null };

function coordinate(value: number | string | null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

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
  const [mode, setMode] = useState<MapMode>("google");
  const [focusCode, setFocusCode] = useState(firstCode);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [livePoints, setLivePoints] = useState<Record<string, LiveMapPoint>>({});
  const [coordinatesLoading, setCoordinatesLoading] = useState(true);
  const [coordinatesError, setCoordinatesError] = useState("");
  const [canCalibrate, setCanCalibrate] = useState(false);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [overrideLat, setOverrideLat] = useState<string | null>(null);
  const [overrideLng, setOverrideLng] = useState<string | null>(null);
  const [calibMsg, setCalibMsg] = useState("");
  const [calibSaving, setCalibSaving] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  const areaCodes = areas.map((area) => area.code).join(",");

  useEffect(() => {
    let active = true;
    async function checkRole() {
      if (!isSupabaseConfigured()) return;
      try {
        const supabase = createSupabaseBrowserClient();
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData.session) return;
        const { data: roleData } = await supabase.from("user_roles").select("role").eq("user_id", sessionData.session.user.id);
        const roles = (roleData ?? []).map((r: { role?: unknown }) => String(r.role ?? "").toLowerCase().trim());
        if (active && (roles.includes("admin") || roles.includes("developer"))) {
          setCanCalibrate(true);
        }
      } catch {
        // Safe fallback
      }
    }
    void checkRole();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    async function loadVerifiedPoints() {
      if (!isSupabaseConfigured() || !areaCodes) {
        if (active) setCoordinatesLoading(false);
        return;
      }
      setCoordinatesLoading(true);
      setCoordinatesError("");
      try {
        const { data, error } = await createSupabaseBrowserClient()
          .from("parking_areas")
          .select("code, latitude, longitude, data_status")
          .in("code", areaCodes.split(","));
        if (error) throw error;
        const next: Record<string, LiveMapPoint> = {};
        for (const row of (data ?? []) as LiveMapRow[]) {
          const latitude = coordinate(row.latitude);
          const longitude = coordinate(row.longitude);
          if (latitude !== null && longitude !== null && latitude > 0) {
            next[row.code.toUpperCase()] = { latitude, longitude };
          }
        }
        if (active) setLivePoints(next);
      } catch (error) {
        if (active) {
          setLivePoints({});
          setCoordinatesError(error instanceof Error ? error.message : t.operationalData);
        }
      } finally {
        if (active) setCoordinatesLoading(false);
      }
    }
    void loadVerifiedPoints();
    return () => { active = false; };
  }, [areaCodes, t.operationalData]);

  const focusArea = areas.find((area) => area.code === focusCode) ?? areas[0];
  const focusName = focusArea ? (locale === "th" ? focusArea.th : focusArea.en) : t.map;
  const focusPoint = (focusArea ? livePoints[focusArea.code] : null) ?? (focusArea && Number.isFinite(focusArea.latitude) && Number.isFinite(focusArea.longitude) ? { latitude: focusArea.latitude, longitude: focusArea.longitude } : null);

  const displayCalibLat = overrideLat ?? (focusPoint ? String(focusPoint.latitude) : "");
  const displayCalibLng = overrideLng ?? (focusPoint ? String(focusPoint.longitude) : "");

  async function handleSaveCalibration() {
    if (!focusArea) return;
    const lat = parseFloat(displayCalibLat);
    const lng = parseFloat(displayCalibLng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      setCalibMsg(locale === "th" ? "กรุณาระบุตัวเลขพิกัดที่ถูกต้อง" : "Please enter valid coordinates");
      return;
    }
    setCalibSaving(true);
    setCalibMsg("");
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("parking_areas")
        .update({ latitude: lat, longitude: lng, data_status: "VERIFIED", updated_at: new Date().toISOString() })
        .eq("code", focusArea.code);
      if (error) throw error;
      setLivePoints((prev) => ({ ...prev, [focusArea.code]: { latitude: lat, longitude: lng } }));
      setOverrideLat(null);
      setOverrideLng(null);
      setCalibMsg(locale === "th" ? `✓ บันทึกพิกัด ${focusArea.code} เรียบร้อย` : `✓ Saved coordinates for ${focusArea.code}`);
    } catch (err) {
      setCalibMsg(err instanceof Error ? err.message : "Error saving");
    } finally {
      setCalibSaving(false);
    }
  }

  function handleUseCurrentGPS() {
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setOverrideLat(pos.coords.latitude.toFixed(6));
          setOverrideLng(pos.coords.longitude.toFixed(6));
          setCalibMsg(locale === "th" ? "ดึงพิกัดจากอุปกรณ์เรียบร้อย" : "GPS coordinates retrieved");
        },
        () => setCalibMsg(locale === "th" ? "ไม่สามารถดึงตำแหน่ง GPS ได้" : "Unable to retrieve GPS")
      );
    }
  }

  const destinationQuery = focusPoint
    ? `${focusPoint.latitude},${focusPoint.longitude}`
    : focusArea ? getGoogleMapsSearchQuery(focusArea) : "มหาวิทยาลัยมหาสารคาม ตำบลขามเรียง จังหวัดมหาสารคาม";
  const googleMapsUrl = focusArea ? getGoogleMapsNavigationUrl(focusArea, focusPoint) : "https://www.google.com/maps/search/?api=1&query=มหาวิทยาลัยมหาสารคาม";
  const googleEmbedUrl = `https://maps.google.com/maps?q=${encodeURIComponent(destinationQuery)}&z=${focusPoint ? 18 : 16}&ie=UTF8&iwloc=&output=embed`;
  const satelliteUrl = focusPoint
    ? `https://www.google.com/maps/@?api=1&map_action=map&center=${focusPoint.latitude},${focusPoint.longitude}&zoom=18&basemap=satellite`
    : `https://www.google.com/maps/@?api=1&map_action=map&center=${encodeURIComponent(campusCenter)}&zoom=16&basemap=satellite`;
  const satelliteEmbedUrl = `https://maps.google.com/maps?q=${encodeURIComponent(destinationQuery)}&t=k&z=${focusPoint ? 18 : 16}&ie=UTF8&iwloc=&output=embed`;
  const coordinateNote = locale === "th" ? "พิกัดทางการ มมส. (วิทยาเขตขามเรียง)" : "Official MSU Campus Coordinates";
  const mapActionLabel = t.navigate;

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
          <p className="map-coordinate-status" role="status">{coordinatesLoading ? "…" : coordinatesError ? t.coordinateSearchFallback : coordinateNote}</p>
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
          <iframe title={`${t.googleMaps} · ${focusName}`} src={googleEmbedUrl} loading="lazy" allowFullScreen referrerPolicy="no-referrer-when-downgrade" />
          <div className="map-embed-footer"><span>{coordinateNote}</span><a className="text-link" href={googleMapsUrl} target="_blank" rel="noreferrer">{mapActionLabel}<ExternalLink size={13} /></a></div>
        </div>
      ) : null}

      {mode === "satellite" ? (
        <div className="map-embed-shell">
          <iframe title={`${t.satellite} · Kham Riang Campus`} src={satelliteEmbedUrl} loading="lazy" allowFullScreen referrerPolicy="no-referrer-when-downgrade" />
          <div className="map-embed-footer"><span>{focusPoint ? t.coordinateVerified : t.mapApproximateCenter}</span><a className="text-link" href={focusPoint ? googleMapsUrl : satelliteUrl} target="_blank" rel="noreferrer">{mapActionLabel}<ExternalLink size={13} /></a></div>
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
              {/* This is the official announcement image; the numbered markers
                  are clickable image references, not live GPS pins. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={officialMapImage} alt={locale === "th" ? "แผนผัง MSU Car Park 28 พื้นที่" : "MSU Car Park map with 28 areas"} draggable={false} />
              <div className="official-map-markers" aria-label={t.mapReferenceNote}>
                {officialMapMarkers.map((marker) => {
                  const area = areas.find((item) => item.code === marker.code);
                  if (!area) return null;
                  const active = focusArea?.code === marker.code;
                  const name = locale === "th" ? area.th : area.en;
                  return (
                    <button
                      className={`official-map-marker ${active ? "active" : ""}`}
                      key={marker.code}
                      type="button"
                      style={{ left: `${marker.left}%`, top: `${marker.top}%` }}
                      title={`${marker.code} · ${name}`}
                      aria-label={`${marker.code} · ${name}`}
                      aria-pressed={active}
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={() => setFocusCode(marker.code)}
                    >
                      {marker.code.slice(1)}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="map-zoom-controls" aria-label={t.mapMode}>
              <button type="button" onClick={() => changeZoom(0.18)} aria-label={t.zoomIn}><ZoomIn size={17} /></button>
              <button type="button" onClick={() => changeZoom(-0.18)} aria-label={t.zoomOut}><ZoomOut size={17} /></button>
              <button type="button" onClick={resetView} aria-label={t.resetMap}><RotateCcw size={16} /></button>
            </div>
            <span className="diagram-map-hint">{t.dragMap}</span>
          </div>
          <div className="map-embed-footer"><span>{t.officialMap} · {t.mapReferenceNote} · {coordinateNote}</span><a className="text-link" href={officialSource} target="_blank" rel="noreferrer">{t.realSource}<ExternalLink size={13} /></a></div>
        </div>
      ) : null}

      {focusArea ? (
        <div className="selected-map-area">
          <div className="selected-map-area-copy">
            <span>{t.selectedArea}</span>
            <strong>{focusArea.code} · {focusName}</strong>
            <small>{coordinateNote} · {focusPoint ? `${focusPoint.latitude}, ${focusPoint.longitude}` : ""}</small>
          </div>
          <div className="selected-map-area-actions">
            {canCalibrate ? (
              <button
                type="button"
                className="secondary-button"
                onClick={() => setIsCalibrating((prev) => !prev)}
                title={locale === "th" ? "ปรับแต่งพิกัดสำหรับ Admin/Dev" : "Calibrate GPS"}
              >
                <Sliders size={14} />
                <span>{locale === "th" ? "ปรับพิกัด" : "Calibrate"}</span>
              </button>
            ) : null}
            <Link className="secondary-button" href={`/${locale}/parking/${focusArea.id}`}>{t.details}</Link>
            <a className="primary-button" href={googleMapsUrl} target="_blank" rel="noreferrer">{mapActionLabel}<ExternalLink size={14} /></a>
          </div>
        </div>
      ) : null}

      {canCalibrate && isCalibrating && focusArea ? (
        <div className="form-card" style={{ marginTop: 12, padding: 16, border: "1px solid var(--gold)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <strong>{locale === "th" ? `ปรับพิกัด ${focusArea.code} · ${focusName}` : `Calibrate ${focusArea.code}`}</strong>
            <span className="data-badge" style={{ background: "var(--gold-soft)", color: "var(--gold-deep)" }}>Admin / Developer</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
            <div>
              <label style={{ fontSize: 12, color: "var(--muted)" }}>Latitude</label>
              <input className="form-control" value={displayCalibLat} onChange={(e) => { setOverrideLat(e.target.value); setCalibMsg(""); }} placeholder="16.24xxxx" />
            </div>
            <div>
              <label style={{ fontSize: 12, color: "var(--muted)" }}>Longitude</label>
              <input className="form-control" value={displayCalibLng} onChange={(e) => { setOverrideLng(e.target.value); setCalibMsg(""); }} placeholder="103.24xxxx" />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <button className="secondary-button" type="button" onClick={handleUseCurrentGPS}>
              <Crosshair size={14} />
              <span>{locale === "th" ? "ใช้ GPS ปัจจุบัน" : "Use Current GPS"}</span>
            </button>
            <button className="primary-button" type="button" onClick={() => void handleSaveCalibration()} disabled={calibSaving}>
              <span>{calibSaving ? "…" : (locale === "th" ? "บันทึกลงฐานข้อมูล" : "Save Coordinates")}</span>
            </button>
            {calibMsg ? <span style={{ fontSize: 12, color: calibMsg.startsWith("✓") ? "var(--green)" : "var(--red)" }}>{calibMsg}</span> : null}
          </div>
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
