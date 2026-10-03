import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-6xl px-6 pb-24 pt-16 md:pt-24">
      <Skeleton className="-mt-10 h-24 w-72 sm:-mt-14 md:-mt-16 md:h-36" />
      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3 w-52" />
          </div>
        </div>
        <Skeleton className="h-[38px] w-44 rounded-full" />
      </div>
      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-72 rounded-xl2" />
        ))}
      </div>
    </main>
  );
}
