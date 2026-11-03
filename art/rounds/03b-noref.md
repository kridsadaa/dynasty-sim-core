# รอบ 03b — ควบคุม: prompt เดียวกับรอบ 03 แต่ **ไม่แนบภาพ**

**เป้าหมาย:** แยกว่าที่ดีขึ้นในรอบ 03 มาจากภาพอ้างอิง หรือจากถ้อยคำเรื่องผ้านุ่งที่ละเอียดขึ้น
prompt = รอบ 03 ตัดย่อหน้า "The attached image…" ออก ส่วนที่เหลือเหมือนเดิมทุกตัวอักษร

## วิธีทดสอบ
1. แชทใหม่ทุกครั้ง **ห้ามแนบภาพ** วาง prompt ทั้งก้อน
2. S1 และ S2 สร้างโจทย์ละ **2 ครั้ง** (a, b) ส่วน S3 สร้าง 1 ครั้ง (ข้อจำกัดเดิมคือผ้าห่มพาดสองไหล่สำเร็จราว 1 ใน 2 จึงดูแนวโน้มเท่านั้น)
3. จดรุ่นโมเดลที่ Gemini แสดง
4. บันทึกที่ `art/rounds/03b/out/` ชื่อ `S1-a`, `S1-b`, `S2-a`, `S2-b`, `S3-a`
5. ส่งมาให้ Claude เทียบกับ REF-A / REF-B / REF-C

## S1-n — ขุนนาง
```
Historical illustration of everyday life in Siam (Ayutthaya kingdom), mid-18th century. Muted earthy watercolor and ink on textured paper, soft natural daylight, restrained palette of ochre, indigo, rust and off-white. Grounded, documentary, ordinary weathered faces without makeup. Unless stated otherwise, Siamese adults of both sexes wear their black hair cropped level with the top of the ears, the hair below shaved close, lifted off the forehead, and their teeth are blackened from chewing betel. Commoner men are bare-chested. A well-to-do woman's breast-cloth is wrapped around the chest covering both breasts, its two ends thrown back over both shoulders. Commoner houses are small, of woven split-bamboo panels raised on tall bamboo piles, entered by a short bamboo ladder hanging from the doorway by ropes with its foot off the ground. Any children present are bare-chested and wear a small lower cloth; children under eleven have shaved heads with a small topknot of hair left on the crown. Avoid: modern clothing or objects, tourist-poster look, fantasy costume, glossy digital rendering, glamour or model-like faces, makeup, buns or topknots on adult women, long loose hair, bob haircuts, a breast-cloth worn as a one-shoulder diagonal sash, modern Thai costume, shirts on commoner men, tiled roofs or ornate gable finials on commoner houses, ladders leaning on the ground, shorts or shirts on children.

Full-body view: a Siamese official, an adult man in his forties, standing in a timber house doorway, three-quarter view, wearing an open-front collarless white muslin over-shirt with very wide sleeves reaching almost to the wrist, hanging to the hips, over a patterned silk lower cloth. The lower cloth is NOT a wrapped skirt, sarong or trousers: its two ends are pulled together between the legs and tucked in at the back, so it forms loose pleated breeches that end at the knee, with the lower legs bare. Avoid: sarong, longyi, wrapped skirt, shorts hanging loose, long trousers. On his head is a tall, narrow, brimless white cloth hat shaped like a slender cone, about as tall as his head again, with thin gold bands near the base, tied under the chin with a cord. Barefoot; a pair of pointed heel-less slippers set beside him. Avoid also: hat brim, wide-brimmed hat, witch hat, farmer's hat, conical straw hat.
```

## S2-n — ชายสามัญ
```
Historical illustration of everyday life in Siam (Ayutthaya kingdom), mid-18th century. Muted earthy watercolor and ink on textured paper, soft natural daylight, restrained palette of ochre, indigo, rust and off-white. Grounded, documentary, ordinary weathered faces without makeup. Unless stated otherwise, Siamese adults of both sexes wear their black hair cropped level with the top of the ears, the hair below shaved close, lifted off the forehead, and their teeth are blackened from chewing betel. Commoner men are bare-chested. A well-to-do woman's breast-cloth is wrapped around the chest covering both breasts, its two ends thrown back over both shoulders. Commoner houses are small, of woven split-bamboo panels raised on tall bamboo piles, entered by a short bamboo ladder hanging from the doorway by ropes with its foot off the ground. Any children present are bare-chested and wear a small lower cloth; children under eleven have shaved heads with a small topknot of hair left on the crown. Avoid: modern clothing or objects, tourist-poster look, fantasy costume, glossy digital rendering, glamour or model-like faces, makeup, buns or topknots on adult women, long loose hair, bob haircuts, a breast-cloth worn as a one-shoulder diagonal sash, modern Thai costume, shirts on commoner men, tiled roofs or ornate gable finials on commoner houses, ladders leaning on the ground, shorts or shirts on children.

Full-body view: a Siamese commoner man in his twenties, bare-chested and barefoot, wearing a knee-length painted-cotton lower cloth, standing in front of a small bamboo stilt house whose doorway has a short bamboo ladder hanging from it by ropes, holding a woven fish trap. The lower cloth is NOT a wrapped skirt, sarong or trousers: its two ends are pulled together between the legs and tucked in at the back, so it forms loose pleated breeches that end at the knee, with the lower legs bare. Avoid: sarong, longyi, wrapped skirt, shorts hanging loose, long trousers.
```

