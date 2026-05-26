/**
 * ui.js — v4 (New Character Select & Purchase System)
 *
 * ИЗМЕНЕНИЯ v4:
 *  1. Новая механика выбора персонажей:
 *       - OWNED:  клик по всей карточке сразу выбирает персонажа (без кнопки "Выбрать")
 *       - LOCKED: клик по карточке открывает purchase modal
 *       - ACTIVE: карточка подсвечивается accentColor персонажа
 *  2. Purchase modal вместо inline-кнопки покупки:
 *       - Текст «Купить [ИМЯ] за [ЦЕНА] свинкойнов?»
 *       - Кнопки «Да, купить!» / «Нет»
 *       - Проверка баланса, списание, автовыбор после покупки
 *  3. SVG игровой замок вместо emoji:
 *       - Современный, слегка объёмный, с glow-эффектом
 *       - Idle-анимация пульсации
 *       - Плавное исчезновение после покупки
 *  4. Под карточкой: имя + цена / «Куплено»
 *  5. Тема 'choco' для Тимон и Пумба (светло-коричневый)
 *
 * СОХРАНЕНО без изменений:
 *  - animateTap() ultra-responsive (CSS keyframes + forced reflow)
 *  - playCharVideo() для совместимости
 *  - renderCharacter(), renderCounter(), spawnCoinBurst()
 *  - showTab(), renderUpgradeBtn(), showToast(), hideLoader()
 *  - Nick modal полностью без изменений
 *  - Все pointer/touch обработчики не тронуты
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
  DOM.lbProfileBlock   = document.getElementById('lbProfileBlock');
  DOM.menuBtns         = Array.from(document.querySelectorAll('.menuBtn'));
  DOM.upgradeTabs      = Array.from(document.querySelectorAll('.upgradeTab'));
  DOM.upgradeContents  = Array.from(document.querySelectorAll('.upgradeContent'));
  DOM.loader           = document.getElementById('loader');
  DOM.skinCategoryBtns = Array.from(document.querySelectorAll('.skinCatBtn'));
  DOM.skinPlaceholder  = document.getElementById('skinPlaceholder');

  // Nick modal
  DOM.nickModalOverlay = document.getElementById('nickModalOverlay');
  DOM.nickModalBox     = document.getElementById('nickModalBox');
  DOM.nickModalClose   = document.getElementById('nickModalClose');
  DOM.nickModalTitle   = document.getElementById('nickModalTitle');
  DOM.nickModalSubtitle= document.getElementById('nickModalSubtitle');
  DOM.nickModalInput   = document.getElementById('nickModalInput');
  DOM.nickModalError   = document.getElementById('nickModalError');
  DOM.nickModalSubmit  = document.getElementById('nickModalSubmit');
  DOM.nickModalLabel   = document.getElementById('nickModalSubmitLabel');
  DOM.nickModalSpinner = document.getElementById('nickModalSpinner');

  // Purchase modal
  DOM.purchaseModalOverlay = document.getElementById('purchaseModalOverlay');
  DOM.purchaseModalBox     = document.getElementById('purchaseModalBox');
  DOM.purchaseModalImg     = document.getElementById('purchaseModalImg');
  DOM.purchaseModalTitle   = document.getElementById('purchaseModalTitle');
  DOM.purchaseModalText    = document.getElementById('purchaseModalText');
  DOM.purchaseModalPrice   = document.getElementById('purchaseModalPrice');
  DOM.purchaseModalYes     = document.getElementById('purchaseModalYes');
  DOM.purchaseModalNo      = document.getElementById('purchaseModalNo');

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
    DOM.characterWrapper.style.opacity       = isGame ? '1' : '0';
    DOM.characterWrapper.style.visibility    = isGame ? 'visible' : 'hidden';
    DOM.characterWrapper.style.pointerEvents = isGame ? 'auto' : 'none';
  }
  if (DOM.counter) {
    DOM.counter.style.opacity    = isGame ? '1' : '0';
    DOM.counter.style.visibility = isGame ? 'visible' : 'hidden';
  }
  if (DOM.rankEl) DOM.rankEl.style.display = isGame ? '' : 'none';

  if (DOM.upgradeScreen)     DOM.upgradeScreen.classList.toggle('active', isUpgrade);
  if (DOM.leaderboardScreen) DOM.leaderboardScreen.classList.toggle('active', isLeaderboard);

  DOM.menuBtns.forEach((btn, i) => {
    btn.classList.toggle('menuBtn--active',
      (i === 0 && isUpgrade) ||
      (i === 1 && isGame)    ||
      (i === 2 && isLeaderboard)
    );
  });

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
// SKIN PURCHASE SYSTEM v4
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

  // Purchase modal — инициализируем кнопки один раз
  _initPurchaseModal();
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

// ─── SVG игровой замок ────────────────────────────────────────────────────────

/**
 * Генерирует SVG игрового замка с glow-эффектом.
 * Современный, слегка объёмный, в стиле idle/clicker игры.
 */
