import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Gerenciador Theone | Boost MMR',
  description: 'Painel do booster Theone para acompanhar pedidos de boost de MMR',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="h-full">
      <body className="min-h-full text-gray-100 antialiased">{children}</body>
    </html>
  );
}
