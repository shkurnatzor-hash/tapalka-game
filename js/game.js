/**
 * game.js  —  точка входа (ES-модуль) v3
 *
 * ИЗМЕНЕНИЯ v3:
 *  1. _initTelegramSwipeLock() — production-fix для сворачивания Telegram Mini App
 *     при мультитаче: блокирует overscroll/swipe-to-dismiss на всех уровнях DOM
 *  2. Multitouch-safe tap handler: обрабатывает все одновременные касания
 *  3. Telegram.WebApp.disableVerticalSwipes() + expand() при запуске
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
    _initTelegramSwipeLock(); // ← ПЕРВЫМ: блокируем свайп до любых событий
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
// TAP  (multitouch-safe)
// ─────────────────────────────────────────────────────────────

/**
 * Набор активных pointerIds — позволяет регистрировать каждый палец ровно один раз
 * и не дублировать addScore при повторных pointermove/поinterup.
 */
const _activePointers = new Set();

function _onTap(e) {
  e.preventDefault(); // блокирует системный зум и браузерный scroll при мультитаче

  // Мультитач: каждый pointerId обрабатывается ровно один раз (при pointerdown)
  if (_activePointers.has(e.pointerId)) return;
  _activePointers.add(e.pointerId);

  // Очищаем после отпускания пальца
  const cleanup = (up) => {
    if (up.pointerId === e.pointerId) {
      _activePointers.delete(e.pointerId);
      DOM.characterWrapper?.removeEventListener('pointerup',     cleanup);
      DOM.characterWrapper?.removeEventListener('pointercancel', cleanup);
      document.removeEventListener('pointerup',     cleanup);
      document.removeEventListener('pointercancel', cleanup);
    }
  };
  // Слушаем и на characterWrapper и на document — палец может съехать за пределы элемента
  DOM.characterWrapper?.addEventListener('pointerup',     cleanup, { once: false });
  DOM.characterWrapper?.addEventListener('pointercancel', cleanup, { once: false });
  document.addEventListener('pointerup',     cleanup, { once: false });
  document.addEventListener('pointercancel', cleanup, { once: false });

  const x = e.clientX;
  const y = e.clientY;

  addScore(state.multiplier);
  renderCounter();
  spawnCoinBurst(x, y, state.multiplier);
  animateTap();
  playCharVideo();

  updateRank();

  startMusicOnce(state.char.music);
  throttledSendScore();
}


// ─────────────────────────────────────────────────────────────
// TELEGRAM SWIPE LOCK  (production-ready, iOS + Android)
// ─────────────────────────────────────────────────────────────

/**
 * Полностью блокирует свайп-to-dismiss Telegram Mini App при интенсивном мультитаче.
 *
 * Стратегия (многослойная защита):
 *  1. Telegram WebApp API  — disableVerticalSwipes() + expand() (официальный способ)
 *  2. CSS                  — touch-action: none + overscroll-behavior: none (уже в style.css)
 *  3. JS touchmove         — preventDefault на document (passive: false) блокирует
 *                            нативный scroll/overscroll WebView
 *  4. JS touchstart        — preventDefault предотвращает инициацию свайпа
 *  5. gesturestart/change  — блокирует iOS pinch-zoom gesture (Safari-специфично)
 *  6. contextmenu          — блокирует долгое нажатие → контекстное меню → лаг
 *  7. selectstart          — отключает выделение текста (вызывает "залипание" на Android)
 */
function _initTelegramSwipeLock() {
  // ── 1. Telegram WebApp API ───────────────────────────────────────────────
  try {
    const tg = window.Telegram?.WebApp;
    if (tg) {
      // Разворачиваем на весь экран — убирает зону свайпа в шапке
      tg.expand?.();
      // Официальный метод отключения вертикального свайпа (Bot API 7.7+)
      tg.disableVerticalSwipes?.();
      // Отключаем кнопку закрытия жестом (если поддерживается)
      tg.setHeaderColor?.('#000000');
    }
  } catch (_) {}

  // ── 2. Блокируем touchmove на всём document (passive: false обязателен) ─
  const blockTouchMove = (e) => {
    // Разрешаем scroll внутри overflow-scroll элементов (leaderboard, upgrade screen)
    if (_isScrollableTarget(e.target)) return;
    // Блокируем всё остальное — это и есть свайп-to-dismiss
    if (e.cancelable) e.preventDefault();
  };

  document.addEventListener('touchmove', blockTouchMove, { passive: false });

  // ── 3. Блокируем touchstart с несколькими касаниями ─────────────────────
  // При 2+ пальцах Telegram может интерпретировать движение как dismiss-жест
  document.addEventListener('touchstart', (e) => {
    if (e.touches.length > 1) {
      if (e.cancelable) e.preventDefault();
    }
  }, { passive: false });

  // ── 4. iOS Safari: блокируем pinch-zoom gesture ──────────────────────────
  document.addEventListener('gesturestart',  (e) => e.preventDefault(), { passive: false });
  document.addEventListener('gesturechange', (e) => e.preventDefault(), { passive: false });
  document.addEventListener('gestureend',    (e) => e.preventDefault(), { passive: false });

  // ── 5. Блокируем контекстное меню (долгое нажатие) ───────────────────────
  document.addEventListener('contextmenu', (e) => e.preventDefault());

  // ── 6. Блокируем выделение текста ────────────────────────────────────────
  document.addEventListener('selectstart', (e) => e.preventDefault());

  // ── 7. Блокируем колёсный скролл на игровом обёртке ─────────────────────
  document.getElementById('gameWrap')?.addEventListener('wheel', (e) => {
    e.preventDefault();
  }, { passive: false });
}

/**
 * Проверяет, является ли элемент или его предок скроллируемым контейнером.
 * Это позволяет пользователю скроллить leaderboard и upgrade screen,
 * при этом блокируя системный dismiss-свайп.
 *
 * @param {EventTarget} target
 * @returns {boolean}
 */
function _isScrollableTarget(target) {
  let el = target;
  const scrollableIds = new Set(['upgradeScreen', 'leaderboardScreen', 'charSelect', 'lbContainer']);

  while (el && el !== document.body) {
    if (el.id && scrollableIds.has(el.id)) return true;
    // Проверяем overflow-y через computed style (для динамических элементов)
    try {
      const style = window.getComputedStyle(el);
      const overflowY = style.overflowY;
      if ((overflowY === 'scroll' || overflowY === 'auto') && el.scrollHeight > el.clientHeight) {
        return true;
      }
    } catch (_) {}
    el = el.parentElement;
  }
  return false;
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
