import { FormEvent, useState } from "react";
import { Bot, Send, ImagePlus, Minus, Plus } from "lucide-react";
import { api } from "../lib/api";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { Badge } from "./ui/Badge";
import { Input } from "./ui/Input";

interface Message {
  role: "bot" | "user";
  text: string;
}

interface Props {
  balance: number;
  onBalanceChange: (balance: number) => void;
}

const COMMAND_PATTERN = /^(debit|credit)\s+(\d+(?:\.\d+)?)$/i;

export function CreditPromptBar({ balance, onBalanceChange }: Props) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "bot",
      text: 'This prompt bar only understands two commands: "debit <amount>" and "credit <amount>". Try "debit 5".',
    },
  ]);
  const [input, setInput] = useState("");
  const [genCount, setGenCount] = useState(1);
  const [busy, setBusy] = useState(false);

  async function applyDelta(delta: number, reason: string, echo: string) {
    setMessages((m) => [...m, { role: "user", text: echo }]);
    setBusy(true);
    try {
      const { creditBalance } = await api.adjustCredits(delta, reason);
      onBalanceChange(creditBalance);
      setMessages((m) => [
        ...m,
        {
          role: "bot",
          text:
            delta > 0
              ? `Credited ${delta}. New balance: ${creditBalance}.`
              : `Debited ${Math.abs(delta)}. New balance: ${creditBalance}.`,
        },
      ]);
    } catch (e) {
      setMessages((m) => [...m, { role: "bot", text: (e as Error).message }]);
    } finally {
      setBusy(false);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;
    const match = trimmed.match(COMMAND_PATTERN);
    setInput("");

    if (!match) {
      setMessages((m) => [
        ...m,
        { role: "user", text: trimmed },
        { role: "bot", text: 'Only "debit <amount>" or "credit <amount>" are understood.' },
      ]);
      return;
    }

    const [, action, amountStr] = match;
    const amount = Number(amountStr);
    const delta = action.toLowerCase() === "credit" ? amount : -amount;
    await applyDelta(delta, `Prompt bar: ${trimmed}`, trimmed);
  }

  async function generateImages() {
    if (genCount < 1) return;
    await applyDelta(-genCount, `Generated ${genCount} image${genCount === 1 ? "" : "s"}`, `Gen ${genCount} image${genCount === 1 ? "" : "s"}`);
  }

  return (
    <Card className="flex flex-col h-full">
      <div className="flex items-center gap-2 border-b border-ink-100 px-4 py-3">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-ink-900 text-lime-300">
          <Bot size={14} />
        </span>
        <div>
          <p className="text-sm font-bold text-ink-900">Credit prompt bar</p>
          <p className="text-xs text-ink-600">Demo only — debit / credit / amount</p>
        </div>
        <Badge className="ml-auto">{balance} credits</Badge>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5 max-h-56 min-h-56">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
              m.role === "bot" ? "bg-lime-50 text-ink-900" : "ml-auto bg-ink-900 text-white"
            }`}
          >
            {m.text}
          </div>
        ))}
      </div>

      <div className="border-t border-ink-100 px-4 py-3 space-y-3">
        <form onSubmit={submit} className="flex items-center gap-2">
          <Input
            shape="pill"
            value={input}
            disabled={busy}
            onChange={setInput}
            placeholder="debit 5  ·  credit 10"
            className="flex-1"
          />
          <Button variant="dark" type="submit" disabled={busy} className="px-3 py-2">
            <Send size={15} />
          </Button>
        </form>

        <div className="flex items-center gap-2 rounded-full border border-ink-200 pl-1.5 pr-2 py-1.5">
          <ImagePlus size={16} className="text-lime-700 ml-1.5 shrink-0" />
          <div className="ml-auto flex items-center gap-1.5">
            <button
              type="button"
              disabled={busy}
              onClick={() => setGenCount((n) => Math.max(1, n - 1))}
              className="grid h-6 w-6 place-items-center rounded-full border border-ink-200 text-ink-600 hover:border-ink-800"
            >
              <Minus size={12} />
            </button>
            <span className="w-5 text-center text-sm font-semibold text-ink-900">{genCount}</span>
            <button
              type="button"
              disabled={busy}
              onClick={() => setGenCount((n) => n + 1)}
              className="grid h-6 w-6 place-items-center rounded-full border border-ink-200 text-ink-600 hover:border-ink-800"
            >
              <Plus size={12} />
            </button>
          </div>
          <Button
            disabled={busy || genCount > balance}
            onClick={generateImages}
            className="px-3 py-1.5 text-xs shrink-0"
          >
            Gen {genCount} image{genCount === 1 ? "" : "s"}
          </Button>
        </div>
      </div>
    </Card>
  );
}
