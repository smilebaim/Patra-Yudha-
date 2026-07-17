'use client';

import { useAuth } from '@/firebase/auth/auth-context';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Crown, Swords, ShieldCheck, TrendingUp, ArrowUp, ArrowDown, Info, MapPin, Sparkles, Aperture, Trophy, Star, Shield, AlertTriangle, LandPlot, Users } from 'lucide-react';
import { useEffect, useState, useMemo } from 'react';
import { doc, collection, onSnapshot, Timestamp } from 'firebase/firestore';
import { useFirestore } from '@/firebase/firestore/firestore-context';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface GameTitle {
  id: string;
  name: string;
  prideRequired: number;
  attackBonus: number;
  defenseBonus: number;
  resourceBonus: number;
}

interface Alliance {
  id: string;
  name: string;
  coordinates: { x: number; y: number };
  atWarWith?: string | null;
  warEndTime?: Timestamp | null;
}

interface UpkeepCosts {
    unemployed: number;
    attack: number;
    defense: number;
    elite: number;
    raider: number;
}

interface GameMechanics {
    troopFoodConsumptionFactor: number;
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

            setCountdown(`${days}h ${hours}j ${minutes}m`);
        }, 1000);

        return () => clearInterval(intervalId);
    }, [endTime]);

    return <span className="font-mono text-[9px] md:text-xs font-bold">{countdown}</span>;
};


