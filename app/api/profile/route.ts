import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ProfileRow = {
  id: string;
  username: string | null;
  email: string | null;
  phone: string | null;
  country: string | null;
  role: string | null;
  created_at: string | null;
  invitation_code: string | null;
};

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
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile, error } = await svc
      .from("profiles")
      .select("id,username,email,phone,country,role,created_at,invitation_code")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { data: authUser, error: authErr } = await svc.auth.admin.getUserById(userId);
    if (authErr) {
      return NextResponse.json({ error: authErr.message }, { status: 500 });
    }

    const row = (profile || null) as ProfileRow | null;

    return NextResponse.json({
      ok: true,
      profile: {
        id: userId,
        username: row?.username ?? null,
        email: row?.email ?? authUser?.user?.email ?? null,
        phone: row?.phone ?? null,
        country: row?.country ?? null,
        role: row?.role ?? "user",
        created_at: row?.created_at ?? authUser?.user?.created_at ?? null,
        invitation_code: row?.invitation_code ?? null,
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to load profile";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
