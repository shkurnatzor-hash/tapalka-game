/**
 * ui.js — v3 (Skin Purchase System + TAP ANIMATION v2)
 *
 * ИЗМЕНЕНИЯ v3:
 *  1. buildCharGrid() — полная система покупки/выбора скинов:
 *       - LOCKED: серая карточка + цена + кнопка "🔒 N 🐷"
 *       - OWNED:  кнопка "Выбрать"
 *       - ACTIVE: бейдж "✓ Выбран"
 *  2. _renderCharCards() + refreshCharGridState() — rebuild без перенастройки
 *     listeners на категории
 *  3. _handleBuy() — purchase flow: списание монет, анимация, обновление грида
 *  4. renderCharacter() теперь вызывает refreshCharGridState()
 *  5. Импорт purchaseSkin + playSfx
 *
 * СОХРАНЕНО из v2:
 *  - animateTap() ultra-responsive (CSS keyframes + forced reflow)
 *  - playCharVideo() для совместимости
 *  - renderCharacter(), renderCounter(), spawnCoinBurst() без изменений
 *  - showTab(), renderUpgradeBtn(), showToast(), hideLoader()
 */

import { state, purchaseSkin }  from './state.js';
import { CONFIG }                from './config.js';
import { CHARACTERS }            from './characters.js';
import { playSfx }               from './sound.js';

// ─── Кэш DOM ──────────────────────────────────────────────────────────────────
export const DOM = {};

export function cacheDom() {
  DOM.counterNumber    = document.getElementById('counterNumber');
  DOM.counterImg       = document.getElementById('counterImg');
  DOM.characterWrapper = document.getElementById('characterWrapper');
  DOM.charImg          = document.getElementById('charImg');
  DOM.charVideo        = document.getElementById('charVideo');
  DOM.counter          = document.getElementById('counter');
  DOM.gameWrap         = document.getElementById('gameWrap');
  DOM.upgradeScreen    = document.getElementById('upgradeScreen');
  DOM.leaderboardScreen= document.getElementById('leaderboardScreen');
  DOM.rankEl           = document.getElementById('rank');
  DOM.rankPopup        = document.getElementById('rankPopup');
  DOM.upgradeBtn       = document.getElementById('upgradeBtn');
  DOM.upgradeMsg       = document.getElementById('upgradeMsg');
  DOM.charSelectWrap   = document.getElementById('charSelect');
  DOM.lbContainer      = document.getElementById('lbContainer');
  DOM.lbNickInput      = document.getElementById('lbNickInput');
  DOM.lbSaveBtn        = document.getElementById('lbSaveBtn');
  DOM.menuBtns         = Array.from(document.querySelectorAll('.menuBtn'));
  DOM.upgradeTabs      = Array.from(document.querySelectorAll('.upgradeTab'));
  DOM.upgradeContents  = Array.from(document.querySelectorAll('.upgradeContent'));
  DOM.loader           = document.getElementById('loader');
  DOM.skinCategoryBtns = Array.from(document.querySelectorAll('.skinCatBtn'));
  DOM.skinPlaceholder  = document.getElementById('skinPlaceholder');

  // GPU-hint
  if (DOM.characterWrapper) {
    DOM.characterWrapper.style.willChange = 'transform';
  }
}

// ─── Счётчик ──────────────────────────────────────────────────────────────────
export function renderCounter() {
  if (DOM.counterNumber) {
    DOM.counterNumber.textContent = state.score.toLocaleString('ru-RU');
  }
}

// ─── Эффект +N при тапе ───────────────────────────────────────────────────────
export function spawnCoinBurst(clientX, clientY, amount) {
  const el = document.createElement('div');
  el.className = 'coinBurst';
  el.textContent = '+' + amount;

  if (state.char.effects.fireCounter) {
    el.classList.add('coinBurst--fire');
  }

  const rect = DOM.characterWrapper.getBoundingClientRect();
  el.style.left = (clientX - rect.left + (Math.random() - .5) * CONFIG.COIN_SPREAD_X) + 'px';
  el.style.top  = (clientY - rect.top  + (Math.random() - .5) * CONFIG.COIN_SPREAD_Y) + 'px';

  DOM.characterWrapper.appendChild(el);
  setTimeout(() => el.remove(), CONFIG.COIN_ANIM_MS);
}

