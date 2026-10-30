import { EngineClient, requestPersistentStorage } from './engine/client';
import type { CharacterView, DynastyView, EventView, InspectView, LogKind, SaveSlotInfo, TreeView } from './engine/protocol';

// UI บาง ๆ: ไม่มี game logic, ไม่มี state ของเกม — ทุกอย่างถามจาก Worker

const engine = new EngineClient();
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const el = (tag: string, text?: string, cls?: string) => {
  const e = document.createElement(tag);
  if (text !== undefined) e.textContent = text; // textContent เสมอ: content มาจาก JSON ที่ modder แก้ได้
  if (cls) e.className = cls;
  return e;
};
const button = (text: string, onclick: () => void, cls?: string) => {
  const b = el('button', text, cls) as HTMLButtonElement;
  b.type = 'button';
  b.onclick = onclick;
  return b;
};
const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** localStorage อาจโยน (private mode / ปิด storage) — เป็นแค่ความสะดวก ไม่ใช่ state ของเกม */
const prefs = {
  get<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(`dynasty-sim:${key}`);
      return raw === null ? fallback : (JSON.parse(raw) as T);
    } catch {
      return fallback;
    }
  },
  set(key: string, value: unknown): void {
    try {
      localStorage.setItem(`dynasty-sim:${key}`, JSON.stringify(value));
    } catch {
      /* ไม่เป็นไร */
    }
  },
};

const log = $('log');
const status = $('status');
const timeButtons = ['month', 'year', 'decade'].map((id) => $<HTMLButtonElement>(id));
let lastYear = 0;
let hasGame = false;
let busy = false;
let eventPending = false;

function setBusy(next: boolean) {
  busy = next;
  for (const b of timeButtons) b.disabled = busy || !hasGame || eventPending;
  $<HTMLButtonElement>('pause').disabled = !busy;
  $<HTMLButtonElement>('new').disabled = busy;
  $<HTMLButtonElement>('saveBtn').disabled = busy || !hasGame;
  for (const b of $('slots').querySelectorAll('button')) (b as HTMLButtonElement).disabled = busy;
}

// ---------------------------------------------------------------------------
// แท็บ
// ---------------------------------------------------------------------------

type Tab = 'log' | 'tree' | 'saves';
let tab: Tab = 'saves';

function showTab(next: Tab) {
  tab = next;
  for (const b of document.querySelectorAll<HTMLButtonElement>('.tabs button')) b.setAttribute('aria-selected', String(b.dataset.tab === next));
  for (const t of ['log', 'tree', 'saves'] as const) $(`tab-${t}`).hidden = t !== next;
  if (next === 'tree' && hasGame) void refreshTree();
  if (next === 'saves') void refreshSlots();
}
for (const b of document.querySelectorAll<HTMLButtonElement>('.tabs button')) b.onclick = () => showTab(b.dataset.tab as Tab);

// ---------------------------------------------------------------------------
// บันทึก (log) — แยกเป็นก้อนรายปี กรองตามหมวดได้
// ---------------------------------------------------------------------------

const KIND_TH: Record<LogKind, string> = {
  family: 'ครอบครัว',
  death: 'การตาย',
  inherit: 'มรดก/สืบทอด',
  body: 'ร่างกาย',
  household: 'เรือน/ปม',
  history: 'บ้านเมือง',
  choice: 'การตัดสินใจ',
};
const KINDS = Object.keys(KIND_TH) as LogKind[];
const shown = new Set<LogKind>(prefs.get<LogKind[]>('logKinds', KINDS).filter((k) => KINDS.includes(k)));
const counts = new Map<LogKind, number>();
const countLabels = new Map<LogKind, HTMLElement>();
let yearBlock: HTMLElement | null = null;

for (const k of KINDS) {
  const label = el('label');
  const box = el('input') as HTMLInputElement;
  box.type = 'checkbox';
  box.checked = shown.has(k);
  box.onchange = () => {
    if (box.checked) shown.add(k);
    else shown.delete(k);
    prefs.set('logKinds', [...shown]);
    applyFilter();
  };
  const count = el('span', '', 'note');
  countLabels.set(k, count);
  label.append(box, ` ${KIND_TH[k]} `, count);
  $('filters').append(label);
}

