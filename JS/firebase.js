import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

const firebaseConfig = {
    apiKey: "AIzaSyDq5pz5fDVXGx_DZ44q887udy_Q1c35etA",
    authDomain: "recessus-concessus.firebaseapp.com",
    projectId: "recessus-concessus",
    storageBucket: "recessus-concessus.firebasestorage.app",
    messagingSenderId: "332810563797",
    appId: "1:332810563797:web:fb87e23dda06fcf989725c"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);