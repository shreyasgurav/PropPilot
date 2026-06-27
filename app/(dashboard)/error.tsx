"use client";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-xl border border-red-200 bg-white p-8 shadow-sm text-center">
        <div className="text-4xl mb-4">⚠️</div>
        <h1 className="text-lg font-semibold text-slate-900">Dashboard failed to load</h1>
        <p className="mt-2 text-sm text-slate-500">
          Something went wrong on the server. Check the debug endpoint for details.
        </p>

        {/* Show error message in development */}
        {process.env.NODE_ENV !== "production" && (
          <pre className="mt-4 rounded bg-red-50 border border-red-200 p-3 text-left text-xs text-red-700 overflow-auto">
            {error.message}
            {error.digest ? `\n\nDigest: ${error.digest}` : ""}
          </pre>
        )}

        <div className="mt-6 flex flex-col gap-3">
          <button
            onClick={reset}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            Try again
          </button>
          <a
            href="/api/debug"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Open debug report →
          </a>
        </div>

        {error.digest && (
          <p className="mt-4 text-xs text-slate-400">
            Error digest: <code>{error.digest}</code>
          </p>
        )}
      </div>
    </div>
  );
}
