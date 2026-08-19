"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Users, User, Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { api, type TeamRow } from "@/lib/api";

interface TeamSwitcherProps {
  className?: string;
}

type Context = "personal" | "team";

/**
 * Switch Account dropdown.
 *
 * Shows the active context (Personal or Team) in the navbar. When the user
 * picks the other context, we store the choice in localStorage and reload so
 * every server component re-reads from the updated session context.
 *
 * The actual credit-meter and billing state already reads from the user's own
 * wallet — switching to "team" just applies a badge and links /team in the nav.
 */
export function TeamSwitcher({ className }: TeamSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [context, setContext] = useState<Context>("personal");
  const [team, setTeam] = useState<TeamRow | null>(null);
  const [memberTeam, setMemberTeam] = useState<TeamRow | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Load team membership on mount.
  useEffect(() => {
    api
      .getTeam()
      .then(({ owned, memberOf }) => {
        if (owned) setTeam(owned.team);
        if (memberOf) setMemberTeam(memberOf.team);

        // Restore last selected context from localStorage.
        const saved = typeof window !== "undefined" ? localStorage.getItem("atlas-team-ctx") : null;
        if (saved === "team" && (owned || memberOf)) setContext("team");
      })
      .catch(() => {
        /* not a team member — no-op */
      });
  }, []);

  // Close on outside click.
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const activeTeam = team ?? memberTeam;

  // Don't render anything if the user has no team affiliation at all.
  if (!activeTeam) return null;

  function switchTo(next: Context) {
    setContext(next);
    setOpen(false);
    if (typeof window !== "undefined") localStorage.setItem("atlas-team-ctx", next);
    if (next === "team") router.push("/team");
    else router.push("/dashboard");
  }

  const isTeamContext = context === "team";

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        id="team-switcher-btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all",
          isTeamContext
            ? "border-lavender-300 bg-lavender-50 text-lavender-700 hover:bg-lavender-100"
            : "border-ink-200 bg-white text-ink-700 hover:bg-ink-50"
        )}
      >
        {isTeamContext ? (
          <Users size={12} className="shrink-0" />
        ) : (
          <User size={12} className="shrink-0" />
        )}
        <span className="max-w-[96px] truncate">
          {isTeamContext ? activeTeam.name : "Personal"}
        </span>
        <ChevronDown
          size={11}
          className={cn("shrink-0 transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute right-0 top-full z-50 mt-1.5 w-52 overflow-hidden rounded-xl border border-ink-200 bg-white shadow-lg"
        >
          <p className="px-3 pt-2.5 pb-1 text-[10px] font-semibold uppercase tracking-widest text-ink-400">
            Switch context
          </p>

          {/* Personal */}
          <button
            role="option"
            aria-selected={context === "personal"}
            onClick={() => switchTo("personal")}
            className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm hover:bg-ink-50"
          >
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-ink-100">
              <User size={12} />
            </span>
            <span className="flex-1 font-medium text-ink-900">Personal</span>
            {context === "personal" && <Check size={13} className="text-lime-600" />}
          </button>

          {/* Team */}
          <button
            role="option"
            aria-selected={context === "team"}
            onClick={() => switchTo("team")}
            className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm hover:bg-lavender-50"
          >
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-lavender-100">
              <Users size={12} className="text-lavender-700" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="truncate font-medium text-ink-900">{activeTeam.name}</p>
              <p className="text-[11px] text-ink-400">
                {team ? "Owner" : "Member"} · {activeTeam.seatCount} seat{activeTeam.seatCount !== 1 ? "s" : ""}
              </p>
            </div>
            {context === "team" && <Check size={13} className="text-lavender-600" />}
          </button>

        </div>
      )}
    </div>
  );
}
