
'use client';

import { useAuth } from '@/firebase/auth/auth-context';
import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { IndonesiaMap } from '@/components/ui/indonesia-map';
import { collection, onSnapshot } from 'firebase/firestore';
import { useFirestore } from '@/firebase/firestore/firestore-context';
import { Globe, Shield, Star, Users, MapPin, Info } from 'lucide-react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

interface User {
  id: string;
  prideName: string;
  pride: number;
  province: string;
  role: 'admin' | 'user';
}

interface Title {
  id: string;
  name: string;
  prideRequired: number;
}

export default function GlobalMapPage() {
  const { db } = useFirestore();
  const [users, setUsers] = useState<User[]>([]);
  const [titles, setTitles] = useState<Title[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!db) return;
    
    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      setUsers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as User)));
      setIsLoading(false);
    }, (err) => errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'users', operation: 'list' })));

    const unsubTitles = onSnapshot(collection(db, 'titles'), (snap) => {
      setTitles(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Title)));
    }, (err) => errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'titles', operation: 'list' })));

    return () => { unsubUsers(); unsubTitles(); };
  }, [db]);

  const mapStats = useMemo(() => {
    const provinceControl: { [key: string]: number } = {};
    users.forEach(u => {
      if (u.role !== 'admin') {
        provinceControl[u.province] = (provinceControl[u.province] || 0) + 1;
      }
    });
    return {
      activeProvinces: Object.keys(provinceControl).length,
      totalNobles: users.filter(u => u.role !== 'admin').length,
    };
  }, [users]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-40 gap-4 opacity-50">
        <Globe className="h-12 w-12 animate-spin text-primary" />
        <p className="font-poiret-one text-xl tracking-[0.3em] uppercase">Mengkoneksikan Satelit Strategis...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2 bg-card/40 backdrop-blur-xl border-white/5 shadow-2xl overflow-hidden relative">
          <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
          <CardHeader className="bg-white/5 border-b border-white/5 p-6">
            <CardTitle className="text-2xl font-poiret-one tracking-[0.2em] uppercase flex items-center gap-3">
              <Globe className="h-6 w-6 text-primary" /> Peta Supremasi Nusantara
            </CardTitle>
            <CardDescription className="text-[10px] uppercase tracking-widest opacity-60">Visualisasi dominasi wibawa para Bangsawan di seluruh wilayah provinsi.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
             <IndonesiaMap users={users} titles={titles} />
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="bg-card/40 backdrop-blur-xl border-white/5 shadow-xl">
            <CardHeader>
              <CardTitle className="text-sm font-gruppo tracking-widest uppercase text-primary">Intisari Geopolitik</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <MapPin className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold opacity-40 uppercase">Provinsi Aktif</p>
                    <p className="font-gruppo font-bold text-xl">{mapStats.activeProvinces}</p>
                  </div>
                </div>
              </div>
              <div className="p-4 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold opacity-40 uppercase">Populasi Bangsawan</p>
                    <p className="font-gruppo font-bold text-xl">{mapStats.totalNobles.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/30 backdrop-blur-lg border-primary/10 shadow-lg p-6">
            <div className="flex items-start gap-4">
              <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-primary">Panduan Peta</p>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  Gunakan sensor satelit di kiri untuk memantau pergerakan kekuasaan. Titik bercahaya menandakan provinsi yang dikuasai oleh Bangsawan dengan Wibawa tertinggi di wilayah tersebut.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