const lineVisible = (p: HTMLElement) => {
  const k = p.dataset.kind as LogKind | 'system' | undefined;
  return !k || k === 'system' || shown.has(k);
};

/** ก้อนปีที่ไม่มีบรรทัดไหนผ่านตัวกรอง → ซ่อนหัว พ.ศ. ด้วย */
function updateBlock(block: HTMLElement) {
  if (!block.classList.contains('yr')) return;
  block.hidden = ![...block.querySelectorAll<HTMLElement>('p[data-kind]')].some(lineVisible);
}

function applyFilter() {
  for (const p of log.querySelectorAll<HTMLElement>('p[data-kind]')) p.hidden = !lineVisible(p);
  for (const b of log.querySelectorAll<HTMLElement>('.yr')) updateBlock(b);
}

function clearLog() {
  log.replaceChildren();
  yearBlock = null;
  counts.clear();
  for (const c of countLabels.values()) c.textContent = '';
}

function startYear(year: number) {
  if (year === lastYear && yearBlock) return;
  lastYear = year;
  yearBlock = el('div', undefined, 'yr');
  yearBlock.append(el('p', `พ.ศ. ${year}`, 'year'));
  log.append(yearBlock);
}

function write(text: string, kind: LogKind | 'system', cls?: string) {
  const atBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 40;
  const target = yearBlock ?? log;
  const p = el('p', text, cls ?? (kind === 'system' ? 'system' : undefined));
  p.dataset.kind = kind;
  p.hidden = !lineVisible(p);
  target.append(p);
  updateBlock(target);
  if (kind !== 'system') {
    counts.set(kind, (counts.get(kind) ?? 0) + 1);
    countLabels.get(kind)!.textContent = `(${counts.get(kind)})`;
  }
  // เลื่อนตามเฉพาะตอนผู้เล่นอยู่ท้ายบันทึก — ไม่ดึงกลับถ้ากำลังเลื่อนอ่านย้อนหลัง
  if (atBottom) log.scrollTop = log.scrollHeight;
}

// ---------------------------------------------------------------------------
// ตัวละครผู้เล่น / ตระกูล
// ---------------------------------------------------------------------------

function renderPlayer(v: CharacterView) {
  const box = $('player');
  box.replaceChildren(el('h2', 'ตัวละคร'));
  const who = el('div');
  who.append(button(`${v.title ? v.title + ' ' : ''}${v.name}`, () => void inspect(v.nodeId), 'who'), ` อายุ ${v.age} ปี (พ.ศ. ${v.year})`);
  box.append(who);
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
  playerNodeId = v.nodeId;
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
  if (tab === 'tree') await refreshTree();
  if (inspecting) await inspect(inspecting);
}

// ---------------------------------------------------------------------------
// ผังตระกูล — เริ่มจากต้นตระกูล ลูกซ้อนใต้พ่อแม่ คู่ครองคนนอกอยู่บรรทัดเดียวกับคู่
// ---------------------------------------------------------------------------

let playerNodeId: string | null = null;

async function refreshTree() {
  try {
    renderTree(await engine.request({ type: 'viewTree' }));
  } catch (e) {
    $('tree').replaceChildren(el('p', errorText(e), 'note'));
  }
}

