# คลังข้อมูลประวัติศาสตร์ (Lore Base)

แหล่งความจริงของเกม — content ใน `public/content/` อ้างถึงที่นี่ผ่าน `loreRefs` และ style/visual bible สร้างจากที่นี่
schema อยู่ที่ [`src/lore/types.ts`](../src/lore/types.ts)

```
config.json        ช่วงเวลาของเกม + slice ที่กำลังทำ
sources.json       ทะเบียนเอกสาร (Source)
entries/<domain>.json   ข้อมูลแยกตามหมวด (LoreEntry)
anachronisms.json  คำที่ห้ามใช้นอกช่วงเวลา — lint ข้อความในเกม
```

## เพิ่มข้อมูล

1. ถ้ายังไม่มีเอกสารในทะเบียน → เพิ่มใน `sources.json` (`id` ขึ้นต้น `src.`)
   - `composedYear` = ปีที่เขียน/ชำระ, `describesPeriod` = ช่วงที่เอกสารพูดถึง (พ.ศ.)
   - แหล่งภาพต้องมี `license`
2. เพิ่ม `LoreEntry` ในไฟล์หมวด (`id` ขึ้นต้นด้วยชื่อหมวด เช่น `attire.`)
   - ใส่ `claim` เป็นข้อมูลแบบโครงสร้าง ไม่ใช่ย่อหน้า, คำอธิบายภาษาคนใส่ `summary`
   - `status`: `attested` (มีหลักฐานร่วมยุค) · `inferred` (อนุมาน/ต่างยุค) · `invented` (แต่ง — ต้องมี `rationale`)
   - `citations[].locator` = เล่ม/หน้า/ผนัง; ระหว่างร่างใส่ `TODO` ได้
3. **ตั้ง `verified: true` เฉพาะเมื่อเปิดเอกสารจริงตรวจแล้ว** — ข้อมูลที่ AI ร่างให้ต้องผ่านขั้นนี้เสมอ
4. ถ้าข้อมูลเกี่ยวกับสิ่งที่มีในเกม ให้ผูก `gameRefs.tags` และใส่ `loreRefs` ที่ tag ใน `public/content/tags.json`

## ตรวจ

```bash
npm run lore:check
```

- **error** (build ล้ม): id ซ้ำ, อ้างแหล่งที่ไม่มี, `attested` แต่แหล่งไม่ร่วมยุค, `invented` ไม่มีเหตุผล, ข้อความในเกมใช้คำผิดยุค
- **warning**: ยังไม่ verified, locator เป็น TODO, เอกสารชำระหลังช่วงข้อมูลเกิน 30 ปี, แหล่งภาพไม่มี license
- `npm run lore:check -- --strict` ให้ warning ล้มด้วย (ใช้ก่อนปิด slice)
