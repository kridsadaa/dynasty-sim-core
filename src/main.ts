import { EngineClient, requestPersistentStorage } from './engine/client';
import type { CharacterView, ClockState, DynastyView, EventView, IntentPlanView, KnownPersonView } from './engine/protocol';

// UI บาง ๆ: ไม่มี game logic, ไม่มี state ของเกม — ทุกอย่างถามจาก Worker

const engine = new EngineClient();
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const el = (tag: string, text?: string, cls?: string) => {
  const e = document.createElement(tag);
  if (text !== undefined) e.textContent = text; // textContent เสมอ: content มาจาก JSON ที่ modder แก้ได้
  if (cls) e.className = cls;
  return e;
};

const log = $('log');
const status = $('status');
let lastYear = 0;
let hasGame = false;
let clock: ClockState = { playing: false, speed: 2, maxSpeed: 5, ended: false };

function write(line: string, cls?: string) {
  log.append(el('p', line, cls));
  log.scrollTop = log.scrollHeight;
}

// ---------------- นาฬิกา: เวลาเดินเองใน worker, UI แค่สั่งเดิน/หยุด/ปรับความเร็ว ----------------
const modalOpen = () => !$('backdrop').hidden;

function renderClock() {
  const play = $<HTMLButtonElement>('play');
  play.textContent = clock.playing ? '⏸ หยุด' : '▶ เดิน';
  play.classList.toggle('playing', clock.playing);
  play.disabled = !hasGame || clock.ended || modalOpen();
  $<HTMLButtonElement>('slower').disabled = !hasGame || clock.speed <= 1;
  $<HTMLButtonElement>('faster').disabled = !hasGame || clock.speed >= clock.maxSpeed;
  $<HTMLButtonElement>('save').disabled = !hasGame;
  $('speed').textContent = '●'.repeat(clock.speed) + '○'.repeat(clock.maxSpeed - clock.speed);
  $('speed').title = `ความเร็ว ${clock.speed}/${clock.maxSpeed}`;
  status.textContent = clock.ended ? 'ตระกูลสิ้นสาย' : modalOpen() ? 'รอการตัดสินใจ' : clock.playing ? '' : 'หยุดเวลา';
}

async function clockCmd(cmd: { type: 'play' } | { type: 'pause' } | { type: 'setSpeed'; speed: number }) {
  try {
    clock = await engine.request(cmd);
  } catch (e) {
    status.textContent = (e as Error).message;
  }
  renderClock();
}
const togglePlay = () => clockCmd(clock.playing ? { type: 'pause' } : { type: 'play' });
const changeSpeed = (d: number) => clockCmd({ type: 'setSpeed', speed: clock.speed + d });

// อัปเดตแผงตัวละคร/ตระกูลระหว่างเวลาเดิน — ไม่ถี่กว่า REFRESH_MS
const REFRESH_MS = 700;
let lastRefresh = 0;
function refreshSoon() {
  if (Date.now() - lastRefresh < REFRESH_MS) return;
  lastRefresh = Date.now();
  void refresh().catch(() => {});
}

function renderPlayer(v: CharacterView) {
  const box = $('player');
  box.replaceChildren(el('h2', 'ตัวละคร'));
  box.append(el('div', `${v.title ? v.title + ' ' : ''}${v.name} อายุ ${v.age} ปี (พ.ศ. ${v.year})`));
  box.append(el('div', `ชนชั้น: ${v.estate} · ทรัพย์ ${v.wealth} ตำลึง`));
  const list = (title: string, items: string[]) => {
    if (!items.length) return;
    box.append(el('h2', title));
    const ul = el('ul');
    for (const i of items) ul.append(el('li', i));
    box.append(ul);
  };
  list('ปมในใจ', v.traits);
  list('ร่องรอยบนร่างกาย', [...v.scars, ...v.wounds.map((w) => `แผลสด ${w}`)]);
  list('ความสามารถทางกาย', Object.entries(v.capabilities).filter(([, x]) => x < 1).map(([k, x]) => `${k}: ${Math.round(x * 100)}%`));
  box.append(el('h2', 'วิถีชีวิต'), el('div', v.lifestyle, 'lifestyle'));
  if (v.intent) {
    const i = v.intent;
    const card = el('div', undefined, 'intent');
    const head = el('div', undefined, 'row');
    const quit = el('button', 'เลิก') as HTMLButtonElement;
    quit.title = 'เลิกความตั้งใจนี้';
    quit.onclick = async () => {
      const r = await engine.request({ type: 'abandonIntent' });
      for (const l of r.lines) write(l);
      await refresh();
    };
    head.append(el('strong', `ตั้งใจ${i.title}`), quit);
    const bar = el('progress') as HTMLProgressElement;
    Object.assign(bar, { max: 100, value: i.progress });
    bar.setAttribute('aria-label', `คืบหน้า ${i.progress}%`);
    card.append(head, el('div', i.approach, 'muted'), bar, el('div', `อีกราว ${i.monthsLeft} เดือน · โอกาสสำเร็จ ${i.odds}%`));
    card.title = i.factors.map((f) => `${f.value > 0 ? '+' : ''}${f.value}% ${f.label}`).join('\n');
    box.append(card);
  }
  lastYear = v.year;
}

