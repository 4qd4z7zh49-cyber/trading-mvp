import { NextResponse } from "next/server";
import { requireAdminSession, supabaseAdmin, assertCanManageUser } from "../_helpers";

export async function POST(req: Request) {
  const auth = requireAdminSession(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { adminId, role } = auth;

  try {
    const { userId, result } = await req.json();
    const uid = String(userId || "");
    const r = String(result || "").toUpperCase(); // WIN | LOSE

    if (!uid || (r !== "WIN" && r !== "LOSE")) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const ok = await assertCanManageUser(adminId, role, uid);
    if (!ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // user orders all update
    const { error } = await supabaseAdmin
      .from("orders")
      .update({ result: r })
      .eq("user_id", uid);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}