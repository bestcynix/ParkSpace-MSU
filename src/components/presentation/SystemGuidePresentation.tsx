"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarCheck,
  Car,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  Compass,
  Copy,
  Database,
  ExternalLink,
  Eye,
  HeartPulse,
  Info,
  Laptop,
  Layers,
  Lock,
  MapPin,
  Maximize2,
  Minimize2,
  Navigation,
  Pause,
  Play,
  QrCode,
  RefreshCw,
  Search,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Tablet,
  Trash2,
  User,
  UserCheck,
  Users,
  Zap,
} from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { parkingAreas } from "@/lib/parking/demo-data";

type TabMode = "slides" | "manual" | "sitemap" | "credentials";
type RoleFilter = "all" | "user" | "staff" | "admin";

interface StepItem {
  id: number;
  number: string;
  role: "user" | "staff" | "admin" | "all";
  roleLabelTh: string;
  roleLabelEn: string;
  titleTh: string;
  titleEn: string;
  subtitleTh: string;
  subtitleEn: string;
  descriptionTh: string;
  descriptionEn: string;
  keyPointsTh: string[];
  keyPointsEn: string[];
  tipsTh: string;
  tipsEn: string;
  targetUrl: string;
  urlLabelTh: string;
  urlLabelEn: string;
  imageSrc: string;
  imageAlt: string;
  badgeColor: string;
  badgeBg: string;
  gallery?: { src: string; alt: string; labelTh: string; labelEn: string }[];
}

interface SitemapItem {
  path: string;
  category: "public" | "user" | "staff" | "admin";
  categoryLabelTh: string;
  categoryLabelEn: string;
  titleTh: string;
  titleEn: string;
  descriptionTh: string;
  descriptionEn: string;
  authRequired: "none" | "user" | "staff" | "admin";
  authBadgeTh: string;
  authBadgeEn: string;
  isHighlight?: boolean;
}

