"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, CheckCircle2, CircleAlert, Info, LockKeyhole, RefreshCw } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { getCopy } from "@/lib/i18n";
import type { ParkingArea, SlotMode } from "@/lib/parking/demo-data";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { AuthAwareLink } from "@/components/auth/AuthAwareLink";
import { useNotifications } from "@/components/layout/NotificationProvider";
import { useFeatureFlag } from "@/lib/feature-flags";

type SlotAvailability = "AVAILABLE" | "RESERVED" | "OCCUPIED" | "CLOSED";
type SlotType = "CAR" | "MOTORCYCLE" | "PICKUP" | "VAN" | "EV" | "OTHER" | "ANY";

type ParkingSlot = {
  id: string;
  slot_code: string;
  row_label: string;
  position: number;
  slot_type: string;
  availability: SlotAvailability;
};

type SlotResponse = Partial<ParkingSlot> & { operational_status?: string };

const statusIcon = {
  AVAILABLE: CheckCircle2,
  RESERVED: CircleAlert,
  OCCUPIED: CircleAlert,
  CLOSED: LockKeyhole,
};

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

function todayString() {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${today.getFullYear()}-${month}-${day}`;
}

function getCurrentTimeStr() {
  const d = new Date();
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function getSafeInitialTimes(targetDate?: string) {
  const today = todayString();
  const isToday = !targetDate || targetDate === today;

  if (!isToday) {
    return { start: "09:00", end: "12:00" };
  }

  const now = new Date();
  const mins = now.getMinutes();
  const roundedMins = Math.ceil((mins + 5) / 15) * 15;
  now.setMinutes(roundedMins);
  now.setSeconds(0);

  const startH = now.getHours();
  const startM = now.getMinutes();
  const start = `${String(startH).padStart(2, "0")}:${String(startM).padStart(2, "0")}`;

  const endD = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  let endH = endD.getHours();
  let endM = endD.getMinutes();
  if (endD.getDate() !== now.getDate() || endH >= 24) {
    endH = 23;
    endM = 59;
  }
  const end = `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;
  return { start, end: end > start ? end : "23:59" };
}

