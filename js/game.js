/**
 * game.js  —  точка входа (ES-модуль) v2
 *
 * ИЗМЕНЕНИЯ v2:
 *  1. _onCharSelect теперь проверяет purchasedSkins перед установкой персонажа
 *     (защита на случай прямого вызова с незакрытым скином)
 *  2. refreshCharGridState() вызывается после выбора персонажа
 *  3. Импорты обновлены (purchaseSkin удалён — теперь только в ui.js)
 */

import { CONFIG } from './config.js';

import {
  state,
  addScore,
  setMultiplier,
  spendScore,
  setCharacter,
  saveNickname
} from './state.js';

import {
  startMusicOnce,
  changeTrack,
  playSfx
} from './sound.js';

import {
  initRanks,
  updateRank
} from './ranks.js';

import {
  initLeaderboard,
  throttledSendScore,
  forceSendScore,
  loadAndRenderLeaderboard
} from './leaderboard.js';

import {
  DOM,
  cacheDom,
  renderCounter,
  spawnCoinBurst,
  renderCharacter,
  animateTap,
  playCharVideo,
  showTab,
  renderUpgradeBtn,
  upgradeCost,
  showToast,
  buildCharGrid,
  refreshCharGridState,
  hideLoader
} from './ui.js';


// ─────────────────────────────────────────────────────────────
// ИНИЦИАЛИЗАЦИЯ
// ─────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  try {
    cacheDom();
    buildCharGrid(_onCharSelect);
    initRanks(DOM.rankEl, DOM.rankPopup);

    // === FIREBASE ===
    const { db } = await import('./firebase-init.js');
    initLeaderboard(db, DOM.lbContainer);

    _renderAll();
    _bindEvents();

    setTimeout(() => hideLoader(), CONFIG.LOADER_DURATION_MS || 2500);

    // Safety fallback
    setTimeout(() => {
      const loader = document.getElementById('loader');
      if (loader) loader.style.display = 'none';
    }, 5000);

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) forceSendScore();
    });

  } catch (err) {
    console.error('GAME INIT ERROR:', err);
    const loader = document.getElementById('loader');
    if (loader) loader.style.display = 'none';
  }

  // Блокировка ника после первого сохранения
  if (localStorage.getItem('svinkoiny_nick_locked') === 'true' && DOM.lbSaveBtn) {
    DOM.lbSaveBtn.disabled = true;
  }
});


// ─────────────────────────────────────────────────────────────
// RENDER
// ─────────────────────────────────────────────────────────────

function _renderAll() {
  renderCounter();
  renderCharacter();
  renderUpgradeBtn();
  updateRank();
}


// ─────────────────────────────────────────────────────────────
// EVENTS
// ─────────────────────────────────────────────────────────────

function _bindEvents() {

  // ── ТАП ──
  DOM.characterWrapper?.addEventListener(
    'pointerdown',
    _onTap,
    { passive: false }
  );

  // ── MENU ──
  DOM.menuBtns?.[0]?.addEventListener('click', () => showTab('upgrade'));
  DOM.menuBtns?.[1]?.addEventListener('click', () => showTab('game'));
  DOM.menuBtns?.[2]?.addEventListener('click', () => {
    showTab('leaderboard');
    loadAndRenderLeaderboard();
  });

  // ── TABS ──
  DOM.upgradeTabs?.forEach(tab => {
    tab.addEventListener('click', () => {
      DOM.upgradeTabs.forEach(t => t.classList.remove('active'));
      DOM.upgradeContents.forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      document
        .getElementById('upgradeContent-' + tab.dataset.target)
        ?.classList.add('active');
    });
  });

  // ── UPGRADE ──
  DOM.upgradeBtn?.addEventListener('click', _onUpgrade);

  // ── NICKNAME ──
  DOM.lbSaveBtn?.addEventListener('click', _onSaveNick);
  DOM.lbNickInput?.addEventListener('keydown', e => {
    if (e.key === 'Enter') _onSaveNick();
  });

  // ── REFRESH LB ──
  document
    .getElementById('lbRefreshBtn')
    ?.addEventListener('click', loadAndRenderLeaderboard);
}


// ─────────────────────────────────────────────────────────────
// TAP
// ─────────────────────────────────────────────────────────────

function _onTap(e) {
  e.preventDefault(); // блокирует системный зум при частом тапе

  const x = e.clientX;
  const y = e.clientY;

  addScore(state.multiplier);
  renderCounter();
  spawnCoinBurst(x, y, state.multiplier);
  animateTap();
  playCharVideo();

  updateRank();

  // Запускаем музыку при первом взаимодействии (политика браузеров)
  startMusicOnce(state.char.music);

  throttledSendScore();
}


// ─────────────────────────────────────────────────────────────
// UPGRADE
// ─────────────────────────────────────────────────────────────

function _onUpgrade() {
  if (state.multiplier >= CONFIG.MAX_MULTIPLIER) return;

  const cost = upgradeCost(state.multiplier);

  if (!spendScore(cost)) {
    showToast('Недостаточно свинкойнов! 🐷');
    return;
  }

  setMultiplier(state.multiplier + 1);
  renderCounter();
  renderUpgradeBtn();
  showToast(`✅ Теперь 1 тап = ${state.multiplier} 🐷`);
  playSfx('./assets/sounds/rankup.mp3');
  updateRank();
}


// ─────────────────────────────────────────────────────────────
// CHARACTER SELECT (только для уже купленных)
// ─────────────────────────────────────────────────────────────

function _onCharSelect(charId) {
  // Защита: нельзя выбрать незакупленный персонаж
  if (!state.purchasedSkins.includes(charId)) {
    showToast('Сначала купи этого персонажа! 🔒');
    return;
  }

  setCharacter(charId);
  changeTrack(state.char.music);
  renderCharacter();       // внутри вызывает refreshCharGridState()
  updateRank();
  showToast(`Выбран: ${state.char.name}`);
}


// ─────────────────────────────────────────────────────────────
// NICKNAME
// ─────────────────────────────────────────────────────────────

function _onSaveNick() {
  const nick = DOM.lbNickInput?.value.trim();

  if (!nick || nick.length < 2) {
    showToast('Введи ник (минимум 2 символа)');
    return;
  }

  if (nick.length > 20) {
    showToast('Ник слишком длинный (макс 20)');
    return;
  }

  const alreadyHasNick = localStorage.getItem('svinkoiny_nick_locked') === 'true';
  if (alreadyHasNick) {
    showToast('Ник уже закреплён навсегда!');
    return;
  }

  saveNickname(nick);

  localStorage.setItem('svinkoiny_nick_locked', 'true');

  forceSendScore();
  showToast(`Ник закреплён навсегда: ${nick} 👑`);

  if (DOM.lbNickInput) {
    DOM.lbNickInput.disabled = true;
    DOM.lbNickInput.value    = nick;
  }

  if (DOM.lbSaveBtn) DOM.lbSaveBtn.disabled = true;

  loadAndRenderLeaderboard();
}
