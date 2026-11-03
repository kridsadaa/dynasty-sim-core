# รอบ 04b — แก้หลังรอบ 04 (ริมฝีปาก + ผม) style v0.3 — 5 ภาพ ไม่แนบภาพอ้างอิง

**แก้อะไรจากรอบ 04** (ดูผลรอบ 04 ท้ายไฟล์ 04-batch.md): ฟันดำเฉพาะฟัน ริมฝีปากสีธรรมชาติ ไม่ดำ; ผมเป็นแบบแปรงสั้นตั้ง (ยาว 1–2 นิ้ว) ไม่ใช่ undercut/mohawk/pompadour และหญิงไม่เกล้ามวย

**วิธีใช้:** ชุด A วางในแชตใหม่ พิมพ์ `next` ทุกครั้ง แล้วชุด B วางในแชตใหม่อีกแชต (style block คนละตัว ห้ามปนกัน) ไม่ต้องแนบภาพ
เซฟที่ `art/rounds/04b/out/<id>.jfif` (หรือ .jpg) ตามชื่อที่กำกับ แล้วบอก Claude

| id | ชุด | ดูอะไร |
|----|-----|--------|
| A2-commoner-man | A | ผมไม่ undercut/quiff; ปากไม่ดำ; ผ้านุ่งจีบ |
| A3-wellborn-woman | A | ผมแปรงสั้น ไม่ quiff ไม่เกล้ามวย; ปากไม่ดำ; ห่มสองไหล่ |
| B1-woman-jacket-scarf | B | เสื้อขาวแขนยาว ผ้าพาดไหล่เดียว; ผมไม่เกล้า; ปากไม่ดำ |
| B2-couple-from-behind | B | มองจากหลัง ผมชายหญิงคล้ายกัน ไม่ mohawk ผู้หญิงไม่เกล้ามวย |
| B3-commoner-man | B | ผมแปรงสั้นตั้ง มีกระจุกกลมกระหม่อม ไม่ mohawk/fade; ปากไม่ดำ |

## ชุด A — style `reality` (mid-18th century)
```text
Please generate the following 2 historical illustrations, each in 16:9 aspect ratio. Generate one image per turn: start with Image 1 now, and after each image I will simply say "next" for the following one. Do not skip or merge images. Keep the same painterly style for all 2.

Every image MUST strictly follow this exact STYLE & HISTORICAL RULE BLOCK:
"Historical illustration of everyday life in Siam (Ayutthaya kingdom), mid-18th century. Muted earthy watercolor and ink on textured paper, soft natural daylight, restrained palette of ochre, indigo, rust and off-white. Grounded, documentary, ordinary weathered faces without makeup. Unless stated otherwise, Siamese adults of both sexes wear their black hair cropped level with the top of the ears, the hair below shaved close, lifted off the forehead, and their teeth are blackened from chewing betel: only the teeth are black, seen only when the mouth is open, while the lips and gums keep a natural colour, at most lightly stained reddish-brown, never black. Women's short hair is brush-like and stands up slightly, never styled into a quiff or pompadour. Commoner men are bare-chested. Men's lower cloth is pulled between the legs and tucked in at the back, forming loose pleated breeches that end at the knee, lower legs bare. A well-to-do woman's breast-cloth is wrapped around the chest covering both breasts, its two ends thrown back over both shoulders. Commoner houses are small, of woven split-bamboo panels raised on tall bamboo piles, entered by a short bamboo ladder hanging from the doorway by ropes with its foot off the ground. Any children present are bare-chested and wear a small lower cloth; children under eleven have shaved heads with a small topknot of hair left on the crown. Avoid: black or very dark lips, black lipstick, a quiff or pompadour, a shaved bald head, modern clothing or objects, tourist-poster look, fantasy costume, glossy digital rendering, glamour or model-like faces, makeup, buns or topknots on adult women, long loose hair, bob haircuts, a breast-cloth worn as a one-shoulder diagonal sash, modern Thai costume, shirts on commoner men, a sarong, longyi or wrapped skirt on men, long trousers, tiled roofs or ornate gable finials on commoner houses, ladders leaning on the ground, shorts or shirts on children."

Image 1 (`A2-commoner-man`):
Full-body view: a Siamese commoner man in his twenties, bare-chested and barefoot, wearing a knee-length painted-cotton lower cloth, standing in front of a small bamboo stilt house whose doorway has a short bamboo ladder hanging from it by ropes, holding a woven fish trap. The lower cloth is NOT a wrapped skirt, sarong or trousers: its two ends are pulled together between the legs and tucked in at the back, so it forms loose pleated breeches that end at the knee, with the lower legs bare. Avoid: sarong, longyi, wrapped skirt, shorts hanging loose, long trousers. (16:9 aspect ratio)

Image 2 (`A3-wellborn-woman`):
Medium shot: a well-to-do Siamese woman in her thirties sitting on a reed mat with both legs folded to one side, wearing a black wrap skirt and a single white muslin cloth wrapped once around her chest covering both breasts, its two loose ends draped back over both shoulders like a shawl and hanging down on both sides; pear-shaped gold earrings, several rings on her last three fingers; a betel box beside her. Avoid also: one-shoulder sash, diagonal sash, cloth over only one shoulder, hair bun. (16:9 aspect ratio)
```

