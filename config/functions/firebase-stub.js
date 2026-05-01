/**
 * @fileoverview Firebase Client SDK Stub
 * @description Empty export to stub out client-side Firebase imports in server builds.
 * This prevents the need to install 'firebase' in Cloud Functions.
 */

// Basic app exports
export const initializeApp = () => ({});
export const getApp = () => ({});
export const getApps = () => [];

// App Check exports
export const initializeAppCheck = () => ({});
export class ReCaptchaEnterpriseProvider {
  constructor() {}
}
export class ReCaptchaV3Provider {
  constructor() {}
}

// Auth exports
export const getAuth = () => ({});
export const onAuthStateChanged = () => () => {};
export const signInWithEmailAndPassword = () => Promise.resolve({});
export const signOut = () => Promise.resolve();
export const setPersistence = () => Promise.resolve();
export const browserLocalPersistence = {};
export const browserSessionPersistence = {};
export const inMemoryPersistence = {};
export const connectAuthEmulator = () => {};
export const beforeAuthStateChanged = () => () => {};
export const getRedirectResult = () => Promise.resolve(null);
export const signInWithRedirect = () => Promise.resolve();
export const signInWithPopup = () => Promise.resolve({});
export const createUserWithEmailAndPassword = () => Promise.resolve({});
export const sendPasswordResetEmail = () => Promise.resolve();
export const confirmPasswordReset = () => Promise.resolve();
export const verifyPasswordResetCode = () => Promise.resolve('');
export const signInWithEmailLink = () => Promise.resolve({});
export const sendSignInLinkToEmail = () => Promise.resolve();
export const isSignInWithEmailLink = () => false;
export const signInWithCustomToken = () => Promise.resolve({});
export const signInAnonymously = () => Promise.resolve({});
export const signInWithCredential = () => Promise.resolve({});
export const signInWithPhoneNumber = () => Promise.resolve({});
export const sendEmailVerification = () => Promise.resolve();
export const updatePassword = () => Promise.resolve();
export const updateEmail = () => Promise.resolve();
export const updateProfile = () => Promise.resolve();
export const reload = () => Promise.resolve();
export const deleteUser = () => Promise.resolve();
export const getIdToken = () => Promise.resolve('');
export const getIdTokenResult = () => Promise.resolve({});
export const linkWithCredential = () => Promise.resolve({});
export const linkWithPopup = () => Promise.resolve({});
export const linkWithRedirect = () => Promise.resolve();
export const linkWithPhoneNumber = () => Promise.resolve({});
export const unlink = () => Promise.resolve({});
export const fetchSignInMethodsForEmail = () => Promise.resolve([]);
export const reauthenticateWithCredential = () => Promise.resolve({});
export const reauthenticateWithPopup = () => Promise.resolve({});
export const reauthenticateWithRedirect = () => Promise.resolve();
export const useDeviceLanguage = () => {};
export const checkActionCode = () => Promise.resolve({});
export const applyActionCode = () => Promise.resolve();
export const multiFactor = () => ({});
export const getMultiFactorResolver = () => ({});
export const getAdditionalUserInfo = () => null;

// Auth Providers
class BaseProvider {
  addScope() {
    return this;
  }
  setCustomParameters() {
    return this;
  }
}

export class GoogleAuthProvider extends BaseProvider {}
export class FacebookAuthProvider extends BaseProvider {}
export class GithubAuthProvider extends BaseProvider {}
export class TwitterAuthProvider extends BaseProvider {}
export class OAuthProvider extends BaseProvider {}
export class PhoneAuthProvider extends BaseProvider {}
export class EmailAuthProvider extends BaseProvider {
  static credential() {
    return {};
  }
}
export class RecaptchaVerifier {
  constructor() {}
  render() {
    return Promise.resolve('');
  }
  verify() {
    return Promise.resolve('');
  }
  clear() {}
}

// Firestore exports
export const getFirestore = () => ({});
export const collection = () => ({});
export const doc = () => ({});
export const getDoc = () =>
  Promise.resolve({ exists: () => false, data: () => undefined });
export const getDocs = () => Promise.resolve({ docs: [], empty: true });
export const setDoc = () => Promise.resolve();
export const updateDoc = () => Promise.resolve();
export const deleteDoc = () => Promise.resolve();
export const addDoc = () => Promise.resolve({ id: '' });
export const query = () => ({});
export const where = () => ({});
export const limit = () => ({});
export const orderBy = () => ({});
export const startAfter = () => ({});
export const endBefore = () => ({});
export const onSnapshot = () => () => {};
export const connectFirestoreEmulator = () => {};
export const enableIndexedDbPersistence = () => Promise.resolve();
export const enableMultiTabIndexedDbPersistence = () => Promise.resolve();
export const clearIndexedDbPersistence = () => Promise.resolve();
export const Timestamp = {
  now: () => ({ seconds: 0, nanoseconds: 0 }),
  fromDate: () => ({ seconds: 0, nanoseconds: 0 }),
};
export const serverTimestamp = () => ({});
export const increment = () => ({});
export const arrayUnion = () => ({});
export const arrayRemove = () => ({});
export const deleteField = () => ({});

// Functions exports
export const getFunctions = () => ({});
export const httpsCallable = () => () => Promise.resolve({ data: {} });
export const connectFunctionsEmulator = () => {};

// Storage exports
export const getStorage = () => ({});
export const ref = () => ({});
export const uploadBytes = () => Promise.resolve({});
export const uploadBytesResumable = () => ({
  on: () => () => {},
  then: (cb) => Promise.resolve().then(cb),
  snapshot: { bytesTransferred: 0, totalBytes: 0 },
});
export const getDownloadURL = () => Promise.resolve('');
export const deleteObject = () => Promise.resolve();
export const listAll = () => Promise.resolve({ items: [], prefixes: [] });
export const getMetadata = () => Promise.resolve({});
export const updateMetadata = () => Promise.resolve({});
export const connectStorageEmulator = () => {};

// Analytics
export const getAnalytics = () => ({});
export const logEvent = () => {};
export const setUserId = () => {};
export const setUserProperties = () => {};
export const setAnalyticsCollectionEnabled = () => {};

// Default export
export default {
  app: { initializeApp, getApp, getApps },
  auth: {
    getAuth,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut,
    GoogleAuthProvider,
    FacebookAuthProvider,
    GithubAuthProvider,
    TwitterAuthProvider,
    OAuthProvider,
    PhoneAuthProvider,
    EmailAuthProvider,
  },
  firestore: {
    getFirestore,
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    updateDoc,
    deleteDoc,
    addDoc,
    query,
    where,
    limit,
    orderBy,
    onSnapshot,
  },
  storage: {
    getStorage,
    ref,
    uploadBytes,
    uploadBytesResumable,
    getDownloadURL,
    deleteObject,
    listAll,
  },
  functions: { getFunctions, httpsCallable, connectFunctionsEmulator },
  analytics: { getAnalytics, logEvent },
};
