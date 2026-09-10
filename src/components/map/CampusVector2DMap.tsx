"use client";

import React, { useId, useMemo, useRef, useState, type PointerEvent, type WheelEvent } from "react";
import {
  Compass,
  Layers,
  MapPin,
  Maximize2,
  Navigation2,
  RotateCcw,
  Search,
  ZoomIn,
  ZoomOut,
  Sparkles,
  Info
} from "lucide-react";
import type { Locale } from "@/lib/i18n";
import type { ParkingArea } from "@/lib/parking/demo-data";

export type LiveMapPoint = { latitude: number; longitude: number };

interface CampusVector2DMapProps {
  locale: Locale;
  areas: ParkingArea[];
  focusCode: string;
  onSelectArea: (code: string) => void;
  livePoints?: Record<string, LiveMapPoint>;
}

// Coordinate bounds for MSU Kham Riang Campus
const MIN_LNG = 103.2425;
const MAX_LNG = 103.2575;
const MIN_LAT = 16.2415;
const MAX_LAT = 16.2535;

const CANVAS_W = 1200;
const CANVAS_H = 900;
const PAD_X = 95;
const PAD_Y = 85;
const USABLE_W = CANVAS_W - 2 * PAD_X;
const USABLE_H = CANVAS_H - 2 * PAD_Y;

export function projectGpsToSvg(lat: number, lng: number): { x: number; y: number } {
  const normX = Math.max(0, Math.min(1, (lng - MIN_LNG) / (MAX_LNG - MIN_LNG)));
  const normY = Math.max(0, Math.min(1, (MAX_LAT - lat) / (MAX_LAT - MIN_LAT)));
  return {
    x: Math.round(PAD_X + normX * USABLE_W),
    y: Math.round(PAD_Y + normY * USABLE_H),
  };
}

type ZoneCategory = "all" | "academic" | "sports" | "dorms" | "admin";

const categoryZones: Record<ZoneCategory, string[]> = {
  all: [],
  academic: ["P01", "P04", "P06", "P07", "P08", "P14", "P15", "P16", "P17", "P18", "P22", "P26", "P27", "P28"],
  sports: ["P09", "P24", "P25"],
  dorms: ["P10", "P11", "P12", "P13", "P19", "P23"],
  admin: ["P02", "P03", "P05", "P20", "P21"],
};

