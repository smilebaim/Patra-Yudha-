'use client';

import { EventEmitter } from 'events';

/**
 * Emitter global untuk menangani kesalahan Firebase secara terpusat.
 * Digunakan terutama untuk menyalurkan kesalahan izin Firestore ke listener UI.
 */
export const errorEmitter = new EventEmitter();
