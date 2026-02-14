import { NextResponse } from "next/server";
import { createServiceClient, resolveUserId } from "../../deposit/_helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  notificationId?: string;
};

function parseBody(value: unknown): Body {
  if (!value || typeof value !== "object") return {};
  return value as Body;
}

export async function POST(req: Request) {
  try {
    const svc = createServiceClient();
    const userId = await resolveUserId(req, svc);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = parseBody(await req.json().catch(() => null));
    const notificationId = String(body.notificationId || "").trim();
    if (!notificationId) {
      return NextResponse.json({ error: "notificationId is required" }, { status: 400 });
    }

    const { data, error } = await svc
      .from("user_notifications")
      .update({
        status: "CONFIRMED",
        updated_at: new Date().toISOString(),
      })
      .eq("id", notificationId)
      .eq("user_id", userId)
      .eq("status", "PENDING")
      .select("id,status")
      .maybeSingle();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      updated: Boolean(data?.id),
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to update notification";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
