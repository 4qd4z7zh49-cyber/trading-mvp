"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type ThreadStatus = "OPEN" | "CLOSED";
type SenderRole = "USER" | "ADMIN";
type MessageType = "TEXT" | "IMAGE";

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
  messageType: MessageType;
  imageUrl: string | null;
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
  return d.toLocaleTimeString();
}

async function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read image"));
    reader.readAsDataURL(file);
  });
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
  const [pickedImageDataUrl, setPickedImageDataUrl] = useState("");
  const [pickedImageName, setPickedImageName] = useState("");
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

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
    void loadData(threadId);
  };

  const onPickPhoto = () => {
    fileRef.current?.click();
  };

  const onPhotoChanged = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setSendErr("Only image files are allowed");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setSendErr("Image size must be 2MB or less");
      return;
    }

    try {
      const dataUrl = await fileToDataUrl(file);
      setPickedImageDataUrl(dataUrl);
      setPickedImageName(file.name);
      setSendErr("");
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to read image";
      setSendErr(message);
    }
  };

  const clearPhoto = () => {
    setPickedImageDataUrl("");
    setPickedImageName("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const onSend = async () => {
    const message = draft.trim();
    if (!activeThreadId) {
      setSendErr("Choose a chat first");
      return;
    }
    if (!message && !pickedImageDataUrl) {
      setSendErr("Message or photo is required");
      return;
    }
    if (message.length > 4000) {
      setSendErr("Message is too long (max 4000)");
      return;
    }

    setSendLoading(true);
    setSendErr("");
    try {
      const r = await fetch("/api/admin/support", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadId: activeThreadId,
          message,
          imageDataUrl: pickedImageDataUrl || undefined,
        }),
      });
      const j = await readJson<SupportSendResponse>(r);
      if (!r.ok || !j?.ok || !j.message) {
        throw new Error(j?.error || "Failed to send message");
      }

      setDraft("");
      clearPhoto();
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
      <div className="mb-4 flex items-center gap-2">
        <div className="text-xl font-semibold">Openbookpro Client Support</div>
        <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-rose-500 px-2 py-0.5 text-xs font-semibold text-white">
          {pendingCount}
        </span>
      </div>
      <div className="mb-4 text-xs text-white/50">Auto-sync every 3s</div>

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
                  <div>Status: {activeThread.status}</div>
                </div>
              </div>

              <div
                ref={bodyRef}
                className="max-h-[430px] space-y-3 overflow-auto rounded-xl border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.08),_rgba(17,24,39,0.85)_40%,_rgba(10,10,14,1)_80%)] p-3"
              >
                {messages.map((row) => {
                  const mine = row.senderRole === "ADMIN";
                  return (
                    <div key={row.id} className={["flex", mine ? "justify-end" : "justify-start"].join(" ")}>
                      <div
                        className={[
                          "relative max-w-[90%] rounded-2xl px-3 py-2 text-sm",
                          mine
                            ? "bg-blue-600 text-white shadow-[0_8px_20px_rgba(37,99,235,0.35)]"
                            : "border border-white/10 bg-[#1d1f25] text-white/90",
                        ].join(" ")}
                      >
                        <span
                          className={[
                            "absolute top-3 h-3 w-3 rotate-45",
                            mine
                              ? "-right-1.5 bg-blue-600"
                              : "-left-1.5 border-l border-t border-white/10 bg-[#1d1f25]",
                          ].join(" ")}
                          aria-hidden="true"
                        />

                        {row.messageType === "IMAGE" && row.imageUrl ? (
                          <img
                            src={row.imageUrl}
                            alt="chat image"
                            className="mb-2 max-h-72 w-auto max-w-full rounded-xl border border-white/20 object-contain"
                          />
                        ) : null}

                        {row.message ? (
                          <div className="whitespace-pre-wrap break-words">{row.message}</div>
                        ) : null}

                        <div
                          className={[
                            "mt-1 flex items-center justify-end gap-1 text-[10px]",
                            mine ? "text-blue-100/80" : "text-white/50",
                          ].join(" ")}
                        >
                          <span>{fmtWhen(row.createdAt)}</span>
                          {mine ? <span>• Sent</span> : null}
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

              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => void onPhotoChanged(e.target.files?.[0])}
              />

              {pickedImageDataUrl ? (
                <div className="mt-3 rounded-xl border border-white/10 bg-black/30 p-3">
                  <div className="mb-2 text-xs text-white/60">{pickedImageName || "Selected photo"}</div>
                  <img
                    src={pickedImageDataUrl}
                    alt="preview"
                    className="max-h-40 rounded-lg border border-white/10 object-contain"
                  />
                  <button
                    type="button"
                    onClick={clearPhoto}
                    className="mt-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80"
                  >
                    Remove Photo
                  </button>
                </div>
              ) : null}

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
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={onPickPhoto}
                    className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/90 hover:bg-white/10"
                  >
                    + Photo
                  </button>
                  <button
                    type="button"
                    disabled={sendLoading || (!draft.trim() && !pickedImageDataUrl)}
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

