import { Link, useNavigate } from "react-router-dom";
import { Sparkle } from "lucide-react";
import { useApp } from "../lib/AppContext";

export function Navbar() {
  const { identity, signOut, openAuthModal } = useApp();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-40 border-b border-ink-100 bg-white/90 backdrop-blur">
      <div className="mx-auto max-w-6xl px-6 h-[72px] flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-display text-lg font-bold text-ink-900">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-lime-400 text-ink-900">
            <Sparkle size={16} strokeWidth={2.5} />
          </span>
          Atlas Studio
        </Link>

        <nav className="hidden md:flex items-center gap-8 text-[15px] font-medium text-ink-800">
          <Link to="/" className="hover:text-ink-900">
            Home
          </Link>
          <Link to="/pricing" className="hover:text-ink-900">
            Pricing
          </Link>
          {identity && (
            <Link to="/dashboard" className="hover:text-ink-900">
              Dashboard
            </Link>
          )}
          {import.meta.env.DEV && (
            <Link to="/dev/webhooks" className="hover:text-ink-900">
              Webhooks
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-3">
          {identity ? (
            <>
              <span className="hidden sm:inline text-sm text-ink-600">
                {identity.name?.split(" ")[0] ?? "Guest"}
                {identity.kind === "guest" && (
                  <span className="pill bg-ink-100 text-ink-600 ml-2">Guest</span>
                )}
              </span>
              <button
                className="btn-secondary"
                onClick={async () => {
                  await signOut();
                  navigate("/");
                }}
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <button className="rounded-full border border-ink-200 px-5 py-2.5 text-sm font-semibold text-ink-800 hover:border-ink-800" onClick={() => openAuthModal()}>
                Login
              </button>
              <Link to="/pricing" className="btn-primary">
                Start generating
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
