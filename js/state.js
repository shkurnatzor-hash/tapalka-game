/**
 * state.js — v3 (Unique Nicknames support)
 *
 * ИЗМЕНЕНИЯ v3:
 *  - Убрана жёсткая блокировка ника (nick_locked) — теперь ник можно менять
 *  - Добавлен LS.NICK_KEY — нормализованный ключ текущего ника (для Firebase)
 *  - saveNickname(nick, key) теперь сохраняет и displayNick и normKey
 */

import { CONFIG }      from './config.js';
import { getCharById } from './characters.js';

const LS = {
  SCORE:      'svinkoiny_score',
  MULTIPLIER: 'svinkoiny_mult',
  CHARACTER:  'svinkoiny_char',
  NICKNAME:   'svinkoiny_nick',
  NICK_KEY:   'svinkoiny_nick_key',  // нормализованный Firebase-ключ ника
  SKINS:      'svinkoiny_skins',
};

function loadInt(key, fallback) {
  const v = parseInt(localStorage.getItem(key));
  return isNaN(v) ? fallback : v;
}

function loadSkins() {
  try {
    const raw = localStorage.getItem(LS.SKINS);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.length > 0) {
        // barsuk всегда должен быть разблокирован
        if (!arr.includes('barsuk')) arr.unshift('barsuk');
        return arr;
      }
    }
  } catch (_) {}
  return ['barsuk']; // default для новых игроков
}

// ─── Состояние ────────────────────────────────────────────────────────────────
export const state = {
  score:          loadInt(LS.SCORE, CONFIG.INITIAL_SCORE),
  multiplier:     loadInt(LS.MULTIPLIER, CONFIG.INITIAL_MULTIPLIER),
  charId:         localStorage.getItem(LS.CHARACTER) || 'barsuk',
  nickname:       localStorage.getItem(LS.NICKNAME)  || null,
  nickKey:        localStorage.getItem(LS.NICK_KEY)  || null, // Firebase-ключ (нормализован)
  purchasedSkins: loadSkins(),

  get char() { return getCharById(this.charId); },
};

// Edge case: сохранённый персонаж ещё не куплен (например, до введения системы покупок)
// → сбрасываем на barsuk чтобы не показывать неоплаченный скин
if (!state.purchasedSkins.includes(state.charId)) {
  state.charId = 'barsuk';
  localStorage.setItem(LS.CHARACTER, 'barsuk');
}

// ─── Мутаторы ─────────────────────────────────────────────────────────────────
export function addScore(amount) {
  state.score += amount;
  localStorage.setItem(LS.SCORE, state.score);
}

export function setMultiplier(value) {
  state.multiplier = value;
  localStorage.setItem(LS.MULTIPLIER, value);
}

export function setCharacter(id) {
  state.charId = id;
  localStorage.setItem(LS.CHARACTER, id);
}

export function spendScore(amount) {
  if (state.score < amount) return false;
  state.score -= amount;
  localStorage.setItem(LS.SCORE, state.score);
  return true;
}

export function saveNickname(nick, normKey) {
  state.nickname = nick;
  localStorage.setItem(LS.NICKNAME, nick);
  if (normKey !== undefined) {
    state.nickKey = normKey;
    localStorage.setItem(LS.NICK_KEY, normKey ?? '');
  }
}

/**
 * Купить скин.
 * Списывает монеты по цене из characters.js (char.price).
 * @returns {boolean} true — куплен успешно / уже был куплен; false — не хватает монет
 */
export function purchaseSkin(charId) {
  // Уже куплен — идемпотентно возвращаем true
  if (state.purchasedSkins.includes(charId)) return true;

  const char  = getCharById(charId);
  const price = char?.price ?? 50;

  // Проверяем баланс и списываем
  if (!spendScore(price)) return false;

  // Разблокируем и сохраняем
  state.purchasedSkins.push(charId);
  localStorage.setItem(LS.SKINS, JSON.stringify(state.purchasedSkins));
  return true;
}
