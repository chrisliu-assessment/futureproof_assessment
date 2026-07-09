"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useQuoteStore } from "@/lib/store";
import {
  botReply,
  greetingMessage,
  isAffirmative,
  missingFields,
  parseMessage,
  postQuote,
} from "@/lib/chat";
import type { QuoteFormState } from "@/lib/types";

export default function ChatPanel() {
  const { state, dispatch } = useQuoteStore();
  const { form, chatMessages } = state;
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const greeted = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Rule 1: greet once on mount, listing only currently-missing fields.
  useEffect(() => {
    if (greeted.current) return;
    greeted.current = true;
    if (chatMessages.length === 0) {
      say(greetingMessage(form));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [chatMessages]);

  function say(content: string) {
    dispatch({ type: "ADD_CHAT_MESSAGE", message: { role: "assistant", content } });
  }

  async function generate(f: QuoteFormState) {
    if (f.material === "Straw") {
      say(
        "Straw buildings are uninsurable, so I can't generate a quote. Tell me a different material (Wood, Brick, or Steel) and we'll continue.",
      );
      return;
    }
    setBusy(true);
    say("Generating your quote…");
    const result = await postQuote(f);
    if (result.ok) {
      dispatch({
        type: "SET_QUOTE",
        quote: { premium: result.premium, breakdown: result.breakdown },
      });
      say(
        `Your estimated annual premium is $${result.premium.toLocaleString()}. The full breakdown is now shown in the form panel.`,
      );
    } else {
      say(result.error);
    }
    setBusy(false);
  }

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    dispatch({ type: "ADD_CHAT_MESSAGE", message: { role: "user", content: text } });

    const expecting = missingFields(form)[0] ?? null;
    const readyBefore = missingFields(form).length === 0;

    // Rule 5: everything present + user confirms → generate.
    if (readyBefore && isAffirmative(text)) {
      await generate(form);
      return;
    }

    // Rules 2–4: parse, patch shared state, re-ask only for what's missing.
    const parse = parseMessage(text, expecting);
    if (Object.keys(parse.patch).length > 0) {
      dispatch({ type: "PATCH_FORM", patch: parse.patch });
    }
    const merged: QuoteFormState = { ...form, ...parse.patch };
    say(botReply(merged, parse));
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  return (
    <section className="flex h-[560px] flex-col rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <h2 className="border-b border-zinc-200 px-6 py-4 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        Chat helper
      </h2>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {chatMessages.map((m, i) => (
          <div
            key={i}
            className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
          >
            <div
              className={
                "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm " +
                (m.role === "user"
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100")
              }
            >
              {m.content}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 border-t border-zinc-200 p-3 dark:border-zinc-800">
        <input
          type="text"
          value={input}
          disabled={busy}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Type your answer…"
          className="flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
        <button
          onClick={() => void send()}
          disabled={busy || input.trim() === ""}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          Send
        </button>
      </div>
    </section>
  );
}
