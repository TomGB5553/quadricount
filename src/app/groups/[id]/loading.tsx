export default function Loading() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-5 p-5">
      <div className="h-6 w-40 animate-pulse rounded-lg bg-surface-2" />
      <div className="h-24 animate-pulse rounded-2xl bg-surface-2" />
      <div className="flex gap-2">
        <div className="h-11 flex-1 animate-pulse rounded-xl bg-surface-2" />
        <div className="h-11 flex-1 animate-pulse rounded-xl bg-surface-2" />
      </div>
      <div className="h-10 animate-pulse rounded-xl bg-surface-2" />
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-14 animate-pulse rounded-xl bg-surface-2"
        />
      ))}
    </main>
  );
}
