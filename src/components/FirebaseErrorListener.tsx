'use client';

import { useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

/**
 * Komponen listener yang menangkap kesalahan izin dari emitter
 * dan melemparkannya kembali agar tertangkap oleh error boundary Next.js.
 */
export function FirebaseErrorListener() {
  useEffect(() => {
    const handleError = (error: FirestorePermissionError) => {
      // Melemparkan kesalahan agar tertangkap oleh Next.js development overlay
      throw error;
    };

    errorEmitter.on('permission-error', handleError);
    return () => {
      errorEmitter.off('permission-error', handleError);
    };
  }, []);

  return null;
}
