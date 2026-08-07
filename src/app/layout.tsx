import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from '@/components/providers';
import { BRAND } from '@/lib/constants';

export const metadata: Metadata = {
  title: {
    default: `${BRAND.nameEn} — ${BRAND.productName}`,
    template: `%s | ${BRAND.nameEn}`,
  },
  description:
    'منصة Top Academy الذكية لإدارة التغذية الرياضية للسباحين: حساب الاحتياجات الغذائية، خطط غذائية مخصصة، تحليل الوجبات بالكاميرا، ومتابعة يومية شاملة.',
  keywords: ['تغذية', 'سباحة', 'رياضي', 'خطط غذائية', 'Top Academy', 'تغذية سباحين'],
  authors: [{ name: BRAND.doctor }],
  openGraph: {
    title: `${BRAND.nameEn} — ${BRAND.productName}`,
    description: 'خطط تغذية ذكية مبنية على العلم لرفع أداء السباح',
    type: 'website',
    locale: 'ar_EG',
  },
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Top Academy' },
};

export const viewport: Viewport = {
  themeColor: '#0a2438',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700;800;900&display=swap"
          rel="stylesheet"
        />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body className="flex min-h-screen flex-col">
        <Providers>{children}</Providers>
        <script
          dangerouslySetInnerHTML={{
            __html: `
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw.js').catch(() => {});
              });
            }
            `,
          }}
        />
      </body>
    </html>
  );
}
