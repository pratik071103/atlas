import { cn } from "@/lib/cn";

interface Props {
  className?: string;
}

export function Skeleton({ className }: Props) {
  return <div className={cn("animate-pulse rounded-lg bg-ink-100", className)} />;
}
