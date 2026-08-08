interface Props {
  value: "monthly" | "yearly";
  onChange: (v: "monthly" | "yearly") => void;
}

export function PricingToggle({ value, onChange }: Props) {
  const isYearly = value === "yearly";
  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-ink-200 bg-white p-1">
      <button
        onClick={() => onChange("monthly")}
        className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
          !isYearly ? "bg-ink-900 text-white" : "text-ink-600 hover:text-ink-900"
        }`}
      >
        Monthly
      </button>
      <button
        onClick={() => onChange("yearly")}
        className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
          isYearly ? "bg-ink-900 text-white" : "text-ink-600 hover:text-ink-900"
        }`}
      >
        Yearly
        <span className={`pill ${isYearly ? "bg-lime-400 text-ink-900" : "bg-lime-100 text-lime-800"}`}>
          Save 20%
        </span>
      </button>
    </div>
  );
}
