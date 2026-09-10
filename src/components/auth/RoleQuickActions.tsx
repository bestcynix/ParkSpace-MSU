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
        const user = sessionData.session.user;
        const userEmail = (user.email ?? "").toLowerCase().trim();

        const { data } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId);

        let fetchedRoles: string[] = [];
        if (data) {
          fetchedRoles = data.map((r: { role?: unknown }) => {
            const role = String(r.role ?? "").toLowerCase().trim();
            return role === "developer" ? "admin" : role;
          });
        }

        // Fallback 1: profiles.user_type
        if (!fetchedRoles.length) {
          try {
            const { data: prof } = await supabase
              .from("profiles")
              .select("user_type")
              .eq("id", userId)
              .maybeSingle();
            if (prof?.user_type) {
              const pType = String(prof.user_type).toLowerCase().trim();
              if (pType === "admin" || pType === "staff") {
                fetchedRoles.push(pType);
              }
            }
          } catch {
            // ignore
          }
        }

        // Fallback 2: user_metadata
        const metaType = String(user.user_metadata?.user_type || user.user_metadata?.role || "").toLowerCase().trim();
        if (metaType === "admin" || metaType === "staff") {
          if (!fetchedRoles.includes(metaType)) fetchedRoles.push(metaType);
        }

        // Fallback 3: predefined emails
        if (userEmail === "68011211206@msu.ac.th" || userEmail === "69010518004@msu.ac.th" || userEmail === "admin@msu.ac.th") {
          if (!fetchedRoles.includes("admin")) fetchedRoles.push("admin");
        } else if (userEmail === "staff@msu.ac.th" || userEmail.startsWith("staff")) {
          if (!fetchedRoles.includes("staff")) fetchedRoles.push("staff");
        }

        if (active) {
          setRoles(fetchedRoles);
        }
      } catch {
        // Safe fallback
      }
    }
    void loadRoles();
    return () => { active = false; };
  }, []);

  const isStaff = roles.includes("staff") || roles.includes("admin");
  const isAdmin = roles.includes("admin");

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
      </div>
    </div>
  );
}
