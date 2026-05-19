/**
 * characters.js
 * UPDATED:
 *  - demomaks: type 'video' → 'image' (видео удалено, используем demomaks.png)
 *  - rastamaks: добавлен pressSrc для анимации тапа (rast.png → rast2.png)
 *  - barsuk / rastamaks / tajik: добавлен pressDuration (мс) — время показа tap-картинки
 *  - bottomOffset: сколько пикселей добавить к базовому bottom персонажа
 *
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 📐 КАК ДВИГАТЬ ПЕРСОНАЖА ВНИЗ (позиция)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *
 * Базовая позиция #characterWrapper задана в style.css:
 *   bottom: calc(var(--menu-h) + 24px)
 *   — т.е. персонаж стоит над нижним меню.
 *
 * Чтобы опустить КОНКРЕТНОГО персонажа вниз — используй поле `bottomOffset`.
 * Это число в пикселях, которое ВЫЧИТАЕТСЯ из базового bottom.
 * Чем БОЛЬШЕ значение → тем НИЖЕ персонаж.
 *
 *   bottomOffset: 0   → стандартная позиция (не трогает)
 *   bottomOffset: 10  → опускает вниз примерно на 0.5–0.7 см (≈ 10px)
 *   bottomOffset: 20  → опускает вниз примерно на 1–1.2 см (≈ 20px)
 *   bottomOffset: 38  → опускает вниз примерно на 2 см (≈ 38px)
 *
 * Где это применяется: ui.js → функция renderCharacter()
 *   DOM.characterWrapper.style.bottom = `calc(var(--menu-h) + 24px - ${char.bottomOffset || 0}px)`;
 *
 * ❗ Если поле bottomOffset не указано — персонаж будет на стандартной позиции (0).
 *
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * ⏱ КАК УПРАВЛЯТЬ СКОРОСТЬЮ TAP-АНИМАЦИИ
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *
 * Поле `pressDuration` (миллисекунды) — как долго показывается tap-картинка (pressSrc).
 * Работает ТОЛЬКО если у персонажа есть pressSrc (вторая картинка для тапа).
 *
 *   pressDuration: 80   → быстро (по умолчанию для всех без этого поля)
 *   pressDuration: 160  → чуть дольше, глаз успевает увидеть
 *   pressDuration: 220  → заметно, но ещё не медленно
 *   pressDuration: 300  → медленно, не рекомендуется для частого тапа
 *
 * Где это применяется: ui.js → функция animateTap()
 *   const duration = char.pressDuration ?? 80;
 */

export const CHARACTERS = [

  {
    id: 'barsuk',
    name: 'Барсук',
    category: 'proskurin',
    type: 'image',
    src: './assets/images/obichni.png',
    pressSrc: './assets/images/jmy.png',
    thumbnail: './assets/images/obichni.png',
    music: './assets/sounds/mellroy.mp3',
    background: './assets/images/background.jpg',
    // ⬇ ПОЗИЦИЯ: опускаем Барсука вниз примерно на 1 см (≈ 18–20px)
    // Увеличь это число чтобы опустить ещё, уменьши чтобы поднять
    bottomOffset: 20,
    scale: 1.0,
    // ⏱ TAP: увеличено время показа второй картинки — глаз успевает увидеть
    pressDuration: 180,
    theme: null,
    effects: { fireCounter: false, fireMenu: false }
  },

  {
    id: 'maksvin',
    name: 'Максвин',
    category: 'proskurin',
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

  // ── DEMOMAKS: полностью image-based (видео удалено) ──
  {
    id: 'demomaks',
    name: 'Демомакс',
    category: 'proskurin',
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

  {
    id: 'kotomaks',
    name: 'Котомакс',
    category: 'proskurin',
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

  // ── РАСТАМАКС: pressSrc + замедленная tap-анимация ──
  {
    id: 'rastamaks',
    name: 'Растамакс',
    category: 'proskurin',
    type: 'image',
    src: './assets/images/rast.png',
    pressSrc: './assets/images/rast2.png',
    thumbnail: './assets/images/rast.png',
    music: './assets/sounds/sun.mp3',
    background: './assets/images/ras.jpg',
    scale: 1.0,
    // ⏱ TAP: увеличено время показа второй картинки
    pressDuration: 180,
    theme: 'rasta',
    effects: { fireCounter: false, fireMenu: false }
  },

  // ── ТАДЖИК ──
  {
    id: 'tajik',
    name: 'Таджик',
    category: 'proskurin',
    type: 'image',
    src: './assets/images/zima.png',
    pressSrc: './assets/images/zima2.png',
    thumbnail: './assets/images/zima.png',
    music: './assets/sounds/tjk.mp3',
    background: './assets/images/winter.jpg',
    // ⬇ ПОЗИЦИЯ: опускаем Таджика вниз примерно на 2 см (≈ 38px)
    bottomOffset: 38,
    scale: 1.0,
    // ⏱ TAP: увеличено время показа второй картинки
    pressDuration: 180,
    theme: 'orange',
    effects: { fireCounter: false, fireMenu: false }
  },

  // ── ПАНИН ──
  {
    id: 'panin',
    name: 'Панин',
    category: 'panin',
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

  // ── САЙГАК ──
  {
    id: 'saygak',
    name: 'Сайгак',
    category: 'saygak',
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
    type: 'image',
    src: './assets/images/boroda.png',
    pressSrc: null,
    thumbnail: './assets/images/boroda.png',
    music: './assets/sounds/anash.mp3',
    background: './assets/images/police.jpg',
    // ⬇ ПОЗИЦИЯ: опускаем Бородача вниз примерно на 1.5 см (≈ 28px)
    bottomOffset: 28,
    scale: 1.0,
    theme: 'darkgrey',
    effects: { fireCounter: false, fireMenu: false }
  },

];

export function getCharById(id) {
  return CHARACTERS.find(c => c.id === id) ?? CHARACTERS[0];
}