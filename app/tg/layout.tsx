import { Inter } from 'next/font/google'
import Script from 'next/script'
import { TgProvider } from '@/components/tg/TgProvider'

const inter = Inter({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata = {
  title: 'MJP Marine CRM',
}

export default function TgLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Script src="https://telegram.org/js/telegram-web-app.js" strategy="afterInteractive" />
      <div className={`${inter.variable} font-inter min-h-screen bg-navy-900`}>
        <TgProvider>{children}</TgProvider>
      </div>
    </>
  )
}