// ---------------- คนที่รู้จัก: ญาติ (พับไว้) + คนนอกตระกูล พร้อมปุ่มสิ่งที่ตั้งใจทำได้ ----------------
let kinOpen = false;

function personRow(p: KnownPersonView): HTMLElement {
  const row = el('div', undefined, `person${p.focus ? ' focus' : ''}`);
  const who = el('div');
  who.append(el('strong', p.name), document.createTextNode(` ${p.age} ปี · `), el('span', p.tie, 'tie'));
  row.append(who, el('div', p.detail, 'muted'));
  if (p.actions.length) {
    const acts = el('div', undefined, 'acts');
    for (const a of p.actions) {
      const b = el('button', a.label) as HTMLButtonElement;
      b.onclick = () => void openPlan(p.id, a.kind);
      acts.append(b);
    }
    row.append(acts);
  }
  return row;
}

function renderKnown(people: KnownPersonView[]) {
  const box = $('known');
  box.replaceChildren(el('h2', 'คนที่รู้จัก'));
  const kin = people.filter((p) => p.kin);
  const others = people.filter((p) => !p.kin);
  if (kin.length) {
    const d = el('details') as HTMLDetailsElement;
    d.open = kinOpen;
    d.ontoggle = () => (kinOpen = d.open);
    d.append(el('summary', `ครอบครัว (${kin.length})`), ...kin.map(personRow));
    box.append(d);
  }
  if (!others.length) box.append(el('div', 'ยังไม่รู้จักใครนอกบ้าน', 'muted'));
  box.append(...others.map(personRow));
}

/** หน้าเลือกวิธี: โอกาสสำเร็จ เวลาโดยประมาณ และชีวิตประจำวันที่จะเปลี่ยน — หยุดเวลาไว้ระหว่างเลือก */
async function openPlan(targetId: string, kind: string) {
  const wasPlaying = clock.playing;
  if (wasPlaying) await clockCmd({ type: 'pause' });
  const resume = () => {
    if (wasPlaying && !modalOpen()) void clockCmd({ type: 'play' });
  };
  let plan: IntentPlanView;
  try {
    plan = await engine.request({ type: 'planIntent', targetId, kind });
  } catch (e) {
    status.textContent = (e as Error).message;
    resume();
    return;
  }
  const buttons = plan.approaches.map((a) => {
    const b = el('button', undefined, 'opt approach') as HTMLButtonElement;
    b.append(el('strong', a.label));
    b.append(el('span', a.unavailable ? `ทำไม่ได้: ${a.unavailable}` : `โอกาสสำเร็จ ${a.odds}% · ราว ${a.months} เดือน`, 'note'));
    if (!a.unavailable) {
      b.append(el('span', a.lifestyle, 'note'));
      const fs = el('span', undefined, 'factors');
      a.factors.forEach((f, i) => {
        if (i) fs.append(document.createTextNode(' · '));
        fs.append(el('span', `${f.value > 0 ? '+' : ''}${f.value}% ${f.label}`, f.value > 0 ? 'up' : 'down'));
      });
      b.append(fs);
    }
    b.disabled = !!a.unavailable;
    b.onclick = async () => {
      try {
        const r = await engine.request({ type: 'startIntent', targetId, kind, approach: a.id });
        closeModal();
        write(`→ ตั้งใจ${plan.title}: ${a.label}`);
        for (const l of r.lines) write(l);
        await refresh();
        resume();
      } catch (e) {
        modal.append(el('p', (e as Error).message, 'error'));
      }
    };
    return b;
  });
  const back = el('button', 'ย้อนกลับ') as HTMLButtonElement;
  back.onclick = () => {
    closeModal();
    resume();
  };
  const row = el('div', undefined, 'row');
  row.append(back);
  openModal(el('h2', plan.title), el('p', plan.text), ...(plan.replaces ? [el('p', plan.replaces, 'triggered')] : []), ...buttons, row);
}

