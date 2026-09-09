"use client";

import { useState } from "react";
import { Camera, CheckCircle2, QrCode, Search, ShieldAlert } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { getCopy } from "@/lib/i18n";
import { isSupabaseConfigured } from "@/lib/supabase/client";

export function StaffScanner({ locale }: { locale: Locale }) {
  const t = getCopy(locale);
  const [reference, setReference] = useState("");
  const [message, setMessage] = useState("");
  const [validating, setValidating] = useState(false);

  async function validate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setValidating(true);
    setMessage(isSupabaseConfigured() ? t.operationalData : `${t.accountNotConfigured} / ${t.accountNotConfiguredEn}`);
    window.setTimeout(() => setValidating(false), 350);
  }

  return <section><div className="dashboard-header"><div><p className="eyebrow">{t.staff}</p><h1 className="page-title">{t.scanQr}</h1><p className="page-subtitle">{locale === "th" ? "สแกน QR → ตรวจสอบข้อมูลรถ → ยืนยัน Check-in" : "Scan QR → verify vehicle details → confirm Check-in"}</p></div></div><div className="info-card" style={{ marginTop: 24, padding: 22, textAlign: "center" }}><div className="empty-icon" style={{ margin: "0 auto 15px", width: 76, height: 76 }}><QrCode size={39} /></div><h2 style={{ margin: 0, fontSize: 20 }}>{t.camera}</h2><p className="page-subtitle">{t.cameraPending}</p><button className="primary-button" style={{ marginTop: 16 }} type="button" onClick={() => setMessage(t.cameraPending)}><Camera size={17} />{t.camera}</button></div><form className="form-card" style={{ marginTop: 16 }} onSubmit={validate}><h2 style={{ margin: 0, fontSize: 18 }}>{t.manualLookup}</h2><p>{locale === "th" ? "ใช้ Booking Reference, QR Reference หรือทะเบียนรถ" : "Use a Booking Reference, QR Reference, or license plate."}</p><div className="form-group"><label htmlFor="staff-reference">{t.manualLookup}</label><div className="search-box"><Search size={17} color="#89919b" /><input id="staff-reference" className="form-control" style={{ minHeight: "auto", padding: 0, border: 0, background: "transparent", boxShadow: "none" }} value={reference} onChange={(event) => setReference(event.target.value)} required /></div></div>{message ? <div className="form-note" role="status"><ShieldAlert size={14} style={{ verticalAlign: "-2px" }} /> {message}</div> : null}<button className="primary-button" type="submit" disabled={validating}><CheckCircle2 size={16} />{validating ? "…" : t.scanResult}</button></form></section>;
}
