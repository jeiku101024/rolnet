export default function Home() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-6 px-4 py-10">
      <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">ROLNET Fleet</p>
      <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Keep every tricycle, driver, and peso in view.</h1>
      <p className="max-w-xl text-base leading-7 text-slate-600">A simple mobile workspace for daily remittances, expenses, maintenance, documents, and fleet history.</p>
      <div className="flex flex-col gap-3 sm:flex-row"><a className="inline-flex min-h-11 items-center justify-center rounded-md bg-slate-900 px-5 font-medium text-white" href="/login">Sign in</a><a className="inline-flex min-h-11 items-center justify-center rounded-md border border-slate-300 bg-white px-5 font-medium text-slate-900" href="/register">Staff registration</a></div>
    </div>
  );
}
