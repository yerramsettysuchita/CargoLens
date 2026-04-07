"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clsx } from "clsx";
import {
  Package,
  LayoutDashboard,
  GitBranch,
  Percent,
  Leaf,
  Bell,
  ChevronDown,
  LogOut,
  User,
  Bot,
  Calculator,
  AlertTriangle,
  Clock,
  ShieldAlert,
  AlertCircle,
  CheckCircle2,
  X,
  Settings,
} from "lucide-react";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { CopilotDrawer } from "@/app/components/CopilotDrawer";

const navLinks = [
  { href: "/dashboard",  label: "Dashboard",        icon: LayoutDashboard },
  { href: "/shipments",  label: "Shipments",        icon: Package },
  { href: "/compare",    label: "Rate Compare",     icon: GitBranch },
  { href: "/tariff",     label: "Tariff Simulator", icon: Percent },
  { href: "/carbon",     label: "Carbon Routes",    icon: Leaf },
  { href: "/estimate",   label: "Estimate",         icon: Calculator },
];

interface ShipmentAlert {
  id: string;
  shipment_code: string;
  status: string;
  risk_level: string;
  corridor: string;
  cargo_category: string;
}

function alertIcon(status: string, risk: string) {
  if (risk === "high" || status === "customs_hold") return <ShieldAlert className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />;
  if (status === "at_risk" || status === "delayed")  return <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />;
  if (status === "in_transit")                       return <Clock className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />;
  return <AlertCircle className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />;
}

function alertMessage(s: ShipmentAlert): string {
  if (s.status === "customs_hold") return `${s.shipment_code} is held at customs. Review compliance documents.`;
  if (s.status === "at_risk")      return `${s.shipment_code} is at risk. Check route conditions.`;
  if (s.status === "delayed")      return `${s.shipment_code} is delayed on the ${s.corridor} corridor.`;
  if (s.risk_level === "high")     return `${s.shipment_code} has a high risk level. Immediate review needed.`;
  if (s.status === "in_transit")   return `${s.shipment_code} is in transit on the ${s.corridor} corridor.`;
  return `${s.shipment_code} — ${s.status.replace(/_/g, " ")}.`;
}

function alertPriority(s: ShipmentAlert): number {
  if (s.status === "customs_hold") return 0;
  if (s.risk_level === "high")     return 1;
  if (s.status === "at_risk")      return 2;
  if (s.status === "delayed")      return 3;
  return 4;
}

