/**
 * game.js  —  точка входа (ES-модуль) v3
 *
 * ИЗМЕНЕНИЯ v3:
 *  1. _bindSwipePrevention() — production-level защита от сворачивания
 *     Telegram Mini App при мультитаче:
 *       - Блокируем touchmove вне скроллируемых экранов
 *       - Блокируем мультитач (pinch, multi-finger swipe)
 *       - Вызываем Telegram.WebApp.disableVerticalSwipes() если доступно
 *       - Предотвращаем contextmenu/selection при долгом тапе
 *  2. _onCharSelect теперь проверяет purchasedSkins перед установкой персонажа
 *  3. refreshCharGridState() вызывается после выбора персонажа
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
  loadAndRenderLeaderboard,
  registerNick,
  changeNick,
  validateNick
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
  hideLoader,
  showNickModal,
  updateLbProfileUI
} from './ui.js';


// ─────────────────────────────────────────────────────────────
// ИНИЦИАЛИЗАЦИЯ
// ─────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  try {
    cacheDom();
    buildCharGrid(_onCharSelect);
    initRanks(DOM.rankEl, DOM.rankPopup);

    // ✅ FIX v3: Защита от сворачивания Telegram Mini App при мультитаче
    _bindSwipePrevention();

    // === FIREBASE ===
    const { db } = await import('./firebase-init.js');
    initLeaderboard(db, DOM.lbContainer);

    _renderAll();
    _bindEvents();

    // Инициализируем UI профиля (показывает текущий ник если есть)
    updateLbProfileUI();

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
});


// ─────────────────────────────────────────────────────────────
// SWIPE / MULTITOUCH PREVENTION
// ─────────────────────────────────────────────────────────────

/**
 * Production-level защита Telegram Mini App от случайного сворачивания.
 *
 * Проблема: при агрессивном мультитаче (3–4 пальца) браузер/Telegram
 * интерпретирует движение как vertical swipe и сворачивает Mini App.
 *
 * Решение — многоуровневая защита:
 *  1. Telegram WebApp API: disableVerticalSwipes() (Bot API 7.7+)
 *  2. CSS: overscroll-behavior: none (уже в style.css на html/body)
 *  3. JS: preventDefault на touchmove вне скроллируемых контейнеров
 *  4. JS: preventDefault на мультитач touchstart (pinch zoom = закрытие на iOS)
 *  5. Блокируем contextmenu (долгий тап → системное меню)
 *  6. Блокируем selectstart (выделение текста мешает тапам)
 */
function _bindSwipePrevention() {

  // ── 1. Telegram WebApp API ─────────────────────────────────────────────────
  try {
    const twa = window.Telegram?.WebApp;
    if (twa) {
      // disableVerticalSwipes — Bot API 7.7+ (не все версии Telegram имеют)
      if (typeof twa.disableVerticalSwipes === 'function') {
        twa.disableVerticalSwipes();
      }
      // Отключаем нативный swipe-to-close
      // (isClosingConfirmationEnabled = true показывает диалог вместо закрытия)
      // Не включаем — раздражает. Вместо этого блокируем события.
    }
  } catch (_) { /* не в Telegram — игнорируем */ }

  // ── 2. touchmove — блокируем везде кроме скроллируемых экранов ─────────────
  //
  // ВАЖНО: passive: false обязателен чтобы e.preventDefault() работал!
  // Без него браузер игнорирует preventDefault (оптимизация скролла).
  //
  // Разрешаем touchmove ТОЛЬКО внутри #upgradeScreen и #leaderboardScreen
  // (там нужен вертикальный скролл для карточек/рейтинга).
  //
  document.addEventListener('touchmove', _onDocTouchmove, { passive: false });

  // ── 3. Мультитач (2+ пальца) — блокируем всегда ───────────────────────────
  //
  // Мультитач = pinch zoom / two-finger swipe = сворачивание в Telegram.
  // Полностью предотвращаем это без исключений.
  //
  document.addEventListener('touchstart', _onDocTouchstart, { passive: false });

  // ── 4. Контекстное меню при долгом тапе ───────────────────────────────────
  //
  // На Android долгий тап открывает контекстное меню браузера.
  // Это прерывает игровой процесс и мешает быстрому тапу.
  //
  document.addEventListener('contextmenu', (e) => e.preventDefault(), { passive: false });

  // ── 5. Выделение текста ────────────────────────────────────────────────────
  //
  // user-select: none в CSS — основная защита,
  // но selectstart как запасной слой для IE/старых Webkit.
  //
  document.addEventListener('selectstart', (e) => e.preventDefault(), { passive: false });
}

/**
 * Handler touchmove.
 * Разрешает скролл внутри #upgradeScreen / #leaderboardScreen,
 * блокирует всё остальное.
 */
function _onDocTouchmove(e) {
  // Проверяем: идёт ли touch внутри скроллируемого контейнера?
  const target = e.target;

  if (target && typeof target.closest === 'function') {
    // #upgradeScreen и #leaderboardScreen — разрешаем pan-y (вертикальный скролл)
    const isInScrollable = target.closest('#upgradeScreen, #leaderboardScreen');
    if (isInScrollable) {
      // Разрешаем ТОЛЬКО одиночный тач (scroll), но не мультитач
      if (e.touches.length === 1) return;
    }
  }

  // Всё остальное — блокируем (игровая зона, меню, персонаж)
  e.preventDefault();
}

/**
 * Handler touchstart.
 * Блокирует мультитач (pinch/swipe) — главная причина сворачивания Telegram.
 */
function _onDocTouchstart(e) {
  if (e.touches.length > 1) {
    e.preventDefault();
  }
}


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
    updateLbProfileUI();
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

  // ── REFRESH LB ──
  document
    .getElementById('lbRefreshBtn')
    ?.addEventListener('click', loadAndRenderLeaderboard);

  // ── NICK MODAL — делегированный обработчик для динамических кнопок ──
  document.addEventListener('click', (e) => {
    if (e.target.id === 'lbSetNickBtn' || e.target.id === 'lbChangeNickBtn') {
      showNickModal(state.nickname, _onNickSubmit);
    }
  });
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
// NICKNAME SUBMIT (вызывается из modal в ui.js)
// ─────────────────────────────────────────────────────────────

/**
 * Callback из модального окна выбора/смены ника.
 * @param {string} rawNick — введённый пользователем ник
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
async function _onNickSubmit(rawNick) {
  const oldNick = state.nickname;
  const isChange = !!oldNick;

  let result;

  if (isChange) {
    result = await changeNick(rawNick, oldNick);
  } else {
    result = await registerNick(rawNick);
  }

  if (!result.ok) {
    return result; // modal покажет ошибку
  }

  // Сохраняем в state + localStorage
  saveNickname(result.nick, result.normKey);

  // Обновляем UI профиля в leaderboard
  updateLbProfileUI();

  // Немедленно синхронизируем счёт
  forceSendScore();

  // Обновляем таблицу
  loadAndRenderLeaderboard();

  const verb = isChange ? 'Ник изменён' : 'Ник сохранён';
  showToast(`${verb}: ${result.nick} 👑`);
  playSfx('./assets/sounds/rankup.mp3');

  return { ok: true };
}
