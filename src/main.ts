import { EngineClient, requestPersistentStorage } from './engine/client';
import type {
  CharacterView, ChoiceResult, ClockState, DynastyView, MatchView, EndingView, EventView, InspectView, IntentPlanView, KnownPersonView, LogKind, SaveSlotInfo,
  TreeView,
} from './engine/protocol';
import { pickArt, type ArtManifest, type ArtStyle } from './art/select';

// UI บาง ๆ: ไม่มี game logic, ไม่มี state ของเกม — ทุกอย่างถามจาก Worker

const engine = new EngineClient();

// คลังภาพ (public/art/manifest.json จาก npm run art:ingest) — โหลดไม่ได้ก็เล่นได้ตามปกติ แค่ไม่มีภาพ
let artManifest: ArtManifest | null = null;
void fetch('art/manifest.json').then((r) => (r.ok ? r.json() : null)).then((m: ArtManifest | null) => (artManifest = m)).catch(() => {});
function artFigure(style: ArtStyle, tags: readonly string[] | undefined): HTMLElement[] {
  const a = tags ? pickArt(artManifest, style, tags) : null;
  if (!a) return [];
  const img = el('img') as HTMLImageElement;
  Object.assign(img, { src: a.file, alt: a.alt, width: a.width, height: a.height, decoding: 'async' });
  const fig = el('figure', undefined, `art ${style}`);
  fig.append(img);
  return [fig];
}
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
let lastYear = 0;
let hasGame = false;
let clock: ClockState = { playing: false, speed: 2, maxSpeed: 5, ended: false };

// ---------------- แท็บ: บันทึก / ผังตระกูล / เซฟ ----------------
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

// ---------------- บันทึก (log): แยกเป็นก้อนรายปี กรองตามหมวดได้ ----------------
const KIND_TH: Record<LogKind, string> = {
  family: 'ครอบครัว',
  death: 'การตาย',
  inherit: 'มรดก/สืบทอด',
  body: 'ร่างกาย',
  household: 'เรือน/ปม',
  daily: 'งานบ้าน',
  people: 'ผู้คน',
  career: 'ราชการ',
  history: 'บ้านเมือง',
  choice: 'การตัดสินใจ',
};
const KINDS = Object.keys(KIND_TH) as LogKind[];
// เก็บหมวดที่ซ่อน ไม่ใช่หมวดที่แสดง — หมวดที่เพิ่มทีหลังจะแสดงเองแม้ผู้เล่นเคยตั้งตัวกรองไว้
const shown = new Set<LogKind>(KINDS.filter((k) => !prefs.get<LogKind[]>('logHidden', []).includes(k)));
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
    prefs.set('logHidden', KINDS.filter((x) => !shown.has(x)));
    applyFilter();
  };
  const count = el('span', '', 'muted');
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
  lastYear = 0;
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

// ---------------- นาฬิกา: เวลาเดินเองใน worker, UI แค่สั่งเดิน/หยุด/ปรับความเร็ว ----------------
const modalOpen = () => !$('backdrop').hidden;

function renderClock() {
  const play = $<HTMLButtonElement>('play');
  play.textContent = clock.playing ? '⏸ หยุด' : '▶ เดิน';
  play.classList.toggle('playing', clock.playing);
  play.disabled = !hasGame || clock.ended || modalOpen();
  $<HTMLButtonElement>('slower').disabled = !hasGame || clock.speed <= 1;
  $<HTMLButtonElement>('faster').disabled = !hasGame || clock.speed >= clock.maxSpeed;
  $<HTMLButtonElement>('saveBtn').disabled = !hasGame;
  $('speed').textContent = '●'.repeat(clock.speed) + '○'.repeat(clock.maxSpeed - clock.speed);
  $('speed').title = `ความเร็ว ${clock.speed}/${clock.maxSpeed}`;
  status.textContent = clock.ended ? (clock.endReason === 'era' ? 'จบเรื่อง' : 'ตระกูลสิ้นสาย')
    : modalOpen() ? 'รอการตัดสินใจ' : clock.playing ? '' : 'หยุดเวลา';
}

