export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-[1600px] space-y-7 px-4 py-9 sm:px-7 lg:px-9" aria-label="Loading workspace">
      <div className="space-y-3"><div className="h-3 w-36 animate-pulse rounded bg-panel-raised" /><div className="h-9 w-56 animate-pulse rounded-xl bg-panel-raised" /><div className="h-4 w-80 max-w-full animate-pulse rounded bg-panel-raised" /></div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[1,2,3,4].map((item) => <div key={item} className="surface h-32 animate-pulse rounded-2xl" />)}</div>
      <div className="grid gap-4 xl:grid-cols-[1.7fr_.8fr]"><div className="surface h-[360px] animate-pulse rounded-2xl" /><div className="surface h-[360px] animate-pulse rounded-2xl" /></div>
    </main>
  );
}
