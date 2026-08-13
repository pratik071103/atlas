import { Suspense } from "react";
import { DashboardClient } from "./DashboardClient";
import { DashboardSkeleton } from "./DashboardSkeleton";

// The dashboard reads ?checkout=<purchaseId> — the return_url Dodo sends the
// customer back to — so it needs a Suspense boundary around useSearchParams
// for the shell to still prerender.
export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardClient />
    </Suspense>
  );
}
