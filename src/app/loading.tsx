import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Crown } from 'lucide-react';

export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <Crown className="h-12 w-12 animate-pulse text-primary" />
        <p className="text-muted-foreground">Memuat...</p>
      </div>
    </div>
  );
}
