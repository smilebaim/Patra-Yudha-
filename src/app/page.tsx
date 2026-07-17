'use client';

import Link from 'next/link';
import { Crown, ChevronRight, Map, Star, Users, Swords, Megaphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';
import { useFirestore } from '@/firebase/firestore/firestore-context';
import { doc, onSnapshot } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { motion } from 'framer-motion';

const concepts = [
  {
    icon: Star,
    title: "Wibawa",
    subtitle: "Visi Kedaulatan",
    description: "Bangun kejayaan identitas agung Anda. Kumpulkan Wibawa melalui pembangunan dan kemenangan pertempuran untuk mendominasi dewan tertinggi.",
  },
  {
    icon: Map,
    title: "Geopolitik",
    subtitle: "Kedaulatan Wilayah",
    description: "Kuasai peta strategis nusantara. Kelola lahan terbatas, perluas wilayah kedaulatan provinsi, dan pertahankan setiap jengkal tanah.",
  },
  {
    icon: Users,
    title: "Aliansi",
    subtitle: "Diplomasi Agung",
    description: "Bentuk perserikatan bersama para Bangsawan. Pilih pemimpin melalui voting, berbagi logistik, dan deklarasikan perang terbuka.",
  },
  {
    icon: Swords,
    title: "Militer",
    subtitle: "Strategi Agresi",
    description: "Latih divisi militer. Jalankan Penjarahan rahasia atau mobilisasi Invasi besar-besaran untuk meruntuhkan kekuasaan musuh.",
  },
];

const defaultMessage = "Selamat Datang di Patra Yudha, Wahai Calon Penguasa Nusantara.";

export default function PublicHomePage() {
  const { db } = useFirestore();
  const [adminInfo, setAdminInfo] = useState<any>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!db) return;
    setIsLoading(true);
    const unsub = onSnapshot(doc(db, 'game-settings', 'admin-info'), (docSnap) => {
        if (docSnap.exists()) {
            setAdminInfo(docSnap.data());
        } else {
            setAdminInfo({ message: defaultMessage });
        }
        setIsLoading(false);
    }, () => {
        setAdminInfo({ message: defaultMessage });
        setIsLoading(false);
    });
    return () => unsub();
  }, [db]);
  
  const backgroundUrl = adminInfo.homeBackgroundUrl || 'https://picsum.photos/seed/patra/1920/1080';
  const backgroundBlur = adminInfo.homeBackgroundBlur ?? 2;

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
        delayChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } }
  };

  return (
    <div className="flex flex-col h-screen max-h-screen bg-background text-foreground font-sans selection:bg-primary/30 relative overflow-hidden">
        {/* Background Layer */}
        <div 
          className="fixed inset-0 z-0 transition-opacity duration-1000 scale-105"
          style={{
            backgroundImage: `url(${backgroundUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
          }}
        />
        <div 
          className="fixed inset-0 bg-gradient-to-b from-background/40 via-background/90 to-background z-1" 
          style={{ backdropFilter: `blur(${backgroundBlur}px)` }}
        />

        <div className="relative z-10 flex flex-col h-full">
          {/* Header - Compact */}
          <motion.header 
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="flex h-12 md:h-16 items-center justify-between px-6 md:px-12"
          >
             <div className="flex items-center gap-2">
                <Crown className="h-5 w-5 md:h-6 md:w-6 text-primary drop-shadow-[0_0_8px_rgba(234,179,8,0.6)]" />
                <span className="font-gruppo text-sm md:text-xl font-bold tracking-[0.3em] uppercase text-primary">Patra Yudha</span>
             </div>
          </motion.header>
          
          <main className="flex-1 flex flex-col items-center justify-center px-4 overflow-hidden">
            <section className="w-full max-w-6xl mx-auto space-y-4 md:space-y-8">
                
                {/* Hero Branding - Scaled Down */}
                <motion.div 
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                    className="text-center space-y-2"
                >
                    <div className="inline-block px-4 py-1 rounded-full bg-primary/10 border border-primary/20 mb-1 backdrop-blur-xl">
                        <p className="text-[7px] md:text-[9px] font-gruppo font-bold tracking-[0.4em] uppercase text-primary">Kedaulatan • Strategi • Nusantara</p>
                    </div>
                    
                    <h1 className="text-4xl md:text-6xl lg:text-8xl font-poiret-one font-bold tracking-tighter text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.1)] uppercase leading-none">
                        Patra Yudha
                    </h1>
                    
                    <motion.p 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 0.6 }}
                        transition={{ delay: 0.4 }}
                        className="max-w-xl mx-auto text-muted-foreground font-gruppo text-[10px] md:text-lg tracking-[0.3em] uppercase"
                    >
                        Taklukkan Negeri, Kukuhkan Wibawa.
                    </motion.p>
                </motion.div>
                
                {/* Strategic Pillars Grid - Compact Cards */}
                <motion.div 
                  variants={containerVariants}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6 px-2"
                >
                  {concepts.map((concept) => (
                    <motion.div 
                      key={concept.title} 
                      variants={itemVariants}
                      className="group"
                    >
                        <Dialog>
                          <DialogTrigger asChild>
                            <div className="relative flex flex-col items-center text-center gap-2 md:gap-4 cursor-pointer p-4 md:p-6 rounded-xl md:rounded-2xl transition-all duration-300 hover:-translate-y-1 bg-card/20 backdrop-blur-3xl border border-white/5 hover:border-primary/40 group/card overflow-hidden">
                                <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-primary/20 to-transparent group-hover/card:via-primary/60 transition-all duration-500" />
                                
                                <div className="relative">
                                    <div className="h-8 w-8 md:h-12 md:w-12 rounded-lg md:rounded-xl bg-primary/5 flex items-center justify-center border border-white/10 group-hover/card:border-primary/50 transition-all shadow-xl">
                                        <concept.icon className="h-4 w-4 md:h-6 md:w-6 text-primary/40 group-hover/card:text-primary transition-colors" />
                                    </div>
                                </div>

                                <div className="space-y-0.5">
                                    <h3 className="text-[10px] md:text-sm font-poiret-one font-bold uppercase tracking-widest text-white group-hover/card:text-primary transition-colors">{concept.title}</h3>
                                    <p className="text-[7px] md:text-[8px] font-bold text-primary/40 uppercase tracking-[0.2em] hidden md:block">{concept.subtitle}</p>
                                </div>
                            </div>
                          </DialogTrigger>
                          <DialogContent className="glass-card border-white/10 mx-4 max-w-md">
                            <div className="space-y-4 py-2">
                                <DialogHeader>
                                <div className="flex flex-col items-center gap-3 mb-2">
                                    <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
                                            <concept.icon className="h-6 w-6 text-primary" />
                                    </div>
                                    <DialogTitle className="font-poiret-one text-xl tracking-widest uppercase font-bold text-white text-center">
                                        {concept.title}
                                    </DialogTitle>
                                    <p className="text-[8px] font-bold tracking-[0.4em] text-primary/60 uppercase">{concept.subtitle}</p>
                                </div>
                                <DialogDescription className="pt-4 text-center leading-relaxed text-sm text-muted-foreground/80 border-t border-white/5">
                                    {concept.description}
                                </DialogDescription>
                                </DialogHeader>
                            </div>
                          </DialogContent>
                        </Dialog>
                    </motion.div>
                  ))}
                </motion.div>

                {/* Compact Action Cards Section */}
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.6, duration: 0.6 }}
                    className="grid grid-cols-2 gap-3 md:gap-6 w-full max-w-lg mx-auto px-4"
                >
                    <Link href="/register" className="group">
                        <motion.div 
                          whileHover={{ y: -2, scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className="relative flex flex-col items-center text-center p-3 md:p-5 rounded-2xl bg-primary/10 backdrop-blur-3xl border border-primary/30 shadow-lg group-hover:border-primary/60 transition-all duration-300 overflow-hidden h-full"
                        >
                            <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-primary/70 to-transparent" />
                            <div className="h-8 w-8 md:h-10 md:w-10 rounded-xl bg-primary/20 flex items-center justify-center mb-2 border border-primary/20 shadow-inner">
                                <Crown className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                            </div>
                            <h3 className="font-poiret-one text-xs md:text-lg font-bold tracking-[0.1em] text-white uppercase">Kukuhkan Tahta</h3>
                            <p className="font-gruppo text-[6px] md:text-[8px] tracking-[0.2em] text-primary/80 uppercase font-bold hidden sm:block">Mulai Perjalanan</p>
                        </motion.div>
                    </Link>

                    <Link href="/login" className="group">
                        <motion.div 
                          whileHover={{ y: -2, scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className="relative flex flex-col items-center text-center p-3 md:p-5 rounded-2xl bg-white/5 backdrop-blur-3xl border border-white/10 shadow-lg group-hover:border-white/20 transition-all duration-300 overflow-hidden h-full"
                        >
                            <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-white/40 to-transparent" />
                            <div className="h-8 w-8 md:h-10 md:w-10 rounded-xl bg-white/5 flex items-center justify-center mb-2 border border-white/10 shadow-inner">
                                <Swords className="h-4 w-4 md:h-5 md:w-5 text-white/70 group-hover:text-white" />
                            </div>
                            <h3 className="font-poiret-one text-xs md:text-lg font-bold tracking-[0.1em] text-white/90 uppercase">Masuk Aula</h3>
                            <p className="font-gruppo text-[6px] md:text-[8px] tracking-[0.2em] text-muted-foreground uppercase font-bold hidden sm:block">Pusat Komando</p>
                        </motion.div>
                    </Link>
                </motion.div>
            </section>
          </main>

          {/* Admin Announcement Bar - Slim */}
          <div className="w-full pb-4 px-4 md:px-6">
              {isLoading ? (
                <div className="container max-w-4xl mx-auto"><Skeleton className="h-8 w-full bg-white/5 rounded-lg" /></div>
              ) : (
                adminInfo.message && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="container max-w-4xl mx-auto relative overflow-hidden bg-primary/5 backdrop-blur-3xl border border-primary/20 h-8 md:h-10 flex items-center rounded-lg group shadow-xl"
                  >
                    <div className="absolute left-0 z-10 bg-gradient-to-r from-background/95 to-transparent w-10 md:w-20 h-full flex items-center pl-3">
                        <Megaphone className="h-3 w-3 md:h-4 md:w-4 text-primary/70 animate-bounce" />
                    </div>
                    <div className="absolute right-0 z-10 bg-gradient-to-l from-background/95 to-transparent w-10 md:w-20 h-full" />
                    <div className="flex whitespace-nowrap animate-marquee">
                      <span className="mx-12 font-poiret-one text-[8px] md:text-xs tracking-[0.3em] uppercase text-primary font-bold">{adminInfo.message}</span>
                      <span className="mx-12 font-poiret-one text-[8px] md:text-xs tracking-[0.3em] uppercase text-primary font-bold">{adminInfo.message}</span>
                    </div>
                  </motion.div>
                )
              )}
          </div>
        </div>
    </div>
  );
}
