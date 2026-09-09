import { Circle, CircleAlert, CircleCheck, CircleDot, Info, LockKeyhole } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { getCopy } from "@/lib/i18n";
import type { ParkingStatus } from "@/lib/parking/demo-data";

const statusIcon = {
  available: CircleCheck,
  reserved: CircleDot,
  occupied: Circle,
  full: CircleAlert,
  closed: LockKeyhole,
  unverified: Info,
};

export function StatusBadge({ status, locale }: { status: ParkingStatus; locale: Locale }) {
  const t = getCopy(locale);
  const Icon = statusIcon[status];
  const labels = {
    available: t.available,
    reserved: t.reserved,
    occupied: t.occupied,
    full: t.full,
    closed: t.closed,
    unverified: t.liveStatusPending,
  };

  return (
    <span className={`status-badge ${status}`}>
      <Icon size={12} strokeWidth={2.5} />
      {labels[status]}
    </span>
  );
}
