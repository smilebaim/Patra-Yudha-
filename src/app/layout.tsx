
import type {Metadata, Viewport} from 'next';
import './globals.css';
import { Poppins, Poiret_One, Gruppo } from 'next/font/google';
import { Providers } from '@/lib/providers';

const fontSans = Poppins({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
  weight: ['300', '400', '500', '600', '700'],
});

const fontPoiretOne = Poiret_One({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-poiret-one',
  weight: '400',
});

const fontGruppo = Gruppo({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-gruppo',
  weight: '400',
});

export const metadata: Metadata = {
  title: {
    default: 'Patra Yudha - Game Strategi Multipemain',
    template: '%s | Patra Yudha',
  },
  description: 'Bangun kekuasaanmu, taklukkan negeri. Permainan strategi multipemain berbasis teks yang dinamis. Kelola sumber daya, latih pasukan, dan bentuk aliansi.',
  keywords: ['game strategi', 'multipemain', 'indonesia', 'permainan online', 'strategi game'],
  authors: [{ name: 'Tim Patra Yudha' }],
  creator: 'Patra Yudha',
  publisher: 'Patra Yudha',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9002'),
  openGraph: {
    type: 'website',
    locale: 'id_ID',
    url: '/',
    title: 'Patra Yudha - Game Strategi Multipemain',
    description: 'Bangun kekuasaanmu, taklukkan negeri. Permainan strategi multipemain berbasis teks yang dinamis.',
    siteName: 'Patra Yudha',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Patra Yudha - Game Strategi Multipemain',
    description: 'Bangun kekuasaanmu, taklukkan negeri. Permainan strategi multipemain berbasis teks yang dinamis.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: '/favicon.ico',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#673AB7' },
    { media: '(prefers-color-scheme: dark)', color: '#673AB7' },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning className={`${fontSans.variable} ${fontPoiretOne.variable} ${fontGruppo.variable}`}>
      <body className="font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

    