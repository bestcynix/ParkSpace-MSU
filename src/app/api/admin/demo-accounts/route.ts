import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const CONFIG_PATH = join(process.cwd(), ".demo-accounts-config.json");

type DemoConfig = { staffEnabled: boolean; adminEnabled: boolean };

async function readConfig(): Promise<DemoConfig> {
  try {
    const raw = await readFile(CONFIG_PATH, "utf-8");
    return JSON.parse(raw) as DemoConfig;
  } catch {
    return { staffEnabled: true, adminEnabled: true };
  }
}

async function writeConfig(config: DemoConfig) {
  await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
}

export async function GET() {
  const config = await readConfig();
  return NextResponse.json(config);
}

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: "Not configured" }, { status: 503 });
    }

    // Authenticate caller
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.replace(/^Bearer\s+/i, "");

    const client = createServerClient(supabaseUrl, supabaseKey, {
      cookies: { getAll: () => request.cookies.getAll(), setAll() {} },
    });

    let userId: string | null = null;
    let userEmail: string | null = null;
    if (token) {
      const { data } = await client.auth.getUser(token);
      userId = data.user?.id ?? null;
      userEmail = data.user?.email?.toLowerCase() ?? null;
    } else {
      const { data } = await client.auth.getUser();
      userId = data.user?.id ?? null;
      userEmail = data.user?.email?.toLowerCase() ?? null;
    }

    if (!userId) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    // Demo admin cannot modify access controls
    if (userEmail === "admin@msu.ac.th") {
      return NextResponse.json(
        { error: "บัญชีผู้ดูแลระบบสาธิตไม่สามารถแก้ไขการควบคุมการเข้าถึงได้ (Demo admin cannot modify access controls)" },
        { status: 403 },
      );
    }

    // Verify admin role
    const { data: roleData } = await client.from("user_roles").select("role").eq("user_id", userId);
    const roles = (roleData ?? []).map((r) => String(r.role).toLowerCase().trim());
    const isAdmin = roles.includes("admin") || roles.includes("developer") ||
      userEmail === "68011211206@msu.ac.th" || userEmail === "69010518004@msu.ac.th";

    if (!isAdmin) {
      return NextResponse.json({ error: "Administrator role required" }, { status: 403 });
    }

    const body = (await request.json()) as Partial<DemoConfig>;
    const current = await readConfig();

    const updated: DemoConfig = {
      staffEnabled: typeof body.staffEnabled === "boolean" ? body.staffEnabled : current.staffEnabled,
      adminEnabled: typeof body.adminEnabled === "boolean" ? body.adminEnabled : current.adminEnabled,
    };

    await writeConfig(updated);

    return NextResponse.json({ success: true, config: updated });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update demo config" },
      { status: 500 },
    );
  }
}