async function clockCmd(cmd: { type: 'play' } | { type: 'pause' } | { type: 'setSpeed'; speed: number }) {
  let error: string | null = null;
  try {
    clock = await engine.request(cmd);
  } catch (e) {
    error = errorText(e);
  }
  renderClock();
  if (!error) return;
  status.textContent = error; // หลัง renderClock — ไม่งั้นข้อความสถานะทับ error หายเงียบ
  if (!modalOpen()) await showPending(); // เดินไม่ได้เพราะมี event ค้างที่ไม่ได้แสดง → แสดงให้เลือก
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
  box.replaceChildren(el('h2', 'ตัวละคร'), ...artFigure('portrait', v.portraitTags));
  const who = el('div');
  who.append(button(`${v.title ? v.title + ' ' : ''}${v.name}`, () => void inspect(v.nodeId), 'who'), ` อายุ ${v.age} ปี (พ.ศ. ${v.year})`);
  box.append(who);
  box.append(el('div', `ชนชั้น: ${v.estate} · ทรัพย์ ${v.wealth} ตำลึง`));
  if (v.office) box.append(el('h2', 'ราชการ'), el('div', v.office, 'lifestyle'));
  const list = (title: string, items: string[]) => {
    if (!items.length) return;
    box.append(el('h2', title));
    const ul = el('ul');
    for (const i of items) ul.append(el('li', i));
    box.append(ul);
  };
  list('ปมในใจ', v.traits);
  list('ร่องรอยบนร่างกาย', [...v.scars, ...v.wounds.map((w) => `แผลสด ${w}`)]);
  list('ฝีมือ', v.craftSkills);
  list('ความสามารถทางกาย', Object.entries(v.capabilities).filter(([, x]) => x < 1).map(([k, x]) => `${k}: ${Math.round(x * 100)}%`));
  box.append(el('h2', 'วิถีชีวิต'), el('div', v.lifestyle, 'lifestyle'));
  for (const line of v.marriage) box.append(el('div', line, 'intent'));
  if (v.intent) {
    const i = v.intent;
    const card = el('div', undefined, 'intent');
    const head = el('div', undefined, 'row');
    const quit = button('เลิก', async () => {
      const r = await engine.request({ type: 'abandonIntent' });
      for (const l of r.lines) write(l, 'choice');
      await refresh();
    });
    quit.title = 'เลิกความตั้งใจนี้';
    head.append(el('strong', `ตั้งใจ${i.title}`), quit);
    const bar = el('progress') as HTMLProgressElement;
    Object.assign(bar, { max: 100, value: i.progress });
    bar.setAttribute('aria-label', `คืบหน้า ${i.progress}%`);
    card.append(head, el('div', i.approach, 'muted'), bar, el('div', `อีกราว ${i.monthsLeft} เดือน · โอกาสสำเร็จ ${i.odds}%`));
    card.title = i.factors.map((f) => `${f.value > 0 ? '+' : ''}${f.value}% ${f.label}`).join('\n');
    box.append(card);
  }
  playerNodeId = v.nodeId;
}

// ---------------- คนที่รู้จัก: ญาติ (พับไว้) + คนนอกตระกูล พร้อมปุ่มสิ่งที่ตั้งใจทำได้ ----------------
let kinOpen = false;

function personRow(p: KnownPersonView): HTMLElement {
  const row = el('div', undefined, `person${p.focus ? ' focus' : ''}`);
  const who = el('div');
  who.append(button(p.name, () => void inspect(p.nodeId), 'who'), document.createTextNode(` ${p.age} ปี · `), el('span', p.tie, 'tie'));
  row.append(who, el('div', p.detail, 'muted'));
  if (p.actions.length) {
    const acts = el('div', undefined, 'acts');
    for (const a of p.actions) acts.append(button(a.label, () => void openPlan(p.id, a.kind)));
    row.append(acts);
  }
  return row;
}

