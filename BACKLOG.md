# Backlog — สิ่งที่พบจากการตรวจและทดสอบ (อัปเดต 2026-10-30)

บั๊กที่แก้แล้วอยู่ใน git log รายการนี้เป็นสิ่งที่ **ยังไม่ได้ทำ** เพราะต้องตัดสินใจเชิงออกแบบ ต้องค้นคว้าเพิ่ม หรือใหญ่เกินกว่าจะแก้ในรอบเดียว
เรียงคร่าวๆ ตามผลกระทบต่อการเล่น

ทดสอบซ้ำได้ด้วย `npm test` (test ของ save/load + `sim:check` รันโลก 110 ปี × 5 seed แล้วตรวจ invariant — อยู่ใน `npm run build` แล้ว) และ `npm run demo`
เล่นทดสอบในเบราว์เซอร์: `npx vite build` แล้วเปิด config `preview` (`vite preview` พอร์ต 4173)

## แผนดำเนินการ (2026-10-30)

แยกตามสิ่งที่ทำให้ติด: ขั้น 0 ต้องตัดสินใจ, ขั้น 1 ทำได้ทันที, ขั้น 2 ต้องมีคนเปิดเอกสารจริง (ROADMAP หลักข้อ 4), ขั้น 3 รอ event
ขั้น 0 และขั้น 1 เสร็จแล้ว (เหลือข้อเดียวในขั้น 0) — ถัดไปคือขั้น 2 รอบ R1

### ขั้น 0 — ตัดสินใจ ✅ ตกลงตามข้อเสนอ 2026-10-30

| เรื่อง | ผล |
|---|---|
| เรือนกินส่วนแบ่งมรดก | ไม่นับเรือนในส่วนแบ่งเมื่อตกแก่ลูกที่อยู่ดูแล (`kinship.youngest_daughter_house`); ไม่มีลูกอยู่ในเรือน → ทายาทหลักได้และนับรวม |
| ตำนานบิดเบือนต่อ handover หรือต่อรุ่น | ต่อรุ่น (`Dynasty.agedGeneration`) — การฝ่าฝืนข้อห้ามยังคิดต่อทายาทแต่ละคน |
| ชื่อซ้ำกับญาติที่ตายแล้ว | อนุญาต แต่ต่อท้าย "(เกิด ปี)" เมื่อมีชื่อซ้ำในผัง |
| ฉากเริ่ม พ.ศ. 2288 กับ slice 2295–2315 | คงไว้ เขียนเหตุผลใน `lore/config.json` (`currentSlice.note`) |
| `anatomy.vital`, `anatomy.root`, `Item.teaches` | เก็บไว้ ทำพร้อมขั้น 3 |
| `art/art/art/` | ตรวจแล้ว: ภาพ 7 รูปเหมือน `art/approved/` ทุก byte, `style.json` ต่างแค่ line ending, `manifest.json` เท่ากับฉบับ commit ก่อนแก้ anchor, `README.md` เป็นฉบับเก่า (ไม่มีข้อ 7 คลังภาพ) → **ไม่มีอะไรต้องรวมกลับ รอเจ้าของสั่งลบ** |

### ขั้น 1 — ทำได้ทันที ✅

- [x] ตำนานซ้ำตอน handover: รวมตาม `originMemoryId` ใช้แผลที่หนักที่สุดเป็นหลักฐาน
- [x] ชื่อซ้ำ: `displayName` ต่อท้ายปีเกิดใน log ชีวิตประจำวัน, inspector (บิดามารดา/คู่ครอง/บุตร) และผัง (คู่ครองญาติ, ลูกที่ "ดูในสายอีกฝั่ง")
- [x] มรดก: ไม่นับมูลค่าเรือนในส่วนแบ่ง + ระบุสถานะแม่ท้ายชื่อเมื่อทายาทได้สิทธิ์ต่างกัน
- [x] ตำนาน/ข้อห้ามเสื่อมรุ่นละครั้ง
- [x] งานศพคิดจากทรัพย์ทั้งหมด เงินสดไม่พอ → ขายทองก่อน แล้วขายที่ดินแปลงเล็ก (เรือน/ของตกทอดไม่ขาย)
- [x] prune เก็บ memory ที่แผลเป็น/ปม/บาดแผลยังอ้างอยู่ (ไม่นับโควตา `lightMemoryKeep`)
- [x] บุญตอนตาย (รวมบุญจากงานศพ) ลง `FamilyNode.summary.merit` แสดงใน inspector
- [x] `lore:compile` รวมชื่อซ้ำ (estates ยูเนียน, `loreRefs` ทุกแหล่ง); `lore:check` ตรวจ `loreRefs` ใน `art/style.json`/manifest และ anchor ของ `promptRef`; แก้ anchor ใน manifest เป็น slug แบบ GitHub
- [x] test: `node:test` + fake-indexeddb ครอบเซฟ/โหลด, abort เมื่อ put ล้ม, แท็บอื่น block, ชื่อช่องผิด, schema ใหม่กว่า; `npm test` อยู่ใน build — ใช้ `node:test` แทน vitest เพราะ vitest 3 ติด advisory ร้ายแรง (tinypool/@vitest/mocker) และรุ่นที่แก้แล้วต้องใช้ Node 20

