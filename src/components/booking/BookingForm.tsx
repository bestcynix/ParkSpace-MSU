"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CalendarDays, Car, Clock3, ShieldCheck } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { getCopy } from "@/lib/i18n";
import type { ParkingArea } from "@/lib/parking/demo-data";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

type BookingVehicle = {
  id: string;
  plate: string;
  province: string | null;
  vehicle_type: string;
  brand: string | null;
  model: string | null;
  color: string | null;
  usage_type: "PERSONAL" | "ONE_DAY";
};

export function BookingForm({ locale, area, selectedSlot, initialDate, initialStartTime, initialEndTime }: { locale: Locale; area: ParkingArea; selectedSlot?: { id: string; code: string }; initialDate?: string; initialStartTime?: string; initialEndTime?: string }) {
  const t = getCopy(locale);
  const [date, setDate] = useState(initialDate ?? "");
  const [startTime, setStartTime] = useState(initialStartTime ?? "10:00");
  const [endTime, setEndTime] = useState(initialEndTime ?? "13:00");
  const [vehicle, setVehicle] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [vehicles, setVehicles] = useState<BookingVehicle[]>([]);
  const [loadingVehicles, setLoadingVehicles] = useState(false);
  const [acceptRules, setAcceptRules] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const title = locale === "th" ? area.th : area.en;

  useEffect(() => {
    let active = true;
    async function loadVehicles() {
      if (!isSupabaseConfigured()) return;
      setLoadingVehicles(true);
      try {
        const supabase = createSupabaseBrowserClient();
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) return;
        const { data, error } = await supabase.from("vehicles").select("id, plate, province, vehicle_type, brand, model, color, usage_type, is_default").order("is_default", { ascending: false }).order("created_at", { ascending: false });
        if (error) throw error;
        if (!active) return;
        const nextVehicles = (data ?? []) as (BookingVehicle & { is_default: boolean })[];
        setVehicles(nextVehicles);
        const defaultVehicle = nextVehicles.find((item) => item.is_default) ?? nextVehicles[0];
        if (defaultVehicle) {
          setVehicleId(defaultVehicle.id);
          setVehicle(defaultVehicle.plate);
        }
      } catch {
        if (active) setVehicles([]);
      } finally {
        if (active) setLoadingVehicles(false);
      }
    }
    void loadVehicles();
    return () => { active = false; };
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (!acceptRules) {
      setMessage(t.parkingRules);
      return;
    }
    if (!isSupabaseConfigured()) {
      setMessage(`${t.accountNotConfigured} / ${t.accountNotConfiguredEn}`);
      return;
    }
    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) {
        setMessage(t.signInRequired);
        return;
      }
      const { data: dbArea, error: areaError } = await supabase.from("parking_areas").select("id").eq("code", area.code).single();
      if (areaError || !dbArea) {
        setMessage(t.operationalData);
        return;
      }
      const selectedVehicle = vehicles.find((item) => item.id === vehicleId);
      const { error } = await supabase.from("bookings").insert({
        user_id: userData.user.id,
        parking_area_id: dbArea.id,
        booking_date: date,
        parking_slot_id: selectedSlot?.id ?? null,
        vehicle_id: selectedVehicle?.id ?? null,
        starts_at: `${date}T${startTime}:00+07:00`,
        ends_at: `${date}T${endTime}:00+07:00`,
        vehicle_snapshot: selectedVehicle ? { plate: selectedVehicle.plate, province: selectedVehicle.province, vehicle_type: selectedVehicle.vehicle_type, brand: selectedVehicle.brand, model: selectedVehicle.model, color: selectedVehicle.color, usage_type: selectedVehicle.usage_type } : { plate: vehicle, source: "MANUAL_ENTRY" },
        booking_mode: selectedSlot ? "INDIVIDUAL_SLOT" : area.slotMode,
        status: "PENDING",
      });
      if (error) throw error;
      setSuccess(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Booking failed");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return <div className="form-card"><div className="empty-icon" style={{ margin: "0 auto 15px" }}><ShieldCheck size={28} /></div><h1 style={{ textAlign: "center" }}>{locale === "th" ? "ส่งคำขอจองสำเร็จ" : "Booking request submitted"}</h1><p style={{ textAlign: "center" }}>{t.bookingReadySub}</p><div className="form-note">{t.bookingReference}: {locale === "th" ? "ระบบจะสร้างหลังยืนยัน" : "Generated after confirmation"}<br />{t.qrPass}: {t.comingSoon}</div><Link className="primary-button" href={`/${locale}/app/bookings`}>{t.bookings}</Link></div>;
  }

  return (
    <form className="form-card" onSubmit={submit}>
      <div className="inline-actions"><span className="data-badge">{area.code}</span><span className="mockup-badge">{selectedSlot ? `${t.individualSlot} · ${selectedSlot.code}` : t.areaOnly}</span></div>
      <h1 style={{ marginTop: 13 }}>{t.bookingSummary}</h1>
      <p>{title} · {t.realDataNote}</p>
      <div className="form-group"><label htmlFor="date"><CalendarDays size={13} style={{ verticalAlign: "-2px" }} /> {t.selectDate}</label><input className="form-control" id="date" type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}><div className="form-group"><label htmlFor="start"><Clock3 size={13} style={{ verticalAlign: "-2px" }} /> {t.startTime}</label><input className="form-control" id="start" type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} required /></div><div className="form-group"><label htmlFor="end">{t.endTime}</label><input className="form-control" id="end" type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} required /></div></div>
      <div className="form-group"><label htmlFor="vehicle-choice"><Car size={13} style={{ verticalAlign: "-2px" }} /> {t.chooseVehicle}</label>{isSupabaseConfigured() ? <select className="form-control" id="vehicle-choice" value={vehicleId} onChange={(event) => { const nextId = event.target.value; setVehicleId(nextId); const nextVehicle = vehicles.find((item) => item.id === nextId); setVehicle(nextVehicle?.plate ?? ""); }}><option value="">{loadingVehicles ? "…" : vehicles.length ? t.addVehicle : t.vehicleDataNote}</option>{vehicles.map((item) => <option value={item.id} key={item.id}>{item.plate}{item.province ? ` · ${item.province}` : ""}{item.usage_type === "ONE_DAY" ? ` · ${t.oneDayVehicle}` : ""}</option>)}</select> : null}<input className="form-control" id="vehicle" placeholder={t.vehiclePlate} value={vehicle} onChange={(event) => { const nextPlate = event.target.value; setVehicle(nextPlate); if (vehicles.find((item) => item.id === vehicleId)?.plate !== nextPlate) setVehicleId(""); }} required />{isSupabaseConfigured() ? <Link className="text-link" href={`/${locale}/app/profile/vehicles`}>{t.addVehicle}</Link> : null}</div>
      <label style={{ display: "flex", alignItems: "start", gap: 9, marginTop: 20, color: "#59636e", fontSize: 12, lineHeight: 1.5 }}><input type="checkbox" checked={acceptRules} onChange={(event) => setAcceptRules(event.target.checked)} required />{t.parkingRules}</label>
      {message ? <div className="form-note" role="alert">{message}</div> : null}
      <button className="primary-button" type="submit" disabled={loading}>{loading ? "…" : t.confirm}</button>
      <Link className="secondary-button" href={`/${locale}/parking/${area.id}`}>{t.back}</Link>
    </form>
  );
}
