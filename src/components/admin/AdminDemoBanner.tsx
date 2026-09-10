"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { ShieldAlert } from "lucide-react";

export function AdminDemoBanner({ locale }: { locale: string }) {
  const [isDemo, setIsDemo] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    async function checkDemo() {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data } = await supabase.auth.getSession();
        const email = data.session?.user?.email?.toLowerCase();
        if (email === "admin@msu.ac.th") {
          setIsDemo(true);
        }
      } catch {
        // Safe fallback
      }
    }
    void checkDemo();
  }, []);

  if (!isDemo) return null;

  return (
    <div
      style={{
        margin: "0 0 16px 0",
        padding: "12px 18px",
        borderRadius: "14px",
        background: "linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)",
        border: "1.5px solid #93c5fd",
        color: "#1e40af",
        display: "flex",
        alignItems: "center",
        gap: "12px",
        boxShadow: "0 2px 10px rgba(59, 130, 246, 0.12)",
        fontSize: "13px",
      }}
    >
      <ShieldAlert size={20} color="#2563eb" style={{ flexShrink: 0 }} />
      <div>
        <strong>{locale === "th" ? "🎭 บัญชีผู้ดูแลระบบสาธิต (Demo Admin Sandbox)" : "🎭 Demo Admin Sandbox"}</strong>
        <div style={{ fontSize: "12px", opacity: 0.9, marginTop: 2 }}>
          {locale === "th"
            ? "เข้าสู่ระบบด้วย admin@msu.ac.th สำหรับนำเสนอผลงาน สามารถเรียกดูและทดสอบได้ครบทุกฟังก์ชัน แต่การแก้ไขหรือลบข้อมูลจะไม่กระทบฐานข้อมูลจริง"
            : "Signed in as admin@msu.ac.th for presentation purposes. Write and delete operations are simulated in sandbox mode."}
        </div>
      </div>
    </div>
  );
}