function renderKnown(people: KnownPersonView[]) {
  const box = $('known');
  const head = el('div', undefined, 'panelhead');
  head.append(el('h2', 'คนที่รู้จัก'), button('หาคู่', () => void openMatches()));
  box.replaceChildren(head);
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

/** ปุ่มหาคู่: ได้รายชื่อมาดูตัว เลือกแล้วไปเกี้ยว (ยังไม่มีคู่) หรือรับเป็นเมียน้อย — หยุดเวลาไว้ระหว่างเลือก */
async function openMatches() {
  if (modalOpen()) return;
  const wasPlaying = clock.playing;
  if (wasPlaying) await clockCmd({ type: 'pause' });
  if (modalOpen()) return;
  const resume = () => {
    if (wasPlaying && !modalOpen()) void clockCmd({ type: 'play' });
  };
  let v: MatchView;
  try {
    v = await engine.request({ type: 'findMatches' });
  } catch (e) {
    status.textContent = `หาคู่ไม่ได้: ${errorText(e)}`;
    resume();
    return;
  }
  await refresh();
  const rows = v.people.map((p) => {
    const row = el('div', undefined, 'match');
    const info = el('div');
    info.append(el('strong', `${p.name} · ${p.age} ปี`), el('div', p.detail, 'muted'));
    const fig = artFigure('portrait', p.portraitTags);
    row.append(...(fig.length ? fig : [el('div')]), info);
    const pick = v.mode === 'court'
      ? button('เกี้ยว / ทาบทาม', async () => {
        await engine.request({ type: 'dropMatches', keepId: p.id });
        closeModal();
        await refresh();
        await openPlan(p.id, 'court', wasPlaying);
      })
      : button('รับเป็นเมียน้อย', async () => {
        try {
          const evs = await engine.request({ type: 'proposeMinorWife', targetId: p.id });
          closeModal();
          await refresh();
          if (evs[0]) renderEvent(evs[0]);
        } catch (e) {
          modal.append(el('p', errorText(e), 'error'));
        }
      });
    row.append(pick);
    return row;
  });
  const none = button('ไม่เลือกใคร', async () => {
    await engine.request({ type: 'dropMatches' }).catch(() => {});
    closeModal();
    await refresh();
    resume();
  });
  const row = el('div', undefined, 'row');
  row.append(none);
  const intro = v.mode === 'court'
    ? 'ถามผู้ใหญ่ที่รู้จักหลายบ้านว่าบ้านไหนมีลูกหลานยังไม่ออกเรือน ได้ชื่อมาดังนี้ คนที่ไม่ได้เลือกจะห่างหายไป'
    : 'มีคนมาบอกว่าบ้านเหล่านี้มีลูกสาวที่พ่อแม่ยอมยกให้เป็นเมียน้อยของคนมีหน้ามีตา รับมาต้องเสียเงินและเมียหลวงย่อมไม่พอใจ';
  openModal(el('h2', 'หาคู่'), el('p', intro), ...rows, row);
}

/** หน้าเลือกวิธี: โอกาสสำเร็จ เวลาโดยประมาณ และชีวิตประจำวันที่จะเปลี่ยน — หยุดเวลาไว้ระหว่างเลือก */
async function openPlan(targetId: string, kind: string, playingBefore?: boolean) {
  if (modalOpen()) return;
  const wasPlaying = playingBefore ?? clock.playing;
  if (wasPlaying) await clockCmd({ type: 'pause' });
  // event เด้งขึ้นก่อนเวลาหยุดทัน — event มาก่อน ไม่เอาหน้าเลือกวิธีไปทับ
  if (modalOpen()) return;
  const resume = () => {
    if (wasPlaying && !modalOpen()) void clockCmd({ type: 'play' });
  };
  let plan: IntentPlanView;
  try {
    plan = await engine.request({ type: 'planIntent', targetId, kind });
  } catch (e) {
    status.textContent = errorText(e);
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
        write(`→ ตั้งใจ${plan.title}: ${a.label}`, 'choice');
        for (const l of r.lines) write(l, 'choice');
        await refresh();
        resume();
      } catch (e) {
        modal.append(el('p', errorText(e), 'error'));
      }
    };
    return b;
  });
  const back = button('ย้อนกลับ', () => {
    closeModal();
    resume();
  });
  const row = el('div', undefined, 'row');
  row.append(back);
  openModal(el('h2', plan.title), el('p', plan.text), ...(plan.replaces ? [el('p', plan.replaces, 'triggered')] : []), ...buttons, row);
}

