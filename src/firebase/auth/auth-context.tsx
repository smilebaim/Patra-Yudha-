
'use client';

import type { User } from 'firebase/auth';
import { onAuthStateChanged, signOut, type Auth } from 'firebase/auth';
import { doc, onSnapshot, updateDoc, Timestamp, getDoc, serverTimestamp } from 'firebase/firestore';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { auth as firebaseAuth, db } from '@/lib/firebase';
import { Crown } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useGameLoop } from '@/hooks/use-game-loop';

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
  email: string;
  prideName: string;
  role: 'admin' | 'user';
  status?: 'active' | 'disabled';
  money: number;
  food: number;
  land: number;
  zodiac: string;
  province: string;
  buildings: BuildingCounts;
  units: UnitCounts;
  unemployed: number;
  pride: number;
  lastResourceUpdate: any; 
  lastSeen?: Timestamp;
  allianceId?: string | null;
  coordinates?: { x: number; y: number };
  onboardingComplete: boolean;
  soundEnabled?: boolean;
}

interface BuildingEffects {
  residence: { unemployed: number; capacity: number };
  farm: { food: number };
  tambang: { money: number };
  fort: { defenseBonus: number };
  tower: { bonusPertahananPasukanKhusus: number };
  university: { 
    constructionBonus: number; 
    foodAndMoneyBonus: number; 
    attackBonus: number;
    defenseBonus: number;
  };
  barracks: { trainingBonus: number };
  mobility: { attackBonus: number };
}

interface GameTiming {
    constructionTimeInHours: number;
    trainingTimeInHours: number;
}

export interface March {
    id: string;
    attackerId: string;
    defenderId: string;
    type: 'war' | 'raid' | 'return';
    troops: Partial<UnitCounts>;
    arrivalTime: Timestamp;
    origin?: string; 
}


interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  gameTiming: GameTiming | null;
  buildingEffects: BuildingEffects | null;
  auth: Auth | null;
  viewAsUser: boolean;
  setViewAsUser: (view: boolean) => void;
  playSound: (type: 'combat' | 'notification') => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userProfile: null,
  loading: true,
  gameTiming: null,
  buildingEffects: null,
  auth: null,
  viewAsUser: false,
  setViewAsUser: () => {},
  playSound: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [buildingEffects, setBuildingEffects] = useState<BuildingEffects | null>(null);
  const [gameTiming, setGameTiming] = useState<GameTiming | null>(null);
  const [viewAsUser, setViewAsUser] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const playSound = (type: 'combat' | 'notification') => {
    if (userProfile?.soundEnabled === false) return;
    
    const urls = {
        combat: 'https://cdn.pixabay.com/audio/2022/03/10/audio_c350781700.mp3', 
        notification: 'https://cdn.pixabay.com/audio/2021/08/04/audio_0625c1539c.mp3' 
    };

    try {
        const audio = new Audio(urls[type]);
        audio.volume = type === 'combat' ? 0.6 : 0.4;
        audio.play().catch(() => {});
    } catch (e) {
        console.warn("Audio playback failed", e);
    }
  };

  useEffect(() => {
    if (!db) return;
    
    const unsubEffects = onSnapshot(doc(db, 'game-settings', 'building-effects'), (docSnap) => {
        if (docSnap.exists()) {
            setBuildingEffects(docSnap.data() as BuildingEffects);
        }
    });

    const unsubTiming = onSnapshot(doc(db, 'game-settings', 'timing-rules'), (docSnap) => {
        if (docSnap.exists()) {
            setGameTiming(docSnap.data() as GameTiming);
        }
    });

    return () => {
        unsubEffects();
        unsubTiming();
    };
  }, []);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(firebaseAuth, async (authUser) => {
      setLoading(true);
      if (authUser) {
        setUser(authUser);
        if (db) {
          updateDoc(doc(db, 'users', authUser.uid), {
            lastSeen: serverTimestamp()
          }).catch(() => {});
        }
      } else {
        setUser(null);
        setUserProfile(null);
        setViewAsUser(false);
        setLoading(false);
        if (!['/', '/login', '/register'].includes(pathname)) {
            router.push('/login');
        }
      }
    });
    return () => unsubscribeAuth();
  }, [router, pathname]);

  useEffect(() => {
    if (!user || !db) {
        setLoading(false);
        return;
    }

    const userDocRef = doc(db, 'users', user.uid);
    const unsubscribeSnapshot = onSnapshot(userDocRef, (userDoc) => {
      if (userDoc.exists()) {
        const profileData = userDoc.data() as UserProfile;

        if (profileData.status === 'disabled') {
          toast({
            title: "Akun Dinonaktifkan",
            description: "Akun Anda telah dinonaktifkan oleh administrator.",
            variant: "destructive",
          });
          signOut(firebaseAuth);
          return;
        }

        setUserProfile(profileData);
        
        const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/register');
        
        if (!profileData.onboardingComplete) {
            if(pathname !== '/welcome') {
                router.push('/welcome');
            }
        } else if (isAuthPage || pathname === '/welcome' || pathname === '/') {
            if (profileData.role === 'admin' && !viewAsUser) {
                router.push('/superdashboard');
            } else {
                router.push('/dashboard');
            }
        }

      } else {
        signOut(firebaseAuth);
      }
      setLoading(false);
    }, (error: any) => {
      if (error.code !== 'unavailable') {
          signOut(firebaseAuth);
      }
      setLoading(false);
    });

    return () => unsubscribeSnapshot();
    
  }, [user, pathname, router, viewAsUser]);

  useGameLoop(user, userProfile, buildingEffects);

  const value = { user, userProfile, loading, gameTiming, buildingEffects, auth: firebaseAuth, viewAsUser, setViewAsUser, playSound };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
            <Crown className="h-12 w-12 animate-pulse text-primary" />
            <p className="text-muted-foreground">Memuat Pride...</p>
        </div>
      </div>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
