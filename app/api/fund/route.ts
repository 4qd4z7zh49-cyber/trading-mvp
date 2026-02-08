import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const { user_id } = await req.json();

    if (!user_id) {
      return NextResponse.json({ error: "Missing user_id" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: "Server env missing" }, { status: 500 });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // balances table: user_id (uuid), balance (numeric), updated_at
    const { data: existing, error: e1 } = await admin
      .from("balances")
      .select("user_id,balance")
      .eq("user_id", user_id)
      .maybeSingle();

    if (e1) return NextResponse.json({ error: e1.message }, { status: 500 });

    // default demo credit
    const CREDIT = 10000;

    if (!existing) {
      const { error: e2 } = await admin.from("balances").insert([
        { user_id, balance: CREDIT },
      ]);
      if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });
      return NextResponse.json({ ok: true, balance: CREDIT });
    }

    // If exists but 0 or null, set to 10000 (avoid double top-up)
    const current = Number(existing.balance ?? 0);
    if (current <= 0) {
      const { error: e3 } = await admin
        .from("balances")
        .update({ balance: CREDIT })
        .eq("user_id", user_id);

      if (e3) return NextResponse.json({ error: e3.message }, { status: 500 });
      return NextResponse.json({ ok: true, balance: CREDIT });
    }

    return NextResponse.json({ ok: true, balance: current });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Unknown error" }, { status: 500 });
  }
}