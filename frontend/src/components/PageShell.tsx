'use client'

export function PageShell({
  children,
  title,
  subtitle,
}: {
  children: React.ReactNode
  title: string
  subtitle?: string
}) {
  return (
    <main className="mx-auto max-w-6xl px-6 py-12 sm:px-8">
      <div className="mb-10 rounded-3xl border border-slate-200/70 bg-white p-8 shadow-xl shadow-slate-200/40">
        <div className="max-w-2xl">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">{title}</p>
          {subtitle ? (
            <p className="text-sm text-slate-500">{subtitle}</p>
          ) : null}
        </div>
      </div>
      {children}
    </main>
  )
}
