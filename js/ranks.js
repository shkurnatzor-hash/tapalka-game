/**
 * ranks.js
 * Система рангов: определение, обновление, анимация.
 */

import { state } from './state.js';
import { playSfx } from './sound.js';

export const RANK_LEVELS = [
  { score: 0,        title: 'Праскуриот 🤵🏿‍♂️' },
  { score: 100,      title: 'Потный свин 🐷'    },
  { score: 1_000,    title: 'Свино Фермер 👨‍🌾'  },
  { score: 10_000,   title: 'Максвин 💰'        },
  { score: 100_000,  title: 'Макс Максбетов 🏦' },
  { score: 1_000_000,title: 'Свинолорд 👑'      },
];

let _currentRankIndex = _calcRankIndex(state.score);

// DOM-элементы (инжектируются при init)
let _rankEl   = null;
let _popupEl  = null;
let _flashEl  = null;

export function initRanks(rankEl, popupEl) {
  _rankEl  = rankEl;
  _popupEl = popupEl;

  // Flash overlay (создаём один раз)
  _flashEl = document.createElement('div');
  Object.assign(_flashEl.style, {
    position:     'fixed',
    top:          '0',
    left:         '0',
    width:        '100vw',
    height:       '100vh',
    background:   'radial-gradient(circle, rgba(255,255,200,.6), transparent 70%)',
    opacity:      '0',
    pointerEvents:'none',
    transition:   'opacity .4s ease',
    zIndex:       '9990',
  });
  document.body.appendChild(_flashEl);

  _render();
}

export function updateRank() {
  const newIdx = _calcRankIndex(state.score);
  _render(newIdx);

  if (newIdx > _currentRankIndex) {
    _currentRankIndex = newIdx;
    _celebrate(newIdx);
  }
}

// ─── Приватное ────────────────────────────────────────────────────────────────

function _calcRankIndex(score) {
  let idx = 0;
  for (let i = 0; i < RANK_LEVELS.length; i++) {
    if (score >= RANK_LEVELS[i].score) idx = i;
  }
  return idx;
}

function _render(idx = _currentRankIndex) {
  if (_rankEl) _rankEl.textContent = 'Ранг: ' + RANK_LEVELS[idx].title;
}

function _celebrate(idx) {
  if (!_popupEl) return;

  _popupEl.textContent = '🎉 Новый ранг: ' + RANK_LEVELS[idx].title;
  _popupEl.classList.remove('hidden');
  _popupEl.classList.add('show');

  playSfx('rankup.mp3');
  navigator.vibrate?.([200, 100, 200]);

  if (_flashEl) {
    _flashEl.style.opacity = '1';
    setTimeout(() => { _flashEl.style.opacity = '0'; }, 600);
  }

  setTimeout(() => _popupEl.classList.remove('show'),   2000);
  setTimeout(() => _popupEl.classList.add('hidden'),    2600);
}