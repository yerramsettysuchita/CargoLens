"use client";

import { useRef, useEffect } from "react";
import Link from "next/link";
import {
  Send,
  Bot,
  User,
  Package,
  ArrowRight,
  Loader2,
  MessageSquare,
  ArrowLeft,
} from "lucide-react";
import { Navbar } from "@/app/components/Navbar";
import { useCopilot } from "@/app/lib/hooks/useCopilot";
import type { CopilotMessage } from "@/app/lib/hooks/useCopilot";

const SUGGESTIONS = [
  "What shipments are at risk?",
  "Show delayed shipments",
  "Which shipments need customs review?",
  "What corridors are congested?",
  "Any sanctions flags?",
  "How many shipments are in transit?",
];

const PAGE_CONTEXT = { page: "chat page" };

export default function ChatPage() {
  const { messages, input, setInput, loading, send } = useCopilot();
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(undefined, PAGE_CONTEXT);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-6 flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <Link href="/dashboard" className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" /> Dashboard
          </Link>
          <span className="text-gray-300">/</span>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-gray-900 leading-none">Logistics Assistant</h1>
              <p className="text-[11px] text-gray-400 mt-0.5">Powered by CargoLens intelligence</p>
            </div>
          </div>
        </div>

        {/* Chat window */}
        <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4 min-h-0" style={{ maxHeight: "calc(100vh - 280px)" }}>
            {messages.map((msg: CopilotMessage, i: number) => (
              <div key={i} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                {/* Avatar */}
                <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                  msg.role === "assistant" ? "bg-violet-100" : "bg-blue-700"
                }`}>
                  {msg.role === "assistant"
                    ? <Bot className="w-4 h-4 text-violet-600" />
                    : <User className="w-4 h-4 text-white" />}
                </div>

                <div className={`flex flex-col gap-2 max-w-xl ${msg.role === "user" ? "items-end" : ""}`}>
                  {/* Bubble */}
                  <div className={`px-4 py-3 rounded-xl text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-blue-700 text-white rounded-tr-sm"
                      : "bg-gray-50 border border-gray-200 text-gray-800 rounded-tl-sm"
                  }`}>
                    {msg.content}
                  </div>

                  {/* Shipment refs */}
                  {msg.shipments && msg.shipments.length > 0 && (
                    <div className="flex flex-col gap-1.5 w-full">
                      {msg.shipments.map((s) => (
                        <Link
                          key={s.id}
                          href={`/shipments/${s.id}`}
                          className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50 transition-all group"
                        >
                          <div className="w-6 h-6 rounded bg-blue-50 flex items-center justify-center shrink-0">
                            <Package className="w-3.5 h-3.5 text-blue-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold text-gray-800 font-mono">{s.shipment_code}</div>
                            <div className="text-[11px] text-gray-400 truncate">{s.corridor} · {s.status}</div>
                          </div>
                          <ArrowRight className="w-3.5 h-3.5 text-gray-300 shrink-0 group-hover:text-blue-500" />
                        </Link>
                      ))}
                    </div>
                  )}

                  {/* Estimate redirect hint */}
                  {msg.meta?.redirectTo === "/compare" && (
                    <Link
                      href="/compare"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <Package className="w-3.5 h-3.5" /> Open Rate Compare
                    </Link>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex gap-3">
                <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="w-4 h-4 text-violet-600" />
                </div>
                <div className="px-4 py-3 rounded-xl rounded-tl-sm bg-gray-50 border border-gray-200 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
                  <span className="text-sm text-gray-400">Thinking…</span>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Suggestions — only show when just the welcome message */}
          {messages.length === 1 && (
            <div className="px-5 pb-3 flex flex-wrap gap-2 border-t border-gray-100 pt-3">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s, PAGE_CONTEXT)}
                  className="text-xs text-gray-600 bg-gray-50 border border-gray-200 hover:border-blue-300 hover:text-blue-700 hover:bg-blue-50 px-2.5 py-1.5 rounded-full transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="px-4 pb-4 pt-3 border-t border-gray-100">
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-100 transition-all">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Ask about your shipments…"
                className="flex-1 bg-transparent text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none"
                disabled={loading}
              />
              <button
                onClick={() => send(undefined, PAGE_CONTEXT)}
                disabled={!input.trim() || loading}
                className="w-7 h-7 rounded-lg bg-blue-700 hover:bg-blue-800 disabled:bg-gray-200 flex items-center justify-center transition-colors shrink-0"
              >
                <Send className="w-3.5 h-3.5 text-white disabled:text-gray-400" />
              </button>
            </div>
            <p className="text-[10px] text-gray-400 mt-1.5 text-center">
              Answers are based on your live shipment data and CargoLens intelligence engines.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
