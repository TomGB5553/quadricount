export default function Loading() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-5 p-5">
      <div className="h-8 w-40 animate-pulse rounded-lg bg-surface-2" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-16 animate-pulse rounded-2xl bg-surface-2" />
      ))}
    </main>
  );
}
