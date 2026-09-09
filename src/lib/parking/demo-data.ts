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
};

export const officialSource = "https://building.msu.ac.th/news-detail.php?id=23";
export const officialMapImage = "https://building.msu.ac.th/uploads/news/news_img_20260623_041630_d386e933.png";
export const campusCenter = "16.24704,103.24936";

export type OfficialMapMarker = { code: string; left: number; top: number };

// These are image-relative reference positions read from the numbered markers
// in the official MSU announcement graphic. They intentionally are not GPS
// coordinates. Google Maps pins/routes are enabled only after an area has a
// verified latitude/longitude in Supabase.
export const officialMapMarkers: readonly OfficialMapMarker[] = [
  { code: "P01", left: 23.2, top: 42.0 },
  { code: "P02", left: 31.7, top: 44.9 },
  { code: "P03", left: 41.4, top: 50.3 },
  { code: "P04", left: 41.5, top: 47.2 },
  { code: "P05", left: 35.9, top: 42.4 },
  { code: "P06", left: 33.4, top: 40.7 },
  { code: "P07", left: 27.9, top: 38.0 },
  { code: "P08", left: 25.1, top: 36.1 },
  { code: "P09", left: 19.6, top: 28.4 },
  { code: "P10", left: 28.1, top: 27.0 },
  { code: "P11", left: 30.9, top: 24.5 },
  { code: "P12", left: 34.3, top: 26.8 },
  { code: "P13", left: 30.2, top: 30.6 },
  { code: "P14", left: 35.4, top: 31.0 },
  { code: "P15", left: 34.8, top: 36.3 },
  { code: "P16", left: 37.6, top: 38.8 },
  { code: "P17", left: 39.9, top: 36.1 },
  { code: "P18", left: 42.3, top: 32.6 },
  { code: "P19", left: 45.5, top: 32.4 },
  { code: "P20", left: 45.7, top: 36.1 },
  { code: "P21", left: 45.5, top: 39.6 },
  { code: "P22", left: 42.6, top: 44.0 },
  { code: "P23", left: 23.4, top: 23.9 },
  { code: "P24", left: 21.6, top: 26.6 },
  { code: "P25", left: 17.7, top: 31.7 },
  { code: "P26", left: 32.6, top: 35.5 },
  { code: "P27", left: 39.2, top: 31.6 },
  { code: "P28", left: 45.0, top: 42.4 },
];

// Area names are transcribed from the MSU Building and Grounds Division
// announcement graphic. The local catalog describes the requested mock layout;
// live availability and real bookings must always come from Supabase.
const officialAreas: Array<[string, string]> = [
  ["พื้นที่โซนโรงเรียนสาธิต (ฝ่ายมัธยม)", "Demonstration School Zone (Secondary Division)"],
  ["พื้นที่โซนสำนักงานอธิการบดี", "Office of the President Zone"],
  ["พื้นที่โซนสำนักพิพิธภัณฑ์", "Museum Office Zone"],
  ["พื้นที่โซนข้างคณะสิ่งแวดล้อม", "Beside the Faculty of Environment"],
  ["พื้นที่โซนข้างวิทยาลัยดุริยางคศิลป์", "Beside the College of Music"],
  ["พื้นที่โซนหลังคณะมนุษยศาสตร์", "Behind the Faculty of Humanities"],
  ["พื้นที่โซนข้างคณะมนุษยศาสตร์", "Beside the Faculty of Humanities"],
  ["พื้นที่โซนข้างอาคารราชนครินทร์", "Beside Ratchanakharin Building"],
  ["พื้นที่โซนสนามกีฬา", "Sports Field Zone"],
  ["พื้นที่โซนคณะพยาบาลศาสตร์", "Faculty of Nursing Zone"],
  ["พื้นที่โซนลานหลังตลาดน้อย", "Behind Talat Noi Plaza"],
  ["พื้นที่โซนลานหน้าตลาดน้อย", "In front of Talat Noi Plaza"],
  ["พื้นที่โซนลานเล้าไก่/MSU Space", "Lao Kai / MSU Space Zone"],
  ["พื้นที่โซนหน้า SC 3", "In front of SC 3"],
  ["พื้นที่โซนข้างสำนักวิทยบริการ", "Beside the Academic Resource Center"],
  ["พื้นที่โซนข้างสำนักคอมพิวเตอร์", "Beside the Computer Center"],
  ["พื้นที่โซนข้างคณะวิศวกรรมศาสตร์", "Beside the Faculty of Engineering"],
  ["พื้นที่โซนข้างคณะสาธารณสุขศาสตร์", "Beside the Faculty of Public Health"],
  ["พื้นที่โซนคอนโดบุคลากร", "Personnel Residence Zone"],
  ["พื้นที่โซนศูนย์วิจัยฯ", "Research Center Zone"],
  ["พื้นที่โซนหลังห้องส่งเสริมการวิจัยฯ", "Behind the Research Promotion Office"],
  ["พื้นที่โซนข้างคณะพยาบาลศาสตร์", "Beside the Faculty of Nursing"],
  ["พื้นที่โซนข้างอาคารบัณฑิตวิทยาลัย", "Beside the Graduate School Building"],
  ["พื้นที่โซนสนามบาสคณะมนุษยศาสตร์", "Faculty of Humanities Basketball Court Zone"],
  ["พื้นที่โซนสนามฟุตบอลหญ้าเทียม", "Artificial Turf Football Field Zone"],
  ["พื้นที่สนามจอดข้างคณะสถาปัตย์", "Parking Area beside the Faculty of Architecture"],
  ["พื้นที่โซนหลังคณะเทคโนโลยี", "Behind the Faculty of Technology"],
  ["พื้นที่สนามจอดอาคารปฏิบัติการวิศวกรรมศาสตร์", "Engineering Practice Building Parking Area"],
];

