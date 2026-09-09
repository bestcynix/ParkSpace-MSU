import type { Locale } from "@/lib/i18n";
import { getCopy } from "@/lib/i18n";
import { AppHeader } from "@/components/layout/AppHeader";
import { PageTopbar } from "@/components/layout/PageTopbar";
import { PublicFooter } from "@/components/layout/PublicFooter";

type PolicyKind = "privacy" | "terms" | "cookies" | "help";

const content = {
  privacy: {
    th: { title: "Privacy Center / ศูนย์ความเป็นส่วนตัว", intro: "หน้านี้เป็นโครงสร้างสำหรับนโยบายจริงของโครงการและ มมส. ห้ามใช้แทนข้อความ PDPA ทางการจนกว่าจะได้รับการอนุมัติ", sections: [["ข้อมูลที่เก็บ", "ข้อมูลบัญชี รถ การจอง การใช้งาน QR และเหตุการณ์ที่จำเป็นต่อการให้บริการ"], ["สิทธิ์ของเจ้าของข้อมูล", "ขอดูข้อมูล ดาวน์โหลดข้อมูล แก้ไขข้อมูล ถอนความยินยอม และขอลบบัญชีได้ตามนโยบายที่ประกาศจริง"], ["ประวัติความยินยอม", "ทุกการยอมรับหรือถอนความยินยอมต้องเก็บเวอร์ชัน เวลา และหลักฐานในระบบ"]] },
    en: { title: "Privacy Center", intro: "This is a structure for the approved project and MSU policies. It must not replace official PDPA wording until approved.", sections: [["Data collected", "Account, vehicle, booking, QR usage, and event data required to provide the service."], ["Your rights", "Request access, download, correction, withdrawal of consent, and account deletion under the published policy."], ["Consent history", "Each consent or withdrawal must record the policy version, timestamp, and evidence."]] },
  },
  terms: {
    th: { title: "ข้อกำหนดการใช้งาน", intro: "ข้อกำหนดฉบับนี้เป็นโครงร่างสำหรับให้ผู้มีอำนาจตรวจสอบก่อนใช้งานจริง", sections: [["การจอง", "ผู้ใช้ต้องตรวจสอบวัน เวลา พื้นที่ และรถก่อนยืนยันการจอง"], ["QR Pass", "QR ใช้สำหรับตรวจสอบการจอง ไม่ควรส่งต่อให้ผู้อื่น และระบบจะบันทึกเหตุการณ์ที่เกี่ยวข้อง"], ["ข้อมูลไม่ยืนยัน", "ตัวเลขความจุที่มีป้าย Mockup เป็นข้อมูลประมาณการ ไม่ใช่ข้อมูลทางการของ มมส."]] },
    en: { title: "Terms of service", intro: "This is a draft structure for approval before production use.", sections: [["Bookings", "Users must check the date, time, area, and vehicle before confirming."], ["QR Pass", "A QR pass verifies a booking. Do not share it; related events are recorded."], ["Unverified data", "Capacity marked Mockup is an estimate, not official MSU data."]] },
  },
  cookies: {
    th: { title: "นโยบายคุกกี้", intro: "ระบบจะแยกคุกกี้ที่จำเป็นออกจากคุกกี้วิเคราะห์และการตั้งค่า ผู้ใช้เปลี่ยนแปลงได้จาก Cookie Settings", sections: [["Necessary", "จำเป็นต่อการเข้าสู่ระบบ ความปลอดภัย และการทำงานหลัก ปิดไม่ได้"], ["Analytics", "เปิดหรือปิดได้ และต้องบันทึกความยินยอม"], ["Preferences / Performance", "ใช้จำภาษาและปรับปรุงประสบการณ์ตามการตั้งค่าของผู้ใช้"]] },
    en: { title: "Cookie policy", intro: "The system separates necessary, analytics, preference, and performance cookies. Users can change settings in Cookie Settings.", sections: [["Necessary", "Required for sign-in, security, and core functions; always on."], ["Analytics", "Optional and controlled by consent."], ["Preferences / Performance", "Used for language preferences and service improvement according to user settings."]] },
  },
  help: {
    th: { title: "ช่วยเหลือและติดต่อ", intro: "ช่องทางช่วยเหลือสำหรับปัญหาการจอง การสแกน QR ความปลอดภัย และข้อมูลส่วนตัว", sections: [["ปัญหาการจอง", "ตรวจสอบหน้า การจองของฉัน และหมายเลข Booking ก่อนติดต่อเจ้าหน้าที่"], ["ปัญหา QR", "แจ้ง Booking Reference หรือ QR Reference แทนการส่งข้อมูลส่วนตัวทั้งหมด"], ["ติดต่อโครงการ", "ช่องทางจริงและ SLA ต้องกำหนดโดยผู้ดูแลระบบก่อนเปิดใช้งาน"]] },
    en: { title: "Help & contact", intro: "Support for booking, QR scanning, safety, and privacy issues.", sections: [["Booking issue", "Check My Bookings and your Booking Reference before contacting staff."], ["QR issue", "Share a Booking Reference or QR Reference instead of sending all personal data."], ["Project contact", "The approved contact channel and SLA must be configured before launch."]] },
  },
} as const;

export function PolicyPage({ locale, kind }: { locale: Locale; kind: PolicyKind }) {
  const t = getCopy(locale);
  const selected = content[kind][locale];
  return <div className="app-frame"><div className="page-wrap"><AppHeader locale={locale} /><PageTopbar locale={locale} title={selected.title} subtitle={kind === "privacy" ? "Version-managed · Admin managed" : t.realDataNote} /><div className="legal-card"><div className="mockup-note">{selected.intro}</div>{selected.sections.map(([heading, body]) => <section key={heading}><h2>{heading}</h2><p>{body}</p></section>)}</div><PublicFooter locale={locale} /></div></div>;
}
