import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
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
    icon: '/icons/icon-192.png',
    apple: '/icons/icon-192.png',
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
    <html lang="ko" suppressHydrationWarning>
      <head>
        {process.env.NEXT_PUBLIC_KAKAO_MAP_KEY && (
          <script
            src={`//dapi.kakao.com/v2/maps/sdk.js?appkey=${process.env.NEXT_PUBLIC_KAKAO_MAP_KEY}&autoload=false`}
            async
          />
        )}
      </head>
      <body className={`${inter.className} antialiased bg-slate-50 dark:bg-slate-950`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
