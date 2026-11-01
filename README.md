# หนึ่งตระกูล — Dynasty Sim Core

Simulation engine ที่รัน 100% ในเบราว์เซอร์ (Web Worker + IndexedDB) → deploy เป็น static site ล้วน (ตอนนี้ใช้ GitHub Pages) ไม่ต้องมีเซิร์ฟเวอร์

```
public/content/*.json      Content (data-driven, modder แก้ได้)  → เสิร์ฟเป็นไฟล์ static
src/core/                  Schema (types.ts), RNG, Tag ontology index, Ctx
src/systems/               Logic ล้วน ไม่รู้จัก DOM/Worker — รันใน Node ได้ (demo/test)
  body.ts                  อวัยวะแบบ tree + บาดแผล → แผลเป็น/พิการ
  trauma.ts                Trauma & Quirk resolution (ปมตรง vs ปมเพี้ยน)
  events.ts                Contextual event injection
  socialLearning.ts        ปมพ่อแม่ → กฎในเรือน → ลูก
  legend.ts                ตำนานตระกูลที่บิดเบือนตามรุ่น
  handover.ts              การสืบทอดรุ่น + anti-snowball
  prune.ts                 Data pruning
  world.ts                 advanceDay() — tick หลักของโลก
src/engine/                ชั้น Web: Worker, protocol, IndexedDB, client
src/main.ts, index.html    UI ทดสอบแบบ text
```

```bash
npm install
npm run dev        # dev server
npm run build      # typecheck + static build → dist/
npm run demo       # Monte Carlo + เรื่องเล่า 4 รุ่น ใน Node
```

Deploy: push เข้า main แล้ว `.github/workflows/pages.yml` build และขึ้น GitHub Pages ให้เอง → https://kridsadaa.github.io/dynasty-sim-core/ (build ใต้ path นี้ด้วย `BASE_PATH`) · ยังใช้ Vercel ได้ด้วย `vercel.json` — ห้ามสร้างโฟลเดอร์ `api/` เพราะเกมต้องเป็น static ล้วน
