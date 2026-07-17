'use client';

import { ThemeProvider } from '@/components/theme-provider';
import { AuthProvider } from '@/firebase/auth/auth-context';
import { Toaster } from '@/components/ui/toaster';
import { FirestoreProvider } from '@/firebase/firestore/firestore-context';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      forcedTheme="dark"
      disableTransitionOnChange
    >
      <FirestoreProvider>
        <AuthProvider>
          <FirebaseErrorListener />
          {children}
          <Toaster />
        </AuthProvider>
      </FirestoreProvider>
    </ThemeProvider>
  );
}
