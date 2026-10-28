# รอบ 02 — แก้เฉพาะจุด + ทดสอบความคงที่ (a/b)

เป้าหมาย:
1. ดูว่า prompt ฉบับแก้ทำให้จุดที่ผิดในรอบ 01 ถูกได้เอง (S1 ลอมพอก, S3 ผ้าห่ม, S5 เสื้อ, S8 เตา)
2. ดูว่าสร้าง prompt เดิมซ้ำแล้วได้ภาพที่คงที่ (S2, S3, S6)

ถ้าผ่าน → ตรึงเป็น **style v0.1** ลง `art/style.json`

**วิธีทดสอบ**
- **สร้างใหม่จากศูนย์ทุกภาพ** — แชทใหม่ทุกครั้ง ไม่แนบภาพเก่า (เกมจริงสร้างจาก prompt อย่างเดียว)
- จดชื่อ/เวอร์ชันโมเดลที่ Gemini แสดง
- บันทึกภาพที่ `art/rounds/02/` ชื่อตามตารางข้างล่าง (ไม่ขึ้น git)
- ใส่ style block แทน `[REALITY]` หน้า prompt

| ไฟล์ | โจทย์ | ทดสอบ |
|---|---|---|
| `S1.jfif` | ขุนนางสวมลอมพอก | แก้ลอมพอก |
| `S3-a.jfif`, `S3-b.jfif` | หญิงมีฐานะ | แก้ผ้าห่ม + a/b |
| `S5.jfif` | แผลเป็นที่นิ้ว | แก้เสื้อในภาพระยะใกล้ |
| `S8.jfif` | ครัวกลางลานบ้าน | แก้เตา + ท่อนบนตามหลักฐาน |
| `S2-a.jfif`, `S2-b.jfif` | ชายไพร่ | a/b + บันไดแขวน |
| `S6-a.jfif`, `S6-b.jfif` | หญิงชรา | a/b |

รวม 9 ภาพ

## Style block v0.3

เปลี่ยนจาก v0.2 (รอบ 01): ทรงผมเด็ก (ไว้จุก), ถ้อยคำบันไดแขวน, ถ้อยคำผ้าห่ม, ห้ามเสื้อบนชายสามัญ

**REALITY v0.3**
```
Historical illustration of everyday life in Siam (Ayutthaya kingdom), mid-18th century. Muted earthy watercolor and ink on textured paper, soft natural daylight, restrained palette of ochre, indigo, rust and off-white. Grounded, documentary, ordinary weathered faces without makeup. Unless stated otherwise, Siamese adults of both sexes wear their black hair cropped level with the top of the ears, the hair below shaved close, lifted off the forehead, and their teeth are blackened from chewing betel. Commoner men are bare-chested. A well-to-do woman's breast-cloth is wrapped around the chest covering both breasts, its two ends thrown back over both shoulders. Commoner houses are small, of woven split-bamboo panels raised on tall bamboo piles, entered by a short bamboo ladder hanging from the doorway by ropes with its foot off the ground. Any children present are bare-chested and wear a small lower cloth; children under eleven have shaved heads with a small topknot of hair left on the crown. Avoid: modern clothing or objects, tourist-poster look, fantasy costume, glossy digital rendering, glamour or model-like faces, makeup, buns or topknots on adult women, long loose hair, bob haircuts, a breast-cloth worn as a one-shoulder diagonal sash, modern Thai costume, shirts on commoner men, tiled roofs or ornate gable finials on commoner houses, ladders leaning on the ground, shorts or shirts on children.
```

**CHRONICLE** — ไม่ทดสอบรอบนี้ ใช้ v0.2 ต่อ (S10 รอบ 01 ได้ 5 คะแนน)

## Prompt

### S1 — ขุนนางสวมลอมพอก
```
[REALITY] Medium shot: a Siamese official, an adult man in his forties, sitting cross-legged on a reed mat inside a timber house, wearing an open-front collarless white muslin over-shirt with very wide sleeves reaching almost to the wrist over a patterned silk lower cloth. On his head is a tall, narrow, brimless white cloth hat shaped like a slender cone, about as tall as his head again, with thin gold bands near the base, tied under the chin with a cord. Barefoot; a pair of pointed heel-less slippers set aside. Avoid: hat brim, wide-brimmed hat, witch hat, farmer's hat, conical straw hat.
```

