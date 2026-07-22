import type { Metadata } from 'next';
import { PUBLIC_PRODUCT_NAME } from '@/lib/product-brand';

export const metadata: Metadata = {
  title: `${PUBLIC_PRODUCT_NAME} Administrator`,
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
