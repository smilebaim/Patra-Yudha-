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
import { Zap, X, Info, Shield, Swords, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { logError } from '@/lib/errorHandler';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';
import { motion, AnimatePresence } from 'framer-motion';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface UnitCost { [key: string]: number; }
interface QueueItem {
  id: string;
  items: { unitId: keyof typeof unitDetailsMap; amount: number }[];
  completionTime: Timestamp;
}

const unitDetailsMap = {
  attack: { name: 'Pasukan Serang', description: 'Unit dasar yang efektif untuk menyerang wilayah musuh.' },
  defense: { name: 'Pasukan Bertahan', description: 'Unit dasar yang efektif untuk mempertahankan wilayah.' },
  elite: { name: 'Pasukan Elit', description: 'Unit kuat serba bisa untuk menyerang maupun bertahan.' },
  raider: { name: 'Pasukan Khusus', description: 'Unit cepat yang dilatih khusus untuk merampok sumber daya.' },
};
const unitDetails = Object.entries(unitDetailsMap).map(([id, details]) => ({ id, ...details }));

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
    return <span className="font-mono text-accent">{text}</span>;
};

export default function BarracksView() {
  const { user, userProfile, gameTiming, buildingEffects } = useAuth();
  const { db } = useFirestore();
  const { toast } = useToast();
  const [unitCosts, setUnitCosts] = useState<UnitCost>({});
  const [trainingQueue, setTrainingQueue] = useState<QueueItem[]>([]);
  const [amounts, setAmounts] = useState<{[key: string]: number}>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [rushCost, setRushCost] = useState(0);
  const [cancelTrainingRefund, setCancelTrainingRefund] = useState(50);
  const [isRushing, setIsRushing] = useState<string | null>(null);
  const [isCanceling, setIsCanceling] = useState<string | null>(null);

  useEffect(() => {
    if (!db) return;
    const unsubCosts = onSnapshot(doc(db, 'game-settings', 'game-costs'), (doc) => { if (doc.exists()) setUnitCosts(doc.data().units || {}); }, (err) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'game-settings/game-costs', operation: 'get' }));
    });
    const unsubMechanics = onSnapshot(doc(db, 'game-settings', 'game-mechanics'), (doc) => {
        if (doc.exists()) {
            setRushCost(doc.data().rushTrainingCost || 0);
            setCancelTrainingRefund(doc.data().cancelTrainingRefundPercentage || 50);
        }
    }, (err) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'game-settings/game-mechanics', operation: 'get' }));
    });
    return () => { unsubCosts(); unsubMechanics(); };
  }, [db]);

  const queueQuery = useMemo(() => {
    if (!db || !user?.uid) return null;
    return query(collection(db, 'trainingQueue'), where('userId', '==', user.uid));
  }, [db, user?.uid]);

  useEffect(() => {
    if (!queueQuery) return;
    const unsub = onSnapshot(queueQuery, (snapshot) => {
      const queue = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as QueueItem));
      queue.sort((a,b) => a.completionTime.toMillis() - b.completionTime.toMillis());
      setTrainingQueue(queue);
    }, (err) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'trainingQueue', operation: 'list' }));
    });
    return () => unsub();
  }, [queueQuery]);

  const handleTrain = (unitId: string, amount: number) => {
    if (!user || !userProfile || amount <= 0 || isProcessing || !db) return;
    const totalCost = (unitCosts[unitId] || 0) * amount;
    if (userProfile.unemployed < amount) { toast({ title: "Rakyat tidak cukup!", variant: "destructive"}); return; }
    if (userProfile.money < totalCost) { toast({ title: "Uang tidak cukup!", variant: "destructive"}); return; }

    setIsProcessing(true);
    const baseDuration = (gameTiming?.trainingTimeInHours || 2) * 3600 * 1000;
    const bonus = (userProfile.buildings.barracks || 0) * (buildingEffects?.barracks.trainingBonus || 0) / 100;
    const finalDuration = baseDuration / (1 + bonus);
    
    const batch = writeBatch(db);
    const newJobRef = doc(collection(db, 'trainingQueue'));
    const jobData = {
        userId: user.uid, items: [{ unitId, amount }], startTime: serverTimestamp(),
        completionTime: Timestamp.fromDate(new Date(Date.now() + finalDuration)),
    };
    
    batch.set(newJobRef, jobData);
    batch.update(doc(db, 'users', user.uid), { money: increment(-totalCost), unemployed: increment(-amount) });
    
    batch.commit().catch(async (err) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: 'batch_training',
            operation: 'write',
            requestResourceData: jobData
        }));
    }).finally(() => {
        setIsProcessing(false);
    });

    toast({ title: "Pelatihan Dimulai!" });
    setAmounts(prev => ({...prev, [unitId]: 0}));
  };

  const handleDismiss = (unitId: string, amount: number) => {
    if (!user || amount <= 0 || isProcessing || !db) return;
    if ((userProfile?.units?.[unitId as keyof typeof userProfile.units] ?? 0) < amount) return;
    
    setIsProcessing(true);
    const userRef = doc(db, 'users', user.uid);
    const updateData = { [`units.${unitId}`]: increment(-amount), unemployed: increment(amount) };
    
    updateDoc(userRef, updateData).catch(async (err) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: userRef.path,
            operation: 'update',
            requestResourceData: updateData
        }));
    }).finally(() => {
        setIsProcessing(false);
        toast({ title: "Pasukan Dipecat" });
        setAmounts(prev => ({...prev, [unitId]: 0}));
    });
  };

  const handleRushTraining = (jobId: string) => {
    if (!user || !userProfile || !db) return;
    if (userProfile.pride < rushCost) { toast({ title: "Wibawa tidak cukup", variant: "destructive" }); return; }
    
    setIsRushing(jobId);
    const userRef = doc(db, 'users', user.uid);
    const jobRef = doc(db, 'trainingQueue', jobId);

    runTransaction(db, async (transaction) => {
        const userDoc = await transaction.get(userRef);
        const jobDoc = await transaction.get(jobRef);
        
        if (!userDoc.exists() || !jobDoc.exists()) return;
        
        const dbCompletionTime = jobDoc.data().completionTime as Timestamp;
        const jobItems = jobDoc.data().items || [];
        const currentPride = userDoc.data()?.pride || 0;
        
        // Subtract 1 hour from the database timestamp
        const updatedMillis = dbCompletionTime.toMillis() - 3600 * 1000;
        const isFinished = updatedMillis <= Date.now();
        const newPride = Math.max(0, currentPride - rushCost);
        
        if (isFinished && jobItems.length > 0) {
            // If rushing makes it finish instantly, update the profile and delete the job now
            const { unitId, amount } = jobItems[0];
            transaction.update(userRef, { 
                [`units.${unitId}`]: increment(amount),
                pride: newPride 
            });
            transaction.delete(jobRef);

            // Add report
            const reportRef = doc(collection(db, 'reports'));
            transaction.set(reportRef, {
                userId: user.uid,
                type: 'troops-returned',
                isRead: false,
                timestamp: serverTimestamp(),
                details: { message: `Latihan ${amount}x ${unitDetailsMap[unitId as keyof typeof unitDetailsMap]?.name || unitId} dipercepat dan selesai.` }
            });
        } else {
            // Just update the time and pride
            transaction.update(jobRef, { completionTime: Timestamp.fromMillis(updatedMillis) });
            transaction.update(userRef, { pride: newPride });
        }
    }).then(() => {
        toast({ title: "Pelatihan Dipercepat!" });
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

  const handleCancelTraining = (job: QueueItem) => {
      if (!user || !db) return;
      setIsCanceling(job.id);
      
      let totalCost = 0; let totalTroops = 0;
      job.items.forEach(item => { totalCost += (unitCosts[item.unitId] || 0) * item.amount; totalTroops += item.amount; });
      
      const batch = writeBatch(db);
      const jobRef = doc(db, 'trainingQueue', job.id);
      const userRef = doc(db, 'users', user.uid);
      
      batch.delete(jobRef);
      batch.update(userRef, { money: increment(totalCost * (cancelTrainingRefund / 100)), unemployed: increment(totalTroops) });
      
      batch.commit().catch(async (err) => {
          errorEmitter.emit('permission-error', new FirestorePermissionError({
              path: jobRef.path,
              operation: 'delete'
          }));
      }).finally(() => {
          setIsCanceling(null);
          toast({ title: "Pelatihan Dibatalkan" });
      });
  };

  return (
    <Card className="bg-card/40 backdrop-blur-lg border-white/5 shadow-2xl relative overflow-hidden group">
        <div className="absolute top-0 left-0 w-1 h-full bg-accent/40 group-hover:bg-accent transition-colors" />
        <CardHeader className="p-6">
            <CardTitle className="text-xl font-poiret-one tracking-widest text-accent uppercase flex items-center gap-2">
                <Swords className="h-5 w-5" /> Pusat Mobilisasi
            </CardTitle>
            <CardDescription className="text-[10px] uppercase tracking-widest opacity-60">Latih divisi militer dari rakyat yang tersedia.</CardDescription>
        </CardHeader>
        <CardContent className="p-6 pt-0 space-y-4">
            <ScrollArea className="h-[350px] pr-4">
                <div className="space-y-3">
                    {unitDetails.map(unit => {
                        const owned = userProfile?.units?.[unit.id as keyof typeof userProfile.units] || 0;
                        const cost = unitCosts[unit.id] || 0;
                        const amount = amounts[unit.id] || 0;
                        return (
                            <motion.div 
                              layout
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              key={unit.id} 
                              className="p-3 rounded-xl bg-white/5 border border-white/5 flex flex-col sm:flex-row items-center gap-4 group/item hover:border-accent/30 hover:bg-white/10 transition-all duration-300"
                            >
                                <div className="flex-1 w-full text-center sm:text-left">
                                    <div className="flex items-center justify-center sm:justify-start gap-2">
                                        <p className="font-bold text-sm uppercase tracking-wider">{unit.name}</p>
                                        <Dialog><DialogTrigger asChild><Info className="h-3 w-3 opacity-30 cursor-pointer hover:opacity-100" /></DialogTrigger><DialogContent className="glass-card"><DialogHeader><DialogTitle>{unit.name}</DialogTitle><DialogDescription>{unit.description}</DialogDescription></DialogHeader></DialogContent></Dialog>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Dimiliki: <span className="text-white font-mono">{Math.floor(owned).toLocaleString()}</span></p>
                                    <p className="text-[10px] text-accent/60 uppercase tracking-widest">Latih: <span className="font-mono">{Math.floor(cost).toLocaleString()} Uang</span></p>
                                </div>
                                <div className="w-full sm:w-24">
                                    <Input type="number" placeholder="0" className="h-8 bg-white/5 border-white/10 font-gruppo text-center" value={amount || ''} onChange={e => setAmounts(prev => ({...prev, [unit.id]: Number(e.target.value)}))} />
                                </div>
                                <div className="flex gap-2 w-full sm:w-auto">
                                    <Button 
                                      size="sm" 
                                      className="h-8 flex-1 text-[9px] uppercase font-bold bg-accent text-accent-foreground hover:shadow-[0_0_10px_rgba(234,179,8,0.3)] transition-all" 
                                      onClick={() => handleTrain(unit.id, amount)} 
                                      disabled={isProcessing || amount <= 0}
                                    >
                                      {isProcessing && amounts[unit.id] === amount ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Latih'}
                                    </Button>
                                    <Button size="sm" variant="ghost" className="h-8 flex-1 text-destructive text-[9px] uppercase font-bold border border-destructive/20 hover:bg-destructive/10" onClick={() => handleDismiss(unit.id, amount)} disabled={isProcessing || amount <= 0 || amount > owned}>Pecat</Button>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            </ScrollArea>

            <AnimatePresence>
              {trainingQueue.length > 0 && (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    className="space-y-2 mt-4 pt-4 border-t border-white/5"
                  >
                      <p className="text-[9px] uppercase font-bold tracking-[0.3em] text-accent/60 text-center">Antrian Divisi</p>
                      <div className="space-y-2">
                        {trainingQueue.map((job, idx) => (
                            <motion.div 
                              layout
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.95 }}
                              key={job.id} 
                              className={cn(
                                "flex justify-between items-center p-3 rounded-xl bg-accent/5 border border-accent/10 transition-all",
                                idx === 0 && "animate-pulse border-accent/30 shadow-[0_0_15px_rgba(234,179,8,0.1)]"
                              )}
                            >
                                <div className="text-[10px] uppercase font-bold tracking-wider">
                                    {job.items[0]?.amount}x {unitDetailsMap[job.items[0]?.unitId as keyof typeof unitDetailsMap]?.name}
                                    <div className="flex items-center gap-2 mt-0.5 opacity-60"><Zap className="h-3 w-3" /><Countdown to={job.completionTime} /></div>
                                </div>
                                <div className="flex gap-1">
                                    <Button size="icon" variant="ghost" className="h-7 w-7 text-accent hover:bg-accent/20" onClick={() => handleRushTraining(job.id)} disabled={!!isRushing} title="Percepat 1 Jam"><Zap className="h-3.5 w-3.5" /></Button>
                                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:bg-accent/20" onClick={() => handleCancelTraining(job)} disabled={!!isCanceling} title="Batalkan"><X className="h-3.5 w-3.5" /></Button>
                                </div>
                            </motion.div>
                        ))}
                      </div>
                  </motion.div>
              )}
            </AnimatePresence>
        </CardContent>
    </Card>
  );
}