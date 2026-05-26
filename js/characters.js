/**
 * characters.js
 * UPDATED v4:
 *  - Добавлено поле `accentColor` для подсветки активной карточки персонажа
 *  - Тема 'choco' (Тимон и Пумба): светло-коричневый / молочный шоколад
 *
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 💰 ЦЕНЫ ПЕРСОНАЖЕЙ
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *
 * price: 0     → бесплатный (barsuk)
 * price: 52    → demomaks, rastamaks, boroda
 * price: 67    → maksvin, kotomaks, panin, saygak
 * price: 50    → tajik, timon (и все прочие по умолчанию)
 *
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 📐 КАК ДВИГАТЬ ПЕРСОНАЖА ВНИЗ (позиция)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *
 * Базовая позиция #characterWrapper задана в style.css:
 *   bottom: calc(var(--menu-h) + 24px)
 *
 * Чтобы опустить КОНКРЕТНОГО персонажа вниз — используй поле `bottomOffset`.
 * Это число в пикселях, которое ВЫЧИТАЕТСЯ из базового bottom.
 * Чем БОЛЬШЕ значение → тем НИЖЕ персонаж.
 *
 *   bottomOffset: 0   → стандартная позиция
 *   bottomOffset: 20  → опускает вниз ~1 см
 *   bottomOffset: 38  → опускает вниз ~2 см
 *
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * ⏱ КАК УПРАВЛЯТЬ СКОРОСТЬЮ TAP-АНИМАЦИИ
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *
 * pressDuration (мс) — время показа tap-картинки (pressSrc).
 *   80ms  → быстро (дефолт)
 *   180ms → оптимально — заметно, без задержки
 *
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 🎨 ТЕМЫ ПЕРСОНАЖЕЙ
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *
 * null      → зелёная тема (default)
 * 'red'     → красная тема (demomaks)
 * 'brown'   → коричневая (kotomaks)
 * 'orange'  → оранжевая (tajik)
 * 'grey'    → серая (saygak)
 * 'darkgrey'→ тёмно-серая (boroda)
 * 'rasta'   → раста (rastamaks)
 * 'choco'   → молочный шоколад (timon)
 *
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 🌟 accentColor — цвет подсветки активной карточки
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *
 * Используется для border-glow выбранного персонажа в гриде скинов.
 * Если не задан — используется дефолтный зелёный (#50d460).
 */

