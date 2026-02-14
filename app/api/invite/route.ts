import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabaseAdminClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing Supabase env. Set SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  return createClient(url, key);
}

export async function POST(req: Request) {
  try {
    const supabase = getSupabaseAdminClient();
    const { invitationCode } = await req.json();
    const code = String(invitationCode || "").trim();

    if (!code) {
      return NextResponse.json({ error: "Invitation code required" }, { status: 400 });
    }

    // ✅ admins table မှာ invitation_code စစ်
    const { data, error } = await supabase
      .from("admins")
      .select("id, role") // ✅ user_id မဟုတ်ဘဲ id
      .eq("invitation_code", code)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Invalid invitation code" }, { status: 400 });
    }

    const role = String(data.role || "").trim();
    if (role !== "sub-admin" && role !== "subadmin") {
      return NextResponse.json({ error: "Invitation code is not for sub-admin" }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      subAdminId: data.id, // ✅ return id
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}
