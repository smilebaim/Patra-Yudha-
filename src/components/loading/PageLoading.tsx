'use client';

import { Crown } from "lucide-react";

interface PageLoadingProps {
    message?: string;
}

export function PageLoading({ message = "Memuat..." }: PageLoadingProps) {
    return (
        <div className="flex min-h-screen items-center justify-center bg-background">
            <div className="flex flex-col items-center gap-4">
                <Crown className="h-12 w-12 animate-pulse text-primary" />
                <p className="text-muted-foreground">{message}</p>
            </div>
        </div>
    );
}