function renderDynasty(v: DynastyView) {
  const box = $('dynasty');
  box.replaceChildren(el('h2', v.name));
  box.append(el('div', `บารมี ${v.prestige} · สมาชิกที่ยังมีชีวิต ${v.livingMembers} · ผังตระกูล ${v.familyNodes} คน`));
  if (v.taboos.length) {
    const ul = el('ul');
    for (const t of v.taboos) ul.append(el('li', t));
    box.append(el('h2', 'ข้อห้ามประจำตระกูล'), ul);
  }
  if (v.legends.length) {
    const ul = el('ul');
    for (const l of v.legends) {
      const li = el('li');
      li.append(...artFigure('chronicle', l.artTags), l.text);
      ul.append(li);
    }
    box.append(el('h2', 'ตำนานที่เล่าขาน'), ul);
  }
}

async function refresh() {
  renderPlayer(await engine.request({ type: 'viewPlayer' }));
  renderKnown(await engine.request({ type: 'viewKnown' }));
  renderDynasty(await engine.request({ type: 'viewDynasty' }));
  // ผังสร้างใหม่ทั้งก้อน — ทำตอนเวลาหยุด ไม่ทำทุก tick ระหว่างเดิน (ไม่งั้นเลื่อน/กดในผังไม่ได้)
  if (tab === 'tree' && !clock.playing) await refreshTree();
  if (inspecting) await inspect(inspecting, false);
}

// ---------------- ผังตระกูล: เริ่มจากต้นตระกูล ลูกซ้อนใต้พ่อแม่ คู่ครองคนนอกอยู่บรรทัดเดียวกับคู่ ----------------
let playerNodeId: string | null = null;
/** สายที่ผู้เล่นพับไว้ — คงไว้ตอนสร้างผังใหม่ */
const collapsed = new Set<string>();

async function refreshTree() {
  try {
    renderTree(await engine.request({ type: 'viewTree' }));
  } catch (e) {
    $('tree').replaceChildren(el('p', errorText(e), 'muted'));
  }
}

function renderTree(v: TreeView) {
  const byId = new Map(v.nodes.map((n) => [n.id, n]));
  const placed = new Set<string>();
  const branchesAt = new Map<string, TreeView['branches']>();
  for (const b of v.branches) branchesAt.set(b.rootNodeId, [...(branchesAt.get(b.rootNodeId) ?? []), b]);

  const personButton = (id: string) => {
    const n = byId.get(id)!;
    const cls = ['person', n.alive || n.drifted ? '' : 'dead', n.pruned ? 'pruned' : '', id === v.playerNodeId ? 'me' : '', id === inspecting ? 'selected' : '']
      .filter(Boolean).join(' ');
    const b = button(`${n.sex === 'm' ? '♂' : '♀'} ${n.name} (${n.birthYear}–${n.deathYear ?? ''})`, () => void inspect(id), cls);
    b.dataset.node = id;
    const frag = document.createDocumentFragment();
    frag.append(b);
    if (id === v.playerNodeId) frag.append(el('span', 'ผู้เล่น', 'badge'));
    if (id === v.headNodeId) frag.append(el('span', 'ผู้นำตระกูล', 'badge'));
    if (n.parentage) frag.append(el('span', ` ${n.parentage}`, 'muted'));
    if (n.pruned) frag.append(el('span', n.drifted ? ' แยกไปอยู่ที่อื่น' : ' เหลือแต่ชื่อ', 'muted'));
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
      line.append(el('span', ' ⚭ ', 'muted'));
      if (sp.marriedIn) {
        placed.add(sid);
        line.append(personButton(sid));
      } else {
        // ญาติแต่งกันเอง — คู่ครองมีบรรทัดของตัวเองอยู่ในสายพ่อแม่
        line.append(el('span', `${sp.name} (${sp.birthYear})`, 'muted'));
      }
    }
    const kids = [...new Set(n.childIds)].filter((k) => byId.has(k)).sort((a, b) => byId.get(a)!.birthYear - byId.get(b)!.birthYear);
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
        ul.append(el('li', `${byId.get(k)!.name} (${byId.get(k)!.birthYear}) — ดูในสายอีกฝั่ง`, 'muted'));
      } else ul.append(renderNode(k));
    }
    for (const b of branches) ul.append(el('li', `${b.label} — ${b.memberCount} คน ${b.generations} รุ่น (ยุบเหลือบรรทัดเดียว)`, 'muted'));
    const details = el('details') as HTMLDetailsElement;
    details.open = !collapsed.has(id);
    details.ontoggle = () => (details.open ? collapsed.delete(id) : collapsed.add(id));
    const summary = el('summary');
    summary.append(line);
    details.append(summary, ul);
    li.append(details);
    return li;
  };

  const box = $('tree');
  const scroll = box.scrollTop;
  const root = el('ul');
  if (byId.has(v.founderNodeId)) root.append(renderNode(v.founderNodeId));
  // ใครที่ไม่ถูกวางจากต้นตระกูล = ผังขาดตอน (เช่น prune ตัดพ่อแม่ทิ้ง) — โชว์ไว้ให้เห็น ไม่ซ่อน
  const orphans = v.nodes.filter((n) => !placed.has(n.id) && !n.marriedIn);
  for (const n of orphans) if (!placed.has(n.id)) root.append(renderNode(n.id));
  const strays = v.nodes.filter((n) => !placed.has(n.id) && n.marriedIn);
  if (strays.length) {
    const li = el('li', 'คู่ครองที่ไม่ผูกกับใครในผัง: ', 'muted');
    for (const n of strays) li.append(personButton(n.id));
    root.append(li);
  }
  box.replaceChildren(root);
  box.scrollTop = scroll;
  $('treeInfo').textContent = `${v.dynastyName} · ${v.nodes.length} คนในผัง · ยังมีชีวิต ${v.nodes.filter((n) => n.alive).length}` +
    (orphans.length ? ` · ขาดตอน ${orphans.length}` : '');
}

