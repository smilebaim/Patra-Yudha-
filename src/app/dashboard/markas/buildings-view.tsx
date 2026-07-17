'use client';

import { useAuth } from '@/firebase/auth/auth-context';
import { useFirestore } from '@/firebase/firestore/firestore-context';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { collection, doc, onSnapshot, query, serverTimestamp, Timestamp, updateDoc, increment, writeBatch, runTransaction, where } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import { formatDistanceToNowStrict } from 'date-fns';
import { id } from 'date-fns/locale';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Zap, X, Info, Hammer, Building2, AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { logError } from '@/lib/errorHandler';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface BuildingCost {
  [key: string]: number;
}

interface QueueItem {
  id: string;
  items: { buildingId: keyof typeof buildingDetailsMap; amount: number }[];
  completionTime: Timestamp;
}

const buildingDetailsMap = {
  residence: { name: 'Rumah', description: 'Menghasilkan Pengangguran dan menambah Kapasitas Populasi Bangsawan.' },
  farm: { name: 'Sawah', description: 'Sumber utama penghasil Makanan untuk menopang pasukan.' },
  tambang: { name: 'Tambang', description: 'Sumber utama penghasil Uang untuk pembangunan dan pelatihan.' },
  barracks: { name: 'Barak Pasukan', description: 'Mempercepat waktu pelatihan semua jenis pasukan (%).' },
  mobility: { name: 'Mobilitas Pasukan', description: 'Memberikan Bonus Serangan (%) pada kekuatan tempur pasukan Anda.' },
  university: { name: 'Kampus', description: 'Mempercepat konstruksi bangunan (%) dan menambah efisiensi sumber daya (%).' },
  fort: { name: 'Benteng', description: 'Memberikan Bonus Pertahanan (%) yang vital saat wilayah diserang.' },
  tower: { name: 'Menara', description: 'Memberikan Bonus Pertahanan (%) khusus untuk melindungi dari penjarahan.' },
};
const buildingDetails = Object.entries(buildingDetailsMap).map(([id, details]) => ({ id, ...details }));

const Countdown = ({ to }: { to: Timestamp }) => {
    const [text, setText] = useState('');
    useEffect(() => {
        const updateText = () => {
            const now = new Date();
            const target = to.toDate();
            if (target <= now) {
                setText('Selesai');
                return;
            }
            try {
                const remaining = formatDistanceToNowStrict(target, { locale: id });
                setText(remaining);
            } catch (e) {
                setText('...');
            }
        };
        updateText();
        const interval = setInterval(updateText, 1000);
        return () => clearInterval(interval);
    }, [to]);
    return <span className="font-mono text-primary">{text}</span>;
};