function renderTree(v: TreeView) {
  const byId = new Map(v.nodes.map((n) => [n.id, n]));
  const placed = new Set<string>();
  const branchesAt = new Map<string, TreeView['branches']>();
  for (const b of v.branches) branchesAt.set(b.rootNodeId, [...(branchesAt.get(b.rootNodeId) ?? []), b]);

  const personButton = (id: string) => {
    const n = byId.get(id)!;
    const cls = ['person', n.alive ? '' : 'dead', n.pruned ? 'pruned' : '', id === v.playerNodeId ? 'me' : '', id === inspecting ? 'selected' : '']
      .filter(Boolean).join(' ');
    const b = button(`${n.sex === 'm' ? '♂' : '♀'} ${n.name} (${n.birthYear}–${n.deathYear ?? ''})`, () => void inspect(id), cls);
    b.dataset.node = id;
    const frag = document.createDocumentFragment();
    frag.append(b);
    if (id === v.playerNodeId) frag.append(el('span', 'ผู้เล่น', 'badge'));
    if (id === v.headNodeId) frag.append(el('span', 'ผู้นำตระกูล', 'badge'));
    if (n.parentage) frag.append(el('span', n.parentage, 'note'));
    if (n.pruned) frag.append(el('span', ' เหลือแต่ชื่อ', 'note'));
    return frag;
  };

  const renderNode = (id: string): HTMLElement => {
    const n = byId.get(id)!;
    placed.add(id);
    const line = el('span');
    line.append(personButton(id));
    for (const sid of n.spouseIds) {
      const sp = byId.get(sid);
      if (!sp) continue;
      line.append(el('span', ' ⚭ ', 'note'));
      if (sp.marriedIn) {
        placed.add(sid);
        line.append(personButton(sid));
      } else {
        // ญาติแต่งกันเอง — คู่ครองมีบรรทัดของตัวเองอยู่ในสายพ่อแม่
        line.append(el('span', `${sp.name} (${sp.birthYear})`, 'note'));
      }
    }
    const kids = [...new Set(n.childIds)].sort((a, b) => byId.get(a)!.birthYear - byId.get(b)!.birthYear);
    const branches = branchesAt.get(id) ?? [];
    const li = el('li');
    if (!kids.length && !branches.length) {
      li.append(line);
      return li;
    }
    const ul = el('ul');
    for (const k of kids) {
      if (placed.has(k)) {
        // ลูกของญาติที่แต่งกันเอง — แสดงเต็มครั้งเดียว อีกฝั่งอ้างถึง
        ul.append(el('li', `${byId.get(k)!.name} (${byId.get(k)!.birthYear}) — ดูในสายอีกฝั่ง`, 'note'));
      } else ul.append(renderNode(k));
    }
    for (const b of branches) ul.append(el('li', `${b.label} — ${b.memberCount} คน ${b.generations} รุ่น (ยุบเหลือบรรทัดเดียว)`, 'note'));
    const details = el('details') as HTMLDetailsElement;
    details.open = true;
    const summary = el('summary');
    summary.append(line);
    details.append(summary, ul);
    li.append(details);
    return li;
  };

  const root = el('ul');
  if (byId.has(v.founderNodeId)) root.append(renderNode(v.founderNodeId));
  // ใครที่ไม่ถูกวางจากต้นตระกูล = ผังขาดตอน (เช่น prune ตัดพ่อแม่ทิ้ง) — โชว์ไว้ให้เห็น ไม่ซ่อน
  const orphans = v.nodes.filter((n) => !placed.has(n.id) && !n.marriedIn);
  const strays = v.nodes.filter((n) => !placed.has(n.id) && n.marriedIn && !n.spouseIds.some((s) => placed.has(s)));
  for (const n of orphans) if (!placed.has(n.id)) root.append(renderNode(n.id));
  if (strays.length) {
    const li = el('li', 'คู่ครองคนนอกที่ไม่ผูกกับใครในผัง: ', 'note');
    for (const n of strays) li.append(personButton(n.id));
    root.append(li);
  }
  $('tree').replaceChildren(root);
  $('treeInfo').textContent = `${v.dynastyName} · ${v.nodes.length} คนในผัง · ยังมีชีวิต ${v.nodes.filter((n) => n.alive).length}` +
    (orphans.length ? ` · ขาดตอน ${orphans.length}` : '');
}

$('findMe').onclick = () => {
  const b = playerNodeId ? $('tree').querySelector<HTMLElement>(`[data-node="${CSS.escape(playerNodeId)}"]`) : null;
  b?.scrollIntoView({ block: 'center' });
  b?.focus();
};

// ---------------------------------------------------------------------------
// หน้าดูตัวละคร
// ---------------------------------------------------------------------------

let inspecting: string | null = null;

