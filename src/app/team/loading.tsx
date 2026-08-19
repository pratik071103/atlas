import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 space-y-6">
      <Skeleton className="h-3 w-16" />
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-9 w-52" />
          <Skeleton className="h-3 w-32" />
        </div>
        <Skeleton className="h-9 w-32 rounded-xl" />
      </div>
      <Skeleton className="h-20 rounded-xl" />
      <Skeleton className="h-48 rounded-xl" />
      <Skeleton className="h-40 rounded-xl" />
    </main>
  );
}
