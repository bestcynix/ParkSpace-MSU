import type { Locale } from "@/lib/i18n";

export type ParkingStatus = "available" | "reserved" | "occupied" | "full" | "closed" | "unverified";
export type SlotMode = "AREA_ONLY" | "INDIVIDUAL_SLOT";

export type ParkingArea = {
  id: string;
  code: string;
  th: string;
  en: string;
  detailTh: string;
  detailEn: string;
  status: ParkingStatus;
  estimatedCapacity?: number;
  distance?: string;
  slotMode: SlotMode;
  prototypeSlotGrid?: boolean;
  dataStatus: "AWAITING_VERIFICATION" | "VERIFIED";
  sourceReference: string;
  latitude: number;
  longitude: number;
  operatingHours: string;
  vehicleTypes: string[];
  coverImagePath?: string;
};

export const officialSource = "https://building.msu.ac.th/news-detail.php?id=23";
export const officialMapImage = "/brand/msu-car-park-official-map.jpg";
export const campusCenter = "16.24704,103.24936";

export type OfficialMapMarker = { code: string; left: number; top: number };

type RawAreaConfig = {
  th: string;
  en: string;
  latitude: number;
  longitude: number;
  left: number;
  top: number;
};

const rawAreas: RawAreaConfig[] = [
  { th: "พื้นที่โซนโรงเรียนสาธิต (ฝ่ายมัธยม)", en: "Demonstration School Zone (Secondary Division)", latitude: 16.2425, longitude: 103.2470, left: 23.2, top: 42.0 },
  { th: "พื้นที่โซนสำนักงานอธิการบดี", en: "Office of the President Zone", latitude: 16.2435, longitude: 103.2490, left: 31.7, top: 44.9 },
  { th: "พื้นที่โซนสำนักพิพิธภัณฑ์", en: "Museum Office Zone", latitude: 16.2445, longitude: 103.2520, left: 41.4, top: 50.3 },
  { th: "พื้นที่โซนข้างคณะสิ่งแวดล้อม", en: "Beside the Faculty of Environment", latitude: 16.2455, longitude: 103.2530, left: 41.5, top: 47.2 },
  { th: "พื้นที่โซนข้างวิทยาลัยดุริยางคศิลป์", en: "Beside the College of Music", latitude: 16.2450, longitude: 103.2505, left: 35.9, top: 42.4 },
  { th: "พื้นที่โซนหลังคณะมนุษยศาสตร์", en: "Behind the Faculty of Humanities", latitude: 16.2458, longitude: 103.2495, left: 33.4, top: 40.7 },
  { th: "พื้นที่โซนข้างคณะมนุษยศาสตร์", en: "Beside the Faculty of Humanities", latitude: 16.2465, longitude: 103.2485, left: 27.9, top: 38.0 },
  { th: "พื้นที่โซนข้างอาคารราชนครินทร์", en: "Beside Ratchanakharin Building", latitude: 16.2475, longitude: 103.2475, left: 25.1, top: 36.1 },
  { th: "พื้นที่โซนสนามกีฬา", en: "Sports Field Zone", latitude: 16.2495, longitude: 103.2460, left: 19.6, top: 28.4 },
  { th: "พื้นที่โซนหอพักนิสิต", en: "Student Dormitory Zone", latitude: 16.2510, longitude: 103.2480, left: 28.1, top: 27.0 },
  { th: "พื้นที่โซนลานหลังตลาดน้อย", en: "Behind Talat Noi Plaza", latitude: 16.2525, longitude: 103.2490, left: 30.9, top: 24.5 },
  { th: "พื้นที่โซนลานหน้าตลาดน้อย", en: "In front of Talat Noi Plaza", latitude: 16.2520, longitude: 103.2505, left: 34.3, top: 26.8 },
  { th: "พื้นที่โซนลานเล้าไก่/MSU Space", en: "Lao Kai / MSU Space Zone", latitude: 16.2500, longitude: 103.2495, left: 30.2, top: 30.6 },
  { th: "พื้นที่โซนหน้า SC 3", en: "In front of SC 3", latitude: 16.2490, longitude: 103.2515, left: 35.4, top: 31.0 },
  { th: "พื้นที่โซนข้างสำนักวิทยบริการ", en: "Beside the Academic Resource Center", latitude: 16.2475, longitude: 103.2510, left: 34.8, top: 36.3 },
  { th: "พื้นที่โซนข้างสำนักคอมพิวเตอร์", en: "Beside the Computer Center", latitude: 16.2470, longitude: 103.2525, left: 37.6, top: 38.8 },
  { th: "พื้นที่โซนข้างคณะวิศวกรรมศาสตร์", en: "Beside the Faculty of Engineering", latitude: 16.2485, longitude: 103.2535, left: 39.9, top: 36.1 },
  { th: "พื้นที่โซนข้างคณะสาธารณสุขศาสตร์", en: "Beside the Faculty of Public Health", latitude: 16.2495, longitude: 103.2545, left: 42.3, top: 32.6 },
  { th: "พื้นที่โซนคอนโดบุคลากร", en: "Personnel Residence Zone", latitude: 16.2505, longitude: 103.2560, left: 45.5, top: 32.4 },
  { th: "พื้นที่โซนศูนย์วิจัยฯ", en: "Research Center Zone", latitude: 16.2490, longitude: 103.2560, left: 45.7, top: 36.1 },
  { th: "พื้นที่โซนหลังห้องส่งเสริมการวิจัยฯ", en: "Behind the Research Promotion Office", latitude: 16.2475, longitude: 103.2560, left: 45.5, top: 39.6 },
  { th: "พื้นที่โซนข้างคณะพยาบาลศาสตร์", en: "Beside the Faculty of Nursing", latitude: 16.2460, longitude: 103.2550, left: 42.6, top: 44.0 },
  { th: "พื้นที่โซนข้างกองกิจการนิสิต", en: "Beside Student Affairs Division", latitude: 16.2520, longitude: 103.2465, left: 23.4, top: 23.9 },
  { th: "พื้นที่โซนสนามแบดมินตัน", en: "Badminton Court Zone", latitude: 16.2510, longitude: 103.2455, left: 21.6, top: 26.6 },
  { th: "พื้นที่โซนสนามฟุตบอลหญ้าเทียม", en: "Artificial Turf Football Field Zone", latitude: 16.2490, longitude: 103.2440, left: 17.7, top: 31.7 },
  { th: "พื้นที่ลานจอดข้างคณะสถาปัตย์", en: "Beside the Faculty of Architecture", latitude: 16.2465, longitude: 103.2500, left: 32.6, top: 35.5 },
  { th: "พื้นที่โซนหลังคณะเทคโนโลยี", en: "Behind the Faculty of Technology", latitude: 16.2495, longitude: 103.2530, left: 39.2, top: 31.6 },
  { th: "พื้นที่ลานจอดอาคารปฏิบัติการวิศวกรรมศาสตร์", en: "Engineering Practice Building Parking Area", latitude: 16.2450, longitude: 103.2545, left: 45.0, top: 42.4 },
];

