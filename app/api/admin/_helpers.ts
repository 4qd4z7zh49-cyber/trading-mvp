import { createClient } from "@supabase/supabase-js";

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export function readCookie(req: Request, name: string) {
  const cookie = req.headers.get("cookie") || "";
  const m = cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

export function requireAdminSession(req: Request) {
  const session = readCookie(req, "admin_session");
  const role = readCookie(req, "admin_role");
  const adminId = readCookie(req, "admin_id");

  if (!session || !role || !adminId) return null;

  return { role, adminId };
}

// ✅ subadmin က target user ကို လုပ်ခွင့်ရှိလားစစ်
export async function assertCanManageUser(adminId: string, role: string, userId: string) {
  if (role === "admin" || role === "superadmin") return true;

  // subadmin => profiles.managed_by = adminId ဖြစ်ရမယ်
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, managed_by")
    .eq("id", userId)
    .single();

  if (error || !data) return false;
  return data.managed_by === adminId;
}