export default function BuildingsView() {
    const { user, userProfile, gameTiming, buildingEffects } = useAuth();
    const { db } = useFirestore();
    const { toast } = useToast();

    const [buildingCosts, setBuildingCosts] = useState<BuildingCost>({});
    const [constructionQueue, setConstructionQueue] = useState<QueueItem[]>([]);
    const [amounts, setAmounts] = useState<{[key: string]: number}>({});
    const [isProcessing, setIsProcessing] = useState(false);
    
    const [destroyBuildingPrideCost, setDestroyBuildingPrideCost] = useState(0);
    const [rushCost, setRushCost] = useState(0);
    const [cancelConstructionRefundPercentage, setCancelConstructionRefundPercentage] = useState(50);
    const [isRushing, setIsRushing] = useState<string | null>(null);
    const [isCanceling, setIsCanceling] = useState<string | null>(null);

    useEffect(() => {
        if (!db) return;
        const unsubCosts = onSnapshot(doc(db, 'game-settings', 'game-costs'), (doc) => {
            if (doc.exists()) {
                setBuildingCosts(doc.data().buildings || {});
            }
        }, (err) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'game-settings/game-costs', operation: 'get' }));
        });
        const unsubMechanics = onSnapshot(doc(db, 'game-settings', 'game-mechanics'), (doc) => {
            if (doc.exists()) {
                const data = doc.data();
                setRushCost(data.rushConstructionCost || 0);
                setDestroyBuildingPrideCost(data.destroyBuildingPrideCost || 0);
                setCancelConstructionRefundPercentage(data.cancelConstructionRefundPercentage || 50);
            }
        }, (err) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'game-settings/game-mechanics', operation: 'get' }));
        });
        return () => { unsubCosts(); unsubMechanics(); };
    }, [db]);

    const queueQuery = useMemo(() => {
        if (!db || !user?.uid) return null;
        return query(collection(db, 'constructionQueue'), where('userId', '==', user.uid));
    }, [db, user?.uid]);

    useEffect(() => {
        if (!queueQuery) return;
        const unsub = onSnapshot(queueQuery, (snapshot) => {
            const queue = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as QueueItem));
            queue.sort((a, b) => a.completionTime.toMillis() - b.completionTime.toMillis());
            setConstructionQueue(queue);
        }, (err) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'constructionQueue', operation: 'list' }));
        });
        return () => unsub();
    }, [queueQuery]);
    
    const totalLandUsed = useMemo(() => {
        if (!userProfile?.buildings) return 0;
        return Object.values(userProfile.buildings).reduce((acc, count) => acc + (typeof count === 'number' ? count : 0), 0);
    }, [userProfile?.buildings]);

    const landInConstruction = useMemo(() => {
        return constructionQueue.reduce((total, job) => {
            return total + job.items.reduce((jobTotal, item) => jobTotal + item.amount, 0);
        }, 0);
    }, [constructionQueue]);
    
    const emptyLand = useMemo(() => {
        if (userProfile?.land === undefined) return 0;
        return userProfile.land - totalLandUsed - landInConstruction;
    }, [userProfile?.land, totalLandUsed, landInConstruction]);

    const handleBuild = (buildingId: string, amount: number) => {
        if (!user || !userProfile || !gameTiming || amount <= 0 || isProcessing || !db) return;
        
        const totalCost = (buildingCosts[buildingId] || 0) * amount;
        if (emptyLand < amount) {
            toast({ title: "Tanah tidak cukup!", variant: "destructive"});
            return;
        }
        if (userProfile.money < totalCost) {
            toast({ title: "Uang tidak cukup!", variant: "destructive" });
            return;
        }

        setIsProcessing(true);
        const baseConstructionDuration = (gameTiming.constructionTimeInHours || 5) * 3600 * 1000;
        const universityBonus = (userProfile.buildings.university || 0) * (buildingEffects?.university.constructionBonus || 0) / 100;
        const finalConstructionDuration = baseConstructionDuration / (1 + universityBonus);
        
        const batch = writeBatch(db);
        const constructionQueueRef = collection(db, 'constructionQueue');
        const completionTime = new Date(Date.now() + finalConstructionDuration);
        const newJobRef = doc(constructionQueueRef);
        
        const jobData = {
            userId: user.uid,
            items: [{ buildingId, amount }],
            startTime: serverTimestamp(),
            completionTime: Timestamp.fromDate(completionTime),
        };
        
        batch.set(newJobRef, jobData);
        batch.update(doc(db, 'users', user.uid), { money: increment(-totalCost) });
        
        batch.commit().catch(async (err) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: 'batch_construction',
                operation: 'write',
                requestResourceData: jobData
            }));
        });

        toast({ title: "Pembangunan Dimulai!" });
        setAmounts(prev => ({...prev, [buildingId]: 0}));
        setIsProcessing(false);
    };

    const handleDestroy = (buildingId: string, amount: number) => {
        if (!user || !userProfile || amount <= 0 || isProcessing || !db) return;
        if ((userProfile.buildings?.[buildingId] ?? 0) < amount) return;
        const totalPrideCost = amount * destroyBuildingPrideCost;
        if (userProfile.pride < totalPrideCost) {
            toast({ title: "Wibawa tidak cukup", variant: "destructive" });
            return;
        }
        setIsProcessing(true);
        const userRef = doc(db, 'users', user.uid);
        
        runTransaction(db, async (transaction) => {
            const userDoc = await transaction.get(userRef);
            const currentPride = userDoc.data()?.pride || 0;
            transaction.update(userRef, {
                [`buildings.${buildingId}`]: increment(-amount),
                pride: Math.max(0, currentPride - totalPrideCost),
            });
        }).catch(async (err) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: userRef.path,
                operation: 'update',
                requestResourceData: { [`buildings.${buildingId}`]: increment(-amount) }
            }));
        }).finally(() => {
            setIsProcessing(false);
            toast({ title: "Bangunan Dihancurkan" });
            setAmounts(prev => ({...prev, [buildingId]: 0}));
        });
    };

    const handleRushConstruction = (jobId: string) => {
        if (!user || !userProfile || !db) return;
        if (userProfile.pride < rushCost) {
            toast({ title: "Wibawa tidak cukup", variant: "destructive" });
            return;
        }
        setIsRushing(jobId);
        const userRef = doc(db, 'users', user.uid);
        const jobRef = doc(db, 'constructionQueue', jobId);

        runTransaction(db, async (transaction) => {
            const userDoc = await transaction.get(userRef);
            const jobDoc = await transaction.get(jobRef);
            
            if (!userDoc.exists() || !jobDoc.exists()) return;
            
            const dbCompletionTime = jobDoc.data().completionTime as Timestamp;
            const jobItems = jobDoc.data().items || [];
            const currentPride = userDoc.data()?.pride || 0;
            
            // Subtract 1 hour (3600000ms) from the database timestamp
            const updatedMillis = dbCompletionTime.toMillis() - 3600 * 1000;
            const isFinished = updatedMillis <= Date.now();
            const newPride = Math.max(0, currentPride - rushCost);
            
            if (isFinished && jobItems.length > 0) {
                // If rushing makes it finish instantly, update the profile and delete the job now
                const { buildingId, amount } = jobItems[0];
                transaction.update(userRef, { 
                    [`buildings.${buildingId}`]: increment(amount),
                    pride: newPride 
                });
                transaction.delete(jobRef);

                // Add report
                const reportRef = doc(collection(db, 'reports'));
                transaction.set(reportRef, {
                    userId: user.uid,
                    type: 'construction-completed',
                    isRead: false,
                    timestamp: serverTimestamp(),
                    details: { message: `Konstruksi ${amount}x ${buildingDetailsMap[buildingId as keyof typeof buildingDetailsMap]?.name || buildingId} dipercepat dan selesai.` }
                });
            } else {
                // Just update the time and pride
                transaction.update(jobRef, { completionTime: Timestamp.fromMillis(updatedMillis) });
                transaction.update(userRef, { pride: newPride });
            }
        }).then(() => {
            toast({ title: "Konstruksi Dipercepat!" });
        }).catch(async (err) => {
            logError(err);
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: jobRef.path,
                operation: 'update',
                requestResourceData: { rush: true }
            }));
        }).finally(() => {
            setIsRushing(null);
        });
    };

    const handleCancelConstruction = (job: QueueItem) => {
        if (!user || !db) return;
        setIsCanceling(job.id);
        
        let totalCostRefund = 0;
        job.items.forEach(item => { totalCostRefund += (buildingCosts[item.buildingId] || 0) * item.amount; });
        const refundAmount = totalCostRefund * (cancelConstructionRefundPercentage / 100);
        
        const batch = writeBatch(db);
        const jobRef = doc(db, 'constructionQueue', job.id);
        const userRef = doc(db, 'users', user.uid);
        
        batch.delete(jobRef);
        batch.update(userRef, { money: increment(refundAmount) });
        
        batch.commit().catch(async (err) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: jobRef.path,
                operation: 'delete'
            }));
        }).finally(() => {
            setIsCanceling(null);
            toast({ title: "Proyek Dibatalkan" });
        });
    };

    return (
        <Card className="bg-card/40 backdrop-blur-lg border-white/5 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-1 h-full bg-primary/40 group-hover:bg-primary transition-colors" />
            <CardHeader className="p-6">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-xl font-poiret-one tracking-widest text-primary uppercase flex items-center gap-2">
                        <Building2 className="h-5 w-5" /> Infrastruktur Bangsawan
                    </CardTitle>
                    {emptyLand < 10 && (
                        <Badge variant="destructive" className="animate-pulse flex items-center gap-1 text-[8px] uppercase py-0.5 h-5">
                            <AlertTriangle className="h-2.5 w-2.5" /> Lahan Kritis
                        </Badge>
                    )}
                </div>
                <CardDescription className="text-[10px] uppercase tracking-widest opacity-60">Pusat pengembangan wilayah dan ketersediaan lahan.</CardDescription>
            </CardHeader>
            <CardContent className="p-6 pt-0 space-y-4">
                <ScrollArea className="h-[350px] pr-4">
                    <div className="space-y-3">
                        {buildingDetails.map(building => {
                            const owned = userProfile?.buildings?.[building.id] || 0;
                            const cost = buildingCosts[building.id] || 0;
                            const amount = amounts[building.id] || 0;
                            return (
                                <div key={building.id} className="p-3 rounded-xl bg-white/5 border border-white/5 flex flex-col sm:flex-row items-center gap-4 group/item hover:border-primary/20 transition-all">
                                    <div className="flex-1 w-full text-center sm:text-left">
                                        <div className="flex items-center justify-center sm:justify-start gap-2">
                                            <p className="font-bold text-sm uppercase tracking-wider">{building.name}</p>
                                            <Dialog>
                                                <DialogTrigger asChild>
                                                    <Info className="h-3 w-3 opacity-30 cursor-pointer hover:opacity-100" />
                                                </DialogTrigger>
                                                <DialogContent className="glass-card"><DialogHeader><DialogTitle>{building.name}</DialogTitle><DialogDescription>{building.description}</DialogDescription></DialogHeader></DialogContent>
                                            </Dialog>
                                        </div>
                                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Dimiliki: <span className="text-white font-mono">{Math.floor(owned).toLocaleString()}</span></p>
                                        <p className="text-[10px] text-primary/60 uppercase tracking-widest">Biaya: <span className="font-mono">{Math.floor(cost).toLocaleString()} Uang</span></p>
                                    </div>
                                    <div className="w-full sm:w-24">
                                        <Input type="number" placeholder="0" className="h-8 bg-white/5 border-white/10 font-gruppo text-center" value={amount || ''} onChange={e => setAmounts(prev => ({...prev, [building.id]: Number(e.target.value)}))} />
                                    </div>
                                    <div className="flex gap-2 w-full sm:w-auto">
                                        <Button size="sm" variant="outline" className="h-8 flex-1 text-[9px] uppercase font-bold" onClick={() => handleBuild(building.id, amount)} disabled={isProcessing || amount <= 0}>Bangun</Button>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild><Button size="sm" variant="ghost" className="h-8 flex-1 text-destructive text-[9px] uppercase font-bold border border-destructive/20" disabled={isProcessing || amount <= 0 || amount > owned}>Hancur</Button></AlertDialogTrigger>
                                            <AlertDialogContent className="glass-card"><AlertDialogHeader><AlertDialogTitle className="text-destructive">Peringatan Penghancuran</AlertDialogTitle><AlertDialogDescription>Biaya: {(amount * destroyBuildingPrideCost).toLocaleString()} Wibawa. Lanjutkan?</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction onClick={() => handleDestroy(building.id, amount)} className="bg-destructive">Ya</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                                        </AlertDialog>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </ScrollArea>

                {constructionQueue.length > 0 && (
                    <div className="space-y-2 mt-4 pt-4 border-t border-white/5">
                        <p className="text-[9px] uppercase font-bold tracking-[0.3em] text-primary/60 text-center">Logistik Konstruksi</p>
                        {constructionQueue.map(job => (
                            <div key={job.id} className="flex justify-between items-center p-3 rounded-xl bg-primary/5 border border-primary/10">
                                <div className="text-[10px] uppercase font-bold tracking-wider">
                                    {job.items[0]?.amount}x {buildingDetailsMap[job.items[0]?.buildingId as keyof typeof buildingDetailsMap]?.name}
                                    <div className="flex items-center gap-2 mt-0.5 opacity-60"><Zap className="h-3 w-3" /><Countdown to={job.completionTime} /></div>
                                </div>
                                <div className="flex gap-1">
                                    <Button size="icon" variant="ghost" className="h-7 w-7 text-primary hover:bg-primary/20" onClick={() => handleRushConstruction(job.id)} disabled={!!isRushing} title="Percepat 1 Jam"><Zap className="h-3.5 w-3.5" /></Button>
                                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:bg-primary/20" onClick={() => handleCancelConstruction(job)} disabled={!!isCanceling} title="Batalkan"><X className="h-3.5 w-3.5" /></Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}