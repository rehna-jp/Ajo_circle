'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, XCircle, AlertTriangle, ExternalLink, X } from 'lucide-react'

export type ToastType = 'success' | 'error' | 'warning'

export interface ToastData {
  id: string
  type: ToastType
  title: string
  message?: string
  txHash?: string
}

// ─── Single Toast ─────────────────────────────────────────────────────────────

function Toast({ toast, onClose }: { toast: ToastData; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 6000)
    return () => clearTimeout(t)
  }, [onClose])

  const styles = {
    success: {
      bg: 'bg-[#a8dcd9]/15 border-[#a8dcd9]/40',
      icon: <CheckCircle2 className="h-5 w-5 text-[#a8dcd9]" />,
      title: 'text-[#60435f]',
    },
    error: {
      bg: 'bg-[#944654]/10 border-[#944654]/30',
      icon: <XCircle className="h-5 w-5 text-[#944654]" />,
      title: 'text-[#944654]',
    },
    warning: {
      bg: 'bg-[#e2a3c7]/15 border-[#e2a3c7]/40',
      icon: <AlertTriangle className="h-5 w-5 text-[#d67ab1]" />,
      title: 'text-[#60435f]',
    },
  }[toast.type]

  return (
    <div
      className={`flex w-full max-w-sm items-start gap-3 rounded-2xl border p-4 shadow-lg backdrop-blur-sm ${styles.bg} animate-in slide-in-from-right-5 fade-in duration-300`}
    >
      <div className="shrink-0 mt-0.5">{styles.icon}</div>

      <div className="flex-1 min-w-0">
        <p className={`text-sm font-bold ${styles.title}`}>{toast.title}</p>
        {toast.message && (
          <p className="mt-0.5 text-xs text-gray-500 leading-snug">{toast.message}</p>
        )}
        {toast.txHash && (
          <a
            href={`https://celoscan.io/tx/${toast.txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-[#d67ab1] hover:text-[#60435f] transition"
          >
            View on CeloScan
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>

      <button
        onClick={onClose}
        className="shrink-0 rounded-lg p-1 text-gray-400 hover:text-gray-600 hover:bg-black/5 transition"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

// ─── Toast Container ──────────────────────────────────────────────────────────

let _addToast: ((t: Omit<ToastData, 'id'>) => void) | null = null

/** Call this anywhere to show a toast. */
export function toast(data: Omit<ToastData, 'id'>) {
  _addToast?.(data)
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastData[]>([])

  useEffect(() => {
    _addToast = (data) => {
      const id = Math.random().toString(36).slice(2)
      setToasts((prev) => [...prev, { id, ...data }])
    }
    return () => { _addToast = null }
  }, [])

  const remove = (id: string) =>
    setToasts((prev) => prev.filter((t) => t.id !== id))

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-6 right-4 z-[100] flex flex-col gap-2 sm:right-6">
      {toasts.map((t) => (
        <Toast key={t.id} toast={t} onClose={() => remove(t.id)} />
      ))}
    </div>
  )
}