async function inspect(nodeId: string) {
  inspecting = nodeId;
  for (const b of document.querySelectorAll<HTMLElement>('.person')) b.classList.toggle('selected', b.dataset.node === nodeId);
  try {
    renderInspect(await engine.request({ type: 'viewCharacter', nodeId }));
  } catch (e) {
    // คนนี้ถูกยุบออกจากผังไปแล้ว (prune) — ปิดหน้าแล้วบอกเหตุ
    closeInspect();
    status.textContent = errorText(e);
  }
}

function closeInspect() {
  inspecting = null;
  $('inspect').hidden = true;
  for (const b of document.querySelectorAll<HTMLElement>('.person.selected')) b.classList.remove('selected');
}

function renderInspect(v: InspectView) {
  const box = $('inspect');
  const top = el('div', undefined, 'top');
  top.append(el('h2', `${v.sex === 'm' ? '♂' : '♀'} ${v.name}`), button('ปิด', closeInspect));
  const dl = el('dl');
  for (const [k, val] of v.facts) dl.append(el('dt', k), el('dd', val));
  box.replaceChildren(top, el('div', `${v.lifespan} · ${v.status}`, 'note'), dl);
  for (const s of v.sections) {
    const ul = el('ul');
    for (const i of s.items) ul.append(el('li', i));
    box.append(el('h3', s.title), ul);
  }
  box.hidden = false;
}

// ---------------------------------------------------------------------------
// เซฟ/โหลด
// ---------------------------------------------------------------------------

let slots: SaveSlotInfo[] = [];

async function refreshSlots() {
  try {
    slots = (await engine.request({ type: 'listSaves' })).sort((a, b) => b.savedAt - a.savedAt);
  } catch (e) {
    $('slots').replaceChildren(el('p', `อ่านรายการเซฟไม่ได้: ${errorText(e)}`, 'note'));
    return;
  }
  const box = $('slots');
  if (!slots.length) {
    box.replaceChildren(el('p', 'ยังไม่มีเซฟ — เดินเวลาแล้วเกมจะบันทึกอัตโนมัติในช่อง "autosave"', 'note'));
    return;
  }
  box.replaceChildren(...slots.map((s) => {
    const row = el('div', undefined, 'slot');
    const info = el('div', undefined, 'info');
    const when = new Date(s.savedAt).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
    info.append(
      el('b', s.slot === 'autosave' ? 'autosave (บันทึกอัตโนมัติ)' : s.slot),
      el('span', `พ.ศ. ${s.year} · ${s.playerName} · ${s.dynastyName} · ${when} · ${(s.bytes / 1024).toFixed(0)} KB`, 'note'),
    );
    const del = button('ลบ', () => void removeSlot(s.slot));
    row.append(info, button('โหลด', () => void start(s.slot)), del);
    return row;
  }));
  setBusy(busy);
}

async function removeSlot(slot: string) {
  if (!confirm(`ลบเซฟ "${slot}"? ลบแล้วกู้คืนไม่ได้`)) return;
  try {
    await engine.request({ type: 'deleteSave', slot });
    status.textContent = `ลบเซฟ "${slot}" แล้ว`;
  } catch (e) {
    status.textContent = `ลบไม่สำเร็จ: ${errorText(e)}`;
  }
  await refreshSlots();
}

$('saveForm').onsubmit = async (e) => {
  e.preventDefault();
  const slot = $<HTMLInputElement>('slotName').value.trim();
  if (slots.some((s) => s.slot === slot) && !confirm(`ช่อง "${slot}" มีเซฟอยู่แล้ว บันทึกทับ?`)) return;
  try {
    const s = await engine.request({ type: 'save', slot });
    status.textContent = `บันทึก "${s.slot}" แล้ว (${(s.bytes / 1024).toFixed(1)} KB)`;
  } catch (err) {
    status.textContent = `บันทึกไม่สำเร็จ: ${errorText(err)}`;
  }
  await refreshSlots();
};

// ---------------------------------------------------------------------------
// event + เดินเวลา
// ---------------------------------------------------------------------------

