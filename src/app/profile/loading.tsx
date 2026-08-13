import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <Skeleton className="h-3 w-20" />
      <div className="mt-4 flex items-center gap-4">
        <Skeleton className="h-16 w-16 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-3 w-40" />
        </div>
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-72 rounded-xl2" />
        ))}
      </div>
    </main>
  );
}
