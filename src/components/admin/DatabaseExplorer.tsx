"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  Columns3,
  Copy,
  Database,
  ExternalLink,
  Eye,
  Info,
  Layers,
  LoaderCircle,
  RefreshCw,
  Search,
  Table as TableIcon,
  X,
} from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { getCopy } from "@/lib/i18n";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

type ExplorerRole = "admin" | "developer";

export type SupabaseTableName =
  | "parking_areas"
  | "parking_slots"
  | "profiles"
  | "user_roles"
  | "bookings"
  | "parking_sessions"
  | "audit_logs"
  | "error_logs"
  | "feedback"
  | "incidents";

type ColumnDefinition = {
  name: string;
  type: string;
  descriptionTh: string;
  descriptionEn: string;
  isPk?: boolean;
  isFk?: boolean;
};

type TableMetadata = {
  name: SupabaseTableName;
  labelTh: string;
  labelEn: string;
  descriptionTh: string;
  descriptionEn: string;
  primaryKey: string;
  sortColumn: string;
  columns: ColumnDefinition[];
  fallbackRows: Array<Record<string, unknown>>;
};

const TABLE_DEFINITIONS: Record<SupabaseTableName, TableMetadata> = {
  parking_areas: {
    name: "parking_areas",
    labelTh: "พื้นที่จอดรถ (P01–P28)",
    labelEn: "Parking Areas (P01–P28)",
    descriptionTh: "ข้อมูลพื้นที่จอดรถ 28 โซน พิกัด GPS ความจุ และสถานะเปิดปิด",
    descriptionEn: "All 28 campus parking zones, coordinates, capacity, and current operational status.",
    primaryKey: "id",
    sortColumn: "code",
    columns: [
      { name: "id", type: "uuid", descriptionTh: "รหัส UUID ประจำพื้นที่", descriptionEn: "Unique UUID identifier", isPk: true },
      { name: "code", type: "text", descriptionTh: "รหัสพื้นที่ (P01–P28)", descriptionEn: "Area code (P01-P28)" },
      { name: "name_th", type: "text", descriptionTh: "ชื่อพื้นที่ภาษาไทย", descriptionEn: "Thai area name" },
      { name: "name_en", type: "text", descriptionTh: "ชื่อพื้นที่ภาษาอังกฤษ", descriptionEn: "English area name" },
      { name: "capacity", type: "integer", descriptionTh: "ความจุช่องจอดรวม", descriptionEn: "Total slot capacity" },
      { name: "slot_mode", type: "text", descriptionTh: "โหมดช่องจอด (AREA_ONLY / INDIVIDUAL_SLOT)", descriptionEn: "Slot allocation mode" },
      { name: "current_status", type: "text", descriptionTh: "สถานะปัจจุบัน (AVAILABLE, FULL, CLOSED)", descriptionEn: "Current status" },
      { name: "data_status", type: "text", descriptionTh: "สถานะข้อมูล (VERIFIED, AWAITING_VERIFICATION)", descriptionEn: "Verification status" },
      { name: "latitude", type: "numeric", descriptionTh: "พิกัดละติจูด", descriptionEn: "GPS Latitude" },
      { name: "longitude", type: "numeric", descriptionTh: "พิกัดลองจิจูด", descriptionEn: "GPS Longitude" },
      { name: "created_at", type: "timestamptz", descriptionTh: "เวลาที่สร้างข้อมูล", descriptionEn: "Creation timestamp" },
    ],
    fallbackRows: [
      { id: "3c847d01-a1b2-4c3d-e4f5-000000000001", code: "P01", name_th: "ลานจอดรถหน้าอาคารบรมราชกุมารี", name_en: "Borommaratchakumari Building Lot", capacity: 100, slot_mode: "INDIVIDUAL_SLOT", current_status: "AVAILABLE", data_status: "VERIFIED", latitude: 16.24641, longitude: 103.25012, created_at: "2026-09-09T08:00:00Z" },
      { id: "3c847d01-a1b2-4c3d-e4f5-000000000002", code: "P02", name_th: "ลานจอดรถคณะการบัญชีและการจัดการ", name_en: "Faculty of Accounting and Management Lot", capacity: 85, slot_mode: "AREA_ONLY", current_status: "AVAILABLE", data_status: "VERIFIED", latitude: 16.24722, longitude: 103.25145, created_at: "2026-09-09T08:00:00Z" },
      { id: "3c847d01-a1b2-4c3d-e4f5-000000000003", code: "P03", name_th: "ลานจอดรถคณะวิทยาการสารสนเทศ", name_en: "Faculty of Informatics Lot", capacity: 120, slot_mode: "INDIVIDUAL_SLOT", current_status: "AVAILABLE", data_status: "VERIFIED", latitude: 16.24498, longitude: 103.25301, created_at: "2026-09-09T08:00:00Z" },
      { id: "3c847d01-a1b2-4c3d-e4f5-000000000004", code: "P28", name_th: "ลานจอดรถสำนักวิทยบริการ (หอสมุดกลาง)", name_en: "Academic Resource Center (Central Library)", capacity: 150, slot_mode: "INDIVIDUAL_SLOT", current_status: "AVAILABLE", data_status: "VERIFIED", latitude: 16.24589, longitude: 103.24874, created_at: "2026-09-09T08:00:00Z" },
    ],
  },
  parking_slots: {
    name: "parking_slots",
    labelTh: "ช่องจอดรายช่อง (Slots)",
    labelEn: "Parking Slots",
    descriptionTh: "ผังช่องจอดรายช่องที่จัดตามแถว Row A–G และหมายเลขประจำช่อง",
    descriptionEn: "Individual parking bay layouts mapped to rows (A-G) and bay numbers.",
    primaryKey: "id",
    sortColumn: "slot_code",
    columns: [
      { name: "id", type: "uuid", descriptionTh: "รหัส UUID ช่องจอด", descriptionEn: "Slot UUID identifier", isPk: true },
      { name: "parking_area_id", type: "uuid", descriptionTh: "รหัสพื้นที่อ้างอิง", descriptionEn: "Foreign key to parking_areas", isFk: true },
      { name: "slot_code", type: "text", descriptionTh: "รหัสช่องจอด (เช่น P01-A-01)", descriptionEn: "Unique slot code (e.g. P01-A-01)" },
      { name: "row_label", type: "text", descriptionTh: "ชื่อแถว (A, B, C...)", descriptionEn: "Row letter identifier" },
      { name: "position", type: "integer", descriptionTh: "ลำดับในแถว", descriptionEn: "Bay sequence number in row" },
      { name: "slot_type", type: "text", descriptionTh: "ประเภทช่อง (CAR, MOTORCYCLE, EV, ACCESSIBLE)", descriptionEn: "Slot vehicle type" },
      { name: "status", type: "text", descriptionTh: "สถานะ (AVAILABLE, RESERVED, OCCUPIED, CLOSED)", descriptionEn: "Current slot occupancy" },
      { name: "data_status", type: "text", descriptionTh: "สถานะข้อมูล (MOCKUP, VERIFIED)", descriptionEn: "Data verification level" },
      { name: "created_at", type: "timestamptz", descriptionTh: "เวลาที่สร้าง", descriptionEn: "Created at timestamp" },
    ],
    fallbackRows: [
      { id: "7a91bf02-1111-4444-8888-000000000001", parking_area_id: "3c847d01-a1b2-4c3d-e4f5-000000000001", slot_code: "P01-A-01", row_label: "A", position: 1, slot_type: "CAR", status: "AVAILABLE", data_status: "VERIFIED", created_at: "2026-09-09T08:15:00Z" },
      { id: "7a91bf02-1111-4444-8888-000000000002", parking_area_id: "3c847d01-a1b2-4c3d-e4f5-000000000001", slot_code: "P01-A-02", row_label: "A", position: 2, slot_type: "CAR", status: "RESERVED", data_status: "VERIFIED", created_at: "2026-09-09T08:15:00Z" },
      { id: "7a91bf02-1111-4444-8888-000000000003", parking_area_id: "3c847d01-a1b2-4c3d-e4f5-000000000001", slot_code: "P01-B-01", row_label: "B", position: 1, slot_type: "EV", status: "OCCUPIED", data_status: "VERIFIED", created_at: "2026-09-09T08:15:00Z" },
      { id: "7a91bf02-1111-4444-8888-000000000004", parking_area_id: "3c847d01-a1b2-4c3d-e4f5-000000000001", slot_code: "P01-B-02", row_label: "B", position: 2, slot_type: "ACCESSIBLE", status: "AVAILABLE", data_status: "VERIFIED", created_at: "2026-09-09T08:15:00Z" },
    ],
  },
  profiles: {
    name: "profiles",
    labelTh: "ข้อมูลผู้ใช้ (Profiles)",
    labelEn: "User Profiles",
    descriptionTh: "ข้อมูลโปรไฟล์ผู้ใช้ นิสิต บุคลากร และผู้ดูแลระบบ",
    descriptionEn: "User profile records, university credentials, faculty, and locale preferences.",
    primaryKey: "id",
    sortColumn: "created_at",
    columns: [
      { name: "id", type: "uuid", descriptionTh: "รหัสผู้ใช้อ้างอิง auth.users", descriptionEn: "User ID referencing auth.users", isPk: true },
      { name: "email", type: "text", descriptionTh: "อีเมลผู้ใช้งาน", descriptionEn: "Account email address" },
      { name: "full_name", type: "text", descriptionTh: "ชื่อ-นามสกุล", descriptionEn: "Full name" },
      { name: "user_type", type: "text", descriptionTh: "ประเภทยูสเซอร์ (student, personnel, visitor)", descriptionEn: "User type tier" },
      { name: "university_id", type: "text", descriptionTh: "รหัสนิสิตหรือรหัสบุคลากร", descriptionEn: "MSU university ID number" },
      { name: "faculty", type: "text", descriptionTh: "คณะที่สังกัด", descriptionEn: "Faculty affiliation" },
      { name: "major", type: "text", descriptionTh: "สาขาวิชา", descriptionEn: "Major field of study" },
      { name: "preferred_locale", type: "text", descriptionTh: "ภาษาที่ต้องการ (th/en)", descriptionEn: "Preferred UI locale (th/en)" },
      { name: "created_at", type: "timestamptz", descriptionTh: "วันที่สร้างบัญชี", descriptionEn: "Profile created at" },
    ],
    fallbackRows: [
      { id: "e1f2a3b4-5c6d-7e8f-9a0b-111111111111", email: "developer@msu.ac.th", full_name: "ระบบทดสอบ นักพัฒนา", user_type: "developer", university_id: "DEV-001", faculty: "วิทยาการสารสนเทศ", major: "เทคโนโลยีสารสนเทศ", preferred_locale: "th", created_at: "2026-09-09T07:00:00Z" },
      { id: "e1f2a3b4-5c6d-7e8f-9a0b-222222222222", email: "admin@msu.ac.th", full_name: "ผู้ดูแลระบบ กลาง", user_type: "admin", university_id: "ADM-001", faculty: "กองอาคารสถานที่", major: "บริหารจัดการ", preferred_locale: "th", created_at: "2026-09-09T07:00:00Z" },
      { id: "e1f2a3b4-5c6d-7e8f-9a0b-333333333333", email: "staff.gate1@msu.ac.th", full_name: "เจ้าหน้าที่ จุดตรวจ 1", user_type: "staff", university_id: "STF-102", faculty: "กองอาคารสถานที่", major: "รปภ.และจราจร", preferred_locale: "th", created_at: "2026-09-09T07:30:00Z" },
    ],
  },
  user_roles: {
    name: "user_roles",
    labelTh: "ยศและสิทธิ์ระบบ (User Roles)",
    labelEn: "User Roles (RBAC)",
    descriptionTh: "ตารางกำหนดบทบาทสิทธิ์ (admin, developer, staff, user) ควบคุมด้วย RLS",
    descriptionEn: "Role-based access control assignments enforced by Supabase RLS policies.",
    primaryKey: "user_id, role",
    sortColumn: "granted_at",
    columns: [
      { name: "user_id", type: "uuid", descriptionTh: "รหัสผู้ใช้", descriptionEn: "User UUID referencing profiles", isPk: true, isFk: true },
      { name: "role", type: "text", descriptionTh: "ยศที่ได้รับ (admin, developer, staff)", descriptionEn: "Granted system role", isPk: true },
      { name: "granted_by", type: "uuid", descriptionTh: "ผู้มอบหมายยศ", descriptionEn: "Authorizer UUID" },
      { name: "granted_at", type: "timestamptz", descriptionTh: "วันเวลาที่มอบยศ", descriptionEn: "Role grant timestamp" },
    ],
    fallbackRows: [
      { user_id: "e1f2a3b4-5c6d-7e8f-9a0b-111111111111", role: "developer", granted_by: null, granted_at: "2026-09-09T07:00:00Z" },
      { user_id: "e1f2a3b4-5c6d-7e8f-9a0b-222222222222", role: "admin", granted_by: null, granted_at: "2026-09-09T07:00:00Z" },
      { user_id: "e1f2a3b4-5c6d-7e8f-9a0b-333333333333", role: "staff", granted_by: "e1f2a3b4-5c6d-7e8f-9a0b-222222222222", granted_at: "2026-09-09T07:30:00Z" },
    ],
  },
  bookings: {
    name: "bookings",
    labelTh: "รายการจองช่องจอด (Bookings)",
    labelEn: "Parking Bookings",
    descriptionTh: "ข้อมูลการจองช่องจอดล่วงหน้า รหัสอ้างอิง และสถานะการจอง",
    descriptionEn: "Reserved parking windows, references, user IDs, and lifecycle states.",
    primaryKey: "id",
    sortColumn: "created_at",
    columns: [
      { name: "id", type: "uuid", descriptionTh: "รหัส UUID การจอง", descriptionEn: "Booking UUID", isPk: true },
      { name: "reference", type: "text", descriptionTh: "รหัสอ้างอิง (MSUPK-BKG-...)", descriptionEn: "Human-readable reference code" },
      { name: "user_id", type: "uuid", descriptionTh: "รหัสผู้จอง", descriptionEn: "Booker user UUID", isFk: true },
      { name: "parking_area_id", type: "uuid", descriptionTh: "รหัสพื้นที่", descriptionEn: "Parking area UUID", isFk: true },
      { name: "parking_slot_id", type: "uuid", descriptionTh: "รหัสช่องจอดรายช่อง (ถ้ามี)", descriptionEn: "Specific slot UUID if selected" },
      { name: "booking_date", type: "date", descriptionTh: "วันที่จอง", descriptionEn: "Reservation target date" },
      { name: "starts_at", type: "timestamptz", descriptionTh: "เวลาเริ่มต้น", descriptionEn: "Reservation start time" },
      { name: "ends_at", type: "timestamptz", descriptionTh: "เวลาสิ้นสุด", descriptionEn: "Reservation end time" },
      { name: "booking_mode", type: "text", descriptionTh: "โหมดการจอง (AREA_ONLY, INDIVIDUAL_SLOT)", descriptionEn: "Booking mode type" },
      { name: "status", type: "text", descriptionTh: "สถานะ (CONFIRMED, CHECKED_IN, COMPLETED, CANCELLED)", descriptionEn: "Booking status" },
      { name: "created_at", type: "timestamptz", descriptionTh: "เวลาที่ทำการจอง", descriptionEn: "Created at timestamp" },
    ],
    fallbackRows: [
      { id: "b1010101-2222-3333-4444-555555555551", reference: "MSUPK-BKG-20260910-A9F21", user_id: "e1f2a3b4-5c6d-7e8f-9a0b-111111111111", parking_area_id: "3c847d01-a1b2-4c3d-e4f5-000000000001", parking_slot_id: "7a91bf02-1111-4444-8888-000000000002", booking_date: "2026-09-10", starts_at: "2026-09-10T09:00:00Z", ends_at: "2026-09-10T12:00:00Z", booking_mode: "INDIVIDUAL_SLOT", status: "CONFIRMED", created_at: "2026-09-10T08:30:00Z" },
      { id: "b1010101-2222-3333-4444-555555555552", reference: "MSUPK-BKG-20260910-C3D42", user_id: "e1f2a3b4-5c6d-7e8f-9a0b-333333333333", parking_area_id: "3c847d01-a1b2-4c3d-e4f5-000000000003", parking_slot_id: null, booking_date: "2026-09-10", starts_at: "2026-09-10T10:00:00Z", ends_at: "2026-09-10T14:00:00Z", booking_mode: "AREA_ONLY", status: "CHECKED_IN", created_at: "2026-09-10T08:45:00Z" },
    ],
  },
  parking_sessions: {
    name: "parking_sessions",
    labelTh: "เซสชันการเข้าจอดจริง (Sessions)",
    labelEn: "Parking Sessions",
    descriptionTh: "บันทึกเวลา Check-in และ Check-out จริง พร้อมตรวจจับการจอดเกินเวลา",
    descriptionEn: "Live on-site check-in / check-out records and overstay tracking.",
    primaryKey: "id",
    sortColumn: "created_at",
    columns: [
      { name: "id", type: "uuid", descriptionTh: "รหัส UUID เซสชัน", descriptionEn: "Session UUID identifier", isPk: true },
      { name: "booking_id", type: "uuid", descriptionTh: "รหัสการจองอ้างอิง", descriptionEn: "Referenced booking UUID", isFk: true },
      { name: "user_id", type: "uuid", descriptionTh: "รหัสผู้เข้าจอด", descriptionEn: "User UUID", isFk: true },
      { name: "parking_area_id", type: "uuid", descriptionTh: "รหัสพื้นที่", descriptionEn: "Parking area UUID", isFk: true },
      { name: "check_in_at", type: "timestamptz", descriptionTh: "เวลา Check-in", descriptionEn: "Actual check-in timestamp" },
      { name: "check_out_at", type: "timestamptz", descriptionTh: "เวลา Check-out", descriptionEn: "Actual check-out timestamp" },
      { name: "status", type: "text", descriptionTh: "สถานะ (ACTIVE, COMPLETED, OVERSTAY)", descriptionEn: "Session status" },
      { name: "overstay_minutes", type: "integer", descriptionTh: "จำนวนนาทีที่จอดเกินเวลา", descriptionEn: "Minutes parked beyond booking end" },
      { name: "created_at", type: "timestamptz", descriptionTh: "เวลาเริ่มบันทึก", descriptionEn: "Session created timestamp" },
    ],
    fallbackRows: [
      { id: "c2020202-3333-4444-5555-666666666661", booking_id: "b1010101-2222-3333-4444-555555555552", user_id: "e1f2a3b4-5c6d-7e8f-9a0b-333333333333", parking_area_id: "3c847d01-a1b2-4c3d-e4f5-000000000003", check_in_at: "2026-09-10T10:02:14Z", check_out_at: null, status: "ACTIVE", overstay_minutes: 0, created_at: "2026-09-10T10:02:14Z" },
    ],
  },
  audit_logs: {
    name: "audit_logs",
    labelTh: "ประวัติการตรวจสอบ (Audit Logs)",
    labelEn: "Audit Trail Logs",
    descriptionTh: "บันทึกการกระทำสำคัญในระบบ การแก้ไขสิทธิ์ การปรับสถานะ และ Trace ID",
    descriptionEn: "Immutable audit trail of administrative actions, role updates, and system state transitions.",
    primaryKey: "id",
    sortColumn: "created_at",
    columns: [
      { name: "id", type: "uuid", descriptionTh: "รหัสบันทึก Audit", descriptionEn: "Audit record UUID", isPk: true },
      { name: "event_id", type: "text", descriptionTh: "รหัสเหตุการณ์เฉพาะ", descriptionEn: "Unique event identifier" },
      { name: "trace_id", type: "text", descriptionTh: "รหัส Trace ติดตามคำขอ", descriptionEn: "Distributed trace correlation ID" },
      { name: "actor_type", type: "text", descriptionTh: "ประเภทผู้กระทำ (admin, staff, system)", descriptionEn: "Actor role category" },
      { name: "action", type: "text", descriptionTh: "การกระทำ (USER_ROLE_GRANT, AREA_UPDATE)", descriptionEn: "Action executed" },
      { name: "entity_type", type: "text", descriptionTh: "ประเภทเอนทิตีที่ถูกกระทำ", descriptionEn: "Target entity type" },
      { name: "result", type: "text", descriptionTh: "ผลลัพธ์ (SUCCESS, FAILURE)", descriptionEn: "Execution outcome" },
      { name: "created_at", type: "timestamptz", descriptionTh: "วันเวลาที่เกิดเหตุการณ์", descriptionEn: "Timestamp of audit event" },
    ],
    fallbackRows: [
      { id: "d3030303-4444-5555-6666-777777777771", event_id: "evt_991823_01", trace_id: "tr_8a7c2b19_01", actor_type: "admin", action: "USER_ROLE_GRANT", entity_type: "user_roles", result: "SUCCESS", created_at: "2026-09-10T09:12:00Z" },
      { id: "d3030303-4444-5555-6666-777777777772", event_id: "evt_991823_02", trace_id: "tr_4d2e9f01_03", actor_type: "staff", action: "QR_SCAN_CHECK_IN", entity_type: "parking_sessions", result: "SUCCESS", created_at: "2026-09-10T10:02:14Z" },
    ],
  },
  error_logs: {
    name: "error_logs",
    labelTh: "บันทึกข้อผิดพลาด (Error Logs)",
    labelEn: "Application Error Logs",
    descriptionTh: "ข้อผิดพลาดระดับเซิร์ฟเวอร์ เส้นทาง API ข้อความแจ้งเตือน และระดับความรุนแรง",
    descriptionEn: "Server-side and client errors, endpoint route paths, stack traces, and severities.",
    primaryKey: "id",
    sortColumn: "created_at",
    columns: [
      { name: "id", type: "uuid", descriptionTh: "รหัสข้อผิดพลาด", descriptionEn: "Error log UUID", isPk: true },
      { name: "trace_id", type: "text", descriptionTh: "รหัส Trace ที่เชื่อมโยง", descriptionEn: "Associated trace correlation ID" },
      { name: "route", type: "text", descriptionTh: "เส้นทางหน้าที่เกิดปัญหา", descriptionEn: "Path or endpoint where error occurred" },
      { name: "severity", type: "text", descriptionTh: "ความรุนแรง (ERROR, CRITICAL, WARNING)", descriptionEn: "Severity level" },
      { name: "message", type: "text", descriptionTh: "ข้อความแจ้งข้อผิดพลาด", descriptionEn: "Error message details" },
      { name: "created_at", type: "timestamptz", descriptionTh: "เวลาที่พบข้อผิดพลาด", descriptionEn: "Error occurrence timestamp" },
    ],
    fallbackRows: [
      { id: "e4040404-5555-6666-7777-888888888881", trace_id: "tr_err_3321_01", route: "/api/qr/scan", severity: "ERROR", message: "QR token signature check timed out after 3000ms", created_at: "2026-09-10T08:14:22Z" },
      { id: "e4040404-5555-6666-7777-888888888882", trace_id: "tr_err_3321_02", route: "/developer/database", severity: "WARNING", message: "Anonymous rate limiter approached 80% threshold", created_at: "2026-09-10T09:45:10Z" },
    ],
  },
  feedback: {
    name: "feedback",
    labelTh: "ข้อเสนอแนะและปัญหา (Feedback)",
    labelEn: "Feedback & Bug Reports",
    descriptionTh: "รายงานบัก ข้อเสนอแนะการใช้งาน และสถานะการตรวจสอบ",
    descriptionEn: "User submitted bug reports, issues, feature requests, and resolution statuses.",
    primaryKey: "id",
    sortColumn: "created_at",
    columns: [
      { name: "id", type: "uuid", descriptionTh: "รหัส Feedback", descriptionEn: "Feedback UUID identifier", isPk: true },
      { name: "category", type: "text", descriptionTh: "ประเภท (BUG, SUGGESTION, GENERAL)", descriptionEn: "Category" },
      { name: "subject", type: "text", descriptionTh: "หัวข้อเรื่อง", descriptionEn: "Subject heading" },
      { name: "message", type: "text", descriptionTh: "รายละเอียด", descriptionEn: "Detailed message" },
      { name: "severity", type: "text", descriptionTh: "ความรุนแรง (LOW, MEDIUM, HIGH, CRITICAL)", descriptionEn: "Severity rating" },
      { name: "status", type: "text", descriptionTh: "สถานะ (NEW, REVIEWING, RESOLVED)", descriptionEn: "Current processing status" },
      { name: "route", type: "text", descriptionTh: "หน้าที่พบปัญหา", descriptionEn: "Affected route path" },
      { name: "created_at", type: "timestamptz", descriptionTh: "เวลาที่ส่ง", descriptionEn: "Submission timestamp" },
    ],
    fallbackRows: [
      { id: "f5050505-6666-7777-8888-999999999991", category: "BUG", subject: "Map marker P14 misaligned on mobile screen", message: "On viewport width < 380px, pin P14 overflows the right card boundary.", severity: "LOW", status: "RESOLVED", route: "/parking/p14", created_at: "2026-09-09T14:10:00Z" },
    ],
  },
  incidents: {
    name: "incidents",
    labelTh: "เหตุการณ์หน้างาน (Incidents)",
    labelEn: "On-site Incidents",
    descriptionTh: "รายงานปัญหาหน้างาน เช่น รถจอดขวาง อุบัติเหตุ หรืออุปกรณ์ชำรุด",
    descriptionEn: "Field incident logs including blocked parking spaces, parking violations, and hazards.",
    primaryKey: "id",
    sortColumn: "created_at",
    columns: [
      { name: "id", type: "uuid", descriptionTh: "รหัสเหตุการณ์", descriptionEn: "Incident UUID", isPk: true },
      { name: "parking_area_id", type: "uuid", descriptionTh: "รหัสพื้นที่", descriptionEn: "Parking area UUID", isFk: true },
      { name: "category", type: "text", descriptionTh: "ประเภทเหตุการณ์", descriptionEn: "Incident category" },
      { name: "notes", type: "text", descriptionTh: "บันทึกรายละเอียดเหตุการณ์", descriptionEn: "Staff observation notes" },
      { name: "status", type: "text", descriptionTh: "สถานะ (NEW, IN_PROGRESS, RESOLVED)", descriptionEn: "Resolution status" },
      { name: "created_at", type: "timestamptz", descriptionTh: "เวลาที่บันทึก", descriptionEn: "Incident report timestamp" },
    ],
    fallbackRows: [
      { id: "a6060606-7777-8888-9999-000000000001", parking_area_id: "3c847d01-a1b2-4c3d-e4f5-000000000001", category: "BLOCKED_EXIT", notes: "White sedan double-parked near row B exit ramp; security notified.", status: "RESOLVED", created_at: "2026-09-10T11:00:00Z" },
    ],
  },
};