### ขั้น 2 — ค้นคว้า lore (AI ร่าง → คนเปิดเอกสารตรวจ → `verified: true`)

ไม่ต้องรอครบ 86 รายการ — ตรวจรายการที่เกมใช้อยู่ก่อน (ชื่อใน `names.json`, `kinship.youngest_daughter_house`, `kinship.marriage_law_three_seals`, `ritual.funeral_cremation`, `social.cremation_before_division`)

- [ ] **R1 มรดกและการสืบสกุล** — 🟡 ร่างแล้ว 2026-10-30 จากตัวบทลักษณมรดกทั้งฉบับ (7 รายการใหม่ + เติม `social.estate_division_noble`); ผลต่อระบบเกมคือกลุ่ม D ใน `lore/system-implications.md` (D1–D7)
  - [ ] เปิดสแกนตรวจตามรายการในกลุ่ม D แล้วตั้ง `verified: true`
  - [x] ทำ D1 (ไม่มีลูก → ญาติรับแทน) + D2 (ผู้นำไปสายพี่น้อง) — 2026-10-30
  - [ ] D3–D7 ตามลำดับในกลุ่ม D (D3 รอระบบศักดินา)
- [ ] **R2 ประชากร** — อัตราตายของเด็ก, ระยะห่างการมีบุตร, อายุแต่งงาน (งานภาคสนามใช้เป็น `pattern` + `projection`) → แทน placeholder ใน `lifeMilestones` แก้ "ประชากรโตเท่าตัวทุกรุ่น"
- [ ] **R3 ชื่อ** — คำถาม 4 ข้อใน `lore/system-implications.md` + ชื่อจากแหล่งร่วมยุคเพิ่ม
- [ ] **R4 จัดสถานะ** — La Loubère 22 รายการ → `pattern` + `projection`, 4 รายการ attested ที่ไม่มีแหล่งร่วมยุค, `composedYear` ของพงศาวดารฉบับพันจันทนุมาศ, `loreRefs` ของ tag `asset:*`/`faction:*` และการอ้างกลับ tag ↔ lore 7 คู่

### ขั้น 3 — content (คู่กับ style bible, ROADMAP เฟส 4)

- [ ] event ช่วงชีวิต C4 (ทำขวัญเดือน, เณร, โกนจุก, บวช, สู่ขอ) — มี lore แล้ว แก้ "event น้อยมาก"
- [ ] เมื่อมี event สู่ขอ/ศึก/งานช่าง ค่อยผูก stat ของแผลเป็น: `attraction` → สู่ขอ, `intimidation` → ศึก (`situation:combat`), `story_hook` → ตำนาน, `music`/`goldsmith` → งานช่าง (`situation:craft`); `Item.teaches` → event เรียนวิชา; `anatomy.vital` → ตายจากบาดแผล
- [ ] ภาพ v0.2 สองรูป: สร้างใหม่ด้วย style v0.3 ในรอบภาพถัดไป หรือบันทึกเวอร์ชันลง manifest

## ระบบเกม