function renderDynasty(v: DynastyView) {
  const box = $('dynasty');
  box.replaceChildren(el('h2', v.name));
  box.append(el('div', `บารมี ${v.prestige} · สมาชิกที่ยังมีชีวิต ${v.livingMembers} · ผังตระกูล ${v.familyNodes} คน`));
  for (const [title, items] of [['ข้อห้ามประจำตระกูล', v.taboos], ['ตำนานที่เล่าขาน', v.legends]] as const) {
    if (!items.length) continue;
    box.append(el('h2', title));
    const ul = el('ul');
    for (const i of items) ul.append(el('li', i));
    box.append(ul);
  }
}

async function refresh() {
  renderPlayer(await engine.request({ type: 'viewPlayer' }));
  renderKnown(await engine.request({ type: 'viewKnown' }));
  renderDynasty(await engine.request({ type: 'viewDynasty' }));
}

// ---------------- modal: event ทุกอันและหน้าตั้งชื่อ ----------------
const modal = $('event');
const openModal = (...children: Node[]) => {
  modal.replaceChildren(...children);
  $('backdrop').hidden = false;
  renderClock();
};
const closeModal = () => {
  modal.replaceChildren();
  $('backdrop').hidden = true;
  renderClock();
};

/** ฟอร์มพิมพ์ชื่อ — ตรวจแบบเดียวกับ worker (อักษรไทย 1–20 ตัว) */
function nameForm(label: string, value: string, submitText: string, onSubmit: (name: string) => void, onCancel: () => void): HTMLFormElement {
  const form = el('form') as HTMLFormElement;
  const input = el('input') as HTMLInputElement;
  Object.assign(input, { value, required: true, maxLength: 20, pattern: '[\u0E00-\u0E7F]+', title: 'อักษรไทย ไม่มีช่องว่าง' });
  input.setAttribute('aria-label', label);
  const ok = el('button', submitText) as HTMLButtonElement;
  const cancel = el('button', 'ย้อนกลับ') as HTMLButtonElement;
  cancel.type = 'button';
  cancel.onclick = onCancel;
  const row = el('div', undefined, 'row');
  row.append(cancel, ok);
  form.append(el('label', label), input, row);
  form.onsubmit = (e) => {
    e.preventDefault();
    onSubmit(input.value.trim());
  };
  queueMicrotask(() => input.select());
  return form;
}

async function choose(ev: EventView, o: EventView['options'][number], name?: string) {
  modal.replaceChildren(el('p', '…'));
  try {
    const r = await engine.request({ type: 'choose', instanceId: ev.instanceId, optionId: o.id, name });
    closeModal();
    write(`→ ${o.text}`);
    for (const l of r.lines) write(l);
    await refresh();
    await showPending(); // event ต่อเนื่อง (ถ้ามี) — ไม่มีแล้ว worker เดินเวลาต่อเอง
  } catch (e) {
    // event ยังค้างอยู่ใน worker → แสดงใหม่ให้เลือกอีกครั้ง แทนที่จะปล่อยให้ปุ่มค้าง
    await showPending();
    modal.append(el('p', (e as Error).message, 'error'));
  }
}

function renderEvent(ev: EventView) {
  const head = [el('h2', ev.title), el('p', ev.text)];
  if (ev.triggered.length) head.push(el('p', `ใจสั่นขึ้นมา… (${ev.triggered.join(', ')})`, 'triggered'));
  const buttons = ev.options.map((o) => {
    const b = el('button', o.locked ? `🔒 ${o.text}` : o.text, `opt${o.injected ? ' injected' : ''}${o.note && !o.locked ? ' strained' : ''}`) as HTMLButtonElement;
    if (o.note) b.append(el('span', o.note, 'note'));
    b.disabled = o.locked;
    const input = o.nameInput;
    b.onclick = input
      ? () => openModal(...head, nameForm(input.label, input.default, 'ตั้งชื่อ', (name) => choose(ev, o, name), () => renderEvent(ev)))
      : () => choose(ev, o);
    return b;
  });
  openModal(...head, ...buttons); // worker หยุดเวลาไว้แล้ว — ต้องตัดสินใจก่อนจึงเดินต่อ
}

