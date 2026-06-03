'use client'

import { useState } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { useReadContract } from 'wagmi'
import { ConnectWallet } from '@/components/ConnectWallet'
import { CircleCard } from '@/components/CircleCard'
import { CreateCircleModal } from '@/components/CreateCircleModal'
import { AJO_CIRCLE_ABI, AJO_FACTORY_ADDRESS } from '@/lib/contracts'

export default function Home() {
  const { authenticated } = usePrivy()
  const [showCreate, setShowCreate] = useState(false)

  const { data: circleCount, refetch } = useReadContract({
    address: AJO_FACTORY_ADDRESS,
    abi: AJO_CIRCLE_ABI,
    functionName: 'circleCount',
  })

  const count = Number(circleCount ?? 0n)
  const circleIds = Array.from({ length: count }, (_, i) => BigInt(i)).reverse()

  return (
    <>
      {/* ── Nav ──────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-gray-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-black tracking-tight text-gray-900">Ajo</span>
            <span className="rounded-full bg-celo-green px-2 py-0.5 text-xs font-bold text-white">
              G$
            </span>
          </div>
          <ConnectWallet />
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-20">
        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <section className="py-16 text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-hero-gradient shadow-lg">
            <span className="text-4xl">🤝</span>
          </div>
          <h1 className="mb-4 text-4xl font-black tracking-tight text-gray-900 sm:text-5xl">
            Save Together,{' '}
            <span className="bg-hero-gradient bg-clip-text text-transparent">Win Together</span>
          </h1>
          <p className="mx-auto mb-8 max-w-lg text-lg text-gray-600">
            Ajo is a decentralised rotating savings circle on Celo. Pool G$ with friends, family,
            or community — everyone wins, one round at a time.
          </p>

          {authenticated ? (
            <button
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-2 rounded-full bg-celo-green px-7 py-3 text-base font-bold text-white shadow-md transition hover:opacity-90 active:scale-95"
            >
              <span>+</span> Create a Circle
            </button>
          ) : (
            <p className="text-sm text-gray-500">Connect your wallet to create or join a circle.</p>
          )}
        </section>

        {/* ── How it works ─────────────────────────────────────────────────── */}
        <section className="mb-16 grid gap-4 sm:grid-cols-3">
          {[
            { icon: '➕', title: 'Create', desc: 'Set a G$ amount, member limit, and round duration.' },
            { icon: '👥', title: 'Join', desc: 'Invite friends and family to fill the seats.' },
            { icon: '💸', title: 'Receive', desc: 'Every round one member gets the full pot, rotating until all win.' },
          ].map((step) => (
            <div
              key={step.title}
              className="flex flex-col items-center rounded-2xl border border-gray-100 bg-white p-6 text-center shadow-sm"
            >
              <span className="mb-3 text-3xl">{step.icon}</span>
              <h3 className="mb-1 font-bold text-gray-900">{step.title}</h3>
              <p className="text-sm text-gray-600">{step.desc}</p>
            </div>
          ))}
        </section>

        {/* ── Circles list ─────────────────────────────────────────────────── */}
        <section>
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">
              All Circles{count > 0 ? ` (${count})` : ''}
            </h2>
            {authenticated && (
              <button
                onClick={() => setShowCreate(true)}
                className="rounded-full border border-celo-green px-4 py-1.5 text-sm font-semibold text-celo-green transition hover:bg-celo-mist"
              >
                + New
              </button>
            )}
          </div>

          {count === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-gray-200 py-20 text-center">
              <span className="text-4xl">🌱</span>
              <p className="font-medium text-gray-500">No circles yet. Be the first to start one!</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {circleIds.map((id) => (
                <CircleCard key={id.toString()} circleId={id} />
              ))}
            </div>
          )}
        </section>
      </main>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="border-t border-gray-100 py-6 text-center text-xs text-gray-400">
        Built on{' '}
        <a
          href="https://celo.org"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-celo-green hover:underline"
        >
          Celo Alfajores
        </a>{' '}
        · Powered by G$ (GoodDollar) · Chain ID 44787
      </footer>

      {/* ── Modal ────────────────────────────────────────────────────────── */}
      {showCreate && (
        <CreateCircleModal
          onClose={() => setShowCreate(false)}
          onSuccess={() => {
            setShowCreate(false)
            refetch()
          }}
        />
      )}
    </>
  )
}