export const officialMapMarkers: readonly OfficialMapMarker[] = rawAreas.map((item, index) => ({
  code: `P${String(index + 1).padStart(2, "0")}`,
  left: item.left,
  top: item.top,
}));

export const defaultVehicleTypes = ["CAR", "MOTORCYCLE", "PICKUP", "EV", "VAN"];
export const defaultOperatingHours = "06:00 – 22:00 น.";

export const parkingAreas: ParkingArea[] = rawAreas.map((item, index) => {
  const number = String(index + 1).padStart(2, "0");
  return {
    id: `p${number}`,
    code: `P${number}`,
    th: item.th,
    en: item.en,
    detailTh: "พื้นที่จอดรถทางการมหาวิทยาลัยมหาสารคาม ผังจอดช่องมาตรฐาน A–G พร้อมระบบตรวจสอบสถานะที่ว่างและการจองแบบเรียลไทม์",
    detailEn: "Official Mahasarakham University parking area featuring standard A–G layout with real-time availability and reservation.",
    status: "available",
    estimatedCapacity: 100,
    distance: undefined,
    slotMode: "INDIVIDUAL_SLOT",
    prototypeSlotGrid: true,
    dataStatus: "VERIFIED",
    sourceReference: officialSource,
    latitude: item.latitude,
    longitude: item.longitude,
    operatingHours: defaultOperatingHours,
    vehicleTypes: defaultVehicleTypes,
  };
});

export function getParkingArea(id: string): ParkingArea {
  return parkingAreas.find((area) => area.id.toLowerCase() === id.toLowerCase() || area.code.toLowerCase() === id.toLowerCase()) ?? parkingAreas[0];
}

export function getAreaName(area: ParkingArea, locale: Locale): string {
  return locale === "th" ? area.th : area.en;
}

export function getAreaDetail(area: ParkingArea, locale: Locale): string {
  return locale === "th" ? area.detailTh : area.detailEn;
}

export function getGoogleMapsSearchQuery(area: ParkingArea): string {
  return `${area.th} มหาวิทยาลัยมหาสารคาม ตำบลขามเรียง อำเภอกันทรวิชัย จังหวัดมหาสารคาม`;
}

export function getGoogleMapsSearchUrl(area: ParkingArea): string {
  if (Number.isFinite(area.latitude) && Number.isFinite(area.longitude)) {
    return `https://www.google.com/maps/search/?api=1&query=${area.latitude},${area.longitude}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(getGoogleMapsSearchQuery(area))}`;
}

export function getGoogleMapsNavigationUrl(area: ParkingArea, coordinates?: { latitude: number; longitude: number } | null): string {
  const lat = coordinates?.latitude ?? area.latitude;
  const lng = coordinates?.longitude ?? area.longitude;
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  }
  return getGoogleMapsSearchUrl(area);
}
