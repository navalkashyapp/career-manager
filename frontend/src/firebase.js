import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAI, getGenerativeModel, GoogleAIBackend } from "firebase/ai";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyC3oHzJ_NzRjRevkfwFXS7LfdndDz63adY",
  authDomain: "career-manager-8037a.firebaseapp.com",
  projectId: "career-manager-8037a",
  storageBucket: "career-manager-8037a.firebasestorage.app",
  messagingSenderId: "185260973643",
  appId: "1:185260973643:web:71b036328fe4b91f8b77ce",
  measurementId: "G-BLQEZLP9H1"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const analytics = typeof window !== "undefined" ? getAnalytics(app) : null;

// Initialize Firebase AI Logic (Vertex AI)
// Using GoogleAIBackend for Gemini Developer API (free tier)
export const ai = getAI(app, { backend: new GoogleAIBackend() });
