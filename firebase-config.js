// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, onValue, set, update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-analytics.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyB0suD1WtscodYWjfTtiJr8mSSgnmZiMs0",
  authDomain: "esp32-giamsatchatluongkhongkhi.firebaseapp.com",
  databaseURL: "https://esp32-giamsatchatluongkhongkhi-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "esp32-giamsatchatluongkhongkhi",
  storageBucket: "esp32-giamsatchatluongkhongkhi.firebasestorage.app",
  messagingSenderId: "272142145490",
  appId: "1:272142145490:web:e98daece8a1ef9d1ea5a0b",
  measurementId: "G-MJPYK9PBX1"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const database = getDatabase(app);

export { database, ref, onValue, set, update };

