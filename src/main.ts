import { EngineClient, requestPersistentStorage } from './engine/client';
import type { CharacterView, DynastyView, EventView } from './engine/protocol';

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
const timeButtons = ['month', 'year', 'decade', 'save'].map((id) => $<HTMLButtonElement>(id));
let lastYear = 0;

function write(line: string, cls?: string) {
  log.append(el('p', line, cls));
  log.scrollTop = log.scrollHeight;
}

function setBusy(busy: boolean, hasGame = true) {
  for (const b of timeButtons) b.disabled = busy || !hasGame;
  $<HTMLButtonElement>('pause').disabled = !busy;
  $<HTMLButtonElement>('new').disabled = busy;
  $<HTMLButtonElement>('load').disabled = busy;
  $<HTMLButtonElement>('loadSlot').disabled = busy;
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
  lastYear = v.year;
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
  renderDynasty(await engine.request({ type: 'viewDynasty' }));
}

// ---------------- modal: event ทุกอันและหน้าตั้งชื่อ ----------------
const modal = $('event');
const openModal = (...children: Node[]) => {
  modal.replaceChildren(...children);
  $('backdrop').hidden = false;
};
const closeModal = () => {
  modal.replaceChildren();
  $('backdrop').hidden = true;
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
    setBusy(false);
    await refresh();
    await showPending(); // event ต่อเนื่อง (ถ้ามี)
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
  openModal(...head, ...buttons);
  setBusy(false);
  for (const b of timeButtons) b.disabled = true; // ต้องตัดสินใจก่อน
}

/** แสดง event ที่ worker ยังรออยู่ (หลังโหลดเซฟ หรือหลังเลือกตัวเลือกไม่สำเร็จ) */
async function showPending() {
  try {
    const events = await engine.request({ type: 'viewPending' });
    if (events[0]) {
      renderEvent(events[0]);
      status.textContent = 'รอการตัดสินใจ';
    } else setBusy(false);
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
      status.textContent = `กำลังจำลอง… พ.ศ. ${p.year}`;
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

async function run(days: number) {
  setBusy(true);
  try {
    const r = await engine.request({ type: 'advance', days });
    status.textContent = r.stoppedBy === 'gameOver' ? 'ตระกูลสิ้นสาย' : r.stoppedBy === 'event' ? 'รอการตัดสินใจ' : 'บันทึกอัตโนมัติแล้ว';
    if (r.stoppedBy !== 'event') setBusy(false, r.stoppedBy !== 'gameOver');
    await refresh();
  } catch (e) {
    status.textContent = (e as Error).message;
    setBusy(false);
  }
}

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
    renderDynasty(await engine.request({ type: 'viewDynasty' }));
    status.textContent = 'พร้อม';
    await showPending();
    void requestPersistentStorage();
  } catch (e) {
    status.textContent = (e as Error).message;
    if (from === 'new' && !modal.querySelector('.error')) modal.append(el('p', (e as Error).message, 'error'));
  }
}

$('new').onclick = () =>
  openModal(
    el('h2', 'เริ่มชีวิตใหม่'),
    el('p', 'ลูกชายวัย 4 ขวบของขุนนางชั้นผู้น้อย ปลายกรุงศรีอยุธยา พ.ศ. 2288'),
    nameForm('ชื่อตัวละคร', 'บุญมา', 'เริ่ม', (name) => void start('new', name), closeModal),
  );
$('load').onclick = () => start('autosave');
$('loadSlot').onclick = () => start(MANUAL_SLOT);
$('month').onclick = () => run(30);
$('year').onclick = () => run(360);
$('decade').onclick = () => run(3600);
$('pause').onclick = () => engine.request({ type: 'pause' }).catch((e: Error) => (status.textContent = e.message));
$('save').onclick = async () => {
  try {
    const s = await engine.request({ type: 'save', slot: MANUAL_SLOT });
    status.textContent = `บันทึกแล้ว (${(s.bytes / 1024).toFixed(1)} KB)`;
  } catch (e) {
    status.textContent = `บันทึกไม่สำเร็จ: ${(e as Error).message}`;
  }
};
