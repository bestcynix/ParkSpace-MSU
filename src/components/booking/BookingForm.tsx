"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CalendarDays, Car, Clock3, ShieldCheck } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { getCopy } from "@/lib/i18n";
import type { ParkingArea } from "@/lib/parking/demo-data";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { QrPass } from "@/components/booking/QrPass";
import { useNotifications } from "@/components/layout/NotificationProvider";
import { getFeatureFlag } from "@/lib/feature-flags";

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

type VehicleType = "CAR" | "MOTORCYCLE" | "PICKUP" | "VAN" | "EV" | "OTHER";

function getTodayString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function BookingForm({ locale, area, selectedSlot, initialDate, initialStartTime, initialEndTime }: { locale: Locale; area: ParkingArea; selectedSlot?: { id: string; code: string; type?: string }; initialDate?: string; initialStartTime?: string; initialEndTime?: string }) {
  const t = getCopy(locale);
  const todayStr = getTodayString();
  const [date, setDate] = useState(initialDate ?? todayStr);
  const [startTime, setStartTime] = useState(initialStartTime ?? "10:00");
  const [endTime, setEndTime] = useState(initialEndTime ?? "13:00");
  const [vehicle, setVehicle] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [vehicleType, setVehicleType] = useState<VehicleType>("CAR");
  const [vehicles, setVehicles] = useState<BookingVehicle[]>([]);
  const [loadingVehicles, setLoadingVehicles] = useState(false);
  const [acceptRules, setAcceptRules] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState<{ reference: string; qrPayload: string | null; expiresAt: string | null } | null>(null);
  const [loading, setLoading] = useState(false);
  const { notify } = useNotifications();
  const title = locale === "th" ? area.th : area.en;

  useEffect(() => {
    let active = true;
    async function loadVehicles() {
      if (!isSupabaseConfigured()) return;
      setLoadingVehicles(true);
      try {
        const supabase = createSupabaseBrowserClient();
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData.session) return;
        const { data, error } = await supabase.from("vehicles").select("id, plate, province, vehicle_type, brand, model, color, usage_type, is_default").order("is_default", { ascending: false }).order("created_at", { ascending: false });
        if (error) throw error;
        if (!active) return;
        const nextVehicles = (data ?? []) as (BookingVehicle & { is_default: boolean })[];
        setVehicles(nextVehicles);
        const defaultVehicle = nextVehicles.find((item) => item.is_default) ?? nextVehicles[0];
        if (defaultVehicle) {
          setVehicleId(defaultVehicle.id);
          setVehicle(defaultVehicle.plate);
          setVehicleType((defaultVehicle.vehicle_type as VehicleType) || "CAR");
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

  const isDirty = Boolean(!success && (vehicle || vehicleId || date !== todayStr || startTime !== (initialStartTime ?? "10:00") || endTime !== (initialEndTime ?? "13:00")));

  useEffect(() => {
    if (!isDirty) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (!acceptRules) {
      setMessage(t.parkingRules);
      notify({ title: t.parkingRules, kind: "warning" });
      return;
    }
    if (!date) {
      setMessage(t.selectDate);
      notify({ title: t.selectDate, kind: "warning" });
      return;
    }
    if (date < todayStr) {
      const pastMsg = locale === "th" ? "ไม่สามารถเลือกวันที่ในอดีตได้" : "Cannot book a date in the past";
      setMessage(pastMsg);
      notify({ title: locale === "th" ? "วันที่ไม่ถูกต้อง" : "Invalid Date", message: pastMsg, kind: "warning" });
      return;
    }
    if (endTime <= startTime) {
      setMessage(t.endTime);
      notify({ title: t.endTime, kind: "warning" });
      return;
    }
    if (date === todayStr) {
      const now = new Date();
      const currentHours = String(now.getHours()).padStart(2, "0");
      const currentMinutes = String(now.getMinutes()).padStart(2, "0");
      const currentTimeStr = `${currentHours}:${currentMinutes}`;
      if (endTime <= currentTimeStr) {
        const timeMsg = locale === "th" ? "ช่วงเวลาที่เลือกได้ผ่านไปแล้ว กรุณาเลือกช่วงเวลาใหม่" : "Selected time has already passed";
        setMessage(timeMsg);
        notify({ title: locale === "th" ? "เวลาไม่ถูกต้อง" : "Invalid Time", message: timeMsg, kind: "warning" });
        return;
      }
    }
    if (!isSupabaseConfigured()) {
      setMessage(t.accountNotConfigured);
      notify({ title: t.accountNotConfigured, message: t.accountNotConfiguredEn, kind: "error", duration: 8000 });
      return;
    }
    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session) {
        setMessage(t.signInRequired);
        notify({ title: t.signInRequired, kind: "warning" });
        return;
      }
      const { data: dbArea, error: areaError } = await supabase.from("parking_areas").select("id").eq("code", area.code).single();
      if (areaError || !dbArea) {
        setMessage(t.operationalData);
        notify({ title: t.operationalData, kind: "error" });
        return;
      }
      const selectedVehicle = vehicles.find((item) => item.id === vehicleId);
      const selectedVehicleType = (selectedVehicle?.vehicle_type as VehicleType | undefined) ?? vehicleType;
      if (selectedSlot?.type && !["ANY", "OTHER"].includes(selectedSlot.type) && selectedSlot.type !== selectedVehicleType) {
        setMessage(t.vehicleSlotMismatch);
        notify({ title: t.vehicleSlotMismatch, message: `${t.slotType}: ${slotTypeLabel(locale, selectedSlot.type)}`, kind: "warning" });
        return;
      }
      let booking: { id: string; reference: string } | null = null;
      let slotIdToUse = selectedSlot?.id ?? null;
      if (!slotIdToUse && getFeatureFlag("auto_slot_allocation")) {
        try {
          const { data: freeSlots } = await supabase.rpc("get_available_parking_slots", {
            p_area_code: area.code,
            p_starts_at: `${date}T${startTime}:00+07:00`,
            p_ends_at: `${date}T${endTime}:00+07:00`,
          });
          const matchingSlot = ((freeSlots ?? []) as Array<{ id: string; availability?: string; slot_type?: string }>).find(
            (s) => s.availability === "AVAILABLE" && (!selectedVehicleType || s.slot_type === "ANY" || s.slot_type === selectedVehicleType)
          );
          if (matchingSlot?.id) {
            slotIdToUse = matchingSlot.id;
          }
        } catch {
          // Fall back gracefully to area booking
        }
      }

      const bookingPayload = {
        parking_area_id: dbArea.id,
        booking_date: date,
        parking_slot_id: slotIdToUse,
        vehicle_id: selectedVehicle?.id ?? null,
        starts_at: `${date}T${startTime}:00+07:00`,
        ends_at: `${date}T${endTime}:00+07:00`,
        vehicle_snapshot: selectedVehicle ? { plate: selectedVehicle.plate, province: selectedVehicle.province, vehicle_type: selectedVehicle.vehicle_type, brand: selectedVehicle.brand, model: selectedVehicle.model, color: selectedVehicle.color, usage_type: selectedVehicle.usage_type } : { plate: vehicle, vehicle_type: selectedVehicleType, source: "MANUAL_ENTRY" },
        booking_mode: slotIdToUse ? "INDIVIDUAL_SLOT" : "AREA_ONLY",
        status: "PENDING",
      };

      const apiRes = await fetch("/api/bookings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify(bookingPayload),
      });

      const apiJson = (await apiRes.json().catch(() => ({}))) as {
        ok?: boolean;
        booking?: { id: string; reference: string };
        qr?: { qr_reference?: string; qr_payload?: string; expires_at?: string };
        error?: string;
      };
      if (!apiRes.ok || !apiJson.booking) {
        throw new Error(apiJson.error || t.bookingFailed);
      }

      const createdBooking = apiJson.booking;
      booking = createdBooking;

      // Extract issued QR payload or fallback to booking reference
      const qrPayload = apiJson.qr?.qr_payload || createdBooking.reference;
      const endsAtDate = new Date(`${date}T${endTime}:00`);
      const expiresAtIso = apiJson.qr?.expires_at || (Number.isNaN(endsAtDate.getTime()) ? null : endsAtDate.toISOString());

      // Ensure QR token exists in background if not already returned
      if (!apiJson.qr) {
        void fetch("/api/bookings/issue-qr", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ booking_id: createdBooking.id }),
        }).catch(() => {});
      }

      setSuccess({ reference: createdBooking.reference, qrPayload, expiresAt: expiresAtIso });
      try {
        sessionStorage.setItem(`parkspace_qr_${createdBooking.id}`, JSON.stringify({
          bookingId: createdBooking.id,
          reference: createdBooking.reference,
          payload: qrPayload,
          expiresAt: expiresAtIso,
        }));
      } catch {
        // ignore
      }
      notify({ title: t.bookingSaved, message: createdBooking.reference, kind: "success", duration: 8000 });
    } catch (error) {
      const detail = error instanceof Error ? error.message : t.bookingFailed;
      setMessage(detail);
      notify({ title: t.bookingFailed, message: detail, kind: "error", duration: 8000 });
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="form-card booking-success-card">
        <div className="empty-icon" style={{ margin: "0 auto 15px" }}><ShieldCheck size={28} /></div>
        <h1 style={{ textAlign: "center" }}>{locale === "th" ? "จองสำเร็จ!" : "Booking successful"}</h1>
        <p style={{ textAlign: "center" }}>{t.qrReady}</p>
        <div className="form-note">{t.bookingReference}: {success.reference}</div>
        <QrPass locale={locale} payload={success.qrPayload} reference={success.reference} expiresAt={success.expiresAt} />
        <div style={{ display: "grid", gap: 8, marginTop: 14 }}>
          <Link className="primary-button" href={`/${locale}/app/bookings/${success.reference}`}>{locale === "th" ? "ดูรายละเอียดการจองนี้" : "View This Booking"}</Link>
          <Link className="secondary-button" href={`/${locale}/app/bookings`}>{t.bookings}</Link>
        </div>
      </div>
    );
  }

  return (
    <form className="form-card" onSubmit={submit}>
      <div className="inline-actions"><span className="data-badge">{area.code}</span><span className="mockup-badge">{selectedSlot ? `${t.individualSlot} · ${selectedSlot.code}` : t.areaOnly}</span></div>
      <h1 style={{ marginTop: 13 }}>{t.bookingSummary}</h1>
      <p>{title} · {locale === "th" ? "มหาวิทยาลัยมหาสารคาม" : "Mahasarakham University"}</p>
      <div className="form-group"><label htmlFor="date"><CalendarDays size={13} style={{ verticalAlign: "-2px" }} /> {t.selectDate}</label><input className="form-control" id="date" type="date" min={todayStr} value={date} onChange={(event) => setDate(event.target.value)} required /></div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}><div className="form-group"><label htmlFor="start"><Clock3 size={13} style={{ verticalAlign: "-2px" }} /> {t.startTime}</label><input className="form-control" id="start" type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} required /></div><div className="form-group"><label htmlFor="end">{t.endTime}</label><input className="form-control" id="end" type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} required /></div></div>
      <div className="form-group"><label htmlFor="vehicle-choice"><Car size={13} style={{ verticalAlign: "-2px" }} /> {t.chooseVehicle}</label>{isSupabaseConfigured() ? <select className="form-control" id="vehicle-choice" value={vehicleId} onChange={(event) => { const nextId = event.target.value; setVehicleId(nextId); const nextVehicle = vehicles.find((item) => item.id === nextId); setVehicle(nextVehicle?.plate ?? ""); setVehicleType((nextVehicle?.vehicle_type as VehicleType) || "CAR"); }}><option value="">{loadingVehicles ? "…" : vehicles.length ? t.addVehicle : t.vehicleDataNote}</option>{vehicles.map((item) => <option value={item.id} key={item.id}>{item.plate}{item.province ? ` · ${item.province}` : ""}{item.usage_type === "ONE_DAY" ? ` · ${t.oneDayVehicle}` : ""}</option>)}</select> : null}<input className="form-control" id="vehicle" placeholder={t.vehiclePlate} value={vehicle} onChange={(event) => { const nextPlate = event.target.value; setVehicle(nextPlate); if (vehicles.find((item) => item.id === vehicleId)?.plate !== nextPlate) setVehicleId(""); }} required /><label htmlFor="booking-vehicle-type">{t.vehicleType}</label><select className="form-control" id="booking-vehicle-type" value={selectedVehicleForType(vehicles, vehicleId)?.vehicle_type ?? vehicleType} onChange={(event) => { setVehicleId(""); setVehicleType(event.target.value as VehicleType); }}><option value="CAR">{t.car}</option><option value="MOTORCYCLE">{t.motorcycle}</option><option value="PICKUP">{t.pickup}</option><option value="VAN">{t.van}</option><option value="EV">{t.ev}</option><option value="OTHER">{t.otherVehicle}</option></select>{selectedSlot?.type ? <small className="field-hint">{t.slotType}: {slotTypeLabel(locale, selectedSlot.type)}</small> : null}{isSupabaseConfigured() ? <Link className="text-link" href={`/${locale}/app/profile/vehicles`}>{t.addVehicle}</Link> : null}</div>
      <label style={{ display: "flex", alignItems: "start", gap: 9, marginTop: 20, color: "#59636e", fontSize: 12, lineHeight: 1.5 }}><input type="checkbox" checked={acceptRules} onChange={(event) => setAcceptRules(event.target.checked)} required />{t.parkingRules}</label>
      {message ? <div className="form-note" role="alert">{message}</div> : null}
      <button className="primary-button" type="submit" disabled={loading}>{loading ? "…" : t.confirm}</button>
      <Link className="secondary-button" href={`/${locale}/parking/${area.id}`}>{t.back}</Link>
    </form>
  );
}

function selectedVehicleForType(vehicles: BookingVehicle[], vehicleId: string) {
  return vehicles.find((vehicle) => vehicle.id === vehicleId);
}

function slotTypeLabel(locale: Locale, value: string) {
  const t = getCopy(locale);
  switch (value) {
    case "CAR": return t.car;
    case "MOTORCYCLE": return t.motorcycle;
    case "PICKUP": return t.pickup;
    case "VAN": return t.van;
    case "EV": return t.ev;
    case "ANY": return t.otherVehicle;
    default: return t.otherVehicle;
  }
}
