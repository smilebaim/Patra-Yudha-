'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/firebase/auth/auth-context';
import { collection, query, where, onSnapshot, doc, setDoc, updateDoc, getDoc, increment, writeBatch, getDocs, deleteDoc, addDoc, Timestamp, runTransaction, serverTimestamp } from 'firebase/firestore';
import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Crown, LogOut, Check, X, Swords, User, Send, ScrollText, Trophy, Skull, ShieldCheck, ShieldAlert, ShieldOff, ShieldQuestion, Info, Users, Settings, Globe, Pencil, AlertTriangle, Gavel, Timer, Activity, Clock } from 'lucide-react';
import { useFirestore } from '@/firebase/firestore/firestore-context';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from '@/lib/utils';
import { logError } from '@/lib/errorHandler';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';
import { formatDistanceToNow } from 'date-fns';
import { id } from 'date-fns/locale';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Image from 'next/image';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { motion, AnimatePresence } from 'framer-motion';

interface AllianceMember {
  id: string;
  prideName: string;
  pride: number;
  land: number;
  province: string;
  lastSeen?: Timestamp;
  lastResourceUpdate?: Timestamp;
}

interface Vote {
    voterId: string;
    candidateId: string;
    allianceId: string;
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
    atWarWith?: string | null;
    warEndTime?: Timestamp | null;
}

interface GameTitle {
  id: string;
  name: string;
  prideRequired: number;
}

interface JoinRequest {
    id: string;
    userId: string;
    userName: string;
    userPride: number;
    userTitle: string;
    allianceId: string;
    status: 'pending';
}

interface AllianceReport {
    id: string;
    type: string;
    timestamp: Timestamp;
    details: any;
}

const WarCountdown = ({ endTime }: { endTime: Timestamp | null | undefined }) => {
    const [countdown, setCountdown] = useState("Menghitung...");

    useEffect(() => {
        if (!endTime) {
            setCountdown("N/A");
            return;
        }

        const intervalId = setInterval(() => {
            const now = new Date();
            const end = endTime.toDate();
            const diff = end.getTime() - now.getTime();

            if (diff <= 0) {
                setCountdown("Berakhir");
                clearInterval(intervalId);
                return;
            }

            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);

            setCountdown(`${days}d ${hours}j ${minutes}m ${seconds}s`);
        }, 1000);

        return () => clearInterval(intervalId);
    }, [endTime]);

    return <span className="font-mono text-xs font-bold">{countdown}</span>;
};


