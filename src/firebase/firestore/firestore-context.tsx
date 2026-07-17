'use client';

import { createContext, useContext, ReactNode } from 'react';
import { db } from '@/lib/firebase';
import type { Firestore } from 'firebase/firestore';

interface FirestoreContextType {
    db: Firestore | null;
}

const FirestoreContext = createContext<FirestoreContextType>({ db: null });

export function FirestoreProvider({ children }: { children: ReactNode }) {
    return (
        <FirestoreContext.Provider value={{ db }}>
            {children}
        </FirestoreContext.Provider>
    );
}

export const useFirestore = () => {
    const context = useContext(FirestoreContext);
    if (context === undefined) {
        throw new Error('useFirestore must be used within a FirestoreProvider');
    }
    return context;
};