// ─── Персонаж ─────────────────────────────────────────────────────────────────
export function renderCharacter() {
  const char = state.char;

  _setBackground(char.background);

  if (DOM.gameWrap) {
    DOM.gameWrap.dataset.theme = char.theme ?? '';
  }

  // Синхронизируем --char-scale ДО начала анимации
  if (DOM.characterWrapper) {
    DOM.characterWrapper.style.setProperty('--char-scale', char.scale);
    DOM.characterWrapper.style.transform = `translateX(-50%) scale(${char.scale})`;

    const offset = char.bottomOffset ?? 0;
    DOM.characterWrapper.style.bottom = `calc(var(--menu-h) + 24px - ${offset}px)`;
  }

  if (char.type === 'video') {
    _showVideo(char);
  } else {
    _showImage(char);
  }

  _applyEffects(char.effects);

  // Обновляем состояние карточек грида (если грид уже построен)
  refreshCharGridState();
}

// ─── Анимация тапа (v2 — ultra-responsive) ────────────────────────────────────
let _pressTimer = null;

export function animateTap() {
  const char = state.char;
  const el   = DOM.characterWrapper;
  if (!el) return;

  // CSS animation restart trick (zero setTimeout, zero transform conflict)
  el.classList.remove('tap-anim');
  void el.offsetWidth;   // forced reflow
  el.classList.add('tap-anim');

  // pressSrc swap
  if (char.type === 'image' && char.pressSrc && DOM.charImg) {
    DOM.charImg.src = char.pressSrc;

    const duration = char.pressDuration ?? 80;
    if (_pressTimer) clearTimeout(_pressTimer);
    _pressTimer = setTimeout(() => {
      if (state.char.id === char.id && DOM.charImg) {
        DOM.charImg.src = char.src;
      }
      _pressTimer = null;
    }, duration);
  }
}

// ─── Видео-персонаж (совместимость) ───────────────────────────────────────────
export function playCharVideo() {
  const char = state.char;
  if (char.type !== 'video' || !DOM.charVideo) return;

  DOM.charVideo.loop = false;
  DOM.charVideo.currentTime = 0;
  DOM.charVideo.play().catch(() => {});
}

// ─── Навигация вкладок ────────────────────────────────────────────────────────
export function showTab(name) {
  const isGame        = name === 'game';
  const isUpgrade     = name === 'upgrade';
  const isLeaderboard = name === 'leaderboard';

  if (DOM.characterWrapper) {
    DOM.characterWrapper.style.opacity = isGame ? '1' : '0';
    DOM.characterWrapper.style.pointerEvents = isGame ? 'auto' : 'none';
  }
  if (DOM.counter) DOM.counter.style.opacity = isGame ? '1' : '0';
  if (DOM.rankEl)  DOM.rankEl.style.display  = isGame ? '' : 'none';

  if (DOM.upgradeScreen)     DOM.upgradeScreen.classList.toggle('active', isUpgrade);
  if (DOM.leaderboardScreen) DOM.leaderboardScreen.classList.toggle('active', isLeaderboard);

  DOM.menuBtns.forEach((btn, i) => {
    btn.classList.toggle('menuBtn--active',
      (i === 0 && isUpgrade) ||
      (i === 1 && isGame)    ||
      (i === 2 && isLeaderboard)
    );
  });

  // При открытии вкладки скинов — обновляем состояние карточек
  // (баланс мог измениться пока вкладка была закрыта)
  if (isUpgrade) {
    refreshCharGridState();
  }
}

