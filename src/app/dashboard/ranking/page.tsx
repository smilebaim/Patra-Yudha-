'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/firebase/auth/auth-context';
import { collection, query, onSnapshot, getDoc, doc } from 'firebase/firestore';
import { useEffect, useMemo, useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Crown, Users, User, LandPlot, Globe, Star, TrendingUp, Map as MapIcon, Aperture, Trophy, ChevronRight, RefreshCcw, ArrowUpDown } from 'lucide-react';
import { useFirestore } from '@/firebase/firestore/firestore-context';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';
import { ScrollArea } from '@/components/ui/scroll-area';

interface AllianceMember {
  id: string;
  prideName: string;
  pride: number;
  land: number;
  province: string;
}

interface Alliance {
    id: string;
    name: string;
    tag: string;
    coordinates: { x: number; y: number };
    logoUrl?: string;
    leaderId?: string | null;
    memberCount?: number;
    province: string;
    totalPride?: number;
    totalLand?: number;
}

interface User {
  uid: string;
  prideName: string;
  province: string;
  role: 'admin' | 'user';
  land?: number;
  pride?: number;
  allianceId?: string;
  coordinates?: { x: number; y: number };
  zodiac?: string;
}

interface GameTitle {
  id: string;
  name: string;
  prideRequired: number;
}

interface ProvinceRanking {
    province: string;
    totalPride: number;
    totalLand: number;
    userCount: number;
}

interface ZodiacRanking {
    zodiac: string;
    totalPride: number;
    totalLand: number;
    userCount: number;
}