function _makeLockSVG() {
  return `<svg class="char-lock-svg" viewBox="0 0 44 52" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs>
      <filter id="lockGlow" x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="2.5" result="blur"/>
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <linearGradient id="lockBodyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%"   stop-color="#f5c842"/>
        <stop offset="50%"  stop-color="#d4980a"/>
        <stop offset="100%" stop-color="#a06800"/>
      </linearGradient>
      <linearGradient id="lockShine" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%"   stop-color="#fff" stop-opacity="0.45"/>
        <stop offset="100%" stop-color="#fff" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="lockShackleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%"   stop-color="#ffe066"/>
        <stop offset="100%" stop-color="#b07a00"/>
      </linearGradient>
    </defs>
    <!-- Дужка замка -->
    <path
      d="M10 22 C10 10 34 10 34 22"
      stroke="url(#lockShackleGrad)"
      stroke-width="5.5"
      stroke-linecap="round"
      fill="none"
      filter="url(#lockGlow)"
    />
    <!-- Тень корпуса -->
    <rect x="6" y="21" width="32" height="25" rx="6" fill="rgba(0,0,0,0.35)"/>
    <!-- Корпус замка -->
    <rect x="5" y="20" width="34" height="25" rx="6" fill="url(#lockBodyGrad)" filter="url(#lockGlow)"/>
    <!-- Блик -->
    <rect x="5" y="20" width="34" height="25" rx="6" fill="url(#lockShine)"/>
    <!-- Замочная скважина — внешний круг -->
    <circle cx="22" cy="30" r="5" fill="rgba(0,0,0,0.55)"/>
    <!-- Замочная скважина — прорезь -->
    <rect x="20" y="32" width="4" height="6" rx="2" fill="rgba(0,0,0,0.55)"/>
    <!-- Блик на дужке -->
    <path
      d="M12 20 C12 12 20 9 22 9"
      stroke="rgba(255,255,255,0.45)"
      stroke-width="2"
      stroke-linecap="round"
      fill="none"
    />
  </svg>`;
}

// ─── Приватные ────────────────────────────────────────────────────────────────

/**
 * Полный rebuild карточек персонажей.
 * Новая механика v4:
 *  - Owned: вся карточка кликабельна → выбирает персонажа
 *  - Locked: вся карточка кликабельна → открывает purchase modal
 *  - Active: border-glow цветом accentColor персонажа
 *  - Под картинкой: имя + цена / «Куплено»
 */
function _renderCharCards() {
  if (!DOM.charSelectWrap) return;
  DOM.charSelectWrap.innerHTML = '';

  CHARACTERS.forEach(char => {
    const isPurchased = state.purchasedSkins.includes(char.id);
    const isActive    = state.charId === char.id;
    const price       = char.price ?? 50;
    const accentColor = char.accentColor ?? '#50d460';

    // CSS классы карточки
    const classes = [
      'charChoice',
      isActive    ? 'charChoice--active'   : '',
      isPurchased ? 'charChoice--owned'    : 'charChoice--locked',
    ].filter(Boolean).join(' ');

    const div = document.createElement('div');
    div.className    = classes;
    div.dataset.char = char.id;
    div.dataset.cat  = char.category;

    // Динамическая подсветка активной карточки через inline style
    if (isActive) {
      div.style.setProperty('--card-accent', accentColor);
      // Парсим цвет для glow
      const glowRgb  = _hexToRgba(accentColor, 0.55);
      const glowRgb2 = _hexToRgba(accentColor, 0.25);
      div.style.borderColor = accentColor;
      div.style.boxShadow   = `0 0 0 2px ${accentColor}, 0 0 18px ${glowRgb}, 0 0 36px ${glowRgb2}`;
    }

    // Замок — SVG для незакупленных
    const lockHtml = isPurchased ? '' : `<div class="char-lock-overlay">${_makeLockSVG()}</div>`;

    // Статус под именем: цена или «Куплено»
    let statusHtml;
    if (isPurchased) {
      statusHtml = `<span class="char-status char-status--owned">✓ Куплено</span>`;
    } else {
      statusHtml = `<span class="char-status char-status--price">
        <img class="char-status-coin" src="./assets/images/govno.png" alt="coin"> ${price}
      </span>`;
    }

    div.innerHTML = `
      <div class="charChoice-img-wrap">
        <img src="${char.thumbnail}" alt="${char.name}" loading="lazy">
        ${lockHtml}
      </div>
      <p class="charChoice-name">${char.name}</p>
      <div class="charChoice-status-wrap">${statusHtml}</div>`;

    // ── Events: вся карточка кликабельна ──
    div.addEventListener('click', () => {
      if (isPurchased) {
        // Уже куплен — просто выбираем
        _onCharSelectCallback?.(char.id);
      } else {
        // Не куплен — открываем purchase modal
        _openPurchaseModal(char);
      }
    });

    DOM.charSelectWrap.appendChild(div);
  });
}

