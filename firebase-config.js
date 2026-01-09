// ========================================
// FIREBASE CONFIGURATION
// ========================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-storage.js";

// 🔥 REPLACE WITH YOUR ACTUAL FIREBASE CONFIG
const firebaseConfig = {
  apiKey: "AIzaSyB5HcnVBzAUsFIR5wkV3DhFhRm1DkodaIg",
  authDomain: "dayangsari-ent.firebaseapp.com",
  projectId: "dayangsari-ent",
  storageBucket: "dayangsari-ent.firebasestorage.app",
  messagingSenderId: "846150757092",
  appId: "1:846150757092:web:1d8062d3a22b02cc37daf1",
  measurementId: "G-4ZWZBLQ6PL"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

console.log('✅ Firebase initialized');
console.log('📁 Project:', firebaseConfig.projectId);