function renderEvent(ev: EventView) {
  const box = $('event');
  box.replaceChildren(el('h2', ev.title), el('p', ev.text));
  if (ev.triggered.length) box.append(el('p', `ใจสั่นขึ้นมา… (${ev.triggered.join(', ')})`, 'triggered'));
  for (const o of ev.options) {
    const b = el('button', o.locked ? `🔒 ${o.text}` : o.text, `opt${o.injected ? ' injected' : ''}`) as HTMLButtonElement;
    b.disabled = o.locked;
    b.onclick = async () => {
      box.replaceChildren();
      try {
        const r = await engine.request({ type: 'choose', instanceId: ev.instanceId, optionId: o.id });
        write(`→ ${o.text}`, 'choice');
        for (const l of r.lines) write(l, 'choice');
        // ยังไม่ได้เซฟ — บันทึกตอนเดินเวลาครั้งถัดไป (autosave) หรือกดบันทึกเอง
        status.textContent = 'ตัดสินใจแล้ว';
        eventPending = false;
        setBusy(false);
        await refresh();
      } catch (e) {
        // event ยังค้างอยู่ใน worker → แสดงใหม่ให้เลือกอีกครั้ง แทนที่จะปล่อยให้ปุ่มค้าง
        status.textContent = errorText(e);
        await showPending();
      }
    };
    box.append(b);
  }
  eventPending = true; // ต้องตัดสินใจก่อนเดินเวลาต่อ
  setBusy(false);
}

/** แสดง event ที่ worker ยังรออยู่ (หลังโหลดเซฟ หรือหลังเลือกตัวเลือกไม่สำเร็จ) */
async function showPending() {
  try {
    const events = await engine.request({ type: 'viewPending' });
    if (events[0]) {
      renderEvent(events[0]);
      status.textContent = 'รอการตัดสินใจ';
    } else {
      eventPending = false;
      setBusy(false);
    }
  } catch (e) {
    status.textContent = errorText(e);
  }
}

engine.onPush((p) => {
  switch (p.type) {
    case 'ready':
      status.textContent = 'พร้อม';
      void refreshSlots();
      break;
    case 'log':
      startYear(p.year);
      for (const l of p.lines) write(l.text, l.kind);
      break;
    case 'progress':
      status.textContent = `กำลังจำลอง… พ.ศ. ${p.year}`;
      break;
    case 'pendingEvent':
      renderEvent(p.event);
      break;
    case 'handover':
      write(`สิ้น${p.deceased} — ${p.heir} สืบทอดตระกูล`, 'inherit', 'handover-head');
      for (const l of p.lines) write(l, 'inherit', 'handover');
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
    if (r.stoppedBy === 'gameOver') hasGame = false;
    setBusy(false);
    await refresh();
    if (tab === 'saves') await refreshSlots();
  } catch (e) {
    status.textContent = errorText(e);
    setBusy(false);
  }
}

async function start(from: 'new' | string) {
  try {
    const v = from === 'new'
      ? await engine.request({ type: 'newGame', seed: Math.floor(Math.random() * 2 ** 31) })
      : await engine.request({ type: 'load', slot: from });
    hasGame = true;
    eventPending = false;
    clearLog();
    lastYear = 0;
    $('event').replaceChildren();
    closeInspect();
    startYear(v.year);
    write(from === 'new' ? `เริ่มชีวิตใหม่ในฐานะ ${v.name}` : `โหลดเซฟ "${from}": ${v.name}`, 'system');
    renderPlayer(v);
    renderDynasty(await engine.request({ type: 'viewDynasty' }));
    status.textContent = 'พร้อม';
    setBusy(false);
    showTab('log');
    await showPending();
    void requestPersistentStorage();
  } catch (e) {
    status.textContent = errorText(e);
  }
}

$('new').onclick = () => start('new');
$('month').onclick = () => run(30);
$('year').onclick = () => run(360);
$('decade').onclick = () => run(3600);
$('pause').onclick = () => engine.request({ type: 'pause' }).catch((e: Error) => (status.textContent = e.message));
showTab('saves');