$('findMe').onclick = () => {
  const b = playerNodeId ? $('tree').querySelector<HTMLElement>(`[data-node="${CSS.escape(playerNodeId)}"]`) : null;
  b?.scrollIntoView({ block: 'center' });
  b?.focus();
};

// ---------------- หน้าดูตัวละคร ----------------
let inspecting: string | null = null;

async function inspect(nodeId: string, reveal = true) {
  inspecting = nodeId;
  for (const b of document.querySelectorAll<HTMLElement>('#tree .person')) b.classList.toggle('selected', b.dataset.node === nodeId);
  try {
    renderInspect(await engine.request({ type: 'viewCharacter', nodeId }), reveal);
  } catch (e) {
    // คนนี้ถูกยุบออกจากผังไปแล้ว (prune) — ปิดหน้าแล้วบอกเหตุ
    closeInspect();
    status.textContent = errorText(e);
  }
}

function closeInspect() {
  inspecting = null;
  $('sheet').hidden = true;
  for (const b of document.querySelectorAll<HTMLElement>('#tree .person.selected')) b.classList.remove('selected');
}

function renderInspect(v: InspectView, reveal: boolean) {
  const box = $('inspect');
  // เปิดคนใหม่ → เริ่มอ่านจากบนสุด (refresh คนเดิมระหว่างเวลาเดินไม่เลื่อน)
  if (box.dataset.node !== v.nodeId) box.scrollTop = 0;
  box.dataset.node = v.nodeId;
  const top = el('div', undefined, 'top');
  top.append(el('h2', `${v.sex === 'm' ? '♂' : '♀'} ${v.name}`), button('ปิด', closeInspect));
  const dl = el('dl');
  for (const [k, val] of v.facts) {
    const dd = el('dd');
    const people = v.links?.[k];
    if (people) people.forEach((p, i) => dd.append(...(i ? [document.createTextNode(k === 'บิดามารดา' ? ' · ' : ', ')] : []), button(p.name, () => void inspect(p.nodeId), 'who')));
    else dd.textContent = val;
    dl.append(el('dt', k), dd);
  }
  box.replaceChildren(top, ...artFigure('portrait', v.portraitTags), el('div', `${v.lifespan} · ${v.status}`, 'muted'), dl);
  for (const s of v.sections) {
    const ul = el('ul');
    for (const i of s.items) ul.append(el('li', i));
    box.append(el('h3', s.title), ul);
  }
  // refresh ระหว่างเวลาเดินแค่อัปเดตเนื้อหา — ไม่เปิดหน้าต่างที่ผู้เล่นปิดไปแล้วขึ้นมาใหม่
  if (reveal || !$('sheet').hidden) $('sheet').hidden = false;
}

