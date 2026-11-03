# GEMINI.md — ส่งต่องานให้ agent ตัวถัดไป

ไฟล์นี้เขียนตอนส่งต่องานจาก Claude (2026-11-03) ใช้กับ agent ตัวไหนก็ได้ที่รับช่วงต่อ

## อ่านก่อนลงมือ
1. [CLAUDE.md](CLAUDE.md) — กติกาของโปรเจกต์ **ใช้กับทุก agent** (อ่าน SYSTEM-NOTES/PARKED/PLAN ก่อนเพิ่มระบบ, ข้อค้นพบใหม่จดลง BACKLOG ก่อน, ตรวจด้วย `npx tsc --noEmit` และ `npm test`, ขั้นตอนออกรุ่น)
2. [docs/PLAN.md](docs/PLAN.md) — งานที่คัดแล้วและลำดับที่ตกลงไว้ (ปั่น BACKLOG ล่าสุด 2026-11-03, `BACKLOG.md` ว่างแล้ว)
3. [docs/SYSTEM-NOTES.md](docs/SYSTEM-NOTES.md) — แผนที่ระบบ→ไฟล์ · [docs/PARKED.md](docs/PARKED.md) — ที่พักไว้/ไม่ทำ · [WRITING.md](WRITING.md) — แนวเขียนข้อความถึงผู้เล่น (ภาษาไทย)

## สถานะ ณ 2026-11-03
- เวอร์ชัน **0.2.0** push ขึ้น `main` แล้ว (tag `v0.1.0` `v0.1.1` `v0.2.0`) deploy ผ่าน GitHub Pages ตอน push — **ยังไม่ได้ตรวจว่า deploy 0.2.0 ขึ้นแล้ว**
- ทำเสร็จเมื่อเร็วๆ นี้: ศึกพม่า 2308–2310 ครบขั้น 1–5 ([docs/design-war-2308.md](docs/design-war-2308.md)) · หน้าต่างรุ่นใหม่/เกี่ยวกับ/QR สนับสนุน ([src/release.ts](src/release.ts), [src/changelog.json](src/changelog.json)) · เล่นต่อหลัง 2400 เป็นยุคสมมติ ([src/systems/fiction.ts](src/systems/fiction.ts)) · ภาพศึก 9 ภาพ · แก้บั๊กชื่อ "spouse"
- **ยังไม่ได้ตรวจในเบราว์เซอร์จริง:** หน้า event ของศึกพม่า (ข่าวศึก เกณฑ์พล ฝังทรัพย์ ฯลฯ), หน้าแจ้งการตายแบบถูกกวาดต้อน, ภาพปีดี 3 ใบหลัง 2400 (ยังไม่มีภาพของตัวเอง)
- ผู้ใช้บอกเองว่า UI มือถือยังมีบั๊กหลายจุด (โพสในกลุ่มเฟซบุ๊กให้เล่นบน PC) — ถ้าจะโพสประกาศซ้ำ ควรแก้ก่อน
- ภาพประกอบ: ทำงานอยู่บน style v0.8 (ดู `art/rounds/` และ PLAN ข้อ 11) ผู้ใช้สร้างภาพด้วย Gemini เอง — prompt ชุดต่างๆ อยู่ `art/gemini-*.md`; ภาพที่เสร็จให้เซฟลง `art/generated/` แล้วเพิ่ม entry ใน `art/assets.spec.json` และรัน `npm run art:ingest`

## ข้อควรระวังเรื่องสภาพแวดล้อม (Windows)
- ไฟล์ `src/main.ts`, `src/vite-env.d.ts` (และอีกบางไฟล์) ปลายบรรทัดเป็น **CRLF** — เครื่องมือแก้ไฟล์ที่ match ข้อความหลายบรรทัดอาจพลาด ให้ตรวจผลทุกครั้ง
- ใน Git Bash อย่าใส่ backtick หรือ `$` ในสตริงเครื่องหมายคำพูดคู่ และอย่ารันคำสั่งที่รอ stdin; แก้หลายบรรทัดด้วยสคริปต์ node ในไฟล์แทน `node -e`
- เปิดเกมดูด้วย `npx vite --port 5173` (dev) หรือ preview config ใน `.claude/launch.json`
- **ห้าม commit / push / ติด tag จนกว่าผู้ใช้สั่ง** (ผู้ใช้มักพิมพ์ "commit เลย" / "push") ข้อความคอมมิตท้ายด้วย Co-Authored-By ของ agent ที่ทำ
- ตัวเลขสมดุลเป็นของเกม ไม่ใช่ประวัติศาสตร์; เนื้อหาประวัติศาสตร์ต้องมีที่มาใน `lore/` และเรื่องสมมติหลัง 2400 ติดป้าย invented

## วิธีออกรุ่น (ย่อ)
เติม entry บนสุดของ `src/changelog.json` → ขึ้น `version` ใน `package.json` และ `package-lock.json` ให้ตรง → `npm test` (มี `src/release.test.ts` เช็ก) → คอมมิต → `git tag -a vX.Y.Z` → `git push --follow-tags` เมื่อผู้ใช้สั่ง
