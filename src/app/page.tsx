import Link from "next/link";

export default function Home() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center gap-8 p-8">
      <h1 className="text-3xl font-bold">Life in the UK — Practice</h1>
      <p className="text-black/60 dark:text-white/50 max-w-md text-center">
        Practice by topic, take a full randomised mock test, or check your progress
        across sessions.
      </p>
      <div className="flex flex-col gap-4 w-full max-w-xs">
        <Link
          href="/practice"
          className="rounded-md border border-black/15 dark:border-white/20 px-4 py-3 text-center hover:border-black/30 dark:hover:border-white/40"
        >
          Practice by topic
        </Link>
        <Link
          href="/test"
          className="rounded-md bg-blue-600 text-white px-4 py-3 text-center"
        >
          Take a mock test
        </Link>
        <Link
          href="/progress"
          className="rounded-md border border-black/15 dark:border-white/20 px-4 py-3 text-center hover:border-black/30 dark:hover:border-white/40"
        >
          My progress
        </Link>
      </div>
    </main>
  );
}