export default function UserDashboardPage() {
  const { userProfile, loading, buildingEffects } = useAuth();
  const { db } = useFirestore();
  const [countdown, setCountdown] = useState<React.ReactNode>('');
  const [alliance, setAlliance] = useState<Alliance | null>(null);
  const [titles, setTitles] = useState<GameTitle[]>([]);
  const [currentTitle, setCurrentTitle] = useState<GameTitle | null>(null);
  const [nextTitle, setNextTitle] = useState<GameTitle | null>(null);
  const [titleProgress, setTitleProgress] = useState(0);
  const [isLoadingTitles, setIsLoadingTitles] = useState(true);
  const [eraEndDate, setEraEndDate] = useState<Timestamp | null>(null);
  const [eraName, setEraName] = useState<string>('');
  const [upkeepCosts, setUpkeepCosts] = useState<UpkeepCosts | null>(null);
  const [gameMechanics, setGameMechanics] = useState<GameMechanics | null>(null);
  
  const [zodiacRank, setZodiacRank] = useState<number>(0);
  const [allZodiacBuffs, setAllZodiacBuffs] = useState<any>(null);

  useEffect(() => {
    if (!db || !userProfile) return;

    const unsubEra = onSnapshot(doc(db, 'game-settings', 'era-info'), (docSnap) => {
        if (docSnap.exists()) {
            setEraEndDate(docSnap.data().endDate as Timestamp);
            setEraName(docSnap.data().name || '');
        }
    });

    const unsubCosts = onSnapshot(doc(db, 'game-settings', 'game-costs'), (docSnap) => {
        if (docSnap.exists() && docSnap.data().upkeep) {
            setUpkeepCosts(docSnap.data().upkeep);
        }
    });

    const unsubMechanics = onSnapshot(doc(db, 'game-settings', 'game-mechanics'), (docSnap) => {
        if (docSnap.exists() && docSnap.data().troopFoodConsumptionFactor !== undefined) {
            setGameMechanics({ troopFoodConsumptionFactor: docSnap.data().troopFoodConsumptionFactor });
        }
    });

    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
        const users = snapshot.docs.map(d => d.data());
        const stats: { [key: string]: number } = {};
        users.forEach(u => {
            if (u.zodiac && u.onboardingComplete) {
                stats[u.zodiac] = (stats[u.zodiac] || 0) + (u.pride || 0);
            }
        });
        const ranked = Object.entries(stats).sort((a,b) => b[1] - a[1]).map(z => z[0]);
        const rank = ranked.indexOf(userProfile.zodiac) + 1;
        setZodiacRank(rank);
    });

    const unsubBuffs = onSnapshot(doc(db, 'game-settings', 'zodiac-buffs'), (docSnap) => {
        if (docSnap.exists()) {
            setAllZodiacBuffs(docSnap.data());
        }
    });

    return () => {
        unsubEra();
        unsubCosts();
        unsubMechanics();
        unsubUsers();
        unsubBuffs();
    };
  }, [db, userProfile?.zodiac]);

  const activeZodiacBuff = useMemo(() => {
      if (!allZodiacBuffs || zodiacRank <= 0) return { money: 0, food: 0, attack: 0, defense: 0 };
      return allZodiacBuffs[`rank${zodiacRank}`] || { money: 0, food: 0, attack: 0, defense: 0 };
  }, [allZodiacBuffs, zodiacRank]);

  useEffect(() => {
    const calculateCountdown = () => {
        if (!eraEndDate) {
            setCountdown("Belum ada informasi era.");
            return;
        }

        const now = new Date();
        const endDate = eraEndDate.toDate();
        const remainingMillis = endDate.getTime() - now.getTime();

        if (remainingMillis <= 0) {
            setCountdown("Zaman baru telah dimulai!");
            return;
        }

        const totalSeconds = Math.floor(remainingMillis / 1000);
        const days = Math.floor(totalSeconds / (3600 * 24));
        const hours = Math.floor((totalSeconds % (3600 * 24)) / 3600);
        
        setCountdown(
            <div className="flex items-center justify-center gap-1 text-primary">
              <Sparkles className="h-2.5 w-2.5 md:h-3.5 md:w-3.5" />
              <span className="font-poiret-one text-[8px] md:text-sm tracking-[0.2em] uppercase">{eraName || 'Era'} Berakhir:</span>
              <span className="font-gruppo font-bold text-[9px] md:text-base">{days}d {hours}h</span>
            </div>
        );
    };

    calculateCountdown();
    const timerId = setInterval(calculateCountdown, 1000 * 60);
    return () => clearInterval(timerId);
  }, [eraEndDate, eraName]);


  useEffect(() => {
    if (userProfile?.allianceId && db) {
        const allianceUnsub = onSnapshot(doc(db, 'alliances', userProfile.allianceId), (allianceDocSnap) => {
            if (allianceDocSnap.exists()) {
                setAlliance({ id: allianceDocSnap.id, ...allianceDocSnap.data() } as Alliance);
            }
        });
        return () => allianceUnsub();
    }
  }, [userProfile?.allianceId, db]);

  useEffect(() => {
    if (!db) return;
    setIsLoadingTitles(true);
    const unsub = onSnapshot(collection(db, 'titles'), (snapshot) => {
      const titlesList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as GameTitle[];
      titlesList.sort((a, b) => a.prideRequired - b.prideRequired);
      setTitles(titlesList);
      setIsLoadingTitles(false);
    });
    return () => unsub();
  }, [db]);

  useEffect(() => {
    if (userProfile && titles.length > 0) {
      const userPride = userProfile.pride ?? 0;
      const achievedTitle = [...titles].reverse().find(title => userPride >= title.prideRequired) || null;
      setCurrentTitle(achievedTitle);
      const nextAchievableTitle = titles.find(title => userPride < title.prideRequired) || null;
      setNextTitle(nextAchievableTitle);

      if (nextAchievableTitle) {
        const prideForCurrent = achievedTitle?.prideRequired ?? 0;
        const totalRange = nextAchievableTitle.prideRequired - prideForCurrent;
        const currentProgressInRange = userPride - prideForCurrent;
        setTitleProgress(totalRange > 0 ? (currentProgressInRange / totalRange) * 100 : 0);
      } else {
        setTitleProgress(achievedTitle ? 100 : 0);
      }
    }
  }, [userProfile, titles]);

    const titleBonusFactor = useMemo(() => (currentTitle?.resourceBonus ?? 0) / 100, [currentTitle]);
    const zodiacBonusFactor = useMemo(() => (activeZodiacBuff?.money ?? 0) / 100, [activeZodiacBuff]);
    const zodiacFoodBonusFactor = useMemo(() => (activeZodiacBuff?.food ?? 0) / 100, [activeZodiacBuff]);
    
    const universityLevel = userProfile?.buildings?.university || 0;
    const universityEconomicBonusFactor = useMemo(() => {
        if (!userProfile) return 0;
        const uniBonusRate = buildingEffects?.university?.foodAndMoneyBonus ?? 2;
        return (universityLevel * uniBonusRate) / 100;
    }, [universityLevel, buildingEffects]);

    const universityAttackBonusFactor = useMemo(() => {
        if (!userProfile) return 0;
        const uniAtkRate = buildingEffects?.university?.attackBonus ?? 0;
        return (universityLevel * uniAtkRate) / 100;
    }, [userProfile, buildingEffects, universityLevel]);

    const universityDefenseBonusFactor = useMemo(() => {
        if (!userProfile) return 0;
        const uniDefRate = buildingEffects?.university?.defenseBonus ?? 0;
        return (universityLevel * uniDefRate) / 100;
    }, [userProfile, buildingEffects, universityLevel]);
    
    const totalResourceMultiplier = 1 + titleBonusFactor + universityEconomicBonusFactor + zodiacBonusFactor;
    const totalFoodMultiplier = 1 + titleBonusFactor + universityEconomicBonusFactor + zodiacFoodBonusFactor;

    const totalAttackBonus = (currentTitle?.attackBonus ?? 0) + (activeZodiacBuff?.attack ?? 0) + Math.round(universityAttackBonusFactor * 100);
    const totalDefenseBonus = (currentTitle?.defenseBonus ?? 0) + (activeZodiacBuff?.defense ?? 0) + Math.round(universityDefenseBonusFactor * 100);
    const totalProdBonus = Math.round((totalResourceMultiplier - 1) * 100);
    const totalFoodProdBonus = Math.round((totalFoodMultiplier - 1) * 100);

    const baseMoneyIncome = useMemo(() => {
        if (!userProfile) return 0;
        const tambangLevel = userProfile.buildings?.tambang || 0;
        const tambangRate = buildingEffects?.tambang?.money ?? 100;
        return tambangLevel * tambangRate;
    }, [userProfile, buildingEffects]);

    const moneyIncomePerHour = baseMoneyIncome * totalResourceMultiplier;

    const baseFoodIncome = useMemo(() => {
        if (!userProfile) return 0;
        const farmLevel = userProfile.buildings?.farm || 0;
        const farmRate = buildingEffects?.farm?.food ?? 50;
        return farmLevel * farmRate;
    }, [userProfile, buildingEffects]);

    const foodIncomePerHour = baseFoodIncome * totalFoodMultiplier;

    const totalUpkeep = useMemo(() => {
        if (!userProfile) return 0;
        const upkeepMap = upkeepCosts || { unemployed: 1, attack: 5, defense: 5, elite: 15, raider: 10 };
        const { units, unemployed } = userProfile;
        let total = 0;
        total += (unemployed || 0) * (upkeepMap.unemployed || 0);
        total += (units?.attack || 0) * (upkeepMap.attack || 0);
        total += (units?.defense || 0) * (upkeepMap.defense || 0);
        total += (units?.elite || 0) * (upkeepMap.elite || 0);
        total += (units?.raider || 0) * (upkeepMap.raider || 0);
        return total;
    }, [userProfile, upkeepCosts]);

    const totalFoodConsumption = useMemo(() => {
        if (!userProfile) return 0;
        const consumptionFactor = gameMechanics?.troopFoodConsumptionFactor || 1;
        const { units, unemployed } = userProfile;
        const totalPeople = (unemployed || 0) + (units?.attack || 0) + (units?.defense || 0) + (units?.elite || 0) + (units?.raider || 0);
        return totalPeople * consumptionFactor;
    }, [userProfile, gameMechanics]);


  const moneyBalancePerMinute = (moneyIncomePerHour - totalUpkeep) / 60;
  const foodBalancePerMinute = (foodIncomePerHour - totalFoodConsumption) / 60;

  const isMoneyLow = userProfile.money < 1000;
  const isFoodLow = userProfile.food < 500;

  if (loading || !userProfile) return null;

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
        <Card className="bg-card/40 backdrop-blur-xl border-primary/5 shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-1 h-full bg-primary/40 group-hover:bg-primary transition-colors" />
          <CardHeader className="p-4 md:p-6 text-center space-y-1">
            <div className="mb-1">{countdown}</div>
            <CardTitle className="text-xl md:text-3xl font-poiret-one tracking-[0.05em] font-bold text-white">
              <span className="text-primary block text-[10px] md:text-sm tracking-[0.3em] uppercase mb-1">
                {isLoadingTitles ? 'MEMUAT...' : currentTitle?.name ?? 'Tanpa Gelar'}
              </span>
              {userProfile.prideName}
            </CardTitle>
            <div className="flex items-center justify-center gap-1.5 text-muted-foreground font-medium tracking-widest text-[8px] md:text-[10px] uppercase">
                <MapPin className="h-2.5 w-2.5 md:h-3 w-3 text-primary/60" />
                {userProfile.coordinates ? `(${userProfile.coordinates.x}:${userProfile.coordinates.y})` : ''} {userProfile.province}
            </div>
            {alliance?.atWarWith && (
                <div className="pt-2">
                    <Badge variant="destructive" className="py-0.5 px-2 md:py-1 md:px-3 rounded-full text-[7px] md:text-[9px] font-bold animate-pulse shadow-[0_0_10px_rgba(220,38,38,0.4)]">
                        <Swords className="mr-1 h-2.5 w-2.5" />
                        WAR: <WarCountdown endTime={alliance.warEndTime} />
                    </Badge>
                </div>
            )}
          </CardHeader>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2 bg-card/30 backdrop-blur-lg border-white/5 shadow-xl">
                <CardHeader className="p-4 pb-1">
                    <CardTitle className="text-[10px] md:text-xs font-gruppo tracking-widest uppercase text-primary">Informasi Bangsawan</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-1">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
                        <div className="space-y-1">
                            {[
                                { label: "Aliansi", value: alliance?.name ?? 'Independen', icon: ShieldCheck },
                                { 
                                    label: "Zodiak", 
                                    value: (
                                        <div className="flex flex-col items-end gap-0.5">
                                            <span className="flex items-center gap-1">
                                                {zodiacRank > 0 && zodiacRank <= 3 && (
                                                    <Trophy className={cn("h-2.5 w-2.5", 
                                                        zodiacRank === 1 ? "text-yellow-500" : 
                                                        zodiacRank === 2 ? "text-slate-400" : 
                                                        "text-amber-700"
                                                    )} />
                                                )}
                                                {userProfile.zodiac} (#{zodiacRank || '-'})
                                            </span>
                                        </div>
                                    ), 
                                    icon: Aperture 
                                },
                                { label: "Wilayah Lahan", value: `${Math.floor(userProfile.land ?? 0).toLocaleString()} Petak`, icon: LandPlot },
                                { label: "Total Wibawa", value: Math.floor(userProfile.pride ?? 0).toLocaleString(), icon: Crown, strong: true },
                            ].map((item, i) => (
                                <div key={i} className="flex justify-between items-center py-1 border-b border-white/5">
                                    <span className="text-muted-foreground flex items-center gap-2 text-[9px] md:text-xs">
                                        <item.icon className="h-3 w-3 md:h-3.5 md:w-3.5 text-primary/40" />
                                        {item.label}
                                    </span>
                                    <div className={cn("text-[9px] md:text-xs font-medium tracking-wide", item.strong && "text-primary font-bold font-gruppo")}>{item.value}</div>
                                </div>
                            ))}
                        </div>
                        <div className="space-y-1">
                            {[
                                { label: "Bonus Serangan", value: `+${totalAttackBonus}%`, icon: Swords, color: "text-red-400" },
                                { label: "Bonus Pertahanan", value: `+${totalDefenseBonus}%`, icon: Shield, color: "text-blue-400" },
                                { label: "Pasukan Elit", value: Math.floor(userProfile.units?.elite ?? 0).toLocaleString(), icon: Trophy },
                                { label: "Rakyat Tersedia", value: `${Math.floor(userProfile.unemployed ?? 0).toLocaleString()} Jiwa`, icon: Users },
                            ].map((item, i) => (
                                <div key={i} className="flex justify-between items-center py-1 border-b border-white/5">
                                    <span className={cn("flex items-center gap-2 text-[9px] md:text-xs", "text-muted-foreground")}>
                                        <item.icon className={cn("h-3 w-3 md:h-3.5 md:w-3.5", item.color || "text-primary/40")} />
                                        {item.label}
                                    </span>
                                    <span className={cn("font-gruppo text-[9px] md:text-sm tracking-widest", item.color)}>{item.value}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 lg:grid-cols-1 gap-2">
                        <Dialog>
                            <DialogTrigger asChild>
                                <div className={cn("group flex flex-col sm:flex-row justify-between items-start sm:items-center cursor-pointer p-2 rounded-lg border border-white/5 transition-all hover:bg-white/5", moneyBalancePerMinute >= 0 ? 'bg-primary/5' : 'bg-red-500/5', isMoneyLow && "border-destructive/50 animate-pulse")}>
                                    <div className="flex flex-col">
                                        <span className={cn("font-bold flex items-center gap-1.5 tracking-wider uppercase text-[8px] md:text-[9px]", moneyBalancePerMinute >= 0 ? 'text-primary' : 'text-red-400')}>
                                            {moneyBalancePerMinute >= 0 ? <ArrowUp className="h-2.5 w-2.5" /> : <ArrowDown className="h-2.5 w-2.5" />}
                                            Dana / mnt
                                            {isMoneyLow && <AlertTriangle className="h-2.5 w-2.5 text-destructive" />}
                                        </span>
                                    </div>
                                    <span className={cn("font-gruppo text-[11px] md:text-base font-bold tracking-[0.1em]", moneyBalancePerMinute >= 0 ? 'text-primary' : 'text-red-400')}>
                                        {moneyBalancePerMinute >= 0 ? '+' : ''}{moneyBalancePerMinute.toFixed(1)} <span className="text-[7px] md:text-[9px] font-sans font-normal opacity-70">Uang</span>
                                    </span>
                                </div>
                            </DialogTrigger>
                            <DialogContent className="glass-card sm:max-w-md max-h-[90vh] overflow-y-auto">
                                <DialogHeader>
                                    <DialogTitle className="font-poiret-one text-xl tracking-wider text-primary uppercase border-b border-primary/20 pb-3 mb-2">Analisa Ekonomi & Bonus</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4 py-2">
                                    <div className="p-3 rounded-lg bg-white/5 border border-white/5 space-y-2">
                                        <p className="text-[9px] uppercase font-bold tracking-widest text-primary opacity-60">Rincian Bonus Produksi</p>
                                        <div className="space-y-1.5 text-[11px]">
                                            <div className="flex justify-between"><span>Gelar Kehormatan ({currentTitle?.name})</span> <span className="font-mono">+{currentTitle?.resourceBonus || 0}%</span></div>
                                            <div className="flex justify-between"><span>Riset Universitas (Lvl {universityLevel})</span> <span className="font-mono">+{Math.round(universityEconomicBonusFactor * 100)}%</span></div>
                                            <div className="flex justify-between text-primary font-bold"><span>Zodiac Blessing (Rank #{zodiacRank})</span> <span className="font-mono">+{activeZodiacBuff?.money || 0}%</span></div>
                                            <Separator className="bg-white/10 my-1" />
                                            <div className="flex justify-between font-bold text-primary"><span>Total Bonus Efisiensi</span> <span className="font-gruppo">+{totalProdBonus}%</span></div>
                                        </div>
                                    </div>
                                    <div className="space-y-3 text-xs">
                                        <div className="flex justify-between"><span>Produksi Tambang Dasar</span> <span className="text-primary font-mono">+{ (baseMoneyIncome / 60).toFixed(2) }</span></div>
                                        <div className="flex justify-between"><span>Alokasi Bonus (+{totalProdBonus}%)</span> <span className="text-primary font-mono">+{ ((baseMoneyIncome * (totalProdBonus/100)) / 60).toFixed(2) }</span></div>
                                        <Separator className="bg-white/10" />
                                        <div className="flex justify-between font-bold text-sm"><span>Total Pendapatan Netto</span> <span className="font-mono text-primary">+{ (moneyIncomePerHour / 60).toFixed(2) }</span></div>
                                        <div className="flex justify-between"><span>Upkeep (Gaji & Perawatan)</span> <span className="text-red-400 font-mono">-{ (totalUpkeep / 60).toFixed(2) }</span></div>
                                        <Separator className="bg-white/20 h-0.5" />
                                        <div className={cn("flex justify-between font-bold text-base", moneyBalancePerMinute >= 0 ? 'text-primary' : 'text-red-400')}>
                                            <span>Arus Kas Akhir</span>
                                            <span className="font-gruppo tracking-widest">{ moneyBalancePerMinute.toFixed(2) } Uang</span>
                                        </div>
                                    </div>
                                </div>
                            </DialogContent>
                        </Dialog>

                        <Dialog>
                            <DialogTrigger asChild>
                                <div className={cn("group flex flex-col sm:flex-row justify-between items-start sm:items-center cursor-pointer p-2 rounded-lg border border-white/5 transition-all hover:bg-white/5", foodBalancePerMinute >= 0 ? 'bg-primary/5' : 'bg-red-500/5', isFoodLow && "border-destructive/50 animate-pulse")}>
                                    <div className="flex flex-col">
                                        <span className={cn("font-bold flex items-center gap-1.5 tracking-wider uppercase text-[8px] md:text-[9px]", foodBalancePerMinute >= 0 ? 'text-primary' : 'text-red-400')}>
                                            {foodBalancePerMinute >= 0 ? <ArrowUp className="h-2.5 w-2.5" /> : <ArrowDown className="h-2.5 w-2.5" />}
                                            Makan / mnt
                                            {isFoodLow && <AlertTriangle className="h-2.5 w-2.5 text-destructive" />}
                                        </span>
                                    </div>
                                    <span className={cn("font-gruppo text-[11px] md:text-base font-bold tracking-[0.1em]", foodBalancePerMinute >= 0 ? 'text-primary' : 'text-red-400')}>
                                        {foodBalancePerMinute >= 0 ? '+' : ''}{foodBalancePerMinute.toFixed(1)} <span className="text-[7px] md:text-[9px] font-sans font-normal opacity-70">Logistik</span>
                                    </span>
                                </div>
                            </DialogTrigger>
                            <DialogContent className="glass-card sm:max-w-md max-h-[90vh] overflow-y-auto">
                                <DialogHeader>
                                    <DialogTitle className="font-poiret-one text-xl tracking-wider text-primary uppercase border-b border-primary/20 pb-3 mb-2">Analisa Logistik & Bonus</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4 py-2">
                                    <div className="p-3 rounded-lg bg-white/5 border border-white/5 space-y-2">
                                        <p className="text-[9px] uppercase font-bold tracking-widest text-primary opacity-60">Rincian Bonus Produksi</p>
                                        <div className="space-y-1.5 text-[11px]">
                                            <div className="flex justify-between"><span>Gelar Kehormatan ({currentTitle?.name})</span> <span className="font-mono">+{currentTitle?.resourceBonus || 0}%</span></div>
                                            <div className="flex justify-between"><span>Riset Universitas (Lvl {universityLevel})</span> <span className="font-mono">+{Math.round(universityEconomicBonusFactor * 100)}%</span></div>
                                            <div className="flex justify-between text-primary font-bold"><span>Zodiac Blessing (Rank #{zodiacRank})</span> <span className="font-mono">+{activeZodiacBuff?.food || 0}%</span></div>
                                            <Separator className="bg-white/10 my-1" />
                                            <div className="flex justify-between font-bold text-primary"><span>Total Bonus Panen</span> <span className="font-gruppo">+{totalFoodProdBonus}%</span></div>
                                        </div>
                                    </div>
                                    <div className="space-y-3 text-xs">
                                        <div className="flex justify-between"><span>Hasil Panen Sawah Dasar</span> <span className="text-primary font-mono">+{ (baseFoodIncome / 60).toFixed(2) }</span></div>
                                        <div className="flex justify-between"><span>Alokasi Bonus (+{totalFoodProdBonus}%)</span> <span className="text-primary font-mono">+{ ((baseFoodIncome * (totalFoodProdBonus/100)) / 60).toFixed(2) }</span></div>
                                        <Separator className="bg-white/10" />
                                        <div className="flex justify-between font-bold text-sm"><span>Total Logistik Masuk</span> <span className="font-mono text-primary">+{ (foodIncomePerHour / 60).toFixed(2) }</span></div>
                                        <div className="flex justify-between"><span>Konsumsi Populasi</span> <span className="text-red-400 font-mono">-{ (totalFoodConsumption / 60).toFixed(2) }</span></div>
                                        <Separator className="bg-white/20 h-0.5" />
                                        <div className={cn("flex justify-between font-bold text-base", foodBalancePerMinute >= 0 ? 'text-primary' : 'text-red-400')}>
                                            <span>Keseimbangan Logistik</span>
                                            <span className="font-gruppo tracking-widest">{ foodBalancePerMinute.toFixed(2) } Logistik</span>
                                        </div>
                                    </div>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>
                </CardContent>
            </Card>

            <Card className="bg-card/40 backdrop-blur-lg border-white/5 shadow-xl flex flex-col">
                <CardHeader className="p-4 pb-1 text-center sm:text-left">
                    <CardTitle className="text-[10px] md:text-xs font-gruppo tracking-widest uppercase text-primary">Kemajuan Gelar</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-2 flex-1 flex flex-col justify-center">
                    <div className="space-y-4 text-center">
                        <div className="space-y-1">
                            <p className="text-[8px] md:text-[9px] text-muted-foreground uppercase tracking-[0.3em] font-bold">Gelar Saat Ini</p>
                            <div className="flex flex-col items-center gap-1">
                                <Crown className="h-5 w-5 md:h-6 md:w-6 text-primary drop-shadow-[0_0_8px_rgba(234,179,8,0.5)]" />
                                <p className="text-sm md:text-lg font-bold text-primary font-poiret-one tracking-widest leading-none">
                                    {isLoadingTitles ? '...' : currentTitle?.name ?? 'Tanpa Gelar'}
                                </p>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Progress value={titleProgress} className="h-1 bg-white/5 overflow-hidden" />
                            <div className="flex justify-between text-[7px] md:text-[8px] font-bold tracking-widest uppercase text-muted-foreground">
                                <span>{Math.floor(userProfile.pride ?? 0).toLocaleString()} <span className="opacity-50">WIBAWA</span></span>
                                {nextTitle ? (
                                    <span>Target: {nextTitle.prideRequired.toLocaleString()}</span>
                                ) : (
                                    <span className="text-primary animate-pulse">Puncak Kekuasaan</span>
                                )}
                            </div>
                        </div>

                        <div className="space-y-1">
                            <p className="text-[8px] md:text-[9px] text-muted-foreground uppercase tracking-[0.3em] font-bold">Berikutnya</p>
                            <div className="flex items-center justify-center gap-1.5">
                                <TrendingUp className="h-3 w-3 text-muted-foreground/50" />
                                <p className="text-xs md:text-base font-bold font-poiret-one tracking-widest opacity-60">
                                    {isLoadingTitles ? '...' : nextTitle?.name ?? 'Maksimal'}
                                </p>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    </div>
  );
}
