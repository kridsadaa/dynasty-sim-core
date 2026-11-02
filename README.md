# หนึ่งตระกูล — Dynasty Sim

เกมจำลองชีวิตคนหลายรุ่นในตระกูลเดียว ฉากปลายกรุงศรีอยุธยา เล่นในเบราว์เซอร์ได้เลย ไม่ต้องติดตั้ง

**เล่นได้ที่ https://kridsadaa.github.io/dynasty-sim-core/**

เซฟเก็บไว้ในเบราว์เซอร์ของผู้เล่นเอง ล้างข้อมูลเบราว์เซอร์แล้วเซฟจะหาย

## ⚠️ เกมนี้เป็นเรื่องแต่ง ไม่ใช่ประวัติศาสตร์

หนึ่งตระกูลเป็น**เกมที่สร้างขึ้นจากจินตนาการ** ยืมบรรยากาศปลายกรุงศรีอยุธยามาเป็นฉาก แต่ไม่ได้จำลองอดีตตามจริง

- **ตัวละคร ตระกูล และเหตุการณ์ในเกมแต่งขึ้นทั้งหมด** ถ้าชื่อหรือเรื่องไปพ้องกับบุคคลหรือตระกูลที่มีอยู่จริง ถือเป็นความบังเอิญ
- **รายละเอียดหลายอย่างถูกแต่งเติม ย่อ หรือปรับ** ให้เล่นได้และอ่านสนุก ทั้งประเพณี ข้าวของ กฎหมาย ยศ และระบบราชการ บางอย่างอิงหลักฐาน บางอย่างเดาจากหลักฐาน บางอย่างแต่งขึ้นเองล้วน และระบบในเกมก็ทำให้ทุกอย่างง่ายกว่าความจริงมาก
- **ภาพประกอบสร้างด้วย AI** เป็นภาพจินตนาการ ไม่ใช่ภาพหรือหลักฐานทางประวัติศาสตร์ เครื่องแต่งกาย ทรงผม และบ้านเรือนในภาพอาจคลาดเคลื่อน
- **ความเชื่อ ผี ลาง และเรื่องเหนือธรรมชาติ** เล่าผ่านสายตาตัวละคร เป็นสิ่งที่ตัวละครเชื่อ ไม่ใช่คำยืนยันของเกม
- **ห้ามนำเนื้อหาในเกมหรือใน repo นี้ไปอ้างอิงทางวิชาการ** ทั้งในรายงาน วิทยานิพนธ์ บทความ และสื่อการสอน ถ้าสนใจเรื่องใด ให้ไปค้นจากเอกสารชั้นต้นหรืองานวิชาการโดยตรง

ไฟล์ใน `lore/` บอกไว้ว่าแต่ละข้อมีหลักฐาน (`attested`) เดาจากหลักฐาน (`inferred`) หรือแต่งขึ้น (`invented`) ป้ายนี้มีไว้ให้คนเขียนเกมใช้ ไม่ได้รับรองความถูกต้องทางวิชาการ

ถ้าเจอจุดที่ผิดจนเสียบรรยากาศ หรือมีเนื้อหาที่อาจทำให้ใครเจ็บปวด แจ้งได้ที่ [Issues](https://github.com/kridsadaa/dynasty-sim-core/issues) ยินดีรับฟัง แต่เป้าหมายของเกมคือเรื่องเล่าที่น่าเชื่อ ไม่ใช่ความถูกต้องทุกรายละเอียด

## สำหรับนักพัฒนา

ระบบจำลองรันในเบราว์เซอร์ทั้งหมด (Web Worker + IndexedDB) build ออกมาเป็น static site ล้วน ไม่มีเซิร์ฟเวอร์

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
src/art/                   เลือกภาพตามบริบท + สคริปต์นำภาพเข้าเกม
src/main.ts, index.html    UI แบบ text
lore/                      ข้อมูลฉากและที่มา (attested / inferred / invented)
art/                       spec และ prompt ของภาพประกอบ
```

```bash
npm install
npm run dev        # dev server
npm run build      # lore:check + typecheck + test + static build → dist/
npm run demo       # Monte Carlo + เรื่องเล่า 4 รุ่น ใน Node
```

เอกสารอื่น: [WRITING.md](WRITING.md) แนวเขียนเนื้อเรื่อง · [ROADMAP.md](ROADMAP.md) แผนงาน · [PLAYTEST.md](PLAYTEST.md) คู่มือทดสอบเล่น · [art/README.md](art/README.md) ระบบภาพ · [BACKLOG.md](BACKLOG.md) กล่องรับเรื่อง · [docs/PLAN.md](docs/PLAN.md) แผนที่คัดแล้ว · [docs/PARKED.md](docs/PARKED.md) พักไว้/ไม่ทำ · [docs/SYSTEM-NOTES.md](docs/SYSTEM-NOTES.md) บันทึกระบบ

Deploy: push เข้า main แล้ว `.github/workflows/pages.yml` build และขึ้น GitHub Pages ให้เอง (build ใต้ `/dynasty-sim-core/` ด้วย `BASE_PATH`) · ยังใช้ Vercel ได้ด้วย `vercel.json` — ห้ามสร้างโฟลเดอร์ `api/` เพราะเกมต้องเป็น static ล้วน

## สนับสนุนผู้พัฒนา ☕

หากชื่นชอบเกมและอยากสนับสนุนค่าน้ำชา/ค่ากาแฟ หรือช่วยสมทบทุนค่าไฟและค่าประมวลผล สามารถสแกนสนับสนุนผ่านพร้อมเพย์ (PromptPay) ได้ที่นี่ครับ:

<p align="center">
  <img src=".github/donate-qr.jpeg" alt="PromptPay QR Code" width="220" />
</p>

## สัญญาอนุญาต

- **โค้ด:** [MIT](LICENSE) นำไปใช้ แก้ไข หรือใช้เชิงการค้าได้ ขอแค่คงข้อความลิขสิทธิ์ไว้
- **เนื้อเรื่อง lore และภาพ** (`public/content/`, `lore/`, `art/`, `public/art/`): [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/deed.th) นำไปใช้และดัดแปลงได้ถ้าให้เครดิตและไม่ใช้เชิงการค้า

รายละเอียดว่าไฟล์ไหนใช้สัญญาแบบไหน ดูใน [LICENSE](LICENSE)
