'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Crown } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { logError } from '@/lib/errorHandler';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { doc, serverTimestamp, collection, getDocs, query, where, runTransaction, increment } from 'firebase/firestore';
import { useAuth } from '@/firebase/auth/auth-context';
import { useFirestore } from '@/firebase/firestore/firestore-context';
import { useRouter } from 'next/navigation';
import { PageLoading } from '@/components/loading/PageLoading';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { ModeToggle } from '@/components/theme-toggle';
import Link from 'next/link';

const zodiacSigns = [ "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo", "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces" ];
const provinces = [
  "Aceh", "Sumatera Utara", "Sumatera Barat", "Riau", "Jambi", 
  "Sumatera Selatan", "Bengkulu", "Lampung", "Kepulauan Bangka Belitung", "Kepulauan Riau", 
  "DKI Jakarta", "Jawa Barat", "Jawa Tengah", "DI Yogyakarta", "Jawa Timur", "Banten", 
  "Bali", "Nusa Tenggara Barat", "Nusa Tenggara Timur", 
  "Kalimantan Barat", "Kalimantan Tengah", "Kalimantan Selatan", "Kalimantan Timur", "Kalimantan Utara",
  "Sulawesi Utara", "Sulawesi Tengah", "Sulawesi Selatan", "Sulawesi Tenggara", "Gorontalo", "Sulawesi Barat", 
  "Maluku", "Maluku Utara", 
  "Papua", "Papua Barat", "Papua Barat Daya", "Papua Pegunungan", "Papua Selatan", "Papua Tengah",
  "Luar Negeri"
];