/** แสดง event ที่ worker ยังรออยู่ (หลังโหลดเซฟ หรือหลังเลือกตัวเลือกไม่สำเร็จ) */
async function showPending() {
  try {
    const events = await engine.request({ type: 'viewPending' });
    if (events[0]) renderEvent(events[0]);
  } catch (e) {
    status.textContent = (e as Error).message;
  }
}

engine.onPush((p) => {
  switch (p.type) {
    case 'ready':
      status.textContent = 'พร้อม';
      break;
    case 'log':
      if (p.year !== lastYear) {
        write(`พ.ศ. ${p.year}`, 'year');
        lastYear = p.year;
      }
      for (const l of p.lines) write(l);
      break;
    case 'progress':
      $('date').textContent = `พ.ศ. ${p.year} · เดือน ${p.month} วัน ${p.dayOfMonth}`;
      refreshSoon();
      break;
    case 'clock':
      clock = p.clock;
      renderClock();
      if (!clock.playing) void refresh().catch(() => {});
      break;
    case 'pendingEvent':
      renderEvent(p.event);
      break;
    case 'handover':
      write(`สิ้น${p.deceased} — ${p.heir} สืบทอดตระกูล`, 'year');
      for (const l of p.lines) write(l, 'handover');
      break;
    case 'error':
      status.textContent = p.message;
      break;
  }
});

const MANUAL_SLOT = 'slot1';

async function start(from: 'new' | 'autosave' | typeof MANUAL_SLOT, heroName?: string) {
  try {
    const v = from === 'new'
      ? await engine.request({ type: 'newGame', seed: Math.floor(Math.random() * 2 ** 31), heroName })
      : await engine.request({ type: 'load', slot: from });
    log.replaceChildren();
    closeModal();
    write(from === 'new' ? `เริ่มชีวิตใหม่ในฐานะ ${v.name}` : `โหลดเซฟ: ${v.name}`);
    renderPlayer(v);
    renderKnown(await engine.request({ type: 'viewKnown' }));
    renderDynasty(await engine.request({ type: 'viewDynasty' }));
    $('date').textContent = `พ.ศ. ${v.year}`;
    hasGame = true;
    clock = await engine.request({ type: 'pause' }); // เริ่ม/โหลดแล้วเวลาหยุดรอ ผู้เล่นกดเดินเอง
    renderClock();
    await showPending();
    void requestPersistentStorage();
  } catch (e) {
    status.textContent = (e as Error).message;
    if (from === 'new' && !modal.querySelector('.error')) modal.append(el('p', (e as Error).message, 'error'));
  }
}

$('new').onclick = async () => {
  if (clock.playing) await clockCmd({ type: 'pause' });
  openModal(
    el('h2', 'เริ่มชีวิตใหม่'),
    el('p', 'ลูกชายวัย 4 ขวบของขุนนางชั้นผู้น้อย ปลายกรุงศรีอยุธยา พ.ศ. 2288'),
    nameForm('ชื่อตัวละคร', 'บุญมา', 'เริ่ม', (name) => void start('new', name), closeModal),
  );
};
$('load').onclick = () => start('autosave');
$('loadSlot').onclick = () => start(MANUAL_SLOT);
$('play').onclick = togglePlay;
$('slower').onclick = () => changeSpeed(-1);
$('faster').onclick = () => changeSpeed(1);
// คีย์ลัด: Space เดิน/หยุด, + / − ปรับความเร็ว — ไม่ทำงานตอนพิมพ์หรือมีหน้าต่างเปิดอยู่
document.addEventListener('keydown', (e) => {
  if (!hasGame || modalOpen() || e.target instanceof HTMLInputElement || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.code === 'Space') {
    e.preventDefault();
    void togglePlay();
  } else if (e.key === '+' || e.key === '=') void changeSpeed(1);
  else if (e.key === '-' || e.key === '_') void changeSpeed(-1);
});
$('save').onclick = async () => {
  try {
    const s = await engine.request({ type: 'save', slot: MANUAL_SLOT });
    status.textContent = `บันทึกแล้ว (${(s.bytes / 1024).toFixed(1)} KB)`;
  } catch (e) {
    status.textContent = `บันทึกไม่สำเร็จ: ${(e as Error).message}`;
  }
};
