import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, deleteUser, sendPasswordResetEmail, onAuthStateChanged, sendEmailVerification } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, onSnapshot, serverTimestamp, doc, updateDoc, deleteDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBEf2Z5lLxiDmPLMcSxdP-8uVr4jCNF_EI",
  authDomain: "fixmylocal-17f44.firebaseapp.com",
  projectId: "fixmylocal-17f44",
  storageBucket: "fixmylocal-17f44.firebasestorage.app",
  messagingSenderId: "42467011691",
  appId: "1:42467011691:web:a1bb343ad8dedca24ed52e"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

window.firebaseDB = db;
window.firebaseAuth = auth;
window.firebaseModules = {
  collection, addDoc, getDocs, onSnapshot, serverTimestamp, doc, updateDoc, deleteDoc, setDoc,
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, deleteUser, sendPasswordResetEmail, onAuthStateChanged,
  sendEmailVerification
};

window.addEventListener('load', () => {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      window.firebaseUser = user;
    } else {
      window.firebaseUser = null;
    }
    if (typeof updateNavForUser === 'function') updateNavForUser();
  });
});

