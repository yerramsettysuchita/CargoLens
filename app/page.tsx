import Link from "next/link";
import {
  Package,
  ArrowRight,
  Shield,
  Leaf,
  Globe,
  CheckCircle,
  BarChart3,
  Zap,
  AlertTriangle,
  FileCheck,
  TrendingUp,
  MessageSquare,
  Calculator,
  ChevronRight,
} from "lucide-react";
import { LandingHeader } from "@/app/components/LandingHeader";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* ── Nav ── */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between h-14">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-700 flex items-center justify-center">
              <Package className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-gray-900 text-sm tracking-tight">CargoLens</span>
            <span className="ml-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              BETA
            </span>
          </div>
          <LandingHeader />
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-gradient-to-b from-blue-50 to-white">
        <div
          className="absolute inset-0 opacity-[0.4]"
          style={{
            backgroundImage:
              "linear-gradient(#E5E7EB 1px, transparent 1px), linear-gradient(90deg, #E5E7EB 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        <div className="relative max-w-5xl mx-auto px-6 pt-20 pb-16 text-center">
          <div className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full mb-6 bg-blue-50 text-blue-700 border border-blue-200 shadow-sm">
            <Globe className="w-3 h-3" />
            Global Trade Intelligence Platform
          </div>

          <h1 className="text-4xl sm:text-6xl font-bold text-gray-900 tracking-tight leading-tight mb-5">
            Plan it. Ship it. Track it.
            <br />
            <span className="text-blue-700">Deliver with confidence.</span>
          </h1>

          <p className="max-w-2xl mx-auto text-lg text-gray-500 leading-relaxed mb-10">
            CargoLens takes you from your first freight quote all the way through customs clearance
            and live delivery tracking, with compliance intelligence and a smart assistant available
            at every step along the way.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/estimate"
              className="flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-800 text-white font-semibold px-8 py-3.5 rounded-xl transition-all shadow-md text-sm"
            >
              Estimate a Shipment <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/dashboard"
              className="flex items-center justify-center gap-2 border border-gray-300 hover:border-blue-400 hover:bg-blue-50 text-gray-700 hover:text-blue-700 font-semibold px-8 py-3.5 rounded-xl transition-all text-sm"
            >
              Open the Dashboard
            </Link>
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-5 text-xs text-gray-500">
            {[
              "No onboarding required",
              "Works across all major corridors",
              "Compliance intelligence built in",
              "Carbon-aware routing included",
            ].map((t) => (
              <div key={t} className="flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                {t}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Workflow steps strip ── */}
      <section className="border-y border-gray-200 bg-gray-50">
        <div className="max-w-5xl mx-auto px-6 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-0">
            {[
              { step: "01", label: "Estimate",         sub: "Get rates in seconds",               href: "/estimate",       color: "text-blue-700" },
              { step: "02", label: "Create Shipment",  sub: "One click from your estimate",       href: "/shipments/new",  color: "text-violet-700" },
              { step: "03", label: "Check Compliance", sub: "AI reviews your trade documents",    href: "/shipments",      color: "text-amber-700" },
              { step: "04", label: "Monitor and Act",  sub: "Watch your cargo move in real time", href: "/dashboard",      color: "text-emerald-700" },
            ].map(({ step, label, sub, href, color }, i, arr) => (
              <div key={step} className="flex items-center gap-0">
                <Link
                  href={href}
                  className="flex flex-col sm:flex-row items-center gap-2 px-5 py-3 rounded-xl hover:bg-white hover:shadow-sm transition-all group"
                >
                  <span className={`text-xs font-bold ${color} bg-white border border-gray-200 rounded-full w-7 h-7 flex items-center justify-center shrink-0 shadow-sm group-hover:shadow`}>
                    {step}
                  </span>
                  <div className="text-center sm:text-left">
                    <div className="text-sm font-semibold text-gray-900">{label}</div>
                    <div className="text-[11px] text-gray-400">{sub}</div>
                  </div>
                </Link>
                {i < arr.length - 1 && (
                  <ChevronRight className="w-4 h-4 text-gray-300 hidden sm:block mx-1 shrink-0" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Feature cards ── */}
      <section className="max-w-5xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-3">
            Everything your trade team needs, all in one place.
          </h2>
          <p className="text-gray-500 max-w-xl mx-auto text-sm leading-relaxed">
            You should not have to juggle five different tools to manage a single shipment.
            CargoLens brings your freight estimates, compliance checks, live tracking, and risk
            intelligence into one connected workflow.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[
            {
              icon: Calculator,
              iconCls: "text-blue-600 bg-blue-50",
              title: "Shipment Estimator",
              desc: "Get an instant breakdown of freight cost, estimated transit time, and carbon footprint across sea, air, and rail options. Compare carriers side by side before you make any booking commitment.",
              href: "/estimate",
              cta: "Try the estimator",
            },
            {
              icon: FileCheck,
              iconCls: "text-amber-600 bg-amber-50",
              title: "AI Document Compliance",
              desc: "Upload your Bill of Lading, commercial invoice, or packing list and the AI will read through it for you. It catches customs mismatches, sanctions exposure, and potential fraud signals in seconds so you do not have to.",
              href: "/shipments",
              cta: "Check your documents",
            },
            {
              icon: BarChart3,
              iconCls: "text-emerald-600 bg-emerald-50",
              title: "Live Control Tower",
              desc: "Watch every active shipment move across your corridors in real time. The dashboard surfaces delay alerts, port congestion signals, and risk scores so you always know what needs your attention first.",
              href: "/dashboard",
              cta: "Open the control tower",
            },
            {
              icon: TrendingUp,
              iconCls: "text-violet-600 bg-violet-50",
              title: "Trade Pulse",
              desc: "See the bigger picture with live corridor analytics that show delay trends, volume patterns, and early risk signals across your trade lanes. You will spot a disruption before it reaches your cargo.",
              href: "/dashboard",
              cta: "View Trade Pulse",
            },
            {
              icon: MessageSquare,
              iconCls: "text-cyan-600 bg-cyan-50",
              title: "Contextual Copilot",
              desc: "Have a question about a specific shipment? Just ask it in plain English. The copilot is available from every page of CargoLens and it understands exactly what you are looking at right now.",
              href: "/dashboard",
              cta: "Open the copilot",
            },
            {
              icon: AlertTriangle,
              iconCls: "text-orange-600 bg-orange-50",
              title: "Risk and Sanctions Screening",
              desc: "Every shipment is automatically screened against sanctioned countries, restricted HS codes, and the major compliance regimes including UFLPA, CBAM, Section 301, and FDA requirements. The rules are handled for you.",
              href: "/shipments",
              cta: "Screen a shipment",
            },
          ].map(({ icon: Icon, iconCls, title, desc, href, cta }) => (
            <div
              key={title}
              className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm hover:shadow-md transition-shadow flex flex-col"
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-4 ${iconCls}`}>
                <Icon className="w-4.5 h-4.5" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2 text-sm">{title}</h3>
              <p className="text-xs text-gray-500 leading-relaxed flex-1">{desc}</p>
              <Link
                href={href}
                className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-800 transition-colors"
              >
                {cta} <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* ── Trade corridors ── */}
      <section className="bg-gray-50 border-y border-gray-200 py-16">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Ready to go from the moment you log in</h2>
            <p className="text-gray-500 text-sm max-w-xl mx-auto">
              We have already mapped the world&apos;s major trade corridors with real carrier data, live compliance
              requirements, and operational alerts. You can start estimating and booking straight away without
              any configuration needed.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                from: "India", to: "European Union",
                fromFlag: "🇮🇳", toFlag: "🇪🇺",
                mode: "Sea and Rail", example: "Nhava Sheva to Rotterdam",
                highlight: "CBAM ready",
                color: "bg-blue-50 border-blue-200", textColor: "text-blue-700",
              },
              {
                from: "UAE", to: "East Africa",
                fromFlag: "🇦🇪", toFlag: "🇰🇪",
                mode: "Sea", example: "Jebel Ali to Mombasa",
                highlight: "DP World corridor",
                color: "bg-emerald-50 border-emerald-200", textColor: "text-emerald-700",
              },
              {
                from: "SE Asia", to: "Europe",
                fromFlag: "🇸🇬", toFlag: "🇩🇪",
                mode: "Sea", example: "Singapore to Hamburg",
                highlight: "Electronics and tech",
                color: "bg-violet-50 border-violet-200", textColor: "text-violet-700",
              },
              {
                from: "India", to: "North America",
                fromFlag: "🇮🇳", toFlag: "🇺🇸",
                mode: "Sea and Air", example: "Chennai to New York",
                highlight: "FDA and UFLPA ready",
                color: "bg-amber-50 border-amber-200", textColor: "text-amber-700",
              },
            ].map(({ from, to, fromFlag, toFlag, mode, example, highlight, color, textColor }) => (
              <div key={example} className={`rounded-xl border p-4 ${color} flex flex-col h-full`}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xl">{fromFlag}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-xl">{toFlag}</span>
                </div>
                <div className="text-sm font-bold text-gray-900 mb-0.5">{from} to {to}</div>
                <div className="text-xs text-gray-500 mb-3 flex-1">{example} · {mode}</div>
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white border ${textColor} self-start`}>
                  {highlight}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Global readiness ── */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Designed for the way global trade actually works</h2>
          <p className="text-gray-500 text-sm max-w-xl mx-auto">
            Real trade operations deal with multiple currencies, overlapping regulations, and routes that
            span different legal territories. CargoLens is built around those realities rather than
            pretending they do not exist.
          </p>
        </div>
        <div className="grid sm:grid-cols-3 gap-5">
          {[
            {
              icon: Zap,
              iconCls: "text-emerald-600 bg-emerald-50",
              title: "Multi-Currency Support",
              desc: "View all your shipment values in the currency that makes sense for your business. CargoLens supports USD, EUR, AED, and INR with consistent exchange rate conversion across every calculation.",
              badges: ["USD", "EUR", "AED", "INR"],
            },
            {
              icon: Leaf,
              iconCls: "text-blue-600 bg-blue-50",
              title: "Carbon-Aware Routing",
              desc: "Every route comparison includes the carbon emissions alongside cost and transit time so you can make an informed choice when sustainability matters as much as speed or price.",
              badges: ["Sea", "Air", "Rail"],
            },
            {
              icon: Shield,
              iconCls: "text-red-600 bg-red-50",
              title: "Built-in Regulation Awareness",
              desc: "The platform knows which compliance regimes apply to your specific trade corridor and surfaces them automatically. Whether it is UFLPA for US-bound goods or CBAM for European imports, you see what applies without having to look it up.",
              badges: ["UFLPA", "CBAM", "Section 301"],
            },
          ].map(({ icon: Icon, iconCls, title, desc, badges }) => (
            <div key={title} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm flex flex-col">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-4 ${iconCls}`}>
                <Icon className="w-4.5 h-4.5" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2 text-sm">{title}</h3>
              <p className="text-xs text-gray-500 leading-relaxed mb-3 flex-1">{desc}</p>
              <div className="flex flex-wrap gap-1.5">
                {badges.map((b) => (
                  <span key={b} className="text-[11px] font-medium text-gray-600 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded">
                    {b}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="max-w-3xl mx-auto px-6 pb-20 text-center">
        <div className="bg-blue-700 rounded-2xl p-10 shadow-xl">
          <h2 className="text-3xl font-bold text-white mb-4">
            See what CargoLens can do for your next shipment.
          </h2>
          <p className="text-blue-100 text-sm mb-8 max-w-md mx-auto leading-relaxed">
            The fastest way to experience CargoLens is to estimate a real shipment. Enter your origin,
            destination, and cargo details and you will get freight rates, transit times, carbon
            footprint, and compliance flags in under ten seconds.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/estimate"
              className="inline-flex items-center justify-center gap-2 bg-white text-blue-700 font-bold px-8 py-3.5 rounded-xl transition-all shadow-md hover:shadow-lg text-sm hover:bg-blue-50"
            >
              Estimate a Shipment <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center gap-2 border border-blue-500 text-white font-semibold px-8 py-3.5 rounded-xl transition-all text-sm hover:bg-blue-600"
            >
              Go to Dashboard
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-gray-200 bg-gray-50 py-8">
        <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-blue-700 flex items-center justify-center">
              <Package className="w-3 h-3 text-white" />
            </div>
            <span className="text-sm font-semibold text-gray-900">CargoLens</span>
          </div>
          <div className="flex flex-wrap justify-center gap-4 text-xs text-gray-500">
            {[
              { label: "Estimator",    href: "/estimate" },
              { label: "Dashboard",    href: "/dashboard" },
              { label: "Shipments",    href: "/shipments" },
              { label: "Compliance",   href: "/shipments" },
              { label: "Trade Pulse",  href: "/dashboard" },
            ].map(({ label, href }) => (
              <Link key={label} href={href} className="hover:text-gray-900 transition-colors">{label}</Link>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-gray-400" />
            <p className="text-xs text-gray-400">© 2026 CargoLens</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
