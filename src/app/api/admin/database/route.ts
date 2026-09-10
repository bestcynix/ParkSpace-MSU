import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const ALLOWED_TABLES = [
  "parking_areas",
  "parking_slots",
  "profiles",
  "user_roles",
  "bookings",
  "parking_sessions",
  "audit_logs",
  "error_logs",
  "feedback",
  "incidents",
];

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      { cookies: { getAll: () => cookieStore.getAll() } }
    );
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id)
      .single();
    const role = roleData?.role?.toLowerCase();
    if (role !== "admin" && role !== "developer") {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }

    const body = (await request.json()) as {
      action: "insert" | "update" | "delete";
      table: string;
      id?: string;
      primaryKey?: string;
      record?: Record<string, unknown>;
    };

    const { action, table, id, primaryKey = "id", record } = body;

    if (!ALLOWED_TABLES.includes(table)) {
      return NextResponse.json({ error: `Table '${table}' is not supported for direct modification` }, { status: 400 });
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const { createClient } = await import("@supabase/supabase-js");
    const adminClient = serviceKey
      ? createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
      : supabase;

    if (action === "insert") {
      if (!record || Object.keys(record).length === 0) {
        return NextResponse.json({ error: "Empty record for insert" }, { status: 400 });
      }
      const { data, error } = await adminClient.from(table).insert(record).select().single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      // Audit log
      void adminClient.from("audit_logs").insert({
        event_id: `db-insert-${crypto.randomUUID()}`,
        trace_id: crypto.randomUUID(),
        actor_type: "ADMIN",
        actor_id: session.user.id,
        action: `DB_INSERT_${table.toUpperCase()}`,
        entity_type: table,
        entity_id: String(data?.id || ""),
        result: "SUCCESS",
        metadata: { table, record },
      });

      return NextResponse.json({ success: true, data });
    }

    if (action === "update") {
      if (!id) return NextResponse.json({ error: "Missing record ID for update" }, { status: 400 });
      if (!record || Object.keys(record).length === 0) {
        return NextResponse.json({ error: "Empty record for update" }, { status: 400 });
      }

      // Track edit in metadata if table supports metadata or has updated_at
      const finalRecord = { ...record };
      if ("updated_at" in finalRecord || table === "bookings" || table === "parking_areas") {
        finalRecord.updated_at = new Date().toISOString();
      }

      const { data, error } = await adminClient
        .from(table)
        .update(finalRecord)
        .eq(primaryKey, id)
        .select()
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      // Audit log
      void adminClient.from("audit_logs").insert({
        event_id: `db-update-${crypto.randomUUID()}`,
        trace_id: crypto.randomUUID(),
        actor_type: "ADMIN",
        actor_id: session.user.id,
        action: `DB_UPDATE_${table.toUpperCase()}`,
        entity_type: table,
        entity_id: id,
        result: "SUCCESS",
        metadata: { table, id, record: finalRecord, is_edited: true },
      });

      return NextResponse.json({ success: true, data });
    }

    if (action === "delete") {
      if (!id) return NextResponse.json({ error: "Missing record ID for delete" }, { status: 400 });

      const { error } = await adminClient.from(table).delete().eq(primaryKey, id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      // Audit log
      void adminClient.from("audit_logs").insert({
        event_id: `db-delete-${crypto.randomUUID()}`,
        trace_id: crypto.randomUUID(),
        actor_type: "ADMIN",
        actor_id: session.user.id,
        action: `DB_DELETE_${table.toUpperCase()}`,
        entity_type: table,
        entity_id: id,
        result: "SUCCESS",
        metadata: { table, id },
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
