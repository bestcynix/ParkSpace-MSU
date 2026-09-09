"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CalendarDays, Car, CircleAlert, Clock3, MapPin, QrCode, RefreshCw } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { getCopy } from "@/lib/i18n";
import { QrPass } from "@/components/booking/QrPass";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

type Booking = {
  id: string;
  reference: string;
  booking_date: string;
  starts_at: string;
  ends_at: string;
  status: string;
  booking_mode: "AREA_ONLY" | "INDIVIDUAL_SLOT";
  parking_area_id: string;
  parking_slot_id: string | null;
  vehicle_snapshot: { plate?: string } | null;
};

type QrRow = { qr_payload?: string; expires_at?: string; qr_reference?: string };

export function BookingsList({ locale }: { locale: Locale }) {
  const t = getCopy(locale);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [areaNames, setAreaNames] = useState<Record<string, { code: string; name: string }>>({});
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [qrLoadingId, setQrLoadingId] = useState("");
  const [qrPass, setQrPass] = useState<{ bookingId: string; reference: string; payload: string | null; expiresAt: string | null } | null>(null);

  const loadBookings = useCallback(async () => {
    const copy = getCopy(locale);
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        setMessage(copy.signInRequired);
        return;
      }
      const { data, error } = await supabase.from("bookings").select("id, reference, booking_date, starts_at, ends_at, status, booking_mode, parking_area_id, parking_slot_id, vehicle_snapshot").order("created_at", { ascending: false });
      if (error) throw error;
      setBookings((data ?? []) as Booking[]);
      const { data: areas } = await supabase.from("parking_areas").select("id, code, name_th, name_en");
      setAreaNames(Object.fromEntries(((areas ?? []) as Array<{ id: string; code: string; name_th: string; name_en: string }>).map((area) => [area.id, { code: area.code, name: locale === "th" ? area.name_th : area.name_en }])));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : copy.operationalData);
    } finally {
      setLoading(false);
    }
  }, [locale]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadBookings(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadBookings]);

  async function showQr(booking: Booking) {
    setMessage("");
    setQrLoadingId(booking.id);
    try {
      const { data, error } = await createSupabaseBrowserClient().rpc("issue_booking_qr", { p_booking_id: booking.id });
      if (error) throw error;
      const row = (Array.isArray(data) ? data[0] : data) as QrRow | undefined;
      setQrPass({ bookingId: booking.id, reference: row?.qr_reference ?? booking.reference, payload: row?.qr_payload ?? null, expiresAt: row?.expires_at ?? null });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t.qrUnavailable);
    } finally {
      setQrLoadingId("");
    }
  }

  async function cancelBooking(booking: Booking) {
    if (!window.confirm(locale === "th" ? "ต้องการยกเลิกการจองนี้หรือไม่?" : "Cancel this booking?")) return;
    try {
      const { error } = await createSupabaseBrowserClient().from("bookings").update({ status: "CANCELLED", cancellation_reason: "USER_REQUEST" }).eq("id", booking.id).eq("status", "PENDING");
      if (error) throw error;
      setBookings((current) => current.map((item) => item.id === booking.id ? { ...item, status: "CANCELLED" } : item));
      if (qrPass?.bookingId === booking.id) setQrPass(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t.operationalData);
    }
  }

  if (!isSupabaseConfigured()) return <div className="empty-card"><div><div className="empty-icon"><CircleAlert size={27} /></div><h2>{t.setupRequired}</h2><p>{t.accountNotConfigured} / {t.accountNotConfiguredEn}</p><Link className="primary-button" style={{ marginTop: 18 }} href={`/${locale}/login`}>{t.login}</Link></div></div>;
  if (loading) return <div className="empty-card"><div><RefreshCw size={26} /><p>Loading · กำลังโหลด</p></div></div>;
  if (message && !bookings.length) return <div className="empty-card"><div><div className="empty-icon"><CircleAlert size={27} /></div><h2>{message}</h2><Link className="primary-button" style={{ marginTop: 18 }} href={`/${locale}/login`}>{t.login}</Link></div></div>;
  if (!bookings.length) return <div className="empty-card"><div><div className="empty-icon"><CalendarDays size={27} /></div><h2>{t.myBookingsEmpty}</h2><p>{t.myBookingsEmptySub}</p><Link className="primary-button" style={{ marginTop: 18 }} href={`/${locale}/parking`}>{t.parking}</Link></div></div>;

  return <div className="booking-list">{bookings.map((booking) => { const area = areaNames[booking.parking_area_id]; const canShowQr = ["PENDING", "CONFIRMED", "RESERVED", "CHECKED_IN", "OVERSTAY"].includes(booking.status); return <article className="booking-card" key={booking.id}><div className="booking-card-top"><div><strong>{booking.reference}</strong><span>{booking.booking_mode === "INDIVIDUAL_SLOT" ? t.individualSlot : t.areaOnly}</span></div><span className={`booking-status ${booking.status.toLowerCase()}`}>{booking.status}</span></div><div className="booking-card-line"><MapPin size={15} /><span>{area?.name ?? booking.parking_area_id}<small>{area?.code ?? t.area}{booking.parking_slot_id ? ` · ${t.selectedSlot}` : ""}</small></span></div><div className="booking-card-line"><CalendarDays size={15} /><span>{booking.booking_date}<small>{t.date}</small></span><Clock3 size={15} /><span>{formatTime(booking.starts_at, locale)}–{formatTime(booking.ends_at, locale)}<small>{t.selectTime}</small></span></div><div className="booking-card-line"><Car size={15} /><span>{booking.vehicle_snapshot?.plate ?? "—"}<small>{t.vehicle}</small></span></div><div className="booking-card-actions">{canShowQr ? <button className="secondary-button" type="button" onClick={() => void showQr(booking)} disabled={qrLoadingId === booking.id}><QrCode size={15} />{qrLoadingId === booking.id ? "…" : t.qrPass}</button> : null}{booking.status === "PENDING" ? <button className="secondary-button" type="button" onClick={() => void cancelBooking(booking)}>{t.cancel}</button> : null}</div>{qrPass?.bookingId === booking.id ? <QrPass locale={locale} payload={qrPass.payload} reference={qrPass.reference} expiresAt={qrPass.expiresAt} /> : null}{message ? <div className="form-note" role="alert">{message}</div> : null}</article>; })}</div>;
}

function formatTime(value: string, locale: Locale) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleTimeString(locale === "th" ? "th-TH" : "en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
}
