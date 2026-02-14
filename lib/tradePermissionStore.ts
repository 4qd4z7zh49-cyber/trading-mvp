import type { SupabaseClient } from "@supabase/supabase-js";

export type TradePermission = {
  buyEnabled: boolean;
  sellEnabled: boolean;
  source: "db" | "memory" | "default";
};

type PermissionCore = {
  buyEnabled: boolean;
  sellEnabled: boolean;
};

type PermissionRow = {
  user_id: string;
  buy_enabled: boolean | null;
  sell_enabled: boolean | null;
};

type PermissionCache = Map<string, PermissionCore>;

declare global {
  var __openbookTradePermissionCache: PermissionCache | undefined;
}

function getCache(): PermissionCache {
  if (!globalThis.__openbookTradePermissionCache) {
    globalThis.__openbookTradePermissionCache = new Map<string, PermissionCore>();
  }
  return globalThis.__openbookTradePermissionCache;
}

function isMissingTableError(err: unknown) {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; message?: string };
  const message = String(e.message || "").toLowerCase();
  return e.code === "42P01" || message.includes("trade_permissions");
}

function normalizeRow(row?: PermissionCore | null): PermissionCore {
  return {
    buyEnabled: row?.buyEnabled ?? true,
    sellEnabled: row?.sellEnabled ?? true,
  };
}

export async function getPermissionForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<TradePermission> {
  const { data, error } = await supabase
    .from("trade_permissions")
    .select("buy_enabled, sell_enabled")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    if (!isMissingTableError(error)) throw error;
    const fallback = getCache().get(userId);
    if (!fallback) return { ...normalizeRow(null), source: "default" };
    return { ...normalizeRow(fallback), source: "memory" };
  }

  if (!data) return { ...normalizeRow(null), source: "default" };
  return {
    buyEnabled: Boolean(data.buy_enabled ?? true),
    sellEnabled: Boolean(data.sell_enabled ?? true),
    source: "db",
  };
}

export async function getPermissionsForUsers(
  supabase: SupabaseClient,
  userIds: string[]
) {
  const result: Record<string, TradePermission> = {};

  if (userIds.length === 0) return result;

  const { data, error } = await supabase
    .from("trade_permissions")
    .select("user_id, buy_enabled, sell_enabled")
    .in("user_id", userIds);

  if (error) {
    if (!isMissingTableError(error)) throw error;

    const cache = getCache();
    userIds.forEach((uid) => {
      const fallback = cache.get(uid);
      if (fallback) {
        result[uid] = { ...normalizeRow(fallback), source: "memory" };
      } else {
        result[uid] = { ...normalizeRow(null), source: "default" };
      }
    });
    return result;
  }

  const rowMap = new Map<string, PermissionCore>();
  (data as PermissionRow[] | null)?.forEach((row) => {
    rowMap.set(String(row.user_id), {
      buyEnabled: Boolean(row.buy_enabled ?? true),
      sellEnabled: Boolean(row.sell_enabled ?? true),
    });
  });

  userIds.forEach((uid) => {
    const row = rowMap.get(uid);
    if (!row) {
      result[uid] = { ...normalizeRow(null), source: "default" };
    } else {
      result[uid] = { ...normalizeRow(row), source: "db" };
    }
  });

  return result;
}

export async function setPermissionForUser(
  supabase: SupabaseClient,
  userId: string,
  next: PermissionCore
): Promise<TradePermission> {
  const { error } = await supabase
    .from("trade_permissions")
    .upsert(
      {
        user_id: userId,
        buy_enabled: next.buyEnabled,
        sell_enabled: next.sellEnabled,
      },
      { onConflict: "user_id" }
    );

  if (error) {
    if (!isMissingTableError(error)) throw error;
    getCache().set(userId, normalizeRow(next));
    return { ...normalizeRow(next), source: "memory" };
  }

  return { ...normalizeRow(next), source: "db" };
}