// ─── Purchase Modal ────────────────────────────────────────────────────────────

let _purchaseTarget = null; // char object который хотим купить

function _initPurchaseModal() {
  if (!DOM.purchaseModalYes || !DOM.purchaseModalNo) return;

  DOM.purchaseModalYes.addEventListener('click', _onPurchaseConfirm);
  DOM.purchaseModalNo.addEventListener('click',  _closePurchaseModal);

  // Клик на overlay (вне box) — закрыть
  DOM.purchaseModalOverlay?.addEventListener('click', (e) => {
    if (e.target === DOM.purchaseModalOverlay) _closePurchaseModal();
  });
}

/**
 * Открыть modal подтверждения покупки.
 */
function _openPurchaseModal(char) {
  _purchaseTarget = char;

  // Заполняем modal
  if (DOM.purchaseModalImg) {
    DOM.purchaseModalImg.src = char.thumbnail;
    DOM.purchaseModalImg.alt = char.name;
  }
  if (DOM.purchaseModalText) {
    DOM.purchaseModalText.textContent = `Вы хотите купить персонажа ${char.name}?`;
  }
  if (DOM.purchaseModalPrice) {
    DOM.purchaseModalPrice.textContent = (char.price ?? 50).toLocaleString('ru-RU');
  }

  // Показываем с анимацией
  const overlay = DOM.purchaseModalOverlay;
  const box     = DOM.purchaseModalBox;
  if (!overlay || !box) return;

  overlay.classList.remove('hidden');
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      overlay.classList.add('purchase-modal--visible');
      box.classList.add('purchase-modal-box--visible');
    });
  });
}

function _closePurchaseModal() {
  const overlay = DOM.purchaseModalOverlay;
  const box     = DOM.purchaseModalBox;
  if (!overlay) return;

  overlay.classList.remove('purchase-modal--visible');
  box?.classList.remove('purchase-modal-box--visible');

  setTimeout(() => {
    overlay.classList.add('hidden');
    _purchaseTarget = null;
  }, 280);
}

function _onPurchaseConfirm() {
  const char = _purchaseTarget;
  if (!char) return;

  const price = char.price ?? 50;

  // Проверка баланса
  if (state.score < price) {
    showToast('Недостаточно свинкойнов! 🐷');
    _closePurchaseModal();
    return;
  }

  // Покупка
  const ok = purchaseSkin(char.id);

  if (ok) {
    _closePurchaseModal();

    // Обновляем счётчик монет
    renderCounter();

    // Автоматически выбираем купленного персонажа
    _onCharSelectCallback?.(char.id);

    // Анимация на карточке
    setTimeout(() => {
      const card = DOM.charSelectWrap?.querySelector(`[data-char="${char.id}"]`);
      if (card) {
        card.classList.add('charChoice--buy-anim');
        setTimeout(() => card.classList.remove('charChoice--buy-anim'), 350);
      }
    }, 100);

    // Звук и тост
    playSfx('./assets/sounds/rankup.mp3');
    showToast(`🎉 Персонаж куплен: ${char.name}!`);

    // Rebuild грида с новым состоянием
    const activeCat = document.querySelector('.skinCatBtn.active')?.dataset.cat ?? 'proskurin';
    _renderCharCards();
    _filterSkinsByCategory(activeCat);
  } else {
    showToast('Недостаточно свинкойнов! 🐷');
    _closePurchaseModal();
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

// ─── Утилиты ──────────────────────────────────────────────────────────────────

/**
 * HEX → rgba(r,g,b,a) строка.
 * Поддерживает #RGB и #RRGGBB.
 */
function _hexToRgba(hex, alpha) {
  let c = hex.replace('#', '');
  if (c.length === 3) c = c[0]+c[0]+c[1]+c[1]+c[2]+c[2];
  const r = parseInt(c.substring(0,2), 16);
  const g = parseInt(c.substring(2,4), 16);
  const b = parseInt(c.substring(4,6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
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

// ═══════════════════════════════════════════════════════════════════════════════
// LEADERBOARD PROFILE BLOCK
// ═══════════════════════════════════════════════════════════════════════════════

export function updateLbProfileUI() {
  const el = DOM.lbProfileBlock;
  if (!el) return;

  const nick = state.nickname;

  if (nick) {
    el.innerHTML = `
      <div class="lb-profile">
        <div class="lb-profile-info">
          <span class="lb-profile-avatar">🐷</span>
          <div class="lb-profile-texts">
            <span class="lb-profile-label">Твой ник</span>
            <span class="lb-profile-nick">${_escHtml(nick)}</span>
          </div>
        </div>
        <button id="lbChangeNickBtn" class="lb-profile-change-btn">
          ✏️ Сменить
        </button>
      </div>`;
  } else {
    el.innerHTML = `
      <div class="lb-profile lb-profile--empty">
        <p class="lb-profile-hint">Зарегистрируй ник, чтобы попасть в рейтинг!</p>
        <button id="lbSetNickBtn" class="lb-profile-set-btn">
          👤 Выбрать ник
        </button>
      </div>`;
  }
}

function _escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}


// ═══════════════════════════════════════════════════════════════════════════════
// NICK MODAL — БЕЗ ИЗМЕНЕНИЙ
// ═══════════════════════════════════════════════════════════════════════════════

let _nickSubmitCallback = null;
let _nickModalOpen = false;

export function showNickModal(currentNick, onSubmit) {
  if (_nickModalOpen) return;
  _nickSubmitCallback = onSubmit;

  const isChange = !!currentNick;

  if (DOM.nickModalTitle)    DOM.nickModalTitle.textContent    = isChange ? 'Сменить ник' : 'Выбери ник';
  if (DOM.nickModalSubtitle) DOM.nickModalSubtitle.textContent = isChange
    ? `Текущий ник: ${currentNick}`
    : 'Ник виден всем в рейтинге';
  if (DOM.nickModalLabel)    DOM.nickModalLabel.textContent    = isChange ? 'Сменить' : 'Сохранить';

  if (DOM.nickModalInput) {
    DOM.nickModalInput.value = '';
    DOM.nickModalInput.disabled = false;
    DOM.nickModalInput.focus();
  }
  _setModalError(null);
  _setModalLoading(false);

  const overlay = DOM.nickModalOverlay;
  const box     = DOM.nickModalBox;
  if (!overlay || !box) return;

  overlay.classList.remove('hidden');
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      overlay.classList.add('nick-modal--visible');
      box.classList.add('nick-modal-box--visible');
    });
  });

  _nickModalOpen = true;

  DOM.nickModalClose?.addEventListener('click', _closeNickModal, { once: true });
  overlay.addEventListener('click', _onOverlayClick);
  DOM.nickModalInput?.addEventListener('keydown', _onModalKeydown);
  DOM.nickModalSubmit?.addEventListener('click', _onModalSubmit, { once: false });
}

