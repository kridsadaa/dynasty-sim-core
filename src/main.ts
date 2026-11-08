import { EngineClient, requestPersistentStorage } from './engine/client';
import type {
  CharacterView, ChoiceResult, ClockState, DeathNotice, DynastyView, HouseholdView, InteractionView, MatchView, EndingView, EventView, InspectView, IntentPlanView, KnownPersonView, LogKind, SaveSlotInfo,
  SkillsView, StatusBadge, TreeView,
} from './engine/protocol';
import { pickArt, type ArtManifest, type ArtStyle } from './art/select';
import { canPromptInstall, initPwa, installOffered, isIOS, promptInstall } from './pwa';
import { APP_VERSION, BUILD_DATE, CHANGELOG, CREATOR, GIT_HASH, REPO_URL, releaseNotes, thaiDate, type ChangelogEntry } from './release';

// UI บาง ๆ: ไม่มี game logic, ไม่มี state ของเกม — ทุกอย่างถามจาก Worker

const engine = new EngineClient();

// คลังภาพ (public/art/manifest.json จาก npm run art:ingest) — โหลดไม่ได้ก็เล่นได้ตามปกติ แค่ไม่มีภาพ
let artManifest: ArtManifest | null = null;
void fetch('art/manifest.json').then((r) => (r.ok ? r.json() : null)).then((m: ArtManifest | null) => (artManifest = m)).catch(() => {});
function artFigure(style: ArtStyle, tags: readonly string[] | undefined, seed?: string): HTMLElement[] {
  const a = tags ? pickArt(artManifest, style, tags, seed) : null;
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
let clock: ClockState = { playing: false, speed: 2, maxSpeed: 5, ended: false, resumeAfter: false };

// ---------------- แท็บ: บันทึก / ตัวละคร (มือถือ) / คนที่รู้จัก / เรือน / วิชา / ผังตระกูล / เซฟ ----------------
type Tab = 'log' | 'player' | 'known' | 'house' | 'skills' | 'tree' | 'saves';
let tab: Tab = 'saves';

function showTab(next: Tab) {
  tab = next;
  document.querySelector('main')!.dataset.tab = next;
  for (const b of document.querySelectorAll<HTMLButtonElement>('.tabs button')) b.setAttribute('aria-selected', String(b.dataset.tab === next));
  for (const t of ['log', 'known', 'house', 'skills', 'tree', 'saves'] as const) $(`tab-${t}`).hidden = t !== next;
  if (next === 'tree' && hasGame) void refreshTree();
  if (next === 'saves') void refreshSlots();
}
for (const b of document.querySelectorAll<HTMLButtonElement>('.tabs button')) b.onclick = () => showTab(b.dataset.tab as Tab);
window.addEventListener('resize', () => {
  if (tab === 'player' && window.innerWidth > 800) showTab('log');
});
// ความสูงหัวเว็บจริง (มือถือ: นาฬิกาตัดบรรทัดได้) → CSS ใช้เว้นที่ให้หน้าต่าง event/ข้อมูลคน ไม่ให้หัวเว็บบัง
{
  const header = document.querySelector('header')!;
  const setHeaderH = () => document.documentElement.style.setProperty('--header-h', `${header.offsetHeight}px`);
  setHeaderH();
  new ResizeObserver(setHeaderH).observe(header);
}

/** สร้างช่องข้อความที่จองความกว้างเท่าคำที่ยาวที่สุด (data-max) ไม่ให้ดิ้นหรือทับกัน */
function dSlot(text: string, maxText: string, cls?: string): HTMLElement {
  const sp = el('span', text, cls ? `d-slot ${cls}` : 'd-slot');
  sp.dataset.max = maxText;
  return sp;
}

/** แยกวันที่เป็นช่องความกว้างคงที่ตามคำที่ยาวที่สุดของแต่ละส่วน ไม่ให้ตัวหนังสือดิ้นไปมาระหว่างเวลาเดิน */
let shownDates = '';
function renderDates(solar: string, lunar: string) {
  // progress มาทุก tick แม้วันยังไม่เปลี่ยน — ไม่ต้องสร้างช่องใหม่ถ้าข้อความเดิม
  const key = `${solar}|${lunar}`;
  if (key === shownDates) return;
  shownDates = key;
  const sBox = $('date');
  const sParts = solar.split(' ');
  sBox.replaceChildren(
    dSlot(sParts[0] ?? '', '31', 'r'),
    dSlot(sParts[1] ?? '', 'เม.ย.', 'c'),
    dSlot(sParts[2] ? `พ.ศ. ${sParts[2]}` : '', 'พ.ศ. 2499'),
  );
  const lBox = $('lunar');
  const m = lunar.match(/^(\S+)\s+(ขึ้น|แรม)\s+(\d+)\s+ค่ำ\s+(เดือน(?:\s+\d+(?:\s+หลัง)?|\S+))\s+(ปี\S+)\s+(จ\.ศ\.\s*\d+)$/);
  if (m) {
    const phase = el('span', undefined, 'l-phase');
    phase.append(dSlot(m[2]!, 'แรม'), dSlot(m[3]!, '15', 'r'), el('span', 'ค่ำ'));
    lBox.replaceChildren(
      dSlot(m[1]!, 'วันพฤหัสบดี'),
      phase,
      dSlot(m[4]!, 'เดือน 8 หลัง'),
      dSlot(m[5]!, 'ปีมะเมีย'),
      dSlot(m[6]!, 'จ.ศ. 1299', 'l-cs'),
    );
  } else {
    lBox.textContent = lunar;
  }
}

/** หลอดยุคสมัย: ความกว้างตามจำนวนปี ยุคที่ยังไม่ถึงไม่บอกชื่อ */
function eraBarEl(segs: CharacterView['eraBar'], year: number): HTMLElement {
  const bar = el('div', '', 'era-bar');
  for (const g of segs) {
    const seg = el('div', g.name ?? '?', 'era-seg ' + g.state);
    seg.style.flex = String(g.to - g.from);
    seg.title = g.name ? g.name + ' (พ.ศ. ' + g.from + '–' + g.to + ')' : 'ยุคที่ยังมาไม่ถึง';
    if (g.state === 'now') seg.style.setProperty('--pos', String(Math.round(((year - g.from) / (g.to - g.from)) * 100)) + '%');
    bar.append(seg);
  }
  return bar;
}

function statusPills(badges: readonly StatusBadge[] | undefined): HTMLElement[] {
  if (!badges?.length) return [];
  const wrap = el('div', undefined, 'statuses');
  for (const s of badges) wrap.append(el('span', s.label, `pill ${s.tone}`));
  return [wrap];
}

// ---------------- บันทึก (log): แยกเป็นก้อนรายปี กรองตามหมวดได้ ----------------
const KIND_TH: Record<LogKind, string> = {
  family: 'ครอบครัว',
  death: 'การตาย',
  inherit: 'มรดก/สืบทอด',
  body: 'ร่างกาย',
  household: 'เรือน/ปม',
  daily: 'งานบ้าน',
  skill: 'วิชา',
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
  block.hidden = ![...block.querySelectorAll<HTMLElement>('[data-kind]')].some(lineVisible);
}

function applyFilter() {
  for (const p of log.querySelectorAll<HTMLElement>('[data-kind]')) p.hidden = !lineVisible(p);
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

function write(text: string, kind: LogKind | 'system', cls?: string, artTags?: readonly string[]) {
  const atBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 40;
  const target = yearBlock ?? log;
  // ภาพเหนือบรรทัด (หัวเหตุการณ์บ้านเมือง) — ซ่อน/แสดงตามตัวกรองเดียวกับบรรทัด
  for (const fig of artFigure('chronicle', artTags)) {
    fig.dataset.kind = kind;
    fig.hidden = !lineVisible(fig);
    target.append(fig);
  }
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
  // มีหน้าต่าง event: เวลาหยุดรออยู่แล้ว ปุ่มนี้สั่งว่าตัดสินใจเสร็จแล้วจะให้เดินต่อเองหรือหยุดค้างไว้
  const waiting = modalOpen() && !clock.playing;
  const running = clock.playing || (waiting && clock.resumeAfter);
  play.textContent = running ? (waiting ? '⏸ หยุดหลังเลือก' : '⏸ หยุด') : '▶ เดิน';
  play.classList.toggle('playing', running);
  play.disabled = !hasGame || clock.ended;
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
const togglePlay = async () => {
  if (modalOpen() && !clock.playing) {
    clock = await engine.request({ type: 'setResume', on: !clock.resumeAfter });
    renderClock();
    return;
  }
  return clockCmd(clock.playing ? { type: 'pause' } : { type: 'play' });
};
const changeSpeed = (d: number) => clockCmd({ type: 'setSpeed', speed: clock.speed + d });

// อัปเดตแผงตัวละคร/ตระกูลระหว่างเวลาเดิน — ไม่ถี่กว่า REFRESH_MS
const REFRESH_MS = 700;
let lastRefresh = 0;
function refreshSoon() {
  if (Date.now() - lastRefresh < REFRESH_MS) return;
  lastRefresh = Date.now();
  void refresh().catch(() => {});
}

function renderHouse(h: HouseholdView | undefined) {
  const box = $('house');
  if (!h) {
    box.replaceChildren(el('h2', 'เรือน'), el('div', 'ไม่ได้สังกัดเรือน', 'muted'));
    return;
  }
  box.replaceChildren(el('h2', `${h.title} — ${h.tierName}`));
  box.append(el('div', h.tierDesc, 'muted'));
  if (h.crowded) {
    box.append(...statusPills([{ label: `เรือนคับแคบ (${h.members}/${h.capacity} คน)`, tone: 'bad' }]));
  } else {
    box.append(...statusPills([{ label: `คนในเรือน ${h.members}/${h.capacity} คน`, tone: h.members >= h.capacity ? 'warn' : 'info' }]));
  }

  const summaryBox = el('div', undefined, 'house-box');
  summaryBox.style.marginTop = '8px';
  for (const l of h.lines) summaryBox.append(el('div', l, 'lifestyle'));
  box.append(summaryBox);

  // ขยายเรือน & ซื้อที่นา
  const estateActs = el('div', undefined, 'house-box');
  estateActs.append(el('h2', 'ขยับขยายเรือนและไร่นา'));
  if (!h.canManage) {
    estateActs.append(el('div', 'ต้องเป็นหัวเรือนหรือแม่เรือนจึงจะสั่งขยายเรือนและจัดการทรัพย์สินในเรือนได้', 'muted'));
  }
  const actRow = el('div', undefined, 'care');
  if (h.expand) {
    const exp = h.expand;
    const b = button(`ปลูกขยายเป็น${exp.nextName} (จุ ${exp.nextCapacity} คน · ${exp.cost} ตำลึง)`, async () => {
      try {
        const r = await engine.request({ type: 'expandHouse' });
        write(r.line, 'household');
        renderPlayer(r.player);
      } catch (e) {
        status.textContent = errorText(e);
      }
    });
    b.disabled = !exp.canAfford;
    actRow.append(b);
  } else {
    actRow.append(el('span', 'ขยายเรือนถึงขั้นสูงสุดแล้ว', 'muted'));
  }
  if (h.buyLand) {
    const bl = h.buyLand;
    const b = button(`ซื้อที่นาและสวนเพิ่ม (${bl.cost} ตำลึง · ได้ผลผลิตปีละ ~4 ตำลึง)`, async () => {
      try {
        const r = await engine.request({ type: 'buyLand' });
        write(r.line, 'household');
        renderPlayer(r.player);
      } catch (e) {
        status.textContent = errorText(e);
      }
    });
    b.disabled = !bl.canAfford;
    actRow.append(b);
  }
  estateActs.append(actRow);
  box.append(estateActs);

  // จัดการบ่าวไพร่และทาสในเรือน
  const servantBox = el('div', undefined, 'house-box');
  servantBox.append(el('h2', 'บ่าวไพร่และทาสในเรือน'));
  const servantRow = el('div', undefined, 'care');
  if (h.slaveActions) {
    const sa = h.slaveActions;
    const buyBtn = button(`ไถ่ทาสเข้าเรือนเพิ่ม (${sa.buyCost} ตำลึง)`, async () => {
      try {
        const r = await engine.request({ type: 'buySlave' });
        write(r.line, 'household');
        renderPlayer(r.player);
      } catch (e) {
        status.textContent = errorText(e);
      }
    });
    buyBtn.disabled = !sa.canBuy;
    servantRow.append(buyBtn);

    if (sa.canFree) {
      const freeBtn = button('ปล่อยทาสเป็นไท 1 คน (ได้บุญ)', async () => {
        if (!confirm('ปล่อยทาสในเรือนให้พ้นจากความเป็นทาส 1 คน?')) return;
        try {
          const r = await engine.request({ type: 'freeSlave' });
          write(r.line, 'household');
          renderPlayer(r.player);
        } catch (e) {
          status.textContent = errorText(e);
        }
      });
      servantRow.append(freeBtn);
    }
  }
  if (h.slaveConcubine) {
    servantRow.append(button('รับทาสหญิงในเรือนเป็นเมียน้อย', () => void openMatches('findSlaveConcubines')));
  }
  if (servantRow.childNodes.length) servantBox.append(servantRow);

  if (h.slaveTask) {
    const tRow = el('div', undefined, 'care');
    tRow.append(el('span', 'หน้าที่ทาส:', 'muted'));
    for (const o of h.slaveTask.options) {
      const b = button(o.label, async () => {
        try {
          renderPlayer(await engine.request({ type: 'setSlaveTask', task: o.id }));
        } catch (e) {
          status.textContent = errorText(e);
        }
      }, o.id === h.slaveTask.current ? 'on' : undefined);
      b.title = o.note;
      b.setAttribute('aria-pressed', String(o.id === h.slaveTask.current));
      tRow.append(b);
    }
    servantBox.append(tRow);
    servantBox.append(el('div', h.slaveTask.options.find((o) => o.id === h.slaveTask!.current)!.note, 'muted'));
  }

  if (h.care) {
    const row = el('div', undefined, 'care');
    row.append(el('span', 'เลี้ยงดูทาส:', 'muted'));
    for (const o of h.care.options) {
      const b = button(o.label, async () => {
        try {
          renderPlayer(await engine.request({ type: 'setCare', care: o.id }));
        } catch (e) {
          status.textContent = errorText(e);
        }
      }, o.id === h.care.current ? 'on' : undefined);
      b.title = o.note;
      b.setAttribute('aria-pressed', String(o.id === h.care.current));
      row.append(b);
    }
    servantBox.append(row);
    servantBox.append(el('div', h.care.options.find((o) => o.id === h.care!.current)!.note, 'muted'));
  }
  box.append(servantBox);
}

let latestSkills: SkillsView | null = null;
let latestDynasty: DynastyView | null = null;

function renderSkillsAndLegacies() {
  const box = $('skills');
  box.replaceChildren(el('h2', 'การฝึกฝนวิชาและความชำนาญ'));
  if (latestSkills) {
    const s = latestSkills;
    box.append(el('div', !s.canFocus
      ? 'ยังตั้งใจฝึกวิชาไม่ได้ (ต้องอายุ 12 ปีขึ้นไปและไม่ได้อยู่ในสมณเพศ)'
      : 'เลือกสายวิชาที่ต้องการฝึกฝนยามว่าง (ค่าครูเดือนละ 0.5 ตำลึง) เพื่อเพิ่มความชำนาญทุกเดือน และสะสมความก้าวหน้าปลดล็อกขั้นวิชา', 'muted'));

    const anyCanUnlock = s.tracks.some((t) => t.canUnlock);
    $('tabBtnSkills').textContent = anyCanUnlock ? 'วิชา ★' : 'วิชา';
    $('tabBtnSkills').classList.toggle('ready', anyCanUnlock);

    const grid = el('div', undefined, 'track-grid');
    for (const tr of s.tracks) {
      const card = el('div', undefined, `track-card${tr.focused ? ' active' : ''}`);
      const head = el('div', undefined, 'panelhead');
      head.append(el('h2', tr.name));
      const focusBtn = button(tr.focused ? 'กำลังฝึกสายนี้' : 'เลือกฝึกสายนี้', async () => {
        try {
          const r = await engine.request({ type: 'setFocus', focus: tr.focused ? null : tr.id });
          write(r.line, 'choice');
          renderPlayer(r.player);
        } catch (e) {
          status.textContent = errorText(e);
        }
      }, tr.focused ? 'small on' : 'small');
      focusBtn.disabled = !s.canFocus;
      head.append(focusBtn);
      card.append(head, el('div', `${tr.focusLabel} — ${tr.focusDesc}`, 'muted'));

      const bar = el('progress') as HTMLProgressElement;
      Object.assign(bar, { max: 100, value: Math.min(100, tr.xp) });
      card.append(bar, el('div', `ความก้าวหน้าขั้นถัดไป: ${Math.min(100, tr.xp)}/100`, 'muted'));

      const nextPerk = tr.perks.find((p) => !p.unlocked);
      if (tr.canUnlock && nextPerk) {
        const uBtn = button(`ปลดล็อกวิชา: ${nextPerk.name}`, async () => {
          try {
            const r = await engine.request({ type: 'unlockPerk', trackId: tr.id });
            write(r.line, 'choice');
            renderPlayer(r.player);
          } catch (e) {
            status.textContent = errorText(e);
          }
        }, 'small');
        uBtn.style.marginTop = '6px';
        card.append(uBtn);
      }

      const ul = el('ul', undefined, 'perk-list');
      for (const p of tr.perks) {
        const isNext = p.id === nextPerk?.id;
        const li = el('li', undefined, `perk-item${p.unlocked ? ' unlocked' : isNext ? ' next' : ''}`);
        li.append(el('strong', `${p.unlocked ? '✓ ' : `${p.tier}. `}${p.name}`), el('div', p.desc));
        ul.append(li);
      }
      card.append(ul);
      grid.append(card);
    }
    box.append(grid);
  }

  if (latestDynasty) {
    const d = latestDynasty;
    const legHead = el('h2', `มรดกประจำตระกูล (${d.name})`);
    legHead.style.marginTop = '20px';
    box.append(legHead);
    box.append(el('div', `บารมีตระกูลสะสม ${d.prestige} แต้ม · ใช้บารมี ${d.nextLegacyCost} แต้มเพื่อจารึกมรดกขั้นถัดไป (ส่งผลติดตัวลูกหลานทุกรุ่น)${d.isHead ? '' : ' · เฉพาะผู้นำตระกูลจึงจะจารึกมรดกได้'}`, 'muted'));

    const lGrid = el('div', undefined, 'track-grid');
    for (const tr of d.legacies) {
      const card = el('div', undefined, `track-card${tr.level > 0 ? ' active' : ''}`);
      const head = el('div', undefined, 'panelhead');
      head.append(el('h2', `${tr.name} (${tr.level}/${tr.steps.length})`));
      if (tr.level < tr.steps.length) {
        const uBtn = button(`จารึกขั้นที่ ${tr.level + 1} (${d.nextLegacyCost} บารมี)`, async () => {
          try {
            const r = await engine.request({ type: 'unlockLegacy', trackId: tr.id });
            write(r.line, 'inherit');
            renderDynasty(r.dynasty);
            renderPlayer(r.player);
          } catch (e) {
            status.textContent = errorText(e);
          }
        }, 'small');
        uBtn.disabled = !tr.canUnlock;
        head.append(uBtn);
      }
      card.append(head, el('div', tr.desc, 'muted'));
      const ul = el('ul', undefined, 'perk-list');
      for (const s of tr.steps) {
        const isNext = s.tier === tr.level + 1;
        const li = el('li', undefined, `perk-item${s.unlocked ? ' unlocked' : isNext ? ' next' : ''}`);
        li.append(el('strong', `${s.unlocked ? '✓ ' : `${s.tier}. `}${s.name}`), el('div', s.desc));
        ul.append(li);
      }
      card.append(ul);
      lGrid.append(card);
    }
    box.append(lGrid);
  }
}

function renderPlayer(v: CharacterView) {
  $('tabBtnPlayer').textContent = `ตัวละคร (${v.name})`;
  const box = $('player');
  box.replaceChildren(el('h2', 'ตัวละคร'), ...artFigure('portrait', v.portraitTags));
  const who = el('div');
  who.append(button(`${v.title ? v.title + ' ' : ''}${v.name}`, () => void inspect(v.nodeId), 'who'), ` อายุ ${v.age} ปี (พ.ศ. ${v.year})`);
  box.append(who, ...statusPills(v.statuses));
  box.append(eraBarEl(v.eraBar, v.year));
  if (v.conditions.length) box.append(el('div', 'บ้านเมืองตอนนี้', 'muted'), ...statusPills(v.conditions));
  box.append(el('div', `ชนชั้น: ${v.estate} · ${v.purse > v.wealth ? `เงินใช้ในเรือน ${v.purse} ตำลึง (ของตัวเอง ${v.wealth})` : `ทรัพย์ ${v.wealth} ตำลึง`}`));
  if (v.office) box.append(el('h2', 'ราชการ'), el('div', v.office, 'lifestyle'));
  if (v.household) {
    const h = v.household;
    const head = el('div', undefined, 'panelhead');
    head.style.marginTop = '8px';
    head.append(el('h2', h.title), button('จัดการเรือน', () => showTab('house'), 'small'));
    box.append(head);
    if (h.lines[0]) box.append(el('div', h.lines[0], 'lifestyle'));
    if (h.lines[h.lines.length - 1] && h.lines.length > 1) box.append(el('div', h.lines[h.lines.length - 1]!, 'muted'));
  }
  renderHouse(v.household);
  latestSkills = v.skills;
  renderSkillsAndLegacies();
  const sHead = el('div', undefined, 'panelhead');
  sHead.style.marginTop = '8px';
  const perkReady = v.skills.tracks.some((t) => t.canUnlock);
  sHead.append(el('h2', 'วิชาและความชำนาญ'), button(perkReady ? 'ปลดล็อกวิชาได้ ★' : 'ฝึกวิชา', () => showTab('skills'), perkReady ? 'small ready' : 'small'));
  box.append(sHead);
  const unlockedPerks = v.skills.tracks.flatMap((t) => t.perks.filter((p) => p.unlocked).map((p) => p.name));
  if (unlockedPerks.length) box.append(el('div', `สำเร็จวิชา: ${unlockedPerks.join(' · ')}`, 'lifestyle'));
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

// ---------------- คนที่รู้จัก (แท็บแยก): คนในเรือน / ญาติต่างเรือน / คนนอกบ้าน พร้อมป้ายสถานะ ----------------
let houseKinOpen = true;
let otherKinOpen = true;

function personRow(p: KnownPersonView): HTMLElement {
  const row = el('div', undefined, `person${p.focus ? ' focus' : ''}`);
  const who = el('div');
  who.append(button(p.name, () => void inspect(p.nodeId), 'who'), document.createTextNode(` ${p.age} ปี · `), el('span', p.tie, 'tie'));
  const more = button('⋯', () => void openActions(p.id), 'more');
  more.title = `ทำอะไรกับ${p.name}`;
  more.setAttribute('aria-label', more.title);
  who.append(more);
  row.append(who, ...statusPills(p.statuses), el('div', p.detail, 'muted'));
  return row;
}

function renderKnown(people: KnownPersonView[]) {
  $('tabBtnKnown').textContent = people.length ? `คนที่รู้จัก (${people.length})` : 'คนที่รู้จัก';
  const box = $('known');
  const head = el('div', undefined, 'panelhead');
  head.append(el('h2', 'คนที่รู้จัก'), button('หาคู่', () => void openMatches()));
  box.replaceChildren(head);
  const inHouse = people.filter((p) => p.kin && p.inHousehold);
  const outKin = people.filter((p) => p.kin && !p.inHousehold);
  const others = people.filter((p) => !p.kin);
  if (inHouse.length) {
    const d = el('details') as HTMLDetailsElement;
    d.open = houseKinOpen;
    d.ontoggle = () => (houseKinOpen = d.open);
    d.append(el('summary', `คนในเรือนเดียวกัน (${inHouse.length})`), ...inHouse.map(personRow));
    box.append(d);
  }
  if (outKin.length) {
    const d = el('details') as HTMLDetailsElement;
    d.open = otherKinOpen;
    d.ontoggle = () => (otherKinOpen = d.open);
    d.append(el('summary', `ญาติต่างเรือน (${outKin.length})`), ...outKin.map(personRow));
    box.append(d);
  }
  const extHead = el('h2', `คนนอกบ้าน (${others.length})`);
  extHead.style.marginTop = '12px';
  box.append(extHead);
  if (!others.length) box.append(el('div', 'ยังไม่รู้จักใครนอกบ้าน', 'muted'));
  box.append(...others.map(personRow));
}

/** เมนู ⋯: สิ่งที่ทำกับคนนี้ได้ (ทำไม่ได้ก็บอกเหตุผล) — หยุดเวลาไว้ระหว่างเลือก */
async function openActions(targetId: string) {
  if (modalOpen()) return;
  const wasPlaying = clock.playing;
  if (wasPlaying) await clockCmd({ type: 'pause' });
  if (modalOpen()) return;
  const resume = () => {
    if (wasPlaying && !modalOpen()) void clockCmd({ type: 'play' });
  };
  let v: InteractionView;
  try {
    v = await engine.request({ type: 'viewInteractions', targetId });
  } catch (e) {
    status.textContent = errorText(e);
    resume();
    return;
  }
  const buttons = v.actions.map((a) => {
    const b = el('button', undefined, 'opt') as HTMLButtonElement;
    b.append(el('strong', a.label));
    if (a.problem) b.append(el('span', `ทำไม่ได้: ${a.problem}`, 'note'));
    else if (a.hint) b.append(el('span', a.hint, 'note'));
    b.disabled = !!a.problem;
    b.onclick = async () => {
      try {
        const r = await engine.request({ type: 'interact', targetId, action: a.id });
        closeModal();
        $('sheet').hidden = true;
        for (const l of r.lines) write(l, 'choice');
        await refresh();
        if (r.plan) return void openPlan(targetId, r.plan, wasPlaying);
        if (r.events?.[0]) return renderEvent(r.events[0]);
        resume();
      } catch (e) {
        modal.append(el('p', errorText(e), 'error'));
      }
    };
    return b;
  });
  const back = button('ปิด', () => {
    closeModal();
    resume();
  });
  const row = el('div', undefined, 'row');
  row.append(back);
  openModal(el('h2', `ทำอะไรกับ${v.name}`), ...buttons, row);
}

/** ปุ่มหาคู่ / เลือกบ่าวในเรือนเป็นเมียบ่าว: ได้รายชื่อมาดูตัว เลือกแล้วไปเกี้ยวหรือรับเป็นเมียน้อย — หยุดเวลาไว้ระหว่างเลือก */
async function openMatches(cmdType: 'findMatches' | 'findSlaveConcubines' = 'findMatches') {
  if (modalOpen()) return;
  const wasPlaying = clock.playing;
  if (wasPlaying) await clockCmd({ type: 'pause' });
  if (modalOpen()) return;
  const resume = () => {
    if (wasPlaying && !modalOpen()) void clockCmd({ type: 'play' });
  };
  let v: MatchView;
  try {
    v = await engine.request({ type: cmdType });
  } catch (e) {
    status.textContent = cmdType === 'findMatches' ? `หาคู่ไม่ได้: ${errorText(e)}` : errorText(e);
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
      : v.mode === 'slave_wife'
        ? button('รับเป็นเมียบ่าว (เมียน้อย)', async () => {
          try {
            const r = await engine.request({ type: 'takeSlaveConcubine', targetId: p.id });
            closeModal();
            for (const l of r.lines) write(l, 'choice');
            await refresh();
            resume();
          } catch (e) {
            modal.append(el('p', errorText(e), 'error'));
          }
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
  const title = v.mode === 'slave_wife' ? 'รับบ่าวในเรือนเป็นเมีย' : 'หาคู่';
  const intro = v.mode === 'court'
    ? 'ถามผู้ใหญ่ที่รู้จักหลายบ้านว่าบ้านไหนมีลูกหลานยังไม่ออกเรือน ได้ชื่อมาดังนี้ คนที่ไม่ได้เลือกจะห่างหายไป'
    : v.mode === 'slave_wife'
      ? 'บ่าวหญิงในเรือนที่พอจะยกขึ้นเป็นเมียบ่าว (เมียน้อย) ได้มีดังนี้ หากรับมาเมียหลวงย่อมไม่พอใจหนัก'
      : 'มีคนมาบอกว่าบ้านเหล่านี้มีลูกสาวที่พ่อแม่ยอมยกให้เป็นเมียน้อยของคนมีหน้ามีตา รับมาต้องเสียเงินและเมียหลวงย่อมไม่พอใจ';
  openModal(el('h2', title), el('p', intro), ...rows, row);
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
  latestDynasty = v;
  renderSkillsAndLegacies();
  const box = $('dynasty');
  const head = el('div', undefined, 'panelhead');
  head.append(el('h2', v.name), button('มรดกตระกูล', () => showTab('skills'), 'small'));
  box.replaceChildren(head);
  box.append(el('div', `บารมี ${v.prestige} · สมาชิกที่ยังมีชีวิต ${v.livingMembers} · ผังตระกูล ${v.familyNodes} คน`));
  const unlockedLegacies = v.legacies.filter((l) => l.level > 0).map((l) => `${l.name} ขั้น ${l.level}`);
  if (unlockedLegacies.length) {
    box.append(el('div', `มรดกตระกูล: ${unlockedLegacies.join(' · ')}`, 'muted'));
  }
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
type InspectTab = 'info' | 'mind' | 'lore';
let inspectTab: InspectTab = 'info';

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

const MIND_TITLES = new Set(['ร่างกาย', 'ร่องรอยบนร่างกาย', 'ปมในใจ (รวมปมแฝง)', 'ปมที่คนยังจำได้', 'นิสัย', 'ความทรงจำที่ฝังใจ']);
const LORE_TITLES = new Set(['ทักษะ', 'กฎในเรือน', 'ตำนานที่เล่าถึงคนนี้']);

function renderInspect(v: InspectView, reveal: boolean) {
  const box = $('inspect');
  const prevBody = box.querySelector<HTMLElement>('.inspect-body');
  const isNewPerson = box.dataset.node !== v.nodeId;
  const savedScroll = isNewPerson ? 0 : (prevBody?.scrollTop ?? 0);
  if (isNewPerson) inspectTab = 'info';
  box.dataset.node = v.nodeId;

  const head = el('div', undefined, 'inspect-head');
  const top = el('div', undefined, 'top');
  top.append(el('h2', `${v.sex === 'm' ? '♂' : '♀'} ${v.name}`));
  if (v.characterId) {
    const id = v.characterId;
    top.append(button('⋯ ทำอะไรกับคนนี้', () => void openActions(id)));
  }
  top.append(button('ปิด', closeInspect));
  head.append(top, el('div', `${v.lifespan} · ${v.status}`, 'muted'), ...statusPills(v.statuses));

  const infoSections = v.sections.filter((s) => !MIND_TITLES.has(s.title) && !LORE_TITLES.has(s.title));
  const mindSections = v.sections.filter((s) => MIND_TITLES.has(s.title));
  const loreSections = v.sections.filter((s) => LORE_TITLES.has(s.title));

  if (inspectTab === 'mind' && !mindSections.length) inspectTab = 'info';
  if (inspectTab === 'lore' && !loreSections.length) inspectTab = 'info';

  const tabBar = el('div', undefined, 'inspect-tabs');
  const tabs: Array<{ id: InspectTab; label: string; show: boolean }> = [
    { id: 'info', label: 'ข้อมูลและครอบครัว', show: true },
    { id: 'mind', label: 'กายและใจ', show: mindSections.length > 0 },
    { id: 'lore', label: 'ฝีมือและเรื่องเล่า', show: loreSections.length > 0 },
  ];
  for (const t of tabs) {
    if (!t.show) continue;
    const b = button(t.label, () => {
      inspectTab = t.id;
      renderInspect(v, false);
    });
    b.setAttribute('aria-selected', String(inspectTab === t.id));
    tabBar.append(b);
  }

  const body = el('div', undefined, 'inspect-body');
  const appendSections = (list: InspectView['sections']) => {
    for (const s of list) {
      const ul = el('ul');
      for (const i of s.items) ul.append(el('li', i));
      body.append(el('h3', s.title), ul);
    }
  };

  if (inspectTab === 'info') {
    const dl = el('dl');
    for (const [k, val] of v.facts) {
      const dd = el('dd');
      const people = v.links?.[k];
      if (people) people.forEach((p, i) => dd.append(...(i ? [document.createTextNode(k === 'บิดามารดา' ? ' · ' : ', ')] : []), button(p.name, () => void inspect(p.nodeId), 'who')));
      else dd.textContent = val;
      dl.append(el('dt', k), dd);
    }
    const figs = artFigure('portrait', v.portraitTags);
    if (figs.length) {
      const overview = el('div', undefined, 'inspect-overview');
      overview.append(...figs, dl);
      body.append(overview);
    } else {
      body.append(dl);
    }
    appendSections(infoSections);
  } else if (inspectTab === 'mind') {
    appendSections(mindSections);
  } else {
    appendSections(loreSections);
  }

  box.replaceChildren(head, ...(tabBar.childNodes.length > 1 ? [tabBar] : []), body);
  body.scrollTop = savedScroll;
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
  queueMicrotask(maybeSuggestInstall); // หน้าต่างแนะนำติดตั้งรอจนไม่มีหน้าต่างอื่นค้าง
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
    // ผู้เล่นตายเพราะผลของตัวเลือก (ไม่มีหน้าผล) → หน้าแจ้งการตายเปิดอยู่แล้ว อย่าปิดทับ
    if (!deathNoticeOpen) closeModal();
    write(`→ ${o.text}`, 'choice');
    for (const l of r.lines) write(l, 'choice');
    await refresh();
    if (deathNoticeOpen) return;
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
  const head = [el('h2', ev.title), ...artFigure('reality', ev.artTags, ev.instanceId), el('p', ev.text)];
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

// ---------------- หน้าแจ้งการตายของผู้เล่น ----------------
let deathNoticeOpen = false;

function showDeathNotice(n: DeathNotice) {
  deathNoticeOpen = true;
  const next = n.extinct
    ? 'ตระกูลสิ้นสาย — ไม่มีผู้สืบ'
    : n.heir ? `${n.heir} สืบตระกูลต่อ` : 'ญาติพี่น้องรอเลือกผู้สืบตระกูล';
  const ok = button('รับทราบ', async () => {
    deathNoticeOpen = false;
    closeModal();
    if (clock.ended) return void showEnding();
    await engine.request({ type: 'resume' }).catch(() => {}); // ต้องเลือกผู้สืบก่อน → worker ไม่เดินต่อเอง
    await showPending();
  });
  ok.classList.add('opt');
  openModal(
    el('h2', `${n.name}สิ้นชีวิต`),
    el('p', `พ.ศ. ${n.year} อายุ ${n.age} ปี`, 'muted'),
    el('p', `สาเหตุ: ${n.cause}`),
    el('p', next),
    ok,
  );
  queueMicrotask(() => ok.focus());
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
  parts.push(
    el(
      'p',
      `ขอบคุณที่เล่นจนจบนะครับ${v.continueTo ? ' ถ้ายังอยากเห็นตระกูลนี้ไปต่อ กด "เล่นต่อ" ได้เลย' : ''} และถ้าสนุก สนับสนุนผู้พัฒนาได้ที่ปุ่ม "เลี้ยงน้ำร้อนน้ำชา" ☕`,
      'release-meta',
    ),
  );
  const row = el('div', undefined, 'row split');
  const right = el('div', undefined, 'row');
  right.append(
    button('ดูผังตระกูล', () => {
      closeModal();
      showTab('tree');
    }),
    ...(v.continueTo ? [button(`เล่นต่อ (เรื่องสมมติถึง พ.ศ. ${v.continueTo})`, () => confirmContinue(v, parts, row))] : []),
    button('เริ่มใหม่', () => void $('new').click()),
  );
  row.append(button('☕ เลี้ยงน้ำร้อนน้ำชา', () => showDonate(() => openModal(...parts, row))), right);
  openModal(...parts, row);
}

/** ยืนยันก่อนเล่นต่อหลังปีจบ — บอกชัดว่าจากนี้ไม่ใช่ประวัติศาสตร์จริง */
function confirmContinue(v: EndingView, parts: Node[], row: HTMLElement) {
  const go = button('เล่นต่อ', async () => {
    try {
      await engine.request({ type: 'continueEra' });
      endingShown = false;
      closeModal();
      status.textContent = 'เข้าสู่ยุคสมมติ — กด ▶ เพื่อเล่นต่อ';
    } catch (e) {
      status.textContent = errorText(e);
    }
  });
  go.classList.add('opt');
  const back = button('กลับไปหน้าสรุป', () => openModal(...parts, row));
  openModal(
    el('h2', 'เล่นต่อหลังจบเรื่อง'),
    el('p', `ตระกูลของคุณจะอยู่ต่อไปถึง พ.ศ. ${v.continueTo}`),
    el('p', 'จากนี้ไปเป็นเรื่องสมมติ ไม่อิงเหตุการณ์จริงอีกแล้ว: เหตุการณ์ใหญ่ (โรคระบาด น้ำท่วม ศึก ปีข้าวดี ฯลฯ) จะสุ่มมาเองทุกๆ ไม่กี่ปี ตระกูลที่บริหารดีอาจรุ่งเรืองและร่ำรวยได้ แต่ก็ล่มได้เช่นกัน'),
    el('p', 'ถึงปีนั้นจะมีหน้าสรุปอีกครั้งให้เลือกว่าจะเล่นต่ออีกไหม', 'notice-fine'),
    go,
    back,
  );
  queueMicrotask(() => go.focus());
}

/** แสดง event ที่ worker ยังรออยู่ (หลังโหลดเซฟ หรือหลังเลือกตัวเลือกไม่สำเร็จ) */
async function showPending() {
  if (deathNoticeOpen) return; // หน้าแจ้งการตายเปิดอยู่ — ปิดแล้วค่อยแสดง event ค้าง (showDeathNotice)
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
      for (const l of p.lines) write(l.text, l.kind, undefined, l.artTags);
      break;
    case 'progress':
      renderDates(p.solar, p.lunar);
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
      // หน้าแจ้งการตายยังเปิดอยู่ → รอผู้เล่นรับทราบก่อน แล้วค่อยดึง event ค้างมาแสดง (showPending)
      if (!deathNoticeOpen) renderEvent(p.event);
      break;
    case 'playerDied':
      showDeathNotice(p.notice);
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
    deathNoticeOpen = false;
    collapsed.clear();
    startYear(v.year);
    write(from === 'new' ? `เริ่มชีวิตใหม่ในฐานะ${v.name}` : `โหลดเซฟ "${from}": ${v.name}`, 'system');
    renderPlayer(v);
    renderKnown(await engine.request({ type: 'viewKnown' }));
    renderDynasty(await engine.request({ type: 'viewDynasty' }));
    renderDates(v.solar, v.lunar);
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
  // เสนอชื่อสุ่มจากคลังชื่อก่อน — ไม่ชอบก็สุ่มใหม่หรือพิมพ์เอง
  const suggest = () => engine.request({ type: 'suggestName' }).catch(() => 'บุญมา');
  const form = nameForm('ชื่อตัวละคร', await suggest(), 'เริ่ม', (name) => void start('new', name), closeModal);
  const input = form.querySelector('input')!;
  form.querySelector('.row')!.prepend(button('สุ่มชื่อใหม่', async () => { input.value = await suggest(); input.select(); }));
  openModal(
    el('h2', 'เริ่มชีวิตใหม่'),
    el('p', 'ลูกชายคนโตวัย 7 ขวบของขุนนางชั้นผู้น้อย ปลายกรุงศรีอยุธยา พ.ศ. 2288'),
    form,
  );
};
$('play').onclick = togglePlay;
$('slower').onclick = () => changeSpeed(-1);
$('faster').onclick = () => changeSpeed(1);
// คีย์ลัด: Space เดิน/หยุด, + / − ปรับความเร็ว — ไม่ทำงานตอนพิมพ์หรือมีหน้าต่างเปิดอยู่
document.addEventListener('keydown', (e) => {
  if (!hasGame || e.target instanceof HTMLInputElement || e.ctrlKey || e.metaKey || e.altKey) return;
  // Space ใช้ได้แม้มีหน้าต่าง event (สั่งหยุดค้างหลังเลือก) — แต่ถ้าโฟกัสอยู่ที่ปุ่มในหน้าต่าง ให้ปุ่มทำงานตามปกติ
  if (e.code === 'Space' && modalOpen() && e.target instanceof HTMLButtonElement && $('event').contains(e.target)) return;
  if (modalOpen() && e.code !== 'Space') return;
  if (e.code === 'Space') {
    e.preventDefault();
    void togglePlay();
  } else if (e.key === '+' || e.key === '=') void changeSpeed(1);
  else if (e.key === '-' || e.key === '_') void changeSpeed(-1);
});

// ---------------- เรตและข้อควรทราบก่อนเล่น ----------------
// เรตที่ผู้ทำประเมินเอง (ไม่ใช่เรตทางการ) — เปลี่ยนข้อความแล้วต้องขึ้นเลขเวอร์ชัน เพื่อให้ผู้เล่นเดิมเห็นอีกครั้ง
const NOTICE_VERSION = 1;
const RATING = '15+';
const NOTICE_TOPICS = [
  'ความตายของคนในตระกูลทุกวัย รวมทั้งเด็กทารก การตายตอนคลอดลูก โรคระบาด (ไข้ทรพิษ อหิวาต์) และการตายในศึกสงคราม',
  'ความรุนแรงระดับกลาง เช่น การลอบทำร้าย ชกต่อย การเฆี่ยนลงโทษ และการกวาดล้างตอนผลัดแผ่นดิน — บรรยายเป็นข้อความ ไม่มีภาพบาดแผลหรือเลือด',
  'ระบบทาสและไพร่ตามสังคมสมัยนั้น ตัวละครถูกซื้อขาย ใช้งาน และสืบทอดเป็นทรัพย์สิน',
  'เรื่องคู่ครองและครอบครัวตามธรรมเนียมเก่า เช่น แต่งงานตั้งแต่อายุน้อย ผู้ใหญ่จัดการสู่ขอ มีเมียหลายคน ความหึงหวง การหย่า — ไม่มีฉากเชิงเพศ',
  'ภาพประกอบแสดงการแต่งกายตามยุค เช่น ชายสามัญและเด็กไม่สวมเสื้อ หญิงสูงอายุบางภาพไม่ห่มผ้าปิดอก',
  'ความเชื่อเรื่องผี ลางสังหรณ์ และโหราศาสตร์ ที่เป็นของจริงในโลกของเกม',
];
function showNotice(first: boolean) {
  const list = el('ul', undefined, 'notice-list');
  for (const t of NOTICE_TOPICS) list.append(el('li', t));
  const head = el('div', undefined, 'notice-rating');
  head.append(el('b', RATING), el('span', `เหมาะสำหรับผู้เล่นอายุ ${RATING.replace('+', ' ปีขึ้นไป')}`));
  const row = el('div', undefined, 'row');
  row.append(
    button(first ? 'เข้าใจแล้ว เริ่มเล่น' : 'ปิด', () => {
      prefs.set('noticeAck', NOTICE_VERSION);
      closeModal();
      if (first) showReleaseIfNew(); // รุ่นใหม่ค้างอยู่ → แสดงต่อจากหน้าเรต
    }),
  );
  openModal(
    el('h2', 'ก่อนเล่น: เรตและข้อควรทราบ'),
    head,
    el('p', 'เกมนี้จำลองชีวิตตระกูลขุนนางผู้น้อยปลายอยุธยา ถึงต้นรัตนโกสินทร์ ตามสภาพสังคมสมัยนั้น เนื้อหาบางส่วนอาจไม่สบายใจ:'),
    list,
    el('p', 'เกมไม่ได้สนับสนุนหรือเชิดชูสิ่งเหล่านี้ เป็นการสะท้อนบริบทประวัติศาสตร์ เล่นหยุดพักได้ทุกเมื่อ และเซฟไว้ได้', 'notice-fine'),
    el('p', `เรตนี้ผู้ทำเกมประเมินเอง ไม่ใช่เรตทางการจากหน่วยงานใด (ฉบับที่ ${NOTICE_VERSION})`, 'notice-fine'),
    row,
  );
}
$('notice').onclick = () => showNotice(false);

// ---------------- รุ่นของเกม: มีอะไรใหม่ · เกี่ยวกับ · สนับสนุนผู้พัฒนา ----------------
/** รายการของรุ่นหนึ่ง จัดเป็นกลุ่ม เพิ่ม/ปรับ/แก้ */
function releaseBody(e: ChangelogEntry): Node[] {
  const out: Node[] = [];
  if (e.summary) out.push(el('p', e.summary));
  for (const [title, items] of [['เพิ่มใหม่', e.added], ['ปรับปรุง', e.changed], ['แก้ไข', e.fixed]] as const) {
    if (!items?.length) continue;
    const ul = el('ul', undefined, 'release-list');
    for (const t of items) ul.append(el('li', t));
    out.push(el('h3', title, 'release-group'), ul);
  }
  return out;
}

/** รุ่นที่ผู้เล่นรับทราบแล้วจำไว้ต่อเครื่อง (localStorage) — ขึ้นอีกเมื่อเลขรุ่นเปลี่ยน */
function showReleaseIfNew() {
  if (prefs.get<string>('releaseAck', '') === APP_VERSION) return;
  const notes = releaseNotes(APP_VERSION);
  if (!notes) return;
  const first = prefs.get<string>('releaseAck', '') === '';
  const ok = button('รับทราบ', () => {
    prefs.set('releaseAck', APP_VERSION);
    closeModal();
  });
  ok.classList.add('opt');
  openModal(
    el('h2', first ? `ยินดีต้อนรับสู่ หนึ่งตระกูล (รุ่น ${APP_VERSION})` : `หนึ่งตระกูล อัปเดตเป็นรุ่น ${APP_VERSION}`),
    el('p', `ออกเมื่อ ${thaiDate(notes.date)}`, 'release-meta'),
    ...releaseBody(notes),
    ok,
  );
  queueMicrotask(() => ok.focus());
}

function showDonate(back: () => void) {
  const img = el('img') as HTMLImageElement;
  Object.assign(img, { src: `${import.meta.env.BASE_URL}donate-qr.jpeg`, alt: 'QR Code พร้อมเพย์สำหรับสนับสนุนผู้พัฒนา', decoding: 'async' });
  const box = el('div', undefined, 'donate');
  box.append(
    el('p', 'ขอบคุณที่เล่นเกมนี้นะครับ ถ้าสนุกและอยากช่วยค่าน้ำร้อนน้ำชา ค่าไฟ และค่าประมวลผลระหว่างทำเกม สแกนพร้อมเพย์ด้านล่างได้เลย'),
    img,
    el('p', 'ไม่สนับสนุนก็ไม่เป็นไรเลย — แค่คุณได้ใช้เวลากับตระกูลของคุณสักพักก็ดีใจมากแล้ว ☕', 'muted'),
  );
  const row = el('div', undefined, 'row');
  row.append(button('กลับ', back));
  openModal(el('h2', 'เลี้ยงน้ำร้อนน้ำชาผู้พัฒนา'), box, row);
}

function showAbout() {
  const links = el('div', undefined, 'about-links');
  const link = (text: string, href: string) => {
    const a = el('a', text) as HTMLAnchorElement;
    Object.assign(a, { href, target: '_blank', rel: 'noopener noreferrer' });
    return a;
  };
  links.append(link('โค้ดบน GitHub', REPO_URL), link('ประวัติการแก้ไข (git)', `${REPO_URL}/commits/main`), link('แจ้งปัญหา/เสนอไอเดีย', `${REPO_URL}/issues`));
  const dl = el('dl');
  dl.append(
    el('dt', 'รุ่น'), el('dd', APP_VERSION),
    el('dt', 'git'), el('dd', GIT_HASH),
    ...(BUILD_DATE ? [el('dt', 'สร้างเมื่อ'), el('dd', thaiDate(BUILD_DATE))] : []),
    el('dt', 'ผู้สร้าง'), el('dd', CREATOR),
  );
  // หน้าเกี่ยวกับแสดงแค่รุ่นล่าสุด — ประวัติทั้งหมดอยู่อีกหน้าต่าง หน้านี้จะได้ไม่ยาวขึ้นทุกรุ่น
  const history = el('div', undefined, 'history');
  history.append(releaseDetails(CHANGELOG[0]!, true));
  const more = el('div', undefined, 'row');
  if (CHANGELOG.length > 1) more.append(button(`ดูประวัติการอัปเดตทั้งหมด (${CHANGELOG.length} รุ่น)`, showHistory));
  const row = el('div', undefined, 'row split');
  const right = el('div', undefined, 'row');
  if (installOffered(prefs.get('pwaInstalled', false))) right.append(button('📲 ติดตั้งเป็นแอป', () => void installNow(showAbout)));
  right.append(button('ปิด', closeModal));
  row.append(button('☕ เลี้ยงน้ำร้อนน้ำชาผู้พัฒนา', () => showDonate(showAbout)), right);
  openModal(
    el('h2', 'หนึ่งตระกูล'),
    el('p', 'เกมจำลองตระกูลขุนนางผู้น้อย ปลายอยุธยาถึงต้นรัตนโกสินทร์ เล่นต่อกันหลายรุ่นจน พ.ศ. 2400 — ตัวเลขสมดุลเป็นของเกม ส่วนเนื้อหาประวัติศาสตร์อ้างอิงที่มาในคลัง lore', 'release-meta'),
    dl,
    links,
    el('p', 'ขอบคุณที่ลองเล่นนะครับ ถ้าเจอข้อผิดพลาดหรือมีไอเดีย บอกได้ตามลิงก์ด้านบน', 'release-meta'),
    el('h3', 'มีอะไรใหม่ในรุ่นล่าสุด'),
    history,
    more,
    row,
  );
}

/** รุ่นหนึ่งเป็นหัวข้อพับได้ */
function releaseDetails(e: ChangelogEntry, open: boolean): HTMLDetailsElement {
  const d = el('details') as HTMLDetailsElement;
  d.open = open;
  d.append(el('summary', `รุ่น ${e.version} · ${thaiDate(e.date)}`), ...releaseBody(e));
  return d;
}

function showHistory() {
  const history = el('div', undefined, 'history');
  CHANGELOG.forEach((e, i) => history.append(releaseDetails(e, i === 0)));
  const row = el('div', undefined, 'row');
  row.append(button('กลับ', showAbout), button('ปิด', closeModal));
  openModal(el('h2', 'ประวัติการอัปเดต'), history, row);
}
$('about').onclick = showAbout;

// ---------------- ติดตั้งเป็นแอป (PWA) ----------------
// เปิดผ่านเบราว์เซอร์ปกติ: เด้งแนะนำครั้งเดียวต่อการเปิดหน้า (ติ๊ก "ไม่ต้องแสดงอีก" ได้)
// ปุ่ม "ติดตั้งเป็นแอป" ในหน้าเกี่ยวกับอยู่ตลอดจนกว่าจะติดตั้ง
let installSuggested = false;

/** วิธีติดตั้งเองเมื่อเบราว์เซอร์ไม่มีกล่องติดตั้งให้เรียก (Safari บน iPhone/iPad, Firefox ฯลฯ) */
function manualInstallSteps(): Node {
  const ol = el('ol', undefined, 'release-list');
  const steps = isIOS()
    ? ['เปิดหน้านี้ใน Safari', 'กดปุ่มแชร์ (สี่เหลี่ยมมีลูกศรชี้ขึ้น)', 'เลือก "เพิ่มไปยังหน้าจอโฮม" แล้วกด "เพิ่ม"']
    : ['เปิดเมนูของเบราว์เซอร์ (⋮ หรือ ☰)', 'เลือก "ติดตั้งแอป" หรือ "เพิ่มไปยังหน้าจอหลัก"', 'ถ้าไม่มีให้เลือก ลองเปิดหน้านี้ใน Chrome หรือ Edge'];
  for (const t of steps) ol.append(el('li', t));
  return ol;
}

async function installNow(back: () => void) {
  if (canPromptInstall()) {
    closeModal();
    if (await promptInstall()) status.textContent = 'ติดตั้งหนึ่งตระกูลเป็นแอปแล้ว';
    return;
  }
  const row = el('div', undefined, 'row');
  row.append(button('กลับ', back));
  openModal(el('h2', 'ติดตั้งเป็นแอป'), el('p', 'เบราว์เซอร์นี้ให้ติดตั้งเองจากเมนู:'), manualInstallSteps(), row);
}

function maybeSuggestInstall() {
  if (installSuggested || modalOpen() || clock.playing) return; // ไม่ขัดจังหวะ event หรือเวลาที่กำลังเดิน
  if (prefs.get('installNever', false) || !installOffered(prefs.get('pwaInstalled', false))) return;
  if (!canPromptInstall() && !isIOS()) return; // เด้งเฉพาะเมื่อติดตั้งได้จริง — เบราว์เซอร์อื่นดูวิธีได้ที่ปุ่มในหน้าเกี่ยวกับ
  installSuggested = true;
  const never = el('input') as HTMLInputElement;
  never.type = 'checkbox';
  const label = el('label', undefined, 'install-never');
  label.append(never, document.createTextNode(' ไม่ต้องแสดงอีก'));
  const done = () => {
    if (never.checked) prefs.set('installNever', true);
  };
  const row = el('div', undefined, 'row');
  const later = button('ไว้ทีหลัง', () => {
    done();
    closeModal();
  });
  const ok = button(canPromptInstall() ? 'ติดตั้ง' : 'ดูวิธีติดตั้ง', () => {
    done();
    void installNow(closeModal);
  });
  row.append(later, ok);
  openModal(
    el('h2', 'ติดตั้งหนึ่งตระกูลเป็นแอป'),
    el('p', 'เปิดเล่นจากหน้าจอโฮมหรือเดสก์ท็อปได้เลย ไม่มีแถบเบราว์เซอร์มาบัง และเปิดเล่นต่อได้แม้เน็ตหลุด เซฟยังอยู่ที่เดิม'),
    el('p', 'ติดตั้งภายหลังได้ตลอดที่ปุ่ม "เกี่ยวกับ" ด้านบน', 'release-meta'),
    label,
    row,
  );
  queueMicrotask(() => ok.focus());
}

initPwa({
  version: APP_VERSION,
  onAvailable: () => {
    prefs.set('pwaInstalled', false); // เบราว์เซอร์ยอมให้ติดตั้งอีก = ถอนการติดตั้งไปแล้ว
    maybeSuggestInstall();
  },
  onInstalled: () => prefs.set('pwaInstalled', true),
});

if (prefs.get<number>('noticeAck', 0) < NOTICE_VERSION) showNotice(true);
else showReleaseIfNew();

showTab('saves');
