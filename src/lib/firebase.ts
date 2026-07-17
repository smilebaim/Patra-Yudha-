'use client';

import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";

/**
 * Konfigurasi Firebase untuk proyek Patra Yudha.
 * Pastikan Authentication dan Firestore telah diaktifkan di Konsol Firebase.
 */
const firebaseConfig = {
  apiKey: "AIzaSyAJ8jJFm5HL1iHLqtj4fY1d2bOWY7tOQTI",
  authDomain: "patra-yudha.firebaseapp.com",
  projectId: "patra-yudha",
  storageBucket: "patra-yudha.firebasestorage.app",
  messagingSenderId: "1031214440709",
  appId: "1:1031214440709:web:9052574609965fda13976c"
};

// Inisialisasi Firebase secara idempoten
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Mengaktifkan persistensi luring
if (typeof window !== "undefined") {
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn("Firestore persistence failed: Multiple tabs open.");
    } else if (err.code === 'unimplemented') {
      console.warn("Firestore persistence failed: Browser not supported.");
    }
  });
}

export { app, auth, db };
