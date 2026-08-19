import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-ink-50 to-lavender-50 px-4 py-12">
      <div className="max-w-md w-full space-y-5">
        <Skeleton className="h-44 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    </main>
  );
}
