'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';
import { logError } from '@/lib/errorHandler';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The error logging is temporarily disabled to prevent recursive loops.
    // console.error(error);
  }, [error]);

  return (
    <html lang="id">
      <body>
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-2xl">Kesalahan Sistem</CardTitle>
              <CardDescription>
                Maaf, terjadi kesalahan sistem yang tidak terduga. Silakan refresh halaman atau coba lagi nanti.
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
              <Button onClick={reset} className="w-full">
                Coba Lagi
              </Button>
            </CardContent>
          </Card>
        </div>
      </body>
    </html>
  );
}
