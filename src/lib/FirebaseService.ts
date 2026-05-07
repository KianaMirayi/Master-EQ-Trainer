import { 
  onAuthStateChanged, 
  User as FirebaseUser, 
  signOut
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  query, 
  orderBy, 
  limit, 
  getDocs,
  serverTimestamp
} from 'firebase/firestore';
import { auth, db, signInWithGoogle, signInWithEmailAndPassword, sendPasswordResetEmail } from './firebase';
import { PlayerStats } from './PlayerProfileManager';

export interface LeaderboardEntry {
  uid: string;
  displayName: string;
  photoURL: string;
  masteryScore: number;
  ami: number;
  levelsCompleted: number;
  updatedAt: any;
}

export class FirebaseService {
  static onAuthChange(callback: (user: FirebaseUser | null) => void) {
    return onAuthStateChanged(auth, callback);
  }

  static async login() {
    return await signInWithGoogle();
  }

  static async loginWithEmail(email: string, pass: string) {
    return await signInWithEmailAndPassword(auth, email, pass);
  }

  static async registerWithEmail(email: string, pass: string) {
    const { createUserWithEmailAndPassword, sendEmailVerification } = await import('firebase/auth');
    const result = await createUserWithEmailAndPassword(auth, email, pass);
    await sendEmailVerification(result.user);
    return result.user;
  }

  static async sendVerification() {
    const { sendEmailVerification } = await import('firebase/auth');
    if (auth.currentUser) {
      await sendEmailVerification(auth.currentUser);
    }
  }

  static async reloadUser() {
    if (auth.currentUser) {
      await auth.currentUser.reload();
      return auth.currentUser;
    }
    return null;
  }

  static async updateDisplayName(name: string) {
    const { updateProfile } = await import('firebase/auth');
    if (auth.currentUser) {
      await updateProfile(auth.currentUser, { displayName: name });
      // 同时更新 Firestore
      const stats = (await import('./PlayerProfileManager')).PlayerProfileManager.loadStats();
      const records = (await import('./ProgressionManager')).ProgressionManager.getRecords();
      await this.syncUserData(stats, records);
    }
  }

  static async resetPassword(email: string) {
    return await sendPasswordResetEmail(auth, email);
  }

  static async logout() {
    await signOut(auth);
  }

  static async syncUserData(stats: PlayerStats, records: any) {
    const user = auth.currentUser;
    if (!user) return;

    const userDocRef = doc(db, 'users', user.uid);
    const scoreDocRef = doc(db, 'leaderboard', user.uid);

    const masteryScore = stats.totalStars;
    const ami = this.calculateAMI(stats);

    const userData = {
      uid: user.uid,
      displayName: user.displayName,
      email: user.email,
      photoURL: user.photoURL,
      stats: stats,
      records: records,
      updatedAt: serverTimestamp(),
    };

    const scoreData: LeaderboardEntry = {
      uid: user.uid,
      displayName: user.displayName || 'Anonymous',
      photoURL: user.photoURL || '',
      masteryScore: masteryScore,
      ami: ami,
      levelsCompleted: stats.levelsCompleted,
      updatedAt: serverTimestamp(),
    };

    try {
      await Promise.all([
        setDoc(userDocRef, userData, { merge: true }),
        setDoc(scoreDocRef, scoreData, { merge: true })
      ]);
    } catch (error) {
      console.error('Error syncing user data to Firebase', error);
    }
  }

  static async fetchLeaderboard(type: 'ami' | 'mastery', limitCount: number = 50): Promise<LeaderboardEntry[]> {
    const leaderboardCol = collection(db, 'leaderboard');
    const q = query(
      leaderboardCol, 
      orderBy(type === 'ami' ? 'ami' : 'masteryScore', 'desc'), 
      limit(limitCount)
    );

    try {
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => doc.data() as LeaderboardEntry);
    } catch (error) {
      console.error('Error fetching leaderboard', error);
      return [];
    }
  }

  static async getUserData(userId: string) {
    const docRef = doc(db, 'users', userId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data();
    }
    return null;
  }

  private static calculateAMI(stats: PlayerStats): number {
    if (stats.levelsPlayed === 0) return 0;
    
    // Simple AMI formula for now
    const avgFreqError = stats.totalFreqError / stats.levelsPlayed;
    const perception = Math.max(0, 100 - (avgFreqError / 12) * 100);
    const avgStars = stats.totalStars / stats.levelsPlayed;
    const precision = (avgStars / 3) * 100;
    
    return Math.round((perception * 0.4 + precision * 0.6) * 100);
  }
}
