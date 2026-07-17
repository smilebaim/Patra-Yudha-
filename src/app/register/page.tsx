'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Crown, Eye, EyeOff } from 'lucide-react';
import { ModeToggle } from '@/components/theme-toggle';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { getFirebaseErrorMessage, logError } from '@/lib/errorHandler';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp, collection, getDocs, query, limit } from 'firebase/firestore';
import { useAuth } from '@/firebase/auth/auth-context';
import { useFirestore } from '@/firebase/firestore/firestore-context';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export default function RegisterPage() {
  const [isRegistering, setIsRegistering] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();
  const { auth } = useAuth();
  const { db } = useFirestore();

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!auth || !db) {
        toast({ title: "Layanan tidak tersedia", description: "Gagal menghubungkan ke layanan autentikasi.", variant: "destructive" });
        return;
    }
    
    setIsRegistering(true);
    
    const formData = new FormData(e.currentTarget);
    const email = (formData.get('email') as string).trim();
    const password = formData.get('password') as string;

    if (password.length < 6) {
        toast({ title: "Sandi Terlalu Pendek", description: "Minimal 6 karakter diperlukan untuk keamanan Bangsawan.", variant: "destructive" });
        setIsRegistering(false);
        return;
    }

    if (password === email) {
        toast({
            title: "Kata Sandi Tidak Aman",
            description: "Kata sandi tidak boleh sama dengan alamat email Anda.",
            variant: "destructive"
        });
        setIsRegistering(false);
        return;
    }

    try {
        let isFirstUser = true;
        try {
            const usersCollectionRef = collection(db, 'users');
            const firstUserQuery = query(usersCollectionRef, limit(1));
            const existingUsersSnapshot = await getDocs(firstUserQuery);
            isFirstUser = existingUsersSnapshot.empty;
        } catch (dbError: any) {
            logError(dbError);
            toast({
                title: "Koneksi Basis Data Gagal",
                description: "Pastikan basis data Anda sudah aktif di konsol Firebase.",
                variant: "destructive"
            });
            setIsRegistering(false);
            return;
        }

        const userRole = isFirstUser ? 'admin' : 'user';
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        const userDocRef = doc(db, 'users', user.uid);
        const initialProfile = {
            uid: user.uid,
            email,
            role: userRole,
            status: 'active',
            onboardingComplete: false,
            createdAt: serverTimestamp(),
            lastSeen: serverTimestamp(),
        };

        setDoc(userDocRef, initialProfile)
            .catch(async (serverError) => {
                errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: userDocRef.path,
                    operation: 'create',
                    requestResourceData: initialProfile
                }));
            });

        toast({ 
          title: isFirstUser ? "Admin Pertama Terdaftar!" : "Pendaftaran Berhasil!", 
          description: isFirstUser 
            ? "Anda otomatis menjadi Administrator. Silakan lanjutkan pengukuhan wibawa." 
            : "Akun Anda telah dibuat. Mari tentukan identitas Bangsawan Anda." 
        });

    } catch (error: any) {
        logError(error, { context: 'Client-side registration' });
        toast({
            title: "Kesalahan Pendaftaran",
            description: getFirebaseErrorMessage(error),
            variant: "destructive",
        });
    } finally {
        setIsRegistering(false);
    }
  };


  return (
    <div className="relative flex items-center justify-center min-h-screen bg-background p-4">
        <div className="absolute top-4 right-4 z-50">
            <ModeToggle />
        </div>
        
        <div className="w-full max-w-md animate-in fade-in zoom-in-95 duration-500">
          <Card className="glass-card border-white/5 overflow-hidden shadow-2xl relative">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
              <CardHeader className="pt-10 pb-6 text-center">
                  <div className="flex justify-center mb-6">
                    <Link href="/" className="flex flex-col items-center gap-2 group">
                      <Crown className="h-12 w-12 text-primary drop-shadow-[0_0_10px_rgba(234,179,8,0.5)] group-hover:scale-110 transition-transform duration-300" />
                      <span className="text-3xl font-gruppo font-bold tracking-[0.2em] text-primary uppercase">Patra Yudha</span>
                    </Link>
                  </div>
                  <CardTitle className="text-xl font-poiret-one tracking-widest uppercase">Daftar Bangsawan Baru</CardTitle>
                  <CardDescription className="text-[10px] uppercase tracking-tighter opacity-50">
                      Gunakan email aktif Anda. Pendaftar pertama akan mengemban amanah sebagai Administrator dunia.
                  </CardDescription>
              </CardHeader>
              <CardContent className="px-8 pb-10">
                    <form onSubmit={handleRegister} className="space-y-5">
                        <div className="space-y-2">
                            <Label htmlFor="email">Identitas Email</Label>
                            <Input id="email" name="email" type="email" placeholder="nobility@patrayudha.com" required disabled={isRegistering} className="bg-white/5 border-white/10 h-11" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password">Kata Sandi</Label>
                            <div className="relative">
                                <Input id="password" name="password" type={showPassword ? 'text' : 'password'} required disabled={isRegistering} className="bg-white/5 border-white/10 h-11" />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-primary/40 hover:text-primary"
                                    onClick={() => setShowPassword(!showPassword)}
                                >
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    <span className="sr-only">Toggle visibility</span>
                                </Button>
                            </div>
                        </div>
                        
                        <Button type="submit" className="w-full btn-3d bg-primary text-primary-foreground font-bold uppercase tracking-[0.3em] h-12 mt-4" disabled={isRegistering}>
                            {isRegistering ? 'MENGKUKUHKAN DATA...' : 'DAFTAR AKUN'}
                        </Button>
                    </form>

                  <div className="mt-8 text-center text-[10px] uppercase font-bold tracking-widest">
                      <span className="opacity-40">Sudah memiliki wibawa?</span>{" "}
                      <Link href="/login" className="text-primary hover:underline underline-offset-4">
                          Masuk Disini
                      </Link>
                  </div>
                  <div className="mt-4 text-center">
                    <Link href="/" className="text-[9px] uppercase font-bold opacity-30 hover:opacity-100 transition-opacity">
                      Kembali ke Gerbang Utama
                    </Link>
                  </div>
              </CardContent>
          </Card>
        </div>
    </div>
  );
}
