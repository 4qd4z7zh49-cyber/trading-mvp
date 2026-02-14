import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // server-side only
);

export async function POST(req: Request) {
  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json({ error: "Username/Password လိုအပ်ပါတယ်" }, { status: 400 });
    }

    const { data, error } = await supabase.rpc("admin_verify_login", {
      p_username: String(username).trim(),
      p_password: String(password),
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const row = Array.isArray(data) ? data[0] : null;
    if (!row?.id) {
      return NextResponse.json({ error: "Username/Password မမှန်ပါ" }, { status: 401 });
    }

    const dashboardPath =
      row.role === "sub-admin" || row.role === "subadmin"
        ? "/subadmin"
        : "/admin";

    const res = NextResponse.json({
      ok: true,
      role: row.role,
      username: row.username,
      id: row.id,
      redirect: dashboardPath,
    });

    const cookieOpts = {
      httpOnly: true,
      sameSite: "lax" as const,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 12,
    };

    res.cookies.set("admin_session", "active", cookieOpts);
    res.cookies.set("admin_role", String(row.role || ""), cookieOpts);
    res.cookies.set("admin_id", String(row.id), cookieOpts); // ✅ IMPORTANT

    return res;
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}