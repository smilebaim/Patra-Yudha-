
'use client';

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ModeToggle } from '@/components/theme-toggle';
import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/firebase/auth/auth-context';
import { useEffect, useState, useMemo } from 'react';
import { 
  Crown, Trash2, Pencil, Ban, ArrowUpDown, Swords, Activity, Zap, X, 
  User as UserIcon, ShieldAlert, Settings, MapPin, Building2, UserPlus, 
  FileText, Globe, Info, AlertTriangle, RefreshCcw, Save, Plus, Coins, 
  Beef, Star, Megaphone, Clock, Hammer, Users, Aperture, Trophy, Search, 
  ChevronRight, HardDriveDownload, Send, Lock, Unlock, List, FlaskConical,
  BarChart3, PieChart, LandPlot, Shield, Microscope, Home, Factory
} from 'lucide-react';
import { 
  collection, onSnapshot, doc, deleteDoc, getDoc, setDoc, writeBatch, 
  addDoc, updateDoc, query, where, serverTimestamp, Timestamp, orderBy, 
  getDocs, limit, increment, runTransaction 
} from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, 
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, 
  AlertDialogTrigger 
} from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useFirestore } from '@/firebase/firestore/firestore-context';
import { Checkbox } from '@/components/ui/checkbox';
import { logError } from '@/lib/errorHandler';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';

interface DisplayUser {
  id: string;
  prideName: string;
  email: string;
  role: 'admin' | 'user';
  status?: 'active' | 'disabled';
  coordinates?: { x: number; y: number };
  land?: number;
  pride?: number;
  money?: number;
  food?: number;
  units?: UnitCounts;
  unemployed?: number;
  province?: string;
  zodiac?: string;
  lastSeen?: Timestamp;
  lastResourceUpdate?: Timestamp;
  allianceId?: string;
  buildings?: BuildingCounts;
  onboardingComplete?: boolean;
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
}

interface BuildingCounts {
    residence: number;
    farm: number;
    fort: number;
    university: number;
    barracks: number;
    mobility: number;
    tambang: number;
    tower: number;
}

interface UnitCounts {
    attack: number;
    defense: number;
    elite: number;
    raider: number;
}

interface GameTitle {
  id: string;
  name: string;
  prideRequired: number;
  attackBonus: number;
  defenseBonus: number;
  resourceBonus: number;
}

type AttackMatrix = { [titleId: string]: string[] };

interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  targetId?: string;
  targetName?: string;
  timestamp: Timestamp;
  details?: any;
}

const unitNameMap: { [key: string]: string } = {
  attack: 'Pasukan Serang',
  defense: 'Pasukan Bertahan',
  elite: 'Pasukan Elit',
  raider: 'Pasukan Khusus'
};

const buildingNameMap: { [key: string]: string } = {
  residence: 'Rumah',
  farm: 'Sawah',
  tambang: 'Tambang',
  barracks: 'Barak',
  mobility: 'Mobilitas',
  university: 'Kampus',
  fort: 'Benteng',
  tower: 'Menara'
};

