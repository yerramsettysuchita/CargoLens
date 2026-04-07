"use client";

// ─── Contextual Copilot Drawer ─────────────────────────────────────────────
// Floating right-side chat drawer, accessible from every page via Navbar.
// Passes current page + shipment context to /api/chat for richer responses.

import { useRef, useEffect } from "react";
import Link from "next/link";
import {
  X,
  Send,
  Bot,
  User,
  Package,
  ArrowRight,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { useCopilot } from "@/app/lib/hooks/useCopilot";
import type { CopilotContext, CopilotMessage } from "@/app/lib/hooks/useCopilot";

interface Props {
  open: boolean;
  onClose: () => void;
  context?: CopilotContext;
}

const SUGGESTIONS = [
  "What shipments are at risk?",
  "Show delayed shipments",
  "Any customs holds?",
  "Sanctions flags?",
  "In-transit count",
];

export function CopilotDrawer({ open, onClose, context }: Props) {
  const { messages, input, setInput, loading, send, reset } = useCopilot();
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when drawer opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 120);
    }
  }, [open]);

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(undefined, context);
    }
  }

  if (!open) return null;

  return (
    <>
      {/* Backdrop (semi-transparent, closes drawer) */}
      <div
        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px]"
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div className="fixed right-0 top-0 h-full w-[380px] max-w-[95vw] z-50 flex flex-col bg-white border-l border-gray-200 shadow-2xl">

        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-100 shrink-0">
          <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center shrink-0">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 leading-none">Logistics Assistant</p>
            {context?.page && (
              <p className="text-[10px] text-gray-400 mt-0.5 truncate">
                Context: {context.shipmentCode ? `Shipment ${context.shipmentCode}` : context.page}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={reset}
              title="Clear conversation"
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3 min-h-0">
          {messages.map((msg: CopilotMessage, i: number) => (
            <div key={i} className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
              {/* Avatar */}
              <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                msg.role === "assistant" ? "bg-violet-100" : "bg-blue-700"
              }`}>
                {msg.role === "assistant"
                  ? <Bot className="w-3.5 h-3.5 text-violet-600" />
                  : <User className="w-3.5 h-3.5 text-white" />}
              </div>

              <div className={`flex flex-col gap-1.5 max-w-[270px] ${msg.role === "user" ? "items-end" : ""}`}>
                {/* Bubble */}
                <div className={`px-3 py-2.5 rounded-xl text-xs leading-relaxed whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "bg-blue-700 text-white rounded-tr-sm"
                    : "bg-gray-50 border border-gray-200 text-gray-800 rounded-tl-sm"
                }`}>
                  {msg.content}
                </div>

                {/* Shipment refs */}
                {msg.shipments && msg.shipments.length > 0 && (
                  <div className="flex flex-col gap-1 w-full">
                    {msg.shipments.slice(0, 4).map((s) => (
                      <Link
                        key={s.id}
                        href={`/shipments/${s.id}`}
                        onClick={onClose}
                        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50 transition-all group"
                      >
                        <Package className="w-3 h-3 text-blue-600 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-[11px] font-semibold text-gray-800 font-mono">{s.shipment_code}</div>
                          <div className="text-[10px] text-gray-400 truncate">{s.corridor} · {s.status}</div>
                        </div>
                        <ArrowRight className="w-3 h-3 text-gray-300 shrink-0 group-hover:text-blue-500" />
                      </Link>
                    ))}
                    {msg.shipments.length > 4 && (
                      <p className="text-[10px] text-gray-400 px-1">+{msg.shipments.length - 4} more</p>
                    )}
                  </div>
                )}

                {/* Redirect hint */}
                {msg.meta?.redirectTo === "/compare" && (
                  <Link
                    href="/compare"
                    onClick={onClose}
                    className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-white bg-blue-700 hover:bg-blue-800 px-2.5 py-1 rounded-lg transition-colors"
                  >
                    <Package className="w-3 h-3" /> Rate Compare
                  </Link>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-2.5">
              <div className="w-6 h-6 rounded-full bg-violet-100 flex items-center justify-center shrink-0 mt-0.5">
                <Bot className="w-3.5 h-3.5 text-violet-600" />
              </div>
              <div className="px-3 py-2.5 rounded-xl rounded-tl-sm bg-gray-50 border border-gray-200 flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 text-gray-400 animate-spin" />
                <span className="text-xs text-gray-400">Thinking…</span>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Suggestions — shown only on welcome state */}
        {messages.length === 1 && (
          <div className="px-4 pb-2 flex flex-wrap gap-1.5 border-t border-gray-100 pt-2.5 shrink-0">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => send(s, context)}
                className="text-[11px] text-gray-600 bg-gray-50 border border-gray-200 hover:border-violet-300 hover:text-violet-700 hover:bg-violet-50 px-2.5 py-1 rounded-full transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="px-4 pb-4 pt-2.5 border-t border-gray-100 shrink-0">
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 focus-within:border-violet-400 focus-within:ring-1 focus-within:ring-violet-100 transition-all">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ask about your shipments…"
              className="flex-1 bg-transparent text-xs text-gray-800 placeholder:text-gray-400 focus:outline-none"
              disabled={loading}
            />
            <button
              onClick={() => send(undefined, context)}
              disabled={!input.trim() || loading}
              className="w-6 h-6 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:bg-gray-200 flex items-center justify-center transition-colors shrink-0"
            >
              <Send className="w-3 h-3 text-white" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
