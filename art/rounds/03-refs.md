# รอบ 03 — ทดสอบ prompt + ภาพอ้างอิงจากภาพแกะ La Loubère (1691)

**เป้าหมาย:** ดูว่าแนบภาพแกะร่วมยุคไปกับ prompt แล้วผ้านุ่ง "ลอดหว่างขา" ถูกต้องขึ้นกว่า approved เดิมไหม
**ปัญหาที่เจอใน approved เดิม** (เทียบกับภาพแกะ):
- S1 ขุนนาง: ผ้านุ่งเป็นผ้าพันแบบโสร่ง/ผ้าถุง ไม่ลอดหว่างขา (ภาพแกะเป็นจีบพองเหมือนกางเกงสั้นถึงเข่า) — prompt เดิมไม่ได้สั่งเรื่องนี้เลย
- S2 ชายสามัญ: ผ้าห้อยพองหลวมเหมือนกางเกงขาสั้น ไม่ได้ดึงลอดหว่างขา ทั้งที่ prompt เดิมสั่งไว้

**ภาพอ้างอิง** (สมบัติสาธารณะ — BnF/Gallica ผ่าน Wikimedia Commons; ใช้ป้อนเข้า Gemini ได้ `input-ok`): [`refs/`](03/refs/)
- `REF-A-mandarin-back.jpg` — "Mandarin Siamois" (To.1 pag.90) มองจากด้านหลัง ผ้านุ่งลอดหว่างขา เสื้อคลุมแขนกว้างยาวถึงสะโพก
- `REF-B-paddlers.jpg` — "Pagayeurs" (To.1 pag.154) ชายสามัญเปลือยอก ผ้านุ่งเก็บเข้าหว่างขา ผมตัดสั้น

## วิธีทดสอบ
1. แชทใหม่ทุกครั้ง แนบภาพอ้างอิงที่ระบุ + วาง prompt ทั้งก้อน (style block ใส่ให้แล้ว)
2. สร้างแต่ละโจทย์ **2 ครั้ง** (a, b) เพราะผลสุ่ม
3. จดชื่อ/รุ่นโมเดลที่ Gemini แสดง
4. บันทึกภาพที่ `art/rounds/03/out/` ชื่อ `S1-a`, `S1-b`, `S2-a`, `S2-b`, `S3-a`, `S3-b` (ไม่ขึ้น git)
5. เอาภาพมาให้ Claude เทียบกับภาพอ้างอิง

## S1-r — ขุนนาง (แนบ REF-A)
```
The attached image is a 1691 copper engraving. Use it ONLY as a reference for how the lower cloth is worn and gathered (breeches-like, pulled between the legs) and the cut of the loose shirt. Do NOT copy its engraving/line style, its composition, its face or its pose; paint a new scene in the style described below.

Historical illustration of everyday life in Siam (Ayutthaya kingdom), mid-18th century. Muted earthy watercolor and ink on textured paper, soft natural daylight, restrained palette of ochre, indigo, rust and off-white. Grounded, documentary, ordinary weathered faces without makeup. Unless stated otherwise, Siamese adults of both sexes wear their black hair cropped level with the top of the ears, the hair below shaved close, lifted off the forehead, and their teeth are blackened from chewing betel. Commoner men are bare-chested. A well-to-do woman's breast-cloth is wrapped around the chest covering both breasts, its two ends thrown back over both shoulders. Commoner houses are small, of woven split-bamboo panels raised on tall bamboo piles, entered by a short bamboo ladder hanging from the doorway by ropes with its foot off the ground. Any children present are bare-chested and wear a small lower cloth; children under eleven have shaved heads with a small topknot of hair left on the crown. Avoid: modern clothing or objects, tourist-poster look, fantasy costume, glossy digital rendering, glamour or model-like faces, makeup, buns or topknots on adult women, long loose hair, bob haircuts, a breast-cloth worn as a one-shoulder diagonal sash, modern Thai costume, shirts on commoner men, tiled roofs or ornate gable finials on commoner houses, ladders leaning on the ground, shorts or shirts on children.

Full-body view: a Siamese official, an adult man in his forties, standing in a timber house doorway, three-quarter view, wearing an open-front collarless white muslin over-shirt with very wide sleeves reaching almost to the wrist, hanging to the hips, over a patterned silk lower cloth. The lower cloth is NOT a wrapped skirt, sarong or trousers: its two ends are pulled together between the legs and tucked in at the back, so it forms loose pleated breeches that end at the knee, with the lower legs bare. Avoid: sarong, longyi, wrapped skirt, shorts hanging loose, long trousers. On his head is a tall, narrow, brimless white cloth hat shaped like a slender cone, about as tall as his head again, with thin gold bands near the base, tied under the chin with a cord. Barefoot; a pair of pointed heel-less slippers set beside him. Avoid also: hat brim, wide-brimmed hat, witch hat, farmer's hat, conical straw hat.
```

