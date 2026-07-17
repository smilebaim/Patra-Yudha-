'use client';

import { useEffect, useRef, useState } from 'react';
import {
  doc,
  collection,
  onSnapshot,
  Timestamp,
  increment,
  updateDoc,
  runTransaction,
  deleteDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
  addDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { logError } from '@/lib/errorHandler';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';

// --- TYPES ---
interface BuildingCounts {
  residence: number;
  farm: number;
  fort: number;
  university: number;
  barracks: number;
  mobility: number;
  tambang: number;
  tower: number;
  [key: string]: number;
}

interface UnitCounts {
  attack: number;
  defense: number;
  elite: number;
  raider: number;
}

interface UserProfile {
  uid: string;
  prideName: string;
  money: number;
  food: number;
  unemployed: number;
  buildings: BuildingCounts;
  units: UnitCounts;
  pride: number; 
  land: number;
  zodiac: string;
  lastResourceUpdate: any;
  onboardingComplete: boolean;
  allianceId?: string;
}

interface BuildingEffects {
  residence: { unemployed: number; capacity: number };
  farm: { food: number };
  tambang: { money: number };
  fort: { defenseBonus: number };
  tower: { bonusPertahananPasukanKhusus: number };
  university: { constructionBonus: number; foodAndMoneyBonus: number; };
  barracks: { trainingBonus: number };
  mobility: { attackBonus: number };
}

interface March {
    id: string;
    attackerId: string;
    defenderId: string;
    type: 'war' | 'raid' | 'return';
    troops: Partial<UnitCounts>;
    arrivalTime: Timestamp;
}

const unitNameMap: Record<string, string> = {
  attack: 'Pasukan Serang',
  defense: 'Pasukan Bertahan',
  elite: 'Pasukan Elit',
  raider: 'Pasukan Khusus',
};

const buildingNameMap: Record<string, string> = {
  residence: 'Rumah',
  farm: 'Sawah',
  tambang: 'Tambang',
  barracks: 'Barak Pasukan',
  mobility: 'Mobilitas Pasukan',
  university: 'Kampus',
  fort: 'Benteng',
  tower: 'Menara',
};

export function useGameLoop(
  user: { uid: string } | null,
  userProfile: UserProfile | null,
  buildingEffects: BuildingEffects | null
) {
  const processingRef = useRef(false);
  const [upkeepCosts, setUpkeepCosts] = useState<any>(null);
  const [gameMechanics, setGameMechanics] = useState<any>(null);
  const [titles, setTitles] = useState<any[]>([]);

  useEffect(() => {
    if (!db || !user) return;

    const unsubCosts = onSnapshot(doc(db, 'game-settings', 'game-costs'), snap => snap.exists() && setUpkeepCosts(snap.data()?.upkeep));
    const unsubMechanics = onSnapshot(doc(db, 'game-settings', 'game-mechanics'), snap => snap.exists() && setGameMechanics(snap.data()));
    const unsubTitles = onSnapshot(collection(db, 'titles'), snap => setTitles(snap.docs.map(d => d.data())));

    return () => { unsubCosts(); unsubMechanics(); unsubTitles(); };
  }, [user]);

  useEffect(() => {
    const processGameUpdates = async () => {
      if (processingRef.current || !db || !user || !userProfile?.onboardingComplete) return;

      processingRef.current = true;
      const now = Timestamp.now();

      try {
        await updateEconomy(now);
        await processMarches(now);
        await processQueues(now);
      } catch (error) {
        logError(error, { context: 'useGameLoop: main' });
      } finally {
        processingRef.current = false;
      }
    };

    const updateEconomy = async (now: Timestamp) => {
        if (!userProfile?.lastResourceUpdate || !db || !user) return;

        const lastUpdate = userProfile.lastResourceUpdate;
        const hoursPassed = (now.toMillis() - lastUpdate.toMillis()) / 3600000;

        if (hoursPassed < 0.002) return; 

        const costs = upkeepCosts || { unemployed: 1, attack: 5, defense: 5, elite: 15, raider: 10 };
        const foodFactor = gameMechanics?.troopFoodConsumptionFactor || 1;
        const currentTitle = [...titles].sort((a, b) => a.prideRequired - b.prideRequired).reverse().find(t => userProfile.pride >= t.prideRequired);
        const titleBonus = currentTitle ? (currentTitle.resourceBonus / 100) : 0;
        
        const effects = buildingEffects;
        const tambangRate = effects?.tambang?.money ?? 100;
        const farmRate = effects?.farm?.food ?? 50;
        const uniBonusRate = effects?.university?.foodAndMoneyBonus ?? 2;
        const uniBonus = (userProfile.buildings.university || 0) * uniBonusRate / 100;
        
        const totalMultiplier = 1 + titleBonus + uniBonus;

        const moneyIn = (userProfile.buildings.tambang || 0) * tambangRate * hoursPassed * totalMultiplier;
        const foodIn = (userProfile.buildings.farm || 0) * farmRate * hoursPassed * totalMultiplier;

        let totalUpkeep = 0;
        let totalFoodOut = 0;
        const allPeople = { 
            unemployed: userProfile.unemployed || 0,
            attack: userProfile.units?.attack || 0,
            defense: userProfile.units?.defense || 0,
            elite: userProfile.units?.elite || 0,
            raider: userProfile.units?.raider || 0
        };

        Object.entries(allPeople).forEach(([type, count]) => {
            totalUpkeep += (count || 0) * (costs[type] || 0);
            totalFoodOut += (count || 0) * foodFactor;
        });

        const netMoneyChange = moneyIn - (totalUpkeep * hoursPassed);
        const netFoodChange = foodIn - (totalFoodOut * hoursPassed);

        const userDocRef = doc(db, 'users', user.uid);
        const updateData = {
            money: increment(netMoneyChange),
            food: increment(netFoodChange),
            lastResourceUpdate: now
        };

        updateDoc(userDocRef, updateData).catch(async (err) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: userDocRef.path,
                operation: 'update',
                requestResourceData: updateData
            }));
        });
    };

    const processMarches = async (now: Timestamp) => {
        if (!db || !user) return;
        const marchesQuery = query(collection(db, 'marches'), where('attackerId', '==', user.uid));
        const marchesSnap = await getDocs(marchesQuery);

        for (const marchDoc of marchesSnap.docs) {
            const march = { id: marchDoc.id, ...marchDoc.data() } as March;
            
            if (march.arrivalTime.toMillis() > now.toMillis()) continue;
            
            if (march.type === 'return') {
                const attackerRef = doc(db, 'users', march.attackerId);
                const updates: any = {};
                Object.entries(march.troops).forEach(([unit, count]) => {
                    updates[`units.${unit}`] = increment(count!);
                });
                
                updateDoc(attackerRef, updates).catch(async (err) => {
                    errorEmitter.emit('permission-error', new FirestorePermissionError({
                        path: attackerRef.path,
                        operation: 'update',
                        requestResourceData: updates
                    }));
                });
                deleteDoc(marchDoc.ref).catch(async (err) => {
                    errorEmitter.emit('permission-error', new FirestorePermissionError({
                        path: marchDoc.ref.path,
                        operation: 'delete'
                    }));
                });
            }
        }
    };

    const processQueues = async (now: Timestamp) => {
        if (!db || !user) return;
        
        const cQueueRef = collection(db, 'constructionQueue');
        const cSnap = await getDocs(query(cQueueRef, where('userId', '==', user.uid)));
        
        for (const docSnap of cSnap.docs) {
            const data = docSnap.data();
            if (data.completionTime.toMillis() <= now.toMillis()) {
                const jobItems = data.items || [];
                if (jobItems.length === 0) continue;
                
                const { buildingId, amount } = jobItems[0];
                const userRef = doc(db, 'users', user.uid);
                
                await runTransaction(db, async (transaction) => {
                    transaction.update(userRef, { [`buildings.${buildingId}`]: increment(amount) });
                    transaction.delete(docSnap.ref);
                });

                await addDoc(collection(db, 'reports'), {
                    userId: user.uid,
                    type: 'construction-completed',
                    isRead: false,
                    timestamp: serverTimestamp(),
                    details: { message: `Konstruksi ${amount}x ${buildingNameMap[buildingId] || buildingId} selesai.` }
                });
            }
        }

        const tQueueRef = collection(db, 'trainingQueue');
        const tSnap = await getDocs(query(tQueueRef, where('userId', '==', user.uid)));
        
        for (const docSnap of tSnap.docs) {
            const data = docSnap.data();
            if (data.completionTime.toMillis() <= now.toMillis()) {
                const jobItems = data.items || [];
                if (jobItems.length === 0) continue;

                const { unitId, amount } = jobItems[0];
                const userRef = doc(db, 'users', user.uid);
                
                await runTransaction(db, async (transaction) => {
                    transaction.update(userRef, { [`units.${unitId}`]: increment(amount) });
                    transaction.delete(docSnap.ref);
                });

                await addDoc(collection(db, 'reports'), {
                    userId: user.uid,
                    type: 'troops-returned',
                    isRead: false,
                    timestamp: serverTimestamp(),
                    details: { message: `Latihan ${amount}x ${unitNameMap[unitId] || unitId} selesai.` }
                });
            }
        }
    };

    const interval = setInterval(processGameUpdates, 10000);
    return () => clearInterval(interval);
  }, [user, userProfile, upkeepCosts, gameMechanics, titles, buildingEffects]);
}