export const CHARACTERS = [

  // ── БАРСУК — бесплатный стартовый персонаж ──
  {
    id: 'barsuk',
    name: 'Барсук',
    category: 'proskurin',
    price: 0,              // БЕСПЛАТНО — разблокирован по умолчанию
    accentColor: '#50d460',
    type: 'image',
    src: './assets/images/obichni.png',
    pressSrc: './assets/images/jmy.png',
    thumbnail: './assets/images/obichni.png',
    music: './assets/sounds/mellroy.mp3',
    background: './assets/images/background.jpg',
    bottomOffset: 20,
    scale: 1.0,
    pressDuration: 180,
    theme: null,
    effects: { fireCounter: false, fireMenu: false }
  },

  // ── МАКСВИН ──
  {
    id: 'maksvin',
    name: 'Максвин',
    category: 'proskurin',
    price: 67,
    accentColor: '#50d460',
    type: 'image',
    src: './assets/images/maksvin.png',
    pressSrc: null,
    thumbnail: './assets/images/maksvin.png',
    music: './assets/sounds/morgen.mp3',
    background: './assets/images/sviari.jpg',
    scale: 1.1,
    theme: null,
    effects: { fireCounter: false, fireMenu: false }
  },

  // ── DEMOMAKS ──
  {
    id: 'demomaks',
    name: 'Демомакс',
    category: 'proskurin',
    price: 52,
    accentColor: '#e74c3c',
    type: 'image',
    src: './assets/images/demomaks.png',
    pressSrc: null,
    thumbnail: './assets/images/demomaks.png',
    music: './assets/sounds/sila.mp3',
    background: './assets/images/doma.jpg',
    scale: 1.0,
    theme: 'red',
    effects: { fireCounter: true, fireMenu: true }
  },

  // ── КОТОМАКС ──
  {
    id: 'kotomaks',
    name: 'Котомакс',
    category: 'proskurin',
    price: 67,
    accentColor: '#c9956c',
    type: 'image',
    src: './assets/images/KOTOMAKS.png',
    pressSrc: null,
    thumbnail: './assets/images/KOTOMAKS.png',
    music: './assets/sounds/maksdor.mp3',
    background: './assets/images/domaxa.jpg',
    scale: 1.0,
    theme: 'brown',
    effects: { fireCounter: false, fireMenu: false }
  },

  // ── РАСТАМАКС ──
  {
    id: 'rastamaks',
    name: 'Растамакс',
    category: 'proskurin',
    price: 52,
    accentColor: '#ffd700',
    type: 'image',
    src: './assets/images/rast.png',
    pressSrc: './assets/images/rast2.png',
    thumbnail: './assets/images/rast.png',
    music: './assets/sounds/sun.mp3',
    background: './assets/images/ras.jpg',
    scale: 1.0,
    pressDuration: 180,
    theme: 'rasta',
    effects: { fireCounter: false, fireMenu: false }
  },

  // ── ТАДЖИК ──
  {
    id: 'tajik',
    name: 'Таджик',
    category: 'proskurin',
    price: 50,
    accentColor: '#ff6a00',
    type: 'image',
    src: './assets/images/zima.png',
    pressSrc: './assets/images/zima2.png',
    thumbnail: './assets/images/zima.png',
    music: './assets/sounds/tjk.mp3',
    background: './assets/images/winter.jpg',
    bottomOffset: 38,
    scale: 1.0,
    pressDuration: 180,
    theme: 'orange',
    effects: { fireCounter: false, fireMenu: false }
  },

  // ── ПАНИН ──
  {
    id: 'panin',
    name: 'Панин',
    category: 'panin',
    price: 67,
    accentColor: '#50d460',
    type: 'image',
    src: './assets/images/panin1.png',
    pressSrc: null,
    thumbnail: './assets/images/panin1.png',
    music: './assets/sounds/panis.mp3',
    background: './assets/images/fo_pani.jpg',
    scale: 1.0,
    theme: null,
    effects: { fireCounter: false, fireMenu: false }
  },

  // ── ТИМОН И ПУМБА ──
  // theme: 'choco' — молочно-шоколадная палитра (тёплые карамельные тона)
  {
    id: 'timon',
    name: 'Тимон и Пумба',
    category: 'panin',
    price: 50,
    accentColor: '#C89B6D',
    type: 'image',
    src: './assets/images/tim.png',
    pressSrc: null,
    thumbnail: './assets/images/tim.png',
    music: './assets/sounds/pyk.mp3',
    background: './assets/images/pysto.jpg',
    scale: 1.0,
    theme: 'choco',
    effects: { fireCounter: false, fireMenu: false }
  },

  // ── САЙГАК ──
  {
    id: 'saygak',
    name: 'Сайгак',
    category: 'saygak',
    price: 67,
    accentColor: '#888888',
    type: 'image',
    src: './assets/images/barbara.png',
    pressSrc: null,
    thumbnail: './assets/images/barbara.png',
    music: './assets/sounds/barsa.mp3',
    background: './assets/images/fo_barba.jpg',
    bottomOffset: 30,
    scale: 1.6,
    theme: 'grey',
    effects: { fireCounter: false, fireMenu: false }
  },

  // ── БОРОДАЧ ──
  {
    id: 'boroda',
    name: 'Бородач',
    category: 'saygak',
    price: 52,
    accentColor: '#666666',
    type: 'image',
    src: './assets/images/boroda.png',
    pressSrc: null,
    thumbnail: './assets/images/boroda.png',
    music: './assets/sounds/anash.mp3',
    background: './assets/images/police.jpg',
    bottomOffset: 28,
    scale: 1.0,
    theme: 'darkgrey',
    effects: { fireCounter: false, fireMenu: false }
  },

];

export function getCharById(id) {
  return CHARACTERS.find(c => c.id === id) ?? CHARACTERS[0];
}
