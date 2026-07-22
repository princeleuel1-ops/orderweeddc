import './globals.css';
import {
  PUBLIC_PRODUCT_DESCRIPTION,
  PUBLIC_PRODUCT_NAME,
} from '@/lib/product-brand';

export const metadata = {
  title: PUBLIC_PRODUCT_NAME,
  description: PUBLIC_PRODUCT_DESCRIPTION,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-brand-background text-brand-text min-h-screen flex flex-col font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
