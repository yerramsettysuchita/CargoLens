"use client";

import { useState, useCallback } from "react";
import type { ChatResponse, ChatShipmentRef } from "@/app/lib/chat-handler";

export interface CopilotMessage {
  role: "user" | "assistant";
  content: string;
  shipments?: ChatShipmentRef[];
  meta?: Record<string, unknown>;
}

export interface CopilotContext {
  page?: string;
  shipmentId?: string;
  shipmentCode?: string;
}

const WELCOME: CopilotMessage = {
  role: "assistant",
  content:
    "Hi — I'm your logistics assistant. Ask me about shipment status, delays, customs, sanctions risk, or route estimates.",
};

export function useCopilot() {
  const [messages, setMessages] = useState<CopilotMessage[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const send = useCallback(
    async (text?: string, context?: CopilotContext) => {
      const message = (text ?? input).trim();
      if (!message || loading) return;

      setInput("");
      setMessages((prev) => [...prev, { role: "user", content: message }]);
      setLoading(true);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message, context }),
        });

        const data: ChatResponse = await res.json();
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data.answer ?? "I couldn't process that request.",
            shipments: data.shipments,
            meta: data.meta,
          },
        ]);
      } catch {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Something went wrong. Please try again." },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [input, loading],
  );

  const reset = useCallback(() => {
    setMessages([WELCOME]);
    setInput("");
  }, []);

  return { messages, input, setInput, loading, send, reset };
}