export default function AdminDashboardPage() {
  const { user, userProfile, loading, auth, viewAsUser, setViewAsUser } = useAuth();
  const { db } = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const [users, setUsers] = useState<DisplayUser[]>([]);
  const [alliances, setAlliances] = useState<Alliance[]>([]);
  const [titles, setTitles] = useState<GameTitle[]>([]);
  const [activityLog, setActivityLog] = useState<ActivityLog[]>([]);
  
  const [adminInfo, setAdminInfo] = useState<any>({});
  const [eraInfo, setEraInfo] = useState({ name: '', endDate: '' });
  const [gameCosts, setGameCosts] = useState<any>({ upkeep: {}, buildings: {}, units: {} });
  const [buildingEffects, setBuildingEffects] = useState<any>({
    residence: { capacity: 100, unemployed: 5 },
    farm: { food: 50 },
    tambang: { money: 100 },
    fort: { defenseBonus: 5 },
    mobility: { attackBonus: 5 },
    university: { constructionBonus: 2, foodAndMoneyBonus: 2, attackBonus: 1, defenseBonus: 1 },
    barracks: { trainingBonus: 2 },
    tower: { bonusPertahananPasukanKhusus: 5 }
  });
  const [gameMechanics, setGameMechanics] = useState<any>({});
  const [initialResources, setInitialResources] = useState<any>({});
  const [timingRules, setTimingRules] = useState<any>({ constructionTimeInHours: 5, trainingTimeInHours: 2 });
  const [attackMatrix, setAttackMatrix] = useState<AttackMatrix>({});
  const [zodiacBuffs, setZodiacBuffs] = useState<any>({
      rank1: { money: 15, food: 15, attack: 5, defense: 5 },
      rank2: { money: 10, food: 10, attack: 3, defense: 3 },
      rank3: { money: 5, food: 5, attack: 0, defense: 0 }
  });

  const [activeTab, setActiveTab] = useState("rankings");
  const [searchQuery, setSearchQuery] = useState('');
  const [isSaving, setIsSaving] = useState<string | null>(null);
  
  const [editingUser, setEditingUser] = useState<DisplayUser | null>(null);
  const [editUserFormData, setEditUserFormData] = useState<any>({});
  const [isEditUserDialogOpen, setIsEditUserDialogOpen] = useState(false);
  const [isUpdatingUser, setIsUpdatingUser] = useState(false);

  const [editingAlliance, setEditingAlliance] = useState<Alliance | null>(null);
  const [allianceFormData, setAllianceFormData] = useState<any>({});
  const [isAllianceDialogOpen, setIsAllianceDialogOpen] = useState(false);
  const [isSavingAlliance, setIsSavingAlliance] = useState(false);
  const [selectedAllianceMembers, setSelectedAllianceMembers] = useState<DisplayUser[]>([]);
  const [isAllianceMembersDialogOpen, setIsAllianceMembersDialogOpen] = useState(false);

  const [broadcastTitle, setBroadcastReportTitle] = useState('Pesan dari Dewan Militer');
  const [broadcastMessage, setBroadcastReportMessage] = useState('');
  
  const [giftAmount, setGiftAmount] = useState(0);
  const [giftResource, setGiftResource] = useState('money');

  useEffect(() => {
    if (!loading && (!user || (userProfile?.role !== 'admin'))) router.push('/login');
  }, [loading, user, userProfile, router]);

  useEffect(() => {
    if (!db) return;
    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => setUsers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as DisplayUser))), (err) => errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'users', operation: 'list' })));
    const unsubAlliances = onSnapshot(collection(db, 'alliances'), (snap) => setAlliances(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Alliance))), (err) => errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'alliances', operation: 'list' })));
    const unsubTitles = onSnapshot(collection(db, 'titles'), (snap) => setTitles(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as GameTitle)).sort((a,b) => a.prideRequired - b.prideRequired)), (err) => errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'titles', operation: 'list' })));
    const unsubLog = onSnapshot(query(collection(db, 'activityLog'), orderBy('timestamp', 'desc'), limit(50)), (snap) => setActivityLog(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ActivityLog))), (err) => errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'activityLog', operation: 'list' })));
    
    onSnapshot(doc(db, 'game-settings', 'admin-info'), snap => snap.exists() && setAdminInfo(snap.data()));
    onSnapshot(doc(db, 'game-settings', 'era-info'), snap => {
        if(snap.exists()) {
            const data = snap.data();
            setEraInfo({ name: data.name || '', endDate: data.endDate ? format(data.endDate.toDate(), 'yyyy-MM-dd') : '' });
        }
    });
    onSnapshot(doc(db, 'game-settings', 'game-costs'), snap => snap.exists() && setGameCosts(snap.data()));
    onSnapshot(doc(db, 'game-settings', 'building-effects'), snap => snap.exists() && setBuildingEffects(snap.data()));
    onSnapshot(doc(db, 'game-settings', 'game-mechanics'), snap => snap.exists() && setGameMechanics(snap.data()));
    onSnapshot(doc(db, 'game-settings', 'initial-resources'), snap => snap.exists() && setInitialResources(snap.data()));
    onSnapshot(doc(db, 'game-settings', 'timing-rules'), snap => snap.exists() && setTimingRules(snap.data()));
    onSnapshot(doc(db, 'game-settings', 'attack-rules'), snap => snap.exists() && setAttackMatrix(snap.data().attackMatrix || {}));
    onSnapshot(doc(db, 'game-settings', 'zodiac-buffs'), snap => snap.exists() && setZodiacBuffs(snap.data()));

    return () => { unsubUsers(); unsubAlliances(); unsubTitles(); unsubLog(); };
  }, [db]);

  const saveDoc = (docId: string, data: any, label: string) => {
    if (!db) return;
    setIsSaving(docId);
    setDoc(doc(db, 'game-settings', docId), data, { merge: true })
      .then(() => { toast({ title: `${label} Tersimpan` }); })
      .catch(async (e: any) => { 
          logError(e); 
          errorEmitter.emit('permission-error', new FirestorePermissionError({ path: `game-settings/${docId}`, operation: 'write', requestResourceData: data }));
      })
      .finally(() => { setIsSaving(null); });
  };

  const handleUpdateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser || !db) return;
    setIsUpdatingUser(true);
    const ref = doc(db, 'users', editingUser.id);
    
    const updateData: any = { ...editUserFormData };
    if (updateData.units) {
        Object.entries(updateData.units).forEach(([key, val]) => {
            updateData[`units.${key}`] = val;
        });
        delete updateData.units;
    }

    updateDoc(ref, updateData)
      .then(() => {
          toast({ title: "Profil Bangsawan Diperbarui" });
          setIsEditUserDialogOpen(false);
      })
      .catch(async (e: any) => { 
          logError(e);
          errorEmitter.emit('permission-error', new FirestorePermissionError({ path: ref.path, operation: 'update', requestResourceData: updateData }));
      })
      .finally(() => { setIsUpdatingUser(false); });
  };

  const handleSaveAlliance = (e: React.FormEvent) => {
      e.preventDefault();
      if (!db) return;
      setIsSavingAlliance(true);
      
      const allianceData = {
          ...allianceFormData,
          coordinates: { x: Number(allianceFormData.x), y: Number(allianceFormData.y) }
      };
      delete allianceData.x;
      delete allianceData.y;

      if (editingAlliance) {
          updateDoc(doc(db, 'alliances', editingAlliance.id), allianceData)
            .then(() => { toast({ title: "Aliansi Diperbarui" }); setIsAllianceDialogOpen(false); })
            .catch(async (err) => errorEmitter.emit('permission-error', new FirestorePermissionError({ path: `alliances/${editingAlliance.id}`, operation: 'update', requestResourceData: allianceData })))
            .finally(() => setIsSavingAlliance(false));
      } else {
          addDoc(collection(db, 'alliances'), {
              ...allianceData,
              createdAt: serverTimestamp(),
              memberCount: 0,
              leaderId: null
          })
            .then(() => { toast({ title: "Aliansi Baru Ditambahkan" }); setIsAllianceDialogOpen(false); })
            .catch(async (err) => errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'alliances', operation: 'create', requestResourceData: allianceData })))
            .finally(() => setIsSavingAlliance(false));
      }
  };

  const handleDeleteAlliance = async (id: string) => {
      if (!db) return;
      runTransaction(db, async (transaction) => {
          const allianceRef = doc(db, 'alliances', id);
          const membersQuery = query(collection(db, 'users'), where('allianceId', '==', id));
          const membersSnap = await getDocs(membersQuery);
          
          membersSnap.docs.forEach(mDoc => {
              transaction.update(mDoc.ref, { allianceId: null });
          });
          transaction.delete(allianceRef);
      }).then(() => {
          toast({ title: "Aliansi Dibubarkan" });
      }).catch((e) => {
          errorEmitter.emit('permission-error', new FirestorePermissionError({ path: `alliances/${id}`, operation: 'delete' }));
      });
  };

  const handleEditUserClick = (u: DisplayUser) => {
    setEditingUser(u);
    setEditUserFormData({ 
        prideName: u.prideName || '', 
        pride: u.pride || 0, 
        money: u.money || 0, 
        food: u.food || 0, 
        land: u.land || 0, 
        unemployed: u.unemployed || 0, 
        status: u.status || 'active',
        units: { ...u.units } 
    });
    setIsEditUserDialogOpen(true);
  };

  const handleEditAllianceClick = (a?: Alliance) => {
      if (a) {
          setEditingAlliance(a);
          setAllianceFormData({ name: a.name, tag: a.tag, province: a.province, x: a.coordinates.x, y: a.coordinates.y, logoUrl: a.logoUrl });
      } else {
          setEditingAlliance(null);
          setAllianceFormData({ name: '', tag: '', province: '', x: 0, y: 0, logoUrl: 'https://i.imgur.com/iE3uduS.png' });
      }
      setIsAllianceDialogOpen(true);
  };

  const handleShowAllianceMembers = (a: Alliance) => {
      setSelectedAllianceMembers(users.filter(u => u.allianceId === a.id));
      setEditingAlliance(a);
      setIsAllianceMembersDialogOpen(true);
  };

  const handleToggleAttackMatrix = (sourceId: string, targetId: string) => {
      if (!db) return;
      const currentTargets = attackMatrix[sourceId] || [];
      const newTargets = currentTargets.includes(targetId) 
          ? currentTargets.filter(id => id !== targetId)
          : [...currentTargets, targetId];
      
      const newMatrix = { ...attackMatrix, [sourceId]: newTargets };
      setAttackMatrix(newMatrix);
      saveDoc('attack-rules', { attackMatrix: newMatrix }, "Matrix Aturan Perang");
  };

  const handleResetPlayers = async () => {
    if (!db) return;
    setIsSaving('reset-players');
    try {
        const usersSnap = await getDocs(collection(db, 'users'));
        const initialRes = initialResources || {
            money: 1000, food: 500, land: 100, pride: 500, unemployed: 10,
            attack: 10, defense: 10, raider: 0
        };

        const batchSize = 500;
        let batch = writeBatch(db);
        let count = 0;
        
        for (const uDoc of usersSnap.docs) {
            if (uDoc.data().role !== 'admin') {
                const updatePayload = {
                    money: initialRes.money,
                    food: initialRes.food,
                    land: initialRes.land,
                    pride: initialRes.pride,
                    unemployed: initialRes.unemployed,
                    'units.attack': initialRes.attack || 0,
                    'units.defense': initialRes.defense || 0,
                    'units.elite': 0,
                    'units.raider': initialRes.raider || 0,
                    'buildings.residence': initialRes.residence || 0,
                    'buildings.farm': initialRes.farm || 0,
                    'buildings.tambang': initialRes.tambang || 0,
                    'buildings.tower': initialRes.tower || 0,
                    'buildings.barracks': initialRes.barracks || 0,
                    'buildings.mobility': initialRes.mobility || 0,
                    'buildings.university': initialRes.university || 0,
                    'buildings.fort': initialRes.fort || 0,
                    lastResourceUpdate: serverTimestamp()
                };
                batch.update(uDoc.ref, updatePayload);
                count++;
                if (count % batchSize === 0) {
                    await batch.commit();
                    batch = writeBatch(db);
                }
            }
        }
        await batch.commit().catch(e => { throw e; });
        toast({ title: "Seluruh Pemain Berhasil Di-reset" });
    } catch (e) { 
        logError(e);
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'users_batch_reset', operation: 'write' }));
    } finally { setIsSaving(null); }
  };

  const handleClearLogs = async () => {
    if (!db) return;
    setIsSaving('clear-logs');
    try {
        const activitySnap = await getDocs(collection(db, 'activityLog'));
        const reportsSnap = await getDocs(collection(db, 'reports'));
        const alliancesAtWarSnap = await getDocs(query(collection(db, 'alliances'), where('atWarWith', '!=', null)));
        
        let batch = writeBatch(db);
        activitySnap.docs.forEach(d => batch.delete(d.ref));
        reportsSnap.docs.forEach(d => batch.delete(d.ref));
        alliancesAtWarSnap.docs.forEach(d => batch.update(d.ref, { atWarWith: null, warEndTime: null }));
        
        await batch.commit().catch(e => { throw e; });
        toast({ title: "Arsip Log, Laporan & Status Perang Berhasil Dibersihkan" });
    } catch (e) { 
        logError(e); 
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'logs_batch_clear', operation: 'write' }));
    } finally { setIsSaving(null); }
  };

  const handleSystemReset = async () => {
      if (!db) return;
      setIsSaving('system-reset');
      try {
          const collectionsToWipe = [
              'activityLog', 'reports', 'allianceRequests', 'marches', 
              'trainingQueue', 'constructionQueue', 'votes', 'alliances'
          ];
          
          for (const collName of collectionsToWipe) {
              const snap = await getDocs(collection(db, collName));
              const docs = snap.docs;
              for (let i = 0; i < docs.length; i += 500) {
                  const batch = writeBatch(db);
                  docs.slice(i, i + 500).forEach(d => batch.delete(d.ref));
                  await batch.commit();
              }
          }

          const usersSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'user')));
          const userDocs = usersSnap.docs;
          for (let i = 0; i < userDocs.length; i += 500) {
              const userBatch = writeBatch(db);
              userDocs.slice(i, i + 500).forEach(d => userBatch.delete(d.ref));
              await userBatch.commit();
          }

          const settingsBatch = writeBatch(db);
          const defaultInitialResources = { 
              money: 10000, food: 5000, land: 100, pride: 500, unemployed: 10, 
              attack: 10, defense: 10, raider: 5,
              residence: 1, farm: 1, tambang: 1, tower: 0, barracks: 0, mobility: 0, university: 0, fort: 0
          };
          const defaultEraInfo = { 
              name: 'Era Perintisan', 
              endDate: Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)) 
          };
          const defaultMechanics = { 
              allianceCapacity: 10, troopFoodConsumptionFactor: 1, changePrideNameCost: 1000, 
              leaveAlliancePrideCost: 500, destroyBuildingPrideCost: 50, dismissUnitPrideCost: 10, 
              rushTrainingCost: 20, cancelTrainingRefundPercentage: 50, rushConstructionCost: 50, 
              cancelConstructionRefundPercentage: 50 
          };
          const defaultBuildingEffects = {
              residence: { capacity: 100, unemployed: 5 }, farm: { food: 50 }, tambang: { money: 100 },
              fort: { defenseBonus: 5 }, mobility: { attackBonus: 5 },
              university: { constructionBonus: 2, foodAndMoneyBonus: 2, attackBonus: 1, defenseBonus: 1 },
              barracks: { trainingBonus: 2 }, tower: { bonusPertahananPasukanKhusus: 5 }
          };

          settingsBatch.set(doc(db, 'game-settings', 'initial-resources'), defaultInitialResources);
          settingsBatch.set(doc(db, 'game-settings', 'era-info'), defaultEraInfo);
          settingsBatch.set(doc(db, 'game-settings', 'game-mechanics'), defaultMechanics);
          settingsBatch.set(doc(db, 'game-settings', 'building-effects'), defaultBuildingEffects);
          settingsBatch.set(doc(db, 'game-settings', 'admin-info'), { 
              message: 'Selamat datang di dunia Patra Yudha yang baru dikukuhkan!',
              dashboardBackgroundUrl: '', homeBackgroundUrl: '', 
              dashboardBackgroundBlur: 2, homeBackgroundBlur: 2, maintenanceMode: false
          });
          settingsBatch.set(doc(db, 'game-settings', 'timing-rules'), { constructionTimeInHours: 5, trainingTimeInHours: 2 });

          await settingsBatch.commit().catch(e => { throw e; });
          toast({ title: "System Reset Berhasil", description: "Database telah dibersihkan sepenuhnya." });
          router.refresh();
      } catch (e: any) {
          logError(e);
          errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'system_reset_batch', operation: 'write' }));
          toast({ title: "Gagal Melakukan Reset", description: e.message, variant: "destructive" });
      } finally { setIsSaving(null); }
  };

  const handleBroadcastReport = async () => {
    if (!db || !broadcastMessage.trim()) return;
    setIsSaving('broadcast');
    try {
        const usersSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'user')));
        const batchSize = 500;
        let batch = writeBatch(db);
        let count = 0;

        for (const uDoc of usersSnap.docs) {
            const reportRef = doc(collection(db, 'reports'));
            const reportPayload = {
                userId: uDoc.id,
                type: 'war-ended', 
                isRead: false,
                timestamp: serverTimestamp(),
                details: {
                    allianceName: 'Dewan Militer',
                    opponentName: broadcastTitle,
                    message: broadcastMessage
                }
            };
            batch.set(reportRef, reportPayload);
            count++;
            if (count % batchSize === 0) {
                await batch.commit();
                batch = writeBatch(db);
            }
        }
        await batch.commit().catch(e => { throw e; });
        toast({ title: "Siaran Intelijen Terkirim ke Seluruh Bangsawan" });
        setBroadcastReportMessage('');
    } catch (e) { 
        logError(e); 
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'broadcast_batch', operation: 'write' }));
    } finally { setIsSaving(null); }
  };

  const handleGlobalGift = async () => {
      if (!db || giftAmount <= 0) return;
      setIsSaving('global-gift');
      try {
          const usersSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'user')));
          let batch = writeBatch(db);
          let count = 0;
          
          for (const uDoc of usersSnap.docs) {
              const giftPayload = { [giftResource]: increment(giftAmount) };
              batch.update(uDoc.ref, giftPayload);
              count++;
              if (count % 500 === 0) {
                  await batch.commit();
                  batch = writeBatch(db);
              }
          }
          await batch.commit().catch(e => { throw e; });
          toast({ title: `Hadiah ${giftResource.toUpperCase()} Berhasil Dikirim` });
          setGiftAmount(0);
      } catch (e) { 
          logError(e); 
          errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'global_gift_batch', operation: 'write' }));
      } finally { setIsSaving(null); }
  };

  const handleUpdateTitle = (titleId: string, updates: any) => {
      if (!db) return;
      updateDoc(doc(db, 'titles', titleId), updates)
        .then(() => toast({ title: "Gelar Diperbarui" }))
        .catch(err => {
            logError(err);
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: `titles/${titleId}`, operation: 'update', requestResourceData: updates }));
        });
  };

  const filteredUsers = useMemo(() => users.filter(u => u.role !== 'admin' && (u.prideName?.toLowerCase().includes(searchQuery.toLowerCase()) || u.email?.toLowerCase().includes(searchQuery.toLowerCase()))), [users, searchQuery]);
  const sortedUsers = useMemo(() => [...filteredUsers].sort((a,b) => (b.pride || 0) - (a.pride || 0)), [filteredUsers]);

  const globalStats = useMemo(() => {
      const nonAdminUsers = users.filter(u => u.role !== 'admin');
      const totalMoney = nonAdminUsers.reduce((sum, u) => sum + (u.money || 0), 0);
      const totalFood = nonAdminUsers.reduce((sum, u) => sum + (u.food || 0), 0);
      const totalTroops = nonAdminUsers.reduce((sum, u) => {
          const units = u.units || {};
          return sum + Object.values(units).reduce((s, v) => s + (v || 0), 0);
      }, 0);
      return {
          totalUsers: nonAdminUsers.length,
          totalMoney,
          totalFood,
          totalTroops,
          totalAlliances: alliances.length
      };
  }, [users, alliances]);

  return (
    <TooltipProvider>
      <div className="flex h-screen bg-background text-foreground overflow-hidden">
        <aside className="w-64 border-r bg-card/30 backdrop-blur-xl flex flex-col shrink-0">
            <div className="p-6 border-b flex items-center gap-3">
                <Crown className="h-6 w-6 text-primary" />
                <h1 className="text-lg font-gruppo font-bold tracking-widest uppercase">Patra Yudha</h1>
            </div>
            <ScrollArea className="flex-1 p-4">
                <nav className="space-y-1">
                    {[
                        { id: 'rankings', label: 'Peringkat', icon: Activity },
                        { id: 'activity', label: 'Log Aktivitas', icon: Zap },
                        { id: 'users', label: 'Bangsawan', icon: UserIcon },
                        { id: 'alliances', label: 'Aliansi', icon: Users },
                        { id: 'hq-management', label: 'Pusat HQ', icon: Building2 },
                        { id: 'content', label: 'Gelar', icon: Crown },
                        { id: 'war-rules', label: 'Aturan Agresi', icon: Swords },
                        { id: 'zodiac-buffs', label: 'Blessing Rasi', icon: Aperture },
                        { id: 'system-settings', label: 'Setting Sistem', icon: Settings },
                        { id: 'mechanics', label: 'Visual & Lab', icon: FlaskConical },
                        { id: 'danger', label: 'Area Berbahaya', icon: AlertTriangle },
                    ].map(item => (
                        <Button key={item.id} variant={activeTab === item.id ? 'secondary' : 'ghost'} className="w-full justify-start h-11 px-4 text-xs font-bold uppercase tracking-widest" onClick={() => setActiveTab(item.id)}>
                            <item.icon className="mr-3 h-4 w-4 text-primary" /> {item.label}
                        </Button>
                    ))}
                </nav>
            </ScrollArea>
            <div className="p-4 border-t space-y-2">
                <Button variant="outline" className="w-full text-[10px]" onClick={() => { setViewAsUser(!viewAsUser); if(!viewAsUser) router.push('/dashboard'); }}>
                    <UserIcon className="mr-2 h-3 w-3" /> {viewAsUser ? 'Admin Mode' : 'User Mode'}
                </Button>
                <div className="flex justify-center">
                    <ModeToggle className="hidden" />
                </div>
                <Button variant="ghost" className="w-full text-destructive text-[10px]" onClick={() => signOut(auth!)}>Keluar</Button>
            </div>
        </aside>

        <main className="flex-1 flex flex-col overflow-hidden bg-background/50">
            <header className="h-16 border-b flex items-center justify-between px-8 bg-card/10 backdrop-blur-sm shrink-0">
                <h2 className="text-xl font-poiret-one tracking-widest uppercase font-bold text-primary">
                    {activeTab === 'rankings' && 'Peringkat Dunia'}
                    {activeTab === 'activity' && 'Monitoring Intelijen'}
                    {activeTab === 'users' && 'Manajemen Bangsawan'}
                    {activeTab === 'alliances' && 'Struktur Aliansi'}
                    {activeTab === 'hq-management' && 'Manajemen Markas Lengkap'}
                    {activeTab === 'content' && 'Gelar Kehormatan'}
                    {activeTab === 'war-rules' && 'Aturan Agresi'}
                    {activeTab === 'zodiac-buffs' && 'Sistem Zodiac Blessing'}
                    {activeTab === 'system-settings' && 'Konfigurasi Inti'}
                    {activeTab === 'mechanics' && 'Visual & Narasi'}
                    {activeTab === 'danger' && 'Protokol Darurat'}
                </h2>
                <div className="flex items-center gap-4">
                    <div className="relative">
                        <Input placeholder="Cari..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-64 h-9 bg-white/5 pl-10" />
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-40" />
                    </div>
                </div>
            </header>

            <ScrollArea className="flex-1">
                <div className="p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
                    
                    {activeTab === 'rankings' && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                {[
                                    { label: 'Bangsawan', value: globalStats.totalUsers, icon: Users },
                                    { label: 'Aliansi', value: globalStats.totalAlliances, icon: Globe },
                                    { label: 'Dana Dunia', value: globalStats.totalMoney.toLocaleString(), icon: Coins },
                                    { label: 'Logistik', value: globalStats.totalFood.toLocaleString(), icon: Beef },
                                    { label: 'Total Divisi', value: globalStats.totalTroops.toLocaleString(), icon: Swords },
                                ].map((stat, idx) => (
                                    <Card key={idx} className="bg-card/40 border-white/5 p-3 flex flex-col items-center justify-center text-center">
                                        <stat.icon className="h-4 w-4 text-primary/60 mb-1" />
                                        <p className="text-[10px] uppercase font-bold opacity-40 tracking-widest">{stat.label}</p>
                                        <p className="font-gruppo text-lg font-bold">{stat.value}</p>
                                    </Card>
                                ))}
                            </div>
                            <Card className="bg-card/40 border-white/5 shadow-2xl overflow-hidden">
                                <Table>
                                    <TableHeader className="bg-white/5">
                                        <TableRow className="hover:bg-transparent border-none">
                                            <TableHead className="w-16 text-center">#</TableHead>
                                            <TableHead>Penguasa</TableHead>
                                            <TableHead className="text-right">Wibawa</TableHead>
                                            <TableHead className="text-right">Lahan</TableHead>
                                            <TableHead className="text-right">Aset Dana</TableHead>
                                            <TableHead className="text-right">Aksi</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {sortedUsers.slice(0, 50).map((u, i) => (
                                            <TableRow key={u.id} className="hover:bg-white/5 border-white/5 h-16">
                                                <TableCell className="text-center font-gruppo text-xl font-bold opacity-30">{i+1}</TableCell>
                                                <TableCell>
                                                    <div className="font-bold text-white uppercase tracking-wider">{u.prideName}</div>
                                                    <div className="text-[9px] uppercase font-bold text-primary/60">{u.email} • {u.province}</div>
                                                </TableCell>
                                                <TableCell className="text-right font-gruppo text-lg font-bold text-primary">{Math.floor(u.pride || 0).toLocaleString()}</TableCell>
                                                <TableCell className="text-right font-gruppo">{Math.floor(u.land || 0).toLocaleString()}</TableCell>
                                                <TableCell className="text-right font-gruppo">{Math.floor(u.money || 0).toLocaleString()}</TableCell>
                                                <TableCell className="text-right">
                                                    <Button variant="ghost" size="sm" onClick={() => handleEditUserClick(u)}><Pencil className="h-4 w-4" /></Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </Card>
                        </div>
                    )}

                    {activeTab === 'activity' && (
                        <Card className="bg-card/40 border-white/5 shadow-xl overflow-hidden">
                            <Table>
                                <TableHeader className="bg-white/5">
                                    <TableRow>
                                        <TableHead className="w-[120px]">Waktu</TableHead>
                                        <TableHead>Aktor</TableHead>
                                        <TableHead>Tindakan</TableHead>
                                        <TableHead>Target</TableHead>
                                        <TableHead className="text-right">Rincian</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {activityLog.map(log => (
                                        <TableRow key={log.id} className="border-white/5 hover:bg-white/5 h-14">
                                            <TableCell className="text-[10px] opacity-40 font-mono">{log.timestamp ? format(log.timestamp.toDate(), 'HH:mm:ss') : '...'}</TableCell>
                                            <TableCell className="font-bold uppercase text-[10px] tracking-widest">{log.userName}</TableCell>
                                            <TableCell>
                                                <Badge variant={log.action === 'raid' ? 'secondary' : log.action === 'war_attack' ? 'destructive' : 'outline'} className="text-[8px] uppercase tracking-tighter">
                                                    {log.action === 'raid' ? 'PENJARAHAN' : log.action === 'war_attack' ? 'AGRESI WAR' : log.action}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="font-bold uppercase text-[10px] tracking-widest opacity-60">{log.targetName || '-'}</TableCell>
                                            <TableCell className="text-right">
                                                <Dialog>
                                                    <DialogTrigger asChild>
                                                        <Button variant="ghost" size="sm" className="h-8 w-8 rounded-full p-0">
                                                            <ChevronRight className="h-4 w-4" />
                                                        </Button>
                                                    </DialogTrigger>
                                                    <DialogContent className="glass-card sm:max-w-md">
                                                        <DialogHeader>
                                                            <DialogTitle className="font-poiret-one text-xl tracking-widest uppercase text-primary border-b border-primary/20 pb-3">Detail Intelijen Aktivitas</DialogTitle>
                                                        </DialogHeader>
                                                        <div className="py-4 space-y-4">
                                                            <div className="grid grid-cols-2 gap-4 text-xs">
                                                                <div className="space-y-1">
                                                                    <p className="text-[9px] uppercase font-bold opacity-40">Waktu Kejadian</p>
                                                                    <p className="font-mono">{log.timestamp ? format(log.timestamp.toDate(), 'yyyy-MM-dd HH:mm:ss') : 'N/A'}</p>
                                                                </div>
                                                                <div className="space-y-1">
                                                                    <p className="text-[9px] uppercase font-bold opacity-40">Log ID</p>
                                                                    <p className="font-mono truncate">{log.id}</p>
                                                                </div>
                                                            </div>
                                                            <Separator className="bg-white/5" />
                                                            <div className="space-y-2">
                                                                <p className="text-[9px] uppercase font-bold opacity-40">Konfigurasi Pasukan</p>
                                                                <div className="grid grid-cols-2 gap-2">
                                                                    {log.details?.troops && Object.entries(log.details.troops).map(([unit, count]: any) => (
                                                                        <div key={unit} className="p-2 rounded bg-white/5 border border-white/5 flex justify-between">
                                                                            <span className="uppercase text-[9px] font-bold opacity-60">{unitNameMap[unit] || unit}</span>
                                                                            <span className="font-gruppo font-bold text-sm">{Math.floor(count).toLocaleString()}</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                            {log.details?.raidType && (
                                                                <div className="p-3 rounded bg-accent/5 border border-accent/10">
                                                                    <p className="text-[9px] uppercase font-bold opacity-60 mb-1">Prioritas Penjarahan</p>
                                                                    <p className="font-bold text-accent uppercase tracking-widest text-xs">{log.details.raidType}</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </DialogContent>
                                                </Dialog>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </Card>
                    )}

                    {activeTab === 'users' && (
                         <Card className="bg-card/40 border-white/5 overflow-hidden">
                            <Table>
                                <TableHeader className="bg-white/5">
                                    <TableRow><TableHead>Identitas</TableHead><TableHead>Lokasi</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Aksi</TableHead></TableRow>
                                </TableHeader>
                                <TableBody>
                                    {sortedUsers.map(u => (
                                        <TableRow key={u.id} className="hover:bg-white/5 border-white/5">
                                            <TableCell>
                                                <div className="font-bold">{u.prideName}</div>
                                                <div className="text-[9px] opacity-40">{u.email}</div>
                                            </TableCell>
                                            <TableCell className="text-[10px] uppercase font-bold tracking-widest opacity-60">{u.province} ({u.coordinates?.x}:{u.coordinates?.y})</TableCell>
                                            <TableCell>
                                                <Badge variant={u.status === 'disabled' ? 'destructive' : 'outline'} className="text-[8px] uppercase">
                                                    {u.status || 'active'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="sm" onClick={() => handleEditUserClick(u)}><Pencil className="h-3 w-3 mr-2" /> Edit</Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </Card>
                    )}

                    {activeTab === 'alliances' && (
                        <div className="space-y-4">
                            <div className="flex justify-end">
                                <Button onClick={() => handleEditAllianceClick()} className="btn-3d uppercase text-[10px] font-bold tracking-widest">
                                    <Plus className="mr-2 h-4 w-4" /> Aliansi Baru
                                </Button>
                            </div>
                            <Card className="bg-card/40 border-white/5 overflow-hidden">
                                <Table>
                                    <TableHeader className="bg-white/5">
                                        <TableRow>
                                            <TableHead>Aliansi</TableHead>
                                            <TableHead>Lokasi</TableHead>
                                            <TableHead className="text-center">Anggota</TableHead>
                                            <TableHead className="text-right">Aksi</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {alliances.map(a => (
                                            <TableRow key={a.id} className="hover:bg-white/5 border-white/5">
                                                <TableCell>
                                                    <div className="font-bold uppercase tracking-wider cursor-pointer hover:text-primary" onClick={() => handleShowAllianceMembers(a)}>{a.name}</div>
                                                    <div className="text-[9px] font-bold text-primary/60">[{a.tag}]</div>
                                                </TableCell>
                                                <TableCell className="text-[10px] uppercase font-bold opacity-60">{a.province} ({a.coordinates.x}:{a.coordinates.y})</TableCell>
                                                <TableCell className="text-center font-gruppo">{a.memberCount || 0}</TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <Button variant="ghost" size="sm" onClick={() => handleEditAllianceClick(a)}><Pencil className="h-3 w-3" /></Button>
                                                        <AlertDialog>
                                                            <AlertDialogTrigger asChild><Button variant="ghost" size="sm" className="text-destructive"><Trash2 className="h-3 w-3" /></Button></AlertDialogTrigger>
                                                            <AlertDialogContent className="glass-card">
                                                                <AlertDialogHeader><AlertDialogTitle>Bubarkan Aliansi?</AlertDialogTitle><AlertDialogDescription>Ini akan menghapus aliansi dan membuat seluruh anggota menjadi independen. Tindakan ini permanen.</AlertDialogDescription></AlertDialogHeader>
                                                                <AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteAlliance(a.id)} className="bg-destructive">Ya, Bubarkan</AlertDialogAction></AlertDialogFooter>
                                                            </AlertDialogContent>
                                                        </AlertDialog>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </Card>
                        </div>
                    )}

                    {activeTab === 'hq-management' && (
                        <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
                             <Card className="bg-card/40 border-white/5 shadow-2xl relative overflow-hidden group">
                                <div className="absolute top-0 left-0 w-1 h-full bg-primary/40 group-hover:bg-primary transition-colors" />
                                <CardHeader className="p-8 border-b border-white/5">
                                    <CardTitle className="text-2xl font-poiret-one tracking-widest text-primary uppercase flex items-center gap-3">
                                        <Microscope className="h-6 w-6" /> Laboratorium Efek Infrastruktur
                                    </CardTitle>
                                    <CardDescription className="text-[10px] uppercase font-bold tracking-widest opacity-60">Atur parameter teknis dan bonus yang dihasilkan oleh setiap unit bangunan.</CardDescription>
                                </CardHeader>
                                <CardContent className="p-8 space-y-12">
                                    {/* Ekonomi & Populasi */}
                                    <div className="space-y-6">
                                        <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-primary/80 flex items-center gap-2">
                                            <Coins className="h-4 w-4" /> Ekonomi & Populasi Dasar
                                        </h3>
                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                            <div className="space-y-2">
                                                <Label className="text-[9px] uppercase opacity-40">Rumah: Rakyat/Jam</Label>
                                                <Input type="number" value={buildingEffects.residence?.unemployed || 0} onChange={e => setBuildingEffects({...buildingEffects, residence: {...buildingEffects.residence, unemployed: Number(e.target.value)}})} className="h-9 bg-white/5" />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-[9px] uppercase opacity-40">Rumah: Kapasitas</Label>
                                                <Input type="number" value={buildingEffects.residence?.capacity || 0} onChange={e => setBuildingEffects({...buildingEffects, residence: {...buildingEffects.residence, capacity: Number(e.target.value)}})} className="h-9 bg-white/5" />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-[9px] uppercase opacity-40">Sawah: Makan/Jam</Label>
                                                <Input type="number" value={buildingEffects.farm?.food || 0} onChange={e => setBuildingEffects({...buildingEffects, farm: {food: Number(e.target.value)}})} className="h-9 bg-white/5" />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-[9px] uppercase opacity-40">Tambang: Uang/Jam</Label>
                                                <Input type="number" value={buildingEffects.tambang?.money || 0} onChange={e => setBuildingEffects({...buildingEffects, tambang: {money: Number(e.target.value)}})} className="h-9 bg-white/5" />
                                            </div>
                                        </div>
                                    </div>

                                    <Separator className="bg-white/5" />

                                    {/* Militer & Pertahanan */}
                                    <div className="space-y-6">
                                        <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-primary/80 flex items-center gap-2">
                                            <Shield className="h-4 w-4" /> Taktis Militer & Pertahanan
                                        </h3>
                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                            <div className="space-y-2">
                                                <Label className="text-[9px] uppercase opacity-40">Benteng: Bonus Tahan (%)</Label>
                                                <Input type="number" value={buildingEffects.fort?.defenseBonus || 0} onChange={e => setBuildingEffects({...buildingEffects, fort: {defenseBonus: Number(e.target.value)}})} className="h-9 bg-white/5" />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-[9px] uppercase opacity-40">Mobilitas: Bonus Atk (%)</Label>
                                                <Input type="number" value={buildingEffects.mobility?.attackBonus || 0} onChange={e => setBuildingEffects({...buildingEffects, mobility: {attackBonus: Number(e.target.value)}})} className="h-9 bg-white/5" />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-[9px] uppercase opacity-40">Barak: Bonus Latih (%)</Label>
                                                <Input type="number" value={buildingEffects.barracks?.trainingBonus || 0} onChange={e => setBuildingEffects({...buildingEffects, barracks: {trainingBonus: Number(e.target.value)}})} className="h-9 bg-white/5" />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-[9px] uppercase opacity-40">Menara: Anti-Jarah (%)</Label>
                                                <Input type="number" value={buildingEffects.tower?.bonusPertahananPasukanKhusus || 0} onChange={e => setBuildingEffects({...buildingEffects, tower: {bonusPertahananPasukanKhusus: Number(e.target.value)}})} className="h-9 bg-white/5" />
                                            </div>
                                        </div>
                                    </div>

                                    <Separator className="bg-white/5" />

                                    {/* Riset Universitas */}
                                    <div className="space-y-6">
                                        <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-primary/80 flex items-center gap-2">
                                            <FlaskConical className="h-4 w-4" /> Riset Universitas (Per Level)
                                        </h3>
                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                            <div className="space-y-2">
                                                <Label className="text-[9px] uppercase opacity-40">Bonus Konstruksi (%)</Label>
                                                <Input type="number" value={buildingEffects.university?.constructionBonus || 0} onChange={e => setBuildingEffects({...buildingEffects, university: {...buildingEffects.university, constructionBonus: Number(e.target.value)}})} className="h-9 bg-white/5" />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-[9px] uppercase opacity-40">Bonus Resource (%)</Label>
                                                <Input type="number" value={buildingEffects.university?.foodAndMoneyBonus || 0} onChange={e => setBuildingEffects({...buildingEffects, university: {...buildingEffects.university, foodAndMoneyBonus: Number(e.target.value)}})} className="h-9 bg-white/5" />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-[9px] uppercase opacity-40">Bonus Serang (%)</Label>
                                                <Input type="number" value={buildingEffects.university?.attackBonus || 0} onChange={e => setBuildingEffects({...buildingEffects, university: {...buildingEffects.university, attackBonus: Number(e.target.value)}})} className="h-9 bg-white/5" />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-[9px] uppercase opacity-40">Bonus Tahan (%)</Label>
                                                <Input type="number" value={buildingEffects.university?.defenseBonus || 0} onChange={e => setBuildingEffects({...buildingEffects, university: {...buildingEffects.university, defenseBonus: Number(e.target.value)}})} className="h-9 bg-white/5" />
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <Button onClick={() => saveDoc('building-effects', buildingEffects, "Seluruh Efek HQ")} className="w-full btn-3d h-12 text-sm" disabled={!!isSaving}>
                                        <Save className="h-5 w-5 mr-3" /> Simpan Konfigurasi Efek Markas
                                    </Button>
                                </CardContent>
                            </Card>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                <Card className="bg-card/40 border-white/5">
                                    <CardHeader><CardTitle className="text-sm uppercase tracking-widest text-primary">Biaya Infrastruktur</CardTitle></CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="grid grid-cols-1 gap-4">
                                            {Object.keys(buildingNameMap).map(key => (
                                                <div key={key} className="space-y-1.5">
                                                    <Label className="text-[10px] opacity-60">{buildingNameMap[key] || key}</Label>
                                                    <Input type="number" value={gameCosts.buildings?.[key] || 0} onChange={e => setGameCosts({...gameCosts, buildings: {...gameCosts.buildings, [key]: Number(e.target.value)}})} className="h-9 bg-white/5" />
                                                </div>
                                            ))}
                                        </div>
                                        <Button onClick={() => saveDoc('game-costs', gameCosts, "Harga Bangunan")} className="w-full btn-3d" disabled={!!isSaving}><Save className="h-4 w-4 mr-2" /> Simpan Harga</Button>
                                    </CardContent>
                                </Card>

                                <Card className="bg-card/40 border-white/5">
                                    <CardHeader><CardTitle className="text-sm uppercase tracking-widest text-primary">Biaya Pelatihan Divisi</CardTitle></CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="grid grid-cols-1 gap-4">
                                            {['attack', 'defense', 'elite', 'raider'].map(key => (
                                                <div key={key} className="space-y-1.5">
                                                    <Label className="text-[10px] opacity-60">{unitNameMap[key] || key}</Label>
                                                    <Input type="number" value={gameCosts.units?.[key] || 0} onChange={e => setGameCosts({...gameCosts, units: {...gameCosts.units, [key]: Number(e.target.value)}})} className="h-9 bg-white/5" />
                                                </div>
                                            ))}
                                        </div>
                                        <Button onClick={() => saveDoc('game-costs', gameCosts, "Harga Pasukan")} className="w-full btn-3d" disabled={!!isSaving}><Save className="h-4 w-4 mr-2" /> Simpan Harga</Button>
                                    </CardContent>
                                </Card>

                                <Card className="bg-card/40 border-white/5">
                                    <CardHeader><CardTitle className="text-sm uppercase tracking-widest text-primary">Upkeep (Gaji Per Jam)</CardTitle></CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="grid grid-cols-1 gap-4">
                                            <div className="space-y-1.5">
                                                <Label className="text-[10px] opacity-60">Rakyat (Jiwa)</Label>
                                                <Input type="number" value={gameCosts.upkeep?.unemployed || 0} onChange={e => setGameCosts({...gameCosts, upkeep: {...gameCosts.upkeep, unemployed: Number(e.target.value)}})} className="h-9 bg-white/5" />
                                            </div>
                                            {['attack', 'defense', 'elite', 'raider'].map(key => (
                                                <div key={key} className="space-y-1.5">
                                                    <Label className="text-[10px] opacity-60">{unitNameMap[key] || key}</Label>
                                                    <Input type="number" value={gameCosts.upkeep?.[key] || 0} onChange={e => setGameCosts({...gameCosts, upkeep: {...gameCosts.upkeep, [key]: Number(e.target.value)}})} className="h-9 bg-white/5" />
                                                </div>
                                            ))}
                                        </div>
                                        <Button onClick={() => saveDoc('game-costs', gameCosts, "Upkeep")} className="w-full btn-3d" disabled={!!isSaving}><Save className="h-4 w-4 mr-2" /> Simpan Gaji</Button>
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    )}

                    {activeTab === 'system-settings' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <Card className="bg-card/40 border-white/5">
                                <CardHeader><CardTitle className="text-sm uppercase tracking-widest text-primary flex items-center gap-2"><Clock className="h-4 w-4" /> Aturan Waktu Dasar (Jam)</CardTitle></CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid grid-cols-1 gap-4">
                                        <div className="space-y-1.5">
                                            <Label className="text-[10px] opacity-60">Waktu Konstruksi Dasar (Jam)</Label>
                                            <Input type="number" value={timingRules.constructionTimeInHours || 0} onChange={e => setTimingRules({...timingRules, constructionTimeInHours: Number(e.target.value)})} className="h-9 bg-white/5" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-[10px] opacity-60">Waktu Pelatihan Dasar (Jam)</Label>
                                            <Input type="number" value={timingRules.trainingTimeInHours || 0} onChange={e => setTimingRules({...timingRules, trainingTimeInHours: Number(e.target.value)})} className="h-9 bg-white/5" />
                                        </div>
                                    </div>
                                    <Button onClick={() => saveDoc('timing-rules', timingRules, "Aturan Waktu")} className="w-full btn-3d" disabled={!!isSaving}><Save className="h-4 w-4 mr-2" /> Simpan Aturan Waktu</Button>
                                </CardContent>
                            </Card>

                            <Card className="bg-card/40 border-white/5 md:col-span-2">
                                <CardHeader><CardTitle className="text-sm uppercase tracking-widest text-primary flex items-center gap-2"><UserPlus className="h-4 w-4" /> Modal Awal Bangsawan Baru</CardTitle></CardHeader>
                                <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-6">
                                    <div className="space-y-4">
                                        <p className="text-[9px] font-bold uppercase opacity-60 border-b border-white/5 pb-1">Sumber Daya</p>
                                        <div className="space-y-2">
                                            <Label>Uang</Label><Input type="number" value={initialResources.money || 0} onChange={e => setInitialResources({...initialResources, money: Number(e.target.value)})} className="bg-white/5 h-8" />
                                            <Label>Makanan</Label><Input type="number" value={initialResources.food || 0} onChange={e => setInitialResources({...initialResources, food: Number(e.target.value)})} className="bg-white/5 h-8" />
                                            <Label>Lahan</Label><Input type="number" value={initialResources.land || 0} onChange={e => setInitialResources({...initialResources, land: Number(e.target.value)})} className="bg-white/5 h-8" />
                                            <Label>Wibawa</Label><Input type="number" value={initialResources.pride || 0} onChange={e => setInitialResources({...initialResources, pride: Number(e.target.value)})} className="bg-white/5 h-8" />
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        <p className="text-[9px] font-bold uppercase opacity-60 border-b border-white/5 pb-1">Populasi</p>
                                        <div className="space-y-2">
                                            <Label>Rakyat</Label><Input type="number" value={initialResources.unemployed || 0} onChange={e => setInitialResources({...initialResources, unemployed: Number(e.target.value)})} className="bg-white/5 h-8" />
                                            <Label>Serang</Label><Input type="number" value={initialResources.attack || 0} onChange={e => setInitialResources({...initialResources, attack: Number(e.target.value)})} className="bg-white/5 h-8" />
                                            <Label>Tahan</Label><Input type="number" value={initialResources.defense || 0} onChange={e => setInitialResources({...initialResources, defense: Number(e.target.value)})} className="bg-white/5 h-8" />
                                            <Label>Khusus</Label><Input type="number" value={initialResources.raider || 0} onChange={e => setInitialResources({...initialResources, raider: Number(e.target.value)})} className="bg-white/5 h-8" />
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        <p className="text-[9px] font-bold uppercase opacity-60 border-b border-white/5 pb-1">Infrastruktur I</p>
                                        <div className="space-y-2">
                                            <Label>Rumah</Label><Input type="number" value={initialResources.residence || 0} onChange={e => setInitialResources({...initialResources, residence: Number(e.target.value)})} className="bg-white/5 h-8" />
                                            <Label>Sawah</Label><Input type="number" value={initialResources.farm || 0} onChange={e => setInitialResources({...initialResources, farm: Number(e.target.value)})} className="bg-white/5 h-8" />
                                            <Label>Tambang</Label><Input type="number" value={initialResources.tambang || 0} onChange={e => setInitialResources({...initialResources, tambang: Number(e.target.value)})} className="bg-white/5 h-8" />
                                            <Label>Menara</Label><Input type="number" value={initialResources.tower || 0} onChange={e => setInitialResources({...initialResources, tower: Number(e.target.value)})} className="bg-white/5 h-8" />
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        <p className="text-[9px] font-bold uppercase opacity-60 border-b border-white/5 pb-1">Infrastruktur II</p>
                                        <div className="space-y-2">
                                            <Label>Barak</Label><Input type="number" value={initialResources.barracks || 0} onChange={e => setInitialResources({...initialResources, barracks: Number(e.target.value)})} className="bg-white/5 h-8" />
                                            <Label>Mobilitas</Label><Input type="number" value={initialResources.mobility || 0} onChange={e => setInitialResources({...initialResources, mobility: Number(e.target.value)})} className="bg-white/5 h-8" />
                                            <Label>Kampus</Label><Input type="number" value={initialResources.university || 0} onChange={e => setInitialResources({...initialResources, university: Number(e.target.value)})} className="bg-white/5 h-8" />
                                            <Label>Benteng</Label><Input type="number" value={initialResources.fort || 0} onChange={e => setInitialResources({...initialResources, fort: Number(e.target.value)})} className="bg-white/5 h-8" />
                                        </div>
                                    </div>
                                </CardContent>
                                <CardFooter>
                                    <Button onClick={() => saveDoc('initial-resources', initialResources, "Modal Awal")} className="w-full btn-3d" disabled={!!isSaving}><Save className="h-4 w-4 mr-2" /> Terapkan Modal Awal</Button>
                                </CardFooter>
                            </Card>
                        </div>
                    )}

                    {activeTab === 'mechanics' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <Card className="bg-card/40 border-white/5 md:col-span-2">
                                <CardHeader>
                                    <CardTitle className="text-sm uppercase tracking-widest text-primary flex items-center gap-2">
                                        <Megaphone className="h-4 w-4" /> Siaran Intelijen Global
                                    </CardTitle>
                                    <CardDescription className="text-[10px]">Kirim pesan narasi atau pengumuman penting ke kotak masuk seluruh Bangsawan.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="space-y-2">
                                        <Label>Judul Laporan</Label>
                                        <Input value={broadcastTitle} onChange={e => setBroadcastReportTitle(e.target.value)} className="bg-white/5" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Pesan Intelijen</Label>
                                        <Textarea 
                                            placeholder="Tulis instruksi atau pengumuman dewan militer..." 
                                            value={broadcastMessage} 
                                            onChange={e => setBroadcastReportMessage(e.target.value)} 
                                            className="bg-white/5 h-32" 
                                        />
                                    </div>
                                    <Button 
                                        onClick={handleBroadcastReport} 
                                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold uppercase tracking-widest btn-3d" 
                                        disabled={isSaving === 'broadcast' || !broadcastMessage}
                                    >
                                        <Send className="mr-2 h-4 w-4" /> {isSaving === 'broadcast' ? 'Mengirim...' : 'Siarkan Laporan ke Seluruh Bangsawan'}
                                    </Button>
                                </CardContent>
                            </Card>

                            <Card className="bg-card/40 border-white/5">
                                <CardHeader><CardTitle className="text-sm uppercase tracking-widest text-primary flex items-center gap-2"><FlaskConical className="h-4 w-4" /> Mekanika & Biaya Dasar</CardTitle></CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <Label className="text-[9px] uppercase opacity-60">Kapasitas Aliansi</Label>
                                            <Input type="number" value={gameMechanics.allianceCapacity || 0} onChange={e => setGameMechanics({...gameMechanics, allianceCapacity: Number(e.target.value)})} className="bg-white/5 h-9" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-[9px] uppercase opacity-60">Faktor Makan Pasukan</Label>
                                            <Input type="number" value={gameMechanics.troopFoodConsumptionFactor || 0} onChange={e => setGameMechanics({...gameMechanics, troopFoodConsumptionFactor: Number(e.target.value)})} className="bg-white/5 h-9" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-[9px] uppercase opacity-60">Biaya Ganti Nama (Wibawa)</Label>
                                            <Input type="number" value={gameMechanics.changePrideNameCost || 0} onChange={e => setGameMechanics({...gameMechanics, changePrideNameCost: Number(e.target.value)})} className="bg-white/5 h-9" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-[9px] uppercase opacity-60">Biaya Keluar Aliansi (Wibawa)</Label>
                                            <Input type="number" value={gameMechanics.leaveAlliancePrideCost || 0} onChange={e => setGameMechanics({...gameMechanics, leaveAlliancePrideCost: Number(e.target.value)})} className="bg-white/5 h-9" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-[9px] uppercase opacity-60">Biaya Hancur Bangunan (Wibawa)</Label>
                                            <Input type="number" value={gameMechanics.destroyBuildingPrideCost || 0} onChange={e => setGameMechanics({...gameMechanics, destroyBuildingPrideCost: Number(e.target.value)})} className="bg-white/5 h-9" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-[9px] uppercase opacity-60">Biaya Rush Training (Wibawa)</Label>
                                            <Input type="number" value={gameMechanics.rushTrainingCost || 0} onChange={e => setGameMechanics({...gameMechanics, rushTrainingCost: Number(e.target.value)})} className="bg-white/5 h-9" />
                                        </div>
                                    </div>
                                    <Button onClick={() => saveDoc('game-mechanics', gameMechanics, "Mekanika Game")} className="w-full btn-3d" disabled={!!isSaving}><Save className="h-4 w-4 mr-2" /> Simpan Mekanika</Button>
                                </CardContent>
                            </Card>

                            <Card className="bg-card/40 border-white/5">
                                <CardHeader><CardTitle className="text-sm uppercase tracking-widest text-primary">Konfigurasi Visual & Era</CardTitle></CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/5">
                                        <div className="space-y-0.5">
                                            <Label className="text-[10px] uppercase font-bold text-primary">Mode Pemeliharaan</Label>
                                            <p className="text-[8px] opacity-40 uppercase">Aktifkan banner peringatan di seluruh dashboard pemain.</p>
                                        </div>
                                        <Checkbox 
                                            checked={adminInfo.maintenanceMode || false} 
                                            onCheckedChange={(checked) => setAdminInfo({...adminInfo, maintenanceMode: checked})}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Pesan Marquee Dashboard</Label>
                                        <Textarea value={adminInfo.message || ''} onChange={e => setAdminInfo({...adminInfo, message: e.target.value})} className="bg-white/5" />
                                    </div>
                                    
                                    <Separator className="bg-white/5" />
                                    
                                    <div className="space-y-4">
                                        <p className="text-[10px] uppercase font-bold tracking-widest text-primary/60">Latar Belakang Dashboard</p>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div className="md:col-span-2 space-y-2">
                                                <Label>URL Gambar (Dashboard)</Label>
                                                <Input value={adminInfo.dashboardBackgroundUrl || ''} onChange={e => setAdminInfo({...adminInfo, dashboardBackgroundUrl: e.target.value})} className="bg-white/5" placeholder="https://..." />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Blur (px)</Label>
                                                <Input type="number" value={adminInfo.dashboardBackgroundBlur || 0} onChange={e => setAdminInfo({...adminInfo, dashboardBackgroundBlur: Number(e.target.value)})} className="bg-white/5" />
                                            </div>
                                        </div>
                                        
                                        <p className="text-[10px] uppercase font-bold tracking-widest text-primary/60 mt-4">Latar Belakang Halaman Utama</p>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div className="md:col-span-2 space-y-2">
                                                <Label>URL Gambar (Home)</Label>
                                                <Input value={adminInfo.homeBackgroundUrl || ''} onChange={e => setAdminInfo({...adminInfo, homeBackgroundUrl: e.target.value})} className="bg-white/5" placeholder="https://..." />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Blur (px)</Label>
                                                <Input type="number" value={adminInfo.homeBackgroundBlur || 0} onChange={e => setAdminInfo({...adminInfo, homeBackgroundBlur: Number(e.target.value)})} className="bg-white/5" />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2"><Label>Nama Era</Label><Input value={eraInfo.name} onChange={e => setEraInfo({...eraInfo, name: e.target.value})} className="bg-white/5" /></div>
                                        <div className="space-y-2"><Label>Akhir Era</Label><Input type="date" value={eraInfo.endDate} onChange={e => setEraInfo({...eraInfo, endDate: e.target.value})} className="bg-white/5" /></div>
                                    </div>
                                    
                                    <Button onClick={() => {
                                        saveDoc('admin-info', adminInfo, "Sistem & Visual");
                                        saveDoc('era-info', { name: eraInfo.name, endDate: eraInfo.endDate ? Timestamp.fromDate(new Date(eraInfo.endDate)) : null }, "Era");
                                    }} className="w-full btn-3d" disabled={!!isSaving}>
                                        <Save className="h-4 w-4 mr-2" /> Simpan Konfigurasi Visual & Era
                                    </Button>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {activeTab === 'war-rules' && (
                        <Card className="bg-card/40 border-white/5 p-8">
                            <CardHeader className="px-0"><CardTitle className="text-primary font-poiret-one text-2xl uppercase tracking-[0.2em]">Matrix Aturan Agresi</CardTitle></CardHeader>
                            <div className="overflow-x-auto border rounded-xl border-white/10">
                                <Table>
                                    <TableHeader className="bg-white/5">
                                        <TableRow>
                                            <TableHead className="w-48 font-bold text-accent">Gelar Penyerang</TableHead>
                                            {titles.map(t => <TableHead key={t.id} className="text-center text-[9px] uppercase font-bold tracking-tighter">{t.name}</TableHead>)}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {titles.map(source => (
                                            <TableRow key={source.id} className="hover:bg-white/5 border-white/5">
                                                <TableCell className="font-bold text-xs uppercase tracking-wider">{source.name}</TableCell>
                                                {titles.map(target => (
                                                    <TableCell key={target.id} className="text-center">
                                                        <Checkbox 
                                                            checked={attackMatrix[source.id]?.includes(target.id)} 
                                                            onCheckedChange={() => handleToggleAttackMatrix(source.id, target.id)}
                                                            className="border-primary/20"
                                                        />
                                                    </TableCell>
                                                ))}
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </Card>
                    )}

                    {activeTab === 'zodiac-buffs' && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {[1, 2, 3].map(rank => (
                                <Card key={rank} className="bg-card/40 border-white/5 shadow-xl relative overflow-hidden">
                                    <div className={cn("absolute top-0 left-0 w-1 h-full", rank === 1 ? "bg-yellow-500" : rank === 2 ? "bg-slate-400" : "bg-amber-700")} />
                                    <CardHeader>
                                        <CardTitle className="text-lg uppercase tracking-widest flex items-center gap-2">
                                            <Trophy className={cn("h-5 w-5", rank === 1 ? "text-yellow-500" : rank === 2 ? "text-slate-400" : "text-amber-700")} />
                                            Blessing Rank #{rank}
                                        </CardTitle>
                                        <CardDescription className="text-[10px] uppercase font-bold opacity-60">Bonus atribut untuk rasi bintang peringkat {rank}</CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1.5">
                                                <Label className="text-[9px] uppercase opacity-60">Bonus Uang (%)</Label>
                                                <Input type="number" value={zodiacBuffs[`rank${rank}`]?.money || 0} onChange={e => setZodiacBuffs({...zodiacBuffs, [`rank${rank}`]: {...zodiacBuffs[`rank${rank}`], money: Number(e.target.value)}})} className="bg-white/5 h-9" />
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label className="text-[9px] uppercase opacity-60">Bonus Makan (%)</Label>
                                                <Input type="number" value={zodiacBuffs[`rank${rank}`]?.food || 0} onChange={e => setZodiacBuffs({...zodiacBuffs, [`rank${rank}`]: {...zodiacBuffs[`rank${rank}`], food: Number(e.target.value)}})} className="bg-white/5 h-9" />
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label className="text-[9px] uppercase opacity-60">Bonus Serang (%)</Label>
                                                <Input type="number" value={zodiacBuffs[`rank${rank}`]?.attack || 0} onChange={e => setZodiacBuffs({...zodiacBuffs, [`rank${rank}`]: {...zodiacBuffs[`rank${rank}`], attack: Number(e.target.value)}})} className="bg-white/5 h-9" />
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label className="text-[9px] uppercase opacity-60">Bonus Tahan (%)</Label>
                                                <Input type="number" value={zodiacBuffs[`rank${rank}`]?.defense || 0} onChange={e => setZodiacBuffs({...zodiacBuffs, [`rank${rank}`]: {...zodiacBuffs[`rank${rank}`], defense: Number(e.target.value)}})} className="bg-white/5 h-9" />
                                            </div>
                                        </div>
                                    </CardContent>
                                    <CardFooter>
                                        <Button onClick={() => saveDoc('zodiac-buffs', zodiacBuffs, "Buff Zodiak")} className="w-full btn-3d" disabled={!!isSaving}><Save className="h-4 w-4 mr-2" /> Simpan Blessing</Button>
                                    </CardFooter>
                                </Card>
                            ))}
                        </div>
                    )}

                    {activeTab === 'content' && (
                        <Card className="bg-card/40 border-white/5 overflow-hidden">
                            <Table>
                                <TableHeader className="bg-white/5">
                                    <TableRow>
                                        <TableHead>Nama Gelar</TableHead>
                                        <TableHead className="text-right">Wibawa Min.</TableHead>
                                        <TableHead className="text-right">Bonus Atk</TableHead>
                                        <TableHead className="text-right">Bonus Def</TableHead>
                                        <TableHead className="text-right">Bonus Res</TableHead>
                                        <TableHead className="text-right">Aksi</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {titles.map(t => (
                                        <TableRow key={t.id} className="hover:bg-white/5 border-white/5">
                                            <TableCell className="font-bold uppercase tracking-widest">{t.name}</TableCell>
                                            <TableCell className="text-right">
                                                <Input 
                                                    type="number" 
                                                    className="w-24 ml-auto text-right h-8 bg-transparent" 
                                                    defaultValue={t.prideRequired} 
                                                    onBlur={e => handleUpdateTitle(t.id, { prideRequired: Number(e.target.value) })}
                                                />
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Input 
                                                    type="number" 
                                                    className="w-16 ml-auto text-right h-8 bg-transparent text-green-400" 
                                                    defaultValue={t.attackBonus} 
                                                    onBlur={e => handleUpdateTitle(t.id, { attackBonus: Number(e.target.value) })}
                                                />
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Input 
                                                    type="number" 
                                                    className="w-16 ml-auto text-right h-8 bg-transparent text-green-400" 
                                                    defaultValue={t.defenseBonus} 
                                                    onBlur={e => handleUpdateTitle(t.id, { defenseBonus: Number(e.target.value) })}
                                                />
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Input 
                                                    type="number" 
                                                    className="w-16 ml-auto text-right h-8 bg-transparent text-green-400" 
                                                    defaultValue={t.resourceBonus} 
                                                    onBlur={e => handleUpdateTitle(t.id, { resourceBonus: Number(e.target.value) })}
                                                />
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Badge variant="outline" className="text-[7px]">AUTO-SAVE</Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </Card>
                    )}

                    {activeTab === 'danger' && (
                        <Card className="bg-destructive/5 border-destructive/20 p-8 shadow-2xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                                <AlertTriangle className="h-40 w-48 text-destructive" />
                            </div>
                            <CardHeader className="px-0">
                                <CardTitle className="text-destructive flex items-center gap-3 font-poiret-one text-3xl uppercase tracking-[0.3em]">
                                    <AlertTriangle className="h-8 w-8" /> Protokol Darurat & Pemusnahan
                                </CardTitle>
                                <CardDescription className="text-destructive/60 uppercase font-bold text-[10px] tracking-widest mt-1">
                                    Kontrol kritis untuk manajemen populasi dan sumber daya global.
                                </CardDescription>
                            </CardHeader>

                            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mt-8 space-y-6">
                                <div className="flex items-center gap-3 mb-2">
                                    <Coins className="h-6 w-6 text-yellow-500" />
                                    <h3 className="font-bold uppercase tracking-widest text-sm">Injeksi Sumber Daya Global</h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="space-y-2">
                                        <Label>Jenis Aset</Label>
                                        <Select value={giftResource} onValueChange={setGiftResource}>
                                            <SelectTrigger className="bg-white/5"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="money">Uang</SelectItem>
                                                <SelectItem value="food">Makanan</SelectItem>
                                                <SelectItem value="pride">Wibawa</SelectItem>
                                                <SelectItem value="land">Lahan</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Jumlah Hadiah</Label>
                                        <Input type="number" value={giftAmount} onChange={e => setGiftAmount(Number(e.target.value))} className="bg-white/5" />
                                    </div>
                                    <div className="flex items-end">
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button className="w-full bg-yellow-600 hover:bg-yellow-700 text-white font-bold uppercase text-[10px] tracking-widest h-10">
                                                    Berikan ke Seluruh Bangsawan
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent className="glass-card">
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Konfirmasi Injeksi Aset</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        Anda akan memberikan {giftAmount.toLocaleString()} {giftResource} kepada SELURUH pemain aktif. Tindakan ini tidak dapat ditarik kembali.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Batal</AlertDialogCancel>
                                                    <AlertDialogAction onClick={handleGlobalGift} className="bg-yellow-600">Ya, Kirim Hadiah</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-8">
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="outline" className="h-20 border-destructive/20 text-destructive bg-destructive/5 hover:bg-destructive/10 uppercase text-[10px] font-bold tracking-[0.3em] group transition-all">
                                            <RefreshCcw className="mr-3 h-5 w-5 group-hover:rotate-180 transition-transform duration-500" /> 
                                            Wipe Stat Pemain (Soft Reset)
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent className="glass-card">
                                        <AlertDialogHeader>
                                            <AlertDialogTitle className="text-destructive">Soft Reset Statistik</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                Seluruh pemain (kecuali Admin) akan dikembalikan ke modal awal yang diatur pada tab 'Mekanisme'. Seluruh aset bangunan dan pasukan akan diatur ulang. Akun tetap ada.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Batal</AlertDialogCancel>
                                            <AlertDialogAction onClick={handleResetPlayers} className="bg-destructive hover:bg-destructive/90">Lakukan Soft Reset</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>

                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="outline" className="h-20 border-destructive/20 text-destructive bg-destructive/5 hover:bg-destructive/10 uppercase text-[10px] font-bold tracking-[0.3em] group transition-all">
                                            <Trash2 className="mr-3 h-4 w-4" /> 
                                            Musnahkan Log & Laporan
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent className="glass-card">
                                        <AlertDialogHeader>
                                            <AlertDialogTitle className="text-destructive">Pembersihan Arsip Intelijen</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                Seluruh Log Aktivitas, Laporan pertempuran individual, dan status peperangan aktif antar aliansi akan dihapus permanen untuk membersihkan cache database.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Batal</AlertDialogCancel>
                                            <AlertDialogAction onClick={handleClearLogs} className="bg-destructive hover:bg-destructive/90">Bersihkan Arsip</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>

                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="destructive" className="h-24 md:col-span-2 shadow-2xl uppercase text-xs font-bold tracking-[0.5em] group transition-all relative overflow-hidden">
                                            <div className="absolute inset-0 bg-gradient-to-r from-red-600/20 to-transparent pointer-events-none" />
                                            <HardDriveDownload className="mr-4 h-6 w-6 group-hover:animate-bounce transition-all" /> 
                                            Protokol SYSTEM RESET (Nuclear Wipe)
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent className="glass-card max-w-2xl">
                                        <div className="flex flex-col gap-4">
                                            <AlertDialogHeader>
                                                <AlertDialogTitle className="text-destructive text-3xl font-poiret-one uppercase tracking-widest flex items-center gap-3">
                                                    <ShieldAlert className="h-8 w-8" /> NUCLEAR SYSTEM RESET
                                                </AlertDialogTitle>
                                                <AlertDialogDescription className="text-base leading-relaxed py-4 text-foreground/80" asChild>
                                                    <div>
                                                        <strong className="text-destructive underline">PERINGATAN KRITIS:</strong> Tindakan ini adalah pembersihan total database aplikasi. 
                                                        <ul className="list-disc pl-5 mt-4 space-y-2 text-sm">
                                                            <li>Seluruh profil Firestore (Non-Admin) akan dimusnahkan.</li>
                                                            <li>Seluruh Aliansi, Log, Laporan, dan Antrian akan dihapus bersih.</li>
                                                            <li><strong className="text-white">Reset Konfigurasi:</strong> Pengaturan game akan dikembalikan ke standar pabrik (Default).</li>
                                                        </ul>
                                                        <div className="mt-4 text-xs italic opacity-60">*Data Email di Firebase Authentication tidak terhapus (memerlukan Cloud Functions), namun profil game mereka akan hilang sepenuhnya.</div>
                                                    </div>
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter className="gap-3 pt-6 border-t border-white/10">
                                                <AlertDialogCancel className="bg-white/5 border-white/10">BATALKAN PROTOKOL</AlertDialogCancel>
                                                <AlertDialogAction onClick={handleSystemReset} className="bg-destructive hover:bg-red-700 text-white font-bold h-11 px-8 animate-pulse shadow-[0_0_20px_rgba(220,38,38,0.5)]">
                                                    KONFIRMASI SYSTEM RESET
                                                </AlertDialogAction>
                                            </AlertDialogFooter>
                                        </div>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>
                        </Card>
                    )}
                </div>
            </ScrollArea>
        </main>
        
        {/* Dialogs */}
        <Dialog open={isEditUserDialogOpen} onOpenChange={setIsEditUserDialogOpen}>
            <DialogContent className="glass-card max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                <DialogHeader><DialogTitle>Edit Profil Bangsawan: {editingUser?.prideName}</DialogTitle></DialogHeader>
                <form onSubmit={handleUpdateUser} className="space-y-6 py-4">
                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2"><Label>Nama Bangsawan (Maks 20 Karakter)</Label><Input value={editUserFormData.prideName || ''} onChange={e => setEditUserFormData({...editUserFormData, prideName: e.target.value})} maxLength={20} /></div>
                        <div className="space-y-2"><Label>Total Wibawa</Label><Input type="number" value={editUserFormData.pride || ''} onChange={e => setEditUserFormData({...editUserFormData, pride: Number(editUserFormData.pride)})} onBlur={e => setEditUserFormData({...editUserFormData, pride: Number(e.target.value)})} /></div>
                        <div className="space-y-2"><Label>Uang</Label><Input type="number" value={editUserFormData.money || ''} onChange={e => setEditUserFormData({...editUserFormData, money: Number(e.target.value)})} /></div>
                        <div className="space-y-2"><Label>Makanan</Label><Input type="number" value={editUserFormData.food || ''} onChange={e => setEditUserFormData({...editUserFormData, food: Number(e.target.value)})} /></div>
                        <div className="space-y-2"><Label>Lahan (Tanah)</Label><Input type="number" value={editUserFormData.land || ''} onChange={e => setEditUserFormData({...editUserFormData, land: Number(e.target.value)})} /></div>
                        <div className="space-y-2"><Label>Rakyat (Jiwa)</Label><Input type="number" value={editUserFormData.unemployed || ''} onChange={e => setEditUserFormData({...editUserFormData, unemployed: Number(e.target.value)})} /></div>
                        <div className="space-y-2">
                            <Label>Status Akun</Label>
                            <Select value={editUserFormData.status} onValueChange={(val) => setEditUserFormData({...editUserFormData, status: val})}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="active">Active</SelectItem>
                                    <SelectItem value="disabled">Disabled (Banned)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <Separator className="bg-white/10" />
                    <h4 className="text-[10px] uppercase font-bold tracking-widest text-primary">Kekuatan Divisi Militer</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {['attack', 'defense', 'elite', 'raider'].map(key => (
                            <div key={key} className="space-y-1.5">
                                <Label className="text-[9px] uppercase opacity-60">{unitNameMap[key] || key}</Label>
                                <Input type="number" value={editUserFormData.units?.[key] || 0} onChange={e => setEditUserFormData({...editUserFormData, units: {...editUserFormData.units, [key]: Number(e.target.value)}})} className="h-9 bg-white/5" />
                            </div>
                        ))}
                    </div>
                    <DialogFooter><Button type="submit" className="w-full btn-3d" disabled={isUpdatingUser}>{isUpdatingUser ? 'Memproses...' : 'Terapkan Perubahan Data'}</Button></DialogFooter>
                </form>
            </DialogContent>
        </Dialog>

        <Dialog open={isAllianceDialogOpen} onOpenChange={setIsAllianceDialogOpen}>
            <DialogContent className="glass-card sm:max-w-md">
                <DialogHeader><DialogTitle>{editingAlliance ? 'Edit Aliansi' : 'Buat Aliansi Baru'}</DialogTitle></DialogHeader>
                <form onSubmit={handleSaveAlliance} className="space-y-4 py-4">
                    <div className="space-y-2"><Label>Nama Aliansi (Maks 20 Karakter)</Label><Input value={allianceFormData.name || ''} onChange={e => setAllianceFormData({...allianceFormData, name: e.target.value})} maxLength={20} required /></div>
                    <div className="space-y-2"><Label>Tag Aliansi (Maks 50 Karakter)</Label><Input value={allianceFormData.tag || ''} onChange={e => setAllianceFormData({...allianceFormData, tag: e.target.value.toUpperCase()})} maxLength={50} required /></div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2"><Label>Koordinat X</Label><Input type="number" value={allianceFormData.x} onChange={e => setAllianceFormData({...allianceFormData, x: e.target.value})} required /></div>
                        <div className="space-y-2"><Label>Koordinat Y</Label><Input type="number" value={allianceFormData.y} onChange={e => setAllianceFormData({...allianceFormData, y: e.target.value})} required /></div>
                    </div>
                    <div className="space-y-2"><Label>Provinsi</Label><Input value={allianceFormData.province || ''} onChange={e => setAllianceFormData({...allianceFormData, province: e.target.value})} required /></div>
                    <div className="space-y-2"><Label>Logo URL (Imgur)</Label><Input value={allianceFormData.logoUrl || ''} onChange={e => setAllianceFormData({...allianceFormData, logoUrl: e.target.value})} /></div>
                    <DialogFooter><Button type="submit" className="w-full btn-3d" disabled={isSavingAlliance}>{isSavingAlliance ? 'Menyimpan...' : 'Simpan Aliansi'}</Button></DialogFooter>
                </form>
            </DialogContent>
        </Dialog>

        <Dialog open={isAllianceMembersDialogOpen} onOpenChange={setIsAllianceMembersDialogOpen}>
            <DialogContent className="glass-card sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle className="uppercase tracking-widest font-poiret-one text-xl">Anggota Aliansi: {editingAlliance?.name}</DialogTitle>
                    <DialogDescription className="text-[10px] uppercase font-bold opacity-40">Daftar Bangsawan yang bergabung di bawah panji {editingAlliance?.tag}</DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <ScrollArea className="h-[300px]">
                        <Table>
                            <TableHeader className="bg-white/5">
                                <TableRow><TableHead>Bangsawan</TableHead><TableHead className="text-right">Wibawa</TableHead><TableHead className="text-right">Aksi</TableHead></TableRow>
                            </TableHeader>
                            <TableBody>
                                {selectedAllianceMembers.map(m => (
                                    <TableRow key={m.id} className="border-white/5 h-12">
                                        <TableCell>
                                            <div className="font-bold text-[11px] uppercase">{m.prideName}</div>
                                            <div className="text-[8px] opacity-40">{m.email}</div>
                                        </TableCell>
                                        <TableCell className="text-right font-gruppo">{Math.floor(m.pride || 0).toLocaleString()}</TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="sm" onClick={() => { setIsAllianceMembersDialogOpen(false); handleEditUserClick(m); }}><Pencil className="h-3 w-3" /></Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </ScrollArea>
                </div>
            </DialogContent>
        </Dialog>

      </div>
    </TooltipProvider>
  );
}
