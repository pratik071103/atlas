import { DashboardSkeleton } from "./DashboardSkeleton";

// Shown while the route chunk streams in, before DashboardClient's own
// data-loading skeleton takes over — same geometry, so the two are seamless.
export default function Loading() {
  return <DashboardSkeleton />;
}
