import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyD-RXm8_gaEtQg8G8jDE5TZCmtNubpZQJc",
  authDomain: "scrisoriglck.firebaseapp.com",
  projectId: "scrisoriglck",
  storageBucket: "scrisoriglck.firebasestorage.app",
  messagingSenderId: "773187451537",
  appId: "1:773187451537:web:94c8bbd47009e793aa1d30"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);