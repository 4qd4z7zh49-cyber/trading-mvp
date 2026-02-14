"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type ThreadStatus = "OPEN" | "CLOSED";
type SenderRole = "USER" | "ADMIN";

type SupportThread = {
  id: string;
  userId: string;
  adminId: string | null;
  username: string | null;
  email: string | null;
  adminUsername: string | null;
  status: ThreadStatus;
  lastSender: SenderRole;
  lastMessageAt: string;
  createdAt: string;
  needsReply: boolean;
};

type SupportMessage = {
  id: string;
  threadId: string;
  senderRole: SenderRole;
  senderUserId: string | null;
  senderAdminId: string | null;
  message: string;
  createdAt: string;
};

type SupportListResponse = {
  ok?: boolean;
  error?: string;
  pendingCount?: number;
  activeThreadId?: string | null;
  threads?: SupportThread[];
  messages?: SupportMessage[];
};

type SupportSendResponse = {
  ok?: boolean;
  error?: string;
  pendingCount?: number;
  message?: SupportMessage;
};

async function readJson<T>(res: Response): Promise<T> {
  try {
    return (await res.json()) as T;
  } catch {
    return {} as T;
  }
}

function fmtWhen(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString();
}

export default function SupportChatPanel() {
  const [threads, setThreads] = useState<SupportThread[]>([]);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [activeThreadId, setActiveThreadId] = useState("");
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [listErr, setListErr] = useState("");
  const [draft, setDraft] = useState("");
  const [sendLoading, setSendLoading] = useState(false);
  const [sendErr, setSendErr] = useState("");
  const [sendInfo, setSendInfo] = useState("");
  const bodyRef = useRef<HTMLDivElement | null>(null);

  const activeThread = useMemo(
    () => threads.find((row) => row.id === activeThreadId) || null,
    [threads, activeThreadId]
  );

  const loadData = useCallback(async (threadId?: string) => {
    setLoading(true);
    setListErr("");
    try {
      const params = new URLSearchParams();
      params.set("limit", "250");
      const target = threadId || activeThreadId;
      if (target) params.set("threadId", target);

      const r = await fetch(`/api/admin/support?${params.toString()}`, {
        cache: "no-store",
        credentials: "include",
      });
      const j = await readJson<SupportListResponse>(r);
      if (!r.ok || !j?.ok) {
        throw new Error(j?.error || "Failed to load support chats");
      }

      const nextThreads = Array.isArray(j.threads) ? j.threads : [];
      const nextMessages = Array.isArray(j.messages) ? j.messages : [];
      const nextActive = String(j.activeThreadId || "");

      setThreads(nextThreads);
      setMessages(nextMessages);
      setPendingCount(Number(j.pendingCount ?? 0));
      setActiveThreadId((prev) => {
        if (nextActive) return nextActive;
        if (prev && nextThreads.some((row) => row.id === prev)) return prev;
        return nextThreads[0]?.id || "";
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to load support chats";
      setListErr(message);
    } finally {
      setLoading(false);
    }
  }, [activeThreadId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void loadData();
    }, 3000);
    return () => window.clearInterval(timer);
  }, [loadData]);

  useEffect(() => {
    const node = bodyRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [messages, activeThreadId]);

  const selectThread = (threadId: string) => {
    setActiveThreadId(threadId);
    setSendErr("");
    setSendInfo("");
    void loadData(threadId);
  };

  const onSend = async () => {
    const message = draft.trim();
    if (!activeThreadId) {
      setSendErr("Choose a chat first");
      return;
    }
    if (!message) {
      setSendErr("Message is required");
      return;
    }
    if (message.length > 4000) {
      setSendErr("Message is too long (max 4000)");
      return;
    }

    setSendLoading(true);
    setSendErr("");
    setSendInfo("");
    try {
      const r = await fetch("/api/admin/support", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadId: activeThreadId,
          message,
        }),
      });
      const j = await readJson<SupportSendResponse>(r);
      if (!r.ok || !j?.ok || !j.message) {
        throw new Error(j?.error || "Failed to send message");
      }

      setDraft("");
      setSendInfo("Sent");
      setPendingCount(Number(j.pendingCount ?? pendingCount));
      setMessages((prev) => [...prev, j.message as SupportMessage]);
      setThreads((prev) =>
        prev.map((row) =>
          row.id === activeThreadId
            ? {
                ...row,
                lastSender: "ADMIN",
                lastMessageAt: (j.message as SupportMessage).createdAt,
                needsReply: false,
              }
            : row
        )
      );
    } catch (e: unknown) {
      const messageText = e instanceof Error ? e.message : "Failed to send message";
      setSendErr(messageText);
    } finally {
      setSendLoading(false);
      void loadData(activeThreadId);
    }
  };

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="text-xl font-semibold">Support Live Chat</div>
          <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-rose-500 px-2 py-0.5 text-xs font-semibold text-white">
            {pendingCount}
          </span>
        </div>
        <button
          type="button"
          onClick={() => void loadData(activeThreadId)}
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {listErr ? <div className="mb-3 text-sm text-red-300">{listErr}</div> : null}

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
          <div className="mb-2 text-sm font-semibold text-white">User Conversations</div>

          <div className="max-h-[560px] space-y-2 overflow-auto pr-1">
            {threads.map((thread) => {
              const active = thread.id === activeThreadId;
              return (
                <button
                  key={thread.id}
                  type="button"
                  onClick={() => selectThread(thread.id)}
                  className={[
                    "w-full rounded-xl border px-3 py-2 text-left",
                    active
                      ? "border-blue-400/50 bg-blue-500/15 text-white"
                      : "border-white/10 bg-black/20 text-white/85 hover:bg-black/30",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold">{thread.username || "User"}</div>
                      <div className="mt-0.5 text-xs text-white/60">{thread.email || "-"}</div>
                    </div>
                    {thread.needsReply ? (
                      <span className="rounded-full border border-amber-300/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-200">
                        Pending
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 text-[11px] text-white/50">{fmtWhen(thread.lastMessageAt)}</div>
                </button>
              );
            })}

            {!loading && threads.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/60">
                No support messages yet.
              </div>
            ) : null}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          {activeThread ? (
            <>
              <div className="mb-3 flex flex-wrap items-start justify-between gap-3 border-b border-white/10 pb-3">
                <div>
                  <div className="text-base font-semibold text-white">
                    {activeThread.username || "User"}
                  </div>
                  <div className="text-sm text-white/60">{activeThread.email || "-"}</div>
                </div>
                <div className="text-right text-xs text-white/60">
                  <div>Assigned: {activeThread.adminUsername || "-"}</div>
                  <div className="mt-1">Status: {activeThread.status}</div>
                </div>
              </div>

              <div
                ref={bodyRef}
                className="max-h-[420px] space-y-2 overflow-auto rounded-xl border border-white/10 bg-[#0d0d0f] p-3"
              >
                {messages.map((row) => {
                  const mine = row.senderRole === "ADMIN";
                  return (
                    <div
                      key={row.id}
                      className={["flex", mine ? "justify-end" : "justify-start"].join(" ")}
                    >
                      <div
                        className={[
                          "max-w-[90%] rounded-2xl px-3 py-2 text-sm",
                          mine
                            ? "bg-blue-600 text-white"
                            : "border border-white/10 bg-white/[0.04] text-white/90",
                        ].join(" ")}
                      >
                        <div className="whitespace-pre-wrap break-words">{row.message}</div>
                        <div className={["mt-1 text-[10px]", mine ? "text-blue-100/80" : "text-white/50"].join(" ")}>
                          {fmtWhen(row.createdAt)}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {!loading && messages.length === 0 ? (
                  <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white/60">
                    No messages yet.
                  </div>
                ) : null}
              </div>

              <div className="mt-3">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={3}
                  placeholder="Type your reply..."
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (!sendLoading) void onSend();
                    }
                  }}
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none"
                />
                {sendErr ? <div className="mt-2 text-sm text-red-300">{sendErr}</div> : null}
                {sendInfo ? <div className="mt-2 text-sm text-emerald-300">{sendInfo}</div> : null}
                <div className="mt-2 flex justify-end">
                  <button
                    type="button"
                    disabled={sendLoading || !draft.trim()}
                    onClick={() => void onSend()}
                    className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {sendLoading ? "Sending..." : "Send Reply"}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-4 text-sm text-white/60">
              Select a user conversation to start chatting.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