## ชุด B — style `reality_late` (ราว 2373–2400) — แชตใหม่
```text
Please generate the following 3 historical illustrations, each in 16:9 aspect ratio. Generate one image per turn: start with Image 1 now, and after each image I will simply say "next" for the following one. Do not skip or merge images. Keep the same painterly style for all 3.

Every image MUST strictly follow this exact STYLE & HISTORICAL RULE BLOCK:
"Historical illustration of everyday life in Siam (Ayutthaya kingdom), early-to-mid 19th century (about 1830 to 1855). Muted earthy watercolor and ink on textured paper, soft natural daylight, restrained palette of ochre, indigo, rust and off-white. Grounded, documentary, ordinary weathered faces without makeup. Unless stated otherwise, Siamese men and women crop the hair short, only an inch or two long, standing up like a brush; men keep a slightly longer round tuft on the crown and women a small raised tuft at the crown, with no contrast between shaved sides and a longer top, so from behind a woman can be hard to tell from a man; the teeth of both sexes are blackened from chewing betel: only the teeth are black, seen only when the mouth is open, while the lips and gums keep a natural colour, at most lightly stained reddish-brown, never black. Commoner men are bare-chested. Men's lower cloth is pulled between the legs and tucked in at the back, forming loose pleated breeches that end at the knee, lower legs bare. A woman wears a wrap skirt and a long scarf draped diagonally over one shoulder and passing under the opposite arm; a lower-class woman may instead wear a plain tight long-sleeved white cotton jacket. Commoner houses are small, of woven split-bamboo panels raised on tall bamboo piles, entered by a short bamboo ladder hanging from the doorway by ropes with its foot off the ground. Any children present are bare-chested and wear a small lower cloth; children under eleven have shaved heads with a small topknot of hair left on the crown. Avoid: modern clothing or objects, tourist-poster look, fantasy costume, glossy digital rendering, glamour or model-like faces, makeup, long loose hair, bob haircuts, a bun or long hair on women, a high-fade, undercut or mohawk hairstyle, a pompadour, black or very dark lips, black lipstick, modern Thai costume, shirts on commoner men, a sarong, longyi or wrapped skirt on men, long trousers, tiled roofs or ornate gable finials on commoner houses, ladders leaning on the ground, shorts or shirts on children."

Image 1 (`B1-woman-jacket-scarf`):
Medium shot: a Siamese woman in her thirties sitting on a reed mat inside a timber house with her legs folded to one side, wearing a black wrap skirt, a plain tight long-sleeved white cotton jacket, and a long white crape scarf draped diagonally over one shoulder and passing under the opposite arm; short brush-like dark hair an inch or two long standing up with a small raised tuft at the crown (no bun), blackened teeth with natural-coloured lips, small gold earrings; a betel box beside her. (16:9 aspect ratio)

Image 2 (`B2-couple-from-behind`):
Wide view from behind: a Siamese man and a Siamese woman walking away from the viewer side by side along a dirt path beside a canal toward a stilt house; the man bare-chested in a knee-length pleated lower cloth with short brush-like hair standing up and a slightly longer round tuft on his crown; the woman in a wrap skirt, a plain tight long-sleeved white cotton jacket and a scarf over one shoulder, her short brush-like hair standing up with a small raised tuft at the crown, no bun; from behind their hair looks very similar. (16:9 aspect ratio)

Image 3 (`B3-commoner-man`):
Full-body view: a Siamese commoner man in his twenties, bare-chested and barefoot, hair an inch or two long standing up like a brush with a slightly longer round tuft on the crown, wearing a knee-length patterned cloth drawn between the legs into loose pleats and tucked in at the back with a cloth sash at the waist, standing in front of a small bamboo stilt house whose doorway has a short bamboo ladder hanging from it by ropes with its foot off the ground, holding a woven fish trap. (16:9 aspect ratio)
```