## S3-n — หญิงมีฐานะ
```
Historical illustration of everyday life in Siam (Ayutthaya kingdom), mid-18th century. Muted earthy watercolor and ink on textured paper, soft natural daylight, restrained palette of ochre, indigo, rust and off-white. Grounded, documentary, ordinary weathered faces without makeup. Unless stated otherwise, Siamese adults of both sexes wear their black hair cropped level with the top of the ears, the hair below shaved close, lifted off the forehead, and their teeth are blackened from chewing betel. Commoner men are bare-chested. A well-to-do woman's breast-cloth is wrapped around the chest covering both breasts, its two ends thrown back over both shoulders. Commoner houses are small, of woven split-bamboo panels raised on tall bamboo piles, entered by a short bamboo ladder hanging from the doorway by ropes with its foot off the ground. Any children present are bare-chested and wear a small lower cloth; children under eleven have shaved heads with a small topknot of hair left on the crown. Avoid: modern clothing or objects, tourist-poster look, fantasy costume, glossy digital rendering, glamour or model-like faces, makeup, buns or topknots on adult women, long loose hair, bob haircuts, a breast-cloth worn as a one-shoulder diagonal sash, modern Thai costume, shirts on commoner men, tiled roofs or ornate gable finials on commoner houses, ladders leaning on the ground, shorts or shirts on children.

Medium shot: a well-to-do Siamese woman in her thirties sitting on a reed mat with both legs folded to one side, wearing a black wrap skirt and a single white muslin cloth wrapped once around her chest covering both breasts, its two loose ends draped back over both shoulders like a shawl and hanging down on both sides; pear-shaped gold earrings, several rings on her last three fingers; a betel box beside her. Avoid also: one-shoulder sash, diagonal sash, cloth over only one shoulder, hair bun.
```

## วิธีตัดสิน
- ผ้านุ่ง S1/S2 เป็นจีบพองลอดหว่างขาเทียบ ref ได้เท่ารอบ 03 → ไม่ต้องแนบภาพ นำถ้อยคำใหม่เข้า style.json
- แย่กว่าชัดเจน (กลับเป็นผ้าถุง/กางเกงหลวม) → ต้องแนบ ref ทุกครั้ง
- ผ้าห่ม S3 เป็นสไบเฉียงไหล่เดียว → ยืนยันว่าภาพ REF-C ช่วยได้

## ผลรอบ 03b (ไม่แนบภาพ, แชตเดียว 5 ภาพ, style block วางครั้งเดียวต้นแชต)

| ภาพ | ผ้านุ่ง/ผ้าห่ม | กฎเดิม | คะแนน | ข้อสังเกต |
|---|---|---|---|---|
| `S1-a` ขุนนาง | ✅ จีบพองถึงเข่า เหน็บเอว | ✅ ลอมพอกทรงกรวย แถบทอง สายรัดคาง ฟันดำ | 4 | เรือนไม้แกะสลักหรู (ขุนนางพอรับได้) |
| `S1-b` ขุนนาง | ✅ จีบพองถึงเข่า | ✅ ลอมพอก | 4 | หลังคากระเบื้อง + มีหนวด (ไม่มีหลักฐานใน lore ทั้งสองทาง) |
| `S2-a` ชายสามัญ | ⚠️ จีบพองถึงเข่า ยังคล้ายกางเกงหลวม | ✅ เปลือยอก ฟันดำ **บันไดแขวนปลายลอยพ้นพื้น** | 4 | สร้อยลูกปัด (ไม่มีใน lore); ผมสั้นโกนข้างแบบ undercut ดูทันสมัย |
| `S2-b` ชายสามัญ | ⚠️ เหมือน a (มีผ้าคาดเอวสีแดง) | ✅ เปลือยอก บันไดเชือกแขวนลอย | 4 | ผมแบบเดียวกับ a |
| `S3-a` หญิงมีฐานะ | ✅ ผ้าห่มพาดสองไหล่ ชายห้อยสองข้าง | ✅ ไม่เกล้ามวย ฟันดำ | 5 | ผมโกนข้างแบบ undercut ดูทันสมัย (ตัวอย่างเดียว) |

**สรุป:** ไม่แนบภาพก็ได้ผลเท่ากับรอบ 03 (แนบภาพ) → ถ้อยคำเรื่องผ้านุ่งที่ละเอียดขึ้นคือสิ่งที่ช่วย ไม่จำเป็นต้องแนบ ref ทุกครั้ง
**ข้อจำกัดของข้อสรุป:** S1/S2 ตัวอย่างโจทย์ละ 2, S3 ตัวอย่างเดียว; รอบนี้ style block วางต่างจากรอบ 03 อีกอย่างหนึ่งด้วย