export default function WelcomePage() {
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const { user, loading, userProfile } = useAuth();
  const { db } = useFirestore();

  useEffect(() => {
    if (!loading && userProfile?.onboardingComplete) {
      router.push('/dashboard');
    }
  }, [userProfile, loading, router]);

  const handleProfileSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user || !db) {
        toast({ title: "Layanan tidak tersedia", description: "Gagal menghubungkan ke layanan.", variant: "destructive" });
        return;
    }
    
    setIsSaving(true);
    
    const formData = new FormData(e.currentTarget);
    const prideName = (formData.get('prideName') as string).trim();
    const province = formData.get('province') as string;
    const zodiac = formData.get('zodiac') as string;

    if (prideName.length < 3) {
        toast({ title: "Nama Terlalu Pendek", description: "Identitas Bangsawan minimal memiliki 3 karakter.", variant: "destructive" });
        setIsSaving(false);
        return;
    }

    runTransaction(db, async (transaction) => {
        const userDocRef = doc(db, 'users', user.uid);
        const alliancesCollectionRef = collection(db, 'alliances');
        
        const prideNameQuery = query(collection(db, 'users'), where('prideName', '==', prideName));
        const prideNameSnapshot = await getDocs(prideNameQuery);
        if (!prideNameSnapshot.empty) {
            throw new Error("NAMA_DIGUNAKAN");
        }

        const settingsDocSnap = await transaction.get(doc(db, 'game-settings', 'initial-resources'));
        const mechanicsDocSnap = await transaction.get(doc(db, 'game-settings', 'game-mechanics'));
        
        const initialResourcesData = settingsDocSnap.exists() ? settingsDocSnap.data() : {};
        const mechanicsData = mechanicsDocSnap.exists() ? mechanicsDocSnap.data() : {};

        const defaultInitialResources = {
            money: 10000, food: 5000, land: 100, pride: 500, unemployed: 10,
            attack: 10, defense: 10, raider: 5,
            residence: 1, farm: 1, tambang: 1, tower: 0, barracks: 0, mobility: 0, university: 0, fort: 0,
        };
        const initialResources = { ...defaultInitialResources, ...initialResourcesData };
        const allianceCapacity = mechanicsData.allianceCapacity || 10;

        let assignedAllianceId: string | null = null;
        let userCoordinates: { x: number, y: number };

        const provinceIndex = provinces.indexOf(province);
        const coordX = provinceIndex + 1;

        const allProvinceAlliancesQuery = query(alliancesCollectionRef, where("province", "==", province));
        const allProvinceAlliancesSnapshot = await getDocs(allProvinceAlliancesQuery);
        
        const availableAlliances = allProvinceAlliancesSnapshot.docs.filter(
            d => (d.data().memberCount ?? 0) < allianceCapacity
        );

        if (availableAlliances.length > 0) {
            const randomAllianceDoc = availableAlliances[Math.floor(Math.random() * availableAlliances.length)];
            assignedAllianceId = randomAllianceDoc.id;
            userCoordinates = randomAllianceDoc.data().coordinates;
            
            const allianceRef = doc(db, 'alliances', assignedAllianceId);
            transaction.update(allianceRef, { memberCount: increment(1) });
        } else {
            let maxPioneerY = 0;
            allProvinceAlliancesSnapshot.docs.forEach(d => {
                const y = d.data().coordinates?.y;
                if (y > maxPioneerY) maxPioneerY = y;
            });
            const coordY = maxPioneerY + 1;
            userCoordinates = { x: coordX, y: coordY };
            
            const newAllianceRef = doc(collection(db, 'alliances'));
            const newAllianceData = {
                name: `Perintis ${province} #${coordY}`,
                tag: `${province.substring(0, 3).toUpperCase()}${coordY}`,
                province: province,
                coordinates: userCoordinates,
                logoUrl: 'https://i.imgur.com/iE3uduS.png',
                createdAt: serverTimestamp(),
                memberCount: 1,
                leaderId: user.uid,
            };

            transaction.set(newAllianceRef, newAllianceData);
            assignedAllianceId = newAllianceRef.id;
        }

        const updatePayload = {
            onboardingComplete: true,
            prideName,
            zodiac,
            province,
            money: initialResources.money,
            food: initialResources.food,
            land: initialResources.land,
            pride: initialResources.pride,
            unemployed: initialResources.unemployed,
            buildings: { 
                residence: initialResources.residence, farm: initialResources.farm, 
                tambang: initialResources.tambang, tower: initialResources.tower,
                barracks: initialResources.barracks, mobility: initialResources.mobility, 
                university: initialResources.university, fort: initialResources.fort,
            },
            units: { 
                attack: initialResources.attack, defense: initialResources.defense, 
                elite: 0, raider: initialResources.raider
            },
            lastResourceUpdate: serverTimestamp(),
            lastSeen: serverTimestamp(),
            allianceId: assignedAllianceId,
            coordinates: userCoordinates,
            soundEnabled: true,
        };

        transaction.update(userDocRef, updatePayload);
    }).then(() => {
        toast({ title: "Selamat Datang!", description: `Identitas Wibawa "${prideName}" telah dikukuhkan.` });
    }).catch(async (error: any) => {
        if (error.message === "NAMA_DIGUNAKAN") {
            toast({ title: "Nama Tidak Tersedia", description: "Pilih identitas lain, nama ini sudah dikukuhkan penguasa lain.", variant: "destructive" });
        } else {
            logError(error, { context: 'WelcomePage: onboarding failure' });
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'onboarding_transaction', operation: 'write' }));
            toast({ title: "Gagal Mengukuhkan Profil", description: "Terjadi gangguan transmisi. Silakan coba lagi.", variant: "destructive" });
        }
    }).finally(() => {
        setIsSaving(false);
    });
  };


  if (loading || !user) {
      return <PageLoading message="Mempersiapkan kehadiran Bangsawan..." />;
  }
  
  if (userProfile && userProfile.onboardingComplete) {
      return <PageLoading message="Membuka akses dashboard..." />;
  }

  return (
    <div className="relative flex items-center justify-center min-h-screen bg-background p-4">
        <div className="absolute top-4 right-4 z-50">
            <ModeToggle />
        </div>

        <div className="w-full max-w-xl animate-in fade-in zoom-in-95 duration-700">
            <Card className="glass-card border-white/5 overflow-hidden shadow-2xl relative">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
                <CardHeader className="pt-10 pb-6 text-center">
                    <div className="flex justify-center mb-6">
                        <Crown className="h-14 w-14 text-primary animate-pulse drop-shadow-[0_0_15px_rgba(234,179,8,0.5)]" />
                    </div>
                    <CardTitle className="text-3xl font-poiret-one tracking-[0.2em] uppercase font-bold text-white">Pengukuhan Wibawa</CardTitle>
                    <CardDescription className="text-[10px] uppercase tracking-[0.4em] opacity-50 font-bold mt-2">
                        Tentukan identitas agung Anda untuk memulai penaklukan.
                    </CardDescription>
                </CardHeader>
                <CardContent className="px-8 pb-10">
                      <form onSubmit={handleProfileSubmit} className="space-y-8">
                        <div className="space-y-3">
                            <Label htmlFor="prideName" className="uppercase font-bold tracking-[0.2em] text-primary/70 text-[10px]">Identitas Bangsawan (Maks 20 Karakter)</Label>
                            <Input id="prideName" name="prideName" placeholder="Contoh: Sang Pemenang" required disabled={isSaving} maxLength={20} className="bg-white/5 border-white/10 h-12 font-medium tracking-widest text-lg text-center" />
                            <p className="text-[9px] text-muted-foreground italic text-center opacity-40">Nama ini akan tercatat selamanya di peta geopolitik nusantara.</p>
                        </div>
                        
                        <Separator className="bg-white/5" />

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                            <div className="space-y-3">
                                <Label htmlFor="province" className="uppercase font-bold tracking-[0.2em] text-primary/70 text-[10px]">Provinsi Kekuasaan</Label>
                                <Select name="province" required disabled={isSaving}>
                                    <SelectTrigger id="province" className="bg-white/5 border-white/10 h-11"><SelectValue placeholder="Pilih Wilayah..." /></SelectTrigger>
                                    <SelectContent className="max-h-60 bg-card/95 backdrop-blur-xl border-white/10">{provinces.map((prov) => (<SelectItem key={prov} value={prov}>{prov}</SelectItem>))}</SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-3">
                                <Label htmlFor="zodiac" className="uppercase font-bold tracking-[0.2em] text-primary/70 text-[10px]">Zodiak Pelindung</Label>
                                <Select name="zodiac" required disabled={isSaving}>
                                    <SelectTrigger id="zodiac" className="bg-white/5 border-white/10 h-11"><SelectValue placeholder="Pilih Rasi Bintang..." /></SelectTrigger>
                                    <SelectContent className="bg-card/95 backdrop-blur-xl border-white/10">{zodiacSigns.map((sign) => (<SelectItem key={sign} value={sign}>{sign}</SelectItem>))}</SelectContent>
                                </Select>
                            </div>
                        </div>

                        <Button type="submit" className="w-full btn-3d bg-primary text-primary-foreground font-bold uppercase tracking-[0.4em] h-14 mt-6 text-sm" disabled={isSaving}>
                            {isSaving ? 'MEMPROSES RITUAL...' : 'MULAI MEMBANGUN WIBAWA'}
                        </Button>
                      </form>
                      
                      <div className="mt-8 text-center">
                        <Link href="/" className="text-[9px] uppercase font-bold opacity-30 hover:opacity-100 transition-opacity tracking-widest">
                          Meninggalkan Aula Ritual
                        </Link>
                      </div>
                </CardContent>
            </Card>
        </div>
    </div>
  );
}
