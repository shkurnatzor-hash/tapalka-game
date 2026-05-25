/**
 * leaderboard.js — v3 (Unique Nicknames + Nick Change)
 *
 * АРХИТЕКТУРА УНИКАЛЬНЫХ НИКОВ:
 * ──────────────────────────────────────────────────────────────────────────────
 *  Firebase Realtime DB используется как "backend" с двумя узлами:
 *
 *  1. leaderboard/{nickKey}   — данные игрока (nick, score, ts)
 *  2. nicknames_index/{normKey} — индекс уникальности: normKey → nickKey
 *
 *  normKey = нормализованный ник (lowercase + trim + unicode-normalize)
 *  nickKey = Firebase-safe вариант нормализованного ника
 *
 *  Регистрация через Firebase Transaction — атомарная операция:
 *    - Читаем nicknames_index/{normKey}
 *    - Если занято → abort → возвращаем { taken: true }
 *    - Если свободно → записываем → создаём leaderboard-запись
 *  Это защищает от race condition при одновременной регистрации.
 *
 * СМЕНА НИКА:
 * ──────────────────────────────────────────────────────────────────────────────
 *  1. Проверяем новый ник через тот же transaction-механизм
 *  2. Удаляем старую запись из nicknames_index + leaderboard (перенос счёта!)
 *  3. Создаём новую запись с тем же счётом
 * ──────────────────────────────────────────────────────────────────────────────
 */

import { CONFIG } from './config.js';
import { state, saveNickname } from './state.js';

let _db        = null;
let _container = null;
let _lastSend  = 0;

export function initLeaderboard(firebaseDatabase, containerEl) {
  _db        = firebaseDatabase;
  _container = containerEl;
  console.log('Leaderboard v3 init OK');
}

// ─────────────────────────────────────────────────────────────────────────────
// NICK NORMALIZATION
// Единая функция для клиента и "сервера" (Firebase rules не умеют JS,
// поэтому нормализация — на клиенте, но применяется до записи в индекс).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Нормализует ник для сравнения уникальности:
 *  - trim()
 *  - toLowerCase()
 *  - Unicode NFC normalize (ё vs е, и vs й и т.д.)
 *  - collapse multiple spaces → single space
 *  - Удаляем управляющие символы и zero-width characters (антиспам)
 * @param {string} nick
 * @returns {string}
 */
export function normalizeNick(nick) {
  return String(nick)
    .normalize('NFC')                    // Unicode-нормализация
    .replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200D\uFEFF]/g, '') // control + ZWS
    .replace(/\s+/g, ' ')               // multiple spaces → single
    .trim()
    .toLowerCase();
}

/**
 * Конвертирует нормализованный ник в Firebase-safe ключ.
 * Firebase запрещает: . # $ [ ] /
 * @param {string} normalizedNick
 * @returns {string}
 */
