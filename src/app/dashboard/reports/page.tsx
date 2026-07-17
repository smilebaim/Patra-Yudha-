
'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/firebase/auth/auth-context';
import { useFirestore } from '@/firebase/firestore/firestore-context';
import { collection, query, where, onSnapshot, doc, updateDoc, deleteDoc, writeBatch, limit, orderBy, Timestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { format, formatDistanceToNow } from 'date-fns';
import { id } from 'date-fns/locale';
import { ShieldAlert, ShieldCheck, ShieldOff, Swords, Trash2, ArrowRight, TrendingUp, TrendingDown, ShieldQuestion, Home, ChevronsRight, Info, Coins, Beef, Building, LandPlot, Star, Send, Mailbox, Trophy, Skull, RefreshCcw, Filter, ChevronDown, ChevronRight, Gavel, Loader2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';
import { logError } from '@/lib/errorHandler';
import { motion, AnimatePresence } from 'framer-motion';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Report {
    id: string;
    userId: string;
    type: string;
    isRead: boolean;
    timestamp: any;
    details: any;
}

const reportIcons: { [key: string]: React.FC<any> } = {
    'war-victory': Trophy, 'war-defeat': Skull, 'war-defense-victory': ShieldCheck,
    'war-defense-defeat': ShieldAlert, 'raid-victory': Swords, 'raid-defense-defeat': ShieldOff,
    'raid-failure': ShieldQuestion, 'troops-returned': Home, 'war-ended': Info,
    'aid-sent': Send, 'aid-received': Send, 'war-declared': Gavel,
};

const reportTitles: { [key: string]: string } = {
    'war-victory': 'Menang Invasi', 'war-defeat': 'Gagal Invasi', 'war-defense-victory': 'Tahan Invasi',
    'war-defense-defeat': 'Jebol Invasi', 'raid-victory': 'Menang Jarah', 'raid-defense-defeat': 'Kena Jarah',
    'raid-failure': 'Gagal Jarah', 'troops-returned': 'Pasukan Kembali', 'war-ended': 'Gencatan Senjata',
    'aid-sent': 'Kirim Bantuan', 'aid-received': 'Terima Bantuan', 'war-declared': 'Deklarasi Perang',
};

export default function ReportsPage() {
    const { user } = useAuth();
    const { db } = useFirestore();
    const { toast } = useToast();
    const [reports, setReports] = useState<Report[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [displayLimit, setDisplayLimit] = useState(20);
    const [hasMore, setHasMore] = useState(true);
    const [filter, setFilter] = useState('all');

    useEffect(() => {
        if (!user || !db) return;
        setIsLoading(true);
        const reportsRef = collection(db, 'reports');
        // We avoid complex orderBy that requires composite index initially
        // We will sort manually on the client side for the first batch to avoid the error
        const baseQuery = query(
          reportsRef, 
          where('userId', '==', user.uid), 
          limit(displayLimit)
        );

        const unsubscribe = onSnapshot(baseQuery, (snap) => {
            const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Report[];
            // Manual client-side sort to avoid index error if index is not ready
            list.sort((a, b) => {
                const timeA = a.timestamp?.toMillis?.() || 0;
                const timeB = b.timestamp?.toMillis?.() || 0;
                return timeB - timeA;
            });
            setReports(list);
            setHasMore(snap.docs.length >= displayLimit);
            setIsLoading(false);
        }, (err) => { 
            // If the error is still about index, we inform the user but don't crash
            if (err.message.includes('requires an index')) {
                console.warn("Firestore index is still provisioning. Some features might be limited.");
            }
            logError(err); 
            setIsLoading(false); 
        });
        return () => unsubscribe();
    }, [user, db, displayLimit]);

    const filteredReports = useMemo(() => {
        if (filter === 'all') return reports;
        if (filter === 'war') return reports.filter(r => r.type.includes('war'));
        if (filter === 'raid') return reports.filter(r => r.type.includes('raid'));
        if (filter === 'aid') return reports.filter(r => r.type.includes('aid'));
        return reports;
    }, [reports, filter]);

    const handleMarkAsRead = (id: string) => {
        if (!db) return;
        updateDoc(doc(db, 'reports', id), { isRead: true }).catch(err => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: `reports/${id}`,
                operation: 'update',
                requestResourceData: { isRead: true }
            }));
        });
    };

    const handleDeleteAll = async () => {
        if (!db || reports.length === 0) return;
        const batch = writeBatch(db);
        reports.forEach(r => batch.delete(doc(db, 'reports', r.id)));
        await batch.commit().then(() => {
            toast({ title: "Arsip Laporan Dibersihkan" });
        }).catch(err => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: 'reports_batch_delete',
                operation: 'delete'
            }));
        });
    };

    return (
        <Card className="bg-card/40 backdrop-blur-xl border-white/5 shadow-2xl overflow-hidden h-full flex flex-col min-h-0">
            <CardHeader className="p-4 md:p-6 border-b border-white/5 flex flex-row items-center justify-between shrink-0">
                <div>
                    <CardTitle className="text-xl font-poiret-one uppercase tracking-widest text-primary">Arsip Intel</CardTitle>
                    <CardDescription className="text-[10px] uppercase font-bold opacity-40">Dokumentasi taktis wilayah kekuasaan.</CardDescription>
                </div>
                <div className="flex gap-2">
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" disabled={reports.length === 0} className="h-8 text-[9px] uppercase font-bold border border-destructive/20 text-destructive hover:bg-destructive/10">Hapus Semua</Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="glass-card">
                            <AlertDialogHeader>
                                <AlertDialogTitle className="text-sm uppercase tracking-widest text-destructive">Pemusnahan Data Intelijen</AlertDialogTitle>
                                <AlertDialogDescription className="text-xs">Tindakan ini akan menghapus seluruh rekaman laporan yang tampil secara permanen dari basis data militer. Lanjutkan?</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter className="gap-2">
                                <AlertDialogCancel className="h-8 text-xs">Batal</AlertDialogCancel>
                                <AlertDialogAction className="h-8 text-xs bg-destructive" onClick={handleDeleteAll}>Ya, Musnahkan</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            </CardHeader>
            
            <div className="p-2 border-b border-white/5 flex gap-1 overflow-x-auto bg-white/5 shrink-0">
                {['all', 'war', 'raid', 'aid'].map(f => (
                    <Button 
                        key={f} 
                        variant={filter === f ? 'secondary' : 'ghost'} 
                        size="sm" 
                        onClick={() => setFilter(f)} 
                        className={cn(
                            "h-7 px-4 text-[8px] uppercase font-bold rounded-full transition-all", 
                            filter === f ? "bg-primary/20 text-primary border border-primary/30" : "opacity-40 hover:opacity-100"
                        )}
                    >
                        {f === 'all' ? 'SEMUA' : f === 'war' ? 'PERANG' : f === 'raid' ? 'JARAHAN' : 'BANTUAN'}
                    </Button>
                ))}
            </div>

            <CardContent className="p-0 flex-1 relative overflow-hidden flex flex-col">
                <ScrollArea className="h-full w-full">
                    <div className="p-4 space-y-2">
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-50">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                <p className="text-[10px] uppercase font-bold tracking-widest">Mendekripsi Data...</p>
                            </div>
                        ) : filteredReports.length > 0 ? (
                            <AnimatePresence mode="popLayout">
                                {filteredReports.map((r) => {
                                    const Icon = reportIcons[r.type] || Info;
                                    return (
                                        <motion.div 
                                            layout
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                            key={r.id} 
                                            onClick={() => !r.isRead && handleMarkAsRead(r.id)} 
                                            className={cn(
                                                "p-3 rounded-lg border transition-all cursor-pointer group hover:border-primary/40", 
                                                r.isRead ? 'bg-white/5 border-transparent' : 'bg-primary/10 border-primary/20 shadow-[0_0_15px_rgba(234,179,8,0.1)]'
                                            )}
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className={cn(
                                                    "h-10 w-10 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                                                    r.isRead ? "bg-white/5" : "bg-primary/20"
                                                )}>
                                                    <Icon className={cn("h-5 w-5", r.isRead ? "text-primary/40" : "text-primary")} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <p className="font-bold text-[11px] uppercase tracking-wider truncate text-white">
                                                            {reportTitles[r.type] || 'Laporan Diplomatik'}
                                                        </p>
                                                        {!r.isRead && <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />}
                                                    </div>
                                                    <div className="flex items-center gap-2 text-[9px] opacity-40 uppercase font-bold tracking-tighter">
                                                        <span>{r.timestamp ? formatDistanceToNow(r.timestamp.toDate(), { locale: id, addSuffix: true }) : 'Baru saja'}</span>
                                                        <span>•</span>
                                                        <span className="truncate">{r.details?.message?.substring(0, 40) || 'Informasi Intelijen...'}...</span>
                                                    </div>
                                                </div>
                                                <ChevronRight className="h-4 w-4 opacity-20 group-hover:opacity-100 group-hover:text-primary transition-all" />
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </AnimatePresence>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-32 opacity-20 space-y-4">
                                <Mailbox className="h-16 w-16" />
                                <p className="text-xs uppercase font-bold tracking-[0.3em]">Arsip Kosong</p>
                            </div>
                        )}
                        
                        {hasMore && filteredReports.length >= 20 && (
                            <Button 
                                variant="ghost" 
                                onClick={() => setDisplayLimit(prev => prev + 20)} 
                                className="w-full h-10 text-[9px] uppercase font-bold opacity-40 hover:opacity-100 hover:bg-white/5 border border-dashed border-white/10"
                            >
                                Dekripsi Laporan Tambahan
                            </Button>
                        )}
                    </div>
                </ScrollArea>
            </CardContent>
        </Card>
    );
}
