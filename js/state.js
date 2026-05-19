/**
 * state.js
 * Единственное место хранения состояния игры.
 * Все модули читают и пишут ТОЛЬКО через этот объект.
 */

import { CONFIG } from './config.js';
import { getCharById } from './characters.js';

const LS = {
  SCORE:      'svinkoiny_score',
  MULTIPLIER: 'svinkoiny_mult',
  CHARACTER:  'svinkoiny_char',
  NICKNAME:   'svinkoiny_nick',
};

function loadInt(key, fallback) {
  const v = parseInt(localStorage.getItem(key));
  return isNaN(v) ? fallback : v;
}

// ─── Состояние ────────────────────────────────────────────────────────────────
export const state = {
  score:      loadInt(LS.SCORE, CONFIG.INITIAL_SCORE),
  multiplier: loadInt(LS.MULTIPLIER, CONFIG.INITIAL_MULTIPLIER),
  charId:     localStorage.getItem(LS.CHARACTER) || 'barsuk',
  nickname:   localStorage.getItem(LS.NICKNAME)  || null,

  get char() { return getCharById(this.charId); },
};

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

export function saveNickname(nick) {
  state.nickname = nick;
  localStorage.setItem(LS.NICKNAME, nick);
}