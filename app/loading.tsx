export default function Loading() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        {/* Shimmer logo */}
        <div className="w-12 h-12 rounded-xl bg-blue-700 flex items-center justify-center animate-pulse shadow-lg">
          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10" />
          </svg>
        </div>
        {/* Shimmer bars */}
        <div className="flex flex-col gap-2 w-48">
          <div className="h-2 bg-gray-200 rounded-full animate-pulse" />
          <div className="h-2 bg-gray-200 rounded-full animate-pulse w-3/4" />
        </div>
        <p className="text-xs text-gray-400 font-medium">Loading CargoLens…</p>
      </div>
    </div>
  );
}
