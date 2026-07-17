'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/firebase/auth/auth-context';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { collection, query, where, onSnapshot, addDoc, doc, updateDoc, increment, Timestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase/firestore/firestore-context';
import { Swords, Zap, Target, ShieldCheck, Star, Info, ChevronRight, Crosshair } from 'lucide-react';
import { cn } from '@/lib/utils';
import { logError } from '@/lib/errorHandler';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TooltipProvider } from '@/components/ui/tooltip';

interface TargetPlayer {
  id: string;
  name: string;
  details: string;
  allianceId?: string;
  coordinates?: { x: number; y: number };
  wibawa?: number;
  role?: string;
}

interface AllianceTarget {
  id: string;
  name: string;
  details: string;
}

interface GameTitle {
  id: string;
  name: string;
  prideRequired: number;
}
type AttackMatrix = { [titleId: string]: string[] };

interface March {
    id: string;
    troops: {
        attack?: number;
        elite?: number;
        raider?: number;
    };
    type: 'war' | 'raid' | 'return';
    arrivalTime: Timestamp;
}

export default function CommandPage() {
    const { user, userProfile, playSound } = useAuth();
    const { db } = useFirestore();
    const { toast } = useToast();

    const [raidTargets, setRaidTargets] = useState<TargetPlayer[]>([]);
    const [warTargets, setWarTargets] = useState<AllianceTarget[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [selectedRaidAlliance, setSelectedRaidAlliance] = useState('');
    const [selectedRaidTarget, setSelectedRaidTarget] = useState('');
    const [raidType, setRaidType] = useState('random');
    const [selectedWarTargetPlayerId, setSelectedWarTargetPlayerId] = useState('');

    const [raidTroops, setRaidTroops] = useState<{ [key: string]: number }>({ raider: 0 });
    const [warTroops, setWarTroops] = useState<{ [key: string]: number }>({ attack: 0, elite: 0 });

    const [isRaiding, setIsRaiding] = useState(false);
    const [isAttacking, setIsAttacking] = useState(false);
    const [myAlliance, setMyAlliance] = useState<{name: string, atWarWith?: string | null} | null>(null);

    const [titles, setTitles] = useState<GameTitle[]>([]);
    const [attackMatrix, setAttackMatrix] = useState<AttackMatrix>({});
    const [marches, setMarches] = useState<March[]>([]);

    const marchesQuery = useMemo(() => {
        if (!db || !user?.uid) return null;
        return query(collection(db, 'marches'), where('attackerId', '==', user.uid));
    }, [db, user?.uid]);

    useEffect(() => {
        if (!marchesQuery) return;
        const unsubscribe = onSnapshot(marchesQuery, (snapshot) => {
            const marchesList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as March[];
            setMarches(marchesList);
        }, async (err) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'marches', operation: 'list' }));
        });
        return () => unsubscribe();
    }, [marchesQuery]);

    useEffect(() => {
        if (!db) return;
        const unsubTitles = onSnapshot(collection(db, 'titles'), (snapshot) => {
            const titlesList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any })) as GameTitle[];
            titlesList.sort((a, b) => a.prideRequired - b.prideRequired);
            setAllTitles(titlesList);
        }, async (err) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'titles', operation: 'list' }));
        });

        const unsubRules = onSnapshot(doc(db, 'game-settings', 'attack-rules'), (docSnap) => {
            if (docSnap.exists()) setAttackMatrix(docSnap.data().attackMatrix || {});
        }, async (err) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'game-settings/attack-rules', operation: 'get' }));
        });

        return () => { unsubTitles(); unsubRules(); };
    }, [db]);

    const setAllTitles = (t: GameTitle[]) => setTitles(t);

    useEffect(() => {
        if (!userProfile?.allianceId || !db) return;
        const unsubAlly = onSnapshot(doc(db, 'alliances', userProfile.allianceId), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setMyAlliance({ name: data.name, atWarWith: data.atWarWith });
            }
        }, async (err) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: `alliances/${userProfile.allianceId}`, operation: 'get' }));
        });
        return () => unsubAlly();
    }, [userProfile?.allianceId, db]);

    useEffect(() => {
        if (!user || !db) { setIsLoading(false); return; }
        setIsLoading(true);

        const unsubUsers = onSnapshot(query(collection(db, 'users')), (snapshot) => {
            let userList = snapshot.docs.map(doc => {
                const data = doc.data();
                return { id: doc.id, name: data.prideName, details: data.province, allianceId: data.allianceId, coordinates: data.coordinates, wibawa: data.pride ?? 0, role: data.role };
            }).filter(u => u.role === 'user' && u.id !== user.uid);
            setRaidTargets(userList);
            setIsLoading(false);
        }, async (err) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'users', operation: 'list' }));
        });
        
        const unsubAllies = onSnapshot(collection(db, 'alliances'), (snapshot) => {
            setWarTargets(snapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name, details: `[${doc.data().tag}]` })));
        }, async (err) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'alliances', operation: 'list' }));
        });

        return () => { unsubUsers(); unsubAllies(); };
    }, [user, db]);

    const isAttackAllowed = useCallback((targetPride: number): boolean => {
        const myTitle = [...titles].reverse().find(t => (userProfile?.pride ?? 0) >= t.prideRequired);
        const targetTitle = [...titles].reverse().find(t => targetPride >= t.prideRequired);
        if (!myTitle || !targetTitle) return true;
        return (attackMatrix[myTitle.id] || []).includes(targetTitle.id);
    }, [titles, userProfile?.pride, attackMatrix]);

    const handleRaid = () => {
        if (!selectedRaidTarget || !user || !userProfile || !db) return;
        const raidersToSend = raidTroops.raider || 0;
        if (raidersToSend <= 0 || raidersToSend > (userProfile.units?.raider ?? 0)) {
            toast({ title: "Pasukan tidak valid", variant: "destructive" });
            return;
        }

        const target = raidTargets.find(p => p.id === selectedRaidTarget);
        if (!target) {
            toast({ title: "Target tidak ditemukan", variant: "destructive" });
            return;
        }

        setIsRaiding(true);
        playSound('combat');

        const arrivalTime = Timestamp.fromDate(new Date(Date.now() + 600000)); // 10m
        const marchData = {
            attackerId: user.uid, defenderId: target.id, troops: { raider: raidersToSend },
            type: 'raid', raidType, arrivalTime, attackerAllianceId: userProfile.allianceId
        };
        const userRef = doc(db, 'users', user.uid);

        updateDoc(userRef, { 'units.raider': increment(-raidersToSend) }).catch(async (err) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: userRef.path,
                operation: 'update',
                requestResourceData: { 'units.raider': increment(-raidersToSend) }
            }));
        });

        addDoc(collection(db, 'marches'), marchData).catch(async (err) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: 'marches',
                operation: 'create',
                requestResourceData: marchData
            }));
        }).finally(() => {
            setIsRaiding(false);
            toast({ title: "Misi Penjarahan Dikirim!" });
            setRaidTroops({ raider: 0 });
        });
    };

    const handleWarAttack = () => {
        if (!selectedWarTargetPlayerId || !user || !userProfile || !db) return;
        const atk = warTroops.attack || 0;
        const elt = warTroops.elite || 0;
        if ((atk + elt) <= 0 || atk > (userProfile.units?.attack ?? 0) || elt > (userProfile.units?.elite ?? 0)) {
            toast({ title: "Pasukan tidak valid", variant: "destructive" });
            return;
        }

        const target = raidTargets.find(p => p.id === selectedWarTargetPlayerId);
        if (!target) {
            toast({ title: "Target tidak ditemukan", variant: "destructive" });
            return;
        }

        if (!isAttackAllowed(target.wibawa || 0)) {
            toast({ title: "Agresi Dilarang", description: "Bangsawan tersebut di luar jangkauan gelar kehormatan Anda.", variant: "destructive" });
            return;
        }

        setIsAttacking(true);
        playSound('combat');

        const arrivalTime = Timestamp.fromDate(new Date(Date.now() + 1800000)); // 30m
        const marchData = {
            attackerId: user.uid, defenderId: target.id, troops: { attack: atk, elite: elt },
            type: 'war', arrivalTime, attackerAllianceId: userProfile.allianceId, defenderAllianceId: myAlliance?.atWarWith
        };
        const userRef = doc(db, 'users', user.uid);

        updateDoc(userRef, { 'units.attack': increment(-atk), 'units.elite': increment(-elt) }).catch(async (err) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: userRef.path,
                operation: 'update',
                requestResourceData: { 'units.attack': increment(-atk), 'units.elite': increment(-elt) }
            }));
        });

        addDoc(collection(db, 'marches'), marchData).catch(async (err) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: 'marches',
                operation: 'create',
                requestResourceData: marchData
            }));
        }).finally(() => {
            setIsAttacking(false);
            toast({ title: "Pasukan Perang Dikirim!" });
            setWarTroops({ attack: 0, elite: 0 });
        });
    };

    return (
        <TooltipProvider>
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Status Militer Center */}
            <Card className="bg-card/30 backdrop-blur-xl border-white/5 shadow-xl">
                <CardContent className="p-4 grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                    {[
                        { label: "Serang", value: userProfile?.units?.attack, icon: Swords },
                        { label: "Bertahan", value: userProfile?.units?.defense, icon: ShieldCheck },
                        { label: "Elit", value: userProfile?.units?.elite, icon: Star },
                        { label: "Pasukan Khusus", value: userProfile?.units?.raider, icon: Zap },
                        { label: "Total Militer", value: Object.values(userProfile?.units || {}).reduce((a,b)=>a+(b||0),0), icon: Target, highlight: true },
                    ].map((item, idx) => (
                        <div key={idx} className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-white/5 border border-white/5 group hover:bg-white/10 transition-colors">
                            <span className="text-[9px] uppercase font-bold tracking-widest text-muted-foreground mb-1">{item.label}</span>
                            <div className="flex items-center gap-1.5">
                                <item.icon className={cn("h-3.5 w-3.5 opacity-40", item.highlight && "text-primary opacity-100")} />
                                <span className="font-gruppo text-lg font-bold tracking-widest">{Math.floor(item.value ?? 0).toLocaleString()}</span>
                            </div>
                        </div>
                    ))}
                </CardContent>
            </Card>

            <Tabs defaultValue="raid" className="w-full">
                <TabsList className="grid w-full grid-cols-2 bg-card/40 backdrop-blur-xl h-12 p-1 border border-white/5 rounded-xl">
                    <TabsTrigger 
                        value="raid" 
                        className="data-[state=active]:bg-accent/20 data-[state=active]:text-accent font-bold uppercase tracking-widest text-[10px] h-full rounded-lg transition-all"
                    >
                        <Zap className="mr-2 h-3.5 w-3.5" />Operasi Penjarahan
                    </TabsTrigger>
                    <TabsTrigger 
                        value="war" 
                        className="data-[state=active]:bg-destructive/20 data-[state=active]:text-destructive font-bold uppercase tracking-widest text-[10px] h-full rounded-lg transition-all"
                    >
                        <Swords className="mr-2 h-3.5 w-3.5" />Agresi Militer
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="raid" className="mt-6 space-y-6 animate-in slide-in-from-left-4 duration-300">
                    <Card className="bg-card/40 backdrop-blur-lg border-white/5 shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-0 left-0 w-1 h-full bg-accent/40 group-hover:bg-accent transition-colors" />
                        <CardHeader className="p-6">
                            <CardTitle className="text-xl font-poiret-one tracking-widest text-accent uppercase flex items-center gap-2">
                                <Zap className="h-5 w-5" /> Pusat Intelijen Penjarahan
                            </CardTitle>
                            <CardDescription className="text-[10px] uppercase tracking-widest opacity-60">Luncurkan serangan kilat untuk menjarah pundi-pundi dana dan logistik musuh.</CardDescription>
                        </CardHeader>
                        <CardContent className="p-6 pt-0 space-y-5">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-[10px] uppercase font-bold tracking-widest opacity-70">Aliansi Target</Label>
                                    <Select onValueChange={setSelectedRaidAlliance} value={selectedRaidAlliance}>
                                        <SelectTrigger className="bg-white/5 border-white/10 h-11"><SelectValue placeholder="Pilih Aliansi..." /></SelectTrigger>
                                        <SelectContent>{warTargets.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] uppercase font-bold tracking-widest opacity-70">Bangsawan Target</Label>
                                    <Select onValueChange={setSelectedRaidTarget} value={selectedRaidTarget} disabled={!selectedRaidAlliance}>
                                        <SelectTrigger className="bg-white/5 border-white/10 h-11"><SelectValue placeholder="Pilih Bangsawan..." /></SelectTrigger>
                                        <SelectContent>
                                            {raidTargets.filter(r => r.allianceId === selectedRaidAlliance).map(t => (
                                                <SelectItem key={t.id} value={t.id}>
                                                    {t.name} ({Math.floor(t.wibawa || 0).toLocaleString()} Wibawa)
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase font-bold tracking-widest opacity-70">Jumlah Pasukan Khusus</Label>
                                <div className="relative">
                                    <Input 
                                        type="number" 
                                        value={raidTroops.raider || ''} 
                                        onChange={e => setRaidTroops({raider: Number(e.target.value)})} 
                                        className="bg-white/5 border-white/10 h-12 font-gruppo text-lg tracking-widest pl-10" 
                                        placeholder="0" 
                                    />
                                    <Zap className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-accent opacity-40" />
                                </div>
                            </div>
                            
                            <Button 
                                onClick={handleRaid} 
                                disabled={isRaiding || !selectedRaidTarget || raidTroops.raider <= 0} 
                                className="w-full bg-accent text-accent-foreground font-bold uppercase tracking-[0.3em] h-12 shadow-lg hover:shadow-accent/20 transition-all"
                            >
                                <Crosshair className="mr-2 h-5 w-5" /> Luncurkan Penjarahan
                            </Button>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="war" className="mt-6 space-y-6 animate-in slide-in-from-right-4 duration-300">
                    {myAlliance?.atWarWith ? (
                        <Card className="bg-card/40 backdrop-blur-lg border-white/5 shadow-2xl relative overflow-hidden group">
                            <div className="absolute top-0 left-0 w-1 h-full bg-destructive/40 group-hover:bg-destructive transition-colors" />
                            <CardHeader className="p-6">
                                <CardTitle className="text-xl font-poiret-one tracking-widest text-destructive uppercase flex items-center gap-2">
                                    <Swords className="h-5 w-5" /> Pusat Komando Invasi
                                </CardTitle>
                                <CardDescription className="text-[10px] uppercase tracking-widest opacity-60">Kerahkan kekuatan penuh divisi militer untuk menaklukkan wilayah musuh selama perang aktif.</CardDescription>
                            </CardHeader>
                            <CardContent className="p-6 pt-0 space-y-5">
                                <div className="space-y-2">
                                    <Label className="text-[10px] uppercase font-bold tracking-widest opacity-70">Bangsawan Target (Aliansi Musuh)</Label>
                                    <Select onValueChange={setSelectedWarTargetPlayerId} value={selectedWarTargetPlayerId}>
                                        <SelectTrigger className="bg-white/5 border-white/10 h-11"><SelectValue placeholder="Pilih Musuh..." /></SelectTrigger>
                                        <SelectContent>
                                            {raidTargets.filter(r => r.allianceId === myAlliance.atWarWith).map(t => (
                                                <SelectItem key={t.id} value={t.id}>
                                                    {t.name} ({Math.floor(t.wibawa || 0).toLocaleString()} Wibawa)
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] uppercase font-bold tracking-widest opacity-70">Divisi Serang</Label>
                                        <Input 
                                            type="number" 
                                            value={warTroops.attack || ''} 
                                            onChange={e => setWarTroops({...warTroops, attack: Number(e.target.value)})} 
                                            className="bg-white/5 border-white/10 h-11 font-gruppo text-lg tracking-widest" 
                                            placeholder="0" 
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] uppercase font-bold tracking-widest opacity-70">Divisi Elit</Label>
                                        <Input 
                                            type="number" 
                                            value={warTroops.elite || ''} 
                                            onChange={e => setWarTroops({...warTroops, elite: Number(e.target.value)})} 
                                            className="bg-white/5 border-white/10 h-11 font-gruppo text-lg tracking-widest" 
                                            placeholder="0" 
                                        />
                                    </div>
                                </div>
                                
                                <Button 
                                    onClick={handleWarAttack} 
                                    disabled={isAttacking || !selectedWarTargetPlayerId || (warTroops.attack + warTroops.elite) <= 0} 
                                    className="w-full bg-destructive text-white font-bold uppercase tracking-[0.3em] h-12 shadow-lg hover:shadow-destructive/20 transition-all"
                                >
                                    <Swords className="mr-2 h-5 w-5" /> Deklarasi Invasi
                                </Button>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-40 italic border-2 border-dashed border-white/5 rounded-3xl">
                            <ShieldCheck className="h-12 w-12" />
                            <p className="text-sm uppercase tracking-[0.2em]">Hanya dapat diakses saat Aliansi berada dalam status Perang Terbuka.</p>
                        </div>
                    )}
                </TabsContent>
            </Tabs>
        </div>
        </TooltipProvider>
    );
}