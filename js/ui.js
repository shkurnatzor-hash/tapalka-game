/**
 * ui.js — TAP ANIMATION v2 (ultra-responsive)
 *
 * ИЗМЕНЕНИЯ:
 *  1. animateTap() — полностью переписана:
 *       - убран setTimeout-based transform (конфликт при быстром тапе)
 *       - используется CSS class + forced reflow restart trick
 *       - pressSrc swap сокращён до 80ms
 *       - работает корректно при 10+ taps/sec и мультитаче
 *  2. renderCharacter() — добавлен style.setProperty('--char-scale')
 *       чтобы CSS keyframes (tapBounce) читали правильный масштаб
 *  3. playCharVideo() — оставлен для совместимости (demomaks теперь image,
 *       но функция безопасно no-ops при type !== 'video')
 *  4. Видео-логика (_showVideo) сохранена для возможных будущих персонажей
 */

import { state }      from './state.js';
import { CONFIG }     from './config.js';
import { CHARACTERS } from './characters.js';

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

  // GPU-hint: выставляем will-change сразу при кэше DOM
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

  // ✅ Синхронизируем --char-scale ДО того, как начнётся анимация
  if (DOM.characterWrapper) {
    DOM.characterWrapper.style.setProperty('--char-scale', char.scale);
    DOM.characterWrapper.style.transform = `translateX(-50%) scale(${char.scale})`;

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 📐 ВЕРТИКАЛЬНАЯ ПОЗИЦИЯ ПЕРСОНАЖА (bottomOffset)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    //
    // Базовый bottom задан в CSS: calc(var(--menu-h) + 24px)
    // Чтобы опустить персонажа вниз — увеличивай bottomOffset в characters.js.
    //
    // Формула:
    //   bottom = (высота меню + 24px) - bottomOffset
    //
    // Примеры:
    //   bottomOffset: 0   → стандартная позиция
    //   bottomOffset: 20  → опускает вниз ~1 см
    //   bottomOffset: 38  → опускает вниз ~2 см
    //   bottomOffset: 56  → опускает вниз ~3 см
    //
    // Где менять: characters.js → поле bottomOffset у нужного персонажа.
    // Этот код автоматически подхватит новое значение.
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const offset = char.bottomOffset ?? 0;
    DOM.characterWrapper.style.bottom = `calc(var(--menu-h) + 24px - ${offset}px)`;
  }

  if (char.type === 'video') {
    _showVideo(char);
  } else {
    _showImage(char);
  }

  _applyEffects(char.effects);

  DOM.charSelectWrap?.querySelectorAll('.charChoice').forEach(el => {
    el.classList.toggle('charChoice--active', el.dataset.char === char.id);
  });
}

// ─── Анимация тапа (v2 — ultra-responsive) ────────────────────────────────────
//
// Проблема старой версии:
//   setTimeout(130ms) + прямой style.transform конфликтовали при быстром тапе.
//   При 4+ tap/sec setTimeout не успевал отрабатывать и transform "залипал".
//
// Решение:
//   Используем CSS keyframes (.tap-anim) + forced reflow для перезапуска.
//   Браузер сам управляет compositing на GPU — нет JS-таймеров на трансформ.
//   Анимация ВСЕГДА перезапускается с нуля, даже при 20 tap/sec.
//
// Техника restart:
//   1. classList.remove('tap-anim')   → browser stops current animation
//   2. void el.offsetWidth            → forced reflow сбрасывает state
//   3. classList.add('tap-anim')      → animation starts fresh
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ⏱ УПРАВЛЕНИЕ СКОРОСТЬЮ TAP-КАРТИНКИ (pressDuration)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//
// Каждый персонаж может иметь своё поле pressDuration (в мс) в characters.js.
// Это время, сколько показывается tap-картинка (pressSrc) перед возвратом.
//
// Если поле не задано → fallback 80ms (быстро, как было раньше).
//
// Рекомендуемые значения:
//   80ms  → по умолчанию, очень быстро (незаметно при частом тапе)
//   160ms → комфортно, глаз успевает зафиксировать
//   180ms → оптимально — заметно, но без ощущения задержки
//   220ms → чуть медленнее, подходит если тапают редко
//   300ms → медленно, не рекомендуется
//
// Где менять: characters.js → поле pressDuration у нужного персонажа.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
let _pressTimer = null;

export function animateTap() {
  const char = state.char;
  const el   = DOM.characterWrapper;
  if (!el) return;

  // ── CSS animation restart (zero setTimeout, zero transform conflict) ──
  el.classList.remove('tap-anim');
  void el.offsetWidth;          // forced reflow — ключевой момент
  el.classList.add('tap-anim');

  // ── pressSrc swap: длительность берётся из char.pressDuration ──
  // Дефолт 80ms для персонажей без этого поля — поведение не меняется.
  if (char.type === 'image' && char.pressSrc && DOM.charImg) {
    DOM.charImg.src = char.pressSrc;

    // Читаем индивидуальную длительность (barsuk/rastamaks/tajik = 180ms, остальные = 80ms)
    const duration = char.pressDuration ?? 80;

    if (_pressTimer) clearTimeout(_pressTimer);
    _pressTimer = setTimeout(() => {
      // Проверяем что персонаж не сменился пока таймер ждал
      if (state.char.id === char.id && DOM.charImg) {
        DOM.charImg.src = char.src;
      }
      _pressTimer = null;
    }, duration);
  }
}

// ─── Видео-персонаж (сохранено для совместимости) ─────────────────────────────
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

// ─── Грид персонажей ──────────────────────────────────────────────────────────
export function buildCharGrid(onSelect) {
  if (!DOM.charSelectWrap) return;

  DOM.charSelectWrap.innerHTML = '';

  CHARACTERS.forEach(char => {
    const div = document.createElement('div');
    div.className    = 'charChoice';
    div.dataset.char = char.id;
    div.dataset.cat  = char.category;
    div.innerHTML    = `
      <img src="${char.thumbnail}" alt="${char.name}" loading="lazy">
      <p>${char.name}</p>`;
    div.addEventListener('click', () => onSelect(char.id));
    DOM.charSelectWrap.appendChild(div);
  });

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

// ─── Лоадер ───────────────────────────────────────────────────────────────────
export function hideLoader() {
  if (!DOM.loader) return;
  DOM.loader.classList.add('loader--hidden');
  setTimeout(() => DOM.loader.remove(), 500);
}

// ─── Приватные хелперы ────────────────────────────────────────────────────────

function _filterSkinsByCategory(cat) {
  if (!DOM.charSelectWrap || !DOM.skinPlaceholder) return;

  let visibleCount = 0;

  DOM.charSelectWrap.querySelectorAll('.charChoice').forEach(el => {
    const match = el.dataset.cat === cat;
    el.style.display = match ? '' : 'none';
    if (match) visibleCount++;
  });

  if (visibleCount === 0) {
    DOM.skinPlaceholder.classList.remove('hidden');
  } else {
    DOM.skinPlaceholder.classList.add('hidden');
  }
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