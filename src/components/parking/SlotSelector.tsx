"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, CheckCircle2, CircleAlert, Info, LockKeyhole, RefreshCw } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { getCopy } from "@/lib/i18n";
import type { ParkingArea, SlotMode } from "@/lib/parking/demo-data";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

type SlotAvailability = "AVAILABLE" | "RESERVED" | "OCCUPIED" | "CLOSED";

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

const mockupRows = Array.from({ length: 7 }, (_, rowIndex) => {
  const label = String.fromCharCode(65 + rowIndex);
  const count = rowIndex < 2 ? 15 : 14;
  return {
    label,
    slots: Array.from({ length: count }, (_, position) => `${label}-${String(position + 1).padStart(2, "0")}`),
  };
});

function MockupSlotLayout({ locale }: { locale: Locale }) {
  const t = getCopy(locale);
  return <div className="mockup-layout" aria-label={t.prototypeSlotTitle}>
    <div className="mockup-note"><Info size={15} /><span><strong>{t.prototypeSlotTitle}</strong> — {t.mockupLayoutNote}</span></div>
    <div className="mockup-layout-summary"><span>{t.area}: A–G</span><strong>100 {locale === "th" ? "ช่อง" : "spaces"}</strong><span>{t.realSlotStatusNote}</span></div>
    <div className="slot-rows prototype-slot-rows">
      {mockupRows.map((row) => <div className="slot-row" key={row.label}><span className="slot-row-label">{row.label}</span><div className="slot-cells mockup-slot-cells">{row.slots.map((code) => <span className="slot-cell prototype mockup-slot-cell" key={code}><strong>{code}</strong><span>{t.sampleData}</span></span>)}</div></div>)}
    </div>
  </div>;
}

function todayString() {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${today.getFullYear()}-${month}-${day}`;
}

export function SlotSelector({ locale, area }: { locale: Locale; area: ParkingArea }) {
  const t = getCopy(locale);
  const [mode, setMode] = useState<SlotMode>(area.slotMode);
  const [date, setDate] = useState(todayString());
  const [startTime, setStartTime] = useState("10:00");
  const [endTime, setEndTime] = useState("13:00");
  const [slots, setSlots] = useState<ParkingSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<ParkingSlot | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const configured = isSupabaseConfigured();
  const groupedSlots = useMemo(() => {
    const rows = new Map<string, ParkingSlot[]>();
    for (const slot of slots) rows.set(slot.row_label, [...(rows.get(slot.row_label) ?? []), slot]);
    return [...rows.entries()];
  }, [slots]);

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

  async function refreshSlots(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setMessage("");
    setSelectedSlot(null);
    if (mode !== "INDIVIDUAL_SLOT") {
      setMessage(t.noSlotsConfigured);
      return;
    }
    if (!configured) {
      setMessage(`${t.accountNotConfigured} / ${t.accountNotConfiguredEn}`);
      return;
    }
    if (!date) {
      setMessage(t.selectDate);
      return;
    }
    if (endTime <= startTime) {
      setMessage(t.endTime);
      return;
    }
    setLoading(true);
    try {
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
      setSlots(nextSlots);
      if (!nextSlots.length) setMessage(t.noSlotsConfigured);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t.operationalData);
    } finally {
      setLoading(false);
    }
  }

  if (mode !== "INDIVIDUAL_SLOT") {
    return (
      <section className="slot-panel" aria-label={t.areaOnly}>
        <div className="slot-panel-heading"><Info size={20} /><div><strong>{area.prototypeSlotGrid ? t.prototypeSlotTitle : t.areaOnly}</strong><span>{area.prototypeSlotGrid ? t.mockupLayoutNote : t.slotDataPending}</span></div></div>
        {area.prototypeSlotGrid ? <MockupSlotLayout locale={locale} /> : null}
        <p className="form-note">{t.noSlotsConfigured}</p>
        <Link className="primary-button" href={`/${locale}/app/bookings/new?area=${area.id}`}>{t.reserveArea}</Link>
      </section>
    );
  }

  return (
    <section className="slot-panel" aria-label={t.slotAvailability}>
      <div className="slot-panel-heading"><CalendarDays size={20} /><div><strong>{t.selectSlot}</strong><span>{t.slotAvailabilityNote}</span></div></div>
      <form className="slot-filter-form" onSubmit={refreshSlots}>
        <div className="form-group"><label htmlFor="slot-date">{t.selectDate}</label><input className="form-control" id="slot-date" type="date" min={todayString()} value={date} onChange={(event) => setDate(event.target.value)} required /></div>
        <div className="slot-time-fields"><div className="form-group"><label htmlFor="slot-start">{t.startTime}</label><input className="form-control" id="slot-start" type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} required /></div><div className="form-group"><label htmlFor="slot-end">{t.endTime}</label><input className="form-control" id="slot-end" type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} required /></div></div>
        <button className="secondary-button" type="submit" disabled={loading}>{loading ? "…" : <><RefreshCw size={15} />{t.refreshAvailability}</>}</button>
      </form>
      <div className="slot-legend" aria-label={t.slotAvailability}><span className="slot-legend-item available"><i />{t.available}</span><span className="slot-legend-item reserved"><i />{t.reserved}</span><span className="slot-legend-item occupied"><i />{t.occupied}</span><span className="slot-legend-item closed"><i />{t.closed}</span></div>
      {message ? <div className="form-note" role="status">{message}</div> : null}
      {!slots.length ? <MockupSlotLayout locale={locale} /> : <div className="mockup-note live-slot-note"><Info size={15} /><span>{t.realSlotStatusNote}</span></div>}
      {!configured ? <div className="slot-empty"><Info size={22} /><strong>{t.setupRequired}</strong><span>{t.operationalData}</span></div> : null}
      {configured && !slots.length && !message ? <div className="slot-empty"><Info size={22} /><strong>{t.slotDataPending}</strong><span>{t.noSlotsConfigured}</span></div> : null}
      {groupedSlots.length ? <div className="slot-rows">{groupedSlots.map(([row, rowSlots]) => <div className="slot-row" key={row}><span className="slot-row-label">{row}</span><div className="slot-cells">{rowSlots.map((slot) => { const Icon = statusIcon[slot.availability]; const available = slot.availability === "AVAILABLE"; return <button className={`slot-cell ${slot.availability.toLowerCase()} ${selectedSlot?.id === slot.id ? "selected" : ""}`} type="button" key={slot.id} disabled={!available} onClick={() => setSelectedSlot(slot)} aria-pressed={selectedSlot?.id === slot.id}><Icon size={15} /><strong>{slot.slot_code}</strong><span>{slot.availability === "AVAILABLE" ? t.available : slot.availability === "RESERVED" ? t.reserved : slot.availability === "OCCUPIED" ? t.occupied : t.closed}</span></button>; })}</div></div>)}</div> : null}
      <div className="slot-selection-footer"><div><span>{t.selectedSlot}</span><strong>{selectedSlot?.slot_code ?? "—"}</strong></div>{selectedSlot ? <Link className="primary-button" href={`/${locale}/app/bookings/new?area=${area.id}&slot=${encodeURIComponent(selectedSlot.id)}&slotCode=${encodeURIComponent(selectedSlot.slot_code)}&date=${date}&start=${startTime}&end=${endTime}`}>{t.confirm}</Link> : <button className="primary-button" type="button" disabled>{t.confirm}</button>}</div>
    </section>
  );
}