export function CampusVector2DMap({
  locale,
  areas,
  focusCode,
  onSelectArea,
  livePoints = {},
}: CampusVector2DMapProps) {
  const isTh = locale === "th";
  const mapId = useId();

  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [hoveredCode, setHoveredCode] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<ZoneCategory>("all");
  const [showRoadNames, setShowRoadNames] = useState(true);

  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  function changeZoom(delta: number) {
    setZoom((curr) => Math.min(3.0, Math.max(0.7, Number((curr + delta).toFixed(2)))));
  }

  function resetView() {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }

  function handleWheel(e: WheelEvent<HTMLDivElement>) {
    e.preventDefault();
    changeZoom(e.deltaY < 0 ? 0.15 : -0.15);
  }

  function handlePointerDown(e: PointerEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest("button") || (e.target as HTMLElement).closest("input")) {
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, originX: offset.x, originY: offset.y };
    setDragging(true);
  }

  function handlePointerMove(e: PointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return;
    setOffset({
      x: dragRef.current.originX + (e.clientX - dragRef.current.startX),
      y: dragRef.current.originY + (e.clientY - dragRef.current.startY),
    });
  }

  function stopDragging(e: PointerEvent<HTMLDivElement>) {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    dragRef.current = null;
    setDragging(false);
  }

  // Filtered parking markers based on category and search
  const visibleAreas = useMemo(() => {
    return areas.filter((area) => {
      if (selectedCategory !== "all" && !categoryZones[selectedCategory].includes(area.code)) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchCode = area.code.toLowerCase().includes(q);
        const matchTh = area.th.toLowerCase().includes(q);
        const matchEn = area.en.toLowerCase().includes(q);
        return matchCode || matchTh || matchEn;
      }
      return true;
    });
  }, [areas, selectedCategory, searchQuery]);

  // Center on focusCode if requested
  const focusArea = areas.find((a) => a.code === focusCode);

  return (
    <div className="campus-vector-2d-wrapper" style={{ position: "relative", width: "100%", borderRadius: 16, overflow: "hidden", background: "#f1f6f0", border: "1px solid rgba(0,0,0,0.08)" }}>
      {/* Top Interactive Toolbar */}
      <div
        className="campus-vector-toolbar"
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          padding: "10px 14px",
          background: "rgba(255, 255, 255, 0.92)",
          backdropFilter: "blur(8px)",
          borderBottom: "1px solid rgba(0, 0, 0, 0.06)",
          zIndex: 10,
          position: "relative",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#166534", fontWeight: 700, fontSize: 13 }}>
            <Sparkles size={16} />
            <span>{isTh ? "แผนผัง 2D ออกแบบเอง (MSU Vector Map)" : "MSU Interactive 2D Vector Map"}</span>
          </div>

          <div style={{ position: "relative", minWidth: 160 }}>
            <Search size={13} style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: "#64748b" }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isTh ? "ค้นหาจุดจอด เช่น P01, วิศวะ..." : "Search zone (e.g. P01)..."}
              style={{
                padding: "4px 8px 4px 26px",
                fontSize: 12,
                borderRadius: 8,
                border: "1px solid #cbd5e1",
                background: "#ffffff",
                outline: "none",
                width: 170,
              }}
            />
          </div>
        </div>

        {/* Zone Category Filters */}
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {(
            [
              { id: "all", labelTh: "ทั้งหมด (28 จุด)", labelEn: "All (28)" },
              { id: "academic", labelTh: "คณะ/การศึกษา", labelEn: "Academic" },
              { id: "sports", labelTh: "กีฬา/กิจกรรม", labelEn: "Sports" },
              { id: "dorms", labelTh: "หอพัก/ตลาดน้อย", labelEn: "Dorms/Market" },
              { id: "admin", labelTh: "บริหาร/วิจัย", labelEn: "Admin/Research" },
            ] as const
          ).map((cat) => {
            const active = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                style={{
                  padding: "4px 9px",
                  fontSize: 11,
                  borderRadius: 6,
                  fontWeight: active ? 700 : 500,
                  border: active ? "1px solid #16a34a" : "1px solid #e2e8f0",
                  background: active ? "#16a34a" : "#ffffff",
                  color: active ? "#ffffff" : "#475569",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                {isTh ? cat.labelTh : cat.labelEn}
              </button>
            );
          })}
        </div>
      </div>

      {/* SVG Canvas Viewport */}
      <div
        ref={containerRef}
        className={`interactive-diagram ${dragging ? "is-dragging" : ""}`}
        style={{
          position: "relative",
          width: "100%",
          height: "min(70vw, 560px)",
          minHeight: 400,
          background: "#eaf2e8",
          overflow: "hidden",
          cursor: dragging ? "grabbing" : "grab",
          userSelect: "none",
          touchAction: "none",
        }}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={stopDragging}
        onPointerCancel={stopDragging}
        role="region"
        aria-label={isTh ? "แผนที่ 2D มหาวิทยาลัยมหาสารคาม" : "MSU 2D Interactive Vector Map"}
      >
        <div
          style={{
            position: "absolute",
            width: CANVAS_W,
            height: CANVAS_H,
            left: "50%",
            top: "50%",
            transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px)) scale(${zoom})`,
            transformOrigin: "center center",
            transition: dragging ? "none" : "transform 0.1s ease-out",
          }}
        >
          <svg
            viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
            width={CANVAS_W}
            height={CANVAS_H}
            style={{ width: "100%", height: "100%", display: "block" }}
          >
            <defs>
              {/* Gradients */}
              <linearGradient id={`lakeGrad-${mapId}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#93c5fd" />
                <stop offset="100%" stopColor="#60a5fa" />
              </linearGradient>
              <linearGradient id={`grassGrad-${mapId}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#dcfce7" />
                <stop offset="100%" stopColor="#bbf7d0" />
              </linearGradient>
              <linearGradient id={`trackGrad-${mapId}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#f87171" />
                <stop offset="100%" stopColor="#ef4444" />
              </linearGradient>
              <filter id={`shadow-${mapId}`} x="-10%" y="-10%" width="120%" height="120%">
                <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#0f172a" floodOpacity="0.18" />
              </filter>
              <filter id={`glow-${mapId}`} x="-30%" y="-30%" width="160%" height="160%">
                <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#f59e0b" floodOpacity="0.8" />
              </filter>
            </defs>

            {/* Campus Ground Polygon */}
            <rect width={CANVAS_W} height={CANVAS_H} fill="#ebf4ea" />

            {/* Campus Outline Zone */}
            <rect
              x={60}
              y={50}
              width={CANVAS_W - 120}
              height={CANVAS_H - 100}
              rx={32}
              fill="#f4faf2"
              stroke="#cbd5e1"
              strokeWidth="2"
              strokeDasharray="6 4"
            />

            {/* Natural Water Bodies (บึง มมส.) */}
            {/* Central Lake near President's Office / Health Garden */}
            <path
              d="M 590 640 Q 640 610 680 630 Q 710 650 690 680 Q 660 700 610 690 Q 580 670 590 640 Z"
              fill={`url(#lakeGrad-${mapId})`}
              stroke="#3b82f6"
              strokeWidth="1.5"
              opacity="0.85"
            />
            <text x="645" y="660" textAnchor="middle" fontSize="11" fill="#1e3a8a" fontWeight="600" opacity="0.8">
              {isTh ? "บึงสวนสุขภาพ มมส." : "MSU Health Lake"}
            </text>

            {/* North Lake near Talat Noi / Dorms */}
            <path
              d="M 450 180 Q 480 160 505 175 Q 520 200 495 215 Q 460 215 450 180 Z"
              fill={`url(#lakeGrad-${mapId})`}
              stroke="#3b82f6"
              strokeWidth="1.5"
              opacity="0.8"
            />

            {/* Road Network (โครงข่ายถนน มมส. วิทยาเขตขามเรียง) */}
            <g id="roads" opacity="0.95">
              {/* Outer Ring Road (ถนนวงแหวนรอบนอก) */}
              <path
                d="M 535 880 L 535 525 M 535 445 L 535 220 M 260 810 L 260 340 Q 260 210 370 210 L 890 210 Q 1030 210 1030 350 L 1030 650 Q 1030 780 890 780 L 370 780 Q 260 780 260 680"
                fill="none"
                stroke="#cbd5e1"
                strokeWidth="28"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M 535 880 L 535 525 M 535 445 L 535 220 M 260 810 L 260 340 Q 260 210 370 210 L 890 210 Q 1030 210 1030 350 L 1030 650 Q 1030 780 890 780 L 370 780 Q 260 780 260 680"
                fill="none"
                stroke="#ffffff"
                strokeWidth="24"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M 535 880 L 535 525 M 535 445 L 535 220 M 260 810 L 260 340 Q 260 210 370 210 L 890 210 Q 1030 210 1030 350 L 1030 650 Q 1030 780 890 780 L 370 780 Q 260 780 260 680"
                fill="none"
                stroke="#94a3b8"
                strokeWidth="1.5"
                strokeDasharray="10 8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Cross Avenues connecting East & West */}
              <path
                d="M 260 485 L 500 485 M 570 485 L 1030 485 M 260 360 L 1030 360 M 370 630 L 1030 630"
                fill="none"
                stroke="#cbd5e1"
                strokeWidth="18"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M 260 485 L 500 485 M 570 485 L 1030 485 M 260 360 L 1030 360 M 370 630 L 1030 630"
                fill="none"
                stroke="#ffffff"
                strokeWidth="14"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Main Roundabout: วงเวียนหลวงพ่อสมชาย / ธงชาติ */}
              <circle cx="535" cy="485" r="42" fill="#cbd5e1" />
              <circle cx="535" cy="485" r="38" fill="#ffffff" />
              <circle cx="535" cy="485" r="26" fill={`url(#grassGrad-${mapId})`} stroke="#16a34a" strokeWidth="2" />
              <circle cx="535" cy="485" r="9" fill="#f59e0b" />
              <text x="535" y="489" textAnchor="middle" fontSize="9" fill="#ffffff" fontWeight="bold">MSU</text>
            </g>

            {/* Road Name Labels */}
            {showRoadNames && (
              <g id="road-labels" fontSize="10" fill="#64748b" fontWeight="600" opacity="0.85">
                <text x="548" y="840" transform="rotate(-90 548 840)">{isTh ? "ถนนสายหลักทางเข้า มมส." : "MSU Main Avenue"}</text>
                <text x="535" y="530" textAnchor="middle">{isTh ? "วงเวียนหลวงพ่อสมชาย" : "Main Roundabout"}</text>
                <text x="645" y="775">{isTh ? "ถนนวงแหวนด้านทิศใต้" : "South Ring Road"}</text>
                <text x="645" y="205">{isTh ? "ถนนวงแหวนด้านทิศเหนือ (หอพัก/ตลาดน้อย)" : "North Ring Road"}</text>
              </g>
            )}

            {/* Landmark & Faculty Building Blocks */}
            <g id="buildings" filter={`url(#shadow-${mapId})`}>
              {/* สำนักงานอธิการบดี (อาคารบรมราชกุมารี) */}
              <rect x="475" y="685" width="120" height="60" rx="8" fill="#fef3c7" stroke="#d97706" strokeWidth="1.5" />
              <text x="535" y="715" textAnchor="middle" fontSize="11" fontWeight="700" fill="#92400e">
                {isTh ? "🏛️ สนง.อธิการบดี" : "🏛️ President's Office"}
              </text>
              <text x="535" y="730" textAnchor="middle" fontSize="9" fill="#b45309">
                {isTh ? "(อาคารบรมราชกุมารี)" : "Borommaratchakumari"}
              </text>

              {/* โรงเรียนสาธิต มมส. (ฝ่ายมัธยม) */}
              <rect x="335" y="730" width="115" height="65" rx="8" fill="#e0f2fe" stroke="#0284c7" strokeWidth="1.5" />
              <text x="392" y="762" textAnchor="middle" fontSize="11" fontWeight="700" fill="#0369a1">
                {isTh ? "🏫 สาธิต มมส. (มัธยม)" : "🏫 Demonstration School"}
              </text>

              {/* สำนักพิพิธภัณฑ์ */}
              <rect x="705" y="630" width="85" height="50" rx="8" fill="#f3e8ff" stroke="#9333ea" strokeWidth="1.5" />
              <text x="747" y="658" textAnchor="middle" fontSize="10" fontWeight="700" fill="#7e22ce">
                {isTh ? "🏛️ พิพิธภัณฑ์" : "🏛️ Museum"}
              </text>

              {/* คณะสถาปัตยกรรมศาสตร์ */}
              <rect x="620" y="530" width="85" height="48" rx="8" fill="#ffedd5" stroke="#ea580c" strokeWidth="1.5" />
              <text x="662" y="558" textAnchor="middle" fontSize="10" fontWeight="700" fill="#c2410c">
                {isTh ? "🎨 สถาปัตย์" : "🎨 Architecture"}
              </text>

              {/* วิทยาลัยดุริยางคศิลป์ */}
              <rect x="575" y="585" width="80" height="45" rx="8" fill="#fdf4ff" stroke="#c026d3" strokeWidth="1.5" />
              <text x="615" y="612" textAnchor="middle" fontSize="10" fontWeight="700" fill="#a21caf">
                {isTh ? "🎵 ดุริยางคศิลป์" : "🎵 Music College"}
              </text>

              {/* คณะสิ่งแวดล้อมและทรัพยากรศาสตร์ */}
              <rect x="735" y="555" width="80" height="48" rx="8" fill="#ecfdf5" stroke="#059669" strokeWidth="1.5" />
              <text x="775" y="583" textAnchor="middle" fontSize="10" fontWeight="700" fill="#047857">
                {isTh ? "🌿 สิ่งแวดล้อมฯ" : "🌿 Environment"}
              </text>

              {/* อาคารปฏิบัติการวิศวกรรมศาสตร์ */}
              <rect x="870" y="555" width="90" height="50" rx="8" fill="#f1f5f9" stroke="#64748b" strokeWidth="1.5" />
              <text x="915" y="583" textAnchor="middle" fontSize="10" fontWeight="700" fill="#334155">
                {isTh ? "⚙️ ปฏิบัติการวิศวะ" : "⚙️ Eng Lab Bldg"}
              </text>

              {/* คณะมนุษยศาสตร์และสังคมศาสตร์ */}
              <rect x="435" y="515" width="90" height="55" rx="8" fill="#fef2f2" stroke="#dc2626" strokeWidth="1.5" />
              <text x="480" y="545" textAnchor="middle" fontSize="10" fontWeight="700" fill="#b91c1c">
                {isTh ? "📖 มนุษยศาสตร์ฯ" : "📖 Humanities"}
              </text>

              {/* อาคารราชนครินทร์ (RN) */}
              <rect x="390" y="440" width="85" height="55" rx="8" fill="#fffbeb" stroke="#d97706" strokeWidth="1.5" />
              <text x="432" y="470" textAnchor="middle" fontSize="10" fontWeight="700" fill="#b45309">
                {isTh ? "🏢 อาคาร RN" : "🏢 Ratchanakharin"}
              </text>

              {/* สำนักวิทยบริการ (หอสมุดกลาง มมส.) */}
              <rect x="630" y="435" width="95" height="60" rx="8" fill="#eff6ff" stroke="#2563eb" strokeWidth="1.5" />
              <text x="677" y="465" textAnchor="middle" fontSize="11" fontWeight="700" fill="#1d4ed8">
                {isTh ? "📚 หอสมุดกลาง" : "📚 Central Library"}
              </text>
              <text x="677" y="480" textAnchor="middle" fontSize="9" fill="#1e40af">
                {isTh ? "(สำนักวิทยบริการ)" : "(Academic Resource)"}
              </text>

              {/* สำนักคอมพิวเตอร์ */}
              <rect x="735" y="450" width="80" height="50" rx="8" fill="#f0fdf4" stroke="#16a34a" strokeWidth="1.5" />
              <text x="775" y="478" textAnchor="middle" fontSize="10" fontWeight="700" fill="#15803d">
                {isTh ? "💻 คอมพิวเตอร์" : "💻 Computer Center"}
              </text>

              {/* คณะวิทยาศาสตร์ (SC1 - SC3) */}
              <rect x="665" y="335" width="105" height="65" rx="8" fill="#f0f9ff" stroke="#0284c7" strokeWidth="1.5" />
              <text x="717" y="365" textAnchor="middle" fontSize="11" fontWeight="700" fill="#0369a1">
                {isTh ? "🔬 คณะวิทยาศาสตร์" : "🔬 Science (SC)"}
              </text>
              <text x="717" y="382" textAnchor="middle" fontSize="9" fill="#0284c7">
                {isTh ? "(SC1, SC2, SC3)" : "Buildings SC1-SC3"}
              </text>

              {/* คณะวิศวกรรมศาสตร์ */}
              <rect x="800" y="360" width="95" height="60" rx="8" fill="#fff7ed" stroke="#ea580c" strokeWidth="1.5" />
              <text x="847" y="392" textAnchor="middle" fontSize="11" fontWeight="700" fill="#c2410c">
                {isTh ? "⚙️ วิศวกรรมศาสตร์" : "⚙️ Engineering"}
              </text>

              {/* คณะเทคโนโลยี */}
              <rect x="775" y="295" width="85" height="48" rx="8" fill="#fefce8" stroke="#ca8a04" strokeWidth="1.5" />
              <text x="817" y="323" textAnchor="middle" fontSize="10" fontWeight="700" fill="#a16207">
                {isTh ? "🌾 คณะเทคโนโลยี" : "🌾 Technology"}
              </text>

              {/* คณะพยาบาลศาสตร์ & สาธารณสุขศาสตร์ */}
              <rect x="860" y="430" width="95" height="60" rx="8" fill="#fdf2f8" stroke="#db2777" strokeWidth="1.5" />
              <text x="907" y="458" textAnchor="middle" fontSize="10" fontWeight="700" fill="#be185d">
                {isTh ? "🏥 พยาบาลศาสตร์" : "🏥 Nursing"}
              </text>
              <text x="907" y="474" textAnchor="middle" fontSize="9" fill="#9d174d">
                {isTh ? "& สาธารณสุขศาสตร์" : "& Public Health"}
              </text>

              {/* คอนโดบุคลากร & ศูนย์วิจัย */}
              <rect x="955" y="235" width="90" height="55" rx="8" fill="#faf5ff" stroke="#9333ea" strokeWidth="1.5" />
              <text x="1000" y="265" textAnchor="middle" fontSize="10" fontWeight="700" fill="#7e22ce">
                {isTh ? "🏢 คอนโดบุคลากร" : "🏢 Staff Residence"}
              </text>

              <rect x="945" y="350" width="95" height="55" rx="8" fill="#f5f3ff" stroke="#7c3aed" strokeWidth="1.5" />
              <text x="992" y="380" textAnchor="middle" fontSize="10" fontWeight="700" fill="#6d28d9">
                {isTh ? "🔬 ศูนย์วิจัย มมส." : "🔬 Research Center"}
              </text>

              {/* สนามกีฬา มมส. (Running Track Oval) */}
              <ellipse cx="295" cy="340" rx="72" ry="46" fill={`url(#trackGrad-${mapId})`} stroke="#b91c1c" strokeWidth="2" />
              <ellipse cx="295" cy="340" rx="52" ry="28" fill="#22c55e" stroke="#ffffff" strokeWidth="2" />
              <text x="295" y="344" textAnchor="middle" fontSize="10" fontWeight="700" fill="#ffffff">
                {isTh ? "⚽ สนามกีฬา มมส." : "⚽ Main Stadium"}
              </text>

              {/* สนามแบดมินตัน & อาคารพลศึกษา */}
              <rect x="220" y="215" width="85" height="55" rx="8" fill="#f0fdfa" stroke="#0d9488" strokeWidth="1.5" />
              <text x="262" y="245" textAnchor="middle" fontSize="10" fontWeight="700" fill="#0f766e">
                {isTh ? "🏸 พลศึกษา" : "🏸 Badminton/Gym"}
              </text>

              {/* สนามฟุตบอลหญ้าเทียม */}
              <rect x="150" y="315" width="85" height="55" rx="8" fill="#dcfce7" stroke="#16a34a" strokeWidth="1.5" />
              <text x="192" y="345" textAnchor="middle" fontSize="10" fontWeight="700" fill="#15803d">
                {isTh ? "⚽ หญ้าเทียม" : "⚽ Turf Field"}
              </text>

              {/* กลุ่มหอพักนิสิต */}
              <rect x="405" y="165" width="95" height="60" rx="8" fill="#e0e7ff" stroke="#4f46e5" strokeWidth="1.5" />
              <text x="452" y="197" textAnchor="middle" fontSize="11" fontWeight="700" fill="#4338ca">
                {isTh ? "🏢 หอพักนิสิต" : "🏢 Student Dorms"}
              </text>

              {/* ตลาดน้อย (Talat Noi Plaza) */}
              <rect x="515" y="140" width="95" height="55" rx="8" fill="#fef3c7" stroke="#d97706" strokeWidth="1.5" />
              <text x="562" y="170" textAnchor="middle" fontSize="11" fontWeight="700" fill="#b45309">
                {isTh ? "🍜 ตลาดน้อย" : "🍜 Talat Noi"}
              </text>

              {/* ลานเล้าไก่ / MSU Space */}
              <rect x="515" y="230" width="85" height="48" rx="8" fill="#fffbeb" stroke="#f59e0b" strokeWidth="1.5" />
              <text x="557" y="258" textAnchor="middle" fontSize="10" fontWeight="700" fill="#b45309">
                {isTh ? "🐔 ลานเล้าไก่" : "🐔 MSU Space"}
              </text>

              {/* กองกิจการนิสิต */}
              <rect x="335" y="175" width="80" height="48" rx="8" fill="#f1f5f9" stroke="#64748b" strokeWidth="1.5" />
              <text x="375" y="203" textAnchor="middle" fontSize="9" fontWeight="700" fill="#334155">
                {isTh ? "🏢 กองกิจการนิสิต" : "🏢 Student Affairs"}
              </text>
            </g>

            {/* Parking Zones P01 to P28 Markers */}
            <g id="parking-markers">
              {visibleAreas.map((area) => {
                const live = livePoints[area.code.toUpperCase()];
                const lat = live?.latitude ?? area.latitude;
                const lng = live?.longitude ?? area.longitude;
                const { x, y } = projectGpsToSvg(lat, lng);

                const isActive = focusCode === area.code;
                const isHovered = hoveredCode === area.code;

                // Color based on status
                const isFull = area.status === "full";
                const isBusy = area.status === "occupied" || area.status === "reserved";
                const statusColor = isFull ? "#ef4444" : isBusy ? "#f59e0b" : "#10b981";
                const areaNumber = area.code.replace("P", "");

                return (
                  <g
                    key={area.code}
                    className="parking-marker-group"
                    style={{ cursor: "pointer" }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectArea(area.code);
                    }}
                    onMouseEnter={() => setHoveredCode(area.code)}
                    onMouseLeave={() => setHoveredCode(null)}
                  >
                    {/* Pulsing Highlight Ring when Selected */}
                    {isActive && (
                      <circle
                        cx={x}
                        cy={y}
                        r={30}
                        fill="none"
                        stroke="#f59e0b"
                        strokeWidth="3.5"
                        strokeDasharray="6 4"
                        filter={`url(#glow-${mapId})`}
                        opacity="0.9"
                      >
                        <animateTransform
                          attributeName="transform"
                          type="rotate"
                          from={`0 ${x} ${y}`}
                          to={`360 ${x} ${y}`}
                          dur="12s"
                          repeatCount="indefinite"
                        />
                      </circle>
                    )}

                    {/* Anchor Dot */}
                    <circle cx={x} cy={y} r={3} fill="#0f172a" opacity="0.6" />

                    {/* Marker Badge Container */}
                    <g transform={`translate(${x}, ${y}) scale(${isActive ? 1.25 : isHovered ? 1.15 : 1})`} style={{ transition: "transform 0.15s ease" }}>
                      {/* Shadow */}
                      <rect
                        x="-20"
                        y="-34"
                        width="40"
                        height="26"
                        rx="13"
                        fill="#000000"
                        opacity="0.25"
                        transform="translate(1, 2)"
                      />

                      {/* Main Pill Badge */}
                      <rect
                        x="-20"
                        y="-34"
                        width="40"
                        height="26"
                        rx="13"
                        fill={isActive ? "#f59e0b" : statusColor}
                        stroke="#ffffff"
                        strokeWidth={isActive ? 2.5 : 2}
                      />

                      {/* Pin Code Text */}
                      <text
                        x="0"
                        y="-17"
                        textAnchor="middle"
                        fontSize="11"
                        fontWeight="900"
                        fill="#ffffff"
                        letterSpacing="-0.3px"
                      >
                        {area.code}
                      </text>

                      {/* Short Name Tag below badge */}
                      <rect
                        x="-30"
                        y="-6"
                        width="60"
                        height="15"
                        rx="4"
                        fill="rgba(15, 23, 42, 0.85)"
                      />
                      <text
                        x="0"
                        y="5"
                        textAnchor="middle"
                        fontSize="8.5"
                        fontWeight="600"
                        fill="#ffffff"
                      >
                        {area.th.replace("พื้นที่โซน", "").replace("พื้นที่ลานจอด", "").slice(0, 11)}
                      </text>
                    </g>
                  </g>
                );
              })}
            </g>
          </svg>
        </div>

        {/* Map Overlays: Zoom & Reset Controls */}
        <div
          style={{
            position: "absolute",
            top: 14,
            right: 14,
            display: "flex",
            flexDirection: "column",
            gap: 6,
            zIndex: 5,
          }}
        >
          <button
            type="button"
            onClick={() => changeZoom(0.25)}
            title={isTh ? "ขยาย" : "Zoom In"}
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              border: "1px solid rgba(0,0,0,0.1)",
              background: "rgba(255, 255, 255, 0.95)",
              color: "#334155",
              display: "grid",
              placeItems: "center",
              cursor: "pointer",
              boxShadow: "0 4px 10px rgba(0,0,0,0.12)",
            }}
          >
            <ZoomIn size={18} />
          </button>
          <button
            type="button"
            onClick={() => changeZoom(-0.25)}
            title={isTh ? "ย่อ" : "Zoom Out"}
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              border: "1px solid rgba(0,0,0,0.1)",
              background: "rgba(255, 255, 255, 0.95)",
              color: "#334155",
              display: "grid",
              placeItems: "center",
              cursor: "pointer",
              boxShadow: "0 4px 10px rgba(0,0,0,0.12)",
            }}
          >
            <ZoomOut size={18} />
          </button>
          <button
            type="button"
            onClick={resetView}
            title={isTh ? "รีเซ็ตมุมมอง" : "Reset View"}
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              border: "1px solid rgba(0,0,0,0.1)",
              background: "rgba(255, 255, 255, 0.95)",
              color: "#334155",
              display: "grid",
              placeItems: "center",
              cursor: "pointer",
              boxShadow: "0 4px 10px rgba(0,0,0,0.12)",
            }}
          >
            <RotateCcw size={17} />
          </button>
        </div>

        {/* Compass & Orientation Overlay */}
        <div
          style={{
            position: "absolute",
            top: 14,
            left: 14,
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "5px 10px",
            borderRadius: 8,
            background: "rgba(255, 255, 255, 0.92)",
            border: "1px solid rgba(0,0,0,0.08)",
            boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
            fontSize: 11,
            fontWeight: 700,
            color: "#1e293b",
          }}
        >
          <Navigation2 size={13} style={{ transform: "rotate(-45deg)", color: "#ef4444" }} />
          <span>N ทิศเหนือ</span>
        </div>

        {/* Legend Overlay */}
        <div
          style={{
            position: "absolute",
            bottom: 12,
            left: 12,
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "6px 12px",
            borderRadius: 10,
            background: "rgba(255, 255, 255, 0.94)",
            border: "1px solid rgba(0,0,0,0.08)",
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            fontSize: 11,
            fontWeight: 600,
            color: "#334155",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#10b981", display: "inline-block" }} />
            <span>{isTh ? "ว่าง" : "Available"}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#f59e0b", display: "inline-block" }} />
            <span>{isTh ? "ปานกลาง/ใกล้เต็ม" : "Busy"}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#ef4444", display: "inline-block" }} />
            <span>{isTh ? "เต็ม" : "Full"}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#f59e0b", border: "2px solid #ffffff", boxShadow: "0 0 0 1px #f59e0b", display: "inline-block" }} />
            <span>{isTh ? "จุดที่เลือก" : "Selected"}</span>
          </div>
        </div>

        {/* Drag / Wheel Helper Hint */}
        <div
          style={{
            position: "absolute",
            bottom: 12,
            right: 12,
            padding: "5px 10px",
            borderRadius: 8,
            background: "rgba(15, 23, 42, 0.75)",
            color: "#ffffff",
            fontSize: 10,
            lineHeight: 1.4,
          }}
        >
          {isTh ? "ลากเพื่อเลื่อน · หมุนล้อเมาส์เพื่อซูม" : "Drag to pan · Wheel to zoom"}
        </div>
      </div>
    </div>
  );
}