// ─── Кнопка апгрейда ──────────────────────────────────────────────────────────
export function renderUpgradeBtn() {
  if (!DOM.upgradeBtn) return;
  const m = state.multiplier;
  if (m >= CONFIG.MAX_MULTIPLIER) {
    DOM.upgradeBtn.textContent = 'Максимальное улучшение достигнуто 🏆';
    DOM.upgradeBtn.disabled    = true;
    DOM.upgradeBtn.classList.add('upgradeBtn--disabled');
    return;
  }
  const cost = upgradeCost(m);
  DOM.upgradeBtn.textContent = `Купить x${m + 1}  за  ${cost.toLocaleString('ru-RU')} 🐷`;
  DOM.upgradeBtn.disabled    = false;
  DOM.upgradeBtn.classList.remove('upgradeBtn--disabled');
}

export function upgradeCost(multiplier) {
  return Math.floor(CONFIG.UPGRADE_BASE_COST * Math.pow(CONFIG.UPGRADE_COST_POW, multiplier - 1));
}

// ─── Toast ────────────────────────────────────────────────────────────────────
let _toastTimer = null;
export function showToast(text) {
  if (!DOM.upgradeMsg) return;
  DOM.upgradeMsg.textContent = text;
  DOM.upgradeMsg.classList.remove('hidden');
  DOM.upgradeMsg.classList.add('visible');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => DOM.upgradeMsg.classList.remove('visible'), 1800);
}

// ─── Лоадер ───────────────────────────────────────────────────────────────────
export function hideLoader() {
  if (!DOM.loader) return;
  DOM.loader.classList.add('loader--hidden');
  setTimeout(() => DOM.loader.remove(), 500);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SKIN PURCHASE SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════

let _onCharSelectCallback = null;   // callback из game.js (_onCharSelect)

/**
 * Построить грид персонажей.
 * Вызывается один раз при инициализации из game.js.
 * @param {Function} onSelect — callback при выборе купленного персонажа
 */
export function buildCharGrid(onSelect) {
  _onCharSelectCallback = onSelect;
  if (!DOM.charSelectWrap) return;

  _renderCharCards();

  // Настраиваем кнопки категорий (один раз)
  const activeCatBtn = document.querySelector('.skinCatBtn.active');
  const initialCat   = activeCatBtn?.dataset.cat ?? 'proskurin';
  _filterSkinsByCategory(initialCat);

  DOM.skinCategoryBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      DOM.skinCategoryBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      _filterSkinsByCategory(btn.dataset.cat);
    });
  });
}

/**
 * Обновить состояние карточек грида без полного rebuild.
 * Вызывается из renderCharacter() и showTab('upgrade').
 */
export function refreshCharGridState() {
  if (!DOM.charSelectWrap || DOM.charSelectWrap.children.length === 0) return;

  _renderCharCards();

  // Восстанавливаем текущий фильтр категории
  const activeCat = document.querySelector('.skinCatBtn.active')?.dataset.cat ?? 'proskurin';
  _filterSkinsByCategory(activeCat);
}

// ─── Приватные ────────────────────────────────────────────────────────────────

/**
 * Полный rebuild карточек персонажей.
 * Вызывается при покупке, смене персонажа, открытии вкладки.
 */
function _renderCharCards() {
  if (!DOM.charSelectWrap) return;
  DOM.charSelectWrap.innerHTML = '';

  CHARACTERS.forEach(char => {
    const isPurchased = state.purchasedSkins.includes(char.id);
    const isActive    = state.charId === char.id;
    const price       = char.price ?? 50;
    const canAfford   = state.score >= price;

    // CSS классы
    const classes = [
      'charChoice',
      isActive    ? 'charChoice--active' : '',
      isPurchased ? 'charChoice--owned'  : 'charChoice--locked',
    ].filter(Boolean).join(' ');

    const div = document.createElement('div');
    div.className    = classes;
    div.dataset.char = char.id;
    div.dataset.cat  = char.category;

    // Action-зона под именем
    let actionHtml;
    if (isActive) {
      actionHtml = `<span class="charChoice-badge charChoice-badge--selected">✓ Выбран</span>`;
    } else if (isPurchased) {
      actionHtml = `<button class="charChoice-btn charChoice-btn--select">Выбрать</button>`;
    } else {
      const cantClass = canAfford ? '' : 'charChoice-btn--cant-afford';
      actionHtml = `<button class="charChoice-btn charChoice-btn--buy ${cantClass}">🔒 ${price} 🐷</button>`;
    }

    // Lock overlay на картинке
    const lockOverlay = isPurchased
      ? ''
      : `<div class="charChoice-lock-overlay">🔒</div>`;

    div.innerHTML = `
      <div class="charChoice-img-wrap">
        <img src="${char.thumbnail}" alt="${char.name}" loading="lazy">
        ${lockOverlay}
      </div>
      <p>${char.name}</p>
      <div class="charChoice-actions">${actionHtml}</div>`;

    // Events
    const btn = div.querySelector('.charChoice-btn');
    if (btn) {
      if (btn.classList.contains('charChoice-btn--select')) {
        btn.addEventListener('click', () => _onCharSelectCallback?.(char.id));
      } else if (btn.classList.contains('charChoice-btn--buy')) {
        btn.addEventListener('click', () => _handleBuy(char));
      }
    }

    DOM.charSelectWrap.appendChild(div);
  });
}

