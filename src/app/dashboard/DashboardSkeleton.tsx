import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Mirrors the loaded dashboard's geometry exactly, so the real content drops
 * into the same boxes rather than pushing the page around when it arrives.
 */
export function DashboardSkeleton() {
  return (
    <main className="mx-auto w-full max-w-6xl px-6 pb-24 pt-16 md:pt-24">
      {/* Matches the SweptTitle block's own -mt pull-up and height, so the
          real title lands where the placeholder was. */}
      <Skeleton className="-mt-10 h-24 w-[22rem] sm:-mt-14 md:-mt-16 md:h-36" />
      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <Skeleton className="h-4 w-full max-w-sm" />
        <Skeleton className="h-[38px] w-44 rounded-full" />
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Card key={i} className="p-5">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-8 w-8" />
            </div>
            <Skeleton className="mt-3 h-8 w-28" />
            <Skeleton className="mt-2 h-3 w-32" />
          </Card>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <Skeleton className="h-44 rounded-xl2" />
          <Skeleton className="h-72 rounded-xl2" />
        </div>
        <div className="space-y-6 lg:col-span-2">
          <Skeleton className="h-64 rounded-xl2" />
          <Skeleton className="h-72 rounded-xl2" />
        </div>
      </div>
    </main>
  );
}
