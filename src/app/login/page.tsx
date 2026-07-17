
'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Crown, Eye, EyeOff, Mail } from 'lucide-react';
import { ModeToggle } from '@/components/theme-toggle';
import { useState } from 'react';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { useAuth } from '@/firebase/auth/auth-context';
import { useToast } from '@/hooks/use-toast';
import { getFirebaseAuthErrorMessage, logError } from '@/lib/errorHandler';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { auth } = useAuth();
  const { toast } = useToast();
  

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);

    try {
      if (!auth) throw new Error("Auth service not available");
      await signInWithEmailAndPassword(auth, email.trim(), password);
      // AuthProvider akan menangani pengalihan berdasarkan role
    } catch (error: any) {
      if (error.code !== 'auth/invalid-credential' && error.code !== 'auth/user-not-found') {
        logError(error, { context: 'Login attempt failure' });
      }
      
      toast({
        title: "Gagal Mengakses Tahta",
        description: getFirebaseAuthErrorMessage(error),
        variant: "destructive",
      });
    } finally {
        setIsLoggingIn(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = resetEmail.trim();
    if (!trimmedEmail) {
        toast({ title: 'Email diperlukan', description: 'Masukkan alamat email akun Bangsawan Anda.', variant: 'destructive'});
        return;
    }
    if (!auth) {
        toast({ title: 'Layanan tidak tersedia', description: 'Gagal mengirim instruksi pemulihan.', variant: 'destructive'});
        return;
    }
    setIsResetting(true);
    try {
      await sendPasswordResetEmail(auth, trimmedEmail);
      toast({
        title: "Instruksi Pemulihan Dikirim",
        description: `Jika akun ${trimmedEmail} terdaftar, tautan reset telah dikirim ke kotak masuk Anda.`,
      });
      setIsDialogOpen(false);
      setResetEmail('');
    } catch (error: any) {
      logError(error, { context: 'Password reset failure' });
      toast({
        title: "Gagal Mengirim Email",
        description: getFirebaseAuthErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setIsResetting(false);
    }
  };


  return (
    <div className="relative flex items-center justify-center min-h-screen bg-background p-4">
      <div className="absolute top-4 right-4 z-50">
        <ModeToggle />
      </div>
      
      <div className="w-full max-w-md animate-in fade-in zoom-in-95 duration-500">
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <Card className="glass-card border-white/5 overflow-hidden shadow-2xl relative">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
            <CardHeader className="pt-10 pb-6 text-center">
                <div className="flex justify-center mb-6">
                  <Link href="/" className="flex flex-col items-center gap-2 group">
                    <Crown className="h-12 w-12 text-primary drop-shadow-[0_0_10px_rgba(234,179,8,0.5)] group-hover:scale-110 transition-transform duration-300" />
                    <span className="text-3xl font-gruppo font-bold tracking-[0.2em] text-primary uppercase">Patra Yudha</span>
                  </Link>
                </div>
                <CardTitle className="text-xl font-poiret-one tracking-widest uppercase">Akses Aula Bangsawan</CardTitle>
                <CardDescription className="text-[10px] uppercase tracking-tighter opacity-50">
                    Masukkan email dan kata sandi wibawa Anda untuk melanjutkan penaklukan.
                </CardDescription>
            </CardHeader>
            <CardContent className="px-8 pb-10">
                  <form onSubmit={handleLogin} className="space-y-5">
                    <div className="space-y-2">
                        <Label htmlFor="email">Identitas Email</Label>
                        <Input
                          id="email"
                          type="email"
                          placeholder="nobility@patrayudha.com"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          disabled={isLoggingIn}
                          className="bg-white/5 border-white/10 h-11"
                        />
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="password">Kata Sandi</Label>
                          <DialogTrigger asChild>
                             <Button variant="link" type="button" className="h-auto p-0 text-[10px] uppercase font-bold tracking-widest text-primary/60 hover:text-primary">
                              Lupa Sandi?
                            </Button>
                          </DialogTrigger>
                        </div>
                        <div className="relative">
                          <Input id="password" type={showPassword ? 'text' : 'password'} required value={password} onChange={(e) => setPassword(e.target.value)} disabled={isLoggingIn} className="bg-white/5 border-white/10 h-11" />
                           <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-primary/40 hover:text-primary"
                                onClick={() => setShowPassword(!showPassword)}
                            >
                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                        </div>
                    </div>
                    <Button type="submit" className="w-full btn-3d bg-primary text-primary-foreground font-bold uppercase tracking-[0.3em] h-12 mt-4" disabled={isLoggingIn}>
                        {isLoggingIn ? 'MEMVALIDASI...' : 'MASUK PERMAINAN'}
                    </Button>
                  </form>

                <div className="mt-8 text-center text-[10px] uppercase font-bold tracking-widest">
                  <span className="opacity-40">Belum memiliki gelar?</span>{' '}
                  <Link href="/register" className="text-primary hover:underline underline-offset-4">
                    Daftar Akun Baru
                  </Link>
                </div>
                <div className="mt-4 text-center">
                  <Link href="/" className="text-[9px] uppercase font-bold opacity-30 hover:opacity-100 transition-opacity">
                    Kembali ke Beranda
                  </Link>
                </div>
            </CardContent>
          </Card>

          <DialogContent className="glass-card border-white/5">
            <DialogHeader>
              <DialogTitle className="font-poiret-one text-2xl tracking-widest uppercase text-primary">Pemulihan Akses</DialogTitle>
              <DialogDescription className="text-xs">
                Masukkan alamat email Anda. Kami akan mengirimkan instruksi rahasia untuk mengatur ulang kata sandi wibawa Anda.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handlePasswordReset} className="space-y-6 py-4">
                <div className="space-y-2">
                    <Label htmlFor="reset-email">Email Terdaftar</Label>
                    <div className="relative">
                        <Input
                            id="reset-email"
                            type="email"
                            placeholder="my@email.com"
                            required
                            value={resetEmail}
                            onChange={(e) => setResetEmail(e.target.value)}
                            className="bg-white/5 pl-10 h-11"
                        />
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-40" />
                    </div>
                </div>
                <DialogFooter className="gap-3">
                    <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)} className="uppercase text-[10px] font-bold tracking-widest">Batal</Button>
                    <Button type="submit" disabled={isResetting} className="btn-3d bg-primary text-primary-foreground uppercase text-[10px] font-bold tracking-widest h-11 px-8">
                        {isResetting ? 'MENGIRIM...' : 'Kirim Instruksi'}
                    </Button>
                </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