export function nickToKey(normalizedNick) {
  return normalizedNick
    .replace(/[.#$[\]/]/g, '_')
    .slice(0, 40);
}

// ─────────────────────────────────────────────────────────────────────────────
// NICK VALIDATION (client-side, быстрая проверка до запроса к Firebase)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @returns {{ ok: boolean, error?: string }}
 */
export function validateNick(raw) {
  const nick = String(raw ?? '');

  if (!nick.trim()) {
    return { ok: false, error: 'Ник не может быть пустым' };
  }

  const normalized = normalizeNick(nick);

  if (normalized.length < 2) {
    return { ok: false, error: 'Ник слишком короткий (минимум 2 символа)' };
  }

  if (normalized.length > 20) {
    return { ok: false, error: 'Ник слишком длинный (максимум 20 символов)' };
  }

  // Запрещаем ники из одних спецсимволов
  if (!/[a-zA-Zа-яёА-ЯЁ0-9]/.test(normalized)) {
    return { ok: false, error: 'Ник должен содержать буквы или цифры' };
  }

  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// REGISTER NICK (Firebase Transaction — atomic, race-condition safe)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Регистрирует новый ник в Firebase.
 * Использует runTransaction для атомарного захвата имени.
 *
 * @param {string} rawNick  — ник введённый пользователем (не нормализован)
 * @returns {Promise<{ ok: boolean, error?: string, nick?: string }>}
 */
export async function registerNick(rawNick) {
  const validation = validateNick(rawNick);
  if (!validation.ok) return validation;

  const displayNick = rawNick.trim();           // отображаем как ввёл, но trim
  const normKey     = nickToKey(normalizeNick(rawNick));

  try {
    const fb = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js');
    const { ref, runTransaction, set } = fb;

    const indexRef = ref(_db, `nicknames_index/${normKey}`);

    // Атомарная проверка и резервирование
    const result = await runTransaction(indexRef, (current) => {
      if (current !== null) {
        // Ник уже занят — abort transaction
        return undefined; // undefined = abort
      }
      // Резервируем: записываем nickKey в индекс
      return { nick: displayNick, ts: Date.now() };
    });

    if (!result.committed) {
      return { ok: false, error: 'Этот ник уже занят 😔' };
    }

    // Транзакция прошла → создаём leaderboard-запись
    const lbRef = ref(_db, `leaderboard/${normKey}`);
    await set(lbRef, {
      nick:  displayNick,
      score: Math.max(state.score || 0, 0),
      ts:    Date.now()
    });

    return { ok: true, nick: displayNick, normKey };

  } catch (e) {
    console.error('registerNick error:', e);
    return { ok: false, error: 'Ошибка сети, попробуй ещё раз' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CHANGE NICK
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Меняет ник игрока:
 *  1. Проверяет уникальность нового ника через transaction
 *  2. Переносит счёт на новый ключ
 *  3. Удаляет старые записи из leaderboard + nicknames_index
 *
 * @param {string} rawNewNick
 * @param {string} oldNick  — текущий ник (для удаления старой записи)
 * @returns {Promise<{ ok: boolean, error?: string, nick?: string }>}
 */
export async function changeNick(rawNewNick, oldNick) {
  const validation = validateNick(rawNewNick);
  if (!validation.ok) return validation;

  const displayNick = rawNewNick.trim();
  const newNormKey  = nickToKey(normalizeNick(rawNewNick));
  const oldNormKey  = nickToKey(normalizeNick(oldNick || ''));

  // Нет смысла менять на тот же самый ник
  if (newNormKey === oldNormKey) {
    return { ok: false, error: 'Это уже твой текущий ник' };
  }

  try {
    const fb = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js');
    const { ref, runTransaction, set, remove, get } = fb;

    const newIndexRef = ref(_db, `nicknames_index/${newNormKey}`);

    // Атомарно резервируем новое имя
    const result = await runTransaction(newIndexRef, (current) => {
      if (current !== null) return undefined; // занято → abort
      return { nick: displayNick, ts: Date.now() };
    });

    if (!result.committed) {
      return { ok: false, error: 'Этот ник уже занят 😔' };
    }

    // Получаем текущий счёт из старой записи (он мог вырасти)
    let currentScore = Math.max(state.score || 0, 0);
    try {
      const oldSnap = await get(ref(_db, `leaderboard/${oldNormKey}`));
      if (oldSnap.exists()) {
        const data = oldSnap.val();
        currentScore = Math.max(data.score || 0, currentScore);
      }
    } catch (_) {}

    // Создаём новую leaderboard-запись с перенесённым счётом
    await set(ref(_db, `leaderboard/${newNormKey}`), {
      nick:  displayNick,
      score: currentScore,
      ts:    Date.now()
    });

    // Удаляем старые записи (если старый ник был зарегистрирован)
    if (oldNormKey && oldNormKey !== newNormKey) {
      try {
        await remove(ref(_db, `leaderboard/${oldNormKey}`));
        await remove(ref(_db, `nicknames_index/${oldNormKey}`));
      } catch (_) {
        console.warn('Could not remove old nick records (not critical)');
      }
    }

    return { ok: true, nick: displayNick, normKey: newNormKey };

  } catch (e) {
    console.error('changeNick error:', e);
    return { ok: false, error: 'Ошибка сети, попробуй ещё раз' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SCORE SYNC
// ─────────────────────────────────────────────────────────────────────────────

export function throttledSendScore() {
  if (!_db || !state.nickname) return;
  const now = Date.now();
  if (now - _lastSend < (CONFIG.LEADERBOARD_THROTTLE_MS || 5000)) return;
  _lastSend = now;
  _sendScore();
}

export function forceSendScore() {
  if (!_db || !state.nickname) return;
  _lastSend = Date.now();
  _sendScore();
}

async function _sendScore() {
  try {
    const fb = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js');
    const { ref, set } = fb;

    const normKey = nickToKey(normalizeNick(state.nickname));

    await set(ref(_db, `leaderboard/${normKey}`), {
      nick:  state.nickname,
      score: Math.max(state.score || 0, 0),
      ts:    Date.now()
    });
  } catch (e) {
    console.error('Send score error:', e);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LOAD & RENDER
// ─────────────────────────────────────────────────────────────────────────────

export async function loadAndRenderLeaderboard() {
  if (!_container) return;

  _container.innerHTML = '<p class="lb-empty">⏳ Загружаем рейтинг...</p>';

  try {
    const fb = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js');
    const { ref, query, orderByChild, limitToLast, get } = fb;

    const q    = query(ref(_db, 'leaderboard'), orderByChild('score'), limitToLast(50));
    const snap = await get(q);

    const entries = [];
    snap.forEach(child => {
      const v = child.val();
      if (v && (v.nick || v.name) && typeof v.score === 'number') {
        entries.push({
          nick:  v.nick || v.name || 'Без имени',
          score: v.score,
          ts:    v.ts || 0
        });
      }
    });

    entries.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.ts - b.ts;
    });

    _render(entries.slice(0, CONFIG.LEADERBOARD_TOP_N || 20));

  } catch (e) {
    console.error('Load error:', e);
    _container.innerHTML = `<p class="lb-empty">❌ Ошибка загрузки: ${e.message}</p>`;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// RENDER TABLE
// ─────────────────────────────────────────────────────────────────────────────

function _render(entries) {
  if (!_container) return;

  if (!entries || entries.length === 0) {
    _container.innerHTML = '<p class="lb-empty">Рейтинг пока пуст — стань первым! 🐽</p>';
    return;
  }

  const medals = ['🥇', '🥈', '🥉'];
  const myNick  = state.nickname || null;

  let html = '<div class="lb-list">';

  entries.forEach((e, i) => {
    const place    = i + 1;
    const placeStr = medals[i] ?? `${place}.`;
    const score    = Number(e.score || 0).toLocaleString('ru-RU');
    const nick     = _escapeHtml(e.nick || 'Без имени');
    const isMe     = myNick && normalizeNick(e.nick) === normalizeNick(myNick);

    const topClass = place <= 3 ? ` lb-top-${place}` : '';
    const meClass  = isMe ? ' lb-me' : '';

    const coinIcon = `<img class="lb-coin-icon" src="./assets/images/govno.png" alt="coin">`;

    html += `
      <div class="lb-row${topClass}${meClass}" data-place="${place}">
        <span class="lb-pos">${placeStr}</span>
        <span class="lb-nick">${nick}${isMe ? ' <span class="lb-you">you</span>' : ''}</span>
        <span class="lb-score">${score} ${coinIcon}</span>
      </div>`;
  });

  html += '</div>';
  _container.innerHTML = html;
}

function _escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
