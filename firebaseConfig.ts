import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// TODO: Replace the following with your app's Firebase project configuration
// You can find these in the Firebase Console -> Project Settings -> General
const firebaseConfig = {
  apiKey: "AIzaSyCU5zLYwRYCGIvQYCLOu0dwFkYXVhGQJ7c",
  authDomain: "stallion-4d037.firebaseapp.com",
  projectId: "stallion-4d037",
  storageBucket: "stallion-4d037.firebasestorage.app",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "1:3661673529:android:1eb1d480e4a691968389e8"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);
