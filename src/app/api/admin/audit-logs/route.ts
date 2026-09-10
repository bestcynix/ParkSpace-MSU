import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  try {
    // Check auth
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

    // Check admin role
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id)
      .single();
    const role = roleData?.role?.toLowerCase();
    if (role !== "admin" && role !== "developer")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // Use service role to bypass RLS
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;

    const { createClient } = await import("@supabase/supabase-js");
    const adminClient = serviceKey
      ? createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
      : supabase;

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") ?? "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") ?? "50", 10);
    const q = searchParams.get("q") ?? "";

    let query = adminClient
      .from("audit_logs")
      .select(
        "id, action, actor_type, actor_id, entity_type, entity_id, result, metadata, created_at",
        { count: "exact" }
      )
      .order("created_at", { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (q) {
      query = query.or(
        `action.ilike.%${q}%,actor_id.ilike.%${q}%,entity_id.ilike.%${q}%,result.ilike.%${q}%`
      );
    }

    const { data, error, count } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ logs: data ?? [], total: count ?? 0, page, pageSize });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
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
    if (role !== "admin" && role !== "developer")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = (await request.json()) as { id?: string };
    if (!body.id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const { createClient } = await import("@supabase/supabase-js");
    const adminClient = serviceKey
      ? createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
      : supabase;

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
    if (role !== "admin" && role !== "developer")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = (await request.json()) as {
      id?: string;
      action?: string;
      result?: string;
      actor_type?: string;
      entity_type?: string;
      metadata?: Record<string, unknown>;
    };
    if (!body.id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const { createClient } = await import("@supabase/supabase-js");
    const adminClient = serviceKey
      ? createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
      : supabase;

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

