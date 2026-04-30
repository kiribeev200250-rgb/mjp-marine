'use client';

import { useState } from 'react';

export default function QrPage() {
  const [imgError, setImgError] = useState(false);

  const handleDownload = async (format: 'png' | 'svg') => {
    try {
      const res = await fetch(`/api/presite/qr?format=${format}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mjp-marine-qr.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // silently ignore
    }
  };

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #qr-print-area, #qr-print-area * { visibility: visible; }
          #qr-print-area { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); }
        }
      `}</style>

      <main className="min-h-screen flex flex-col items-center justify-center p-8"
        style={{ background: '#0A2342' }}>

        <h1 className="text-2xl font-bold text-white mb-2 font-heading text-center">
          Scan to find us
        </h1>
        <p className="text-[#C9A84C]/70 text-sm mb-8 text-center">
          mjpmarine.es/go
        </p>

        <div id="qr-print-area" className="mb-8">
          {imgError ? (
            <div className="w-64 h-64 flex items-center justify-center rounded-2xl border-2 border-[#C9A84C]/30">
              <span className="text-[#C9A84C]/50 text-sm text-center px-4">QR code unavailable</span>
            </div>
          ) : (
            <img
              src="/api/presite/qr?format=png"
              alt="QR Code"
              width={256}
              height={256}
              className="rounded-2xl"
              onError={() => setImgError(true)}
            />
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs">
          <button
            onClick={() => handleDownload('png')}
            className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-[#C9A84C]/40 text-[#C9A84C] text-sm font-medium hover:bg-[#C9A84C] hover:text-[#0A2342] hover:border-[#C9A84C] transition-all"
          >
            <DownloadIcon />
            Download PNG
          </button>
          <button
            onClick={() => handleDownload('svg')}
            className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-[#C9A84C]/40 text-[#C9A84C] text-sm font-medium hover:bg-[#C9A84C] hover:text-[#0A2342] hover:border-[#C9A84C] transition-all"
          >
            <DownloadIcon />
            Download SVG
          </button>
        </div>

        <button
          onClick={() => window.print()}
          className="mt-3 w-full max-w-xs flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-white/5 text-white/60 text-sm font-medium hover:bg-white/10 hover:text-white transition-all"
        >
          <PrintIcon />
          Print
        </button>

        <a href="/go" className="mt-8 text-white/30 text-xs hover:text-white/50 transition-colors">
          ← Back
        </a>
      </main>
    </>
  );
}

function DownloadIcon() {
  return (
    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  );
}

function PrintIcon() {
  return (
    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
    </svg>
  );
}
