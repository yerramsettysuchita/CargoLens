"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Package, ArrowRight, Eye, EyeOff, CheckCircle, AlertCircle } from "lucide-react";
import { createClient } from "@/app/lib/supabase/client";

// ─── Inner form (needs useSearchParams → must be inside Suspense) ─────────────

function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/dashboard";

  const [mode, setMode] = useState<"signup" | "signin">("signup");
  const [form, setForm] = useState({ name: "", company: "", email: "", password: "" });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmSent, setConfirmSent] = useState(false);

  const supabase = createClient();

  // Prefetch dashboard so navigation is instant after sign-in
  useEffect(() => { router.prefetch("/dashboard"); }, [router]);

  // If user arrives already authenticated, send them on
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) router.replace(next);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: {
            full_name: form.name,
            company: form.company,
          },
        },
      });
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
      // Supabase may require email confirmation. Check session immediately.
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        router.replace(next);
      } else {
        setConfirmSent(true);
        setLoading(false);
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email: form.email,
        password: form.password,
      });
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
      router.push(next);
    }
  }

  const inputCls =
    "w-full text-sm border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white";

  if (confirmSent) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-md p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-6 h-6 text-blue-600" />
        </div>
        <h2 className="text-lg font-bold text-gray-900 mb-2">Check your email</h2>
        <p className="text-sm text-gray-500 mb-4">
          We sent a confirmation link to <strong>{form.email}</strong>. Click it to activate your account, then return here to sign in.
        </p>
        <button
          onClick={() => { setConfirmSent(false); setMode("signin"); }}
          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
        >
          Back to sign in
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-md p-8">
      {/* Logo + heading */}
      <div className="text-center mb-6">
        <div className="w-12 h-12 rounded-xl bg-blue-700 flex items-center justify-center mx-auto mb-3 shadow-sm">
          <Package className="w-6 h-6 text-white" />
        </div>
        <h1 className="text-xl font-bold text-gray-900">
          {mode === "signup" ? "Create your account" : "Welcome back"}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {mode === "signup"
            ? "Your global trade operations start here."
            : "Good to see you again."}
        </p>
      </div>

      {/* Mode toggle */}
      <div className="flex rounded-lg border border-gray-200 p-1 mb-6 gap-1">
        {(["signup", "signin"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => { setMode(m); setError(null); }}
            className={`flex-1 text-sm font-medium py-1.5 rounded-md transition-colors ${
              mode === m ? "bg-blue-700 text-white shadow-sm" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            {m === "signup" ? "Sign Up" : "Sign In"}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {mode === "signup" && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Full Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Your name"
                className={inputCls}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 mb-1 block">Company</label>
              <input
                type="text"
                value={form.company}
                onChange={(e) => set("company", e.target.value)}
                placeholder="Company name"
                className={inputCls}
              />
            </div>
          </div>
        )}

        <div>
          <label className="text-xs font-medium text-gray-700 mb-1 block">
            Work Email <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            placeholder="you@company.com"
            required
            className={inputCls}
          />
        </div>

        <div>
          <label className="text-xs font-medium text-gray-700 mb-1 block">
            Password <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              type={showPw ? "text" : "password"}
              value={form.password}
              onChange={(e) => set("password", e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              className={`${inputCls} pr-9`}
            />
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 mt-1"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              {mode === "signup" ? "Creating account…" : "Signing in…"}
            </>
          ) : (
            <>
              {mode === "signup" ? "Create Account" : "Sign In"}
              <ArrowRight className="w-3.5 h-3.5" />
            </>
          )}
        </button>
      </form>

      {mode === "signup" && (
        <div className="mt-5 flex flex-col gap-1.5">
          {[
            "Free to start with no credit card required",
            "Full shipment visibility across all your corridors",
            "Proactive compliance and delay alerts built in",
          ].map((t) => (
            <div key={t} className="flex items-center gap-2 text-xs text-gray-500">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              {t}
            </div>
          ))}
        </div>
      )}

      <p className="text-center text-[11px] text-gray-400 mt-5 leading-relaxed">
        By continuing, you agree to CargoLens{" "}
        <span className="underline cursor-pointer">Terms of Service</span> and{" "}
        <span className="underline cursor-pointer">Privacy Policy</span>.
      </p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AuthPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm shrink-0">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between h-14">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-700 flex items-center justify-center">
              <Package className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-gray-900 text-sm tracking-tight">CargoLens</span>
          </Link>
          <Link href="/estimate" className="text-sm text-gray-500 hover:text-gray-900 font-medium transition-colors">
            Back to Estimator
          </Link>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center p-4 py-10">
        <div className="w-full max-w-md">
          <Suspense fallback={null}>
            <AuthForm />
          </Suspense>
          <p className="text-center text-xs text-gray-500 mt-4">
            Have an account already?{" "}
            <Link href="/auth?mode=signin" className="text-blue-600 hover:text-blue-700 font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
