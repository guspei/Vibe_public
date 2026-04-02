import type { Metadata, Viewport } from 'next';
import ThemeRegistry from '@/components/providers/ThemeRegistry';
import SnackbarProvider from '@/components/providers/SnackbarProvider';
import MainLayout from '@/components/layout/MainLayout';

export const metadata: Metadata = {
  title: 'Tools',
  description: 'PDF Editor & GIF Maker - Free, private, runs in your browser',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <ThemeRegistry>
          <SnackbarProvider>
            <MainLayout>{children}</MainLayout>
          </SnackbarProvider>
        </ThemeRegistry>
      </body>
    </html>
  );
}
