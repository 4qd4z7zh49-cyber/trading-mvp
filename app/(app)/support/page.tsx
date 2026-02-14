"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getUserAuthHeaders } from "@/lib/clientAuth";

type ThreadStatus = "OPEN" | "CLOSED";
type SenderRole = "USER" | "ADMIN";

type SupportMessage = {
  id: string;
  threadId: string;
  senderRole: SenderRole;
  senderUserId: string | null;
  senderAdminId: string | null;
  message: string;
  createdAt: string;
};

type SupportResponse = {
  ok?: boolean;
  error?: string;
  pollMs?: number;
  thread?: {
    id: string;
    userId: string;
    adminId: string | null;
    adminName: string | null;
    status: ThreadStatus;
    lastSender: SenderRole;
    lastMessageAt: string;
    createdAt: string;
  };
  messages?: SupportMessage[];
};

type SendResponse = {
  ok?: boolean;
  error?: string;
  message?: SupportMessage;
  thread?: {
    id: string;
    adminId: string | null;
    status: ThreadStatus;
    lastSender: SenderRole;
    lastMessageAt: string;
  };
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

export default function SupportPage() {
  const router = useRouter();
  const redirectedRef = useRef(false);
  const bodyRef = useRef<HTMLDivElement | null>(null);

  const [thread, setThread] = useState<SupportResponse["thread"] | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [pollMs, setPollMs] = useState(3000);

  const authHeaders = useCallback(async () => {
    return getUserAuthHeaders();
  }, []);

  const loadChat = useCallback(async () => {
    try {
      const headers = await authHeaders();
      const res = await fetch("/api/support", {
        cache: "no-store",
        headers,
      });
      const json = await readJson<SupportResponse>(res);

      if (res.status === 401 || json?.error === "Unauthorized") {
        if (!redirectedRef.current) {
          redirectedRef.current = true;
          router.replace("/login?next=/support");
        }
        throw new Error("Unauthorized");
      }

      if (!res.ok || !json?.ok || !json.thread) {
        throw new Error(json?.error || "Failed to load support chat");
      }

      setThread(json.thread);
      setMessages(Array.isArray(json.messages) ? json.messages : []);
      setPollMs(Number(json.pollMs ?? 3000));
      setErr("");
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to load support chat";
      if (message !== "Unauthorized") setErr(message);
    } finally {
      setLoading(false);
    }
  }, [authHeaders, router]);

  useEffect(() => {
    void loadChat();
  }, [loadChat]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void loadChat();
    }, Math.max(2000, pollMs));
    return () => window.clearInterval(timer);
  }, [loadChat, pollMs]);

  useEffect(() => {
    const node = bodyRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [messages]);

  const onSend = async () => {
    const message = draft.trim();
    if (!message) {
      setErr("Message is required");
      return;
    }
    if (message.length > 4000) {
      setErr("Message is too long (max 4000)");
      return;
    }

    setSending(true);
    setErr("");
    setInfo("");

    try {
      const headers = await authHeaders();
      headers["Content-Type"] = "application/json";

      const res = await fetch("/api/support", {
        method: "POST",
        headers,
        body: JSON.stringify({ message }),
      });
      const json = await readJson<SendResponse>(res);
      if (!res.ok || !json?.ok || !json.message) {
        throw new Error(json?.error || "Failed to send message");
      }

      setMessages((prev) => [...prev, json.message as SupportMessage]);
      setDraft("");
      setInfo("Sent");

      if (thread && json.thread) {
        setThread({
          ...thread,
          id: json.thread.id,
          adminId: json.thread.adminId,
          status: json.thread.status,
          lastSender: json.thread.lastSender,
          lastMessageAt: json.thread.lastMessageAt,
        });
      }
    } catch (e: unknown) {
      const messageText = e instanceof Error ? e.message : "Failed to send message";
      setErr(messageText);
    } finally {
      setSending(false);
      void loadChat();
    }
  };

  const statusBadge = useMemo(() => {
    if (!thread) return null;
    const open = thread.status === "OPEN";
    return (
      <span
        className={[
          "rounded-full border px-3 py-1 text-xs font-semibold",
          open
            ? "border-emerald-300/30 bg-emerald-500/10 text-emerald-200"
            : "border-white/15 bg-white/[0.04] text-white/70",
        ].join(" ")}
      >
        {thread.status}
      </span>
    );
  }, [thread]);

  return (
    <div className="px-4 pt-5 pb-24">
      <div className="mx-auto w-full max-w-[860px] space-y-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-2xl font-bold text-white">Support Live Chat</div>
              <div className="mt-1 text-sm text-white/60">
                Chat directly with admin/sub-admin in real-time.
              </div>
            </div>
            <button
              type="button"
              onClick={() => void loadChat()}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
            >
              Refresh
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-white/70">
            <span>Assigned support: {thread?.adminName || "Waiting for assignment"}</span>
            {statusBadge}
          </div>
        </div>

        {err ? (
          <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
            {err}
          </div>
        ) : null}
        {info ? (
          <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
            {info}
          </div>
        ) : null}

        <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div
            ref={bodyRef}
            className="max-h-[520px] space-y-2 overflow-auto rounded-xl border border-white/10 bg-[#0c0c0f] p-3"
          >
            {loading ? <div className="text-sm text-white/60">Loading messages...</div> : null}

            {!loading && messages.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white/60">
                No messages yet. Start your first message now.
              </div>
            ) : null}

            {messages.map((row) => {
              const mine = row.senderRole === "USER";
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
          </div>

          <div className="mt-3">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              placeholder="Type your message..."
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (!sending) void onSend();
                }
              }}
              className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none"
            />
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={() => void onSend()}
                disabled={sending || !draft.trim()}
                className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {sending ? "Sending..." : "Send Message"}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

