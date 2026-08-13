import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Mirrors the loaded dashboard's geometry exactly, so the real content drops
 * into the same boxes rather than pushing the page around when it arrives.
 */
export function DashboardSkeleton() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2.5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-3 w-48" />
        </div>
        <Skeleton className="h-12 w-52 rounded-full" />
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
        <Skeleton className="h-[26rem] rounded-xl2 lg:col-span-2" />
      </div>
    </main>
  );
}