### S2 — ชายไพร่ (สร้าง 2 ครั้ง)
```
[REALITY] Full-body view: a Siamese commoner man in his twenties, bare-chested and barefoot, wearing a knee-length painted-cotton lower cloth drawn between the legs and tucked at the back, standing in front of a small bamboo stilt house whose doorway has a short bamboo ladder hanging from it by ropes, holding a woven fish trap.
```

### S3 — หญิงมีฐานะ (สร้าง 2 ครั้ง)
```
[REALITY] Medium shot: a well-to-do Siamese woman in her thirties sitting on a reed mat with both legs folded to one side, wearing a black wrap skirt and a single white muslin cloth wrapped once around her chest covering both breasts, its two loose ends draped back over both shoulders like a shawl and hanging down her back; pear-shaped gold earrings, several rings on her last three fingers; a betel box beside her. Avoid: one-shoulder sash, diagonal sash, cloth over only one shoulder.
```

### S5 — แผลเป็นที่นิ้ว
```
[REALITY] Close-up of the hands and bare forearms of a bare-chested Siamese commoner man in his thirties, no shirt, weaving a bamboo basket on his lap; a pale, raised old scar runs across the middle joint of his left index finger, which is slightly crooked; his other fingers are unmarked.
```

### S6 — หญิงชรา (สร้าง 2 ครั้ง)
```
[REALITY] Portrait from the shoulders up: an elderly Siamese village woman in her sixties, deeply lined sun-weathered face, grey hair cropped level with the top of the ears and lifted off the forehead, smiling slightly to show teeth blackened from chewing betel, gold pear-shaped earrings; plain background of a bamboo wall.
```

### S8 — ครัวกลางลานบ้าน
```
[REALITY] Wide shot of the yard beside a bamboo stilt house: the hearth is a round woven basket packed full of earth, standing on three short wooden stakes; a small wood fire burns on the earth inside the basket, with a clay pot sitting on the fire. An adult commoner woman, bare-shouldered as was everyday dress, is seen from the side at a distance, squatting beside the hearth and stirring. Dried fish hang from a pole; chickens; firewood. Avoid: clay stove, brick stove, fire beneath the basket.
```

## บันทึกผล

โมเดล/เวอร์ชันที่ Gemini แสดง: `__________` (รอบ 01 ใช้ Gemini 4 argon — ถ้าเหมือนเดิมให้เติม)  วันที่: `2569-10-28`
ภาพ: `art/rounds/02/`

**จุดที่แก้**

| ไฟล์ | จุดที่แก้ถูกไหม | ตรง lore (1–5) | ของผิดยุค/ผิด lore ที่เหลือ |
|---|---|---|---|
| S1 | ลอมพอกไม่มีปีก: ✅ ทรงกรวยสูงแคบ แถบทอง สายรัดคาง | 5 | แขนเสื้อยังไม่กว้างมาก (เล็กน้อย) |
| S3-a | ผ้าห่มข้ามไหล่ทั้งสอง: ✅ | 5 | นั่งคุกเข่าแทนพับเพียบ; เห็นร่องอกเล็กน้อย |
| S3-b | ผ้าห่มข้ามไหล่ทั้งสอง: ❌ ยังพาดไหล่เดียว | 3 | ผมบ๊อบยาวถึงคาง (ผิดกฎทรงผม) |
| S5 | ไม่มีเสื้อ: ✅ / แผลเห็นชัด: ✅ | 4 | **แผลอยู่มือขวา นิ้วกลาง** (สั่งนิ้วชี้ซ้าย) — รอบ 01 ก็ผิดข้างเหมือนกัน |
| S8 | เตาตะกร้าดิน ไฟอยู่ในตะกร้า: ⚠️ ครึ่งเดียว | 4 | ไฟอยู่ทั้งในตะกร้าและใต้ตะกร้า; ตะกร้ามีขาสามขาถูกแล้ว |
| S2-a | บันไดแขวน: ⚠️ ผูกเชือกห้อยจากประตูแล้ว แต่ปลายยังแตะพื้น | 5 | – |
| S2-b | บันไดแขวน: ⚠️ เหมือน a | 4 | หน้าจั่วมีปั้นลมแบบมีหางหงส์ (ผิดกฎ "ornate gable finials") |

