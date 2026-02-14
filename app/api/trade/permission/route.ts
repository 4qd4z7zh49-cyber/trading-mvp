import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getPermissionForUser } from "@/lib/tradePermissionStore";
import { getUserAccessForUser } from "@/lib/userAccessStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function createUserClient(cookieHeader: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: cookieHeader ? { Cookie: cookieHeader } : {},
      },
    }
  );
}

function getBearerToken(req: Request) {
  const authHeader = req.headers.get("authorization") || "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) return "";
  return authHeader.slice(7).trim();
}

async function resolveUserId(req: Request, svc: SupabaseClient) {
  const bearer = getBearerToken(req);
  if (bearer) {
    const { data, error } = await svc.auth.getUser(bearer);
    if (!error && data?.user?.id) return data.user.id;
  }

  const cookieHeader = req.headers.get("cookie") || "";
  const userClient = createUserClient(cookieHeader);
  const { data, error } = await userClient.auth.getUser();
  if (!error && data?.user?.id) return data.user.id;

  return "";
}

export async function GET(req: Request) {
  try {
    const svc = createServiceClient();
    const userId = await resolveUserId(req, svc);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const access = await getUserAccessForUser(svc, userId);
    if (access.tradeRestricted) {
      return NextResponse.json(
        {
          error: "Your account is restricted",
          restricted: true,
          buyEnabled: false,
          sellEnabled: false,
        },
        { status: 403 }
      );
    }

    const permission = await getPermissionForUser(svc, userId);

    return NextResponse.json({
      ok: true,
      buyEnabled: permission.buyEnabled,
      sellEnabled: permission.sellEnabled,
      source: permission.source,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
