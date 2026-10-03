import { Skeleton } from "@/components/ui/Skeleton";

// Mirrors the real page's layout: one big title, a caption line, a single
// 16/9 panel and the key row. The previous version still described the old
// six-card gallery with a sidebar, so the route flashed a shape that never
// arrived.
export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-6xl px-6 pb-24 pt-16 md:pt-24">
      <Skeleton className="-mt-10 h-24 w-72 sm:-mt-14 md:-mt-16 md:h-36" />
      <div className="mt-6 flex justify-end">
        <Skeleton className="h-4 w-full max-w-sm" />
      </div>
      <Skeleton className="mt-10 aspect-[16/9] w-full rounded-2xl" />
      <Skeleton className="mt-6 h-10 w-full max-w-md rounded-lg" />
    </main>
  );
}
