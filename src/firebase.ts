import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  query, 
  orderBy, 
  limit, 
  getDocs, 
  getDocFromServer,
  where
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Connection test
export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn("Firebase client offline check:", error.message);
    }
  }
}

// Auth helpers
export async function loginWithGoogle(): Promise<User | null> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error("Google sign in failed:", error);
    throw error;
  }
}

export async function logoutUser(): Promise<void> {
  try {
    await firebaseSignOut(auth);
  } catch (error) {
    console.error("Sign out failed:", error);
    throw error;
  }
}

export interface ScoreRecord {
  id: string;
  userId: string;
  userName: string;
  userPhoto?: string;
  mode: 'speed_text' | 'word_goal' | 'letter_sprint' | 'classic_pet';
  wpm: number;
  cpm: number;
  accuracy: number;
  wordsCount: number;
  timeSeconds: number;
  details?: string;
  createdAt: string;
}

export interface UserSyncProfile {
  uid: string;
  displayName: string;
  photoURL?: string;
  xp: number;
  level: string;
  wordsTypedCount: number;
  stats?: {
    hunger: number;
    sleep: number;
    clean: number;
    happiness: number;
    intelligence: number;
  };
  dailyAchievements?: string[];
  streakDays?: number;
  lastActiveDate?: string;
  updatedAt: string;
}

// Sync user profile to Firestore
export async function saveUserProfile(profile: UserSyncProfile): Promise<void> {
  if (!auth.currentUser || auth.currentUser.uid !== profile.uid) return;
  const path = `users/${profile.uid}`;
  try {
    await setDoc(doc(db, 'users', profile.uid), {
      ...profile,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

// Load user profile from Firestore
export async function loadUserProfile(uid: string): Promise<UserSyncProfile | null> {
  const path = `users/${uid}`;
  try {
    const snapshot = await getDoc(doc(db, 'users', uid));
    if (snapshot.exists()) {
      return snapshot.data() as UserSyncProfile;
    }
    return null;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
    return null;
  }
}

// Save score record to Leaderboard
export async function saveScoreRecord(record: ScoreRecord): Promise<void> {
  const path = `leaderboard/${record.id}`;
  try {
    await setDoc(doc(db, 'leaderboard', record.id), record);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

// Fetch leaderboard records
export async function fetchLeaderboard(mode?: string): Promise<ScoreRecord[]> {
  const path = 'leaderboard';
  try {
    let q;
    if (mode && mode !== 'all') {
      q = query(
        collection(db, 'leaderboard'),
        where('mode', '==', mode),
        orderBy('wpm', 'desc'),
        limit(50)
      );
    } else {
      q = query(
        collection(db, 'leaderboard'),
        orderBy('wpm', 'desc'),
        limit(50)
      );
    }
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as ScoreRecord);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
    return [];
  }
}
