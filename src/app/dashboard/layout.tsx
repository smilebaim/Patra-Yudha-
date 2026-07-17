'use client';

import { useAuth } from '@/firebase/auth/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useMemo, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Shield, Menu, Users, Swords, LogOut, Crown, Settings, Bell, Home, Coins, Beef, Globe, Megaphone, AlertTriangle, TrendingUp, Hammer, Info, Lock } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'firebase/auth';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ModeToggle } from '@/components/theme-toggle';
import { collection, onSnapshot, query, where, doc } from 'firebase/firestore';
import { useFirestore } from '@/firebase/firestore/firestore-context';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

interface User {
  id: string;
  pride: number;
  role?: 'admin' | 'user';
}

interface GameTitle {
  id: string;
  name: string;
  prideRequired: number;
  resourceBonus: number;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, userProfile, loading, auth, playSound, buildingEffects } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [hasUnreadReports, setHasUnreadReports] = useState(false);
  const [adminMessage, setAdminMessage] = useState<string>('');
  const [isMaintenance, setIsMaintenance] = useState<boolean>(false);
  const [backgroundUrl, setBackgroundUrl] = useState<string>('');
  const [backgroundBlur, setBackgroundBlur] = useState<number>(2);
  const [isLoadingMessage, setIsLoadingMessage] = useState(true);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [titles, setTitles] = useState<GameTitle[]>([]);
  const { db } = useFirestore();
  const prevUnreadReportsRef = useRef(false);

  useEffect(() => {
    if (!loading && (!user || (userProfile && userProfile.role !== 'user' && userProfile.role !== 'admin'))) {
      router.push('/login');
    }
  }, [user, userProfile, loading, router]);

  useEffect(() => {
    if (!db) return;
    const usersUnsub = onSnapshot(collection(db, 'users'), (snapshot) => {
        setAllUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as User[]);
    });
    const titlesUnsub = onSnapshot(collection(db, 'titles'), (snapshot) => {
        setTitles(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as GameTitle[]);
    });
    return () => { usersUnsub(); titlesUnsub(); };
  }, [db]);
  
  const worldPrideRanking = useMemo(() => {
      if (!user || allUsers.length === 0) return 0;
      const sortedUsers = allUsers
          .filter(u => u.role !== 'admin' && u.pride !== undefined)
          .sort((a, b) => (b.pride || 0) - (a.pride || 0));
      const userRank = sortedUsers.findIndex(u => u.id === user.uid) + 1;
      return userRank > 0 ? userRank : sortedUsers.length + 1;
  }, [allUsers, user]);

  // Economic Growth Calculation
  const resourceBalances = useMemo(() => {
    if (!userProfile || !buildingEffects || titles.length === 0) return { moneyGrowing: false, foodGrowing: false };
    
    const currentTitle = [...titles].sort((a, b) => a.prideRequired - b.prideRequired).reverse().find(t => (userProfile.pride ?? 0) >= t.prideRequired) || null;
    const titleBonus = currentTitle ? (currentTitle.resourceBonus / 100) : 0;
    const universityBonus = (userProfile.buildings.university || 0) * (buildingEffects.university?.foodAndMoneyBonus || 0) / 100;
    const totalMultiplier = 1 + titleBonus + universityBonus;

    const moneyIncomePerHour = (userProfile.buildings.tambang || 0) * (buildingEffects.tambang?.money ?? 100) * totalMultiplier;
    const foodIncomePerHour = (userProfile.buildings.farm || 0) * (buildingEffects.farm?.food ?? 50) * totalMultiplier;

    const totalUpkeep = ((userProfile.unemployed || 0) * 1) + ((userProfile.units?.attack || 0) * 5) + ((userProfile.units?.defense || 0) * 5);
    const totalFoodConsumption = ((userProfile.unemployed || 0) + Object.values(userProfile.units || {}).reduce((a,b)=>a+(b||0),0)) * 1;

    return {
        moneyGrowing: moneyIncomePerHour > totalUpkeep,
        foodGrowing: foodIncomePerHour > totalFoodConsumption
    };
  }, [userProfile, buildingEffects, titles]);

  const unreadReportsQuery = useMemo(() => {
    if (!user || !db) return null;
    return query(collection(db, 'reports'), where('userId', '==', user.uid), where('isRead', '==', false));
  }, [user, db]);

  useEffect(() => {
    if (!unreadReportsQuery) return;
    const unsubscribe = onSnapshot(unreadReportsQuery, (snapshot) => {
        const hasUnread = !snapshot.empty;
        setHasUnreadReports(hasUnread);
        if (hasUnread && !prevUnreadReportsRef.current) {
            playSound('notification');
        }
        prevUnreadReportsRef.current = hasUnread;
    }, async (err) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'reports', operation: 'list' }));
    });
    return () => unsubscribe();
  }, [unreadReportsQuery, playSound]);

  const adminInfoRef = useMemo(() => {
    if (!db) return null;
    return doc(db, 'game-settings', 'admin-info');
  }, [db]);

  useEffect(() => {
    if (!adminInfoRef) return;
    setIsLoadingMessage(true);
    const unsub = onSnapshot(adminInfoRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setAdminMessage(data.message || '');
          setBackgroundUrl(data.dashboardBackgroundUrl || '');
          setBackgroundBlur(data.dashboardBackgroundBlur ?? 2);
          setIsMaintenance(data.maintenanceMode || false);
        } else {
          setAdminMessage('');
          setBackgroundUrl('');
          setBackgroundBlur(2);
          setIsMaintenance(false);
        }
        setIsLoadingMessage(false);
    }, async (err) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: adminInfoRef.path, operation: 'get' }));
    });
    return () => unsub();
  }, [adminInfoRef]);

  const handleLogout = async () => {
    if (!user || !auth) return;
    await signOut(auth);
    router.push('/login');
  };

  if (loading || !user || !userProfile) {
    return (
        <div className="flex h-screen items-center justify-center bg-background overflow-hidden">
            <div className="flex flex-col items-center gap-4">
                <Crown className="h-12 w-12 animate-pulse text-primary" />
                <p className="text-muted-foreground font-poiret-one text-lg tracking-widest">Memuat Wibawa...</p>
            </div>
        </div>
    );
  }

 const navItems = [
      { href: "/dashboard/markas", icon: Shield, label: "Markas" },
      { href: "/dashboard/command", icon: Swords, label: "Komando" },
      { href: "/dashboard", icon: Home, label: "Info" },
      { href: "/dashboard/alliance", icon: Users, label: "Aliansi" },
      { href: "/dashboard/ranking", icon: Globe, label: "Ranking" },
  ];

  const isMoneyLow = userProfile.money < 1000;
  const isFoodLow = userProfile.food < 500;

  const stats = [
    { 
        icon: Coins, 
        value: userProfile.money, 
        label: "Uang", 
        critical: isMoneyLow,
        pulse: resourceBalances.moneyGrowing 
    },
    { 
        icon: Beef, 
        value: userProfile.food, 
        label: "Makanan", 
        critical: isFoodLow,
        pulse: resourceBalances.foodGrowing
    },
    { 
        icon: Globe, 
        value: `#${worldPrideRanking}`, 
        label: "Peringkat",
        pulse: true 
    },
    { 
        icon: Crown, 
        value: userProfile.pride, 
        label: "Wibawa",
        pulse: true 
    },
  ];

  return (
    <div className="relative h-screen w-full font-sans overflow-hidden bg-background">
      {/* Maintenance Overlay */}
      {isMaintenance && userProfile.role !== 'admin' && (
          <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background/95 backdrop-blur-2xl p-6 text-center">
              <div className="relative mb-8">
                  <div className="absolute -inset-10 bg-primary/20 rounded-full blur-3xl animate-pulse" />
                  <ShieldAlert className="h-20 w-20 text-primary relative" />
              </div>
              <h1 className="text-4xl font-poiret-one font-bold tracking-[0.2em] uppercase text-white mb-4">Protokol Pemeliharaan</h1>
              <p className="max-w-md text-muted-foreground font-gruppo text-lg tracking-widest leading-relaxed mb-8">
                  Dewan Militer sedang melakukan sinkronisasi kedaulatan. Akses dashboard ditutup sementara demi kestabilan wilayah.
              </p>
              <div className="flex flex-col gap-4 w-full max-w-xs">
                  <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-primary animate-progress-indeterminate" />
                  </div>
                  <Button variant="ghost" onClick={handleLogout} className="text-destructive uppercase tracking-widest text-[10px] font-bold">Keluar Gerbang</Button>
              </div>
          </div>
      )}

      <div 
        className="fixed inset-0 z-0 transition-all duration-700 ease-in-out"
        style={{
          backgroundImage: backgroundUrl ? `url(${backgroundUrl})` : 'none',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      />
      <div 
          className="fixed inset-0 z-10 bg-background/85" 
          style={{ backdropFilter: `blur(${backgroundBlur}px)` }}
      />

      <div className="relative z-20 flex h-full flex-col bg-transparent text-foreground">
        <aside className="hidden md:flex flex-col w-60 fixed h-full bg-card/40 border-r border-primary/5 backdrop-blur-lg">
            <div className="flex items-center gap-3 h-16 px-6">
                <Shield className="h-6 w-6 text-primary drop-shadow-[0_0_8px_rgba(234,179,8,0.3)]" />
                <h1 className="text-lg tracking-[0.2em] font-gruppo font-bold text-primary uppercase">Patra Yudha</h1>
            </div>
            <nav className="flex flex-col p-4 space-y-1">
                {navItems.map((item) => (
                    <Button variant="ghost" key={item.href} className={`relative h-10 justify-start font-medium text-xs transition-all duration-200 hover:pl-5 ${pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href)) ? 'bg-primary/10 text-primary' : 'hover:bg-primary/5'}`} asChild>
                        <Link href={item.href}>
                            <item.icon className={`mr-3 h-4 w-4 ${pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href)) ? 'text-primary' : 'text-muted-foreground'}`}/>
                            {item.label}
                        </Link>
                    </Button>
                ))}
                <Button variant="ghost" className={`relative h-10 justify-start font-medium text-xs transition-all duration-200 hover:pl-5 ${pathname.startsWith('/dashboard/reports') ? 'bg-primary/10 text-primary' : 'hover:bg-primary/5'}`} asChild>
                    <Link href={'/dashboard/reports'}>
                        <Bell className={`mr-3 h-4 w-4 ${pathname.startsWith('/dashboard/reports') ? 'text-primary' : 'text-muted-foreground'}`}/>
                        Laporan
                        {hasUnreadReports && <div className="absolute top-2.5 right-3 h-2 w-2 rounded-full bg-destructive animate-pulse" />}
                    </Link>
                </Button>
                
                <div className="pt-3 mt-3 border-t border-primary/10">
                    <Button variant="ghost" size="sm" className={`h-9 justify-start font-medium text-[11px] transition-all duration-200 hover:pl-5 ${pathname === '/dashboard/settings' ? 'bg-primary/10 text-primary' : 'hover:bg-primary/5'}`} asChild>
                        <Link href="/dashboard/settings"><Settings className="mr-3 h-3.5 w-3.5 text-muted-foreground"/>Pengaturan</Link>
                    </Button>
                    {userProfile.role === 'admin' && (
                        <Button variant="ghost" size="sm" className="h-9 justify-start font-medium text-[11px] text-accent hover:bg-accent/10 transition-all duration-200 hover:pl-5" asChild>
                            <Link href="/superdashboard"><Crown className="mr-3 h-3.5 w-3.5"/>Super Dashboard</Link>
                        </Button>
                    )}
                    <Button variant="ghost" size="sm" className="h-9 justify-start font-medium text-[11px] text-destructive hover:bg-destructive/10 transition-all duration-200 hover:pl-5" onClick={handleLogout}>
                        <LogOut className="mr-3 h-3.5 w-3.5"/>Keluar
                    </Button>
                </div>
            </nav>
            <div className="mt-auto p-4 border-t border-primary/5">
                <ModeToggle />
            </div>
        </aside>

        <div className="flex flex-1 flex-col md:pl-60 h-full overflow-hidden">
            <header className="flex h-14 md:h-0 items-center justify-between border-b border-white/5 bg-background/80 px-4 backdrop-blur-xl md:hidden shrink-0">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                <h1 className="text-sm tracking-widest font-gruppo font-bold text-primary uppercase">Patra Yudha</h1>
              </div>
              
              <div className="flex items-center gap-2">
                <Button asChild variant="ghost" size="icon" className="relative h-9 w-9">
                    <Link href="/dashboard/reports">
                        <Bell className="h-4 w-4 text-primary" />
                        {hasUnreadReports && <div className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-destructive animate-pulse" />}
                    </Link>
                </Button>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-9 w-9">
                            <Menu className="h-4 w-4 text-primary" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 glass-card">
                        <DropdownMenuLabel className="font-poiret-one text-lg tracking-wider">{userProfile.prideName}</DropdownMenuLabel>
                        <DropdownMenuSeparator className="bg-primary/10" />
                        {userProfile.role === 'admin' && (
                            <DropdownMenuItem asChild>
                                <Link href="/superdashboard" className="flex items-center gap-2 py-2">
                                    <Crown className="h-4 w-4 text-accent" />
                                    <span>Super Dashboard</span>
                                </Link>
                            </DropdownMenuItem>
                        )}
                        <DropdownMenuItem asChild>
                            <Link href="/dashboard/settings" className="flex items-center gap-2 py-2">
                                <Settings className="h-4 w-4 text-muted-foreground" />
                                <span>Pengaturan Akun</span>
                            </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-primary/10" />
                        <DropdownMenuItem onClick={handleLogout} className="flex items-center gap-2 py-2 text-destructive">
                            <LogOut className="h-4 w-4" />
                            <span>Keluar</span>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </header>

            <div className="flex-1 flex flex-col min-h-0">
              <div className="px-4 py-2 md:px-6 md:py-3 space-y-2 shrink-0 bg-background/40 backdrop-blur-md border-b border-primary/5">
                {isMaintenance && (
                  <div className="bg-amber-500/20 border border-amber-500/40 rounded-md p-1.5 flex items-center justify-center gap-2 animate-pulse mb-1">
                    <Lock className="h-3 w-3 text-amber-500" />
                    <span className="text-[9px] uppercase font-bold tracking-widest text-amber-500">PROTOKOL PEMELIHARAAN AKTIF: Beberapa fungsi mungkin dibatasi.</span>
                  </div>
                )}
                
                {adminMessage && !isLoadingMessage && !isMaintenance && (
                  <div className="relative overflow-hidden bg-primary/5 backdrop-blur-md border border-primary/10 h-8 flex items-center group rounded-md">
                    <div className="absolute left-0 z-10 bg-gradient-to-r from-background/90 to-transparent w-10 h-full flex items-center pl-2">
                        <Megaphone className="h-3 w-3 text-primary/70 animate-bounce" />
                    </div>
                    <div className="flex whitespace-nowrap animate-marquee">
                      <span className="mx-8 font-poiret-one text-[10px] tracking-[0.3em] uppercase text-primary font-bold drop-shadow-[0_0_5px_rgba(234,179,8,0.3)]">{adminMessage}</span>
                      <span className="mx-8 font-poiret-one text-[10px] tracking-[0.3em] uppercase text-primary font-bold drop-shadow-[0_0_5px_rgba(234,179,8,0.3)]">{adminMessage}</span>
                    </div>
                  </div>
                )}
                
                <div className="grid grid-cols-4 gap-2 md:gap-3">
                  {stats.map((stat, idx) => (
                    <Card key={idx} className={cn(
                      "bg-card/30 transition-all duration-500 overflow-hidden relative group h-14 md:h-20",
                      stat.critical 
                        ? "border-destructive/50 bg-destructive/10 animate-pulse" 
                        : "border-primary/20 bg-white/5 hover:border-primary/40",
                      stat.pulse && "shadow-[0_0_15px_rgba(234,179,8,0.15)]"
                    )}>
                      <CardContent className="p-2 md:p-3 h-full flex flex-col items-center justify-center gap-0 relative">
                        <div className="flex items-center gap-1.5 z-10">
                           <stat.icon className={cn(
                               "h-3 w-3 md:h-4 md:w-4 transition-all duration-500", 
                               stat.critical ? "text-destructive" : "text-primary/70 group-hover:text-primary",
                               stat.pulse && "text-primary animate-pulse"
                           )} />
                        </div>
                        <div className="text-center mt-1 z-10">
                          <p className={cn(
                            "text-xs md:text-sm font-gruppo font-bold tracking-[0.1em] leading-none transition-all duration-500",
                            stat.critical ? "text-destructive" : stat.pulse ? "text-primary drop-shadow-[0_0_8px_rgba(234,179,8,0.4)]" : "text-foreground"
                          )}>
                            {typeof stat.value === 'number' ? Math.floor(stat.value).toLocaleString() : stat.value}
                          </p>
                          <p className="text-[7px] md:text-[8px] text-muted-foreground/60 uppercase font-bold tracking-widest mt-1 group-hover:text-muted-foreground transition-colors">{stat.label}</p>
                        </div>
                        
                        {stat.pulse && (
                          <div className="absolute inset-0 bg-gradient-to-t from-primary/10 to-transparent opacity-30 pointer-events-none" />
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              <div className="flex-1 overflow-hidden relative">
                <ScrollArea className="h-full w-full">
                  <div className="p-4 md:p-6 pb-24 md:pb-8">
                    <div className="max-w-6xl mx-auto w-full">
                      {children}
                    </div>
                  </div>
                </ScrollArea>
              </div>
            </div>
        </div>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/5 bg-background/90 backdrop-blur-2xl md:hidden px-2 h-18 shrink-0">
        <div className="grid h-full grid-cols-5 items-center justify-items-center gap-1">
            {navItems.map((item) => {
                const isActive = item.href === '/dashboard' ? pathname === item.href : pathname.startsWith(item.href);
                return (
                    <Button asChild key={item.href} variant="ghost" className={`relative flex flex-col h-14 p-1 w-full transition-all duration-300 ${isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground'}`}>
                        <Link href={item.href}>
                            <item.icon className={`h-4.5 w-4.5 mb-1 transition-transform ${isActive ? 'scale-110' : ''}`} />
                            <span className={`text-[8px] uppercase font-bold tracking-tighter ${isActive ? 'opacity-100' : 'opacity-70'}`}>{item.label}</span>
                            {isActive && <div className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-primary rounded-b-full shadow-[0_2px_8px_rgba(234,179,8,0.5)]" />}
                        </Link>
                    </Button>
                );
            })}
        </div>
      </nav>
    </div>
  );
}
