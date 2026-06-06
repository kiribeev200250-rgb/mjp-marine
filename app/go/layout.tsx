import type { Metadata } from 'next';
import Script from 'next/script';
import { prisma } from '@/lib/prisma';

export async function generateMetadata(): Promise<Metadata> {
  try {
    const config = await prisma.presiteConfig.findUnique({ where: { id: 1 } });
    return {
      title: config?.pageTitle ?? 'MJP Marine Service',
      description: config?.taglineEn ?? 'Mobile Yacht Repair · Costa Blanca',
    };
  } catch {
    return { title: 'MJP Marine Service' };
  }
}

export default function GoLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Script id="tiktok-pixel" strategy="afterInteractive">
        {`!function (w, d, t) {
  w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for( var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js",o=n&&n.partner;ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=r,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};n=document.createElement("script") ;n.type="text/javascript",n.async=!0,n.src=r+"?sdkid="+e+"&lib="+t;e=document.getElementsByTagName("script")[0];e.parentNode.insertBefore(n,e)};
  ttq.load('D8ELOKRC77U0TBB14FR0');
  ttq.page();
  }(window, document, 'ttq');`}
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
      {children}
    </>
  );
}
