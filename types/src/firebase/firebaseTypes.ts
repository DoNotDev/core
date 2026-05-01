// packages/core/types/src/firebase/firebaseTypes.ts

/**
 * @fileoverview Firebase Types
 * @description Type definitions for Firebase integration. Defines Firestore timestamp interface and date value types for Firebase compatibility without requiring the Firebase Admin SDK.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */

/**
 * Interface mimicking Firebase Timestamp for type compatibility
 * without requiring the actual Firebase Admin SDK
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface FirestoreTimestamp {
  seconds: number;
  nanoseconds: number;
  toDate(): Date;
  toMillis(): number;
  isEqual(other: FirestoreTimestamp): boolean;
  valueOf(): string;
}

/**
 * Represents a date value in various formats accepted by Firebase.
 * Can be a JavaScript Date, a Firestore Timestamp, or an ISO 8601 string.
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export type DateValue = Date | FirestoreTimestamp | string;

/**
 * Firebase configuration object
 * Contains the configuration needed to initialize a Firebase app
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface FirebaseConfig {
  /** Firebase API key */
  apiKey: string;
  /** Firebase authentication domain */
  authDomain: string;
  /** Firebase project ID */
  projectId: string;
  /** Firebase storage bucket URL (optional) */
  storageBucket?: string;
  /** Firebase messaging sender ID (optional) */
  messagingSenderId?: string;
  /** Firebase app ID (optional) */
  appId?: string;
  /** Firebase measurement ID for analytics (optional) */
  measurementId?: string;
}

/**
 * Options for Firebase functions call with abort support
 * Allows for cancellable Firebase function calls
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface FirebaseCallOptions {
  /** Optional key for the abort controller */
  abortKey?: string;
  /** Optional external abort signal to link with internal controller */
  externalSignal?: AbortSignal;
  /** Flag for public function calls */
  public?: boolean;
  /** HTTP callable timeout in milliseconds */
  timeout?: number;
}

/**
 * Interface for Firebase uniqueness validation
 * Used to check if a value would create a duplicate in a collection
 *
 * @version 0.1.0
 * @since 0.0.1
 * @author AMBROISE PARK Consulting
 */
export interface FirestoreUniqueConstraintValidator {
  /**
   * Checks if a value would cause a duplicate in a given collection
   *
   * @param collection - The collection to check
   * @param field - The field to check
   * @param value - The value to check
   * @param currentDocId - The ID of the current document (for updates)
   * @returns A promise that resolves to true if a duplicate exists
   */
  checkDuplicate: (
    collection: string,
    field: string,
    value: any,
    currentDocId?: string
  ) => Promise<boolean>;
}
