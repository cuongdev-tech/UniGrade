import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, getReactNativePersistence, initializeAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { Platform } from 'react-native';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const requiredConfigKeys = ['apiKey', 'authDomain', 'projectId', 'appId'];

export function getFirebaseServices() {
  const missingKeys = requiredConfigKeys.filter((key) => !firebaseConfig[key]);
  if (missingKeys.length > 0) {
    throw new Error(
      'Thiếu cấu hình Firebase. Hãy điền các biến EXPO_PUBLIC_FIREBASE_* trong file .env rồi khởi động lại Expo.'
    );
  }

  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  let auth;

  if (Platform.OS === 'web') {
    auth = getAuth(app);
  } else {
    try {
      auth = initializeAuth(app, {
        persistence: getReactNativePersistence(AsyncStorage),
      });
    } catch (error) {
      if (error.code !== 'auth/already-initialized') throw error;
      auth = getAuth(app);
    }
  }

  return { auth, db: getFirestore(app) };
}
