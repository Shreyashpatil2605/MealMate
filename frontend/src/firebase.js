// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDC1MLvqQXw2kL8vvoC9PduBFUu7SeC7LM",
  authDomain: "mealmate-6095b.firebaseapp.com",
  projectId: "mealmate-6095b",
  storageBucket: "mealmate-6095b.firebasestorage.app",
  messagingSenderId: "859545104350",
  appId: "1:859545104350:web:6752ed5286d23926abf74f",
  measurementId: "G-F86P7KW5XE",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// Initialize Firebase Auth
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// Export auth and googleProvider for use in other components
export { auth, googleProvider, signInWithPopup };
