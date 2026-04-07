"use client";

// ─── ShipmentNotifyPanel ───────────────────────────────────────────────────────
// Sends email/WhatsApp alerts for a specific shipment via /api/notify.
// Reads notification channels from user preferences (set in /settings).

import { useState } from "react";
import {
  Bell, Mail, MessageSquare, Check, AlertCircle, Loader2, Settings, ChevronDown, ChevronUp,
} from "lucide-react";
import Link from "next/link";

type NotificationType = "shipment_created" | "customs_hold" | "high_delay_risk" | "at_risk" | "delivered";
type Channel = "email" | "whatsapp";
type SendState = "idle" | "sending" | "sent" | "error";

const ALERT_TYPES: { type: NotificationType; label: string; description: string }[] = [
  { type: "shipment_created",  label: "Shipment Summary",     description: "Route, mode, carrier, and shipment details" },
  { type: "customs_hold",      label: "Customs Hold Alert",   description: "Notify that this shipment is under customs review" },
  { type: "high_delay_risk",   label: "High Delay Risk",      description: "Alert about predicted delay on this corridor" },
  { type: "at_risk",           label: "At Risk Notice",       description: "Notify that this shipment has been flagged at risk" },
];

export default function ShipmentNotifyPanel({ shipmentId, shipmentCode, shipmentStatus }: {
  shipmentId: string;
  shipmentCode: string;
  shipmentStatus: string;
}) {
  const [expanded, setExpanded]         = useState(false);
  const [selectedType, setSelectedType] = useState<NotificationType>("shipment_created");
  const [channels, setChannels]         = useState<Channel[]>(["email"]);
  const [sendState, setSendState]       = useState<SendState>("idle");
  const [error, setError]               = useState<string | null>(null);

  // Auto-select type based on status
  const defaultType: NotificationType =
    shipmentStatus === "customs_hold" ? "customs_hold"
    : shipmentStatus === "at_risk"    ? "at_risk"
    : shipmentStatus === "delayed"    ? "high_delay_risk"
    : "shipment_created";

  function toggleChannel(ch: Channel) {
    setChannels((prev) =>
      prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch]
    );
  }

  async function send() {
    if (channels.length === 0) return;
    setSendState("sending");
    setError(null);
    try {
      const res = await fetch("/api/notify", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          shipmentId,
          type:     selectedType,
          channels,
        }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        setSendState("error");
        setError(json.error ?? "Send failed");
      } else {
        setSendState("sent");
        setTimeout(() => setSendState("idle"), 4000);
      }
    } catch (e) {
      setSendState("error");
      setError(String(e));
    }
  }

  // Pre-select the contextual type on expand
  function handleExpand() {
    if (!expanded) setSelectedType(defaultType);
    setExpanded((v) => !v);
    setSendState("idle");
    setError(null);
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header — always visible */}
      <button
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
        onClick={handleExpand}
      >
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-blue-600" />
          <h2 className="text-sm font-semibold text-gray-900">Send Notification</h2>
          <span className="text-[11px] text-gray-400">email or WhatsApp</span>
        </div>
        <div className="flex items-center gap-2">
          {sendState === "sent" && (
            <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
              <Check className="w-3.5 h-3.5" /> Sent
            </span>
          )}
          {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </button>

      {expanded && (
        <div className="px-5 pb-5 border-t border-gray-100 pt-4 flex flex-col gap-4">

          {/* Alert type selector */}
          <div>
            <p className="text-xs font-semibold text-gray-600 mb-2">What to send</p>
            <div className="flex flex-col gap-2">
              {ALERT_TYPES.map(({ type, label, description }) => (
                <button
                  key={type}
                  onClick={() => setSelectedType(type)}
                  className={`text-left rounded-lg border px-4 py-3 transition-all ${
                    selectedType === type
                      ? "border-blue-400 bg-blue-50"
                      : "border-gray-200 hover:border-blue-200 hover:bg-blue-50/30"
                  }`}
                >
                  <p className={`text-xs font-semibold ${selectedType === type ? "text-blue-800" : "text-gray-800"}`}>
                    {label}
                  </p>
                  <p className="text-[11px] text-gray-400 mt-0.5">{description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Channel toggles */}
          <div>
            <p className="text-xs font-semibold text-gray-600 mb-2">Send via</p>
            <div className="flex gap-2">
              {(["email", "whatsapp"] as Channel[]).map((ch) => {
                const active = channels.includes(ch);
                return (
                  <button
                    key={ch}
                    onClick={() => toggleChannel(ch)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
                      active
                        ? ch === "email"
                          ? "border-blue-400 bg-blue-50 text-blue-700"
                          : "border-emerald-400 bg-emerald-50 text-emerald-700"
                        : "border-gray-200 text-gray-500 hover:border-gray-300"
                    }`}
                  >
                    {ch === "email"
                      ? <Mail className="w-3.5 h-3.5" />
                      : <MessageSquare className="w-3.5 h-3.5" />}
                    {ch === "email" ? "Email" : "WhatsApp"}
                    {active && <Check className="w-3 h-3" />}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-gray-400 mt-1.5">
              Sent to your saved contact details.{" "}
              <Link href="/settings" className="text-blue-500 hover:underline">Manage in Settings</Link>
            </p>
          </div>

          {/* Send button */}
          <div className="flex items-center gap-3">
            <button
              onClick={send}
              disabled={sendState === "sending" || channels.length === 0}
              className={`flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors disabled:opacity-60 ${
                sendState === "sent"
                  ? "bg-emerald-600 text-white"
                  : sendState === "error"
                  ? "bg-red-600 text-white"
                  : "bg-blue-700 hover:bg-blue-800 text-white"
              }`}
            >
              {sendState === "sending" && <Loader2 className="w-4 h-4 animate-spin" />}
              {sendState === "sent"    && <Check className="w-4 h-4" />}
              {sendState === "error"   && <AlertCircle className="w-4 h-4" />}
              {sendState === "idle"    && <Bell className="w-4 h-4" />}
              {sendState === "sending" ? "Sending…"
                : sendState === "sent"  ? "Sent successfully"
                : sendState === "error" ? "Failed — try again"
                : "Send Alert"}
            </button>
            <Link
              href="/settings"
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              <Settings className="w-3.5 h-3.5" /> Notification settings
            </Link>
          </div>

          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 text-xs text-red-700">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
