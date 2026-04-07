"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, LogOut, LayoutDashboard } from "lucide-react";
import type { User } from "@supabase/supabase-js";

export function LandingHeader() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    import("@/app/lib/supabase/client").then(({ createClient }) => {
      const supabase = createClient();
      supabase.auth.getUser().then(({ data }) => {
        setUser(data.user);
        setReady(true);
      });
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        (_event, session) => setUser(session?.user ?? null),
      );
      return () => subscription.unsubscribe();
    });
  }, []);

  async function handleSignOut() {
    const { createClient } = await import("@/app/lib/supabase/client");
    await createClient().auth.signOut();
    router.refresh();
  }

  // Avoid flash: render nothing until auth state is known
  if (!ready) return <div className="w-40 h-8" />;

  if (user) {
    return (
      <div className="flex items-center gap-2">
        <Link
          href="/dashboard"
          className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 font-medium px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <LayoutDashboard className="w-3.5 h-3.5" />
          Dashboard
        </Link>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-1.5 border border-gray-200 hover:border-red-300 hover:bg-red-50 text-gray-600 hover:text-red-600 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          Logout
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <Link
        href="/auth"
        className="text-sm text-gray-500 hover:text-gray-900 transition-colors font-medium"
      >
        Sign In
      </Link>
      <Link
        href="/estimate"
        className="flex items-center gap-1.5 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold px-4 py-1.5 rounded-lg transition-colors shadow-sm"
      >
        Try Free <ArrowRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  );
}
