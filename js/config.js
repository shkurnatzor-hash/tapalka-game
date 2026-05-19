/**
 * config.js
 * Все константы и настройки игры — меняешь здесь, всё остальное подхватывает автоматически
 */

export const CONFIG = {
  // Начальные значения
  INITIAL_SCORE: 0,
  INITIAL_MULTIPLIER: 1,
  MAX_MULTIPLIER: 1000,

  // Формула стоимости апгрейда
  UPGRADE_BASE_COST: 1000,
  UPGRADE_COST_POW: 2,

  // Загрузочный экран
  LOADER_DURATION_MS: 4000,

  // Анимация +coin
  COIN_ANIM_MS: 800,
  COIN_SPREAD_X: 40,
  COIN_SPREAD_Y: 20,

  // Музыка
  MUSIC_VOLUME: 0.5,

  // Firebase
FIREBASE: {
  apiKey: "AIzaSyD9p6m4wcz8Ax52doAhXqmvsE0eKO8kJ60",
  authDomain: "tapalkaatapalka-game.firebaseapp.com",
  databaseURL: "https://tapalkaatapalka-game-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "tapalkaatapalka-game",
  storageBucket: "tapalkaatapalka-game.firebasestorage.app",
  messagingSenderId: "901833127783",
  appId: "1:901833127783:web:c1bfe6a0775e4a978321c2"
},
  // Лидерборд
  LEADERBOARD_TOP_N: 20,

  LEADERBOARD_THROTTLE_MS: 5000
};