// ปิดหน้าดูตัวละคร: คลิกพื้นหลัง หรือกด Esc (เมื่อไม่มีหน้าต่าง event ทับอยู่)
$('sheet').onclick = (e) => {
  if (e.target === $('sheet')) closeInspect();
};
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !$('sheet').hidden && $('backdrop').hidden) closeInspect();
});

// ---------------- เซฟ/โหลด ----------------
let slots: SaveSlotInfo[] = [];

async function refreshSlots() {
  try {
    slots = (await engine.request({ type: 'listSaves' })).sort((a, b) => b.savedAt - a.savedAt);
  } catch (e) {
    $('slots').replaceChildren(el('p', `อ่านรายการเซฟไม่ได้: ${errorText(e)}`, 'muted'));
    return;
  }
  const box = $('slots');
  if (!slots.length) {
    box.replaceChildren(el('p', 'ยังไม่มีเซฟ — ระหว่างเวลาเดินเกมจะบันทึกอัตโนมัติให้เอง', 'muted'));
    return;
  }
  box.replaceChildren(...slots.map((s) => {
    const row = el('div', undefined, 'slot');
    const info = el('div', undefined, 'info');
    const when = new Date(s.savedAt).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
    info.append(
      el('b', s.slot === 'autosave' ? 'บันทึกอัตโนมัติ' : s.slot),
      el('span', `พ.ศ. ${s.year} · ${s.playerName} · ${s.dynastyName} · ${when} · ${(s.bytes / 1024).toFixed(0)} KB`, 'muted'),
    );
    row.append(info, button('โหลด', () => void start(s.slot)), button('ลบ', () => void removeSlot(s.slot)));
    return row;
  }));
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
  Object.assign(input, { value, required: true, maxLength: 20, pattern: '[฀-๿]+', title: 'อักษรไทย ไม่มีช่องว่าง' });
  input.setAttribute('aria-label', label);
  const ok = el('button', submitText) as HTMLButtonElement;
  const cancel = button('ย้อนกลับ', onCancel);
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
    write(`→ ${o.text}`, 'choice');
    for (const l of r.lines) write(l, 'choice');
    await refresh();
    if (r.result) return showResult(r.result); // เวลาหยุดรอจนกดรับทราบ
    await showPending(); // event ต่อเนื่อง (ถ้ามี) — ไม่มีแล้ว worker เดินเวลาต่อเอง
  } catch (e) {
    // event ยังค้างอยู่ใน worker → แสดงใหม่ให้เลือกอีกครั้ง แทนที่จะปล่อยให้ปุ่มค้าง
    await showPending();
    modal.append(el('p', errorText(e), 'error'));
  }
}

/** หน้าผลของตัวเลือก: สำเร็จ/พลาด ค่าที่เปลี่ยน และความรู้สึกของคนใน event (−100..100) */
function showResult(r: ChoiceResult) {
  const parts: Node[] = [el('h2', r.title), el('p', `→ ${r.did}`, 'muted')];
  if (r.outcome) parts.push(el('p', r.outcome.text, r.outcome.failed ? 'outcome bad' : 'outcome good'));
  if (r.changes.length) {
    const ul = el('ul', undefined, 'changes');
    for (const c of r.changes) {
      const li = el('li', `${c.label} `);
      li.append(el('b', c.delta, c.good ? 'up' : 'down'));
      ul.append(li);
    }
    parts.push(ul);
  }
  for (const rel of r.relations) {
    const row = el('div', undefined, 'rel');
    const d = rel.after - rel.before;
    row.append(el('span', rel.who), el('b', `${rel.before > 0 ? '+' : ''}${rel.before} → ${rel.after > 0 ? '+' : ''}${rel.after}`, d >= 0 ? 'up' : 'down'));
    const bar = el('div', undefined, 'opbar');
    const fill = el('i');
    // แถบ −100..100: กลางคือ 0
    fill.style.left = `${50 + Math.min(0, rel.after) / 2}%`;
    fill.style.width = `${Math.abs(rel.after) / 2}%`;
    fill.className = rel.after >= 0 ? 'pos' : 'neg';
    bar.append(fill);
    row.append(bar);
    parts.push(row);
  }
  const ok = button('รับทราบ', async () => {
    closeModal();
    await engine.request({ type: 'resume' }).catch(() => {});
    await showPending();
  });
  ok.classList.add('opt');
  parts.push(ok);
  openModal(...parts);
  queueMicrotask(() => ok.focus());
}