export default function RankingPage() {
    const { db } = useFirestore();
    const itemsPerPage = 10;

    const [allMapAlliances, setAllMapAlliances] = useState<Alliance[]>([]);
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [allTitles, setAllTitles] = useState<GameTitle[]>([]);
    const [isLoadingData, setIsLoadingData] = useState(true);
    const [zodiacBuffSettings, setZodiacBuffSettings] = useState<any>(null);
    const [sortBy, setSortBy] = useState<'pride' | 'land'>('pride');

    const [prideRanking, setPrideRanking] = useState<User[]>([]);
    const [allianceRanking, setAllianceRanking] = useState<Alliance[]>([]);
    const [provinceRanking, setProvinceRanking] = useState<ProvinceRanking[]>([]);
    const [zodiacRanking, setZodiacRanking] = useState<ZodiacRanking[]>([]);

    const [prideRankingPage, setPrideRankingPage] = useState(1);
    const [allianceRankingPage, setAllianceRankingPage] = useState(1);
    const [provinceRankingPage, setProvinceRankingPage] = useState(1);
    const [zodiacRankingPage, setZodiacRankingPage] = useState(1);
    
    const [selectedAllianceMembers, setSelectedAllianceMembers] = useState<AllianceMember[]>([]);
    const [selectedProvincePlayers, setSelectedProvincePlayers] = useState<User[]>([]);
    const [selectedZodiacPlayers, setSelectedZodiacPlayers] = useState<User[]>([]);

    useEffect(() => {
        if (!db) { setIsLoadingData(false); return; }
        const titlesUnsub = onSnapshot(collection(db, 'titles'), (snapshot) => {
            const titlesList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any })) as GameTitle[];
            titlesList.sort((a, b) => a.prideRequired - b.prideRequired);
            setAllTitles(titlesList);
        }, (err) => errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'titles', operation: 'list' })));

        onSnapshot(doc(db, 'game-settings', 'zodiac-buffs'), (docSnap) => {
            if (docSnap.exists()) setZodiacBuffSettings(docSnap.data());
        }, (err) => errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'game-settings/zodiac-buffs', operation: 'get' })));

        const unsubAlliances = onSnapshot(collection(db, 'alliances'), (snapshot) => setAllMapAlliances(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Alliance))));
        const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
            setAllUsers(snapshot.docs.map(doc => doc.data() as User));
            setIsLoadingData(false);
        });
        
        return () => { titlesUnsub(); unsubAlliances(); unsubUsers(); };
    }, [db]);

    const getTitleName = useCallback((pride: number): string => {
        if (!allTitles || allTitles.length === 0) return 'Tanpa Gelar';
        const achievedTitle = [...allTitles].reverse().find(t => pride >= t.prideRequired);
        return achievedTitle ? achievedTitle.name : 'Tanpa Gelar';
    }, [allTitles]);

    useEffect(() => {
        if (allUsers.length > 0) {
            const nonAdminUsers = allUsers.filter(u => u.role !== 'admin');
            setPrideRanking([...nonAdminUsers].sort((a, b) => sortBy === 'pride' ? (b.pride ?? 0) - (a.pride ?? 0) : (b.land ?? 0) - (a.land ?? 0)));

            const provinceStats: { [province: string]: any } = {};
            nonAdminUsers.forEach(user => {
                if (user.province) {
                    if (!provinceStats[user.province]) provinceStats[user.province] = { totalPride: 0, totalLand: 0, userCount: 0 };
                    provinceStats[user.province].totalPride += user.pride ?? 0;
                    provinceStats[user.province].totalLand += user.land ?? 0;
                    provinceStats[user.province].userCount++;
                }
            });
            setProvinceRanking(Object.entries(provinceStats).map(([province, stats]) => ({ province, ...stats })).sort((a, b) => sortBy === 'pride' ? b.totalPride - a.totalPride : b.totalLand - a.totalLand));

            const zodiacStats: { [zodiac: string]: any } = {};
            nonAdminUsers.forEach(user => {
                if (user.zodiac) {
                    if (!zodiacStats[user.zodiac]) zodiacStats[user.zodiac] = { totalPride: 0, totalLand: 0, userCount: 0 };
                    zodiacStats[user.zodiac].totalPride += user.pride ?? 0;
                    zodiacStats[user.zodiac].totalLand += user.land ?? 0;
                    zodiacStats[user.zodiac].userCount++;
                }
            });
            setZodiacRanking(Object.entries(zodiacStats).map(([zodiac, stats]) => ({ zodiac, ...stats })).sort((a, b) => sortBy === 'pride' ? b.totalPride - a.totalPride : b.totalLand - a.totalLand));
        }

        if (allUsers.length > 0 && allMapAlliances.length > 0) {
            const allianceStats: { [id: string]: any } = {};
            allMapAlliances.forEach(a => allianceStats[a.id] = { totalPride: 0, totalLand: 0 });
            allUsers.filter(u => u.role !== 'admin').forEach(user => {
                if (user.allianceId && allianceStats[user.allianceId]) {
                    allianceStats[user.allianceId].totalPride += user.pride ?? 0;
                    allianceStats[user.allianceId].totalLand += user.land ?? 0;
                }
            });
            setAllianceRanking(allMapAlliances.map(a => ({ ...a, totalPride: allianceStats[a.id]?.totalPride || 0, totalLand: allianceStats[a.id]?.totalLand || 0 })).sort((a, b) => sortBy === 'pride' ? (b.totalPride ?? 0) - (a.totalPride ?? 0) : (b.totalLand ?? 0) - (a.totalLand ?? 0)));
        }
    }, [allUsers, allMapAlliances, sortBy]);

    const currentPrideRanking = useMemo(() => prideRanking.slice((prideRankingPage - 1) * itemsPerPage, prideRankingPage * itemsPerPage), [prideRanking, prideRankingPage]);
    const totalPrideRankingPages = Math.ceil(prideRanking.length / itemsPerPage);
    const currentAllianceRanking = useMemo(() => allianceRanking.slice((allianceRankingPage - 1) * itemsPerPage, allianceRankingPage * itemsPerPage), [allianceRanking, allianceRankingPage]);
    const totalAllianceRankingPages = Math.ceil(allianceRanking.length / itemsPerPage);
    const currentProvinceRanking = useMemo(() => provinceRanking.slice((provinceRankingPage - 1) * itemsPerPage, provinceRankingPage * itemsPerPage), [provinceRanking, provinceRankingPage]);
    const totalProvinceRankingPages = Math.ceil(provinceRanking.length / itemsPerPage);
    const currentZodiacRanking = useMemo(() => zodiacRanking.slice((zodiacRankingPage - 1) * itemsPerPage, zodiacRankingPage * itemsPerPage), [zodiacRanking, zodiacRankingPage]);
    const totalZodiacRankingPages = Math.ceil(zodiacRanking.length / itemsPerPage);

    const handleAllianceClick = useCallback((id: string) => {
      setSelectedAllianceMembers(allUsers.filter(u => u.allianceId === id && u.role !== 'admin').map(u => ({ id: u.uid, prideName: u.prideName, pride: u.pride || 0, land: u.land || 0, province: '' })).sort((a, b) => b.pride - a.pride));
    }, [allUsers]);

    if (isLoadingData) return <div className="flex flex-col items-center justify-center py-20 gap-4"><Globe className="h-10 w-10 text-primary animate-spin" /><p className="font-poiret-one text-lg tracking-widest uppercase">Mengkoneksikan Ranking...</p></div>;

    return (
      <div className="space-y-4 animate-in fade-in duration-500">
        <div className="flex justify-between items-center bg-card/40 backdrop-blur-md p-3 rounded-lg border border-white/5">
            <h1 className="font-poiret-one text-lg tracking-widest uppercase font-bold text-primary">Dewan Tertinggi</h1>
            <Button variant="outline" size="sm" onClick={() => setSortBy(sortBy === 'pride' ? 'land' : 'pride')} className="uppercase text-[8px] font-bold tracking-widest h-7">
                Sortir: {sortBy === 'pride' ? 'WIBAWA' : 'LAHAN'}
            </Button>
        </div>

        <Tabs defaultValue="pride-ranking" className="w-full">
            <TabsList className="grid w-full grid-cols-4 h-10 p-1 border border-white/5 rounded-lg bg-card/40">
                <TabsTrigger value="pride-ranking" className="font-bold uppercase tracking-widest text-[8px] h-full rounded-md transition-all">Wibawa</TabsTrigger>
                <TabsTrigger value="alliance-ranking" className="font-bold uppercase tracking-widest text-[8px] h-full rounded-md transition-all">Aliansi</TabsTrigger>
                <TabsTrigger value="province-ranking" className="font-bold uppercase tracking-widest text-[8px] h-full rounded-md transition-all">Wilayah</TabsTrigger>
                <TabsTrigger value="zodiac-ranking" className="font-bold uppercase tracking-widest text-[8px] h-full rounded-md transition-all">Zodiak</TabsTrigger>
            </TabsList>
            
            <TabsContent value="pride-ranking" className="mt-4 space-y-4">
                <Card className="bg-card/30 backdrop-blur-lg border-white/5 shadow-xl overflow-hidden">
                    <ScrollArea className="h-[350px]">
                        <Table>
                            <TableHeader className="bg-white/5 sticky top-0 z-10"><TableRow><TableHead className="w-10 text-center">#</TableHead><TableHead>Bangsawan</TableHead><TableHead className="text-right">{sortBy === 'pride' ? 'Wibawa' : 'Lahan'}</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {currentPrideRanking.map((u, i) => (
                                    <TableRow key={u.uid} className="h-12 border-white/5 hover:bg-white/5 cursor-pointer">
                                        <TableCell className="text-center font-gruppo opacity-40">{(prideRankingPage-1)*itemsPerPage+i+1}</TableCell>
                                        <TableCell>
                                            <div className="font-bold text-[11px] text-white uppercase truncate max-w-[120px]">{u.prideName}</div>
                                            <div className="flex items-center gap-2 text-[8px] uppercase font-bold tracking-tighter">
                                                <span className="text-primary/70">{getTitleName(u.pride || 0)}</span>
                                                <span className="opacity-30">•</span>
                                                <span className="opacity-40">{u.province}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right font-gruppo text-primary font-bold">{Math.floor(sortBy === 'pride' ? (u.pride || 0) : (u.land || 0)).toLocaleString()}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </ScrollArea>
                    {totalPrideRankingPages > 1 && <CardFooter className="p-2 border-t border-white/5 flex justify-between"><Button variant="ghost" size="sm" className="h-7 text-[8px] uppercase font-bold" onClick={() => setPrideRankingPage(p => Math.max(p-1,1))}>Prev</Button><span className="text-[8px] font-bold opacity-40">Hal {prideRankingPage} / {totalPrideRankingPages}</span><Button variant="ghost" size="sm" className="h-7 text-[8px] uppercase font-bold" onClick={() => setPrideRankingPage(p => Math.min(p+1,totalPrideRankingPages))}>Next</Button></CardFooter>}
                </Card>
            </TabsContent>

            <TabsContent value="alliance-ranking" className="mt-4 space-y-4">
                <Card className="bg-card/30 border-white/5 shadow-xl overflow-hidden">
                    <ScrollArea className="h-[350px]">
                        <Table>
                            <TableHeader className="bg-white/5 sticky top-0 z-10"><TableRow><TableHead className="w-10 text-center">#</TableHead><TableHead>Aliansi</TableHead><TableHead className="text-right">{sortBy === 'pride' ? 'Tot. Wibawa' : 'Tot. Lahan'}</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {currentAllianceRanking.map((a, i) => (
                                    <TableRow key={a.id} className="h-12 border-white/5 hover:bg-white/5 cursor-pointer" onClick={() => handleAllianceClick(a.id)}>
                                        <TableCell className="text-center font-gruppo opacity-40">{(allianceRankingPage-1)*itemsPerPage+i+1}</TableCell>
                                        <TableCell><div className="font-bold text-xs uppercase truncate max-w-[120px]">{a.name}</div><div className="text-[8px] opacity-40">Pop: {a.memberCount || 0}</div></TableCell>
                                        <TableCell className="text-right font-gruppo text-primary font-bold">{Math.floor(sortBy === 'pride' ? (a.totalPride || 0) : (a.totalLand || 0)).toLocaleString()}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </ScrollArea>
                    {totalAllianceRankingPages > 1 && <CardFooter className="p-2 border-t border-white/5 flex justify-between"><Button variant="ghost" size="sm" className="h-7 text-[8px] uppercase font-bold" onClick={() => setAllianceRankingPage(p => Math.max(p-1,1))}>Prev</Button><span className="text-[8px] font-bold opacity-40">Hal {allianceRankingPage} / {totalAllianceRankingPages}</span><Button variant="ghost" size="sm" className="h-7 text-[8px] uppercase font-bold" onClick={() => setAllianceRankingPage(p => Math.min(p+1,totalAllianceRankingPages))}>Next</Button></CardFooter>}
                </Card>
            </TabsContent>

            <TabsContent value="province-ranking" className="mt-4 space-y-4">
                <Card className="bg-card/30 border-white/5 overflow-hidden">
                    <ScrollArea className="h-[350px]">
                        <Table>
                            <TableHeader className="bg-white/5 sticky top-0 z-10"><TableRow><TableHead className="w-10 text-center">#</TableHead><TableHead>Provinsi</TableHead><TableHead className="text-right">{sortBy === 'pride' ? 'Wibawa' : 'Lahan'}</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {currentProvinceRanking.map((p, i) => (
                                    <TableRow key={p.province} className="h-12 border-white/5 hover:bg-white/5">
                                        <TableCell className="text-center font-gruppo opacity-40">{(provinceRankingPage-1)*itemsPerPage+i+1}</TableCell>
                                        <TableCell><div className="font-bold text-xs uppercase">{p.province}</div><div className="text-[8px] opacity-40">Pops: {p.userCount}</div></TableCell>
                                        <TableCell className="text-right font-gruppo text-primary font-bold">{Math.floor(sortBy === 'pride' ? p.totalPride : p.totalLand).toLocaleString()}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </ScrollArea>
                    {totalProvinceRankingPages > 1 && <CardFooter className="p-2 border-t border-white/5 flex justify-between"><Button variant="ghost" size="sm" className="h-7 text-[8px] uppercase font-bold" onClick={() => setProvinceRankingPage(p => Math.max(p-1,1))}>Prev</Button><span className="text-[8px] font-bold opacity-40">Hal {provinceRankingPage} / {totalProvinceRankingPages}</span><Button variant="ghost" size="sm" className="h-7 text-[8px] uppercase font-bold" onClick={() => setProvinceRankingPage(p => Math.min(p+1,totalProvinceRankingPages))}>Next</Button></CardFooter>}
                </Card>
            </TabsContent>

            <TabsContent value="zodiac-ranking" className="mt-4 space-y-4">
                <Card className="bg-card/30 border-white/5 overflow-hidden">
                    <ScrollArea className="h-[350px]">
                        <Table>
                            <TableHeader className="bg-white/5 sticky top-0 z-10"><TableRow><TableHead className="w-10 text-center">#</TableHead><TableHead>Zodiak</TableHead><TableHead className="text-right">{sortBy === 'pride' ? 'Wibawa' : 'Lahan'}</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {currentZodiacRanking.map((z, i) => (
                                    <TableRow key={z.zodiac} className="h-12 border-white/5 hover:bg-white/5">
                                        <TableCell className="text-center font-gruppo opacity-40">{(zodiacRankingPage-1)*itemsPerPage+i+1}</TableCell>
                                        <TableCell><div className="font-bold text-xs uppercase">{z.zodiac}</div><div className="text-[8px] opacity-40">Pops: {z.userCount}</div></TableCell>
                                        <TableCell className="text-right font-gruppo text-primary font-bold">{Math.floor(sortBy === 'pride' ? z.totalPride : z.totalLand).toLocaleString()}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </ScrollArea>
                    {totalZodiacRankingPages > 1 && <CardFooter className="p-2 border-t border-white/5 flex justify-between"><Button variant="ghost" size="sm" className="h-7 text-[8px] uppercase font-bold" onClick={() => setZodiacRankingPage(p => Math.max(p-1,1))}>Prev</Button><span className="text-[8px] font-bold opacity-40">Hal {zodiacRankingPage} / {totalZodiacRankingPages}</span><Button variant="ghost" size="sm" className="h-7 text-[8px] uppercase font-bold" onClick={() => setZodiacRankingPage(p => Math.min(p+1,totalZodiacRankingPages))}>Next</Button></CardFooter>}
                </Card>
            </TabsContent>
        </Tabs>
      </div>
    );
}
