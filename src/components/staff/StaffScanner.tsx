"use client";

import { useState, type FormEvent } from "react";
import { Camera, CheckCircle2, MapPin, QrCode, Search, ShieldAlert } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { getCopy } from "@/lib/i18n";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

type ScanResult = {
  booking_id: string | null;
  booking_reference: string | null;
  parking_area_code: string | null;
  parking_area_name_th: string | null;
  parking_slot_code: string | null;
  vehicle_plate: string | null;
  booking_status: string | null;
  qr_status: string | null;
  scan_result: string;
  scan_reason: string;
};

type TransitionResult = {
  next_booking_status: string;
  session_status: string;
  transition_message: string;
};

export function StaffScanner({ locale }: { locale: Locale }) {
  const t = getCopy(locale);
  const [payload, setPayload] = useState("");
  const [areaCode, setAreaCode] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [message, setMessage] = useState("");
  const [validating, setValidating] = useState(false);
  const [transitioning, setTransitioning] = useState("");

  async function validate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setResult(null);
    if (!isSupabaseConfigured()) {
      setMessage(`${t.accountNotConfigured} / ${t.accountNotConfiguredEn}`);
      return;
    }
    const parsed = parseQrPayload(payload);
    if (!parsed.reference || !parsed.token) {
      setMessage(locale === "th" ? "กรุณาวาง QR Payload จากระบบจองให้ครบ" : "Paste the complete QR payload from the booking.");
      return;
    }
    setValidating(true);
    try {
      const { data, error } = await createSupabaseBrowserClient().rpc("validate_booking_qr", { p_reference: parsed.reference, p_token: parsed.token, p_area_code: areaCode.trim() || null });
      if (error) throw error;
      const row = (Array.isArray(data) ? data[0] : data) as ScanResult | undefined;
      if (!row) throw new Error(t.operationalData);
      setResult(row);
      if (row.scan_result !== "VALID") setMessage(`${row.scan_result}: ${row.scan_reason}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t.operationalData);
    } finally {
      setValidating(false);
    }
  }

  async function transition(action: "CHECK_IN" | "CHECK_OUT") {
    if (!result?.booking_id) return;
    setTransitioning(action);
    setMessage("");
    try {
      const { data, error } = await createSupabaseBrowserClient().rpc("transition_parking_session", { p_booking_id: result.booking_id, p_action: action, p_area_code: areaCode.trim() || result.parking_area_code });
      if (error) throw error;
      const row = (Array.isArray(data) ? data[0] : data) as TransitionResult | undefined;
      if (!row) throw new Error(t.operationalData);
      setResult((current) => current ? { ...current, booking_status: row.next_booking_status } : current);
      setMessage(row.transition_message);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t.operationalData);
    } finally {
      setTransitioning("");
    }
  }

  return <section><div className="dashboard-header"><div><p className="eyebrow">{t.staff}</p><h1 className="page-title">{t.scanQr}</h1><p className="page-subtitle">{locale === "th" ? "สแกน QR → ตรวจสอบรถ → ยืนยัน Check-in / Check-out" : "Scan QR → verify vehicle → confirm Check-in / Check-out"}</p></div></div><div className="info-card" style={{ marginTop: 24, padding: 22, textAlign: "center" }}><div className="empty-icon" style={{ margin: "0 auto 15px", width: 76, height: 76 }}><QrCode size={39} /></div><h2 style={{ margin: 0, fontSize: 20 }}>{t.camera}</h2><p className="page-subtitle">{t.cameraPending}</p><button className="primary-button" style={{ marginTop: 16 }} type="button" onClick={() => setMessage(t.cameraPending)}><Camera size={17} />{t.camera}</button></div><form className="form-card" style={{ marginTop: 16 }} onSubmit={(event) => void validate(event)}><h2 style={{ margin: 0, fontSize: 18 }}>{t.manualLookup}</h2><p>{locale === "th" ? "วางข้อมูล QR Payload ที่ได้จากหน้าจอง หรือใช้เครื่องสแกนของ App" : "Paste the QR payload from the booking, or use the App scanner."}</p><div className="form-group"><label htmlFor="staff-payload">QR Payload</label><div className="search-box"><Search size={17} color="#89919b" /><textarea id="staff-payload" className="form-control" style={{ minHeight: 74, padding: 0, border: 0, background: "transparent", boxShadow: "none", resize: "vertical" }} value={payload} onChange={(event) => setPayload(event.target.value)} required /></div></div><div className="form-group"><label htmlFor="staff-area"><MapPin size={14} style={{ verticalAlign: "-2px" }} /> {locale === "th" ? "รหัสพื้นที่ (ถ้าทราบ)" : "Area code (optional)"}</label><input id="staff-area" className="form-control" placeholder="P01" value={areaCode} onChange={(event) => setAreaCode(event.target.value)} maxLength={3} /></div>{message ? <div className="form-note" role="status"><ShieldAlert size={14} style={{ verticalAlign: "-2px" }} /> {message}</div> : null}<button className="primary-button" type="submit" disabled={validating}><CheckCircle2 size={16} />{validating ? "…" : t.scanResult}</button></form>{result ? <div className={`scan-result-card ${result.scan_result === "VALID" ? "valid" : "invalid"}`}><div className="scan-result-heading"><div><p className="eyebrow">{t.scanResult}</p><h2>{result.scan_result}</h2></div><ShieldAlert size={22} /></div><div className="scan-result-grid"><span>{t.bookingReference}<strong>{result.booking_reference ?? "—"}</strong></span><span>{t.area}<strong>{result.parking_area_code ?? "—"}</strong></span><span>{t.vehicle}<strong>{result.vehicle_plate ?? "—"}</strong></span><span>{t.selectedSlot}<strong>{result.parking_slot_code ?? t.areaOnly}</strong></span><span>{t.bookings}<strong>{result.booking_status ?? "—"}</strong></span><span>QR<strong>{result.qr_status ?? "—"}</strong></span></div>{result.scan_result === "VALID" ? <div className="support-form-actions"><button className="primary-button" type="button" onClick={() => void transition("CHECK_IN")} disabled={Boolean(transitioning)}>{transitioning === "CHECK_IN" ? "…" : t.checkIn}</button><button className="secondary-button" type="button" onClick={() => void transition("CHECK_OUT")} disabled={Boolean(transitioning)}>{transitioning === "CHECK_OUT" ? "…" : t.checkOut}</button></div> : null}</div> : null}</section>;
}

function parseQrPayload(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return { reference: "", token: "" };
  try {
    const parsed = JSON.parse(trimmed) as { reference?: string; token?: string };
    return { reference: parsed.reference?.trim() ?? "", token: parsed.token?.trim() ?? "" };
  } catch {
    return { reference: "", token: "" };
  }
}
