import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getDatabase,
  ref,
  set,
  get,
  child
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

import { CONFIG } from "./config.js";

const app = initializeApp(CONFIG.FIREBASE);

export const db = getDatabase(app);

export async function saveScore(name, score) {
  await set(ref(db, "leaderboard/" + name), {
    name,
    score,
    updatedAt: Date.now()
  });
}

export async function loadLeaderboard() {
  const snapshot = await get(child(ref(db), "leaderboard"));

  if (!snapshot.exists()) {
    return [];
  }

  return Object.values(snapshot.val())
    .sort((a, b) => b.score - a.score)
    .slice(0, CONFIG.LEADERBOARD_TOP_N);
}