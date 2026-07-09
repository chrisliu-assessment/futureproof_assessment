import QuoteForm from "@/components/QuoteForm";
import ChatPanel from "@/components/ChatPanel";
import { QuoteStoreProvider } from "@/lib/store";

export default function Home() {
  return (
    <QuoteStoreProvider>
      <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-8 px-4 py-10 sm:px-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Property Insurance Quote
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Enter your property details to get an instant premium estimate.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Form */}
          <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Quote form
            </h2>
            <QuoteForm />
          </section>

          {/* Chat helper — shares the same form state */}
          <ChatPanel />
        </div>
      </main>
    </QuoteStoreProvider>
  );
}
