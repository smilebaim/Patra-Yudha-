'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { logError } from '@/lib/errorHandler';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to error reporting service
    logError(error, { context: 'ApplicationError', digest: error.digest });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Terjadi Kesalahan</CardTitle>
          <CardDescription>
            Maaf, terjadi kesalahan yang tidak terduga. Silakan coba lagi.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {process.env.NODE_ENV === 'development' && (
            <div className="rounded-md bg-muted p-4">
              <p className="text-sm font-mono text-destructive">
                {error.message}
              </p>
              {error.digest && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Error ID: {error.digest}
                </p>
              )}
            </div>
          )}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button onClick={reset} className="flex-1">
              Coba Lagi
            </Button>
            <Button asChild variant="outline" className="flex-1">
              <Link href="/">Kembali ke Beranda</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