function renderEvent(ev: EventView) {
  const head = [el('h2', ev.title), ...artFigure('reality', ev.artTags), el('p', ev.text)];
  if (ev.triggered.length) head.push(el('p', `ใจสั่นขึ้นมา… (${ev.triggered.join(', ')})`, 'triggered'));
  const buttons = ev.options.map((o) => {
    const b = el('button', o.locked ? `🔒 ${o.text}` : o.text, `opt${o.injected ? ' injected' : ''}${o.note && !o.locked ? ' strained' : ''}`) as HTMLButtonElement;
    if (o.hint) b.append(el('span', o.hint, 'note hint'));
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

// ---------------- หน้าสรุปตอนจบ: ถึงปีจบของเรื่อง หรือตระกูลสิ้นสาย ----------------
let endingShown = false;

async function showEnding() {
  endingShown = true;
  let v: EndingView;
  try {
    v = await engine.request({ type: 'viewEnding' });
  } catch (e) {
    status.textContent = errorText(e);
    return;
  }
  const dl = el('dl');
  for (const [k, val] of v.facts) dl.append(el('dt', k), el('dd', val));
  const parts: Node[] = [el('h2', v.title), el('p', v.text), dl];
  for (const s of v.sections) {
    const ul = el('ul');
    for (const i of s.items) ul.append(el('li', i));
    parts.push(el('h3', s.title), ul);
  }
  const row = el('div', undefined, 'row');
  row.append(
    button('ดูผังตระกูล', () => {
      closeModal();
      showTab('tree');
    }),
    button('เริ่มใหม่', () => void $('new').click()),
  );
  openModal(...parts, row);
}

/** แสดง event ที่ worker ยังรออยู่ (หลังโหลดเซฟ หรือหลังเลือกตัวเลือกไม่สำเร็จ) */
async function showPending() {
  try {
    const events = await engine.request({ type: 'viewPending' });
    if (events[0]) renderEvent(events[0]);
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
      $('date').textContent = p.solar;
      $('lunar').textContent = p.lunar;
      refreshSoon();
      break;
    case 'clock':
      clock = p.clock;
      renderClock();
      if (clock.ended && !endingShown && !modalOpen()) void showEnding();
      if (!clock.playing) {
        void refresh().catch(() => {});
        if (tab === 'saves') void refreshSlots(); // หยุดแล้วเพิ่ง autosave
      }
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

async function start(from: 'new' | string, heroName?: string) {
  try {
    const v = from === 'new'
      ? await engine.request({ type: 'newGame', seed: Math.floor(Math.random() * 2 ** 31), heroName })
      : await engine.request({ type: 'load', slot: from });
    clearLog();
    closeModal();
    closeInspect();
    endingShown = false;
    collapsed.clear();
    startYear(v.year);
    write(from === 'new' ? `เริ่มชีวิตใหม่ในฐานะ${v.name}` : `โหลดเซฟ "${from}": ${v.name}`, 'system');
    renderPlayer(v);
    renderKnown(await engine.request({ type: 'viewKnown' }));
    renderDynasty(await engine.request({ type: 'viewDynasty' }));
    $('date').textContent = v.solar;
    $('lunar').textContent = v.lunar;
    hasGame = true;
    clock = await engine.request({ type: 'pause' }); // เริ่ม/โหลดแล้วเวลาหยุดรอ ผู้เล่นกดเดินเอง
    renderClock();
    showTab('log');
    if (clock.ended) await showEnding();
    else await showPending();
    void requestPersistentStorage();
  } catch (e) {
    status.textContent = errorText(e);
    if (from === 'new' && !modal.querySelector('.error')) modal.append(el('p', errorText(e), 'error'));
  }
}

$('new').onclick = async () => {
  if (clock.playing) await clockCmd({ type: 'pause' });
  openModal(
    el('h2', 'เริ่มชีวิตใหม่'),
    el('p', 'ลูกชายคนโตวัย 7 ขวบของขุนนางชั้นผู้น้อย ปลายกรุงศรีอยุธยา พ.ศ. 2288'),
    nameForm('ชื่อตัวละคร', 'บุญมา', 'เริ่ม', (name) => void start('new', name), closeModal),
  );
};
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
showTab('saves');