export default function AlliancePage() {
    const { user, userProfile, playSound } = useAuth();
    const { db } = useFirestore();
    const { toast } = useToast();

    const [alliance, setAlliance] = useState<Alliance | null>(null);
    const [members, setMembers] = useState<AllianceMember[]>([]);
    const [votes, setVotes] = useState<Vote[]>([]);
    const [selectedCandidate, setSelectedCandidate] = useState<string>('');
    const [isVoting, setIsVoting] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [leaveAlliancePrideCost, setLeaveAlliancePrideCost] = useState(0);
    const [allianceCapacity, setAllianceCapacity] = useState(10);
    const [availableAlliances, setAvailableAlliances] = useState<Alliance[]>([]);
    const [allAlliances, setAllAlliances] = useState<Alliance[]>([]);
    const [pendingRequests, setPendingRequests] = useState<string[]>([]);
    const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
    const [isJoining, setIsJoining] = useState(false);
    const [isManagingRequest, setIsManagingRequest] = useState(false);
    
    const [combatLogs, setCombatLogs] = useState<AllianceReport[]>([]);
    const [isLoadingLogs, setIsLoadingLogs] = useState(false);
    const [activeTab, setActiveTab] = useState('alliance');
    const [lastSeenLogTime, setLastSeenLogTime] = useState<number>(0);
    const prevUnreadCountRef = useRef(0);

    const [titles, setTitles] = useState<GameTitle[]>([]);
    const [newLogoUrl, setNewLogoUrl] = useState('');
    const [newName, setNewName] = useState('');
    const [newTag, setNewTag] = useState('');
    const [selectedWarTarget, setSelectedWarTarget] = useState('');
    const [isDeclaringWar, setIsDeclaringWar] = useState(false);

    // Aid states
    const [isAidDialogOpen, setIsAidDialogOpen] = useState(false);
    const [selectedAidTarget, setSelectedAidTarget] = useState<AllianceMember | null>(null);
    const [aidAmountMoney, setAidAmountMoney] = useState(0);
    const [aidAmountFood, setAidAmountFood] = useState(0);
    const [isAidProcessing, setIsAidProcessing] = useState(false);

    const isLeader = alliance?.leaderId === user?.uid;

    const membersQuery = useMemo(() => {
        if (!db || !userProfile?.allianceId) return null;
        return query(collection(db, 'users'), where('allianceId', '==', userProfile.allianceId));
    }, [db, userProfile?.allianceId]);

    const votesQuery = useMemo(() => {
        if (!db || !userProfile?.allianceId) return null;
        return query(collection(db, 'votes'), where('allianceId', '==', userProfile.allianceId));
    }, [db, userProfile?.allianceId]);

    const logsQuery = useMemo(() => {
        if (!db) return null;
        return query(collection(db, 'reports'));
    }, [db]);

    const joinRequestsQuery = useMemo(() => {
        if (!db || !isLeader || !alliance?.id) return null;
        return query(
            collection(db, 'allianceRequests'), 
            where('allianceId', '==', alliance.id), 
            where('status', '==', 'pending')
        );
    }, [db, isLeader, alliance?.id]);

    const availableAlliancesQuery = useMemo(() => {
        if (!db || userProfile?.allianceId || !userProfile?.province) return null;
        return query(collection(db, 'alliances'), where('province', '==', userProfile.province));
    }, [db, userProfile?.allianceId, userProfile?.province]);

    const myPendingRequestsQuery = useMemo(() => {
        if (!db || !user?.uid) return null;
        return query(collection(db, 'allianceRequests'), where('userId', '==', user.uid), where('status', '==', 'pending'));
    }, [db, user?.uid]);

    useEffect(() => {
      if (!db) return;
      const titlesCollectionRef = collection(db, 'titles');
      const unsubscribe = onSnapshot(titlesCollectionRef, (snapshot) => {
        const titlesList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as GameTitle[];
        titlesList.sort((a, b) => a.prideRequired - b.prideRequired);
        setTitles(titlesList);
      }, async (err) => {
          errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'titles', operation: 'list' }));
      });
      return () => unsubscribe();
    }, [db]);
    
    useEffect(() => {
        if (!db) return;
        const fetchMechanics = async () => {
            try {
                const mechanicsDocRef = doc(db, 'game-settings', 'game-mechanics');
                const docSnap = await getDoc(mechanicsDocRef);
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    if (data.leaveAlliancePrideCost !== undefined) setLeaveAlliancePrideCost(data.leaveAlliancePrideCost);
                    if (data.allianceCapacity !== undefined) setAllianceCapacity(data.allianceCapacity);
                }
            } catch (error) {
                logError(error);
            }
        };
        fetchMechanics();
    }, [db]);

    useEffect(() => {
        if (!user?.uid || !db || !userProfile?.allianceId) {
            setAlliance(null);
            setMembers([]);
            setIsLoading(false);
            return;
        }

        const allianceId = userProfile.allianceId;
        setIsLoading(true);

        const allianceUnsub = onSnapshot(doc(db, 'alliances', allianceId), (docSnap) => {
            if (docSnap.exists()) {
                setAlliance({ id: docSnap.id, ...docSnap.data() } as Alliance);
            } else {
                setAlliance(null);
            }
            setIsLoading(false);
        }, async (err) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: `alliances/${allianceId}`, operation: 'get' }));
        });

        if (!membersQuery || !votesQuery || !logsQuery) return;

        const membersUnsub = onSnapshot(membersQuery, (snapshot) => {
            const memberList = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id, 
                    prideName: data.prideName, 
                    pride: data.pride || 0,
                    land: data.land || 0, 
                    province: data.province || 'N/A',
                    lastSeen: data.lastSeen,
                    lastResourceUpdate: data.lastResourceUpdate,
                } as AllianceMember;
            });
            memberList.sort((a, b) => b.pride - a.pride);
            setMembers(memberList);
        }, async (err) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'users', operation: 'list' }));
        });

        const votesUnsub = onSnapshot(votesQuery, (snapshot) => {
            const voteList = snapshot.docs.map(doc => ({ voterId: doc.id, ...doc.data() } as Vote));
            setVotes(voteList);
            const myVote = voteList.find(v => v.voterId === user.uid);
            if(myVote) setSelectedCandidate(myVote.candidateId);
        }, async (err) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'votes', operation: 'list' }));
        });

        setIsLoadingLogs(true);
        const logsUnsub = onSnapshot(logsQuery, (snapshot) => {
            const logs = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() } as AllianceReport))
                .filter(log => log.details.attackerAllianceId === allianceId || log.details.defenderAllianceId === allianceId);
            logs.sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis());
            setCombatLogs(logs.slice(0, 50));
            setIsLoadingLogs(false);
        }, async (err) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'reports', operation: 'list' }));
        });

        return () => { 
            allianceUnsub(); 
            membersUnsub(); 
            votesUnsub(); 
            logsUnsub(); 
        };
    }, [user?.uid, userProfile?.allianceId, db, membersQuery, votesQuery, logsQuery]);

    useEffect(() => {
        if (!isLeader || !db || !alliance?.id || !joinRequestsQuery) {
            setJoinRequests([]);
            setAllAlliances([]);
            return;
        }

        const requestsUnsub = onSnapshot(joinRequestsQuery, (snapshot) => {
            setJoinRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as JoinRequest)));
        }, async (err) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'allianceRequests', operation: 'list' }));
        });

        const allAllyUnsub = onSnapshot(collection(db, 'alliances'), (snapshot) => {
            setAllAlliances(snapshot.docs
                .map(d => ({ id: d.id, ...d.data() } as Alliance))
                .filter(a => a.id !== alliance.id)
            );
        }, async (err) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'alliances', operation: 'list' }));
        });

        return () => {
            requestsUnsub();
            allAllyUnsub();
        };
    }, [isLeader, db, alliance?.id, joinRequestsQuery]);

    useEffect(() => {
        if (userProfile?.allianceId || !userProfile?.province || !db || !user?.uid || !availableAlliancesQuery || !myPendingRequestsQuery) {
            setAvailableAlliances([]);
            setPendingRequests([]);
            return;
        }

        const availableUnsub = onSnapshot(availableAlliancesQuery, (snapshot) => {
            setAvailableAlliances(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Alliance)));
        }, async (err) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'alliances', operation: 'list' }));
        });
        
        const pendingUnsub = onSnapshot(myPendingRequestsQuery, (snapshot) => {
            setPendingRequests(snapshot.docs.map(doc => doc.data().allianceId));
        }, async (err) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'allianceRequests', operation: 'list' }));
        });

        return () => {
            availableUnsub();
            pendingUnsub();
        };
    }, [userProfile?.allianceId, userProfile?.province, db, user?.uid, availableAlliancesQuery, myPendingRequestsQuery]);

    useEffect(() => {
        if (typeof window !== 'undefined' && user?.uid) {
            const saved = localStorage.getItem(`lastSeenLog_${user.uid}`);
            if (saved) setLastSeenLogTime(parseInt(saved));
        }
    }, [user?.uid]);

    useEffect(() => {
        if (combatLogs.length > 0 && activeTab === 'logs') {
            const latestLogTimestamp = combatLogs[0].timestamp.toMillis();
            setLastSeenLogTime(latestLogTimestamp);
            if (user?.uid) {
                localStorage.setItem(`lastSeenLog_${user.uid}`, latestLogTimestamp.toString());
            }
        }
    }, [combatLogs, activeTab, user?.uid]);

    const unreadWarLogsCount = useMemo(() => {
        if (!combatLogs.length || activeTab === 'logs') return 0;
        return combatLogs.filter(log => log.timestamp.toMillis() > lastSeenLogTime).length;
    }, [combatLogs, lastSeenLogTime, activeTab]);

    useEffect(() => {
        if (unreadWarLogsCount > prevUnreadCountRef.current) {
            playSound('notification');
        }
        prevUnreadCountRef.current = unreadWarLogsCount;
    }, [unreadWarLogsCount, playSound]);

    const getTitleNameForPride = useCallback((pride: number): string => {
        if (!titles || titles.length === 0) return 'Tanpa Gelar';
        const achievedTitle = [...titles].reverse().find(t => pride >= t.prideRequired);
        return achievedTitle ? achievedTitle.name : 'Tanpa Gelar';
    }, [titles]);

    const handleVote = () => {
        if (!user || !userProfile?.allianceId || !selectedCandidate || !db) return;
        setIsVoting(true);
        const voteRef = doc(db, 'votes', user.uid);
        const voteData = { allianceId: userProfile.allianceId, candidateId: selectedCandidate };
        
        setDoc(voteRef, voteData).catch(async (err) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: voteRef.path,
                operation: 'write',
                requestResourceData: voteData
            }));
        }).finally(() => {
            setIsVoting(false);
            toast({ title: "Suara berhasil diberikan!" });
        });
    };

    const handleLeaveAlliance = () => {
        if (!user || !userProfile?.allianceId || !db) return;
        if (userProfile.pride < leaveAlliancePrideCost) {
            toast({ title: "Wibawa Tidak Cukup", variant: "destructive" });
            return;
        }

        runTransaction(db, async (transaction) => {
            const userRef = doc(db, 'users', user.uid);
            const allianceRef = doc(db, 'alliances', userProfile.allianceId);
            const userData = (await transaction.get(userRef)).data();
            const currentPride = userData?.pride || 0;
            
            transaction.update(userRef, { allianceId: null, pride: Math.max(0, currentPride - leaveAlliancePrideCost) });
            transaction.update(allianceRef, { memberCount: increment(-1) });
        }).then(() => {
            toast({ title: "Berhasil Keluar" });
        }).catch(async (error) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: 'leave_alliance_transaction',
                operation: 'write'
            }));
        });
    };

    const handleRequestJoin = (allianceId: string) => {
        if (!user || !userProfile || !db) return;
        setIsJoining(true);
        const requestData = {
            userId: user.uid, userName: userProfile.prideName, userPride: userProfile.pride,
            userTitle: getTitleNameForPride(userProfile.pride), allianceId,
            status: 'pending', createdAt: Timestamp.now(),
        };

        addDoc(collection(db, 'allianceRequests'), requestData).catch(async (err) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: 'allianceRequests',
                operation: 'create',
                requestResourceData: requestData
            }));
        }).finally(() => {
            setIsJoining(false);
            toast({ title: "Permintaan Terkirim!" });
        });
    };

    const handleUpdateAllianceIdentity = () => {
        if (!db || !alliance || !user || !isLeader) return;
        if (!newName && !newTag && !newLogoUrl) return;

        setIsManagingRequest(true);
        const updates: any = {};
        if (newName) updates.name = newName;
        if (newTag) updates.tag = newTag.toUpperCase();
        if (newLogoUrl) updates.logoUrl = newLogoUrl;

        updateDoc(doc(db, 'alliances', alliance.id), updates).catch(async (err) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: `alliances/${alliance.id}`,
                operation: 'update',
                requestResourceData: updates
            }));
        }).finally(() => {
            setIsManagingRequest(false);
            toast({ title: "Identitas Aliansi Diperbarui!" });
            setNewName('');
            setNewTag('');
            setNewLogoUrl('');
        });
    };

    const handleDeclareWar = () => {
        if (!db || !alliance || !selectedWarTarget || !isLeader) return;
        setIsDeclaringWar(true);
        
        const targetAlly = allAlliances.find(a => a.id === selectedWarTarget);
        if (!targetAlly) { setIsDeclaringWar(false); return; }

        const warEndTime = Timestamp.fromDate(new Date(Date.now() + 24 * 3600 * 1000));
        runTransaction(db, async (transaction) => {
            transaction.update(doc(db, 'alliances', alliance.id), { atWarWith: selectedWarTarget, warEndTime });
            transaction.update(doc(db, 'alliances', selectedWarTarget), { atWarWith: alliance.id, warEndTime });
            
            const reportRef = doc(collection(db, 'reports'));
            transaction.set(reportRef, {
                userId: user.uid,
                type: 'war-declared',
                isRead: false,
                timestamp: serverTimestamp(),
                details: {
                    attackerAllianceId: alliance.id,
                    defenderAllianceId: targetAlly.id,
                    attackerName: alliance.name,
                    defenderName: targetAlly.name,
                    message: `Aliansi ${alliance.name} telah menyatakan perang terbuka terhadap aliansi Anda!`
                }
            });
        }).then(() => {
            toast({ title: "PERANG TELAH DIMULAI!", variant: "destructive" });
            setSelectedWarTarget('');
        }).catch(async (error) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: 'declare_war_transaction',
                operation: 'write'
            }));
        }).finally(() => { 
            setIsDeclaringWar(false); 
        });
    };

    const handleManageRequest = (requestId: string, approved: boolean) => {
        if (!db || !alliance) return;
        setIsManagingRequest(true);
        const request = joinRequests.find(r => r.id === requestId);
        if (!request) { setIsManagingRequest(false); return; }

        if (approved) {
            const batch = writeBatch(db);
            batch.update(doc(db, 'users', request.userId), { allianceId: alliance.id });
            batch.update(doc(db, 'alliances', alliance.id), { memberCount: increment(1) });
            batch.delete(doc(db, 'allianceRequests', requestId));
            
            batch.commit().catch(async (err) => {
                errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: 'batch_request_approve',
                    operation: 'write'
                }));
            }).finally(() => {
                setIsManagingRequest(false);
                toast({ title: "Bangsawan Baru Disetujui!"});
            });
        } else {
            const reqRef = doc(db, 'allianceRequests', requestId);
            deleteDoc(reqRef).catch(async (err) => {
                errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: reqRef.path,
                    operation: 'delete'
                }));
            }).finally(() => {
                setIsManagingRequest(false);
                toast({ title: "Permintaan Ditolak" });
            });
        }
    };

    const handleSendAid = async () => {
        if (!user || !userProfile || !selectedAidTarget || !db) return;
        if (aidAmountMoney <= 0 && aidAmountFood <= 0) return;
        if (userProfile.money < aidAmountMoney || userProfile.food < aidAmountFood) {
            toast({ title: "Sumber Daya Tidak Cukup", variant: "destructive" });
            return;
        }

        setIsAidProcessing(true);
        try {
            await runTransaction(db, async (transaction) => {
                const senderRef = doc(db, 'users', user.uid);
                const receiverRef = doc(db, 'users', selectedAidTarget.id);

                const senderDoc = await transaction.get(senderRef);
                const receiverDoc = await transaction.get(receiverRef);

                if (!senderDoc.exists() || !receiverDoc.exists()) throw new Error("Data Bangsawan tidak ditemukan");

                transaction.update(senderRef, {
                    money: increment(-aidAmountMoney),
                    food: increment(-aidAmountFood)
                });

                transaction.update(receiverRef, {
                    money: increment(aidAmountMoney),
                    food: increment(aidAmountFood)
                });

                // Create reports
                const senderReportRef = doc(collection(db, 'reports'));
                const receiverReportRef = doc(collection(db, 'reports'));

                transaction.set(senderReportRef, {
                    userId: user.uid,
                    type: 'aid-sent',
                    isRead: false,
                    timestamp: serverTimestamp(),
                    details: {
                        targetName: selectedAidTarget.prideName,
                        money: aidAmountMoney,
                        food: aidAmountFood,
                        message: `Anda telah mengirimkan bantuan logistik kepada ${selectedAidTarget.prideName}: ${aidAmountMoney.toLocaleString()} Uang dan ${aidAmountFood.toLocaleString()} Makanan.`
                    }
                });

                transaction.set(receiverReportRef, {
                    userId: selectedAidTarget.id,
                    type: 'aid-received',
                    isRead: false,
                    timestamp: serverTimestamp(),
                    details: {
                        senderName: userProfile.prideName,
                        money: aidAmountMoney,
                        food: aidAmountFood,
                        message: `Anda telah menerima bantuan logistik dari ${userProfile.prideName}: ${aidAmountMoney.toLocaleString()} Uang dan ${aidAmountFood.toLocaleString()} Makanan.`
                    }
                });
            });

            toast({ title: "Bantuan Logistik Terkirim!" });
            setIsAidDialogOpen(false);
            setAidAmountMoney(0);
            setAidAmountFood(0);
        } catch (error: any) {
            logError(error);
            toast({ title: "Gagal Mengirim Bantuan", description: error.message, variant: "destructive" });
        } finally {
            setIsAidProcessing(false);
        }
    };

    const renderCombatLogs = () => {
        if (isLoadingLogs) return <div className="text-center py-20 opacity-50 italic">Mengkoneksikan arsip militer...</div>;
        if (combatLogs.length === 0) return <div className="text-center py-20 opacity-30 italic">Belum ada rekaman pertempuran aliansi.</div>;

        const reportIcons: { [key: string]: any } = {
            'war-victory': Trophy, 'war-defeat': Skull, 'raid-victory': Swords,
            'raid-defense-defeat': ShieldOff, 'raid-failure': ShieldQuestion,
            'war-defense-victory': ShieldCheck, 'war-defense-defeat': ShieldAlert,
            'war-declared': Gavel, 'war-ended': ShieldCheck
        };

        return (
            <div className="space-y-3">
                {combatLogs.map((log) => {
                    const Icon = reportIcons[log.type] || Info;
                    const isWarDeclaration = log.type === 'war-declared';
                    const isWarEnded = log.type === 'war-ended';

                    return (
                        <div key={log.id} className={cn(
                            "p-3 rounded-lg border flex items-center justify-between gap-3 transition-all hover:bg-card/50",
                            isWarDeclaration ? "bg-destructive/20 border-destructive/40" : 
                            isWarEnded ? "bg-blue-500/10 border-blue-500/30" : "bg-card/30 border-white/5"
                        )}>
                            <div className="flex items-center gap-3">
                                <div className={cn(
                                    "h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
                                    isWarDeclaration ? "bg-destructive/30 text-white" : "bg-primary/10 text-primary"
                                )}>
                                    <Icon className={cn("h-4 w-4", isWarDeclaration && "animate-pulse")} />
                                </div>
                                <div>
                                    <p className="font-bold text-xs tracking-wide uppercase">
                                        {isWarDeclaration ? "DEKLARASI PERANG!" : 
                                         isWarEnded ? "GENCATAN SENJATA" : 
                                         `${log.details.attackerName} vs ${log.details.defenderName}`}
                                    </p>
                                    <div className="flex items-center gap-2 text-[8px] font-bold text-muted-foreground uppercase">
                                        <span>{formatDistanceToNow(log.timestamp.toDate(), { addSuffix: true, locale: id })}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    if (isLoading) return <div className="flex items-center justify-center py-20"><Users className="h-10 w-10 animate-pulse text-primary" /></div>;

    if (!userProfile?.allianceId) {
        return (
            <Card className="bg-card/40 backdrop-blur-lg border-white/5 animate-in fade-in zoom-in-95 duration-500">
                <CardHeader className="p-4 text-center">
                    <CardTitle className="text-xl font-poiret-one tracking-widest text-primary uppercase">Bergabung Aliansi</CardTitle>
                    <CardDescription className="text-xs">Provinsi {userProfile?.province}. Pilih aliansi untuk memperkuat pengaruh.</CardDescription>
                </CardHeader>
                <CardContent className="p-2">
                    {availableAlliances.length > 0 ? (
                        <Table>
                            <TableHeader><TableRow><TableHead>Aliansi</TableHead><TableHead className="text-right">Aksi</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {availableAlliances.map(ally => (
                                    <TableRow key={ally.id} className="h-12">
                                        <TableCell><div className="font-bold text-xs">{ally.name}</div><div className="text-[9px] opacity-60">[{ally.tag}] • {ally.memberCount}/{allianceCapacity}</div></TableCell>
                                        <TableCell className="text-right">
                                            <Button size="sm" className="h-8 text-[9px] uppercase font-bold" onClick={() => handleRequestJoin(ally.id)} disabled={isJoining || pendingRequests.includes(ally.id)}>
                                                {pendingRequests.includes(ally.id) ? 'Terkirim' : 'Gabung'}
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    ) : <p className="text-center py-10 opacity-40 text-xs italic">Tidak ada aliansi tersedia di provinsimu.</p>}
                </CardContent>
            </Card>
        );
    }

    return (
        <Tabs defaultValue="alliance" className="space-y-4" onValueChange={setActiveTab}>
            <TabsList className={cn("grid w-full bg-card/40 h-10 p-1 border border-white/5 rounded-lg", isLeader ? "grid-cols-4" : "grid-cols-3")}>
                <TabsTrigger value="alliance" className="uppercase font-bold tracking-widest text-[9px] h-full rounded-md transition-all">Aliansi</TabsTrigger>
                <TabsTrigger value="activity" className="uppercase font-bold tracking-widest text-[9px] h-full rounded-md transition-all">Aktivitas</TabsTrigger>
                <TabsTrigger value="logs" className="relative uppercase font-bold tracking-widest text-[9px] h-full rounded-md transition-all">
                    Intel
                    {unreadWarLogsCount > 0 && (
                        <Badge variant="destructive" className="absolute -top-1 -right-1 h-4 min-w-[16px] px-1 flex items-center justify-center text-[8px] rounded-full">
                            {unreadWarLogsCount}
                        </Badge>
                    )}
                </TabsTrigger>
                {isLeader && <TabsTrigger value="management" className="uppercase font-bold tracking-widest text-[9px] h-full rounded-md transition-all">Kelola</TabsTrigger>}
            </TabsList>

            <TabsContent value="alliance" className="space-y-4 mt-0">
                {alliance && (
                    <Card className="bg-card/40 border-white/5 shadow-xl relative overflow-hidden flex flex-col min-h-0 h-full">
                        <CardHeader className="p-4 text-center shrink-0">
                            <CardTitle className="text-2xl font-poiret-one tracking-widest uppercase">{alliance.name}</CardTitle>
                            <p className="font-gruppo tracking-[0.4em] text-primary/80 uppercase text-[10px]">[{alliance.tag}]</p>
                            {alliance.atWarWith && (
                                <Badge variant="destructive" className="mx-auto mt-2 animate-pulse text-[8px]"><Swords className="mr-1 h-2.5 w-2.5" /> BERTARUNG: <WarCountdown endTime={alliance.warEndTime} /></Badge>
                            )}
                        </CardHeader>
                        <CardContent className="p-4 pt-0 space-y-4 overflow-hidden flex flex-col">
                            {/* Area Logo Dominasi */}
                            <div className="relative flex justify-center py-6 shrink-0">
                                {/* Aura Pendaran Belakang */}
                                <div className="absolute inset-0 flex items-center justify-center opacity-10 blur-3xl pointer-events-none">
                                    <Image src={alliance.logoUrl || 'https://i.imgur.com/iE3uduS.png'} alt="" width={300} height={300} className="rounded-full scale-150" />
                                </div>
                                
                                <motion.div 
                                    animate={{ y: [0, -10, 0] }}
                                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                                    className="relative z-10 group"
                                >
                                    {/* Efek Glow Luar */}
                                    <div className="absolute -inset-4 bg-primary/20 rounded-full blur-2xl group-hover:bg-primary/30 transition-all duration-500 animate-pulse" />
                                    
                                    {/* Kontainer Logo Utama */}
                                    <div className="relative h-40 w-40 md:h-52 md:w-52 rounded-2xl overflow-hidden border-4 border-primary/20 shadow-[0_0_50px_rgba(234,179,8,0.2)] bg-card/60 backdrop-blur-md">
                                        <Image 
                                            src={alliance.logoUrl || 'https://i.imgur.com/iE3uduS.png'} 
                                            alt="Logo Aliansi" 
                                            fill
                                            className="object-cover transition-transform duration-700 group-hover:scale-110" 
                                        />
                                    </div>
                                    
                                    {/* Badge Leader Indicator */}
                                    <div className="absolute -bottom-2 -right-2 h-10 w-10 bg-primary rounded-full flex items-center justify-center border-2 border-background shadow-lg">
                                        <ShieldCheck className="h-5 w-5 text-primary-foreground" />
                                    </div>
                                </motion.div>
                            </div>

                            <ScrollArea className="flex-1 border rounded-lg border-white/5 bg-white/5 min-h-[150px]">
                                <Table>
                                    <TableHeader className="bg-white/5 sticky top-0 z-10"><TableRow><TableHead className="text-[10px] uppercase font-bold tracking-widest">Dewan Anggota</TableHead><TableHead className="text-right text-[10px] uppercase font-bold tracking-widest">Wibawa</TableHead></TableRow></TableHeader>
                                    <TableBody>
                                        {members.map(m => (
                                            <TableRow key={m.id} className="h-12 border-white/5">
                                                <TableCell className="py-1">
                                                    <div className="flex flex-col gap-0.5">
                                                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-white uppercase tracking-tight">
                                                            {m.id === alliance.leaderId && <Crown className="h-3 w-3 text-primary" />} 
                                                            {m.prideName}
                                                        </div>
                                                        <div className="text-[8px] text-primary/60 font-bold uppercase tracking-widest leading-none">
                                                            {getTitleNameForPride(m.pride)}
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right font-gruppo text-xs py-1">
                                                    <div className="flex items-center justify-end gap-2">
                                                        {Math.floor(m.pride).toLocaleString()}
                                                        {m.id !== user?.uid && (
                                                            <Button size="icon" variant="ghost" className="h-6 w-6 text-primary/40 hover:text-primary transition-colors" onClick={() => { setSelectedAidTarget(m); setIsAidDialogOpen(true); }}>
                                                                <Send className="h-3.5 w-3.5" />
                                                            </Button>
                                                        )}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </ScrollArea>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 shrink-0">
                                <div className="p-3 rounded-lg bg-white/5 border border-white/5 space-y-2">
                                    <p className="text-[8px] uppercase font-bold tracking-widest text-primary">Voting Kepemimpinan</p>
                                    <div className="flex gap-2">
                                        <Select onValueChange={setSelectedCandidate} value={selectedCandidate}>
                                            <SelectTrigger className="h-8 text-[9px] bg-white/5"><SelectValue placeholder="Pilih Calon..." /></SelectTrigger>
                                            <SelectContent>{members.map(m => <SelectItem key={m.id} value={m.id} className="text-xs">{m.prideName}</SelectItem>)}</SelectContent>
                                        </Select>
                                        <Button size="sm" onClick={handleVote} disabled={isVoting || !selectedCandidate} className="h-8 text-[9px] px-4 font-bold uppercase">Vote</Button>
                                    </div>
                                </div>
                                <div className="p-3 rounded-lg bg-white/5 border border-white/5 space-y-2">
                                    <p className="text-[8px] uppercase font-bold tracking-widest text-destructive">Protokol Keamanan</p>
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild><Button variant="outline" className="w-full h-8 text-destructive border-destructive/20 text-[9px] font-bold uppercase"><LogOut className="mr-1.5 h-3 w-3" /> Keluar Aliansi</Button></AlertDialogTrigger>
                                        <AlertDialogContent className="glass-card"><AlertDialogHeader><AlertDialogTitle>Keluar dari Aliansi?</AlertDialogTitle><AlertDialogDescription className="text-xs">Biaya: {leaveAlliancePrideCost} Wibawa. Lanjutkan?</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel className="h-8 text-xs">Batal</AlertDialogCancel><AlertDialogAction onClick={handleLeaveAlliance} className="bg-destructive h-8 text-xs">Keluar</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                                    </AlertDialog>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </TabsContent>

            <TabsContent value="activity" className="mt-0">
                <Card className="bg-card/40 border-white/5">
                    <CardHeader className="p-4"><CardTitle className="text-sm uppercase tracking-widest text-primary flex items-center gap-2"><Activity className="h-4 w-4" /> Pengawasan Dewan</CardTitle></CardHeader>
                    <CardContent className="p-0 pb-2">
                        <ScrollArea className="h-[400px]">
                            <Table>
                                <TableHeader className="bg-white/5 sticky top-0 z-10"><TableRow><TableHead className="text-[10px] uppercase">Bangsawan</TableHead><TableHead className="text-center text-[10px] uppercase">Status</TableHead><TableHead className="text-right text-[10px] uppercase">Logistik</TableHead></TableRow></TableHeader>
                                <TableBody>
                                    {members.map(m => (
                                        <TableRow key={m.id} className="h-12 border-white/5">
                                            <TableCell className="py-1"><div className="font-bold text-xs uppercase tracking-tight truncate max-w-[80px]">{m.prideName}</div></TableCell>
                                            <TableCell className="text-center py-1">
                                                {m.lastSeen ? (
                                                    <div className="flex flex-col items-center"><Badge variant="outline" className="text-[7px] bg-green-500/5 text-green-500 border-green-500/20 py-0 h-3">On</Badge><span className="text-[8px] opacity-40 font-mono mt-0.5">{formatDistanceToNow(m.lastSeen.toDate(), { locale: id })}</span></div>
                                                ) : <span className="text-[8px] opacity-20">N/A</span>}
                                            </TableCell>
                                            <TableCell className="text-right py-1">
                                                {m.lastResourceUpdate ? <span className="text-[8px] font-mono opacity-50">{formatDistanceToNow(m.lastResourceUpdate.toDate(), { locale: id })}</span> : <span className="text-[8px] opacity-20">-</span>}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </ScrollArea>
                    </CardContent>
                </Card>
            </TabsContent>

            <TabsContent value="logs" className="mt-0">
                <Card className="bg-card/40 border-white/5">
                    <CardHeader className="p-4"><CardTitle className="text-sm uppercase tracking-widest text-primary flex items-center gap-2"><ScrollText className="h-4 w-4" /> Intelijen Aliansi</CardTitle></CardHeader>
                    <CardContent className="p-4 pt-0">
                        <ScrollArea className="h-[400px] pr-3">
                            {renderCombatLogs()}
                        </ScrollArea>
                    </CardContent>
                </Card>
            </TabsContent>

            {isLeader && (
                <TabsContent value="management" className="mt-0 space-y-4">
                    <div className="grid grid-cols-1 gap-4">
                        <Card className="bg-card/40 border-white/5 shadow-xl">
                            <CardHeader className="p-4"><CardTitle className="text-sm uppercase tracking-widest text-primary flex items-center gap-2"><Pencil className="h-4 w-4" /> Identitas</CardTitle></CardHeader>
                            <CardContent className="p-4 pt-0 space-y-3">
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1"><Label className="text-[10px]">Nama</Label><Input value={newName} onChange={e => setNewName(e.target.value)} className="h-8 text-xs bg-white/5" /></div>
                                    <div className="space-y-1"><Label className="text-[10px]">Tag</Label><Input value={newTag} onChange={e => setNewTag(e.target.value.toUpperCase())} className="h-8 text-xs bg-white/5" /></div>
                                </div>
                                <div className="space-y-1"><Label className="text-[10px]">Logo URL</Label><Input value={newLogoUrl} onChange={e => setNewLogoUrl(e.target.value)} className="h-8 text-xs bg-white/5" /></div>
                                <Button size="sm" onClick={handleUpdateAllianceIdentity} disabled={isManagingRequest || (!newName && !newTag && !newLogoUrl)} className="w-full h-8 text-[9px] font-bold uppercase">Update Identitas</Button>
                            </CardContent>
                        </Card>
                        
                        <Card className="bg-card/40 border-white/5 shadow-xl">
                            <CardHeader className="p-4"><CardTitle className="text-sm uppercase tracking-widest text-primary flex items-center gap-2"><User className="h-4 w-4" /> Permohonan</CardTitle></CardHeader>
                            <CardContent className="p-4 pt-0">
                                <ScrollArea className="h-[150px]">
                                    {joinRequests.length > 0 ? (
                                        <div className="space-y-2">
                                            {joinRequests.map(req => (
                                                <div key={req.id} className="p-2.5 rounded bg-white/5 border border-white/5 flex items-center justify-between">
                                                    <div className="truncate pr-2">
                                                        <div className="font-bold text-[11px] truncate uppercase">{req.userName}</div>
                                                        <div className="text-[8px] opacity-40 uppercase tracking-tighter">{Math.floor(req.userPride).toLocaleString()} Wibawa</div>
                                                    </div>
                                                    <div className="flex gap-1.5 shrink-0">
                                                        <Button size="icon" variant="ghost" className="h-7 w-7 text-green-500 bg-green-500/5" onClick={() => handleManageRequest(req.id, true)} disabled={isManagingRequest}><Check className="h-3 w-3" /></Button>
                                                        <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500 bg-red-500/5" onClick={() => handleManageRequest(req.id, false)} disabled={isManagingRequest}><X className="h-3 w-3" /></Button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : <p className="text-center py-10 opacity-20 text-[10px] italic">Belum ada permohonan.</p>}
                                </ScrollArea>
                            </CardContent>
                        </Card>
                    </div>

                    <Card className="bg-card/40 border-white/5 shadow-xl">
                        <CardHeader className="p-4"><CardTitle className="text-sm uppercase tracking-widest text-primary flex items-center gap-2"><Globe className="h-4 w-4" /> Agresi Militer</CardTitle></CardHeader>
                        <CardContent className="p-4 pt-0 space-y-4">
                            <div className="space-y-2">
                                <Label className="text-[10px]">Pilih Target Perang</Label>
                                <Select onValueChange={setSelectedWarTarget} value={selectedWarTarget}>
                                    <SelectTrigger className="h-9 text-xs bg-white/5"><SelectValue placeholder="Pilih Aliansi Musuh..." /></SelectTrigger>
                                    <SelectContent className="max-h-40">{allAlliances.map(a => <SelectItem key={a.id} value={a.id} className="text-xs">{a.name} [{a.tag}]</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                            
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive" className="w-full h-10 text-[10px] font-bold tracking-[0.2em] uppercase" disabled={isDeclaringWar || !selectedWarTarget || !!alliance?.atWarWith}>
                                        <Swords className="mr-2 h-4 w-4" /> Deklarasi Perang
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="glass-card"><AlertDialogHeader><AlertDialogTitle className="text-destructive text-sm uppercase">Konfirmasi Agresi</AlertDialogTitle><AlertDialogDescription className="text-xs">Mulai izin invasi selama 24 jam terhadap target. Tidak dapat dibatalkan.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter className="gap-2"><AlertDialogCancel className="h-8 text-xs">Batal</AlertDialogCancel><AlertDialogAction onClick={handleDeclareWar} className="bg-destructive h-8 text-xs">Mulai Perang</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                            </AlertDialog>
                        </CardContent>
                    </Card>
                </TabsContent>
            )}

            {/* Aid Dialog */}
            <Dialog open={isAidDialogOpen} onOpenChange={setIsAidDialogOpen}>
                <DialogContent className="glass-card sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="font-poiret-one text-xl tracking-widest uppercase text-primary border-b border-primary/20 pb-3">Kirim Bantuan Logistik</DialogTitle>
                        <DialogDescription className="text-xs pt-2">
                            Kirimkan sumber daya berharga Anda untuk mendukung perjuangan rekan se-Aliansi: <span className="font-bold text-white uppercase">{selectedAidTarget?.prideName}</span>.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-6 py-4">
                        <div className="space-y-2">
                            <Label className="text-[10px] uppercase font-bold tracking-widest opacity-60">Jumlah Uang (Maks: {Math.floor(userProfile?.money || 0).toLocaleString()})</Label>
                            <div className="relative">
                                <Input 
                                    type="number" 
                                    placeholder="0"
                                    value={aidAmountMoney || ''} 
                                    onChange={e => setAidAmountMoney(Math.min(userProfile?.money || 0, Math.max(0, Number(e.target.value))))}
                                    className="bg-white/5 border-white/10 h-12 font-gruppo text-lg tracking-widest pl-10"
                                />
                                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary opacity-40" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] uppercase font-bold tracking-widest opacity-60">Jumlah Makanan (Maks: {Math.floor(userProfile?.food || 0).toLocaleString()})</Label>
                            <div className="relative">
                                <Input 
                                    type="number" 
                                    placeholder="0"
                                    value={aidAmountFood || ''} 
                                    onChange={e => setAidAmountFood(Math.min(userProfile?.food || 0, Math.max(0, Number(e.target.value))))}
                                    className="bg-white/5 border-white/10 h-12 font-gruppo text-lg tracking-widest pl-10"
                                />
                                <Info className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary opacity-40" />
                            </div>
                        </div>
                        
                        <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
                            <p className="text-[9px] uppercase font-bold tracking-widest text-primary/60 mb-2">Ringkasan Bantuan</p>
                            <div className="flex justify-between items-center text-xs">
                                <span className="opacity-60">Total Dana & Logistik:</span>
                                <span className="font-bold text-primary">{(aidAmountMoney + aidAmountFood).toLocaleString()} Aset</span>
                            </div>
                        </div>
                    </div>
                    <DialogFooter className="gap-2">
                        <Button variant="ghost" onClick={() => setIsAidDialogOpen(false)} className="uppercase text-[10px] font-bold tracking-widest h-11">Batal</Button>
                        <Button 
                            onClick={handleSendAid} 
                            disabled={isAidProcessing || (aidAmountMoney <= 0 && aidAmountFood <= 0)}
                            className="btn-3d bg-primary text-primary-foreground font-bold uppercase tracking-[0.2em] h-11 px-8"
                        >
                            {isAidProcessing ? "Memproses..." : "Kukuhkan Bantuan"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Tabs>
    );
}
