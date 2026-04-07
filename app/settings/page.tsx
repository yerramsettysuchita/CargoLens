"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Bell, Mail, MessageSquare, Check, AlertCircle, ArrowLeft,
  Loader2, Phone, Send, Settings, KeyRound, ExternalLink,
} from "lucide-react";
import { Navbar } from "@/app/components/Navbar";
import { createClient } from "@/app/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

type Channel = "email" | "whatsapp";
type TestStatus = "idle" | "sending" | "sent" | "error";

const PROVIDER_INFO = {
  email: {
    name: "Resend",
    free: "3,000 emails/month free",
    url: "https://resend.com",
    envKey: "RESEND_API_KEY",
    steps: [
      "Go to resend.com and create a free account",
      "In the Resend dashboard go to API Keys and click Create API Key",
      'Give it a name like "CargoLens" and copy the key',
      "Add RESEND_API_KEY=re_xxxx to your .env.local file",
      "Optionally add your domain in Resend under Domains for a custom sender address",
    ],
  },
  whatsapp: {
    name: "Twilio WhatsApp Sandbox",
    free: "Free sandbox with $15 trial credit",
    url: "https://www.twilio.com/try-twilio",
    envKey: "TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN",
    steps: [
      "Go to twilio.com and create a free account (no credit card needed for sandbox)",
      "In the Twilio Console go to Messaging then Try it out then Send a WhatsApp message",
      "You will see a sandbox number (+1 415 523 8886) and a join keyword",
      "Send the join message from your WhatsApp to activate the sandbox for your number",
      "Copy your Account SID and Auth Token from the Console dashboard",
      "Add TWILIO_ACCOUNT_SID= and TWILIO_AUTH_TOKEN= to your .env.local file",
      "Restart the dev server for the changes to take effect",
    ],
  },
};

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [channels, setChannels] = useState<Channel[]>(["email"]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [testStatus, setTestStatus] = useState<Record<Channel, TestStatus>>({
    email: "idle",
    whatsapp: "idle",
  });
  const [testError, setTestError] = useState<Record<Channel, string>>({ email: "", whatsapp: "" });

  const [activeGuide, setActiveGuide] = useState<"email" | "whatsapp" | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.replace("/auth"); return; }
      setUser(data.user);
      setEmail(data.user.email ?? "");
      setPhone(data.user.user_metadata?.phone ?? "");
      const savedChannels = data.user.user_metadata?.notification_channels;
      if (Array.isArray(savedChannels)) setChannels(savedChannels);
      setLoading(false);
    });
  }, [router]);

  async function savePreferences() {
    if (!user) return;
    setSaving(true);
    setSaveError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({
      data: {
        phone,
        notification_channels: channels,
      },
    });
    setSaving(false);
    if (error) { setSaveError(error.message); return; }
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  async function sendTest(channel: Channel) {
    if (!user) return;
    setTestStatus((s) => ({ ...s, [channel]: "sending" }));
    setTestError((s) => ({ ...s, [channel]: "" }));
    try {
      const res = await fetch("/api/notify/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel, phone: phone || undefined }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        setTestStatus((s) => ({ ...s, [channel]: "error" }));
        setTestError((s) => ({ ...s, [channel]: json.error ?? "Send failed" }));
      } else {
        setTestStatus((s) => ({ ...s, [channel]: "sent" }));
        setTimeout(() => setTestStatus((s) => ({ ...s, [channel]: "idle" })), 4000);
      }
    } catch (e) {
      setTestStatus((s) => ({ ...s, [channel]: "error" }));
      setTestError((s) => ({ ...s, [channel]: String(e) }));
    }
  }

  function toggleChannel(ch: Channel) {
    setChannels((prev) =>
      prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch]
    );
    setSaved(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-6">
          <Link href="/dashboard" className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" /> Dashboard
          </Link>
          <span className="text-gray-300">/</span>
          <span className="text-xs text-gray-600 font-medium">Notification Settings</span>
        </div>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-blue-700 flex items-center justify-center">
            <Bell className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Notification Settings</h1>
            <p className="text-sm text-gray-500">Set up email and WhatsApp alerts for your shipments.</p>
          </div>
        </div>

        <div className="flex flex-col gap-5">

          {/* ── Contact Details ──────────────────────────────────────── */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
              <Settings className="w-4 h-4 text-gray-500" />
              <h2 className="text-sm font-semibold text-gray-900">Contact Details</h2>
            </div>
            <div className="px-5 py-5 flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                  Email Address
                </label>
                <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2.5 bg-gray-50">
                  <Mail className="w-4 h-4 text-gray-400 shrink-0" />
                  <span className="text-sm text-gray-600">{email}</span>
                  <span className="ml-auto text-[10px] text-gray-400 font-medium">from your account</span>
                </div>
                <p className="text-[11px] text-gray-400 mt-1.5">
                  Alerts go to this address. Change it in your Supabase account settings.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                  WhatsApp Number
                  <span className="ml-1.5 font-normal text-gray-400">for WhatsApp alerts</span>
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 border border-gray-300 rounded-lg px-3 py-2.5 bg-white flex-1 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 transition-all">
                    <Phone className="w-4 h-4 text-gray-400 shrink-0" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => { setPhone(e.target.value); setSaved(false); }}
                      placeholder="e.g. 919876543210 (country code + number)"
                      className="flex-1 text-sm text-gray-800 bg-transparent focus:outline-none placeholder:text-gray-300"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-gray-400 mt-1.5">
                  Include country code without the + sign. For India: 91xxxxxxxxxx. For USA: 1xxxxxxxxxx.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-2">
                  Active Notification Channels
                </label>
                <div className="flex gap-3">
                  {(["email", "whatsapp"] as Channel[]).map((ch) => {
                    const active = channels.includes(ch);
                    return (
                      <button
                        key={ch}
                        onClick={() => toggleChannel(ch)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${
                          active
                            ? ch === "email"
                              ? "border-blue-500 bg-blue-50 text-blue-700"
                              : "border-emerald-500 bg-emerald-50 text-emerald-700"
                            : "border-gray-200 text-gray-500 hover:border-gray-300"
                        }`}
                      >
                        {ch === "email"
                          ? <Mail className="w-4 h-4" />
                          : <MessageSquare className="w-4 h-4" />}
                        {ch === "email" ? "Email" : "WhatsApp"}
                        {active && <Check className="w-3.5 h-3.5" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center gap-3 pt-1">
                <button
                  onClick={savePreferences}
                  disabled={saving}
                  className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
                >
                  {saving
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving</>
                    : saved
                    ? <><Check className="w-4 h-4" /> Saved</>
                    : "Save Preferences"}
                </button>
                {saveError && (
                  <p className="text-xs text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" /> {saveError}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* ── Test Notifications ───────────────────────────────────── */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
              <Send className="w-4 h-4 text-gray-500" />
              <h2 className="text-sm font-semibold text-gray-900">Send a Test Notification</h2>
            </div>
            <div className="px-5 py-5 flex flex-col gap-4">
              <p className="text-xs text-gray-500">
                Test that your API keys are working. The test message will be sent to the contact details above.
              </p>
              <div className="flex gap-3 flex-wrap">
                {(["email", "whatsapp"] as Channel[]).map((ch) => {
                  const st = testStatus[ch];
                  const err = testError[ch];
                  return (
                    <div key={ch} className="flex flex-col gap-1">
                      <button
                        onClick={() => sendTest(ch)}
                        disabled={st === "sending" || (ch === "whatsapp" && !phone)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all disabled:opacity-50 ${
                          st === "sent"  ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                          : st === "error" ? "border-red-300 bg-red-50 text-red-700"
                          : ch === "email"
                          ? "border-blue-200 hover:border-blue-300 text-blue-700 hover:bg-blue-50"
                          : "border-emerald-200 hover:border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                        }`}
                      >
                        {st === "sending" && <Loader2 className="w-4 h-4 animate-spin" />}
                        {st === "sent"    && <Check className="w-4 h-4" />}
                        {st === "error"   && <AlertCircle className="w-4 h-4" />}
                        {st === "idle"    && (ch === "email" ? <Mail className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />)}
                        {st === "sending" ? "Sending…"
                          : st === "sent" ? "Sent!"
                          : st === "error" ? "Failed"
                          : `Test ${ch === "email" ? "Email" : "WhatsApp"}`}
                      </button>
                      {ch === "whatsapp" && !phone && (
                        <p className="text-[10px] text-gray-400">Add a phone number above first</p>
                      )}
                      {err && <p className="text-[10px] text-red-600 max-w-xs">{err}</p>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── Setup Guides ─────────────────────────────────────────── */}
          {(["email", "whatsapp"] as const).map((ch) => {
            const info = PROVIDER_INFO[ch];
            const open = activeGuide === ch;
            return (
              <div key={ch} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <button
                  className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                  onClick={() => setActiveGuide(open ? null : ch)}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      ch === "email" ? "bg-blue-50" : "bg-emerald-50"
                    }`}>
                      {ch === "email"
                        ? <Mail className="w-4 h-4 text-blue-600" />
                        : <MessageSquare className="w-4 h-4 text-emerald-600" />}
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-gray-900">
                        How to set up {ch === "email" ? "Email" : "WhatsApp"} via {info.name}
                      </p>
                      <p className="text-xs text-gray-400">{info.free}</p>
                    </div>
                  </div>
                  <div className={`text-[11px] font-semibold px-2 py-1 rounded-full ${
                    ch === "email"
                      ? "bg-blue-50 text-blue-600"
                      : "bg-emerald-50 text-emerald-600"
                  }`}>
                    {open ? "Hide" : "Show guide"}
                  </div>
                </button>

                {open && (
                  <div className="px-5 pb-5 border-t border-gray-100">
                    <div className="mt-4 flex flex-col gap-3">
                      <a
                        href={info.url}
                        target="_blank"
                        rel="noreferrer"
                        className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg w-fit transition-colors ${
                          ch === "email"
                            ? "bg-blue-700 hover:bg-blue-800 text-white"
                            : "bg-emerald-600 hover:bg-emerald-700 text-white"
                        }`}
                      >
                        Open {info.name} <ExternalLink className="w-3 h-3" />
                      </a>

                      <ol className="flex flex-col gap-2 mt-1">
                        {info.steps.map((step, i) => (
                          <li key={i} className="flex items-start gap-3 text-xs text-gray-700">
                            <span className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                              ch === "email"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-emerald-100 text-emerald-700"
                            }`}>
                              {i + 1}
                            </span>
                            {step}
                          </li>
                        ))}
                      </ol>

                      <div className="mt-2 bg-gray-50 border border-gray-100 rounded-lg px-4 py-3">
                        <p className="text-[11px] text-gray-500 mb-1 font-semibold flex items-center gap-1">
                          <KeyRound className="w-3 h-3" /> Environment variable to add to .env.local
                        </p>
                        <code className="text-xs text-gray-800 font-mono">{info.envKey}=your_key_here</code>
                        <p className="text-[10px] text-gray-400 mt-1.5">
                          Restart <code className="font-mono">npm run dev</code> after adding the key.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

        </div>
      </main>
    </div>
  );
}