- [ ] **แผลเป็นยังไม่มีผลต่อเกม** — `scarModifiers` (`src/systems/body.ts`) คำนวณและเซฟไว้แต่ไม่มีระบบไหนอ่าน stat ที่มันปรับ (`social:attraction`, `social:intimidation`, `social:story_hook`, `skill:music`, `skill:goldsmith`) และกฎ `inj.scar.face.intimidate` / `inj.capability.fine.craft` ต้องใช้ `situation:combat` / `situation:craft` ซึ่งยังไม่มี event ไหนมี → ขั้น 3
- [ ] **ประชากรโตเท่าตัวทุกรุ่น** — ทุกคนในตระกูลแต่งงานตรงอายุและมีลูกปีที่ 2 กับ 5 หลังแต่งเสมอ (`lifeMilestones` ใน `world.ts` ยังเป็น placeholder) แทบไม่มีใครตายก่อน 50 → เซฟโต (~85–185 KB ที่ 110 ปี) และ `collapseCharacter` เป็น O(N²) → R2
- [ ] **คลังชื่อเล็ก** — 22 ชื่อ ชื่อซ้ำอ่านออกแล้วด้วยปีเกิด แต่ใน 100 ปีมี "สา" 3–4 คนพร้อมกัน → R3
- [ ] **event น้อยมาก** — มีแค่ `childhood.kitchen_cut` กับ `adult.court_feast`; เด็กเจอ "มีดบาดตอนผ่าฟัก" ซ้ำทุก 2 ปี → ขั้น 3
- [ ] **พ่อแม่และคู่ครองของผู้ตายไม่ได้มรดก** — ตัวบทให้คนละ 1 ภาค (D3) แต่ต้องมีค่าศักดินาก่อนจึงรู้ว่าแบ่ง 3 หรือ 4 ภาค
- [ ] **ประชากรใน sim แทบไม่มีคนไม่มีลูก** — ทางญาติรับมรดก (D1/D2) ทดสอบได้แค่ใน `sim:check` กรณี [3]–[4] จนกว่า R2 จะมีคนไม่มีบุตร
- [ ] บุญตอนตายเก็บไว้แล้วแต่ยังไม่มีระบบไหนอ่าน (เช่น ต่อตำนาน)

## UI / ประสบการณ์เล่น

- [ ] เลือกตัวเลือก event แล้วยังไม่บันทึกจนกว่าจะเดินเวลา → ปิดแท็บตอนนั้น โหลดแล้วจะเจอ event เดิม (ตั้งใจให้สอดคล้องกัน แต่ควรพิจารณา autosave หลังเลือก)
- [ ] ข้อความ handover/มรดกยังใช้ชื่อเปล่า (`r.deceased`, `heir.name` ใน `handover.ts`) — ชื่อซ้ำในบรรทัดเหล่านี้ยังไม่มีปีเกิด
- [ ] คนจนตายแล้ว log ยังขึ้น "งานศพ … ใช้ 0 ตำลึง" และ "ได้ 0 ตำลึง" — ควรย่อหรือข้าม
- [ ] ผังตระกูลเป็นรายการซ้อนแบบข้อความ — พอสำหรับเล่นทดสอบ ยังไม่ใช่ผังภาพ

## คลังข้อมูล (lore)

- [ ] **0/86 รายการ verified** — ชื่อทั้ง 22 ชื่อใน `names.json` มาจากรายการที่ยังไม่ verified ขัดกับหลักข้อ 4 ใน ROADMAP; ควรให้ `lore:compile` ข้ามรายการ unverified เมื่อมีรายการ verified พอ
- [ ] 22 รายการบรรยาย พ.ศ. 2230–2231 (La Loubère) แต่ใช้เป็น `attested`/`fact` สำหรับเกมช่วง 2275–2400 และเป็นฐานของ prompt ภาพ — ควรเปลี่ยนเป็น `pattern` + `projection` หรือหาแหล่งร่วมยุค (validator เตือนแล้ว) → R4
- [ ] รายการ attested ที่ไม่มีแหล่งร่วมยุค: `event.fall_of_ayutthaya_2310`, `kinship.marriage_law_three_seals`, `naming.names_bang_rachan_2308`, `naming.names_legal_cases` → R4
- [ ] `src.phongsawadan_phan_chanthanumat` ไม่มี `composedYear` → R4
- [ ] tag ↔ lore อ้างกันทางเดียว 7 คู่ (lore/README ข้อ 4 ขอให้อ้างกลับ); tag `asset:*`, `faction:*` ยังไม่มี `loreRefs` → R4

## ภาพประกอบ

- [ ] `reality-stilt-house.jpg` และ `reality-meal-tray.jpg` สร้างด้วย style block v0.2 แต่ `art/style.json` ตรึงไว้ที่ v0.3 → baseline สำหรับ regression ปนกัน

## ทดสอบ / โครงสร้าง

- [ ] worker โหลด content ไม่ขึ้น (`contentReady` ใน `engine.worker.ts`) ยังไม่มีการทดสอบอัตโนมัติ — ต้องจำลอง `self`/`fetch` ของ worker
- [ ] เปิด DB แล้วแท็บอื่นอัปเกรดเวอร์ชัน (`onversionchange`) ยังไม่มี test
- [ ] ลบ `art/art/art/` (untracked) — รอเจ้าของสั่ง ดูผลตรวจในขั้น 0
