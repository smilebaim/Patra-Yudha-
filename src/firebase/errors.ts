'use client';

export type SecurityRuleContext = {
  path: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete' | 'write';
  requestResourceData?: any;
};

/**
 * Kesalahan khusus untuk kegagalan aturan keamanan Firestore.
 * Membantu memberikan konteks yang kaya saat debug.
 */
export class FirestorePermissionError extends Error {
  context: SecurityRuleContext;

  constructor(context: SecurityRuleContext) {
    const message = `FirestoreError: Missing or insufficient permissions: The following request was denied by Firestore Security Rules:
{
  "method": "${context.operation}",
  "path": "${context.path}"
}`;
    super(message);
    this.name = 'FirestorePermissionError';
    this.context = context;
  }
}