export function SlotSelector({ locale, area }: { locale: Locale; area: ParkingArea }) {
  const t = getCopy(locale);
  const [mode, setMode] = useState<SlotMode>(area.slotMode);
  const defaultTimes = getSafeInitialTimes(todayString());
  const [date, setDate] = useState(todayString());
  const [startTime, setStartTime] = useState(defaultTimes.start);
  const [endTime, setEndTime] = useState(defaultTimes.end);
  const [vehicleFilter, setVehicleFilter] = useState<SlotType | "ALL">("ALL");
  const [slots, setSlots] = useState<ParkingSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<ParkingSlot | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const { notify } = useNotifications();

  const configured = isSupabaseConfigured();
  const groupedSlots = useMemo(() => {
    const rows = new Map<string, ParkingSlot[]>();
    for (const slot of slots) {
      if (vehicleFilter !== "ALL" && slot.slot_type !== vehicleFilter && slot.slot_type !== "ANY") continue;
      rows.set(slot.row_label, [...(rows.get(slot.row_label) ?? []), slot]);
    }
    // Always sort rows alphabetically from A to Z: A, B, C, D, E, F, G...
    const sortedEntries = [...rows.entries()].sort(([rowA], [rowB]) =>
      rowA.localeCompare(rowB, undefined, { numeric: true, sensitivity: "base" })
    );
    // Always sort slots within each row by position/code: 01, 02, 03...
    for (const [, rowSlots] of sortedEntries) {
      rowSlots.sort((a, b) => {
        if (a.position !== b.position) return a.position - b.position;
        return a.slot_code.localeCompare(b.slot_code, undefined, { numeric: true, sensitivity: "base" });
      });
    }
    return sortedEntries;
  }, [slots, vehicleFilter]);

  useEffect(() => {
    let active = true;
    async function loadLiveMode() {
      if (!configured) return;
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase.from("parking_areas").select("slot_mode").eq("code", area.code).maybeSingle();
      if (active && (data?.slot_mode === "INDIVIDUAL_SLOT" || data?.slot_mode === "AREA_ONLY")) setMode(data.slot_mode);
    }
    void loadLiveMode();
    return () => { active = false; };
  }, [area.code, configured]);

  useEffect(() => {
    if (!configured || mode !== "INDIVIDUAL_SLOT") return;
    void refreshSlots();
    // refreshSlots reads the current date/time fields and is intentionally run when the live mode becomes available.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configured, mode]);

  function handleDateChange(newDate: string) {
    const today = todayString();
    if (newDate < today) {
      notify({
        title: locale === "th" ? "วันที่ไม่ถูกต้อง" : "Invalid Date",
        message: locale === "th" ? "ไม่สามารถเลือกวันที่ในอดีตได้ (เลือกวันนี้หรือล่วงหน้าเท่านั้น)" : "Cannot select a past date. Choose today or future dates.",
        kind: "warning",
      });
      setDate(today);
      const safe = getSafeInitialTimes(today);
      setStartTime(safe.start);
      setEndTime(safe.end);
      return;
    }
    setDate(newDate);
    if (newDate === today) {
      const current = getCurrentTimeStr();
      if (startTime < current) {
        const safe = getSafeInitialTimes(today);
        setStartTime(safe.start);
        setEndTime(safe.end);
      }
    }
  }

  function handleStartTimeChange(newStart: string) {
    if (date === todayString()) {
      const current = getCurrentTimeStr();
      if (newStart < current) {
        notify({
          title: locale === "th" ? "เวลาไม่ถูกต้อง" : "Invalid Time",
          message: locale === "th" ? "เวลาเริ่มต้นได้ผ่านไปแล้ว ไม่สามารถเลือกเวลาย้อนหลังได้" : "Start time has already passed. Cannot choose past time.",
          kind: "warning",
        });
        const safe = getSafeInitialTimes(todayString());
        setStartTime(safe.start);
        if (endTime <= safe.start) {
          setEndTime(safe.end);
        }
        return;
      }
    }
    setStartTime(newStart);
    if (endTime <= newStart) {
      const [h, m] = newStart.split(":").map(Number);
      const nextH = Math.min(23, h + 2);
      const nextEnd = `${String(nextH).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      setEndTime(nextEnd > newStart ? nextEnd : "23:59");
    }
  }

  function handleEndTimeChange(newEnd: string) {
    if (newEnd <= startTime) {
      notify({
        title: locale === "th" ? "เวลาไม่ถูกต้อง" : "Invalid Time Range",
        message: locale === "th" ? "เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่มต้น (ห้ามเลือกเวลาย้อนกลับ)" : "End time must be after start time.",
        kind: "warning",
      });
    }
    setEndTime(newEnd);
  }

  async function refreshSlots(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setMessage("");
    setSelectedSlot(null);
    if (mode !== "INDIVIDUAL_SLOT") {
      setMessage(t.noSlotsConfigured);
      notify({ title: t.noSlotsConfigured, kind: "warning" });
      return;
    }
    if (!configured) {
      setMessage(t.accountNotConfigured);
      notify({ title: t.accountNotConfigured, message: t.accountNotConfiguredEn, kind: "error", duration: 8000 });
      return;
    }
    if (!date) {
      setMessage(t.selectDate);
      notify({ title: t.selectDate, kind: "warning" });
      return;
    }
    const today = todayString();
    if (date < today) {
      const pastMsg = locale === "th" ? "ไม่สามารถเลือกวันที่ในอดีตได้ (เลือกวันนี้หรือล่วงหน้าเท่านั้น)" : "Cannot select a past date.";
      setMessage(pastMsg);
      notify({ title: locale === "th" ? "วันที่ไม่ถูกต้อง" : "Invalid Date", message: pastMsg, kind: "warning" });
      return;
    }
    if (endTime <= startTime) {
      const revMsg = locale === "th" ? "เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่มต้น (ห้ามเลือกเวลาย้อนกลับ)" : "End time must be after start time";
      setMessage(revMsg);
      notify({ title: locale === "th" ? "เวลาไม่ถูกต้อง" : "Invalid Time Range", message: revMsg, kind: "warning" });
      return;
    }
    if (date === today) {
      const current = getCurrentTimeStr();
      if (startTime < current) {
        const timeMsg = locale === "th" ? "เวลาเริ่มต้นได้ผ่านไปแล้ว ไม่สามารถเลือกเวลาย้อนหลังได้" : "Start time has already passed. Cannot choose past time.";
        setMessage(timeMsg);
        notify({ title: locale === "th" ? "เวลาไม่ถูกต้อง" : "Invalid Time", message: timeMsg, kind: "warning" });
        return;
      }
      if (endTime <= current) {
        const timeMsg = locale === "th" ? "ช่วงเวลาที่เลือกได้ผ่านไปแล้ว กรุณาเลือกช่วงเวลาใหม่" : "Selected time has already passed";
        setMessage(timeMsg);
        notify({ title: locale === "th" ? "เวลาไม่ถูกต้อง" : "Invalid Time", message: timeMsg, kind: "warning" });
        return;
      }
    }
    setLoading(true);
    try {
      // 1. If viewing today's current operations, fetch from authoritative live capacity API
      if (date === todayString()) {
        try {
          const res = await fetch(`/api/parking/live-capacity?area=${encodeURIComponent(area.code)}`);
          if (res.ok) {
            const json = await res.json();
            if (Array.isArray(json.slots) && json.slots.length > 0) {
              const liveSlots: ParkingSlot[] = json.slots.map((slot: {
                id: string;
                slot_code: string;
                row_label: string;
                position?: number;
                slot_type?: string;
                availability?: SlotAvailability;
              }) => ({
                id: slot.id,
                slot_code: slot.slot_code,
                row_label: slot.row_label,
                position: slot.position ?? 0,
                slot_type: slot.slot_type ?? "CAR",
                availability: slot.availability ?? "AVAILABLE",
              }));
              liveSlots.sort((a, b) => {
                const rowCmp = a.row_label.localeCompare(b.row_label, undefined, { numeric: true, sensitivity: "base" });
                if (rowCmp !== 0) return rowCmp;
                if (a.position !== b.position) return a.position - b.position;
                return a.slot_code.localeCompare(b.slot_code, undefined, { numeric: true, sensitivity: "base" });
              });
              setSlots(liveSlots);
              setLoading(false);
              return;
            }
          }
        } catch {
          // Fallback to RPC
        }
      }

      // 2. Query Supabase RPC for future/custom date-times
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase.rpc("get_available_parking_slots", {
        p_area_code: area.code,
        p_starts_at: `${date}T${startTime}:00+07:00`,
        p_ends_at: `${date}T${endTime}:00+07:00`,
      });
      if (error) throw error;
      const nextSlots = ((data ?? []) as SlotResponse[])
        .filter((slot) => slot.id && slot.slot_code && slot.row_label && slot.availability)
        .map((slot) => ({
          id: slot.id as string,
          slot_code: slot.slot_code as string,
          row_label: slot.row_label as string,
          position: slot.position ?? 0,
          slot_type: slot.slot_type ?? "CAR",
          availability: slot.availability as SlotAvailability,
        }));
      nextSlots.sort((a, b) => {
        const rowCmp = a.row_label.localeCompare(b.row_label, undefined, { numeric: true, sensitivity: "base" });
        if (rowCmp !== 0) return rowCmp;
        if (a.position !== b.position) return a.position - b.position;
        return a.slot_code.localeCompare(b.slot_code, undefined, { numeric: true, sensitivity: "base" });
      });
      setSlots(nextSlots);
      if (!nextSlots.length) setMessage(t.noSlotsConfigured);
    } catch (error) {
      const detail = error instanceof Error ? error.message : t.operationalData;
      setMessage(detail);
      notify({ title: t.operationalData, message: detail, kind: "error", duration: 8000 });
    } finally {
      setLoading(false);
    }
  }

  const slotStats = useMemo(() => {
    let avail = 0;
    let res = 0;
    let occ = 0;
    let cls = 0;
    for (const s of slots) {
      if (s.availability === "AVAILABLE") avail++;
      else if (s.availability === "RESERVED") res++;
      else if (s.availability === "OCCUPIED") occ++;
      else cls++;
    }
    return { total: slots.length, avail, res, occ, cls };
  }, [slots]);

  if (mode !== "INDIVIDUAL_SLOT") {
    return (
      <section className="slot-panel" aria-label={t.areaOnly}>
        <div className="slot-panel-heading"><Info size={20} /><div><strong>{t.areaOnly}</strong><span>{t.noSlotsConfigured}</span></div></div>
        <p className="form-note">{t.noSlotsConfigured}</p>
        <Link className="primary-button" href={`/${locale}/app/bookings/new?area=${area.id}`}>{t.reserveArea}</Link>
      </section>
    );
  }

  return (
    <section className="slot-panel" aria-label={t.slotAvailability}>
      <div className="slot-panel-heading"><CalendarDays size={20} /><div><strong>{t.selectSlot}</strong><span>{t.slotAvailabilityNote}</span></div></div>
      <form className="slot-filter-form" onSubmit={refreshSlots}>
        <div className="form-group"><label htmlFor="slot-date">{t.selectDate}</label><input className="form-control" id="slot-date" type="date" min={todayString()} value={date} onChange={(event) => handleDateChange(event.target.value)} required /></div>
        <div className="slot-time-fields"><div className="form-group"><label htmlFor="slot-start">{t.startTime}</label><input className="form-control" id="slot-start" type="time" min={date === todayString() ? getCurrentTimeStr() : undefined} value={startTime} onChange={(event) => handleStartTimeChange(event.target.value)} required /></div><div className="form-group"><label htmlFor="slot-end">{t.endTime}</label><input className="form-control" id="slot-end" type="time" min={startTime} value={endTime} onChange={(event) => handleEndTimeChange(event.target.value)} required /></div></div>
        <div className="form-group"><label htmlFor="slot-vehicle-filter">{t.vehicleType}</label><select className="form-control" id="slot-vehicle-filter" value={vehicleFilter} onChange={(event) => setVehicleFilter(event.target.value as SlotType | "ALL")}><option value="ALL">{t.all}</option>{(["CAR", "MOTORCYCLE", "PICKUP", "VAN", "EV", "OTHER"] as SlotType[]).map((value) => <option value={value} key={value}>{slotTypeLabel(locale, value)}</option>)}</select></div>
        <button className="secondary-button" type="submit" disabled={loading}>{loading ? "…" : <><RefreshCw size={15} />{t.refreshAvailability}</>}</button>
      </form>
      <div className="slot-legend" aria-label={t.slotAvailability}><span className="slot-legend-item available"><i />{t.available}</span><span className="slot-legend-item reserved"><i />{t.reserved}</span><span className="slot-legend-item occupied"><i />{t.occupied}</span><span className="slot-legend-item closed"><i />{t.closed}</span></div>
      {slots.length ? (
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", fontSize: 13, fontWeight: 700, margin: "10px 0 6px" }}>
          <span>{locale === "th" ? `ทั้งหมด ${slotStats.total}` : `Total ${slotStats.total}`}</span>
          <span style={{ color: "#16a34a" }}>· {locale === "th" ? `ว่าง ${slotStats.avail}` : `Free ${slotStats.avail}`}</span>
          {slotStats.res > 0 ? <span style={{ color: "#ca8a04" }}>· {locale === "th" ? `จองแล้ว ${slotStats.res}` : `Reserved ${slotStats.res}`}</span> : null}
          {slotStats.occ > 0 ? <span style={{ color: "#2563eb" }}>· {locale === "th" ? `กำลังจอด ${slotStats.occ}` : `Parked ${slotStats.occ}`}</span> : null}
          {slotStats.cls > 0 ? <span style={{ color: "#dc2626" }}>· {locale === "th" ? `ปิด ${slotStats.cls}` : `Closed ${slotStats.cls}`}</span> : null}
        </div>
      ) : null}
      {message ? <div className="form-note" role="status">{message}</div> : null}
      {slots.length ? <div className="status-note live-slot-note"><Info size={15} /><span>{t.realSlotStatusNote} · {vehicleFilter === "ALL" ? t.all : slotTypeLabel(locale, vehicleFilter)}</span></div> : null}
      {!configured ? <div className="slot-empty"><Info size={22} /><strong>{t.setupRequired}</strong><span>{t.operationalData}</span></div> : null}
      {configured && !slots.length && !message ? <div className="slot-empty"><Info size={22} /><strong>{t.slotDataPending}</strong><span>{t.noSlotsConfigured}</span></div> : null}
      {groupedSlots.length ? <div className="slot-rows">{groupedSlots.map(([row, rowSlots]) => <div className="slot-row" key={row}><span className="slot-row-label">{row}</span><div className="slot-cells">{rowSlots.map((slot) => { const Icon = statusIcon[slot.availability]; const available = slot.availability === "AVAILABLE"; return <button className={`slot-cell ${slot.availability.toLowerCase()} ${selectedSlot?.id === slot.id ? "selected" : ""}`} type="button" key={slot.id} disabled={!available} onClick={() => setSelectedSlot(slot)} aria-pressed={selectedSlot?.id === slot.id} aria-label={`${slot.slot_code} · ${slotTypeLabel(locale, slot.slot_type)} · ${slot.availability}`}><Icon size={15} /><strong>{slot.slot_code}</strong><span>{slotTypeLabel(locale, slot.slot_type)} · {slot.availability === "AVAILABLE" ? t.available : slot.availability === "RESERVED" ? t.reserved : slot.availability === "OCCUPIED" ? t.occupied : t.closed}</span></button>; })}</div></div>)}</div> : null}
      <div className="slot-selection-footer"><div><span>{t.selectedSlot}</span><strong>{selectedSlot?.slot_code ?? "—"}</strong></div>{selectedSlot ? <AuthAwareLink className="primary-button" locale={locale} target={`/${locale}/app/bookings/new?area=${area.id}&slot=${encodeURIComponent(selectedSlot.id)}&slotCode=${encodeURIComponent(selectedSlot.slot_code)}&slotType=${encodeURIComponent(selectedSlot.slot_type)}&date=${date}&start=${startTime}&end=${endTime}`}>{t.confirm}</AuthAwareLink> : <button className="primary-button" type="button" disabled>{t.confirm}</button>}</div>
    </section>
  );
}
