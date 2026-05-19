import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import * as firebaseDB from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

import { CONFIG } from "./config.js";

const app = initializeApp(CONFIG.FIREBASE);
const db = firebaseDB.getDatabase(app);

window._firebaseDB = firebaseDB;   // важно!

export { db };