## เกณฑ์ผ่าน
- A3/B1: ผมสั้นมีหงอนหรือกระจุกบนกระหม่อม ไม่ใช่โกนข้างสูงทรงทันสมัย ไม่เกล้ามวย
- A3: ผ้าห่มพาดสองไหล่ (ไม่ใช่เฉียงไหล่เดียว) ส่วน B1: ผ้าพาดไหล่เดียวถูกต้องและไม่ถูกเปลี่ยนเป็นสองไหล่
- B2: ผมไม่ต่างกันมากจนบอกเพศได้จากผมอย่างเดียว; ผู้หญิงไม่เปลือยอกด้านหลัง ไม่มีเรื่องเพศ
- ทุกภาพ: ผ้านุ่งชายจีบพองถึงเข่า ไม่ใช่ผ้าถุง; ฟันดำ; กฎเดิมครบ (บันไดแขวนปลายลอย ไม่มีปั้นลมงอนบนเรือนสามัญ)

## ผลรอบ 04b (ก่อนย้ายฟันดำไปชั้น SUBJECT)

| ภาพ | ผ้า/ยุค | ผม | ปาก | คะแนน |
|---|---|---|---|---|
| A2 ชายสามัญ | ✅ จีบพอง | ⚠️ ตัดสั้นขอบคม ดูทันสมัยแต่ไม่ถึง pompadour | ❌ ปากปิด ริมฝีปาก/หนวดดำ | 3 (บันไดปลายแตะพื้น) |
| A3 หญิงมีฐานะ | ❌ ผ้าเฉียงไหล่เดียว (ควรสองไหล่) | ❌ มีมวยบนศีรษะ + โกนข้าง | ❌ ริมฝีปากดำสนิท | 2 |
| B1 หญิง เสื้อขาว+ผ้าไหล่เดียว | ✅ | ✅ แปรงสั้น ไม่เกล้า | ✅ อ้าปาก ฟันดำ ริมฝีปากธรรมชาติ | 5 |
| B2 คู่มองจากหลัง | ✅ | ⚠️ ชายโกนข้างมีแถบกลาง; หญิงแปรงสั้น ไม่เกล้า ✅ | – | 3–4 (บันไดแตะพื้น) |
| B3 ชายสามัญ | ✅ | ❌ โกนข้าง + มวยบนหัว | ✅ อ้าปาก ฟันดำ ริมฝีปากธรรมชาติ | 3 |

**สรุป:** ริมฝีปากถูกต้องเฉพาะภาพที่อ้าปากเห็นฟัน (B1, B3); ภาพปากปิด (A2, A3) ยังดำ → ถอดประโยคฟันดำออกจาก block ย้ายไปชั้น SUBJECT (ตรงกับคำแนะนำข้อ 1 ที่ผู้ใช้ส่งจาก Gemini) ผมช่วง late: คำว่า tuft ถูกวาดเป็นมวย → เปลี่ยนเป็นวงผมตาม Crawfurd; ผ้าห่มสองไหล่ใน A3 ยังพลาด (ข้อจำกัดเดิม breast_cloth_drape ราวครึ่งต่อครึ่ง) ควรสร้าง 2 ภาพแล้วคัด
