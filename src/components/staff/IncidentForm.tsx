"use client";

import { useState } from "react";
import { FileWarning } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { getCopy } from "@/lib/i18n";
import { isSupabaseConfigured } from "@/lib/supabase/client";

export function IncidentForm({ locale }: { locale: Locale }) {
  const t = getCopy(locale);
  const [message, setMessage] = useState("");
  return <section><p className="eyebrow">{t.staff}</p><h1 className="page-title">{t.reportIncident}</h1><p className="page-subtitle">{t.operationalData}</p><form className="form-card" style={{ marginTop: 24 }} onSubmit={(event) => { event.preventDefault(); setMessage(isSupabaseConfigured() ? t.operationalData : `${t.accountNotConfigured} / ${t.accountNotConfiguredEn}`); }}><div className="empty-icon"><FileWarning size={25} /></div><div className="form-group"><label htmlFor="incident-category">{t.category}</label><select className="form-control" id="incident-category" defaultValue="vehicle"><option value="vehicle">{locale === "th" ? "ปัญหารถ" : "Vehicle problem"}</option><option value="wrong">{locale === "th" ? "จอดผิดพื้นที่" : "Wrong parking"}</option><option value="obstacle">{locale === "th" ? "สิ่งกีดขวาง" : "Obstacle"}</option><option value="accident">{locale === "th" ? "อุบัติเหตุ" : "Accident"}</option><option value="qr">{locale === "th" ? "ปัญหาเกี่ยวกับ QR Code" : "QR code issue"}</option></select></div><div className="form-group"><label htmlFor="incident-notes">{t.notes}</label><textarea className="form-control" id="incident-notes" rows={5} style={{ paddingTop: 12 }} required /></div><div className="form-group"><label htmlFor="incident-image">{locale === "th" ? "ภาพประกอบ (ถ้ามี)" : "Image (optional)"}</label><input className="form-control" id="incident-image" type="file" accept="image/*" /></div>{message ? <div className="form-note" role="status">{message}</div> : null}<button className="primary-button" type="submit">{t.submitReport}</button></form></section>;
}
