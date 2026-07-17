'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/firebase/auth/auth-context';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword, deleteUser } from 'firebase/auth';
import { doc, deleteDoc, getDoc, updateDoc, increment, runTransaction } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Eye, EyeOff, Volume2, VolumeX } from 'lucide-react';
import { useFirestore } from '@/firebase/firestore/firestore-context';

export default function SettingsPage() {
  const { user, userProfile } = useAuth();
  const { db } = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const [newPrideName, setNewPrideName] = useState('');
  const [isChangingName, setIsChangingName] = useState(false);
  const [changeNameCost, setChangeNameCost] = useState<number | null>(null);

  const [deleteConfirmPassword, setDeleteConfirmPassword] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const [isUpdatingSound, setIsUpdatingSound] = useState(false);
  
  useEffect(() => {
    if (!db) return;
    const fetchMechanics = async () => {
        try {
            const mechanicsDoc = await getDoc(doc(db, 'game-settings', 'game-mechanics'));
            if (mechanicsDoc.exists()) {
                setChangeNameCost(mechanicsDoc.data().changePrideNameCost ?? null);
            }
        } catch (error) {
            console.error("Error fetching change name cost:", error);
            setChangeNameCost(null);
        }
    };
    fetchMechanics();
  }, [db]);

  const handleToggleSound = async (checked: boolean) => {
    if (!user || !db) return;
    setIsUpdatingSound(true);
    try {
        await updateDoc(doc(db, 'users', user.uid), {
            soundEnabled: checked
        });
        toast({ title: checked ? "Suara Diaktifkan" : "Suara Dimatikan" });
    } catch (error) {
        console.error("Error updating sound preference:", error);
    } finally {
        setIsUpdatingSound(false);
    }
  };
  
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !user.email) return;
    if (newPassword !== confirmPassword) {
      toast({ title: 'Kata Sandi Tidak Cocok', description: 'Kata sandi baru dan konfirmasi tidak sama.', variant: 'destructive' });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: 'Kata Sandi Terlalu Lemah', description: 'Kata sandi harus terdiri dari minimal 6 karakter.', variant: 'destructive' });
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      toast({ title: 'Berhasil!', description: 'Kata sandi Anda telah berhasil diperbarui.' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      let description = 'Terjadi kesalahan yang tidak terduga. Silakan coba lagi.';
      let isHandledError = false;
      
      if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        description = 'Kata sandi saat ini yang Anda masukkan salah.';
        isHandledError = true;
      }
      
      if (!isHandledError) {
          console.error("Password change failed:", error);
      }
      
      toast({ title: 'Gagal Memperbarui Kata Sandi', description, variant: 'destructive' });
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleChangePrideName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !userProfile || !newPrideName.trim() || changeNameCost === null) {
      toast({ title: "Input Tidak Valid", description: "Nama baru tidak boleh kosong.", variant: "destructive" });
      return;
    }
    
    if (userProfile.pride < changeNameCost) {
        toast({ title: "Wibawa Tidak Cukup", description: `Anda membutuhkan ${Math.floor(changeNameCost).toLocaleString()} wibawa untuk mengganti nama.`, variant: "destructive" });
        return;
    }
    
    setIsChangingName(true);
    try {
        const userRef = doc(db, 'users', user.uid);
        await runTransaction(db, async (transaction) => {
            const userDoc = await transaction.get(userRef);
            if (!userDoc.exists()) throw new Error("User not found");

            const currentPride = userDoc.data().pride || 0;
            const newPride = Math.max(0, currentPride - changeNameCost);

            transaction.update(userRef, {
                prideName: newPrideName.trim(),
                pride: newPride,
            });
        });
        
        toast({ title: "Nama Wibawa Diubah", description: `Nama wibawa Anda telah diubah menjadi "${newPrideName.trim()}".` });
        setNewPrideName('');
    } catch (error) {
        console.error("Error changing pride name:", error);
        toast({ title: "Gagal Mengubah Nama", variant: "destructive" });
    } finally {
        setIsChangingName(false);
    }
  };


  const handleDeleteAccount = async () => {
    if (!user || !user.email || !db) return;
    setIsDeleting(true);

    try {
      // Re-authenticate before sensitive operation
      const credential = EmailAuthProvider.credential(user.email, deleteConfirmPassword);
      await reauthenticateWithCredential(user, credential);
      
      // Update alliance member count if user belongs to one
      if (userProfile?.allianceId) {
        await updateDoc(doc(db, 'alliances', userProfile.allianceId), {
            memberCount: increment(-1)
        });
      }

      // Delete Firestore document first
      await deleteDoc(doc(db, 'users', user.uid));
      
      // Then delete the auth user
      await deleteUser(user);

      toast({ title: 'Akun Dihapus', description: 'Akun dan semua data Anda telah dihapus secara permanen.' });
      router.push('/'); // Redirect to landing page
    } catch (error: any) {
        let description = 'Terjadi kesalahan yang tidak terduga. Silakan coba lagi.';
        let isHandledError = false;

        if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
            description = 'Penghapusan gagal. Kata sandi yang Anda masukkan salah. Silakan coba lagi.';
            isHandledError = true;
        } else if (error.code === 'permission-denied') {
            description = "Gagal menghapus data: Izin ditolak. Ini kemungkinan besar karena masalah Aturan Keamanan Firestore. Hubungi admin atau perbarui aturan di Firebase Console.";
            isHandledError = true;
        }

        if (!isHandledError) {
            console.error("Account deletion failed:", error);
        }
        
        toast({ title: 'Gagal Menghapus Akun', description, variant: 'destructive' });
        setIsDeleting(false);
    }
    // No need for finally block here, as we redirect on success.
  };

  return (
    <div className="space-y-6">
       <Card className="bg-card/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Volume2 className="h-5 w-5 text-primary" />
            Preferensi Suara
          </CardTitle>
          <CardDescription>
            Aktifkan suara latar dan efek saat terjadi pertempuran atau menerima laporan intelijen baru.
          </CardDescription>
        </CardHeader>
        <CardContent>
            <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5">
                <div className="space-y-0.5">
                    <Label className="text-sm font-bold uppercase tracking-wider">Efek Suara & Ambience</Label>
                    <p className="text-xs text-muted-foreground">Lonceng notifikasi dan genderang perang.</p>
                </div>
                <Switch 
                    checked={userProfile?.soundEnabled !== false} 
                    onCheckedChange={handleToggleSound}
                    disabled={isUpdatingSound}
                />
            </div>
        </CardContent>
      </Card>

       <Card className="bg-card/50">
        <CardHeader>
          <CardTitle>Ubah Nama Bangsawan</CardTitle>
          <CardDescription>
            Ubah nama wibawa Anda. Fitur ini memerlukan biaya dalam bentuk wibawa jika ditetapkan oleh admin.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePrideName} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-pride-name">Nama Wibawa Baru (Maks 20 Karakter)</Label>
              <Input
                id="new-pride-name"
                type="text"
                value={newPrideName}
                onChange={(e) => setNewPrideName(e.target.value)}
                placeholder={userProfile?.prideName || "Nama Wibawa Anda"}
                required
                maxLength={20}
              />
               {changeNameCost !== null && (
                 <p className="text-sm text-muted-foreground">
                    Biaya: {changeNameCost > 0 ? `${Math.floor(changeNameCost).toLocaleString()} wibawa` : "Gratis"}
                 </p>
               )}
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" className="w-full sm:w-auto btn-3d" disabled={isChangingName || changeNameCost === null || !newPrideName.trim()}>
                  Ubah Nama Wibawa
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Konfirmasi Perubahan Nama</AlertDialogTitle>
                  <AlertDialogDescription>
                    Apakah Anda yakin ingin mengubah nama wibawa Anda menjadi "{newPrideName.trim()}"? 
                    {changeNameCost > 0 ? ` Ini akan memotong ${Math.floor(changeNameCost).toLocaleString()} wibawa Anda.` : ''} Tindakan ini tidak dapat dibatalkan.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Batal</AlertDialogCancel>
                  <AlertDialogAction onClick={handleChangePrideName} className="btn-3d">
                    {isChangingName ? "Menyimpan..." : "Ya, Ubah Nama"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </form>
        </CardContent>
      </Card>
      
      <Card className="bg-card/50">
        <CardHeader>
          <CardTitle>Ubah Kata Sandi</CardTitle>
          <CardDescription>Perbarui kata sandi Anda di sini. Setelah berhasil, Anda mungkin perlu masuk kembali.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">Kata Sandi Saat Ini</Label>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2 relative">
              <Label htmlFor="new-password">Kata Sandi Baru</Label>
               <Input
                id="new-password"
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-7 h-7 w-7"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                <span className="sr-only">Toggle password visibility</span>
              </Button>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Konfirmasi Kata Sandi Baru</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" disabled={isUpdatingPassword} className="w-full sm:w-auto btn-3d">
              {isUpdatingPassword ? 'Memperbarui...' : 'Ubah Kata Sandi'}
            </Button>
          </form>
        </CardContent>
      </Card>
      
      <Card className="border-destructive bg-card/50">
        <CardHeader>
          <CardTitle className="text-destructive">Area Berbahaya</CardTitle>
          <CardDescription>Tindakan di bawah ini bersifat permanen dan tidak dapat diurungkan.</CardDescription>
        </CardHeader>
        <CardContent>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="btn-3d">Hapus Akun</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Apakah Anda benar-benar yakin?</AlertDialogTitle>
                <AlertDialogDescription>
                  Tindakan ini tidak dapat dibatalkan. Ini akan menghapus akun Anda dan semua data permainan terkait secara permanen.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-2 py-2">
                 <Label htmlFor="delete-confirm-password">Untuk konfirmasi, masukkan kata sandi Anda:</Label>
                 <Input
                    id="delete-confirm-password"
                    type="password"
                    value={deleteConfirmPassword}
                    onChange={(e) => setDeleteConfirmPassword(e.target.value)}
                    required
                 />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>Batal</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteAccount}
                  disabled={isDeleting || !deleteConfirmPassword}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90 btn-3d"
                >
                  {isDeleting ? 'Menghapus...' : 'Hapus Akun Saya Secara Permanen'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}
