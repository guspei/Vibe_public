'use client';

import { SnackbarProvider as NotistackProvider } from 'notistack';

export default function SnackbarProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <NotistackProvider
      maxSnack={3}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      autoHideDuration={6000}
    >
      {children}
    </NotistackProvider>
  );
}