export function Navbar({ unreadAlerts = 0 }: { unreadAlerts?: number }) {
  const pathname = usePathname();
  const router = useRouter();

  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [alerts, setAlerts] = useState<ShipmentAlert[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const notifRef = useRef<HTMLDivElement>(null);

  const copilotContext = (() => {
    if (pathname.startsWith("/shipments/") && pathname !== "/shipments/new") {
      return { page: "shipment detail", shipmentId: pathname.split("/")[2] };
    }
    if (pathname === "/shipments/new") return { page: "new shipment" };
    if (pathname === "/dashboard")    return { page: "dashboard" };
    if (pathname === "/estimate")     return { page: "rate estimate" };
    if (pathname === "/compare")      return { page: "rate compare" };
    if (pathname === "/tariff")       return { page: "tariff simulator" };
    if (pathname === "/carbon")       return { page: "carbon routes" };
    return { page: "CargoLens" };
  })();

  useEffect(() => {
    import("@/app/lib/supabase/client").then(({ createClient }) => {
      const supabase = createClient();
      supabase.auth.getUser().then(({ data }) => setUser(data.user));
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        (_event, session) => setUser(session?.user ?? null),
      );
      return () => subscription.unsubscribe();
    });
  }, []);

  // Load alerts when notification panel opens
  useEffect(() => {
    if (!notifOpen || alerts.length > 0) return;
    setAlertsLoading(true);
    import("@/app/lib/supabase/client").then(async ({ createClient }) => {
      const supabase = createClient();
      const { data } = await supabase
        .from("shipments")
        .select("id, shipment_code, status, risk_level, corridor, cargo_category")
        .in("status", ["customs_hold", "at_risk", "delayed", "in_transit"])
        .order("created_at", { ascending: false })
        .limit(20);
      if (data) {
        const sorted = [...data].sort((a, b) => alertPriority(a as ShipmentAlert) - alertPriority(b as ShipmentAlert));
        setAlerts(sorted as ShipmentAlert[]);
      }
      setAlertsLoading(false);
    });
  }, [notifOpen]);

  // Close notif panel on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    if (notifOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [notifOpen]);

  const visibleAlerts = alerts.filter((a) => !dismissed.has(a.id));
  const urgentCount = visibleAlerts.filter(
    (a) => a.status === "customs_hold" || a.status === "at_risk" || a.risk_level === "high"
  ).length;

  const badgeCount = urgentCount || unreadAlerts;

  async function handleSignOut() {
    const { createClient } = await import("@/app/lib/supabase/client");
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  const displayName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split("@")[0] ||
    "Account";

  const initials = displayName.slice(0, 1).toUpperCase();

  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center h-14 gap-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0 mr-2">
          <div className="w-7 h-7 rounded-lg bg-blue-700 flex items-center justify-center">
            <Package className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-gray-900 text-sm tracking-tight">CargoLens</span>
        </Link>

        {/* Nav links */}
        <div className="hidden md:flex items-center gap-0.5 flex-1">
          {navLinks.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== "/estimate" && pathname.startsWith(href + "/"));
            return (
              <Link
                key={href}
                href={href}
                className={clsx(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                  active
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-500 hover:text-gray-900 hover:bg-gray-100",
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </Link>
            );
          })}
        </div>

        {/* Right */}
        <div className="ml-auto flex items-center gap-2">

          {/* Notifications bell */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => setNotifOpen((v) => !v)}
              className={clsx(
                "relative p-2 rounded-lg transition-colors",
                notifOpen
                  ? "bg-blue-50 text-blue-700"
                  : "hover:bg-gray-100 text-gray-500 hover:text-gray-900"
              )}
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
              {badgeCount > 0 && (
                <span className="absolute top-1 right-1 w-3.5 h-3.5 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {badgeCount > 9 ? "9+" : badgeCount}
                </span>
              )}
            </button>

            {notifOpen && (
              <div className="absolute right-0 top-full mt-2 w-96 bg-white border border-gray-200 rounded-2xl shadow-xl z-30 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-gray-600" />
                    <h3 className="text-sm font-semibold text-gray-900">Shipment Alerts</h3>
                    {urgentCount > 0 && (
                      <span className="text-[10px] font-bold bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">
                        {urgentCount} urgent
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => setNotifOpen(false)}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="max-h-96 overflow-y-auto">
                  {alertsLoading ? (
                    <div className="flex items-center justify-center py-10">
                      <div className="w-5 h-5 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
                    </div>
                  ) : visibleAlerts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                      <CheckCircle2 className="w-8 h-8 text-emerald-300 mb-2" />
                      <p className="text-sm font-medium text-gray-500">All shipments are on track</p>
                      <p className="text-xs text-gray-400 mt-1">No active alerts at this time.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-50">
                      {visibleAlerts.map((alert) => (
                        <div
                          key={alert.id}
                          className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors group"
                        >
                          {alertIcon(alert.status, alert.risk_level)}
                          <div className="flex-1 min-w-0">
                            <Link
                              href={`/shipments/${alert.id}`}
                              onClick={() => setNotifOpen(false)}
                              className="block"
                            >
                              <p className="text-xs font-semibold text-gray-900 mb-0.5 hover:text-blue-700 transition-colors">
                                {alert.shipment_code}
                              </p>
                              <p className="text-xs text-gray-600 leading-relaxed">
                                {alertMessage(alert)}
                              </p>
                              <p className="text-[10px] text-gray-400 mt-0.5">{alert.corridor}</p>
                            </Link>
                          </div>
                          <button
                            onClick={() => setDismissed((s) => new Set([...s, alert.id]))}
                            className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-gray-500 transition-all shrink-0 mt-0.5"
                            title="Dismiss"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
                  <Link
                    href="/shipments"
                    onClick={() => setNotifOpen(false)}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors"
                  >
                    View all shipments
                  </Link>
                  {visibleAlerts.length > 0 && (
                    <button
                      onClick={() => setDismissed(new Set(alerts.map((a) => a.id)))}
                      className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      Dismiss all
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Copilot trigger */}
          <button
            onClick={() => setCopilotOpen((v) => !v)}
            title="Open Logistics Assistant"
            className={clsx(
              "relative p-2 rounded-lg transition-colors",
              copilotOpen
                ? "bg-violet-100 text-violet-700"
                : "hover:bg-gray-100 text-gray-500 hover:text-gray-900",
            )}
          >
            <Bot className="w-4 h-4" />
          </button>

          {/* User menu */}
          {user ? (
            <div className="relative">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 hover:border-gray-300 cursor-pointer transition-colors bg-white"
              >
                <div className="w-6 h-6 rounded-full bg-blue-700 flex items-center justify-center text-xs font-bold text-white">
                  {initials}
                </div>
                <span className="text-sm text-gray-700 hidden sm:block font-medium max-w-30 truncate">
                  {displayName}
                </span>
                <ChevronDown className="w-3 h-3 text-gray-400" />
              </button>

              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-xl shadow-lg z-20 py-1 overflow-hidden">
                    <div className="px-3 py-2 border-b border-gray-100">
                      <p className="text-xs font-semibold text-gray-900 truncate">{displayName}</p>
                      <p className="text-[11px] text-gray-400 truncate">{user.email}</p>
                    </div>
                    <Link href="/dashboard" onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors">
                      <LayoutDashboard className="w-3.5 h-3.5" /> Dashboard
                    </Link>
                    <Link href="/shipments/new" onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors">
                      <Package className="w-3.5 h-3.5" /> New Shipment
                    </Link>
                    <Link href="/settings" onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors">
                      <Settings className="w-3.5 h-3.5" /> Notification Settings
                    </Link>
                    <button
                      onClick={() => { setMenuOpen(false); handleSignOut(); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <LogOut className="w-3.5 h-3.5" /> Sign Out
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <Link href="/auth"
              className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors">
              <User className="w-3.5 h-3.5" /> Sign In
            </Link>
          )}
        </div>
      </div>

      <CopilotDrawer
        open={copilotOpen}
        onClose={() => setCopilotOpen(false)}
        context={copilotContext}
      />
    </nav>
  );
}
