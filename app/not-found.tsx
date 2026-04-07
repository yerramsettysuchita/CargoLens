import Link from "next/link";
import { Package, ArrowLeft, Search } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center mb-6">
        <Search className="w-8 h-8 text-blue-500" />
      </div>
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Page Not Found</h1>
      <p className="text-gray-500 text-sm max-w-md mb-8">
        The page or shipment you are looking for does not exist or may have been moved.
        Head back to the dashboard to pick up where you left off.
      </p>
      <div className="flex gap-3">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white font-semibold px-5 py-2.5 rounded-lg transition-colors shadow-sm text-sm"
        >
          <Package className="w-4 h-4" /> Go to Dashboard
        </Link>
        <Link
          href="/"
          className="flex items-center gap-2 border border-gray-200 hover:border-gray-300 text-gray-600 hover:text-gray-900 font-semibold px-5 py-2.5 rounded-lg transition-colors text-sm"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Home
        </Link>
      </div>
      {/* Logo */}
      <div className="mt-12 flex items-center gap-2 text-gray-400">
        <div className="w-5 h-5 rounded bg-blue-700 flex items-center justify-center">
          <Package className="w-3 h-3 text-white" />
        </div>
        <span className="text-sm font-semibold text-gray-600">CargoLens</span>
      </div>
    </div>
  );
}
