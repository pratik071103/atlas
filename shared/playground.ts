// ---------------------------------------------------------------------------
// The dashboard playground's actions.
//
// Shared rather than defined in the component because the credit cost is
// authoritative: the spend route looks the action up by id and charges *this*
// number, so a crafted request cannot render in HD for one credit.
//
// `eventName` is what gets ingested to Dodo — match these to the meters you
// configure in the dashboard for the usage-based product.
// ---------------------------------------------------------------------------

/** Named here rather than imported, so this file stays free of UI deps. */
export type PlaygroundIcon = "image" | "sparkles" | "activity";

export interface PlaygroundAction {
  id: string;
  label: string;
  description: string;
  /** Credits deducted from the wallet. Zero means metered-only. */
  credits: number;
  /** Dodo meter event name. */
  eventName: string;
  icon: PlaygroundIcon;
}

export const PLAYGROUND_ACTIONS: PlaygroundAction[] = [
  {
    id: "generate-image",
    label: "Generate image",
    description: "One standard render.",
    credits: 1,
    eventName: "image_generated",
    icon: "image",
  },
  {
    id: "hd-render",
    label: "HD render",
    description: "Upscaled, slower, costs more.",
    credits: 5,
    eventName: "hd_render",
    icon: "sparkles",
  },
  {
    id: "api-call",
    label: "API call",
    description: "Metered only — reported to Dodo, no credits spent.",
    credits: 0,
    eventName: "api.call",
    icon: "activity",
  },
];

export function findPlaygroundAction(id: string): PlaygroundAction | undefined {
  return PLAYGROUND_ACTIONS.find((a) => a.id === id);
}
