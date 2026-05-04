import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// TODO: Replace the following with your app's Firebase project configuration
// You can find these in the Firebase Console -> Project Settings -> General
const firebaseConfig = {
  apiKey: "AIzaSyAC1ziH47_xQ1Lh8yyN82bpXlV413KTSj8",
  authDomain: "tigerdo-be3e5.firebaseapp.com",
  projectId: "tigerdo-be3e5",
  storageBucket: "tigerdo-be3e5.firebasestorage.app",
  messagingSenderId: "208387163535",
  appId: "1:208387163535:android:a27fc3bf1f0ddde52977fa"
};

import { initializeAuth, getReactNativePersistence } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);

// Initialize Auth with persistence
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});
