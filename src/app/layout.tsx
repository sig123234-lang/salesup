import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import Script from 'next/script'
import './globals.css'
import Providers from './providers'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'SalesUp - AI 영업 플랫폼',
  description: '영업을 기억하는 AI 파트너. 자동 기록, AI 분석, 재방문 추천까지.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'SalesUp',
  },
  icons: {
    icon: '/favicon.ico',
    apple: '/favicon.ico',
  },
}

export const viewport: Viewport = {
  themeColor: '#3b82f6',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko" suppressHydrationWarning data-scroll-behavior="smooth">
      <body className={`${inter.className} antialiased bg-slate-50 dark:bg-slate-950`}>
        {process.env.NEXT_PUBLIC_KAKAO_MAP_KEY && (
          <Script
            src={`https://dapi.kakao.com/v2/maps/sdk.js?appkey=${process.env.NEXT_PUBLIC_KAKAO_MAP_KEY}&autoload=false`}
            strategy="beforeInteractive"
          />
        )}
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