## S2-r — ชายสามัญ (แนบ REF-B)
```
The attached image is a 1691 copper engraving. Use it ONLY as a reference for how the lower cloth is worn (pulled between the legs, gathered into pleated breeches to the knee), the bare chest and the short cropped hair. Do NOT copy its engraving/line style, its composition, its face or its pose; paint a new scene in the style described below.

Historical illustration of everyday life in Siam (Ayutthaya kingdom), mid-18th century. Muted earthy watercolor and ink on textured paper, soft natural daylight, restrained palette of ochre, indigo, rust and off-white. Grounded, documentary, ordinary weathered faces without makeup. Unless stated otherwise, Siamese adults of both sexes wear their black hair cropped level with the top of the ears, the hair below shaved close, lifted off the forehead, and their teeth are blackened from chewing betel. Commoner men are bare-chested. A well-to-do woman's breast-cloth is wrapped around the chest covering both breasts, its two ends thrown back over both shoulders. Commoner houses are small, of woven split-bamboo panels raised on tall bamboo piles, entered by a short bamboo ladder hanging from the doorway by ropes with its foot off the ground. Any children present are bare-chested and wear a small lower cloth; children under eleven have shaved heads with a small topknot of hair left on the crown. Avoid: modern clothing or objects, tourist-poster look, fantasy costume, glossy digital rendering, glamour or model-like faces, makeup, buns or topknots on adult women, long loose hair, bob haircuts, a breast-cloth worn as a one-shoulder diagonal sash, modern Thai costume, shirts on commoner men, tiled roofs or ornate gable finials on commoner houses, ladders leaning on the ground, shorts or shirts on children.

Full-body view: a Siamese commoner man in his twenties, bare-chested and barefoot, wearing a knee-length painted-cotton lower cloth, standing in front of a small bamboo stilt house whose doorway has a short bamboo ladder hanging from it by ropes, holding a woven fish trap. The lower cloth is NOT a wrapped skirt, sarong or trousers: its two ends are pulled together between the legs and tucked in at the back, so it forms loose pleated breeches that end at the knee, with the lower legs bare. Avoid: sarong, longyi, wrapped skirt, shorts hanging loose, long trousers.
```

## S3-r — หญิงมีฐานะ (แนบ REF-C) — ทดสอบผ้าห่มพาดสองไหล่ (ข้อจำกัดเดิม `breast_cloth_drape` สำเร็จราว 1 ใน 2)
- `REF-C-boxer-woman-1590.jpg` — ตัดเฉพาะผู้หญิงจาก Boxer Codex (ราว พ.ศ. 2133, สมบัติสาธารณะ) ผ้าพาดสองไหล่ ชายห้อยสองข้าง
- ⚠️ ภาพนี้เก่ากว่ายุคเกมราว 160 ปี และผู้หญิงในภาพเกล้ามวย ซึ่งขัดกับกฎผมของเรา (ผมสั้นระดับใบหู) จึงสั่งให้ใช้แค่ท่าห่มผ้า ถ้า Gemini ลอกมวยมาให้ถือว่าไม่ผ่าน
```
The attached image is a c.1590 manuscript painting. Use it ONLY as a reference for how a single cloth is draped over both shoulders so that its two ends hang down on either side of the chest. Do NOT copy its painting style, colors, stripes, composition, face or her hair; paint a new scene in the style described below.

Historical illustration of everyday life in Siam (Ayutthaya kingdom), mid-18th century. Muted earthy watercolor and ink on textured paper, soft natural daylight, restrained palette of ochre, indigo, rust and off-white. Grounded, documentary, ordinary weathered faces without makeup. Unless stated otherwise, Siamese adults of both sexes wear their black hair cropped level with the top of the ears, the hair below shaved close, lifted off the forehead, and their teeth are blackened from chewing betel. Commoner men are bare-chested. A well-to-do woman's breast-cloth is wrapped around the chest covering both breasts, its two ends thrown back over both shoulders. Commoner houses are small, of woven split-bamboo panels raised on tall bamboo piles, entered by a short bamboo ladder hanging from the doorway by ropes with its foot off the ground. Any children present are bare-chested and wear a small lower cloth; children under eleven have shaved heads with a small topknot of hair left on the crown. Avoid: modern clothing or objects, tourist-poster look, fantasy costume, glossy digital rendering, glamour or model-like faces, makeup, buns or topknots on adult women, long loose hair, bob haircuts, a breast-cloth worn as a one-shoulder diagonal sash, modern Thai costume, shirts on commoner men, tiled roofs or ornate gable finials on commoner houses, ladders leaning on the ground, shorts or shirts on children.

Medium shot: a well-to-do Siamese woman in her thirties sitting on a reed mat with both legs folded to one side, wearing a black wrap skirt and a single white muslin cloth wrapped once around her chest covering both breasts, its two loose ends draped back over both shoulders like a shawl and hanging down on both sides; pear-shaped gold earrings, several rings on her last three fingers; a betel box beside her. Avoid also: one-shoulder sash, diagonal sash, cloth over only one shoulder, hair bun.
```

