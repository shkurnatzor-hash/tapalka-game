/**
 * leaderboard.js — v2
 *
 * ИЗМЕНЕНИЯ:
 *  1. throttledSendScore() — добавлен настоящий throttle через timestamp
 *     (раньше отправлял каждый тап без ограничений)
 *  2. _render() — улучшен UI:
 *       - 🥇🥈🥉 медали для топ-3
 *       - Подсветка строки текущего игрока (lb-me)
 *       - Форматирование чисел с разделителями
 *       - Стабильная сортировка при одинаковых счётах (по ts)
 *  3. Обработка крайних случаев: дублей ников, пустых записей
 */

import { CONFIG } from './config.js';
import { state }  from './state.js';

let _db        = null;
let _container = null;
let _lastSend  = 0;   // timestamp последней отправки (для throttle)

export function initLeaderboard(firebaseDatabase, containerEl) {
  _db        = firebaseDatabase;
  _container = containerEl;
  console.log('Leaderboard init OK');
}

// ── Throttled отправка: не чаще CONFIG.LEADERBOARD_THROTTLE_MS ──
export function throttledSendScore() {
  if (!_db || !state.nickname) return;
  const now = Date.now();
  if (now - _lastSend < (CONFIG.LEADERBOARD_THROTTLE_MS || 5000)) return;
  _lastSend = now;
  _sendScore();
}

// ── Немедленная отправка (при закрытии вкладки, смене ника) ──
export function forceSendScore() {
  if (!_db || !state.nickname) return;
  _lastSend = Date.now();
  _sendScore();
}

// ─── Приватная отправка ───────────────────────────────────────────────────────
async function _sendScore() {
  try {
    const fb    = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js');
    const { ref, set } = fb;

    // Очищаем ник от запрещённых Firebase-символов
    const key = (state.nickname || 'unknown')
      .replace(/[.#$[\]/]/g, '_')
      .slice(0, 32);

    await set(ref(_db, `leaderboard/${key}`), {
      nick:  state.nickname,
      score: Math.max(state.score || 0, 0),
      ts:    Date.now()
    });

    console.log(`✅ Сохранено: ${state.nickname} — ${state.score}`);
  } catch (e) {
    console.error('Send error:', e);
  }
}

// ─── Загрузка и рендер ────────────────────────────────────────────────────────
export async function loadAndRenderLeaderboard() {
  if (!_container) return;

  // Показываем спиннер пока грузим
  _container.innerHTML = '<p class="lb-empty">⏳ Загружаем рейтинг...</p>';

  try {
    const fb = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js');
    const { ref, query, orderByChild, limitToLast, get } = fb;

    const q    = query(ref(_db, 'leaderboard'), orderByChild('score'), limitToLast(50));
    const snap = await get(q);

    const entries = [];
    snap.forEach(child => {
      const v = child.val();
      // Пропускаем битые/пустые записи
      if (v && (v.nick || v.name) && typeof v.score === 'number') {
        entries.push({
          nick:  v.nick || v.name || 'Без имени',
          score: v.score,
          ts:    v.ts || 0
        });
      }
    });

    // Сортировка: по score убыванию; при равном — кто раньше набрал (ts меньше = выше)
    entries.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.ts - b.ts;
    });

    // Берём топ N
    const top = entries.slice(0, CONFIG.LEADERBOARD_TOP_N || 20);

    console.log(`✅ Загружено: ${top.length} записей`);
    _render(top);

  } catch (e) {
    console.error('Load error:', e);
    _container.innerHTML = `<p class="lb-empty">❌ Ошибка загрузки: ${e.message}</p>`;
  }
}

// ─── Рендер таблицы ───────────────────────────────────────────────────────────
function _render(entries) {
  if (!_container) return;

  if (!entries || entries.length === 0) {
    _container.innerHTML = '<p class="lb-empty">Рейтинг пока пуст — стань первым! 🐷</p>';
    return;
  }

  const medals  = ['🥇', '🥈', '🥉'];
  const myNick  = state.nickname || null;

  let html = '<div class="lb-list">';

  entries.forEach((e, i) => {
    const place    = i + 1;
    const placeStr = medals[i] ?? `${place}.`;
    const score    = Number(e.score || 0).toLocaleString('ru-RU');
    const nick     = _escapeHtml(e.nick || 'Без имени');
    const isMe     = myNick && e.nick === myNick;

    // Топ-3 получают золотое свечение через data-атрибут
    const topClass = place <= 3 ? ` lb-top-${place}` : '';
    const meClass  = isMe ? ' lb-me' : '';

    html += `
      <div class="lb-row${topClass}${meClass}" data-place="${place}">
        <span class="lb-pos">${placeStr}</span>
        <span class="lb-nick">${nick}${isMe ? ' <span class="lb-you">you</span>' : ''}</span>
        <span class="lb-score">${score} 🐷</span>
      </div>`;
  });

  html += '</div>';
  _container.innerHTML = html;
}

// ─── Хелпер: защита от XSS в никах ──────────────────────────────────────────
function _escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}