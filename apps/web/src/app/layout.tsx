import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CRM OS — Modular Business Platform',
  description: 'Composable CRM + ERP + POS for modern businesses',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
