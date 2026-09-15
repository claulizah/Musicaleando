import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://musicaleando.com'),
  title: 'Musicaleando — Tu música, tu festival, tu gente',
  description:
    'Descubre tu perfil musical, comparte tu mood del día, arma squad con tus amigos y no te pierdas ningún festival cerca de ti.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