function _onOverlayClick(e) {
  if (e.target === DOM.nickModalOverlay) _closeNickModal();
}

function _onModalKeydown(e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    _onModalSubmit();
  }
  if (e.key === 'Escape') _closeNickModal();
}

async function _onModalSubmit() {
  const raw = DOM.nickModalInput?.value ?? '';

  if (!raw.trim()) {
    _setModalError('Введи ник');
    _shakeInput();
    return;
  }

  _setModalLoading(true);
  _setModalError(null);

  const result = await _nickSubmitCallback?.(raw);

  _setModalLoading(false);

  if (result?.ok) {
    _closeNickModal();
  } else {
    _setModalError(result?.error ?? 'Произошла ошибка');
    _shakeInput();
  }
}

function _closeNickModal() {
  const overlay = DOM.nickModalOverlay;
  const box     = DOM.nickModalBox;
  if (!overlay) return;

  overlay.classList.remove('nick-modal--visible');
  box?.classList.remove('nick-modal-box--visible');

  setTimeout(() => {
    overlay.classList.add('hidden');
    _nickModalOpen = false;
  }, 280);

  overlay.removeEventListener('click', _onOverlayClick);
  DOM.nickModalInput?.removeEventListener('keydown', _onModalKeydown);
  DOM.nickModalSubmit?.removeEventListener('click', _onModalSubmit);
  DOM.nickModalClose?.removeEventListener('click', _closeNickModal);
}

function _setModalError(msg) {
  const el = DOM.nickModalError;
  if (!el) return;
  if (msg) {
    el.textContent = msg;
    el.classList.remove('hidden');
  } else {
    el.classList.add('hidden');
    el.textContent = '';
  }
}

function _setModalLoading(isLoading) {
  if (DOM.nickModalSubmit)  DOM.nickModalSubmit.disabled  = isLoading;
  if (DOM.nickModalLabel)   DOM.nickModalLabel.style.opacity  = isLoading ? '0' : '1';
  if (DOM.nickModalSpinner) DOM.nickModalSpinner.classList.toggle('hidden', !isLoading);
  if (DOM.nickModalInput)   DOM.nickModalInput.disabled   = isLoading;
}

function _shakeInput() {
  const input = DOM.nickModalInput;
  if (!input) return;
  input.classList.remove('nick-input-shake');
  void input.offsetWidth; // reflow
  input.classList.add('nick-input-shake');
}
