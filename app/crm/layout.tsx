import { Inter } from 'next/font/google'
import { CrmProvider } from '@/components/crm/CrmProvider'

const inter = Inter({
  subsets:  ['latin', 'cyrillic'],
  variable: '--font-inter',
  display:  'swap',
})

export default function CrmRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <CrmProvider>
      <div className={`${inter.variable} font-inter`}>
        {children}
      </div>
    </CrmProvider>
  )
}