## เกณฑ์ผ่าน (ตรวจโดยดูภาพเทียบ ref)
- ผ้านุ่งเป็นจีบพองถึงเข่า เห็นว่ารวบลอดหว่างขา ไม่ใช่ผ้าถุง/กางเกงขาสั้นหลวม/กางเกงขายาว
- ไม่ลอกสไตล์ภาพแกะ (ต้องยังเป็นสีน้ำ) ไม่ลอกใบหน้า/ท่า
- กฎเดิมยังอยู่ครบ (ผม ฟันดำ เปลือยอก ลอมพอกไม่มีปีก บันไดแขวน)

## ผลรอบ 03 (สร้างโจทย์ละ 1 ภาพ — ยังไม่มี a/b)

| ภาพ | ผ้า/เครื่องแต่งกาย | กฎเดิม | คะแนน | ข้อสังเกต |
|---|---|---|---|---|
| `S1-r` ขุนนาง | ✅ ผ้านุ่งเป็นจีบพองถึงเข่า เหน็บเอว เหมือนภาพแกะ (approved เดิมเป็นผ้าถุงแบบโสร่ง) | ✅ เสื้อผ่าหน้าแขนกว้าง ลอมพอกมีแถบทอง สายรัดคาง รองเท้าแตะปลายงอ | 4 | ลอมพอกเรียวแหลมเป็นกรวยบางกว่า approved เดิม; ฉากเป็นเรือนไม้แผ่นไม่ใช่เรือนไผ่ |
| `S2-r` ชายสามัญ | ⚠️ ดีขึ้น (จีบพอง ถึงเข่า) แต่ยังดูเป็นกางเกงขาสั้นหลวมมากกว่าผ้าลอดหว่างขา | ✅ เปลือยอก ผมตัดตรง ฟันดำ | 4 | บันไดวางพื้นและเชือกห้อยไม่ผูกกับบันได (ข้อจำกัด `hanging_ladder` เดิม) |
| `S3-r` หญิงมีฐานะ | ✅ ผ้าห่มพาดสองไหล่ ชายห้อยสองข้าง | ✅ ไม่เกล้ามวย (ไม่ลอกจาก ref) ผมเรียบ ฟันดำ เด็กมีจุกและผ้านุ่ง | 5 | – |

**ข้อควรระวังในการสรุป:** รอบนี้เปลี่ยนทั้ง "ภาพอ้างอิง" และ "ถ้อยคำเรื่องผ้านุ่ง" พร้อมกัน จึงยังไม่รู้ว่าอะไรช่วย → รอบ 03b: สร้าง S1 กับ S2 แบบ **ไม่แนบภาพ** ใช้ prompt เดียวกัน (ตัดย่อหน้า "The attached image…" ออก) ถ้าผ่านเท่ากัน ก็ใช้ถ้อยคำใหม่ใน style.json ได้เลย ไม่ต้องแนบภาพทุกครั้ง
