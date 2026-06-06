import type { Metadata } from 'next';
import Script from 'next/script';
import './globals.css';
import { prisma } from '@/lib/prisma';

const defaultMeta = {
  title: 'MJP Marine Service — Mobile Yacht Repair Costa Blanca',
  description: 'Mobile yacht repair & maintenance in Costa Blanca. We come to your marina. 48h response. Alicante · Dénia · Torrevieja.',
};

export async function generateMetadata(): Promise<Metadata> {
  try {
    const cfg = await prisma.siteConfig.findUnique({ where: { id: 1 } });
    return {
      title: cfg?.metaTitle ?? defaultMeta.title,
      description: cfg?.metaDesc ?? defaultMeta.description,
      openGraph: {
        title: cfg?.metaTitle ?? defaultMeta.title,
        description: cfg?.metaDesc ?? defaultMeta.description,
        type: 'website',
      },
      icons: { icon: cfg?.faviconUrl ?? '/favicon.svg' },
    };
  } catch {
    return {
      ...defaultMeta,
      openGraph: { title: defaultMeta.title, description: defaultMeta.description, type: 'website' },
      icons: { icon: '/favicon.svg' },
    };
  }
}

async function getCssVars(): Promise<string> {
  try {
    const cfg = await prisma.siteConfig.findUnique({ where: { id: 1 } });
    const primary = cfg?.colorPrimary ?? '#0A2342';
    const accent = cfg?.colorAccent ?? '#C9A84C';
    const text = cfg?.colorText ?? '#FFFFFF';
    return `:root{--color-primary:${primary};--color-accent:${accent};--color-text:${text};}`;
  } catch {
    return ':root{--color-primary:#0A2342;--color-accent:#C9A84C;--color-text:#FFFFFF;}';
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cssVars = await getCssVars();
  return (
    <html lang="en">
      <head>
        {/* eslint-disable-next-line react/no-danger */}
        <style dangerouslySetInnerHTML={{ __html: cssVars }} />
        <Script id="tiktok-pixel" strategy="afterInteractive">
          {`!function (w, d, t) {
  w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for( var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js",o=n&&n.partner;ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=r,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};n=document.createElement("script") ;n.type="text/javascript",n.async=!0,n.src=r+"?sdkid="+e+"&lib="+t;e=document.getElementsByTagName("script")[0];e.parentNode.insertBefore(n,e)};
  ttq.load('D8ELOKRC77U0TBB14FR0');
  ttq.page();
  }(window, document, 'ttq');`}
        </Script>
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-TFWFFTQNQR"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-TFWFFTQNQR');
          `}
        </Script>
        <Script id="facebook-pixel" strategy="afterInteractive">
          {`
    !function(f,b,e,v,n,t,s)
    {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};
    if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
    n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t,s)}(window, document,'script',
    'https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', '976849508564626');
    fbq('track', 'PageView');
  `}
        </Script>
      </head>
      <body>{children}</body>
    </html>
  );
}