/**
 * Обработка покупки скина.
 */
function _handleBuy(char) {
  const price = char.price ?? 50;

  if (state.score < price) {
    showToast(`Нужно ещё ${price - state.score} 🐷 для покупки!`);
    return;
  }

  const ok = purchaseSkin(char.id);

  if (ok) {
    // Анимация на карточке
    const card = DOM.charSelectWrap?.querySelector(`[data-char="${char.id}"]`);
    if (card) {
      card.classList.add('charChoice--buy-anim');
      setTimeout(() => card.classList.remove('charChoice--buy-anim'), 350);
    }

    // Обновляем счётчик монет
    renderCounter();

    // Звук и тост
    playSfx('./assets/sounds/rankup.mp3');
    showToast(`🎉 Куплен: ${char.name}!`);

    // Rebuild карточек с новым состоянием
    const activeCat = document.querySelector('.skinCatBtn.active')?.dataset.cat ?? 'proskurin';
    _renderCharCards();
    _filterSkinsByCategory(activeCat);
  } else {
    showToast(`Нужно ${price} 🐷 для покупки!`);
  }
}

function _filterSkinsByCategory(cat) {
  if (!DOM.charSelectWrap || !DOM.skinPlaceholder) return;

  let visibleCount = 0;

  DOM.charSelectWrap.querySelectorAll('.charChoice').forEach(el => {
    const match = el.dataset.cat === cat;
    el.style.display = match ? '' : 'none';
    if (match) visibleCount++;
  });

  DOM.skinPlaceholder.classList.toggle('hidden', visibleCount > 0);
}

function _setBackground(bgPath) {
  const url = `url('${bgPath}')`;
  document.body.style.backgroundImage = url;
  if (DOM.gameWrap) {
    DOM.gameWrap.style.backgroundImage = url;
  }
}

function _showImage(char) {
  if (DOM.charImg) {
    DOM.charImg.src           = char.src;
    DOM.charImg.style.display = 'block';
  }
  if (DOM.charVideo) {
    DOM.charVideo.pause();
    DOM.charVideo.currentTime   = 0;
    DOM.charVideo.style.display = 'none';
  }
}

function _showVideo(char) {
  if (DOM.charImg) DOM.charImg.style.display = 'none';

  if (DOM.charVideo) {
    const srcWebm = DOM.charVideo.querySelector('source[type="video/webm"]');
    const srcMp4  = DOM.charVideo.querySelector('source[type="video/mp4"]');
    if (srcWebm) srcWebm.src = char.src;
    if (srcMp4)  srcMp4.src  = char.srcFallback ?? '';

    DOM.charVideo.loop = false;
    DOM.charVideo.load();
    DOM.charVideo.style.display = 'block';
  }
}

function _applyEffects(effects) {
  if (DOM.counterNumber) {
    DOM.counterNumber.classList.toggle('fire-counter', effects.fireCounter);
  }
  if (DOM.counterImg) {
    DOM.counterImg.classList.toggle('fire-counter', effects.fireCounter);
  }
  DOM.menuBtns.forEach(btn => {
    btn.classList.toggle('fire-menu',     effects.fireMenu);
    btn.classList.toggle('fire-menu-btn', effects.fireMenu);
  });
}
