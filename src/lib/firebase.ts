import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: any) {
    if (error.code === 'auth/popup-closed-by-user') {
      console.log('Sign-in popup closed by user before completion.');
      return null;
    }
    if (error.code === 'auth/cancelled-popup-request') {
      console.log('Multiple popup requests detected. Previous one cancelled.');
      return null;
    }
    if (error.code === 'auth/popup-blocked') {
      alert('Login popup was blocked by your browser. Please allow popups for this site.');
      return null;
    }
    console.error('Error signing in with Google:', error.code, error.message);
    throw error;
  }
};
