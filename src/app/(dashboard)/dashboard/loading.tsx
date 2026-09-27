// Streamed by Next.js while page.tsx awaits getDashboardData(); mirrors its layout
// so content swaps in without a layout jump.
const bar = "rounded-md bg-foreground/10 motion-safe:animate-pulse";

export default function DashboardLoading() {
  return (
    <div className="h-full flex flex-col space-y-6 pb-6" role="status" aria-label="Loading dashboard">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className={`${bar} h-8 w-44`} />
          <div className={`${bar} h-4 w-72`} />
        </div>
        <div className={`${bar} h-9 w-40`} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="glass-panel p-5 border border-border/50">
            <div className="flex justify-between items-start mb-4">
              <div className={`${bar} h-4 w-24`} />
              <div className={`${bar} h-8 w-8 rounded-full`} />
            </div>
            <div className={`${bar} h-8 w-16`} />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4">
        <div className="glass-panel p-5 border border-border/50">
          <div className={`${bar} h-5 w-52 mb-6`} />
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 py-3">
              <div className={`${bar} h-9 w-9 rounded-full shrink-0`} />
              <div className="flex-1 space-y-2">
                <div className={`${bar} h-4 w-3/4`} />
                <div className={`${bar} h-3 w-1/3`} />
              </div>
            </div>
          ))}
        </div>

        <div className="glass-panel p-5 border border-border/50 space-y-3">
          <div className={`${bar} h-5 w-28 mb-3`} />
          {[0, 1].map((i) => (
            <div key={i} className="border border-border/50 rounded-lg p-4 space-y-2">
              <div className={`${bar} h-4 w-32`} />
              <div className={`${bar} h-3 w-full`} />
              <div className={`${bar} h-8 w-full mt-3`} />
            </div>
          ))}
        </div>
      </div>
      <span className="sr-only">Loading dashboard…</span>
    </div>
  );
}
