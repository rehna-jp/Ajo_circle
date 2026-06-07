import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/Providers'
import { ToastContainer } from '@/components/Toast'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
  fallback: ['system-ui', 'Arial']
})

export const metadata: Metadata = {
  title: 'Ajo Circle — G$ Savings on Celo',
  description:
    'A decentralised rotating savings circle (ROSCA) powered by GoodDollar on Celo.',
  openGraph: {
    title: 'Ajo Circle',
    description: 'Save together, win together — G$ savings circles on Celo.',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-white text-gray-900 antialiased">
        <Providers>
          {children}
          <ToastContainer />
        </Providers>
      </body>
    </html>
  )
}
