"use client";

import { useSearchParams } from "next/navigation";
import type { Locale } from "@/lib/i18n";
import { getParkingArea } from "@/lib/parking/demo-data";
import { BookingForm } from "@/components/booking/BookingForm";
import { RequireAuth } from "@/components/auth/RequireAuth";

export function BookingRoute({ locale }: { locale: Locale }) {
  const searchParams = useSearchParams();
  const slotId = searchParams.get("slot");
  const slotCode = searchParams.get("slotCode");
  const slotType = searchParams.get("slotType");
  const query = searchParams.toString();
  const target = `/${locale}/app/bookings/new${query ? `?${query}` : ""}`;
  return <RequireAuth locale={locale} target={target}><BookingForm locale={locale} area={getParkingArea(searchParams.get("area") ?? "p15")} selectedSlot={slotId && slotCode ? { id: slotId, code: slotCode, type: slotType ?? undefined } : undefined} initialDate={searchParams.get("date") ?? undefined} initialStartTime={searchParams.get("start") ?? undefined} initialEndTime={searchParams.get("end") ?? undefined} /></RequireAuth>;
}