ที่ดีขึ้นทั่วทั้งรอบ: **เด็กหัวโกนไว้จุก นุ่งผ้าท่อนล่าง** ทุกภาพที่มีเด็ก (S2-b, S3-a, S3-b, S8); ชายสามัญไม่ใส่เสื้อทุกภาพ

**ความคงที่ (a/b)**

| โจทย์ | ทรงผมเหมือนกัน | เครื่องแต่งกายเหมือนกัน | สไตล์ภาพเหมือนกัน | หมายเหตุ |
|---|---|---|---|---|
| S2 | ✅ | ✅ | ✅ | ท่า มุมกล้อง ไซดักปลาแทบเหมือนเดิม — คงที่มาก |
| S3 | ❌ (โกนข้าง vs บ๊อบ) | ❌ (ผ้าห่มสองไหล่ vs ไหล่เดียว) | ✅ | จุดอ่อนที่สุดของรอบ |
| S6 | ✅ | – (prompt ไม่ได้ระบุ: a เสื้อแขนกุด, b ผ้ากระโจมอก) | ✅ | หน้า ทรงผม ฟันดำ ต่างหู คงที่ |

**รวมกับรอบ 01** (S4 = 4, S7 = 4, S9 = 5, S10 = 5): โจทย์ที่ ≥ 4 = 9 จาก 10 ถ้านับ S3 จากภาพที่ดีกว่า / 8 จาก 10 ถ้าไม่นับ S3 เลย

**ข้อสรุป:** ผ่านเกณฑ์ข้อแรก (≥ 8/10) แต่**ไม่ผ่านเกณฑ์ a/b ของ S3** — สไตล์ภาพคงที่ทุกคู่ ปัญหาที่เหลือเป็นรายละเอียดของ SUBJECT ไม่ใช่ STYLE

**ข้อจำกัดของเครื่องมือที่พบ (ไม่ใช่ปัญหาของ style block)**
1. **ผ้าห่มพาดสองไหล่** — สำเร็จราว 1 ใน 2 → ต้องสร้างหลายภาพแล้วคัด
2. **ซ้าย/ขวา** — Gemini ไม่สนใจข้างที่สั่ง (แผลผิดมือสองรอบติด) → prompt builder อย่าพึ่งข้าง; ถ้าข้างสำคัญให้กลับภาพทีหลัง
3. **ไฟใต้ตะกร้า** — ยังวาดไฟใต้ตะกร้าแม้สั่งห้าม → ยอมรับ หรือใช้มุมที่ไม่เห็นใต้ตะกร้า
4. **บันไดแขวน** — ผูกเชือกได้แล้ว แต่ปลายยังแตะพื้น → ถือว่าผ่าน
5. **ปั้นลมหางหงส์** โผล่บนเรือนชาวบ้านบางภาพ → เพิ่มคำห้ามให้ชัดขึ้น

## เกณฑ์ตรึง style v0.1

- S1, S3 (ทั้ง a และ b), S5, S8 ตรง lore ≥ 4 → รวมกับ S4, S7, S9, S10 ที่ผ่านในรอบ 01 จะได้ ≥ 8 จาก 10
- a/b ทั้งสามโจทย์: ทรงผม เครื่องแต่งกาย และสไตล์ไม่เปลี่ยน
- **บันไดแขวน:** ถ้า S2 ทั้งสองภาพยังเป็นบันไดพิง → ตัดออกจาก style block (ไม่นับเป็นเหตุให้ไม่ผ่าน)
- **ผ้าห่ม/ลอมพอก/เตา:** ถ้ายังผิด → ทดลองแก้ภาพเก่าแยกต่างหาก ถ้าแก้ภาพได้แต่สร้างใหม่ไม่ได้ = ปัญหาที่ถ้อยคำ ปรับอีกรอบ; ถ้าแก้ภาพก็ไม่ได้ = ข้อจำกัดของเครื่องมือ บันทึกไว้และเลี่ยงในภาพ

**สรุป:** ผ่าน / ไม่ผ่าน → `____`  สิ่งที่ต้องแก้ต่อ: `____`
