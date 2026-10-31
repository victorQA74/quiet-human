import { LEVELS } from './game/levels.js';

const $ = id => document.getElementById(id);
const timeText = value => { const seconds = Math.ceil(Math.max(0, value)); return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`; };
const put = (id, value) => { if ($(id).textContent !== value) $(id).textContent = value; };

export class GameUI {
  constructor(commands) {
    this.commands = commands; this.toastTimer = null; this.modal = false;
    for (const [id, action] of [['start', 'start'], ['howto', 'help'], ['sound', 'sound'], ['motion', 'motion'], ['pause', 'pause'], ['web', 'web'], ['camera', 'camera']]) $(id).addEventListener('click', () => commands[action]());
    $('chapters').addEventListener('click', e => { const b = e.target.closest('[data-level]'); if (b && !b.disabled) commands.select(Number(b.dataset.level)); });
    $('dialog').addEventListener('click', e => { const b = e.target.closest('[data-action]'); if (b) commands[b.dataset.action](); });
    document.addEventListener('keydown', e => {
      if (e.code !== 'Tab' || !this.modal) return;
      const buttons = [...$('dialog').querySelectorAll('button:not([disabled])')];
      if (!buttons.length) return;
      const first = buttons[0], last = buttons.at(-1);
      if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
      else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
    });
  }
  menu(progress, selected) {
    $('menu').hidden = false; $('hud').hidden = true; this.closeDialog(); this.selected = selected;
    $('chapters').innerHTML = LEVELS.map((level, i) => `<button class="chapter ${i === selected ? 'selected' : ''}" data-level="${i}" ${i >= progress.unlocked ? 'disabled' : ''} aria-label="0${i + 1} ${level.name}${i >= progress.unlocked ? ' — закрыта' : ''}" aria-pressed="${i === selected}"><span class="chapter-index">0${i + 1}</span><span class="chapter-name">${level.name}</span><span class="chapter-status">${i >= progress.unlocked ? '⌑' : progress.best[i] ? '★'.repeat(progress.best[i].stars) : '↗'}</span></button>`).join('');
    put('chapter-count', `0${selected + 1} / 03`);
  }
  settings(progress, available) {
    $('sound').setAttribute('aria-pressed', String(progress.settings.sound)); $('sound').textContent = progress.settings.sound ? '♫' : '♪̸';
    $('motion').setAttribute('aria-pressed', String(progress.settings.reducedMotion));
    $('storage-warning').hidden = available;
  }
  game() { $('menu').hidden = true; $('hud').hidden = false; this.closeDialog(); }
  dialog(content) {
    $('dialog').innerHTML = content; $('modal-screen').hidden = false; this.modal = true;
    requestAnimationFrame(() => $('dialog').querySelector('button')?.focus());
  }
  closeDialog() { $('modal-screen').hidden = true; this.modal = false; $('dialog').innerHTML = ''; }
  tutorial() {
    this.dialog(`<span class="eyebrow">МАЛЕНЬКОЕ НАПОМИНАНИЕ</span><h2 id="dialog-title">Будь маленьким.<br>Будь смелым.</h2><p>Спаси всех малышей и отведи их в светящееся гнездо. Человек не должен тебя заметить.</p><div class="tutorial-grid"><div><b>01 / Двигайся</b><span>WASD, стрелки или клик по столу.<br>На телефоне — джойстик слева.</span></div><div><b>02 / Прячься</b><span>Мятные бумажные домики — укрытия. Внутри рука тебя не достанет.</span></div><div><b>03 / Отвлекай</b><span>Пробел или «Паутина» — приманка. Она отменит готовящийся удар.</span></div><div><b>04 / Не замирай</b><span>Человек целится — рука следует за тобой. Красный отпечаток фиксируется перед ударом: уйди с него или брось паутину.</span></div></div><p class="small-copy">Q / E или правая кнопка мыши — повернуть камеру. C — вернуть обзор. Esc — пауза.</p><button class="primary" data-action="ready">Я готов <span aria-hidden="true">↗</span></button>`);
  }
  paused() {
    this.dialog('<span class="eyebrow">ПАУЗА</span><h2 id="dialog-title">Можно выдохнуть</h2><p>Человек подождёт. Семья — тоже.</p><div class="dialog-actions"><button class="primary" data-action="resume">Продолжить <span aria-hidden="true">↗</span></button><button class="secondary" data-action="restart">Заново</button><button class="text-button" data-action="menu">В меню</button></div>');
  }
  result(s) {
    const won = s.status === 'won', final = s.levelIndex === 2;
    const title = won ? final ? 'Семья в сборе!' : 'Малыши дома!' : s.reason === 'time' ? 'Не успели до рассвета' : 'Нас заметили…';
    const body = won ? final ? 'Три вылазки. Одна большая маленькая семья. Теперь можно выдохнуть.' : 'Один стол позади. Малыши верят в тебя — впереди следующая глава.' : s.reason === 'time' ? 'Время вышло. Попробуй маршрут покороче и не забывай про паутину.' : 'Красный отпечаток предупреждает об ударе. Двигайся или отвлекай руку паутиной.';
    this.dialog(`<span class="eyebrow">${won ? 'ВЫЛАЗКА ЗАВЕРШЕНА' : 'ЕЩЁ ОДНА ПОПЫТКА?'}</span><h2 id="dialog-title">${title}</h2><p>${body}</p><div class="result-stars" aria-label="${s.stars} из 3 звёзд">${won ? '★'.repeat(s.stars) + '☆'.repeat(3 - s.stars) : '✳'}</div><div class="result-stats"><div><span>СЧЁТ</span><b>${s.score}</b></div><div><span>СПАСЕНО</span><b>${s.rescued} / ${s.babies.length}</b></div><div><span>ВРЕМЯ</span><b>${timeText(s.elapsed)}</b></div></div><div class="dialog-actions">${won && !final ? '<button class="primary" data-action="next">Следующая глава <span aria-hidden="true">↗</span></button>' : '<button class="primary" data-action="restart">Ещё раз <span aria-hidden="true">↗</span></button>'}<button class="secondary" data-action="menu">В меню</button></div>`);
  }
  toast(message) {
    clearTimeout(this.toastTimer); put('toast', message); $('toast').hidden = false;
    this.toastTimer = setTimeout(() => { $('toast').hidden = true; }, 2400);
  }
  setupLabels(s) {
    $('world-labels').innerHTML = `<div class="world-tag player-tag" data-tag="player">ЭТО ТЫ <span>↓</span></div>${s.babies.map(b => `<div class="world-tag baby-tag" data-tag="baby${b.id}">✳ <span>МАЛЫШ</span></div>`).join('')}<div class="world-tag nest-tag" data-tag="exit">⌂ <span>ДОМОЙ</span></div>`;
  }
  update(s, scene) {
    if (s.status === 'menu') return;
    const level = LEVELS[s.levelIndex];
    put('level-number', `ГЛАВА 0${s.levelIndex + 1} / 03`); put('level-name', level.name);
    put('family', `${s.rescued} / ${s.babies.length}`); put('timer', timeText(s.remaining));
    $('timer').classList.toggle('urgent', s.remaining < 20);
    put('hearts', '♥ '.repeat(s.player.health).trim() + ' ♡'.repeat(3 - s.player.health));
    const warning = ['warning', 'strike'].includes(s.hand.phase), tracking = s.hand.phase === 'track', distracted = s.hand.phase === 'distracted';
    put('danger-label', s.player.hidden ? 'Ты в укрытии' : warning ? 'РУКА! УХОДИ С ОТПЕЧАТКА' : tracking ? 'Человек заметил тебя · целится!' : distracted ? 'Человек отвлечён' : 'Человек ищет…');
    put('danger-value', warning ? '!' : tracking ? '↘' : `${Math.round(s.hand.attention * 100)}%`);
    $('attention-fill').style.width = `${warning || tracking ? 100 : s.hand.attention * 100}%`;
    $('attention-fill').style.background = warning ? '#ef735d' : s.player.hidden ? '#bfd6b6' : '#e2bc86';
    put('safety', s.player.hidden ? 'Здесь безопасно. Можно переждать.' : distracted ? 'Паутина сработала. Беги к малышам!' : warning ? 'Паутина отменит удар · ПРОБЕЛ' : tracking ? 'Рука следует за тобой. Спрячься или отвлеки!' : 'Мятные бумажные домики — безопасные укрытия.');
    const all = s.rescued === s.babies.length;
    put('objective', all ? 'Вся семья с тобой. Возвращайся в светящееся гнездо ↗' : `Спаси малышей · осталось ${s.babies.length - s.rescued}`);
    put('silk', `${s.silk} / 3 · ${matchMedia('(pointer: coarse)').matches ? 'ОТВЛЕЧЬ РУКУ' : 'ПРОБЕЛ'}`);
    $('web').disabled = s.silk === 0 || s.status !== 'playing';
    $('recharge').style.setProperty('--charge', `${s.silk === 3 ? 100 : s.silkClock / 8 * 100}%`);
    const tag = (id, p, hidden = false, y = 0.2) => {
      const el = document.querySelector(`[data-tag="${id}"]`); if (!el) return;
      const point = scene.screen(p, y); el.hidden = hidden; el.style.transform = `translate(${point.x}px,${point.y}px) translate(-50%,-100%)`;
    };
    tag('player', s.player, s.elapsed > 12 || s.player.hidden, 0.85);
    for (const b of s.babies) tag(`baby${b.id}`, b, b.rescued, 0.55);
    tag('exit', level.exit, false, 0.3);
  }
}
