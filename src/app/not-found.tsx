import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Home, Search } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted text-4xl">
            404
          </div>
          <CardTitle className="text-2xl">Halaman Tidak Ditemukan</CardTitle>
          <CardDescription>
            Maaf, halaman yang Anda cari tidak ditemukan atau telah dipindahkan.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild className="flex-1">
              <Link href="/">
                <Home className="mr-2 h-4 w-4 text-primary" />
                Kembali ke Beranda
              </Link>
            </Button>
            <Button asChild variant="outline" className="flex-1">
              <Link href="/dashboard">
                <Search className="mr-2 h-4 w-4 text-primary" />
                Ke Dashboard
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