export const parkingAreas: ParkingArea[] = officialAreas.map(([th, en], index) => {
  const number = String(index + 1).padStart(2, "0");
  return {
    id: `p${number}`,
    code: `P${number}`,
    th,
    en,
    detailTh: "ชื่อพื้นที่อ้างอิงจากประกาศกองอาคารสถานที่ มมส. ผัง A–G และจำนวน 100 ช่องเป็น Mockup ส่วนสถานะและการจองอ่านจากระบบจริง",
    detailEn: "The area name is sourced from the MSU announcement. The A–G / 100-space layout is Mockup; statuses and bookings come from the real system.",
    status: "unverified",
    estimatedCapacity: 100,
    distance: undefined,
    slotMode: "INDIVIDUAL_SLOT",
    prototypeSlotGrid: true,
    dataStatus: "AWAITING_VERIFICATION",
    sourceReference: officialSource,
  };
});

export function getParkingArea(id: string) {
  return parkingAreas.find((area) => area.id.toLowerCase() === id.toLowerCase() || area.code.toLowerCase() === id.toLowerCase()) ?? parkingAreas[0];
}

export function getAreaName(area: ParkingArea, locale: Locale) {
  return locale === "th" ? area.th : area.en;
}

export function getAreaDetail(area: ParkingArea, locale: Locale) {
  return locale === "th" ? area.detailTh : area.detailEn;
}

export function getGoogleMapsSearchUrl(area: ParkingArea) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(getGoogleMapsSearchQuery(area))}`;
}

export function getGoogleMapsSearchQuery(area: ParkingArea) {
  // The official announcement does not publish a verified GPS point for each
  // area. Keep the fallback query focused on the official Thai place name so
  // Google Maps does not rank an arbitrary result from the P01/P02 code.
  const query = `${area.th} มหาวิทยาลัยมหาสารคาม ตำบลขามเรียง อำเภอกันทรวิชัย จังหวัดมหาสารคาม`;
  return query;
}

export function getGoogleMapsNavigationUrl(area: ParkingArea, coordinates?: { latitude: number; longitude: number } | null) {
  if (coordinates && Number.isFinite(coordinates.latitude) && Number.isFinite(coordinates.longitude)) {
    return `https://www.google.com/maps/dir/?api=1&destination=${coordinates.latitude},${coordinates.longitude}`;
  }
  return getGoogleMapsSearchUrl(area);
}
