/**
 * sound.js — v2 (Race-Condition-Free Audio Manager)
 *
 * ИСПРАВЛЕНО v2:
 *  1. Единственный активный Audio instance — _kill() уничтожает старый перед созданием нового
 *  2. Generation counter (_gen) инвалидирует stale async callbacks при быстрых сменах трека
 *  3. _started guard работает атомарно — no race between concurrent taps
 *  4. Memory-safe: src='' + load() освобождают медиа-ресурсы (критично на iOS)
 *  5. Autoplay unlock через поnerdown проверяет актуальность поколения перед play()
 *  6. changeTrack безопасен даже если предыдущий play() promise ещё не resolved
 *  7. Нет duplicate event listeners — каждый unlock handler имеет { once: true }
 */

import { CONFIG } from './config.js';

// ── Module state ───────────────────────────────────────────────────────────────
let _audio   = null;   // единственный активный Audio instance
let _started = false;  // флаг первого пользовательского взаимодействия
let _gen     = 0;      // счётчик поколений — инвалидирует stale async callbacks

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Вызвать при первом тапе пользователя.
 * Запускает музыку РОВНО ОДИН РАЗ. Повторные вызовы — no-op.
 */
export function startMusicOnce(src) {
  if (_started) return;
  _started = true;
  _playSafe(src);
}

/**
 * Сменить трек (при смене персонажа).
 * Мгновенно останавливает текущий трек, запускает новый.
 * Безопасен при вызове до первого взаимодействия — трек запустится
 * через startMusicOnce при следующем тапе (state.char.music актуален).
 */
export function changeTrack(src) {
  _kill();            // уничтожаем старый instance, инвалидируем callbacks
  if (_started) {
    _playSafe(src);   // играем сразу, если пользователь уже взаимодействовал
  }
  // Если _started === false — при следующем тапе startMusicOnce(state.char.music)
  // подхватит актуальный трек автоматически.
}

/**
 * Воспроизвести короткий звуковой эффект (ранг, покупка и т.д.)
 */
export function playSfx(src) {
  try {
    const sfx  = new Audio(src);
    sfx.volume = 0.7;
    sfx.play().catch(() => {});
  } catch (_) {}
}

// ── Private ────────────────────────────────────────────────────────────────────

/**
 * Полностью уничтожает текущий Audio instance.
 * src = '' + load() обязательны на iOS — иначе браузер держит сетевое соединение.
 * _gen++ инвалидирует ВСЕ pending async callbacks предыдущего instance.
 */
function _kill() {
  _gen++; // все callbacks с захваченным gen < текущего _gen игнорируются

  if (_audio) {
    try {
      _audio.pause();
      _audio.src  = '';
      _audio.load(); // release media buffer & network connection (iOS critical)
    } catch (_) {}
    _audio = null;
  }
}

/**
 * Создаёт новый Audio instance и запускает воспроизведение.
 * Race condition защита: myGen захватывается ПОСЛЕ _kill().
 * Если к моменту resolve/reject _gen изменился — callback игнорируется.
 */
async function _playSafe(src) {
  _kill(); // гарантируем чистый старт (нет старых instance)

  const myGen  = _gen;   // захватываем поколение ПОСЛЕ _kill
  const audio  = new Audio(src);
  audio.loop   = true;
  audio.volume = CONFIG.MUSIC_VOLUME;
  _audio       = audio;

  try {
    await audio.play();

    // Проверяем актуальность: к моменту resolve мог прийти новый changeTrack()
    if (_gen !== myGen) {
      audio.pause();
      audio.src = '';
      return;
    }
    // Трек успешно воспроизводится ✓

  } catch (_err) {
    // Autoplay заблокирован (политика iOS Safari / Telegram WebView / первый запуск)
    if (_gen !== myGen) return; // запрос уже устарел — выходим

    // Ждём следующего pointerdown для autoplay unlock
    const unlock = () => {
      if (_gen !== myGen) return; // трек сменился пока ждали
      _audio?.play().catch(() => {});
    };
    // { once: true } гарантирует отсутствие duplicate listeners
    document.addEventListener('pointerdown', unlock, { once: true });
  }
}
