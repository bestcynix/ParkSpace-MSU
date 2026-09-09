"use client";

import { useEffect } from "react";
import { projectInfo } from "@/lib/project-info";

/**
 * BestCyniX Dev - Soft Protection & System Logger
 * Keeps normal browser interactions available while preventing accidental
 * dragging of image and link assets. The console notice is informational only.
 */
export function SystemConsoleNotice() {
  useEffect(() => {
    const preventAssetDrag = (event: DragEvent) => {
      const target = event.target;
      if (target instanceof Element && (target.matches("img") || target.matches("a") || target.closest("a"))) {
        event.preventDefault();
      }
    };

    document.addEventListener("dragstart", preventAssetDrag);
    console.log(
      "%c⚡ BESTCYNIX DEV • FULL-STACK ENGINEERING ⚡",
      "color: #32ffc9; font-size: 18px; font-weight: bold; background: #050b14; padding: 8px 16px; border: 2px solid #32ffc9; border-radius: 8px;",
    );
    console.log(
      "%cยินดีต้อนรับสู่ระบบของ BestCyniX Dev • สนใจพัฒนาระบบหรือร่วมงาน ติดต่อได้ที่ bestcynix@gmail.com",
      "color: #38bdf8; font-size: 12px; font-weight: 500;",
    );
    console.log(
      `%cPowered by ${projectInfo.poweredBy.name} • ${projectInfo.poweredBy.studentId} · สาขาวิทยาการสารสนเทศ · เทคโนโลยีสารสนเทศ`,
      "color: #f8c928; font-size: 12px; font-weight: 600;",
    );

    return () => document.removeEventListener("dragstart", preventAssetDrag);
  }, []);

  return null;
}