export function SystemGuidePresentation({ locale }: { locale: Locale }) {
  const isTh = locale === "th";

  // Tab & View States
  const [activeTab, setActiveTab] = useState<TabMode>("slides");
  const [manualRole, setManualRole] = useState<RoleFilter>("all");
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [sitemapSearch, setSitemapSearch] = useState<string>("");
  const [sitemapCategory, setSitemapCategory] = useState<string>("all");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [lightboxImage, setLightboxImage] = useState<{ src: string; title: string } | null>(null);
  const [selectedImageOverride, setSelectedImageOverride] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const touchStartXRef = useRef<number | null>(null);

  useEffect(() => {
    setSelectedImageOverride(null);
  }, [currentStep]);

  // 1. Definition of Step-by-Step Lifecycle Presentation Slides
  const steps: StepItem[] = useMemo(
    () => [
      {
        id: 1,
        number: "01",
        role: "user",
        roleLabelTh: "ผู้ใช้งานทั่วไป / นักศึกษา",
        roleLabelEn: "General Users & Students",
        titleTh: "สำรวจและค้นหาลานจอด 28 จุดในมหาวิทยาลัย",
        titleEn: "Explore & Locate 28 Parking Areas on Campus",
        subtitleTh: "ตรวจสอบสถานะความจุและช่องจอดว่างแบบเรียลไทม์",
        subtitleEn: "Check real-time slot occupancy and location availability",
        descriptionTh:
          "ผู้ใช้สามารถเข้าถึงแผนที่ภาพรวมของมหาวิทยาลัยมหาสารคาม (ทั้งเขตพื้นที่ขามเรียงและในเมือง) ได้จากหน้าแรก สามารถดูสถานะช่องจอดว่างสดๆ ของจุดจอด P01 ถึง P28 กรองตามประเภทยานพาหนะ (รถยนต์/มอเตอร์ไซค์) และค้นหาชื่ออาคารหรือคณะที่ต้องการเดินทางไป",
        descriptionEn:
          "Users can view the university-wide campus overview covering all 28 parking zones (P01 to P28) across Khamriang and Downtown campuses. Filter by vehicle type (cars/motorcycles) and search directly by faculty or building name.",
        keyPointsTh: [
          "แสดงจุดจอดรถทางการ 28 จุด (P01–P28) พร้อมจำนวนช่องจอดทั้งหมดและช่องว่าง",
          "รองรับการกรองตามยานพาหนะ: รถยนต์ (Car), รถมอเตอร์ไซค์ (Motorbike), ช่องคนพิการ (Priority)",
          "ระบบค้นหาแบบ Live Auto-complete แนะนำจุดจอดใกล้คณะหรือสถานที่ปลายทางทันที",
          "มีแถบสถานะสีชัดเจน: เขียว (ว่างเยอะ), ส้ม (ปานกลาง), แดง (ใกล้เต็มหรือเต็ม)",
        ],
        keyPointsEn: [
          "Covers all 28 official parking areas (P01–P28) with real-time slot counts",
          "Filterable by vehicle category: Cars, Motorbikes, Priority/Accessibility spots",
          "Live search autocomplete suggesting optimal parking near your destination building",
          "Color-coded occupancy indicators: Green (High availability), Orange (Moderate), Red (Nearly full)",
        ],
        tipsTh: "💡 เคล็ดลับ: สามารถกดที่การ์ดลานจอดเพื่อดูสิ่งอำนวยความสะดวก เช่น หลังคาบังแดด, กล้อง CCTV, ไฟส่องสว่าง และสถานีชาร์จ EV",
        tipsEn: "💡 Tip: Click on any area card to view amenities including solar roofs, security CCTV, floodlights, and EV chargers.",
        targetUrl: `/${locale}/parking`,
        urlLabelTh: "ทดลองเปิดหน้าลานจอด 28 จุด 🚀",
        urlLabelEn: "Explore 28 Parking Lots 🚀",
        imageSrc: "/guide/home-landing-hero.png",
        imageAlt: "ParkSpace MSU Homepage & Navigation",
        badgeColor: "#0284c7",
        badgeBg: "#e0f2fe",
        gallery: [
          {
            src: "/guide/parking-p01-detail.png",
            alt: "Area P01 Detail & Capacity",
            labelTh: "หน้ารายละเอียดจุด P01",
            labelEn: "P01 Detail View",
          },
          {
            src: "/guide/campus-map-interactive.png",
            alt: "Campus Map Overview 28 Points",
            labelTh: "แผนที่ภาพรวม 28 จุด",
            labelEn: "28-Area Campus Map",
          },
        ],
      },
      {
        id: 2,
        number: "02",
        role: "user",
        roleLabelTh: "ผู้ใช้งานทั่วไป / นักศึกษา",
        roleLabelEn: "General Users & Students",
        titleTh: "แผนที่ 2D Campus Map & การเลือกช่องจอด",
        titleEn: "2D Interactive Campus Map & Slot Selection",
        subtitleTh: "เลือกช่องจอดที่ต้องการและระบุช่วงเวลาจองล่วงหน้า",
        subtitleEn: "Select specific parking slot and specify booking schedule",
        descriptionTh:
          "ระบบมีแผนผัง Vector 2D Interactive ที่วาดขึ้นเฉพาะสำหรับ มมส. แสดงตำแหน่งทางเข้า-ออก ถนน อาคารรอบข้าง และผังช่องจอดรายช่อง ผู้ใช้สามารถคลิกเลือกช่องจอดที่ต้องการ กำหนดเวลาเข้า-ออก และระบุป้ายทะเบียนรถได้อย่างสะดวกรวดเร็ว",
        descriptionEn:
          "The custom-crafted 2D Interactive Vector Campus Map visualizes roads, gates, surrounding academic buildings, and designated slot layouts. Users simply tap their preferred slot, specify arrival/departure time, and confirm their vehicle plate.",
        keyPointsTh: [
          "แผนที่เวกเตอร์ 2D ออกแบบแม่นยำตามสัดส่วนพื้นที่จริงของ มมส. ขามเรียง",
          "คลิกเลือกช่องจอดที่ต้องการจองได้แบบ Interactive (สีเขียวคือว่าง, เทาคือมีผู้จองแล้ว)",
          "กำหนดวัน เวลาเริ่มต้น และเวลาสิ้นสุด พร้อมคำนวณระยะเวลาใช้งานอัตโนมัติ",
          "สามารถเลือกป้ายทะเบียนจากยานพาหนะที่บันทึกไว้ในโปรไฟล์ได้ในคลิกเดียว",
        ],
        keyPointsEn: [
          "Precision 2D vector map accurately matching MSU Khamriang campus geometry",
          "Interactive slot selection grid (Green indicates available, Gray represents reserved)",
          "Flexible booking schedule picker with automated parking duration calculation",
          "One-click vehicle license plate auto-fill from your saved user profile",
        ],
        tipsTh: "💡 ข้อแนะนำ: จองล่วงหน้าอย่างน้อย 15 นาที เพื่อให้ระบบสำรองช่องจอดได้อย่างแน่นอนและออกบัตรผ่านดิจิทัลได้ทันเวลา",
        tipsEn: "💡 Recommendation: Reserve at least 15 minutes in advance to guarantee immediate slot locking and instant pass generation.",
        targetUrl: `/${locale}/map`,
        urlLabelTh: "เปิดดูแผนผัง 2D Interactive 🗺️",
        urlLabelEn: "View 2D Interactive Map 🗺️",
        imageSrc: "/guide/parking-p01-slots-grid.png",
        imageAlt: "P01 Live Interactive Slot Selection Grid",
        badgeColor: "#0284c7",
        badgeBg: "#e0f2fe",
        gallery: [
          {
            src: "/guide/booking-form-summary.png",
            alt: "Booking Form & Vehicle Selection",
            labelTh: "ฟอร์มสรุปการจอง & เลือกรถ",
            labelEn: "Booking Form & Vehicle",
          },
          {
            src: "/guide/campus-vector-2d.png",
            alt: "2D Vector Campus Map",
            labelTh: "แผนผังเวกเตอร์ 2D",
            labelEn: "2D Vector Map",
          },
        ],
      },
      {
        id: 3,
        number: "03",
        role: "user",
        roleLabelTh: "ผู้ใช้งานทั่วไป / นักศึกษา",
        roleLabelEn: "General Users & Students",
        titleTh: "รับบัตรผ่านดิจิทัลพร้อม QR Pass ทันที",
        titleEn: "Receive Instant Digital QR Pass",
        subtitleTh: "บัตรผ่านเข้าออกอัจฉริยะแบบไร้สัมผัส พร้อมรหัสยืนยันเฉพาะตัว",
        subtitleEn: "Contactless digital entry pass with unique cryptographic verification code",
        descriptionTh:
          "เมื่อยืนยันการจอง ระบบจะออกบัตรผ่านดิจิทัล (Digital QR Pass) ให้ทันที ซึ่งประกอบด้วยรูป QR Code ความละเอียดสูง, รหัสอ้างอิงการจอง (เช่น MSUPK-BKG-20260910-xxxxx), ข้อมูลลานจอด, ช่องจอด, ป้ายทะเบียน, และเวลานับถอยหลังหมดอายุ",
        descriptionEn:
          "Upon confirmation, the system immediately generates a Digital QR Pass featuring a high-contrast QR code, unique booking reference (e.g. MSUPK-BKG-20260910-xxxxx), designated area & slot code, plate number, and expiry countdown.",
        keyPointsTh: [
          "QR Code เข้ารหัสเฉพาะรายการจอง ป้องกันการปลอมแปลงและทำซ้ำ",
          "ดีไซน์การ์ดสีทองพรีเมียม สวยงาม ไอคอนตรงกึ่งกลาง รองรับ Dark / Light Mode",
          "มีรหัสอ้างอิง 5 ตัวท้าย สำหรับให้เจ้าหน้าที่ตรวจสอบกรณีกล้องโทรศัพท์สแกนไม่ติด",
          "สามารถบันทึกภาพหน้าจอหรือเปิดดูได้ตลอดเวลาจากเมนู 'การจองของฉัน'",
        ],
        keyPointsEn: [
          "Secure uniquely signed QR tokens preventing duplicate or spoofed entries",
          "Signature MSU Gold styling with perfectly centered icon and dark mode compatibility",
          "Prominent 5-character suffix reference for instant manual search fallback",
          "Access anytime from 'My Bookings' tab or save directly to photo gallery",
        ],
        tipsTh: "💡 หมายเหตุ: บัตรผ่านจะแสดงสถานะ CONFIRMED หรือ PENDING และพร้อมใช้งานสำหรับนำรถเข้าจอดตามช่วงเวลาที่จอง",
        tipsEn: "💡 Note: Pass shows CONFIRMED / PENDING status and is ready for check-in during your reserved timeframe.",
        targetUrl: `/${locale}/app/bookings`,
        urlLabelTh: "ดูรายการจองและบัตร QR Pass 🎫",
        urlLabelEn: "View Bookings & QR Pass 🎫",
        imageSrc: "/guide/qr-pass-card.png",
        imageAlt: "QR Pass Card",
        badgeColor: "#b45309",
        badgeBg: "#fef3c7",
        gallery: [
          {
            src: "/guide/booking-form-summary.png",
            alt: "Booking Summary Form",
            labelTh: "ฟอร์มระบุการจอง",
            labelEn: "Booking Form",
          },
          {
            src: "/guide/user-profile-history.png",
            alt: "User Bookings History",
            labelTh: "ประวัติการจองของฉัน",
            labelEn: "My Bookings History",
          },
        ],
      },
      {
        id: 4,
        number: "04",
        role: "user",
        roleLabelTh: "ผู้ใช้งานทั่วไป / นักศึกษา",
        roleLabelEn: "General Users & Students",
        titleTh: "เดินทางมายังจุดจอดด้วยระบบนำทาง GPS",
        titleEn: "Navigate to Parking Gate with GPS Navigation",
        subtitleTh: "เปิดนำทางด้วย Google Maps ตรงสู่ทางเข้าลานจอดอย่างแม่นยำ",
        subtitleEn: "One-tap Google Maps turn-by-turn navigation directly to the parking gate",
        descriptionTh:
          "ไม่ต้องกังวลเรื่องการหลงทางในมหาวิทยาลัย ในบัตรจองและหน้ารายละเอียดจะมีปุ่ม 'นำทาง (Navigate)' ซึ่งจะส่งพิกัดละติจูดและลองจิจูดของทางเข้าลานจอดที่จองไว้ไปยัง Google Maps บนโทรศัพท์ เพื่อนำทางแบบเลี้ยวต่อเลี้ยวอย่างแม่นยำ",
        descriptionEn:
          "Never get lost across campus. Every booking card includes a dedicated 'Navigate' button transmitting exact entrance coordinates directly into Google Maps for seamless turn-by-turn routing.",
        keyPointsTh: [
          "ลิงก์พิกัดทางเข้าลานจอดจริงทั้ง 28 จุด บันทึกตามภูมิศาสตร์ของมหาวิทยาลัย",
          "รองรับการเปิดบน Google Maps ทั้งในแอปมือถือ iOS, Android และเว็บเบราว์เซอร์",
          "มีป้ายบอกชื่อลานจอด เช่น 'P01 ลานจอดหน้าอาคารบรมราชกุมารี' ชัดเจน",
          "แจ้งเตือนล่วงหน้าเมื่อใกล้ถึงเวลาจองผ่านศูนย์การแจ้งเตือนของระบบ",
        ],
        keyPointsEn: [
          "Coordinates accurately mapped to the entrance barrier of each 28 campus parking lots",
          "Native launch on iOS Google Maps, Android Maps, and web browsers",
          "Clear localized area labels e.g. 'P01 Borommaratchakumari Building Front'",
          "Automated proximity and upcoming arrival reminder notifications",
        ],
        tipsTh: "💡 การเตรียมตัว: เมื่อขับรถมาถึงทางเข้าลานจอด ให้เตรียมเปิดหน้าจอบัตรผ่าน QR Pass บนโทรศัพท์เพื่อยื่นให้เจ้าหน้าที่สแกน",
        tipsEn: "💡 Preparation: As you approach the gate, have your QR Pass screen ready for the staff to scan.",
        targetUrl: `/${locale}/parking/p01`,
        urlLabelTh: "ตัวอย่างหน้าข้อมูลและพิกัดนำทาง P01 📍",
        urlLabelEn: "Example Area P01 Navigation Details 📍",
        imageSrc: "/guide/parking-p01-map.png",
        imageAlt: "Area P01 Interactive Google Maps & Route Navigation",
        badgeColor: "#15803d",
        badgeBg: "#dcfce7",
        gallery: [
          {
            src: "/guide/parking-p01-detail.png",
            alt: "Area P01 Details & Live Capacity",
            labelTh: "ข้อมูลลานจอดและสิ่งอำนวยความสะดวก",
            labelEn: "Area & Amenities Info",
          },
        ],
      },
      {
        id: 5,
        number: "05",
        role: "staff",
        roleLabelTh: "เจ้าหน้าที่ลานจอดรถ (Staff Station)",
        roleLabelEn: "Parking Staff (Staff Station)",
        titleTh: "เจ้าหน้าที่เลือกจุดประจำการเวร & สแกนบัตรผ่าน",
        titleEn: "Duty Station Assignment & High-Speed Pass Scanner",
        subtitleTh: "เข้าเวรประจำจุด P01-P28 และสแกน QR ผ่านกล้องมือถือ/แท็บเล็ต",
        subtitleEn: "Select assigned zone P01-P28, shift schedule, and scan QR passes",
        descriptionTh:
          "เจ้าหน้าที่เข้าสู่ระบบด้วยบัญชีกลาง `staff` / `staff123` จากนั้นเลือกจุดประจำการเวร (เช่น P01) และกะปฏิบัติงาน (เช้า/บ่าย/ค่ำ) ตัวเครื่องสแกนจะเปิดกล้องความเร็วสูง สามารถส่อง QR Code ได้ทันที มีไฟฉาย Flashlight สำหรับสแกนเวลากลางคืน และมีช่องค้นหาด่วนด้วยรหัส 5 ตัวท้ายหรือทะเบียนรถ",
        descriptionEn:
          "Staff sign in using central credentials `staff` / `staff123`, select their active duty station (e.g. P01) and work shift. The high-speed scanner accesses device cameras with flashlight toggle for night shifts, complemented by fallback instant reference/plate search.",
        keyPointsTh: [
          "บัญชีกลางสำหรับเจ้าหน้าที่: staff / staff123 (อีเมล staff@msu.ac.th)",
          "แถบ Duty Station บันทึกจุดประจำการและกะเวลาจำไว้ในเครื่องอัตโนมัติ",
          "สแกนได้เร็วภายในเสี้ยววินาที รองรับการสแกนบัตรการจองของทุกคนทั่วมหาวิทยาลัย",
          "มีไฟฉายสำหรับเข้าเวรกะค่ำ และช่องพิมพ์ค้นหาด่วนกรณีผู้ใช้ไม่สะดวกเปิดกล้อง",
        ],
        keyPointsEn: [
          "Standard central staff account: staff / staff123 (email staff@msu.ac.th)",
          "Persistent Duty Station bar saving active zone and work shift locally",
          "Sub-second QR decoding with universal university-wide booking visibility",
          "Integrated night-mode flashlight switch and quick-text search fallback",
        ],
        tipsTh: "💡 ข้อควรรู้: เจ้าหน้าที่สามารถสแกนและตรวจสอบบัตรผ่านของผู้ใช้ทุกคนได้ ไม่ว่าจะจองมาจากช่องทางใด",
        tipsEn: "💡 Note: Staff can inspect and verify passes for all campus bookings regardless of creator.",
        targetUrl: `/${locale}/staff/scan`,
        urlLabelTh: "เปิดหน้าจอเครื่องสแกนของเจ้าหน้าที่ 📷",
        urlLabelEn: "Open Staff Pass Scanner 📷",
        imageSrc: "/guide/staff-scanner-duty.png",
        imageAlt: "Staff Duty Station Assignment & QR Scanner",
        badgeColor: "#d97706",
        badgeBg: "#fef3c7",
        gallery: [
          {
            src: "/guide/staff-operations-live.png",
            alt: "Staff Realtime Operations Dashboard",
            labelTh: "ศูนย์ควบคุมปฏิบัติการสด",
            labelEn: "Live Ops Dashboard",
          },
        ],
      },
      {
        id: 6,
        number: "06",
        role: "staff",
        roleLabelTh: "เจ้าหน้าที่ลานจอดรถ (Staff Station)",
        roleLabelEn: "Parking Staff (Staff Station)",
        titleTh: "การเช็คอินเข้าจอด & ระบบจัดสรรช่องใหม่เมื่อจอดผิดลาน",
        titleEn: "Check-in Confirmation & Duty Zone Re-slotting",
        subtitleTh: "ยืนยันการเข้าจอด หรือโยกย้ายเข้าโซนเวรปัจจุบันได้ทันทีในคลิกเดียว",
        subtitleEn: "Confirm vehicle check-in or re-slot into duty zone immediately if arriving at wrong lot",
        descriptionTh:
          "เมื่อสแกนบัตรผ่านแล้ว เจ้าหน้าที่กดปุ่ม 🟢 ยืนยันเข้าจอด (Check-in) และหากผู้ใช้ขับรถมาผิดลาน (เช่น จอง P05 แต่มาเข้า P01) ระบบจะแจ้งเตือน 'โซนไม่ตรง' พร้อมมีปุ่ม 'โยกย้ายและเช็คอินเข้าโซนนี้ทันที (Re-slot & Check-in)' ให้เจ้าหน้าที่เลือกช่องว่างในโซนประจำการและย้ายให้ผู้ใช้เข้าจอดได้ทันทีโดยไม่ต้องยกเลิกการจองเดิม!",
        descriptionEn:
          "After scanning, staff click 🟢 Check-in. If the driver arrives at the wrong parking area (e.g. booked P05 but enters P01), the scanner displays a prominent Zone Mismatch warning along with an instant 'Re-slot & Check-in into Duty Zone' action to reassign an empty spot seamlessly!",
        keyPointsTh: [
          "สิทธิ์ของ Staff ถูกควบคุมตามขั้นตอนจริง: ทำได้เฉพาะ Check-in และ Check-out (ไม่สามารถลบหรือข้ามสถานะมั่วได้)",
          "สามารถแก้ไขป้ายทะเบียนจริงที่รถขับเข้ามาได้ หากผู้ใช้เปลี่ยนรถมา",
          "ระบบตรวจจับการมาผิดลานอัตโนมัติ พร้อมแสดงปุ่มนำทาง Google Maps ไปยังลานเดิม",
          "ฟังก์ชัน Re-slot ย้ายเข้าโซนเวรได้ทันที ช่วยลดความขัดแย้งและแก้ปัญหาหน้างานได้รวดเร็ว",
        ],
        keyPointsEn: [
          "Staff role is strictly sequential: strictly check-in and check-out (no arbitrary deletes or skips)",
          "Ability to update actual license plate if the driver swapped vehicles",
          "Automatic wrong-zone detection with instant Google Maps link to original lot",
          "Instant Re-slotting workflow resolving real-world on-site conflicts with zero hassle",
        ],
        tipsTh: "💡 ความปลอดภัย: เจ้าหน้าที่ไม่สามารถลบการจองหรือกระโดดสถานะได้ เพื่อป้องกันการทุจริตและการสูญหายของข้อมูล",
        tipsEn: "💡 Security: Staff cannot delete bookings or bypass status rules, preventing data loss and fraud.",
        targetUrl: `/${locale}/staff/operations`,
        urlLabelTh: "ดูสถานะปฏิบัติการแบบเรียลไทม์ ⚡",
        urlLabelEn: "View Real-Time Operations ⚡",
        imageSrc: "/guide/staff-operations-live.png",
        imageAlt: "Staff Realtime Operations Dashboard",
        badgeColor: "#d97706",
        badgeBg: "#fef3c7",
        gallery: [
          {
            src: "/guide/staff-scanner-duty.png",
            alt: "Staff Duty Station Scanner",
            labelTh: "จุดสแกนประจำลานจอด",
            labelEn: "Duty Station Scanner",
          },
        ],
      },
      {
        id: 7,
        number: "07",
        role: "all",
        roleLabelTh: "ผู้ใช้งาน และ เจ้าหน้าที่",
        roleLabelEn: "Users & Staff Operation",
        titleTh: "การเช็คเอาท์ คืนช่องจอด & ศูนย์การแจ้งเตือน",
        titleEn: "Vehicle Check-out, Slot Release & Notification Hub",
        subtitleTh: "คืนช่องจอดว่างสู่ระบบอัตโนมัติ พร้อมประวัติและระบบแจ้งเตือนแบบเรียลไทม์",
        subtitleEn: "Automated slot release back to campus inventory with real-time notification alerts",
        descriptionTh:
          "เมื่อผู้ใช้ต้องการนำรถออก เจ้าหน้าที่กดปุ่ม 🔵 เช็คเอาท์ (Check-out) สถานะจะเปลี่ยนเป็น COMPLETED และช่องจอดจะคืนสถานะเป็นว่างทันที ระบบจะส่งการแจ้งเตือนไปยังหน้า Notifications ของผู้ใช้ พร้อมปุ่มคลิกดูประวัติการจองย้อนหลัง",
        descriptionEn:
          "When the car departs, staff tap 🔵 Check-out, automatically completing the session and returning the parking spot to available pool immediately. The user receives a completion alert with direct navigation link in their notifications inbox.",
        keyPointsTh: [
          "อัปเดตสถานะเป็น COMPLETED และบันทึกเวลาออกจริง",
          "ช่องจอดว่างจะถูกส่งคืนสู่ระบบแบบเรียลไทม์ ผู้ใช้อื่นสามารถจองต่อได้ทันที",
          "ศูนย์การแจ้งเตือนรองรับการค้นหา, แท็บแยกประเภท (การจอง, ระบบ, ยังไม่อ่าน) และการแบ่งหน้า",
          "มีปุ่มกดลิงก์ตรงไปยังการจองแต่ละรายการเพื่อดูประวัติย้อนหลังได้ตลอดเวลา",
        ],
        keyPointsEn: [
          "Session status transitions to COMPLETED with timestamped departure logs",
          "Parking spot returned instantly to available pool for other campus drivers",
          "Notification hub featuring search, filter tabs (Bookings, System, Unread), and pagination",
          "Direct deeplink buttons to inspect booking summaries anytime",
        ],
        tipsTh: "💡 ประวัติการจอง: ผู้ใช้สามารถเข้าดูประวัติการจอดรถทั้งหมดได้ที่เมนู 'การจองของฉัน' ในแถบเมนูหลัก",
        tipsEn: "💡 History: Users can review past parking transactions anytime in 'My Bookings'.",
        targetUrl: `/${locale}/app/notifications`,
        urlLabelTh: "เปิดดูศูนย์การแจ้งเตือน 🔔",
        urlLabelEn: "Open Notification Hub 🔔",
        imageSrc: "/guide/user-profile-overview.png",
        imageAlt: "User Profile, Account Verification & Staff Role",
        badgeColor: "#16a34a",
        badgeBg: "#dcfce7",
        gallery: [
          {
            src: "/guide/user-profile-history.png",
            alt: "User Booking History & Management",
            labelTh: "ประวัติการจอง & ลบบัญชี",
            labelEn: "Booking History & Actions",
          },
          {
            src: "/guide/user-vehicles-manage.png",
            alt: "User Vehicle & License Plate Management",
            labelTh: "จัดการรถและป้ายทะเบียน",
            labelEn: "My Vehicles & Plates",
          },
          {
            src: "/guide/notifications-profile.png",
            alt: "Notification Hub",
            labelTh: "ศูนย์การแจ้งเตือน",
            labelEn: "Notifications Inbox",
          },
        ],
      },
      {
        id: 8,
        number: "08",
        role: "admin",
        roleLabelTh: "ผู้ดูแลระบบ และ นักพัฒนา",
        roleLabelEn: "Admin & Developer Console",
        titleTh: "ศูนย์ควบคุมและบริหารจัดการระดับผู้ดูแลระบบ",
        titleEn: "Unified Admin Console, System Health & Audit Logging",
        subtitleTh: "จัดการการจองทั่วมหาวิทยาลัย ปรับยศผู้ใช้ สุขภาพเซิร์ฟเวอร์ และความปลอดภัย",
        subtitleEn: "University-wide booking manager, role governance, system telemetry, and audit trail",
        descriptionTh:
          "ผู้ดูแลระบบมีคอนโซลควบคุมเต็มรูปแบบ: ระบบบริหารจัดการและควบคุมความปลอดภัยระดับผู้ดูแลระบบ (Admin Role Governance) สามารถจัดการบทบาทผู้ใช้งาน (Admin/Staff/User), จัดการลานจอด 28 จุด, ควบคุมรายการจองทั้งหมด (Override สถานะ, แก้ไข, ลบรายการจอง), ตรวจสอบสุขภาพระบบ (Health Latency) และดู Audit Logs ประวัติการทำงานทั้งหมด",
        descriptionEn:
          "Administrators access an enterprise control room: Protected Administrator governance with role management (Admin/Staff/User), 28 area management, full booking manager with override/delete authority, system health telemetry, and tamper-evident audit logs.",
        keyPointsTh: [
          "ระบบบริหารสิทธิ์ผู้ดูแลระบบ (Admin Role Governance) และโหมด Sandbox สำหรับทดสอบ",
          "ระบบจัดการการจอง AdminBookingsManager: ค้นหา, กรองสถานะ, Override สถานะ, ลบรายการจองถาวร",
          "ระบบตรวจสอบสุขภาพระบบ SystemHealthPanel: เช็ค Latency ของ Database, Server, และ Auth",
          "บันทึก Audit Logs ตรวจสอบประวัติการทำงานของเจ้าหน้าที่และผู้ดูแลระบบทุกคนในมหาวิทยาลัย",
        ],
        keyPointsEn: [
          "Enterprise Administrator Role Governance & Security Protection",
          "Full-fledged AdminBookingsManager: Search, multi-status filters, status override, and hard-delete",
          "SystemHealthPanel telemetry: Live response time monitoring for Database, Server, and Auth",
          "Comprehensive Audit Logs auditing actions across all accounts with search and pagination",
        ],
        tipsTh: "💡 ความปลอดภัย: ระบบจำแนกสิทธิ์อย่างเด็ดขาด เจ้าหน้าที่ไม่สามารถเข้าถึงหน้า Admin ได้ และระบบจำกัดสิทธิ์การปรับแต่งเพื่อความปลอดภัยสูงสุด",
        tipsEn: "💡 Enterprise Security: Strict role boundaries prevent staff escalation and protect primary administrator privileges.",
        targetUrl: `/${locale}/admin/dashboard`,
        urlLabelTh: "เปิดแดชบอร์ดผู้ดูแลระบบ 👑",
        urlLabelEn: "Open Admin Dashboard 👑",
        imageSrc: "/guide/admin-management.png",
        imageAlt: "Admin Management Console",
        badgeColor: "#7c3aed",
        badgeBg: "#f3e8ff",
      },
    ],
    [locale]
  );

  // 2. Definition of Complete Website Architecture & URL Directory
  const sitemap: SitemapItem[] = useMemo(
    () => [
      // Public Pages
      {
        path: `/${locale}`,
        category: "public",
        categoryLabelTh: "หน้าสาธารณะ (Public)",
        categoryLabelEn: "Public Pages",
        titleTh: "หน้าแรกของระบบ (Homepage)",
        titleEn: "System Homepage",
        descriptionTh: "หน้าหลักสำหรับค้นหาจุดจอดรถ ดูสถานะลานจอดใกล้เคียง และปุ่มเริ่มจอง",
        descriptionEn: "Landing page with real-time nearby parking, search combobox, and instant booking CTA.",
        authRequired: "none",
        authBadgeTh: "ทุกคนเข้าถึงได้",
        authBadgeEn: "Public",
        isHighlight: true,
      },
      {
        path: `/${locale}/parking`,
        category: "public",
        categoryLabelTh: "หน้าสาธารณะ (Public)",
        categoryLabelEn: "Public Pages",
        titleTh: "รายการลานจอดรถทั้ง 28 จุด (All 28 Areas)",
        titleEn: "All 28 Campus Parking Lots",
        descriptionTh: "หน้ารวมลานจอด P01 ถึง P28 พร้อมตัวกรองประเภทรถ จำนวนช่องว่าง และพิกัด",
        descriptionEn: "Comprehensive catalog of areas P01 to P28 with availability filters and map links.",
        authRequired: "none",
        authBadgeTh: "ทุกคนเข้าถึงได้",
        authBadgeEn: "Public",
        isHighlight: true,
      },
      {
        path: `/${locale}/parking/p01`,
        category: "public",
        categoryLabelTh: "หน้าสาธารณะ (Public)",
        categoryLabelEn: "Public Pages",
        titleTh: "รายละเอียดลานจอดรายจุด (Area Detail - เช่น P01)",
        titleEn: "Individual Area Details (e.g. P01)",
        descriptionTh: "แสดงเวลาเปิด-ปิด สิ่งอำนวยความสะดวก ข้อมูลกล้อง CCTV และปุ่มนำทาง Google Maps",
        descriptionEn: "Operational hours, security amenities, CCTV availability, and turn-by-turn navigation.",
        authRequired: "none",
        authBadgeTh: "ทุกคนเข้าถึงได้",
        authBadgeEn: "Public",
      },
      {
        path: `/${locale}/parking/p01/slots`,
        category: "public",
        categoryLabelTh: "หน้าสาธารณะ (Public)",
        categoryLabelEn: "Public Pages",
        titleTh: "แผนผังช่องจอดรายจุด (Area Slot Grid)",
        titleEn: "Individual Area Slot Layout",
        descriptionTh: "ตารางแสดงสถานะว่าง/ไม่ว่างของช่องจอดแต่ละช่องในลานจอดนั้นๆ",
        descriptionEn: "Visual slot layout showing real-time occupancy status for specific bays.",
        authRequired: "none",
        authBadgeTh: "ทุกคนเข้าถึงได้",
        authBadgeEn: "Public",
      },
      {
        path: `/${locale}/map`,
        category: "public",
        categoryLabelTh: "หน้าสาธารณะ (Public)",
        categoryLabelEn: "Public Pages",
        titleTh: "แผนที่ 2D Campus Interactive Map",
        titleEn: "2D Interactive Campus Map",
        descriptionTh: "แผนที่เวกเตอร์ 2D ของมหาวิทยาลัยมหาสารคาม ซูมและเลื่อนดูตำแหน่งลานจอด 28 จุดได้",
        descriptionEn: "High-precision vector 2D map with smooth zooming and panning across campus zones.",
        authRequired: "none",
        authBadgeTh: "ทุกคนเข้าถึงได้",
        authBadgeEn: "Public",
        isHighlight: true,
      },
      {
        path: `/${locale}/about-project`,
        category: "public",
        categoryLabelTh: "หน้าสาธารณะ (Public)",
        categoryLabelEn: "Public Pages",
        titleTh: "ข้อมูลโครงงานและที่มา (About Project)",
        titleEn: "About Project & Design Thinking",
        descriptionTh: "ข้อมูลที่มา วัตถุประสงค์ และกระบวนการคิด Design Thinking 5 ขั้นตอน",
        descriptionEn: "Project background, objectives, and 5-stage Design Thinking methodology.",
        authRequired: "none",
        authBadgeTh: "ทุกคนเข้าถึงได้",
        authBadgeEn: "Public",
      },
      {
        path: `/${locale}/team`,
        category: "public",
        categoryLabelTh: "หน้าสาธารณะ (Public)",
        categoryLabelEn: "Public Pages",
        titleTh: "ทำเนียบทีมงานผู้พัฒนา (Team Directory)",
        titleEn: "Developer & Team Directory",
        descriptionTh: "ข้อมูลสมาชิกผู้พัฒนาระบบ BestCyniX Dev นักศึกษาและอาจารย์ที่ปรึกษา",
        descriptionEn: "Developer credentials, academic contributions, and advisor attributions.",
        authRequired: "none",
        authBadgeTh: "ทุกคนเข้าถึงได้",
        authBadgeEn: "Public",
      },
      {
        path: `/${locale}/guide`,
        category: "public",
        categoryLabelTh: "หน้าสาธารณะ (Public)",
        categoryLabelEn: "Public Pages",
        titleTh: "คู่มือการใช้งานและผังเว็บไซต์ (System Guide & Slides)",
        titleEn: "System Guide & Presentation Slides",
        descriptionTh: "หน้านำเสนอระบบ คู่มือวิธีใช้งาน 3 บทบาท และไดเรกทอรีผังเว็บไซต์สำหรับพรีเซนต์",
        descriptionEn: "Full system presentation slideshow, role manuals, and complete URL directory.",
        authRequired: "none",
        authBadgeTh: "ทุกคนเข้าถึงได้",
        authBadgeEn: "Public",
        isHighlight: true,
      },
      {
        path: `/${locale}/help`,
        category: "public",
        categoryLabelTh: "หน้าสาธารณะ (Public)",
        categoryLabelEn: "Public Pages",
        titleTh: "ศูนย์ช่วยเหลือและติดต่อสอบถาม (Help Center)",
        titleEn: "Help & Support Center",
        descriptionTh: "คำถามที่พบบ่อย (FAQ) ข้อแนะนำ และช่องทางการติดต่อเจ้าหน้าที่",
        descriptionEn: "Frequently asked questions and operational support channels.",
        authRequired: "none",
        authBadgeTh: "ทุกคนเข้าถึงได้",
        authBadgeEn: "Public",
      },
      {
        path: `/${locale}/report-bug`,
        category: "public",
        categoryLabelTh: "หน้าสาธารณะ (Public)",
        categoryLabelEn: "Public Pages",
        titleTh: "รายงานปัญหาและข้อผิดพลาด (Report Bug)",
        titleEn: "Bug & Issue Reporting",
        descriptionTh: "แบบฟอร์มส่งรายงานข้อผิดพลาดและบั๊กพร้อมแนบภาพหน้าจอ",
        descriptionEn: "Feedback form to report bugs, crashes, and visual anomalies.",
        authRequired: "none",
        authBadgeTh: "ทุกคนเข้าถึงได้",
        authBadgeEn: "Public",
      },
      {
        path: `/${locale}/feedback`,
        category: "public",
        categoryLabelTh: "หน้าสาธารณะ (Public)",
        categoryLabelEn: "Public Pages",
        titleTh: "ประเมินความพึงพอใจการใช้งาน (Rate Experience)",
        titleEn: "Experience Feedback Rating",
        descriptionTh: "แบบประเมินคะแนนความพึงพอใจ 1-5 ดาว และข้อเสนอแนะในการปรับปรุง",
        descriptionEn: "User satisfaction scoring survey and constructive suggestions.",
        authRequired: "none",
        authBadgeTh: "ทุกคนเข้าถึงได้",
        authBadgeEn: "Public",
      },

      // User App Pages
      {
        path: `/${locale}/login`,
        category: "user",
        categoryLabelTh: "ระบบผู้ใช้งาน (User App)",
        categoryLabelEn: "User App & Account",
        titleTh: "เข้าสู่ระบบ (Login)",
        titleEn: "User Authentication Login",
        descriptionTh: "เข้าสู่ระบบด้วยอีเมล/รหัสผ่าน, บัญชี Google MSU, หรือปุ่มด่วนสำหรับ Staff/Admin",
        descriptionEn: "Email/password, Google MSU authentication, and staff quick login toggle.",
        authRequired: "none",
        authBadgeTh: "สาธารณะ",
        authBadgeEn: "Public",
      },
      {
        path: `/${locale}/register`,
        category: "user",
        categoryLabelTh: "ระบบผู้ใช้งาน (User App)",
        categoryLabelEn: "User App & Account",
        titleTh: "สมัครสมาชิกใหม่ (Register)",
        titleEn: "New Account Registration",
        descriptionTh: "ลงทะเบียนผู้ใช้งานใหม่ด้วยอีเมลมหาวิทยาลัย (@msu.ac.th)",
        descriptionEn: "Register a new student or personnel account with university email validation.",
        authRequired: "none",
        authBadgeTh: "สาธารณะ",
        authBadgeEn: "Public",
      },
      {
        path: `/${locale}/app`,
        category: "user",
        categoryLabelTh: "ระบบผู้ใช้งาน (User App)",
        categoryLabelEn: "User App & Account",
        titleTh: "แดชบอร์ดผู้ใช้งาน (User Dashboard)",
        titleEn: "User App Dashboard",
        descriptionTh: "หน้าหลักสำหรับผู้ใช้ สรุปการจองล่าสุด ทางลัดการจอง และสถิติส่วนบุคคล",
        descriptionEn: "Personal user hub displaying active bookings, quick actions, and user shortcuts.",
        authRequired: "user",
        authBadgeTh: "ผู้ใช้เข้าสู่ระบบ",
        authBadgeEn: "Signed In User",
        isHighlight: true,
      },
      {
        path: `/${locale}/app/bookings`,
        category: "user",
        categoryLabelTh: "ระบบผู้ใช้งาน (User App)",
        categoryLabelEn: "User App & Account",
        titleTh: "รายการการจองของฉัน (My Bookings)",
        titleEn: "My Bookings History & QR Passes",
        descriptionTh: "ดูรายการจองทั้งหมด บัตร QR Pass สถานะการจอง และปุ่มยกเลิกหรือแก้ไข",
        descriptionEn: "Overview of all current and historical bookings with interactive QR pass cards.",
        authRequired: "user",
        authBadgeTh: "ผู้ใช้เข้าสู่ระบบ",
        authBadgeEn: "Signed In User",
        isHighlight: true,
      },
      {
        path: `/${locale}/app/bookings/new`,
        category: "user",
        categoryLabelTh: "ระบบผู้ใช้งาน (User App)",
        categoryLabelEn: "User App & Account",
        titleTh: "ทำรายการจองที่จอดรถใหม่ (New Booking)",
        titleEn: "New Parking Reservation Form",
        descriptionTh: "ฟอร์มสร้างการจอง เลือกลานจอด วัน เวลา และป้ายทะเบียนรถ",
        descriptionEn: "Complete reservation wizard with date picker, slot selector, and license plate auto-fill.",
        authRequired: "user",
        authBadgeTh: "ผู้ใช้เข้าสู่ระบบ",
        authBadgeEn: "Signed In User",
      },
      {
        path: `/${locale}/app/notifications`,
        category: "user",
        categoryLabelTh: "ระบบผู้ใช้งาน (User App)",
        categoryLabelEn: "User App & Account",
        titleTh: "ศูนย์การแจ้งเตือน (Notifications Hub)",
        titleEn: "Notifications Center",
        descriptionTh: "รับการแจ้งเตือนสถานะการจอง การเข้าจอด เช็คเอาท์ พร้อมแถบค้นหาและแท็บแยกหมวด",
        descriptionEn: "Real-time alert inbox with search, category tabs (Bookings, System, Unread) and deeplinks.",
        authRequired: "user",
        authBadgeTh: "ผู้ใช้เข้าสู่ระบบ",
        authBadgeEn: "Signed In User",
        isHighlight: true,
      },
      {
        path: `/${locale}/app/profile`,
        category: "user",
        categoryLabelTh: "ระบบผู้ใช้งาน (User App)",
        categoryLabelEn: "User App & Account",
        titleTh: "ข้อมูลโปรไฟล์ส่วนตัว (User Profile)",
        titleEn: "User Profile & Settings",
        descriptionTh: "ดูข้อมูลบัญชี ชื่อนามสกุล อีเมล ยศผู้ใช้ และอัปโหลดภาพโปรไฟล์",
        descriptionEn: "Profile management, full name, role badge, and avatar image cropper.",
        authRequired: "user",
        authBadgeTh: "ผู้ใช้เข้าสู่ระบบ",
        authBadgeEn: "Signed In User",
      },
      {
        path: `/${locale}/app/profile/vehicles`,
        category: "user",
        categoryLabelTh: "ระบบผู้ใช้งาน (User App)",
        categoryLabelEn: "User App & Account",
        titleTh: "จัดการข้อมูลยานพาหนะ (My Vehicles)",
        titleEn: "Saved Vehicles & Plates",
        descriptionTh: "เพิ่ม ลบ แก้ไขข้อมูลรถยนต์ รถมอเตอร์ไซค์ และป้ายทะเบียนที่ใช้งานประจำ",
        descriptionEn: "Register and manage personal vehicles and license plates for quick booking.",
        authRequired: "user",
        authBadgeTh: "ผู้ใช้เข้าสู่ระบบ",
        authBadgeEn: "Signed In User",
      },

      // Staff Station Pages
      {
        path: `/${locale}/staff/scan`,
        category: "staff",
        categoryLabelTh: "สถานีเจ้าหน้าที่ (Staff Station)",
        categoryLabelEn: "Staff Station",
        titleTh: "เครื่องสแกนบัตรผ่านลานจอด (Staff Pass Scanner)",
        titleEn: "Staff High-Speed Pass Scanner",
        descriptionTh: "ระบบสแกน QR Pass ผ่านกล้องมือถือ/แท็บเล็ต แถบเลือกจุดประจำการ P01-P28 และการโยกย้ายโซน",
        descriptionEn: "Mobile camera QR scanner, duty zone selector (P01-P28), shift tracker, and wrong-zone re-slotting.",
        authRequired: "staff",
        authBadgeTh: "เฉพาะ Staff & Admin",
        authBadgeEn: "Staff & Admin Only",
        isHighlight: true,
      },
      {
        path: `/${locale}/staff/dashboard`,
        category: "staff",
        categoryLabelTh: "สถานีเจ้าหน้าที่ (Staff Station)",
        categoryLabelEn: "Staff Station",
        titleTh: "แดชบอร์ดเจ้าหน้าที่ (Staff Dashboard)",
        titleEn: "Staff Operations Dashboard",
        descriptionTh: "ภาพรวมการปฏิบัติงาน จำนวนรถเข้า-ออกในรอบวัน และสถิติประจำจุด",
        descriptionEn: "Daily traffic summary, check-in counts, and duty metrics for assigned zones.",
        authRequired: "staff",
        authBadgeTh: "เฉพาะ Staff & Admin",
        authBadgeEn: "Staff & Admin Only",
      },
      {
        path: `/${locale}/staff/operations`,
        category: "staff",
        categoryLabelTh: "สถานีเจ้าหน้าที่ (Staff Station)",
        categoryLabelEn: "Staff Station",
        titleTh: "ปฏิบัติการแบบเรียลไทม์ (Staff Real-time Operations)",
        titleEn: "Live Field Operations",
        descriptionTh: "ติดตามสถานะรถจอดเข้า-ออกในลานจอดปัจจุบันแบบเรียลไทม์",
        descriptionEn: "Live timeline of parking entries, active stays, and departures.",
        authRequired: "staff",
        authBadgeTh: "เฉพาะ Staff & Admin",
        authBadgeEn: "Staff & Admin Only",
      },
      {
        path: `/${locale}/staff/incidents`,
        category: "staff",
        categoryLabelTh: "สถานีเจ้าหน้าที่ (Staff Station)",
        categoryLabelEn: "Staff Station",
        titleTh: "รายงานเหตุการณ์ผิดปกติ (Incident Reporting)",
        titleEn: "Field Incident Reports",
        descriptionTh: "บันทึกเหตุการณ์ฉุกเฉิน รถจอดเกินเวลา รถจอดผิดช่อง หรืออุบัติเหตุในลานจอด",
        descriptionEn: "Log security incidents, unauthorized parking, overstays, and traffic obstructions.",
        authRequired: "staff",
        authBadgeTh: "เฉพาะ Staff & Admin",
        authBadgeEn: "Staff & Admin Only",
      },

      // Admin Console Pages
      {
        path: `/${locale}/admin/dashboard`,
        category: "admin",
        categoryLabelTh: "ระบบผู้ดูแลระบบ (Admin Console)",
        categoryLabelEn: "Admin Console",
        titleTh: "แดชบอร์ดผู้ดูแลระบบ (Admin Dashboard)",
        titleEn: "Unified Admin Dashboard",
        descriptionTh: "ศูนย์รวมสถิติภาพรวม 28 ลานจอด อัตราการใช้งานรายชั่วโมง และข้อมูลสำคัญ",
        descriptionEn: "Campus-wide analytics, occupancy rates, hourly curves, and vital operational metrics.",
        authRequired: "admin",
        authBadgeTh: "เฉพาะ Admin เท่านั้น",
        authBadgeEn: "Admin Only",
        isHighlight: true,
      },
      {
        path: `/${locale}/admin/bookings`,
        category: "admin",
        categoryLabelTh: "ระบบผู้ดูแลระบบ (Admin Console)",
        categoryLabelEn: "Admin Console",
        titleTh: "จัดการการจองทั่วมหาวิทยาลัย (Bookings Manager)",
        titleEn: "University-wide Bookings Manager",
        descriptionTh: "ตารางรายการจองทั้งหมด ค้นหาตามรหัส/ทะเบียน/ชื่อ Override สถานะ และลบรายการจองถาวร",
        descriptionEn: "Complete table of university reservations with search, status override, plate edit, and hard delete.",
        authRequired: "admin",
        authBadgeTh: "เฉพาะ Admin เท่านั้น",
        authBadgeEn: "Admin Only",
        isHighlight: true,
      },
      {
        path: `/${locale}/admin/users`,
        category: "admin",
        categoryLabelTh: "ระบบผู้ดูแลระบบ (Admin Console)",
        categoryLabelEn: "Admin Console",
        titleTh: "จัดการผู้ใช้งานและยศ (User & Role Manager)",
        titleEn: "User & Role Governance",
        descriptionTh: "ปรับเปลี่ยนยศ (Admin, Staff, User) ปลด/ระงับบัญชี โดยคุ้มครอง Super Admin ถาวร",
        descriptionEn: "Manage user roles with non-demotable Super Admin protection and account deletion workflows.",
        authRequired: "admin",
        authBadgeTh: "เฉพาะ Admin เท่านั้น",
        authBadgeEn: "Admin Only",
        isHighlight: true,
      },
      {
        path: `/${locale}/admin/parking-areas`,
        category: "admin",
        categoryLabelTh: "ระบบผู้ดูแลระบบ (Admin Console)",
        categoryLabelEn: "Admin Console",
        titleTh: "จัดการพื้นที่จอดรถ 28 จุด (Parking Areas Manager)",
        titleEn: "28 Parking Areas Manager",
        descriptionTh: "เปิด-ปิดลานจอด ปรับจำนวนช่องจอด และแก้ไขข้อมูลสิ่งอำนวยความสะดวก",
        descriptionEn: "Configure capacity, operational status, and equipment across all 28 lots.",
        authRequired: "admin",
        authBadgeTh: "เฉพาะ Admin เท่านั้น",
        authBadgeEn: "Admin Only",
      },
      {
        path: `/${locale}/admin/scan`,
        category: "admin",
        categoryLabelTh: "ระบบผู้ดูแลระบบ (Admin Console)",
        categoryLabelEn: "Admin Console",
        titleTh: "เครื่องสแกนบัตรพร้อมสิทธิ์เต็ม (Admin Scanner)",
        titleEn: "Admin Full-Authority Scanner",
        descriptionTh: "สแกนบัตรผ่านพร้อมสิทธิ์ Override สถานะ และปุ่มลบรายการจองออกจากระบบ",
        descriptionEn: "Scanner interface equipped with status override selector and permanent deletion button.",
        authRequired: "admin",
        authBadgeTh: "เฉพาะ Admin เท่านั้น",
        authBadgeEn: "Admin Only",
      },
      {
        path: `/${locale}/admin/health`,
        category: "admin",
        categoryLabelTh: "ระบบผู้ดูแลระบบ (Admin Console)",
        categoryLabelEn: "Admin Console",
        titleTh: "ตรวจสอบสุขภาพระบบ (System Health)",
        titleEn: "System Health & Telemetry",
        descriptionTh: "ตรวจสอบ Latency ของ Server, Database, Auth และความเสถียรของ API",
        descriptionEn: "Live telemetry tracking database response latency, server health, and API uptime.",
        authRequired: "admin",
        authBadgeTh: "เฉพาะ Admin เท่านั้น",
        authBadgeEn: "Admin Only",
        isHighlight: true,
      },
      {
        path: `/${locale}/admin/audit-logs`,
        category: "admin",
        categoryLabelTh: "ระบบผู้ดูแลระบบ (Admin Console)",
        categoryLabelEn: "Admin Console",
        titleTh: "ประวัติการใช้งานและตรวจสอบ (Audit Logs)",
        titleEn: "System Audit Logs",
        descriptionTh: "บันทึกประวัติการกระทำของผู้ดูแลระบบและเจ้าหน้าที่ทุกคน ตรวจสอบย้อนหลังได้",
        descriptionEn: "Audit trail logging security actions, role updates, and system configuration modifications.",
        authRequired: "admin",
        authBadgeTh: "เฉพาะ Admin เท่านั้น",
        authBadgeEn: "Admin Only",
      },
      {
        path: `/${locale}/admin/settings`,
        category: "admin",
        categoryLabelTh: "ระบบผู้ดูแลระบบ (Admin Console)",
        categoryLabelEn: "Admin Console",
        titleTh: "ตั้งค่าระบบและนโยบาย (System Settings)",
        titleEn: "System Policies & Settings",
        descriptionTh: "กำหนดนโยบายการจอง ระยะเวลาสูงสุด การแจ้งเตือน และการจำกัดสิทธิ์",
        descriptionEn: "Configure system-wide booking quotas, grace periods, and operational rules.",
        authRequired: "admin",
        authBadgeTh: "เฉพาะ Admin เท่านั้น",
        authBadgeEn: "Admin Only",
      },
      {
        path: `/${locale}/developer`,
        category: "admin",
        categoryLabelTh: "ระบบผู้ดูแลระบบ (Admin Console)",
        categoryLabelEn: "Admin Console",
        titleTh: "ศูนย์ควบคุมนักพัฒนา (Developer Console)",
        titleEn: "Developer Console & Feature Flags",
        descriptionTh: "จัดการ Feature Flags ทดสอบ API และเครื่องมือวิเคราะห์เชิงลึกสำหรับนักพัฒนา",
        descriptionEn: "Developer sandbox, toggleable feature flags, and environment diagnostics.",
        authRequired: "admin",
        authBadgeTh: "เฉพาะ Admin / Dev",
        authBadgeEn: "Admin / Dev Only",
      },
    ],
    [locale]
  );

  // Stepper navigation handlers
  const handleNext = useCallback(() => {
    setCurrentStep((prev) => (prev < steps.length - 1 ? prev + 1 : 0));
  }, [steps.length]);

  const handlePrev = useCallback(() => {
    setCurrentStep((prev) => (prev > 0 ? prev - 1 : steps.length - 1));
  }, [steps.length]);

  const handleReset = useCallback(() => {
    setCurrentStep(0);
    setIsPlaying(false);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (activeTab !== "slides") return;
      if (e.key === "ArrowRight" || e.key === "PageDown") {
        e.preventDefault();
        handleNext();
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        handlePrev();
      } else if (e.key === "Home") {
        e.preventDefault();
        setCurrentStep(0);
      } else if (e.key === "End") {
        e.preventDefault();
        setCurrentStep(steps.length - 1);
      } else if (e.key === " ") {
        e.preventDefault();
        setIsPlaying((p) => !p);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeTab, handleNext, handlePrev, steps.length]);

  // Auto-play slideshow timer
  useEffect(() => {
    if (!isPlaying || activeTab !== "slides") return;
    const timer = setInterval(() => {
      setCurrentStep((prev) => (prev < steps.length - 1 ? prev + 1 : 0));
    }, 7500);
    return () => clearInterval(timer);
  }, [isPlaying, activeTab, steps.length]);

  // Touch Swipe for mobile presentation
  function handleTouchStart(e: React.TouchEvent) {
    touchStartXRef.current = e.touches[0].clientX;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartXRef.current === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartXRef.current - touchEndX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        handleNext(); // swipe left -> next
      } else {
        handlePrev(); // swipe right -> prev
      }
    }
    touchStartXRef.current = null;
  }

  // Copy helper
  function handleCopy(text: string, key: string) {
    void navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  }

  // Filtered sitemap
  const filteredSitemap = useMemo(() => {
    return sitemap.filter((item) => {
      const matchCat = sitemapCategory === "all" || item.category === sitemapCategory;
      const query = sitemapSearch.toLowerCase().trim();
      if (!query) return matchCat;
      const matchText =
        item.titleTh.toLowerCase().includes(query) ||
        item.titleEn.toLowerCase().includes(query) ||
        item.descriptionTh.toLowerCase().includes(query) ||
        item.descriptionEn.toLowerCase().includes(query) ||
        item.path.toLowerCase().includes(query);
      return matchCat && matchText;
    });
  }, [sitemap, sitemapCategory, sitemapSearch]);

  const activeStepData = steps[currentStep];

  return (
    <div
      className={`system-guide-wrap ${isFullscreen ? "fullscreen-mode" : ""}`}
      ref={containerRef}
      style={{
        maxWidth: isFullscreen ? "100vw" : 1200,
        margin: isFullscreen ? "0" : "0 auto",
        padding: isFullscreen ? "16px 20px" : "12px 16px 40px",
        background: isFullscreen ? "var(--canvas)" : "transparent",
        minHeight: isFullscreen ? "100vh" : "auto",
        transition: "all 300ms ease",
      }}
    >
      {/* Top Presentation Header Card */}
      <header
        className="review-panel"
        style={{
          padding: "20px 24px",
          borderRadius: 20,
          marginBottom: 20,
          background: "linear-gradient(135deg, var(--surface) 0%, var(--canvas) 100%)",
          border: "1px solid var(--line)",
          boxShadow: "0 8px 30px rgba(0,0,0,0.04)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "4px 12px", borderRadius: 20, background: "var(--gold-soft)", color: "#9a7800", fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
              <Sparkles size={14} />
              <span>{isTh ? "เอกสารนำเสนอและคู่มือระบบฉบับสมบูรณ์" : "Official Project Presentation & Master Guide"}</span>
            </div>
            <h1 style={{ margin: "0 0 6px", fontSize: 24, fontWeight: 800, color: "var(--ink)", letterSpacing: "-0.5px" }}>
              {isTh ? "คู่มือการใช้งานระบบ & ผังเว็บไซต์ ParkSpace MSU" : "ParkSpace MSU System Guide & Architecture Directory"}
            </h1>
            <p style={{ margin: 0, fontSize: 13, color: "var(--muted)", maxWidth: 720, lineHeight: 1.5 }}>
              {isTh
                ? "รวบรวมวิธีใช้งานทุกฟังก์ชันสำหรับคนทั่วไป, เจ้าหน้าที่ลานจอด (Staff), และผู้ดูแลระบบ (Admin) พร้อมระบบสไลด์นำเสนอขั้นตอนจริงและผัง URL ทั้งหมดสำหรับนำเสนอโปรเจกต์"
                : "Comprehensive user guide covering General Public, Field Staff, and System Admins, complete with interactive step-by-step slides and live URL sitemap directory."}
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              className="ghost-button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 36, fontSize: 12, borderRadius: 10 }}
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Presentation"}
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              <span>{isFullscreen ? (isTh ? "ย่อหน้าจอ" : "Exit Fullscreen") : (isTh ? "โหมดเต็มจอ" : "Fullscreen")}</span>
            </button>

            <Link
              href={`/${locale}`}
              className="secondary-button"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 36, fontSize: 12, borderRadius: 10 }}
            >
              <ArrowLeft size={15} />
              <span>{isTh ? "กลับหน้าแรก" : "Back to Home"}</span>
            </Link>
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <nav
          style={{
            display: "flex",
            gap: 8,
            overflowX: "auto",
            paddingTop: 16,
            marginTop: 16,
            borderTop: "1px solid var(--line)",
          }}
          aria-label="Presentation Navigation Tabs"
        >
          <button
            type="button"
            className={`chip ${activeTab === "slides" ? "active" : ""}`}
            onClick={() => setActiveTab("slides")}
            style={{
              padding: "8px 16px",
              borderRadius: 12,
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Play size={15} />
            <span>{isTh ? "สไลด์นำเสนอขั้นตอนจริง (Interactive Slides)" : "Interactive Slides"}</span>
          </button>

          <button
            type="button"
            className={`chip ${activeTab === "manual" ? "active" : ""}`}
            onClick={() => setActiveTab("manual")}
            style={{
              padding: "8px 16px",
              borderRadius: 12,
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <BookOpen size={15} />
            <span>{isTh ? "คู่มือวิธีใช้งานแยก 3 บทบาท (Role Manual)" : "3-Role User Manual"}</span>
          </button>

          <button
            type="button"
            className={`chip ${activeTab === "sitemap" ? "active" : ""}`}
            onClick={() => setActiveTab("sitemap")}
            style={{
              padding: "8px 16px",
              borderRadius: 12,
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Layers size={15} />
            <span>{isTh ? "ผังเว็บไซต์ & URL นำเสนอ (Sitemap & URLs)" : "Website Sitemap & URLs"}</span>
            <span style={{ fontSize: 11, background: "rgba(0,0,0,0.06)", padding: "1px 6px", borderRadius: 8 }}>
              {sitemap.length}
            </span>
          </button>

          <button
            type="button"
            className={`chip ${activeTab === "credentials" ? "active" : ""}`}
            onClick={() => setActiveTab("credentials")}
            style={{
              padding: "8px 16px",
              borderRadius: 12,
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <ShieldCheck size={15} />
            <span>{isTh ? "ข้อมูลบัญชีสำหรับทดสอบพรีเซนต์ (Credentials)" : "Test Credentials"}</span>
          </button>
        </nav>
      </header>

      {/* ========================================================================= */}
      {/* TAB 1: INTERACTIVE STEP-BY-STEP SLIDESHOW (โหมดนำเสนอสไลด์ขั้นตอนจริง)    */}
      {/* ========================================================================= */}
      {activeTab === "slides" && (
        <section
          aria-label="Interactive Step-by-Step Slides"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          style={{ display: "grid", gap: 18 }}
        >
          {/* Stepper Progress Control Bar */}
          <div
            className="review-panel"
            style={{
              padding: "16px 20px",
              borderRadius: 16,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 12,
              background: "var(--surface)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span
                style={{
                  fontSize: 18,
                  fontWeight: 900,
                  color: "var(--gold-deep)",
                  background: "var(--gold-soft)",
                  padding: "4px 12px",
                  borderRadius: 10,
                }}
              >
                {activeStepData.number}
              </span>
              <div>
                <span style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700 }}>
                  {isTh ? `ขั้นตอนที่ ${currentStep + 1} จากทั้งหมด ${steps.length} ขั้นตอน` : `Step ${currentStep + 1} of ${steps.length}`}
                </span>
                <h3 style={{ margin: "2px 0 0", fontSize: 15, fontWeight: 800, color: "var(--ink)" }}>
                  {isTh ? activeStepData.titleTh : activeStepData.titleEn}
                </h3>
              </div>
            </div>

            {/* Stepper Dots & Player Controls */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              {/* Quick Jump Dots */}
              <div style={{ display: "flex", gap: 6 }}>
                {steps.map((s, idx) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setCurrentStep(idx)}
                    title={`${s.number}: ${isTh ? s.titleTh : s.titleEn}`}
                    style={{
                      width: currentStep === idx ? 24 : 10,
                      height: 10,
                      borderRadius: 5,
                      border: "none",
                      background: currentStep === idx ? "var(--gold)" : "var(--line)",
                      cursor: "pointer",
                      transition: "all 250ms ease",
                      padding: 0,
                    }}
                  />
                ))}
              </div>

              {/* Play / Pause Auto Slider */}
              <button
                type="button"
                className="ghost-button"
                onClick={() => setIsPlaying(!isPlaying)}
                style={{ height: 32, padding: "0 10px", fontSize: 11, borderRadius: 8, display: "inline-flex", alignItems: "center", gap: 4 }}
                title={isPlaying ? "Pause Auto-Slide" : "Play Auto-Slide"}
              >
                {isPlaying ? <Pause size={13} /> : <Play size={13} />}
                <span>{isPlaying ? (isTh ? "หยุดชั่วคราว" : "Pause") : (isTh ? "เล่นอัตโนมัติ" : "Auto Play")}</span>
              </button>

              {/* Prev / Next Buttons */}
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={handlePrev}
                  style={{ height: 36, padding: "0 14px", borderRadius: 10, display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700 }}
                  title="Previous Step (ArrowLeft)"
                >
                  <ChevronLeft size={16} />
                  <span>{isTh ? "ถอยหลัง (ก่อนหน้า)" : "Previous"}</span>
                </button>

                <button
                  type="button"
                  className="primary-button"
                  onClick={handleNext}
                  style={{ height: 36, padding: "0 16px", borderRadius: 10, display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 800 }}
                  title="Next Step (ArrowRight)"
                >
                  <span>{isTh ? "เลื่อนไปหน้า (ถัดไป)" : "Next Step"}</span>
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>

          {/* Main Slide Presentation Stage */}
          <div
            className="review-panel"
            style={{
              padding: 0,
              borderRadius: 20,
              overflow: "hidden",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              background: "var(--surface)",
              boxShadow: "0 12px 36px rgba(0,0,0,0.06)",
              border: "1px solid var(--line)",
            }}
          >
            {/* Left Column: Visual Screen Showcase */}
            <div
              style={{
                position: "relative",
                background: "radial-gradient(circle at center, #1e293b 0%, #0f172a 100%)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "24px 20px",
                minHeight: 400,
              }}
            >
              {(() => {
                const currentImgSrc = selectedImageOverride || activeStepData.imageSrc;
                return (
                  <>
                    <div
                      style={{
                        position: "relative",
                        width: "100%",
                        maxWidth: 520,
                        borderRadius: 14,
                        overflow: "hidden",
                        boxShadow: "0 20px 40px rgba(0,0,0,0.4)",
                        border: "2px solid rgba(255,255,255,0.1)",
                        cursor: "zoom-in",
                      }}
                      onClick={() =>
                        setLightboxImage({
                          src: currentImgSrc,
                          title: isTh ? activeStepData.titleTh : activeStepData.titleEn,
                        })
                      }
                    >
                      {/* Browser-like Mockup Header */}
                      <div
                        style={{
                          background: "#090d16",
                          padding: "8px 12px",
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          borderBottom: "1px solid rgba(255,255,255,0.08)",
                        }}
                      >
                        <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#ef4444" }} />
                        <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#f59e0b" }} />
                        <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#10b981" }} />
                        <span style={{ fontSize: 10, color: "#94a3b8", marginLeft: 8, fontFamily: "monospace" }}>
                          parkspace-msu.vercel.app{activeStepData.targetUrl}
                        </span>
                      </div>

                      <img
                        src={currentImgSrc}
                        alt={activeStepData.imageAlt}
                        style={{
                          width: "100%",
                          height: "auto",
                          maxHeight: 380,
                          objectFit: "contain",
                          display: "block",
                          background: "#020617",
                        }}
                      />

                      <div
                        style={{
                          position: "absolute",
                          bottom: 8,
                          right: 8,
                          background: "rgba(0,0,0,0.65)",
                          backdropFilter: "blur(4px)",
                          color: "#fff",
                          padding: "4px 8px",
                          borderRadius: 6,
                          fontSize: 10,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <Eye size={12} />
                        <span>{isTh ? "คลิกเพื่อขยายภาพ" : "Click to Enlarge"}</span>
                      </div>
                    </div>

                    {/* Gallery View Switcher */}
                    {activeStepData.gallery && activeStepData.gallery.length > 0 && (
                      <div
                        style={{
                          display: "flex",
                          gap: 6,
                          marginTop: 10,
                          flexWrap: "wrap",
                          justifyContent: "center",
                          alignItems: "center",
                        }}
                      >
                        <span style={{ fontSize: 10, color: "#94a3b8", marginRight: 2 }}>
                          {isTh ? "มุมมอง:" : "Views:"}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedImageOverride(activeStepData.imageSrc);
                          }}
                          style={{
                            padding: "4px 9px",
                            borderRadius: 6,
                            fontSize: 11,
                            cursor: "pointer",
                            border:
                              currentImgSrc === activeStepData.imageSrc
                                ? "1px solid #38bdf8"
                                : "1px solid rgba(255,255,255,0.15)",
                            background:
                              currentImgSrc === activeStepData.imageSrc
                                ? "rgba(56,189,248,0.2)"
                                : "rgba(255,255,255,0.06)",
                            color: currentImgSrc === activeStepData.imageSrc ? "#38bdf8" : "#94a3b8",
                            fontWeight: currentImgSrc === activeStepData.imageSrc ? 700 : 500,
                            transition: "all 0.15s ease",
                          }}
                        >
                          {isTh ? "ภาพหลัก" : "Primary"}
                        </button>
                        {activeStepData.gallery.map((g, idx) => {
                          const isSelected = currentImgSrc === g.src;
                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedImageOverride(g.src);
                              }}
                              style={{
                                padding: "4px 9px",
                                borderRadius: 6,
                                fontSize: 11,
                                cursor: "pointer",
                                border: isSelected
                                  ? "1px solid #38bdf8"
                                  : "1px solid rgba(255,255,255,0.15)",
                                background: isSelected
                                  ? "rgba(56,189,248,0.2)"
                                  : "rgba(255,255,255,0.06)",
                                color: isSelected ? "#38bdf8" : "#94a3b8",
                                fontWeight: isSelected ? 700 : 500,
                                transition: "all 0.15s ease",
                              }}
                            >
                              {isTh ? g.labelTh : g.labelEn}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </>
                );
              })()}

              <span style={{ color: "#94a3b8", fontSize: 11, marginTop: 10 }}>
                {isTh ? "ภาพหน้าจอจริงของระบบในขั้นตอนนี้" : "Actual verified production screenshot"}
              </span>
            </div>

            {/* Right Column: Step Explanation & Guided Actions */}
            <div style={{ padding: "28px 26px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                {/* Role Badge & Subtitle */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 800,
                      padding: "3px 10px",
                      borderRadius: 20,
                      background: activeStepData.badgeBg,
                      color: activeStepData.badgeColor,
                      textTransform: "uppercase",
                    }}
                  >
                    {isTh ? activeStepData.roleLabelTh : activeStepData.roleLabelEn}
                  </span>
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>
                    {isTh ? activeStepData.subtitleTh : activeStepData.subtitleEn}
                  </span>
                </div>

                <h2 style={{ margin: "0 0 12px", fontSize: 21, fontWeight: 800, color: "var(--ink)", lineHeight: 1.35 }}>
                  {isTh ? activeStepData.titleTh : activeStepData.titleEn}
                </h2>

                <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--ink)", lineHeight: 1.6 }}>
                  {isTh ? activeStepData.descriptionTh : activeStepData.descriptionEn}
                </p>

                {/* Key Points Checklist */}
                <div style={{ marginBottom: 18 }}>
                  <strong style={{ fontSize: 12, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 8 }}>
                    {isTh ? "จุดเด่นและสิ่งที่ระบบทำได้ในขั้นตอนนี้:" : "Key Capabilities & Features in this Step:"}
                  </strong>
                  <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none", display: "grid", gap: 7 }}>
                    {(isTh ? activeStepData.keyPointsTh : activeStepData.keyPointsEn).map((point, pIdx) => (
                      <li key={pIdx} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12.5, color: "var(--ink)" }}>
                        <CheckCircle2 size={15} color="#16a34a" style={{ flexShrink: 0, marginTop: 2 }} />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Important Tips Banner */}
                <div
                  style={{
                    padding: "10px 14px",
                    borderRadius: 12,
                    background: "var(--gold-soft)",
                    border: "1px solid rgba(248, 201, 40, 0.3)",
                    fontSize: 12,
                    color: "var(--ink)",
                    lineHeight: 1.5,
                  }}
                >
                  {isTh ? activeStepData.tipsTh : activeStepData.tipsEn}
                </div>
              </div>

              {/* Action Bar: Direct Link to Live Page & Navigation */}
              <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                <Link
                  href={activeStepData.targetUrl}
                  target="_blank"
                  className="primary-button"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "10px 18px",
                    borderRadius: 12,
                    fontWeight: 800,
                    fontSize: 13,
                    boxShadow: "0 4px 14px rgba(248, 201, 40, 0.25)",
                  }}
                >
                  <span>{isTh ? activeStepData.urlLabelTh : activeStepData.urlLabelEn}</span>
                  <ExternalLink size={15} />
                </Link>

                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={handleReset}
                    style={{ fontSize: 11, height: 32, padding: "0 10px", borderRadius: 8 }}
                  >
                    {isTh ? "เริ่มใหม่" : "Restart"}
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={handleNext}
                    style={{ fontSize: 12, height: 36, padding: "0 14px", borderRadius: 10, fontWeight: 700 }}
                  >
                    <span>{isTh ? "ขั้นตอนถัดไป ➔" : "Next Step ➔"}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Step Matrix Grid (Jump to any step) */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 10 }}>
            {steps.map((s, idx) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setCurrentStep(idx)}
                style={{
                  textAlign: "left",
                  padding: "12px 14px",
                  borderRadius: 12,
                  background: currentStep === idx ? "var(--gold-soft)" : "var(--surface)",
                  border: currentStep === idx ? "1.5px solid var(--gold)" : "1px solid var(--line)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  transition: "all 150ms ease",
                }}
              >
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 900,
                    color: currentStep === idx ? "var(--gold-deep)" : "var(--muted)",
                    background: "var(--canvas)",
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    display: "grid",
                    placeItems: "center",
                    flexShrink: 0,
                  }}
                >
                  {s.number}
                </span>
                <div style={{ minWidth: 0 }}>
                  <strong style={{ display: "block", fontSize: 12, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {isTh ? s.titleTh : s.titleEn}
                  </strong>
                  <span style={{ fontSize: 10, color: "var(--muted)" }}>
                    {isTh ? s.roleLabelTh : s.roleLabelEn}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: DETAILED 3-ROLE USER MANUAL (คู่มือการใช้งานแยก 3 บทบาท)           */}
      {/* ========================================================================= */}
      {activeTab === "manual" && (
        <section aria-label="Role-based Manual" style={{ display: "grid", gap: 20 }}>
          {/* Role Filter Selector */}
          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
            <button
              type="button"
              className={`chip ${manualRole === "all" ? "active" : ""}`}
              onClick={() => setManualRole("all")}
              style={{ padding: "8px 16px", borderRadius: 12, fontWeight: 700, fontSize: 13, cursor: "pointer" }}
            >
              {isTh ? "ดูทุกบทบาท (Overview)" : "All Roles"}
            </button>
            <button
              type="button"
              className={`chip ${manualRole === "user" ? "active" : ""}`}
              onClick={() => setManualRole("user")}
              style={{ padding: "8px 16px", borderRadius: 12, fontWeight: 700, fontSize: 13, cursor: "pointer" }}
            >
              <User size={14} style={{ display: "inline", marginRight: 6 }} />
              {isTh ? "สำหรับผู้ใช้งานทั่วไป / นิสิต" : "General Users & Students"}
            </button>
            <button
              type="button"
              className={`chip ${manualRole === "staff" ? "active" : ""}`}
              onClick={() => setManualRole("staff")}
              style={{ padding: "8px 16px", borderRadius: 12, fontWeight: 700, fontSize: 13, cursor: "pointer" }}
            >
              <UserCheck size={14} style={{ display: "inline", marginRight: 6 }} />
              {isTh ? "สำหรับเจ้าหน้าที่ลานจอด (Staff)" : "Parking Staff"}
            </button>
            <button
              type="button"
              className={`chip ${manualRole === "admin" ? "active" : ""}`}
              onClick={() => setManualRole("admin")}
              style={{ padding: "8px 16px", borderRadius: 12, fontWeight: 700, fontSize: 13, cursor: "pointer" }}
            >
              <ShieldCheck size={14} style={{ display: "inline", marginRight: 6 }} />
              {isTh ? "สำหรับผู้ดูแลระบบ (Admin)" : "System Administrators"}
            </button>
          </div>

          {/* Section A: User Guide */}
          {(manualRole === "all" || manualRole === "user") && (
            <div className="review-panel" style={{ padding: 24, borderRadius: 18, borderLeft: "5px solid #0284c7" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <span style={{ width: 40, height: 40, borderRadius: 12, background: "#e0f2fe", color: "#0284c7", display: "grid", placeItems: "center" }}>
                  <User size={22} />
                </span>
                <div>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "var(--ink)" }}>
                    {isTh ? "1. คู่มือการใช้งานสำหรับคนทั่วไป / นักศึกษา / บุคลากร" : "1. Guide for General Users & Students"}
                  </h3>
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>
                    {isTh ? "การค้นหา จอง รับบัตรผ่าน และเดินทางเข้าจอด" : "Search, Booking, QR Pass, and Arrival Navigation"}
                  </span>
                </div>
              </div>

              <div style={{ display: "grid", gap: 14, fontSize: 13, color: "var(--ink)", lineHeight: 1.6 }}>
                <div style={{ background: "var(--canvas)", padding: "14px 18px", borderRadius: 12, border: "1px solid var(--line)" }}>
                  <strong style={{ color: "#0284c7", display: "block", marginBottom: 4 }}>
                    {isTh ? "ขั้นตอนที่ 1: การค้นหาและตรวจสอบลานจอด 28 จุด" : "Step 1: Discover & Check 28 Parking Areas"}
                  </strong>
                  <p style={{ margin: 0 }}>
                    {isTh
                      ? "ไปที่เมนู 'พื้นที่จอดรถ' (หรือกดค้นหาจากหน้าแรก) ระบบจะแสดงรายการลานจอด P01 ถึง P28 พร้อมจำนวนช่องว่างสดๆ สามารถกดดูแผนที่ 2D Campus Map หรือกรองเฉพาะลานที่มีช่องว่างสำหรับรถยนต์หรือมอเตอร์ไซค์ได้"
                      : "Visit 'Parking Areas' or search directly from homepage. The system lists lots P01 through P28 with live vacancy counters, filterable by vehicle type."}
                  </p>
                </div>

                <div style={{ background: "var(--canvas)", padding: "14px 18px", borderRadius: 12, border: "1px solid var(--line)" }}>
                  <strong style={{ color: "#0284c7", display: "block", marginBottom: 4 }}>
                    {isTh ? "ขั้นตอนที่ 2: การจองช่องจอดและเลือกช่วงเวลา" : "Step 2: Reserve a Specific Slot & Time"}
                  </strong>
                  <p style={{ margin: 0 }}>
                    {isTh
                      ? "เลือกลานจอดที่ต้องการ จากนั้นกด 'จองช่องจอดนี้' เลือกวันและเวลาเข้า-ออก ระบุป้ายทะเบียนรถ (สามารถเลือกจากรถที่บันทึกไว้ในโปรไฟล์) แล้วกดยืนยันการจอง"
                      : "Select your preferred lot, click 'Book Slot', specify arrival/departure duration, confirm your plate, and finalize the reservation."}
                  </p>
                </div>

                <div style={{ background: "var(--canvas)", padding: "14px 18px", borderRadius: 12, border: "1px solid var(--line)" }}>
                  <strong style={{ color: "#0284c7", display: "block", marginBottom: 4 }}>
                    {isTh ? "ขั้นตอนที่ 3: รับบัตรผ่าน QR Pass และเดินทางเข้าจอด" : "Step 3: Digital QR Pass & Arrival"}
                  </strong>
                  <p style={{ margin: 0 }}>
                    {isTh
                      ? "เมื่อจองสำเร็จ ระบบจะเปิดหน้าบัตรผ่านดิจิทัล (Digital QR Pass) ให้ทันที คุณสามารถกดปุ่ม 'นำทาง (Google Maps)' เพื่อขับรถมายังทางเข้าลานจอด เมื่อถึงทางเข้าให้เปิดบัตร QR Pass ให้เจ้าหน้าที่สแกนเช็คอิน"
                      : "Instant QR Pass generation. Tap 'Navigate' for turn-by-turn routing to the lot entrance. Present your QR screen to the booth staff for check-in."}
                  </p>
                </div>

                <div style={{ background: "var(--canvas)", padding: "14px 18px", borderRadius: 12, border: "1px solid var(--line)" }}>
                  <strong style={{ color: "#0284c7", display: "block", marginBottom: 4 }}>
                    {isTh ? "ขั้นตอนที่ 4: การแจ้งเตือนและการเสร็จสิ้น" : "Step 4: Notifications & Checkout"}
                  </strong>
                  <p style={{ margin: 0 }}>
                    {isTh
                      ? "ระบบจะส่งการแจ้งเตือนเมื่อใกล้หมดเวลา และเมื่อเจ้าหน้าที่สแกนเช็คเอาท์ สถานะจะเปลี่ยนเป็น COMPLETED สามารถตรวจสอบประวัติย้อนหลังได้ตลอดเวลาที่เมนู 'การจองของฉัน'"
                      : "Receive automatic time alerts. Once staff checks you out, the status is marked COMPLETED, permanently logged in your bookings archive."}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Section B: Staff Guide */}
          {(manualRole === "all" || manualRole === "staff") && (
            <div className="review-panel" style={{ padding: 24, borderRadius: 18, borderLeft: "5px solid #d97706" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <span style={{ width: 40, height: 40, borderRadius: 12, background: "#fef3c7", color: "#d97706", display: "grid", placeItems: "center" }}>
                  <UserCheck size={22} />
                </span>
                <div>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "var(--ink)" }}>
                    {isTh ? "2. คู่มือการปฏิบัติงานสำหรับเจ้าหน้าที่ลานจอด (Staff Station)" : "2. Operational Guide for Parking Staff"}
                  </h3>
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>
                    {isTh ? "การเข้าเวรประจำจุด สแกนบัตร ตรวจสอบ และโยกย้ายโซนกรณีมาผิดลาน" : "Duty Station Setup, QR Scanning, Verification & Re-slotting"}
                  </span>
                </div>
              </div>

              <div style={{ display: "grid", gap: 14, fontSize: 13, color: "var(--ink)", lineHeight: 1.6 }}>
                <div style={{ background: "var(--canvas)", padding: "14px 18px", borderRadius: 12, border: "1px solid var(--line)" }}>
                  <strong style={{ color: "#d97706", display: "block", marginBottom: 4 }}>
                    {isTh ? "1. การเข้าสู่ระบบด้วยบัญชีกลาง Staff" : "1. Staff Central Account Sign-in"}
                  </strong>
                  <p style={{ margin: 0 }}>
                    {isTh
                      ? "เข้าสู่ระบบด้วยชื่อผู้ใช้ 'staff' หรืออีเมล 'staff@msu.ac.th' รหัสผ่าน 'staff123' ระบบจะพาท่านเข้าสู่หน้าจอเจ้าหน้าที่โดยอัตโนมัติ"
                      : "Sign in with username 'staff' or email 'staff@msu.ac.th' with password 'staff123'. The app automatically mounts the Staff Console."}
                  </p>
                </div>

                <div style={{ background: "var(--canvas)", padding: "14px 18px", borderRadius: 12, border: "1px solid var(--line)" }}>
                  <strong style={{ color: "#d97706", display: "block", marginBottom: 4 }}>
                    {isTh ? "2. การเลือกจุดประจำการเวร (Duty Station)" : "2. Select Duty Station & Shift"}
                  </strong>
                  <p style={{ margin: 0 }}>
                    {isTh
                      ? "บนแถบหัวเรื่องของเครื่องสแกน ให้เลือกจุดลานจอดที่ตนเองกำลังปฏิบัติหน้าที่อยู่ (เช่น P01 ลานหน้าอาคารบรมราชกุมารี) และเลือกกะเวลา ข้อมูลนี้จะถูกบันทึกจำไว้ในเครื่องอัตโนมัติ"
                      : "On the scanner top bar, select your current duty lot (e.g. P01) and your working shift. The scanner remembers your station persistently."}
                  </p>
                </div>

                <div style={{ background: "var(--canvas)", padding: "14px 18px", borderRadius: 12, border: "1px solid var(--line)" }}>
                  <strong style={{ color: "#d97706", display: "block", marginBottom: 4 }}>
                    {isTh ? "3. การสแกนบัตรและการยืนยันสิทธิ์" : "3. Pass Scanning & Verification"}
                  </strong>
                  <p style={{ margin: 0 }}>
                    {isTh
                      ? "ส่องกล้องไปยัง QR Code ของผู้ใช้ ระบบจะดึงข้อมูลการจอง ตรวจสอบสถานะ และทะเบียนรถทันที (สามารถสแกนบัตรการจองของทุกคนทั่วมหาวิทยาลัยได้)"
                      : "Aim the camera at the driver's QR pass. The scanner validates status, plate number, and time validity with universal visibility across campus."}
                  </p>
                </div>

                <div style={{ background: "var(--canvas)", padding: "14px 18px", borderRadius: 12, border: "1px solid var(--line)" }}>
                  <strong style={{ color: "#d97706", display: "block", marginBottom: 4 }}>
                    {isTh ? "4. การแก้ปัญหาจอดผิดลาน (Zone Mismatch & Re-slot)" : "4. Handling Wrong Area (Re-slotting Workflow)"}
                  </strong>
                  <p style={{ margin: 0 }}>
                    {isTh
                      ? "หากผู้ใช้ขับรถมาผิดลาน ระบบจะแจ้งเตือนสีส้มเด่นชัด เจ้าหน้าที่สามารถเลือกได้ 2 ทาง: 1) แนะนำเส้นทางให้ขับไปลานที่จองไว้ หรือ 2) กดปุ่ม 'โยกย้ายและเช็คอินเข้าโซนนี้ทันที' เพื่อจัดสรรช่องว่างในโซนประจำการปัจจุบันให้ผู้ใช้เข้าจอดได้ทันทีโดยไม่ต้องยกเลิกการจองเดิม"
                      : "If a user arrives at the wrong lot, an alert appears. Staff can either direct them via Google Maps or click 'Re-slot & Check-in into Duty Zone' to assign an available spot in their current station seamlessly."}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Section C: Admin Guide */}
          {(manualRole === "all" || manualRole === "admin") && (
            <div className="review-panel" style={{ padding: 24, borderRadius: 18, borderLeft: "5px solid #7c3aed" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <span style={{ width: 40, height: 40, borderRadius: 12, background: "#f3e8ff", color: "#7c3aed", display: "grid", placeItems: "center" }}>
                  <ShieldCheck size={22} />
                </span>
                <div>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "var(--ink)" }}>
                    {isTh ? "3. คู่มือการบริหารจัดการสำหรับผู้ดูแลระบบ (Admin Console)" : "3. Master Governance Guide for System Administrators"}
                  </h3>
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>
                    {isTh ? "การคุ้มครอง Super Admin, การจัดการการจอง, การตรวจสอบสุขภาพระบบ และ Audit Logs" : "Super Admin Governance, University-wide Bookings, Telemetry & Audit Logs"}
                  </span>
                </div>
              </div>

              <div style={{ display: "grid", gap: 14, fontSize: 13, color: "var(--ink)", lineHeight: 1.6 }}>
                <div style={{ background: "var(--canvas)", padding: "14px 18px", borderRadius: 12, border: "1px solid var(--line)" }}>
                  <strong style={{ color: "#7c3aed", display: "block", marginBottom: 4 }}>
                    {isTh ? "1. บัญชีผู้ดูแลระบบระดับสูง (Super Admin Protection)" : "1. Immutable Super Admin Governance"}
                  </strong>
                  <p style={{ margin: 0 }}>
                    {isTh
                      ? "ระบบมีการคุ้มครองความปลอดภัยของผู้ดูแลระบบหลัก ได้รับการป้องกันถาวร ห้ามลบหรือปลดยศโดยไม่ได้รับอนุญาต เพื่อรักษาเสถียรภาพในการบริหารจัดการระบบ พร้อมรองรับการจำแนกสิทธิ์ตามโครงสร้างบุคลากร"
                      : "The primary administrative account is protected from unauthorized deletion or demotion to preserve core system integrity, with multi-level role governance."}
                  </p>
                </div>

                <div style={{ background: "var(--canvas)", padding: "14px 18px", borderRadius: 12, border: "1px solid var(--line)" }}>
                  <strong style={{ color: "#7c3aed", display: "block", marginBottom: 4 }}>
                    {isTh ? "2. การจัดการการจองทั่วมหาวิทยาลัย (AdminBookingsManager)" : "2. Master Bookings Management"}
                  </strong>
                  <p style={{ margin: 0 }}>
                    {isTh
                      ? "แอดมินสามารถเปิดดูรายการจองทั้งหมดทั่วมหาวิทยาลัยได้ที่ /[locale]/admin/bookings สามารถค้นหาตามรหัส ทะเบียน หรือชื่อ กรองสถานะ และมีอำนาจพิเศษในการ Override สถานะข้ามขั้น หรือกดปุ่มถังขยะสีแดง (Trash2) เพื่อลบรายการจองออกจากระบบอย่างถาวร"
                      : "Admins inspect all campus bookings via /[locale]/admin/bookings. Search by reference/plate/user, override statuses arbitrarily, or click the red trash icon to delete records permanently."}
                  </p>
                </div>

                <div style={{ background: "var(--canvas)", padding: "14px 18px", borderRadius: 12, border: "1px solid var(--line)" }}>
                  <strong style={{ color: "#7c3aed", display: "block", marginBottom: 4 }}>
                    {isTh ? "3. การตรวจสอบสุขภาพระบบและเซิร์ฟเวอร์ (SystemHealthPanel)" : "3. System Telemetry & Server Health"}
                  </strong>
                  <p style={{ margin: 0 }}>
                    {isTh
                      ? "ตรวจสอบสถานะการทำงานของ Database Latency, API Uptime, Auth Performance และ Cache Hit Rate แบบ Real-time ที่หน้า /[locale]/admin/health"
                      : "Monitor database latency, API response times, authentication health, and cache performance via /[locale]/admin/health."}
                  </p>
                </div>

                <div style={{ background: "var(--canvas)", padding: "14px 18px", borderRadius: 12, border: "1px solid var(--line)" }}>
                  <strong style={{ color: "#7c3aed", display: "block", marginBottom: 4 }}>
                    {isTh ? "4. บันทึกประวัติการทำงาน (Audit Logs & Security)" : "4. Security Audit Trail"}
                  </strong>
                  <p style={{ margin: 0 }}>
                    {isTh
                      ? "ตรวจสอบบันทึก Log ทุกการเปลี่ยนแปลงในระบบ (การเปลี่ยนยศ, การลบรายการจอง, การเปลี่ยนสถานะ) มีระบบค้นหาและแบ่งหน้าชัดเจน ไม่มีข้อผิดพลาด RLS"
                      : "Review tamper-proof audit trails logging role changes, deletions, and operational transitions with fast debounced search and pagination."}
                  </p>
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: COMPLETE SITEMAP & URL DIRECTORY (ผังเว็บไซต์และ URL นำเสนอ)     */}
      {/* ========================================================================= */}
      {activeTab === "sitemap" && (
        <section aria-label="Website Sitemap Directory" style={{ display: "grid", gap: 16 }}>
          {/* Sitemap Filter & Search Bar */}
          <div
            className="review-panel"
            style={{
              padding: "16px 20px",
              borderRadius: 16,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 260 }}>
              <Search size={16} color="var(--muted)" />
              <input
                type="search"
                value={sitemapSearch}
                onChange={(e) => setSitemapSearch(e.target.value)}
                placeholder={isTh ? "ค้นหาชื่อหน้า, URL, หรือคำอธิบาย..." : "Search pages, URLs, or descriptions..."}
                style={{
                  border: "none",
                  background: "transparent",
                  outline: "none",
                  width: "100%",
                  fontSize: 13,
                  color: "var(--ink)",
                }}
              />
              {sitemapSearch && (
                <button
                  type="button"
                  onClick={() => setSitemapSearch("")}
                  style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--muted)", fontSize: 11 }}
                >
                  Clear
                </button>
              )}
            </div>

            {/* Category Filter Chips */}
            <div style={{ display: "flex", gap: 6, overflowX: "auto" }}>
              <button
                type="button"
                className={`chip ${sitemapCategory === "all" ? "active" : ""}`}
                onClick={() => setSitemapCategory("all")}
                style={{ fontSize: 12, padding: "5px 12px", borderRadius: 8, cursor: "pointer" }}
              >
                {isTh ? "ทั้งหมด" : "All"} ({sitemap.length})
              </button>
              <button
                type="button"
                className={`chip ${sitemapCategory === "public" ? "active" : ""}`}
                onClick={() => setSitemapCategory("public")}
                style={{ fontSize: 12, padding: "5px 12px", borderRadius: 8, cursor: "pointer" }}
              >
                {isTh ? "หน้าสาธารณะ" : "Public"}
              </button>
              <button
                type="button"
                className={`chip ${sitemapCategory === "user" ? "active" : ""}`}
                onClick={() => setSitemapCategory("user")}
                style={{ fontSize: 12, padding: "5px 12px", borderRadius: 8, cursor: "pointer" }}
              >
                {isTh ? "ระบบผู้ใช้" : "User App"}
              </button>
              <button
                type="button"
                className={`chip ${sitemapCategory === "staff" ? "active" : ""}`}
                onClick={() => setSitemapCategory("staff")}
                style={{ fontSize: 12, padding: "5px 12px", borderRadius: 8, cursor: "pointer" }}
              >
                {isTh ? "เจ้าหน้าที่" : "Staff"}
              </button>
              <button
                type="button"
                className={`chip ${sitemapCategory === "admin" ? "active" : ""}`}
                onClick={() => setSitemapCategory("admin")}
                style={{ fontSize: 12, padding: "5px 12px", borderRadius: 8, cursor: "pointer" }}
              >
                {isTh ? "แอดมิน" : "Admin"}
              </button>
            </div>
          </div>

          {/* Sitemap Entries Grid */}
          <div style={{ display: "grid", gap: 10 }}>
            {filteredSitemap.length === 0 ? (
              <div className="empty-card" style={{ padding: 40, textAlign: "center" }}>
                <Info size={28} color="var(--muted)" style={{ margin: "0 auto 10px" }} />
                <h3>{isTh ? "ไม่พบหน้าที่ค้นหา" : "No matching pages found"}</h3>
              </div>
            ) : (
              filteredSitemap.map((item) => {
                const isHighlight = item.isHighlight;
                return (
                  <article
                    key={item.path}
                    className="review-panel"
                    style={{
                      padding: "16px 20px",
                      borderRadius: 14,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: 12,
                      background: isHighlight ? "linear-gradient(90deg, var(--surface) 0%, rgba(248, 201, 40, 0.04) 100%)" : "var(--surface)",
                      border: isHighlight ? "1.5px solid var(--gold)" : "1px solid var(--line)",
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 260 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                        <strong style={{ fontSize: 14, color: "var(--ink)" }}>
                          {isTh ? item.titleTh : item.titleEn}
                        </strong>

                        {/* Category Badge */}
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            padding: "2px 8px",
                            borderRadius: 6,
                            background:
                              item.category === "admin"
                                ? "#f3e8ff"
                                : item.category === "staff"
                                ? "#fef3c7"
                                : item.category === "user"
                                ? "#e0f2fe"
                                : "var(--canvas)",
                            color:
                              item.category === "admin"
                                ? "#7c3aed"
                                : item.category === "staff"
                                ? "#b45309"
                                : item.category === "user"
                                ? "#0284c7"
                                : "var(--muted)",
                          }}
                        >
                          {isTh ? item.categoryLabelTh : item.categoryLabelEn}
                        </span>

                        {/* Auth Badge */}
                        <span style={{ fontSize: 10, color: "var(--muted)", display: "inline-flex", alignItems: "center", gap: 3 }}>
                          {item.authRequired !== "none" ? <Lock size={10} /> : null}
                          <span>{isTh ? item.authBadgeTh : item.authBadgeEn}</span>
                        </span>
                      </div>

                      <p style={{ margin: "2px 0 6px", fontSize: 12, color: "var(--muted)", lineHeight: 1.4 }}>
                        {isTh ? item.descriptionTh : item.descriptionEn}
                      </p>

                      {/* URL Code */}
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <code
                          style={{
                            fontSize: 11,
                            fontFamily: "monospace",
                            background: "var(--canvas)",
                            padding: "2px 8px",
                            borderRadius: 6,
                            border: "1px solid var(--line)",
                            color: "var(--ink)",
                          }}
                        >
                          {item.path}
                        </code>
                        <button
                          type="button"
                          onClick={() => handleCopy(item.path, item.path)}
                          title="Copy URL"
                          style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--muted)", padding: 2 }}
                        >
                          {copiedKey === item.path ? <Check size={13} color="#16a34a" /> : <Copy size={13} />}
                        </button>
                      </div>
                    </div>

                    {/* Action Button */}
                    <div style={{ flexShrink: 0 }}>
                      <Link
                        href={item.path}
                        target="_blank"
                        className="secondary-button"
                        style={{
                          fontSize: 12,
                          height: 34,
                          padding: "0 14px",
                          borderRadius: 8,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          fontWeight: 700,
                        }}
                      >
                        <span>{isTh ? "เปิดหน้านี้" : "Open URL"}</span>
                        <ExternalLink size={13} />
                      </Link>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: TEST CREDENTIALS CHEATSHEET (ข้อมูลบัญชีสำหรับทดสอบพรีเซนต์)      */}
      {/* ========================================================================= */}
      {activeTab === "credentials" && (
        <section aria-label="Testing Credentials" style={{ display: "grid", gap: 16 }}>
          <div className="review-panel" style={{ padding: 24, borderRadius: 18 }}>
            <h3 style={{ margin: "0 0 6px", fontSize: 17, fontWeight: 800, color: "var(--ink)" }}>
              {isTh ? "บัญชีทางการสำหรับทดสอบและนำเสนอระบบ (Official Presentation Credentials)" : "Official Credentials for Live System Demo"}
            </h3>
            <p style={{ margin: "0 0 20px", fontSize: 13, color: "var(--muted)" }}>
              {isTh
                ? "ใช้ข้อมูลด้านล่างนี้เพื่อทดสอบสิทธิ์การเข้าใช้งานในแต่ละบทบาทได้อย่างถูกต้องตามข้อกำหนดของระบบ"
                : "Use the following credentials to demonstrate role permissions and system boundaries in live presentation."}
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
              {/* Demo Admin Card */}
              <div
                style={{
                  padding: 20,
                  borderRadius: 16,
                  background: "var(--surface)",
                  border: "2px solid #2563eb",
                  boxShadow: "0 4px 16px rgba(37, 99, 235, 0.08)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 900, color: "#2563eb", display: "inline-flex", alignItems: "center", gap: 6 }}>
                    🎭 บัญชีผู้ดูแลระบบสาธิต (ADMIN)
                  </span>
                  <span style={{ fontSize: 10, background: "#dbeafe", color: "#1e40af", padding: "2px 8px", borderRadius: 10, fontWeight: 700 }}>
                    โหมด Sandbox
                  </span>
                </div>
                <div style={{ marginBottom: 10, background: "var(--canvas)", padding: "8px 12px", borderRadius: 8, fontSize: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ color: "var(--muted)" }}>Username / Email:</span>
                    <strong style={{ color: "var(--ink)" }}>admin@msu.ac.th</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--muted)" }}>Password:</span>
                    <code style={{ fontWeight: 800, color: "#2563eb" }}>admin123</code>
                  </div>
                </div>
                <p style={{ margin: "0 0 12px", fontSize: 12, color: "var(--muted)", lineHeight: 1.4 }}>
                  {isTh
                    ? "ใช้เข้าสู่ระบบสำหรับนำเสนอผลงานพรีเซนต์ สามารถเรียกดูและทดสอบได้ครบทุกฟังก์ชัน โดยระบบจำลองการทำงานในโหมด Sandbox ปลอดภัย ไม่กระทบข้อมูลจริง"
                    : "Official presentation credentials for demonstration. Full access to admin console with safe simulated sandbox actions."}
                </p>
                <Link
                  href={`/${locale}/login`}
                  className="primary-button"
                  style={{ width: "100%", height: 32, fontSize: 12, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                >
                  <span>{isTh ? "ไปที่หน้าเข้าสู่ระบบ Admin" : "Go to Admin Sign-in"}</span>
                  <ExternalLink size={13} />
                </Link>
              </div>

              {/* Staff Central Card */}
              <div
                style={{
                  padding: 20,
                  borderRadius: 16,
                  background: "var(--surface)",
                  border: "2px solid #d97706",
                  boxShadow: "0 4px 16px rgba(217, 119, 6, 0.08)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 900, color: "#d97706", display: "inline-flex", alignItems: "center", gap: 6 }}>
                    👮 บัญชีกลางเจ้าหน้าที่ (STAFF)
                  </span>
                  <span style={{ fontSize: 10, background: "#fef3c7", color: "#b45309", padding: "2px 8px", borderRadius: 10, fontWeight: 700 }}>
                    ผูกเวร P01–P28
                  </span>
                </div>
                <div style={{ marginBottom: 10, background: "var(--canvas)", padding: "8px 12px", borderRadius: 8, fontSize: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ color: "var(--muted)" }}>Username / Email:</span>
                    <strong style={{ color: "var(--ink)" }}>staff@msu.ac.th</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--muted)" }}>Password:</span>
                    <code style={{ fontWeight: 800, color: "#d97706" }}>staff123</code>
                  </div>
                </div>
                <p style={{ margin: "0 0 12px", fontSize: 12, color: "var(--muted)", lineHeight: 1.4 }}>
                  {isTh
                    ? "ใช้เข้าสู่ระบบที่หน้า /[locale]/login สามารถสแกนและตรวจสอบบัตรผ่านได้ทุกจุดจอดทั่วมหาวิทยาลัย และมีสิทธิ์ Re-slot ย้ายโซน"
                    : "Central booth credentials. Verified for duty across P01-P28 with scanner and re-slotting authority."}
                </p>
                <Link
                  href={`/${locale}/login`}
                  className="primary-button"
                  style={{ width: "100%", height: 32, fontSize: 12, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                >
                  <span>{isTh ? "ไปที่หน้าเข้าสู่ระบบ Staff" : "Go to Staff Sign-in"}</span>
                  <ExternalLink size={13} />
                </Link>
              </div>

              {/* General User Card */}
              <div
                style={{
                  padding: 20,
                  borderRadius: 16,
                  background: "var(--surface)",
                  border: "2px solid #0284c7",
                  boxShadow: "0 4px 16px rgba(2, 132, 199, 0.08)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 900, color: "#0284c7", display: "inline-flex", alignItems: "center", gap: 6 }}>
                    🚗 ผู้ใช้งานทั่วไป (GENERAL USER)
                  </span>
                  <span style={{ fontSize: 10, background: "#e0f2fe", color: "#0284c7", padding: "2px 8px", borderRadius: 10, fontWeight: 700 }}>
                    นิสิต / บุคลากร
                  </span>
                </div>
                <strong style={{ fontSize: 14, display: "block", color: "var(--ink)", marginBottom: 4 }}>
                  {isTh ? "สมัครสมาชิกใหม่ หรือ ล็อกอินผ่าน Google" : "Register New or Google Sign-In"}
                </strong>
                <p style={{ margin: "0 0 14px", fontSize: 12, color: "var(--muted)", lineHeight: 1.4 }}>
                  {isTh
                    ? "สามารถสมัครสมาชิกด้วยอีเมล @msu.ac.th หรือทดลองสร้างการจองเพื่อรับ QR Pass และทดสอบการสแกนด้วยตนเองได้ทันที"
                    : "Sign in with campus email or Google to experience end-to-end booking, pass issuance, and navigation."}
                </p>
                <Link
                  href={`/${locale}/parking`}
                  className="secondary-button"
                  style={{ width: "100%", height: 32, fontSize: 12, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                >
                  <span>{isTh ? "เริ่มทดลองจองที่จอดรถ" : "Start Live Demo Booking"}</span>
                  <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Lightbox Modal for Fullscreen Image View */}
      {lightboxImage && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(0,0,0,0.85)",
            backdropFilter: "blur(6px)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
          onClick={() => setLightboxImage(null)}
        >
          <div
            style={{
              position: "relative",
              maxWidth: "92vw",
              maxHeight: "88vh",
              borderRadius: 16,
              overflow: "hidden",
              boxShadow: "0 24px 60px rgba(0,0,0,0.6)",
              border: "1px solid rgba(255,255,255,0.15)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                background: "#0f172a",
                padding: "10px 16px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                color: "#fff",
              }}
            >
              <strong style={{ fontSize: 13 }}>{lightboxImage.title}</strong>
              <button
                type="button"
                onClick={() => setLightboxImage(null)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#fff",
                  cursor: "pointer",
                  fontSize: 18,
                  lineHeight: 1,
                }}
              >
                ✕
              </button>
            </div>
            <img
              src={lightboxImage.src}
              alt={lightboxImage.title}
              style={{ width: "100%", maxHeight: "80vh", objectFit: "contain", display: "block" }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
