import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-16">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="mt-3 h-12 w-80" />
      <Skeleton className="mt-3 h-4 w-full max-w-xl" />

      <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="aspect-[4/3] rounded-xl2" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl2" />
      </div>
    </main>
  );
}