const TABLE_NAMES = Object.keys(TABLE_DEFINITIONS) as SupabaseTableName[];

export function DatabaseExplorer({ locale, role }: { locale: Locale; role: ExplorerRole }) {
  const t = getCopy(locale);
  const [selectedTable, setSelectedTable] = useState<SupabaseTableName>("parking_areas");
  const [tableCounts, setTableCounts] = useState<Record<SupabaseTableName, number | null>>(() =>
    Object.fromEntries(TABLE_NAMES.map((name) => [name, null])) as Record<SupabaseTableName, number | null>,
  );
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [selectedRow, setSelectedRow] = useState<Record<string, unknown> | null>(null);
  const [viewMode, setViewMode] = useState<"table" | "schema">("table");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const activeMeta = TABLE_DEFINITIONS[selectedTable];

  // Load record count for all tables in background
  const loadAllTableCounts = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setTableCounts(
        Object.fromEntries(TABLE_NAMES.map((name) => [name, TABLE_DEFINITIONS[name].fallbackRows.length])) as Record<
          SupabaseTableName,
          number
        >,
      );
      return;
    }

    try {
      const supabase = createSupabaseBrowserClient();
      const countPromises = TABLE_NAMES.map(async (name) => {
        const pk = TABLE_DEFINITIONS[name].primaryKey.split(",")[0].trim();
        const { count, error } = await supabase.from(name).select(pk, { count: "exact", head: true });
        return [name, error ? TABLE_DEFINITIONS[name].fallbackRows.length : count ?? 0] as const;
      });

      const results = await Promise.all(countPromises);
      setTableCounts(Object.fromEntries(results) as Record<SupabaseTableName, number>);
    } catch {
      // Keep existing counts or fallbacks on failure
    }
  }, []);

  // Load data for currently selected table
  const loadTableData = useCallback(
    async (tableName: SupabaseTableName, isManualRefresh = false) => {
      if (isManualRefresh) setRefreshing(true);
      else setLoading(true);

      const meta = TABLE_DEFINITIONS[tableName];

      if (!isSupabaseConfigured()) {
        setRows(meta.fallbackRows);
        setErrorNotice(
          locale === "th"
            ? "Supabase ยังไม่ได้เชื่อมต่อ แสดงข้อมูลตัวอย่างจาก Schema Definition"
            : "Supabase connection is not configured. Showing sample schema records.",
        );
        setLoading(false);
        setRefreshing(false);
        return;
      }

      try {
        const supabase = createSupabaseBrowserClient();
        const { data, error, count } = await supabase
          .from(tableName)
          .select("*", { count: "exact" })
          .order(meta.sortColumn, { ascending: meta.sortColumn === "code" || meta.sortColumn === "slot_code" })
          .limit(100);

        if (error) {
          // Graceful fallback when table has restricted RLS permissions or schema difference
          setRows(meta.fallbackRows);
          setErrorNotice(
            locale === "th"
              ? `ข้อจำกัดสิทธิ์หรือนโยบาย RLS (${error.message}) แสดงข้อมูลตัวอย่างโครงสร้าง Schema แทน`
              : `Access restricted by RLS policy (${error.message}). Showing structured schema preview.`,
          );
        } else {
          setRows((data as Array<Record<string, unknown>>) ?? []);
          setTableCounts((current) => ({ ...current, [tableName]: count ?? data?.length ?? 0 }));
          setErrorNotice(null);
        }
      } catch (err) {
        setRows(meta.fallbackRows);
        setErrorNotice(
          err instanceof Error
            ? err.message
            : locale === "th"
              ? "เกิดข้อผิดพลาดในการดึงข้อมูลจากตาราง"
              : "Failed to read database table rows.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [locale],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadAllTableCounts(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadAllTableCounts]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadTableData(selectedTable, false); }, 0);
    return () => window.clearTimeout(timer);
  }, [selectedTable, loadTableData]);

  // Filter rows across all values
  const filteredRows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return rows;
    return rows.filter((row) =>
      Object.values(row).some((val) => {
        if (val == null) return false;
        if (typeof val === "object") return JSON.stringify(val).toLowerCase().includes(normalized);
        return String(val).toLowerCase().includes(normalized);
      }),
    );
  }, [rows, query]);

  const copyToClipboard = (text: string, key = "global") => {
    void navigator.clipboard.writeText(text);
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey(null), 2000);
  };

  const currentCount = tableCounts[selectedTable] ?? rows.length;

  return (
    <div className="database-explorer data-manager" style={{ marginTop: 24 }}>
      {/* Header with Title and Standard < N > Badge */}
      <div className="data-manager-heading">
        <div>
          <p className="eyebrow">{role === "admin" ? t.admin : t.developer} · {t.database}</p>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h2>{locale === "th" ? activeMeta.labelTh : activeMeta.labelEn}</h2>
            <span
              className="data-badge font-mono"
              style={{
                background: "var(--gold-soft, #fff5cf)",
                color: "var(--gold-dark, #846600)",
                fontSize: 12,
                padding: "4px 10px",
                fontFamily: "monospace",
              }}
              title={locale === "th" ? `จำนวนเรคคอร์ด: ${currentCount}` : `Record count: ${currentCount}`}
            >
              {`< ${currentCount} >`}
            </span>
          </div>
          <p className="page-subtitle">
            {locale === "th" ? activeMeta.descriptionTh : activeMeta.descriptionEn} · {t.noPrivateData}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            className={`secondary-button small-button ${viewMode === "table" ? "active" : ""}`}
            type="button"
            onClick={() => setViewMode("table")}
            style={{ fontWeight: viewMode === "table" ? 800 : 500 }}
          >
            <TableIcon size={14} />
            {locale === "th" ? "ตารางข้อมูล" : "Table"}
          </button>
          <button
            className={`secondary-button small-button ${viewMode === "schema" ? "active" : ""}`}
            type="button"
            onClick={() => setViewMode("schema")}
            style={{ fontWeight: viewMode === "schema" ? 800 : 500 }}
          >
            <Columns3 size={14} />
            {locale === "th" ? "โครงสร้าง Schema" : "Schema"}
          </button>
          <button
            className="secondary-button small-button"
            type="button"
            onClick={() => void loadTableData(selectedTable, true)}
            disabled={refreshing}
            aria-label={t.refreshAvailability}
          >
            <RefreshCw size={14} className={refreshing ? "spin" : undefined} />
            {t.refreshAvailability}
          </button>
        </div>
      </div>

      {/* Table Selector Tabs / Chip Row with < N > count badges */}
      <div
        className="chip-row"
        style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 6, marginTop: 16 }}
        role="tablist"
        aria-label={locale === "th" ? "เลือกตาราง Supabase" : "Select Supabase Table"}
      >
        {TABLE_NAMES.map((tableName) => {
          const isSelected = selectedTable === tableName;
          const count = tableCounts[tableName];
          const badgeValue = count == null ? "…" : `< ${count} >`;
          return (
            <button
              className={`filter-chip ${isSelected ? "active" : ""}`}
              key={tableName}
              type="button"
              role="tab"
              aria-selected={isSelected}
              onClick={() => {
                setSelectedTable(tableName);
                setQuery("");
              }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                whiteSpace: "nowrap",
                cursor: "pointer",
              }}
            >
              <Database size={12} />
              <span>{tableName}</span>
              <span
                className="font-mono"
                style={{
                  fontSize: 10,
                  opacity: 0.85,
                  padding: "1px 5px",
                  borderRadius: 4,
                  background: isSelected ? "rgba(0,0,0,0.12)" : "rgba(0,0,0,0.05)",
                }}
              >
                {badgeValue}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search and Action Toolbar */}
      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 18,
          flexWrap: "wrap",
        }}
      >
        <div className="user-search-box" style={{ flex: "1 1 280px", margin: 0 }}>
          <Search size={16} />
          <input
            aria-label={locale === "th" ? `ค้นหาในตาราง ${selectedTable}` : `Search in ${selectedTable}`}
            placeholder={
              locale === "th"
                ? `ค้นหาข้อมูลใน ${selectedTable} (${filteredRows.length} รายการ)`
                : `Filter ${selectedTable} rows (${filteredRows.length} matching)...`
            }
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="data-badge font-mono" style={{ padding: "6px 12px", fontSize: 11 }}>
            {filteredRows.length === rows.length
              ? `< ${rows.length} rows >`
              : `< ${filteredRows.length} / ${rows.length} rows >`}
          </span>
          {query && (
            <button
              className="text-link"
              type="button"
              onClick={() => setQuery("")}
              style={{ fontSize: 12, cursor: "pointer" }}
            >
              {t.clear}
            </button>
          )}
        </div>
      </div>

      {/* Notice/Fallback Alert if present */}
      {errorNotice ? (
        <div className="mockup-note" role="note" style={{ marginTop: 14 }}>
          <Info size={16} />
          <span>
            <strong>{locale === "th" ? "คำแนะนำด้านสิทธิ์และความปลอดภัย" : "Security & Fallback Notice"}:</strong>{" "}
            {errorNotice}
          </span>
        </div>
      ) : null}

      {/* Main Content Area */}
      {loading ? (
        <div className="empty-card" role="status" style={{ marginTop: 20 }}>
          <div>
            <LoaderCircle size={28} className="spin" style={{ margin: "0 auto 10px" }} />
            <h2>{locale === "th" ? `กำลังโหลดตาราง ${selectedTable}…` : `Loading ${selectedTable}…`}</h2>
            <p>{t.operationalData}</p>
          </div>
        </div>
      ) : viewMode === "schema" ? (
        /* Schema View */
        <section
          className="review-panel"
          style={{
            marginTop: 18,
            padding: 20,
            background: "var(--surface)",
            borderRadius: 18,
            border: "1px solid var(--line)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16 }}>
                {locale === "th" ? `โครงสร้างคอลัมน์ของ ${selectedTable}` : `${selectedTable} Column Schema`}
              </h3>
              <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 12 }}>
                {locale === "th"
                  ? `Primary Key: ${activeMeta.primaryKey} · จัดเรียงตาม ${activeMeta.sortColumn}`
                  : `Primary Key: ${activeMeta.primaryKey} · Sorted by ${activeMeta.sortColumn}`}
              </p>
            </div>
            <span className="data-badge">{activeMeta.columns.length} columns</span>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                textAlign: "left",
                fontSize: 12,
              }}
            >
              <thead>
                <tr style={{ borderBottom: "1px solid var(--line)", color: "var(--muted)" }}>
                  <th style={{ padding: "8px 12px" }}>Column</th>
                  <th style={{ padding: "8px 12px" }}>Type</th>
                  <th style={{ padding: "8px 12px" }}>Key</th>
                  <th style={{ padding: "8px 12px" }}>Description</th>
                </tr>
              </thead>
              <tbody>
                {activeMeta.columns.map((col) => (
                  <tr key={col.name} style={{ borderBottom: "1px solid var(--line-soft, #f0f2f5)" }}>
                    <td style={{ padding: "10px 12px", fontWeight: 700, fontFamily: "monospace" }}>{col.name}</td>
                    <td style={{ padding: "10px 12px", color: "var(--muted)", fontFamily: "monospace" }}>{col.type}</td>
                    <td style={{ padding: "10px 12px" }}>
                      {col.isPk ? (
                        <span
                          className="data-badge"
                          style={{ background: "#fff5cf", color: "#846600", fontSize: 9, padding: "2px 6px" }}
                        >
                          PK
                        </span>
                      ) : col.isFk ? (
                        <span
                          className="data-badge"
                          style={{ background: "#e8f0fe", color: "#1967d2", fontSize: 9, padding: "2px 6px" }}
                        >
                          FK
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td style={{ padding: "10px 12px", color: "var(--muted)" }}>
                      {locale === "th" ? col.descriptionTh : col.descriptionEn}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : filteredRows.length ? (
        /* Table Data View */
        <div
          style={{
            marginTop: 18,
            border: "1px solid var(--line)",
            borderRadius: 18,
            background: "var(--surface)",
            overflow: "hidden",
          }}
        >
          <div style={{ overflowX: "auto", maxHeight: "600px" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                textAlign: "left",
                fontSize: 12,
              }}
            >
              <thead
                style={{
                  position: "sticky",
                  top: 0,
                  background: "var(--surface-header, #f8f9fa)",
                  zIndex: 2,
                  boxShadow: "0 1px 0 var(--line)",
                }}
              >
                <tr>
                  <th style={{ padding: "10px 14px", width: 50, color: "var(--muted)", fontWeight: 700 }}>#</th>
                  {activeMeta.columns.map((col) => (
                    <th
                      key={col.name}
                      style={{
                        padding: "10px 14px",
                        whiteSpace: "nowrap",
                        color: "var(--muted)",
                        fontWeight: 700,
                        fontFamily: "monospace",
                        fontSize: 11,
                      }}
                    >
                      {col.name}
                      {col.isPk ? " (PK)" : ""}
                    </th>
                  ))}
                  <th style={{ padding: "10px 14px", width: 70, textAlign: "right", color: "var(--muted)" }}>
                    {locale === "th" ? "ดูข้อมูล" : "Action"}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row, index) => {
                  const pkValue = String(row[activeMeta.columns[0]?.name] ?? index);
                  return (
                    <tr
                      key={pkValue}
                      onClick={() => setSelectedRow(row)}
                      style={{
                        borderBottom: "1px solid var(--line)",
                        cursor: "pointer",
                        transition: "background 0.15s ease",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-hover, #f3f5f8)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <td style={{ padding: "10px 14px", color: "var(--muted)", fontFamily: "monospace" }}>
                        {index + 1}
                      </td>
                      {activeMeta.columns.map((col) => {
                        const raw = row[col.name];
                        const displayVal = formatCellValue(raw);
                        const isNull = raw === null || raw === undefined;
                        return (
                          <td
                            key={col.name}
                            style={{
                              padding: "10px 14px",
                              maxWidth: 220,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              color: isNull ? "var(--muted)" : "inherit",
                              fontFamily: col.name.includes("id") || col.name.includes("at") ? "monospace" : "inherit",
                            }}
                            title={typeof raw === "object" ? JSON.stringify(raw) : String(raw ?? "—")}
                          >
                            {displayVal}
                          </td>
                        );
                      })}
                      <td style={{ padding: "10px 14px", textAlign: "right" }}>
                        <button
                          className="icon-button"
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedRow(row);
                          }}
                          aria-label={`${locale === "th" ? "ตรวจสอบแถว" : "Inspect row"} ${pkValue}`}
                        >
                          <Eye size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Empty State */
        <div className="empty-card compact-empty" style={{ marginTop: 24 }}>
          <div>
            <Database size={28} />
            <h2>{query ? t.noResults : t.noRecords}</h2>
            <p>
              {query
                ? locale === "th"
                  ? "ลองเปลี่ยนคำค้นหาเพื่อค้นหาข้อมูลในตารางนี้"
                  : "No rows matched your search filter."
                : locale === "th"
                  ? `ตาราง ${selectedTable} ยังไม่มีข้อมูลในระบบ`
                  : `Table ${selectedTable} has no records.`}
            </p>
          </div>
        </div>
      )}

      {/* Row Detail Inspector Modal */}
      {selectedRow ? (
        <div
          className="confirm-overlay"
          role="presentation"
          onClick={() => setSelectedRow(null)}
          style={{ zIndex: 120 }}
        >
          <div
            className="confirm-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={locale === "th" ? "ตรวจสอบข้อมูลเรคคอร์ด" : "Record Inspector"}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(94vw, 680px)",
              maxHeight: "85vh",
              display: "flex",
              flexDirection: "column",
              padding: 24,
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                display: "flex",
                alignItems: "start",
                justifyContent: "space-between",
                borderBottom: "1px solid var(--line)",
                paddingBottom: 14,
                marginBottom: 16,
              }}
            >
              <div>
                <span className="data-badge" style={{ marginBottom: 6 }}>
                  <Database size={12} />
                  {selectedTable}
                </span>
                <h2 style={{ margin: "4px 0 0", fontSize: 18 }}>
                  {locale === "th" ? "รายละเอียดเรคคอร์ด" : "Row Inspector"}
                </h2>
                <p style={{ margin: "3px 0 0", color: "var(--muted)", fontSize: 11 }}>
                  {locale === "th" ? "ข้อมูลฟิลด์ทั้งหมดจากฐานข้อมูล Supabase" : "Full key-value inspector for this record"}
                </p>
              </div>
              <button
                className="icon-button"
                type="button"
                onClick={() => setSelectedRow(null)}
                aria-label={t.close}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Actions */}
            <div style={{ display: "flex", gap: 8, marginBottom: 12, justifyContent: "flex-end" }}>
              <button
                className="secondary-button small-button"
                type="button"
                onClick={() => copyToClipboard(JSON.stringify(selectedRow, null, 2), "modal-json")}
              >
                {copiedKey === "modal-json" ? <Check size={14} color="#2b9d65" /> : <Copy size={14} />}
                {copiedKey === "modal-json"
                  ? locale === "th"
                    ? "คัดลอก JSON แล้ว"
                    : "Copied JSON!"
                  : locale === "th"
                    ? "คัดลอก JSON"
                    : "Copy JSON"}
              </button>
            </div>

            {/* Scrollable Field Key-Value List */}
            <div style={{ overflowY: "auto", flex: 1, paddingRight: 4 }}>
              <div style={{ display: "grid", gap: 10 }}>
                {Object.entries(selectedRow).map(([key, val]) => {
                  const stringified =
                    val === null
                      ? "null"
                      : typeof val === "object"
                        ? JSON.stringify(val, null, 2)
                        : String(val);

                  return (
                    <div
                      key={key}
                      style={{
                        padding: "10px 12px",
                        borderRadius: 12,
                        background: "var(--surface-header, #f7f9fb)",
                        border: "1px solid var(--line)",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: 4,
                        }}
                      >
                        <strong
                          style={{
                            fontFamily: "monospace",
                            fontSize: 12,
                            color: "var(--foreground)",
                          }}
                        >
                          {key}
                        </strong>
                        <button
                          className="icon-button"
                          type="button"
                          onClick={() => copyToClipboard(stringified, key)}
                          aria-label={`${locale === "th" ? "คัดลอก" : "Copy"} ${key}`}
                          style={{ width: 26, height: 26 }}
                          title={locale === "th" ? "คัดลอกค่า" : "Copy value"}
                        >
                          {copiedKey === key ? <Check size={12} color="#2b9d65" /> : <Copy size={12} />}
                        </button>
                      </div>
                      <pre
                        style={{
                          margin: 0,
                          fontSize: 11,
                          fontFamily: "monospace",
                          color: val === null ? "var(--muted)" : "var(--foreground)",
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-all",
                          maxHeight: 180,
                          overflowY: "auto",
                        }}
                      >
                        {stringified}
                      </pre>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid var(--line)", textAlign: "right" }}>
              <button className="primary-button" type="button" onClick={() => setSelectedRow(null)}>
                {t.close}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "object") {
    if (Array.isArray(value)) return `[${value.length} items]`;
    return JSON.stringify(value);
  }
  return String(value);
}
