import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSystemDatabaseClient } from "@/lib/supabase/system-client";

type AuthResult = {
  userId: string | null;
  userEmail: string | null;
  isAdmin: boolean;
  isStaff: boolean;
  isDemo: boolean;
};

async function getCallerAuth(request: NextRequest): Promise<AuthResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  const defaultResult: AuthResult = {
    userId: null,
    userEmail: null,
    isAdmin: false,
    isStaff: false,
    isDemo: false,
  };

  if (!supabaseUrl || !supabaseAnonKey) return defaultResult;

  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "");

  const authClient = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll() {},
    },
  });

  let user: { id: string; email?: string } | null = null;
  if (token) {
    const { data } = await authClient.auth.getUser(token);
    if (data.user) user = data.user;
  }
  if (!user) {
    const { data } = await authClient.auth.getUser();
    if (data.user) user = data.user;
  }

  if (!user?.id) return defaultResult;

  const userEmail = (user.email || "").toLowerCase().trim();
  const isDemo = userEmail === "admin@msu.ac.th";

  // Super admins
  if (userEmail === "68011211206@msu.ac.th" || userEmail === "69010518004@msu.ac.th" || userEmail === "admin@msu.ac.th") {
    return {
      userId: user.id,
      userEmail,
      isAdmin: true,
      isStaff: true,
      isDemo,
    };
  }

  if (userEmail === "staff@msu.ac.th") {
    return {
      userId: user.id,
      userEmail,
      isAdmin: false,
      isStaff: true,
      isDemo: false,
    };
  }

  // Query database roles
  try {
    const sysClient = await getSystemDatabaseClient();
    const { data: roleData } = await sysClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const roles = (roleData ?? []).map((r: { role: string }) => String(r.role).toLowerCase().trim());
    const isAdmin = roles.includes("admin") || roles.includes("developer");
    const isStaff = isAdmin || roles.includes("staff");

    return {
      userId: user.id,
      userEmail,
      isAdmin,
      isStaff,
      isDemo,
    };
  } catch {
    return defaultResult;
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") ?? "20", 10)));
    const status = searchParams.get("status") ?? "ALL";
    const category = searchParams.get("category");
    const areaId = searchParams.get("areaId");
    const q = (searchParams.get("q") ?? "").trim();
    const isSummaryOnly = searchParams.get("summary") === "true";

    const sysClient = await getSystemDatabaseClient();

    // Calculate status counts
    const { data: allIncidents } = await sysClient
      .from("incidents")
      .select("status");

    const counts = {
      total: allIncidents?.length ?? 0,
      new: allIncidents?.filter((i) => i.status === "NEW").length ?? 0,
      reviewing: allIncidents?.filter((i) => i.status === "REVIEWING").length ?? 0,
      in_progress: allIncidents?.filter((i) => i.status === "IN_PROGRESS").length ?? 0,
      resolved: allIncidents?.filter((i) => i.status === "RESOLVED").length ?? 0,
      unresolved: allIncidents?.filter((i) => i.status !== "RESOLVED").length ?? 0,
    };

    if (isSummaryOnly) {
      return NextResponse.json({
        counts,
        unresolvedCount: counts.unresolved,
      });
    }

    let query = sysClient
      .from("incidents")
      .select(
        `
        id,
        category,
        notes,
        status,
        created_at,
        updated_at,
        parking_area_id,
        parking_slot_id,
        reported_by,
        parking_areas:parking_area_id (
          id,
          code,
          name_th,
          name_en
        ),
        parking_slots:parking_slot_id (
          id,
          slot_code,
          row_label
        ),
        profiles:reported_by (
          id,
          full_name,
          email,
          phone
        )
      `,
        { count: "exact" }
      )
      .order("created_at", { ascending: false });

    if (status === "UNRESOLVED") {
      query = query.neq("status", "RESOLVED");
    } else if (status && status !== "ALL") {
      query = query.eq("status", status.toUpperCase());
    }

    if (category && category !== "ALL") {
      query = query.eq("category", category);
    }

    if (areaId && areaId !== "ALL") {
      query = query.eq("parking_area_id", areaId);
    }

    if (q) {
      query = query.or(`category.ilike.%${q}%,notes.ilike.%${q}%`);
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      incidents: data ?? [],
      total: count ?? (data?.length ?? 0),
      unresolvedCount: counts.unresolved,
      counts,
      page,
      pageSize,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getCallerAuth(request);
    const body = await request.json();
    const { category, notes, parking_area_id, parking_slot_id } = body;

    if (!category || !notes?.trim() || !parking_area_id) {
      return NextResponse.json(
        { error: "Category, notes, and parking_area_id are required." },
        { status: 400 }
      );
    }

    const sysClient = await getSystemDatabaseClient();

    // If sandbox demo admin
    if (auth.isDemo) {
      return NextResponse.json({
        success: true,
        incident: {
          id: `demo-inc-${Date.now()}`,
          category,
          notes: notes.trim(),
          parking_area_id,
          parking_slot_id: parking_slot_id || null,
          status: "NEW",
          created_at: new Date().toISOString(),
          demo: true,
        },
        message: "บันทึกในโหมดทดสอบเรียบร้อยแล้ว (Demo mode: changes not persisted)",
      });
    }

    // Resolve reporter UUID
    let reporterId = auth.userId;
    if (!reporterId) {
      // Look up superadmin profile as system reporter
      const { data: adminProf } = await sysClient
        .from("profiles")
        .select("id")
        .eq("email", "68011211206@msu.ac.th")
        .maybeSingle();

      reporterId = adminProf?.id ?? "00000000-0000-0000-0000-000000000000";
    }

    const payload = {
      category: String(category).trim(),
      notes: String(notes).trim(),
      parking_area_id,
      parking_slot_id: parking_slot_id || null,
      reported_by: reporterId,
      status: "NEW",
    };

    const { data, error } = await sysClient
      .from("incidents")
      .insert(payload)
      .select(
        `
        id,
        category,
        notes,
        status,
        created_at,
        updated_at,
        parking_areas:parking_area_id (
          id,
          code,
          name_th,
          name_en
        ),
        parking_slots:parking_slot_id (
          id,
          slot_code,
          row_label
        ),
        profiles:reported_by (
          id,
          full_name,
          email,
          phone
        )
      `
      )
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, incident: data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await getCallerAuth(request);
    const body = await request.json();
    const { id, status, notes } = body;

    if (!id) {
      return NextResponse.json({ error: "Missing incident id" }, { status: 400 });
    }

    // Demo admin sandbox
    if (auth.isDemo) {
      return NextResponse.json({
        success: true,
        incident: { id, status, notes, updated_at: new Date().toISOString(), demo: true },
        message: "อัปเดตในโหมดทดสอบเรียบร้อยแล้ว (Demo mode: changes not persisted)",
      });
    }

    const validStatuses = ["NEW", "REVIEWING", "IN_PROGRESS", "RESOLVED"];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json({ error: `Invalid status: ${status}` }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (status) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes;

    const sysClient = await getSystemDatabaseClient();
    const { data, error } = await sysClient
      .from("incidents")
      .update(updateData)
      .eq("id", id)
      .select(
        `
        id,
        category,
        notes,
        status,
        created_at,
        updated_at,
        parking_areas:parking_area_id (
          id,
          code,
          name_th,
          name_en
        ),
        parking_slots:parking_slot_id (
          id,
          slot_code,
          row_label
        ),
        profiles:reported_by (
          id,
          full_name,
          email,
          phone
        )
      `
      )
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, incident: data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await getCallerAuth(request);
    if (!auth.isAdmin) {
      return NextResponse.json({ error: "Administrator role required" }, { status: 403 });
    }

    const body = await request.json();
    const { id } = body;
    if (!id) {
      return NextResponse.json({ error: "Missing incident id" }, { status: 400 });
    }

    // Demo admin sandbox
    if (auth.isDemo) {
      return NextResponse.json({
        success: true,
        message: "ลบในโหมดทดสอบเรียบร้อยแล้ว (Demo mode: changes not persisted)",
      });
    }

    const sysClient = await getSystemDatabaseClient();
    const { error } = await sysClient.from("incidents").delete().eq("id", id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
