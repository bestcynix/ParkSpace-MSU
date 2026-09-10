import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

async function verifyAdminAuth(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return { error: "Supabase not configured", status: 503 };
  }

  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "");

  const client = createServerClient(supabaseUrl, serviceRoleKey || supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll() {},
    },
  });

  let userId: string | null = null;
  let userEmail: string | null = null;

  if (token) {
    const { data: userData } = await client.auth.getUser(token);
    userId = userData.user?.id ?? null;
    userEmail = userData.user?.email ?? null;
  } else {
    const { data: userData } = await client.auth.getUser();
    userId = userData.user?.id ?? null;
    userEmail = userData.user?.email ?? null;
  }

  if (!userId) {
    return { error: "Sign in required", status: 401 };
  }

  // Super Admins bypass
  const normalizedEmail = (userEmail || "").toLowerCase();
  if (normalizedEmail === "68011211206@msu.ac.th" || normalizedEmail === "69010518004@msu.ac.th") {
    const adminClient = serviceRoleKey
      ? createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
      : client;
    return { userId, adminClient };
  }

  // Check user_roles
  const { data: userRoles } = await client
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);

  const roles = (userRoles ?? []).map((r) => String(r.role).toLowerCase().trim());
  let isAdmin = roles.includes("admin") || roles.includes("developer");

  if (!isAdmin) {
    const { data: profile } = await client
      .from("profiles")
      .select("user_type")
      .eq("id", userId)
      .maybeSingle();

    if (profile?.user_type?.toLowerCase() === "admin") {
      isAdmin = true;
    }
  }

  if (!isAdmin) {
    return { error: "Administrator role required", status: 403 };
  }

  const adminClient = serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
    : client;

  return { userId, adminClient };
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAdminAuth(request);
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { adminClient } = authResult;
    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") ?? "20", 10)));
    const q = (searchParams.get("q") ?? "").trim();

    let query = adminClient
      .from("audit_logs")
      .select(
        "id, action, actor_type, actor_id, entity_type, entity_id, result, metadata, created_at",
        { count: "exact" }
      )
      .order("created_at", { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (q) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(q);
      if (isUuid) {
        query = query.or(`action.ilike.%${q}%,actor_id.eq.${q},entity_id.eq.${q},result.ilike.%${q}%`);
      } else {
        query = query.or(
          `action.ilike.%${q}%,actor_type.ilike.%${q}%,entity_type.ilike.%${q}%,result.ilike.%${q}%`
        );
      }
    }

    const { data, error, count } = await query;

    if (error) {
      console.warn("[audit-logs API] Primary query warning:", error.message);
      // Fallback: simple select
      const fallback = await adminClient
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(pageSize);

      return NextResponse.json({
        logs: fallback.data ?? [],
        total: fallback.data?.length ?? 0,
        page,
        pageSize,
      });
    }

    return NextResponse.json({
      logs: data ?? [],
      total: count ?? data?.length ?? 0,
      page,
      pageSize,
    });
  } catch (error) {
    console.error("[audit-logs API] Unexpected error:", error);
    return NextResponse.json({ logs: [], total: 0, page: 1, pageSize: 20 }, { status: 200 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authResult = await verifyAdminAuth(request);
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { adminClient } = authResult;
    const body = (await request.json()) as { id?: string };
    if (!body.id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const { error } = await adminClient.from("audit_logs").delete().eq("id", body.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const authResult = await verifyAdminAuth(request);
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { adminClient } = authResult;
    const body = (await request.json()) as {
      id?: string;
      action?: string;
      result?: string;
      actor_type?: string;
      entity_type?: string;
      metadata?: Record<string, unknown>;
    };
    if (!body.id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const updates: Record<string, unknown> = {};
    if (body.action !== undefined) updates.action = body.action;
    if (body.result !== undefined) updates.result = body.result;
    if (body.actor_type !== undefined) updates.actor_type = body.actor_type;
    if (body.entity_type !== undefined) updates.entity_type = body.entity_type;
    if (body.metadata !== undefined) updates.metadata = body.metadata;

    const { data, error } = await adminClient
      .from("audit_logs")
      .update(updates)
      .eq("id", body.id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, log: data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAdminAuth(request);
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { adminClient, userId } = authResult;
    const body = (await request.json()) as {
      action?: string;
      actor_type?: string;
      entity_type?: string;
      entity_id?: string;
      before_data?: unknown;
      after_data?: unknown;
      reason?: string;
      metadata?: Record<string, unknown>;
      result?: string;
      trace_id?: string;
      event_id?: string;
    };

    const traceId = body.trace_id || crypto.randomUUID();
    const eventId = body.event_id || `admin_evt_${Date.now()}`;

    const { data, error } = await adminClient
      .from("audit_logs")
      .insert({
        event_id: eventId,
        trace_id: traceId,
        actor_type: body.actor_type || "ADMIN",
        actor_id: userId,
        action: body.action || "ADMIN_ACTION",
        entity_type: body.entity_type || "general",
        entity_id: body.entity_id || null,
        before_data: body.before_data || null,
        after_data: body.after_data || null,
        reason: body.reason || null,
        metadata: body.metadata || {},
        result: body.result || "SUCCESS",
      })
      .select()
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, log: data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}


