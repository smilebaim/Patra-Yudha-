/**
 * Mencatat error ke konsol. Di lingkungan produksi, Anda mungkin ingin
 * mengintegrasikannya dengan layanan pelaporan error seperti Sentry,
 * LogRocket, atau Firebase Crashlytics.
 * @param error Objek error yang akan dicatat.
 * @param context Informasi kontekstual tambahan.
 */
export function logError(error: any, context?: Record<string, any>): void {
  // Hindari logging berulang atau loop rekursif, terutama dalam komponen error global.
  if (error.__alreadyLogged) {
    return;
  }

  // Jangan catat error konfigurasi basis data sebagai error sistem yang fatal di log
  const message = (error?.message || "").toLowerCase();
  const isNoDatabase = message.includes("database (default) does not exist") || message.includes("not exist for project");
  
  if (isNoDatabase) {
    console.warn("Konfigurasi Diperlukan:", error.message);
    return;
  }

  console.error("Kesalahan Tercatat [Patra Yudha]:", error.message, {
    errorObject: error,
    stack: error.stack,
    digest: error.digest,
    context,
  });

  // Tandai error untuk mencegah logging ganda
  try {
    Object.defineProperty(error, '__alreadyLogged', { value: true, configurable: true });
  } catch (e) {
    // Abaikan jika properti tidak dapat didefinisikan (misalnya, pada objek beku)
  }
}


/**
 * Mengonversi objek error Firebase menjadi pesan string yang ramah pengguna.
 * @param error Objek error yang dilemparkan oleh Firebase SDK.
 * @returns String pesan error yang mudah dipahami.
 */
export function getFirebaseErrorMessage(error: any): string {
    const message = (error?.message || "").toLowerCase();
    const code = error?.code || "";

    // Deteksi khusus untuk basis data yang belum dibuat
    if (message.includes("database (default) does not exist") || message.includes("not exist for project")) {
        return "Basis data Firestore (default) belum dibuat. Silakan buka https://console.firebase.google.com/project/patra-yudha/firestore lalu klik 'Create database' dengan ID '(default)'.";
    }

    if (code === 'permission-denied' || message.includes("insufficient permissions")) {
        return "Izin database ditolak. Pastikan 'Cloud Firestore' telah diaktifkan dan 'Security Rules' telah diset ke mode pengujian atau publik di Konsol Firebase.";
    }

    if (!error || !error.code) {
        return error?.message || "Terjadi kesalahan yang tidak terduga. Silakan coba lagi.";
    }

    switch (error.code) {
        case 'auth/invalid-email':
            return "Format email yang Anda masukkan tidak valid.";
        case 'auth/user-disabled':
            return "Akun ini telah dinonaktifkan oleh administrator.";
        case 'auth/user-not-found':
            return "Tidak ada akun yang ditemukan dengan email ini.";
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
            return "Email atau kata sandi yang Anda masukkan salah.";
        case 'auth/email-already-in-use':
            return "Email ini sudah digunakan oleh akun lain.";
        case 'auth/weak-password':
            return "Kata sandi terlalu lemah. Harap gunakan minimal 6 karakter.";
        case 'auth/requires-recent-login':
            return "Tindakan ini memerlukan autentikasi ulang. Silakan keluar dan masuk kembali.";
        case 'auth/too-many-requests':
            return "Terlalu banyak percobaan masuk. Coba lagi nanti atau atur ulang kata sandi Anda.";
        case 'permission-denied':
            return "Izin ditolak. Pastikan Security Rules Firestore Anda telah dikonfigurasi.";
        case 'not-found':
            if (message.includes("database")) {
                return "Basis data tidak ditemukan. Pastikan Cloud Firestore telah diaktifkan di Konsol Firebase.";
            }
            return "Data tidak ditemukan.";
        default:
            return `Kesalahan Firebase (${error.code}): Silakan coba lagi nanti.`;
    }
}

export function getFirebaseAuthErrorMessage(error: any): string {
    return getFirebaseErrorMessage(error);
}
