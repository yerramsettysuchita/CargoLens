"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center mb-6">
        <AlertTriangle className="w-8 h-8 text-red-500" />
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Something went wrong</h1>
      <p className="text-gray-500 text-sm max-w-sm mb-8">
        We ran into an unexpected problem loading this page. Give it another try or head back to the dashboard and continue from there.
      </p>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white font-semibold px-5 py-2.5 rounded-lg transition-colors shadow-sm text-sm"
        >
          <RefreshCw className="w-4 h-4" /> Try Again
        </button>
        <Link
          href="/dashboard"
          className="flex items-center gap-2 border border-gray-200 hover:border-gray-300 text-gray-600 font-semibold px-5 py-2.5 rounded-lg transition-colors text-sm"
        >
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}
