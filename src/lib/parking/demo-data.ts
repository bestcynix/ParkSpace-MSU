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

const officialSource = "https://building.msu.ac.th/news-detail.php?id=23";

// Area names are transcribed from the MSU Building and Grounds Division
// announcement graphic. Capacity, coordinates, photos, slot labels, and live
// availability must come from Supabase after verification.
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
    detailTh: "ชื่อพื้นที่อ้างอิงจากประกาศกองอาคารสถานที่ มมส. พิกัด รูปภาพ ความจุ และสถานะช่องจอดรอตรวจสอบ",
    detailEn: "Area name is sourced from the MSU Building and Grounds announcement. Coordinates, photos, capacity, and slot status await verification.",
    status: "unverified",
    estimatedCapacity: index === 14 ? 50 : undefined,
    distance: undefined,
    slotMode: "AREA_ONLY",
    prototypeSlotGrid: index === 0,
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
