"use client";

import { useSearchParams } from "next/navigation";
import type { Locale } from "@/lib/i18n";
import { getParkingArea } from "@/lib/parking/demo-data";
import { BookingForm } from "@/components/booking/BookingForm";

export function BookingRoute({ locale }: { locale: Locale }) {
  const searchParams = useSearchParams();
  const slotId = searchParams.get("slot");
  const slotCode = searchParams.get("slotCode");
  return <BookingForm locale={locale} area={getParkingArea(searchParams.get("area") ?? "p15")} selectedSlot={slotId && slotCode ? { id: slotId, code: slotCode } : undefined} initialDate={searchParams.get("date") ?? undefined} initialStartTime={searchParams.get("start") ?? undefined} initialEndTime={searchParams.get("end") ?? undefined} />;
}
