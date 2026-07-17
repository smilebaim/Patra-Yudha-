
'use client';

import { Building2, Shield, LandPlot, Users, Zap, TrendingUp, Heart, Hammer, Swords, History, Clock } from "lucide-react";
import BarracksView from "@/app/dashboard/markas/barracks-view";
import BuildingsView from "@/app/dashboard/markas/buildings-view";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/firebase/auth/auth-context";
import { useEffect, useMemo, useState } from "react";
import { useFirestore } from "@/firebase/firestore/firestore-context";
import { collection, onSnapshot, query, where, Timestamp, orderBy, limit } from "firebase/firestore";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";
import { id } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";

interface QueueItem {
  id: string;
  items: { buildingId: string; amount: number }[];
  completionTime: Timestamp;
}

interface GameTitle {
  id: string;
  name: string;
  prideRequired: number;
  resourceBonus: number;
}

interface LogisticsReport {
    id: string;
    type: string;
    timestamp: Timestamp;
    details: {
        message: string;
    };
}

export default function MarkasPage() {
    const { user, userProfile, buildingEffects } = useAuth();
    const { db } = useFirestore();
    const [constructionQueue, setConstructionQueue] = useState<QueueItem[]>([]);
    const [titles, setTitles] = useState<GameTitle[]>([]);
    const [logisticsLogs, setLogisticsLogs] = useState<LogisticsReport[]>([]);
    const [isLoadingLogs, setIsLoadingLogs] = useState(false);

    const constructionQuery = useMemo(() => {
        if (!db || !user?.uid) return null;
        return query(collection(db, 'constructionQueue'), where('userId', '==', user.uid));
    }, [db, user?.uid]);

    const logisticsQuery = useMemo(() => {
        if (!db || !user?.uid) return null;
        return query(
            collection(db, 'reports'), 
            where('userId', '==', user.uid),
            limit(30)
        );
    }, [db, user?.uid]);

    useEffect(() => {
        if (!constructionQuery) return;
        
        const unsub = onSnapshot(constructionQuery, (snapshot) => {
            const queue = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as QueueItem));
            setConstructionQueue(queue);
        }, async (err: any) => {
            const permissionError = new FirestorePermissionError({ 
                path: 'constructionQueue', 
                operation: 'list' 
            } satisfies SecurityRuleContext);
            errorEmitter.emit('permission-error', permissionError);
        });
        
        if (!db) return;
        const titlesUnsub = onSnapshot(collection(db, 'titles'), (snapshot) => {
          const titlesList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as GameTitle[];
          setTitles(titlesList);
        }, (err) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'titles', operation: 'list' }));
        });

        setIsLoadingLogs(true);
        const logsUnsub = onSnapshot(logisticsQuery!, (snapshot) => {
            const logs = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() } as LogisticsReport))
                .filter(log => log.type === 'troops-returned' || log.type === 'construction-completed' || log.details?.message?.toLowerCase().includes('selesai') || log.details?.message?.toLowerCase().includes('bangun'));
            
            logs.sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis());
            setLogisticsLogs(logs);
            setIsLoadingLogs(false);
        });

        return () => { unsub(); titlesUnsub(); logsUnsub(); };
    }, [constructionQuery, db, logisticsQuery]);

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

    const cumulativeEffects = useMemo(() => {
        if (!userProfile?.buildings || !buildingEffects) return null;
        
        const b = userProfile.buildings;
        const e = buildingEffects;

        const currentTitle = [...titles].sort((a, b) => a.prideRequired - b.prideRequired).reverse().find(t => (userProfile.pride ?? 0) >= t.prideRequired) || null;
        const titleBonus = currentTitle ? (currentTitle.resourceBonus / 100) : 0;
        const universityBonus = (b.university || 0) * (e.university?.foodAndMoneyBonus || 0) / 100;
        const totalResourceMultiplier = 1 + titleBonus + universityBonus;

        return {
            moneyRate: (b.tambang || 0) * (e.tambang?.money || 0) * totalResourceMultiplier,
            foodRate: (b.farm || 0) * (e.farm?.food || 0) * totalResourceMultiplier,
            popRate: (b.residence || 0) * (e.residence?.unemployed || 0),
            popCap: (b.residence || 0) * (e.residence?.capacity || 0),
            defBonus: (b.fort || 0) * (e.fort?.defenseBonus || 0),
            atkBonus: (b.mobility || 0) * (e.mobility?.attackBonus || 0),
            trainBonus: (b.barracks || 0) * (e.barracks?.trainingBonus || 0),
            constBonus: (b.university || 0) * (e.university?.constructionBonus || 0),
            resourceBonus: Math.round((totalResourceMultiplier - 1) * 100),
        };
    }, [userProfile?.buildings, userProfile?.pride, buildingEffects, titles]);

    const totalPop = (userProfile?.unemployed ?? 0) + Object.values(userProfile?.units ?? {}).reduce((a,b) => a+(b||0), 0);

    return (
        <div className="space-y-4 animate-in fade-in duration-500">
            <Card className="bg-card/30 backdrop-blur-xl border-white/5 shadow-lg">
                <CardContent className="p-3 grid grid-cols-2 md:grid-cols-5 gap-2 text-sm">
                    {[
                        { label: "Rakyat", value: userProfile?.unemployed, icon: Users, unit: "Jiwa" },
                        { label: "Lahan", value: emptyLand, icon: LandPlot, unit: "Petak", danger: emptyLand < 10 },
                        { label: "Populasi", value: totalPop, sub: cumulativeEffects?.popCap, icon: Building2, unit: "Jiwa" },
                        { label: "B. Bangun", value: cumulativeEffects?.constBonus, icon: Hammer, unit: "%", highlight: true },
                        { label: "B. Latih", value: cumulativeEffects?.trainBonus, icon: Zap, unit: "%", highlight: true },
                    ].map((item, idx) => (
                        <div key={idx} className="flex flex-col items-center justify-center p-2 rounded-lg bg-white/5 border border-white/5 group hover:bg-white/10 transition-colors">
                            <span className="text-[8px] uppercase font-bold tracking-widest text-muted-foreground mb-0.5">{item.label}</span>
                            <div className="flex items-center gap-1">
                                <item.icon className={cn("h-3 w-3 opacity-40", item.highlight && "text-primary opacity-100", item.danger && "text-destructive animate-pulse opacity-100")} />
                                <span className={cn("font-gruppo text-base font-bold tracking-widest", item.danger && "text-destructive")}>
                                    {Math.floor(item.value ?? 0).toLocaleString()}
                                </span>
                                {item.sub !== undefined && (
                                    <span className="text-[8px] text-muted-foreground font-bold">/{Math.floor(item.sub).toLocaleString()}</span>
                                )}
                            </div>
                        </div>
                    ))}
                </CardContent>
            </Card>

            <Tabs defaultValue="buildings" className="w-full">
                <TabsList className="grid w-full grid-cols-3 bg-card/40 backdrop-blur-xl h-10 p-1 border border-white/5 rounded-lg">
                    <TabsTrigger 
                        value="buildings" 
                        className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary font-bold uppercase tracking-widest text-[9px] h-full rounded-md transition-all"
                    >
                        <Building2 className="mr-1.5 h-3.5 w-3.5" />Infrastruktur
                    </TabsTrigger>
                    <TabsTrigger 
                        value="units" 
                        className="data-[state=active]:bg-accent/20 data-[state=active]:text-accent font-bold uppercase tracking-widest text-[9px] h-full rounded-md transition-all"
                    >
                        <Swords className="mr-1.5 h-3.5 w-3.5" />Militer
                    </TabsTrigger>
                    <TabsTrigger 
                        value="history" 
                        className="data-[state=active]:bg-white/10 data-[state=active]:text-white font-bold uppercase tracking-widest text-[9px] h-full rounded-md transition-all"
                    >
                        <History className="mr-1.5 h-3.5 w-3.5" />Logistik
                    </TabsTrigger>
                </TabsList>
                
                <TabsContent value="buildings" className="mt-4 animate-in slide-in-from-left-4 duration-300">
                    <BuildingsView />
                </TabsContent>
                
                <TabsContent value="units" className="mt-4 animate-in slide-in-from-right-4 duration-300">
                    <BarracksView />
                </TabsContent>

                <TabsContent value="history" className="mt-4 animate-in slide-in-from-bottom-4 duration-300">
                    <Card className="bg-card/40 backdrop-blur-lg border-white/5 shadow-2xl relative overflow-hidden h-[500px] flex flex-col">
                        <div className="absolute top-0 left-0 w-1 h-full bg-white/20" />
                        <div className="p-6 border-b border-white/5">
                            <h3 className="text-xl font-poiret-one tracking-widest uppercase flex items-center gap-2">
                                <Clock className="h-5 w-5 text-primary" /> Arsip Mobilisasi
                            </h3>
                            <p className="text-[10px] uppercase tracking-widest opacity-60">Rekaman historis pelatihan pasukan dan pembangunan infrastruktur.</p>
                        </div>
                        <ScrollArea className="flex-1">
                            <div className="p-6 space-y-3">
                                {isLoadingLogs ? (
                                    <p className="text-center py-10 opacity-40 text-xs italic animate-pulse">Mendekripsi arsip logistik...</p>
                                ) : logisticsLogs.length > 0 ? (
                                    logisticsLogs.map((log) => (
                                        <div key={log.id} className="p-3 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between gap-4">
                                            <div className="flex items-center gap-3">
                                                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                                    {log.type === 'troops-returned' ? <Swords className="h-4 w-4 text-primary" /> : <Hammer className="h-4 w-4 text-primary" />}
                                                </div>
                                                <div>
                                                    <p className="text-[11px] font-bold uppercase tracking-tight text-white">{log.details.message}</p>
                                                    <p className="text-[9px] opacity-40 uppercase font-bold tracking-tighter">
                                                        {formatDistanceToNow(log.timestamp.toDate(), { locale: id, addSuffix: true })}
                                                    </p>
                                                </div>
                                            </div>
                                            <Badge variant="outline" className="text-[8px] opacity-40">Selesai</Badge>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-20 opacity-20">
                                        <History className="h-12 w-12 mx-auto mb-4" />
                                        <p className="text-xs uppercase tracking-widest">Belum ada riwayat logistik tercatat.</p>
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    </Card>
                </TabsContent>
            </Tabs>

            {cumulativeEffects && (
                <Card className="bg-card/20 border-white/5 overflow-hidden">
                    <CardContent className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                            { label: "Produksi Uang", value: `+${Math.floor(cumulativeEffects.moneyRate).toLocaleString()}/jam`, sub: "Tambang", icon: Zap },
                            { label: "Produksi Makanan", value: `+${Math.floor(cumulativeEffects.foodRate).toLocaleString()}/jam`, sub: "Sawah", icon: Zap },
                            { label: "Bonus Pertahanan", value: `+${cumulativeEffects.defBonus}%`, sub: "Benteng", icon: Shield },
                            { label: "Bonus Serangan", value: `+${cumulativeEffects.atkBonus}%`, sub: "Mobilitas", icon: Shield },
                        ].map((ef, i) => (
                            <div key={i} className="space-y-0.5">
                                <p className="text-[7px] uppercase font-bold tracking-widest text-muted-foreground">{ef.label}</p>
                                <div className="flex items-center gap-1.5">
                                    <ef.icon className="h-2.5 w-2.5 text-primary/40" />
                                    <p className="font-gruppo font-bold text-[11px] tracking-wider">{ef.value}</p>
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
