"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Activity, LayoutDashboard, QrCode } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { createSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

export function RoleQuickActions({ locale }: { locale: Locale }) {
  const [roles, setRoles] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    async function loadRoles() {
      if (!isSupabaseConfigured()) return;
      try {
        const supabase = createSupabaseBrowserClient();
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData.session?.user.id;
        if (!userId) return;

        const { data } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId);

        if (active && data) {
          const fetchedRoles = data.map((r: { role?: unknown }) => String(r.role ?? "").toLowerCase().trim());
          setRoles(fetchedRoles);
        }
      } catch {
        // Safe fallback
      }
    }
    void loadRoles();
    return () => { active = false; };
  }, []);

  const isStaff = roles.includes("staff") || roles.includes("admin") || roles.includes("developer");
  const isAdmin = roles.includes("admin") || roles.includes("developer");
  const isDeveloper = roles.includes("developer");

  if (!roles.length) return null;

  return (
    <div className="role-quick-banner" role="region" aria-label="Role Quick Actions">
      <div className="role-quick-badge">
        <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#22c55e" }} />
        <span>{locale === "th" ? "ทางลัดเจ้าหน้าที่ / ผู้ดูแล" : "Operational Access"}</span>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {isStaff ? (
          <Link className="role-quick-button" href={`/${locale}/staff/scan`}>
            <QrCode size={15} />
            <span>{locale === "th" ? "สแกนบัตรผ่าน (Staff)" : "Staff Scanner"}</span>
          </Link>
        ) : null}
        {isAdmin ? (
          <Link className="role-quick-button" href={`/${locale}/admin/dashboard`}>
            <LayoutDashboard size={15} />
            <span>{locale === "th" ? "Admin Console" : "Admin Console"}</span>
          </Link>
        ) : null}
        {isDeveloper ? (
          <Link className="role-quick-button" href={`/${locale}/developer/health`}>
            <Activity size={15} />
            <span>{locale === "th" ? "Dev Console" : "Dev Console"}</span>
          </Link>
        ) : null}
      </div>
    </div>
  );
}
