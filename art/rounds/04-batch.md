# รอบ 04 — ทดสอบ style v0.3 (แยก reality / reality_late) — 6 ภาพ ไม่แนบภาพอ้างอิง

**ทดสอบอะไร**
- ชุด A (reality, 2295–2315): ผมหญิงสั้นมีหงอนบนกระหม่อม **ไม่ใช่ undercut** (A3) และ A1/A2 ยังได้ผ้านุ่งจีบพองเหมือน v0.2 (regression)
- ชุด B (reality_late, 2373–2400): หญิงใส่เสื้อขาวแขนยาว + ผ้าพาดไหล่เดียวถูกยอมรับ (B1); ผมชายหญิงมองจากหลังคล้ายกัน (B2); ชายมีวงผมกลมบนกระหม่อม (B3)

**วิธีใช้:** ชุด A วางในแชตใหม่ 1 แชต พิมพ์ `next` ทุกครั้ง แล้ว **ชุด B วางในแชตใหม่อีกแชต** (style block คนละตัว ห้ามปนแชตเดียวกัน) ไม่ต้องแนบภาพ
เซฟภาพที่ `art/rounds/04/out/<id>.jfif` (หรือ .jpg) ตามชื่อที่กำกับ แล้วบอก Claude

| id | ชุด | ดูอะไร |
|----|-----|--------|
| A1-official | A | ผ้านุ่งจีบพอง ลอมพอก (regression) |
| A2-commoner-man | A | ผ้านุ่งจีบพอง ผมไม่ undercut บันไดแขวน |
| A3-wellborn-woman | A | ผ้าห่มพาดสองไหล่ ผมสั้นมีหงอน ไม่ undercut ไม่เกล้ามวย |
| B1-woman-jacket-scarf | B | เสื้อขาวแขนยาว ผ้าพาดไหล่เดียว ผมหงอน |
| B2-couple-from-behind | B | มองจากหลัง ผมชายหญิงคล้ายกัน |
| B3-commoner-man | B | วงผมกลมกระหม่อม ผ้านุ่งจีบ |

## ชุด A — style `reality` (mid-18th century)
```text
Please generate the following 3 historical illustrations, each in 16:9 aspect ratio. Generate one image per turn: start with Image 1 now, and after each image I will simply say "next" for the following one. Do not skip or merge images. Keep the same painterly style for all 3.

Every image MUST strictly follow this exact STYLE & HISTORICAL RULE BLOCK:
"Historical illustration of everyday life in Siam (Ayutthaya kingdom), mid-18th century. Muted earthy watercolor and ink on textured paper, soft natural daylight, restrained palette of ochre, indigo, rust and off-white. Grounded, documentary, ordinary weathered faces without makeup. Unless stated otherwise, Siamese adults of both sexes wear their black hair cropped level with the top of the ears, the hair below shaved close, lifted off the forehead, and their teeth are blackened from chewing betel. Women's short hair is brushed up into a small tuft on the crown. Commoner men are bare-chested. Men's lower cloth is pulled between the legs and tucked in at the back, forming loose pleated breeches that end at the knee, lower legs bare. A well-to-do woman's breast-cloth is wrapped around the chest covering both breasts, its two ends thrown back over both shoulders. Commoner houses are small, of woven split-bamboo panels raised on tall bamboo piles, entered by a short bamboo ladder hanging from the doorway by ropes with its foot off the ground. Any children present are bare-chested and wear a small lower cloth; children under eleven have shaved heads with a small topknot of hair left on the crown. Avoid: a high-fade or undercut hairstyle with sharply shaved sides, a shaved bald head, modern clothing or objects, tourist-poster look, fantasy costume, glossy digital rendering, glamour or model-like faces, makeup, buns or topknots on adult women, long loose hair, bob haircuts, a breast-cloth worn as a one-shoulder diagonal sash, modern Thai costume, shirts on commoner men, a sarong, longyi or wrapped skirt on men, long trousers, tiled roofs or ornate gable finials on commoner houses, ladders leaning on the ground, shorts or shirts on children."

Image 1 (`A1-official`):
Full-body view: a Siamese official, an adult man in his forties, standing in a timber house doorway, three-quarter view, wearing an open-front collarless white muslin over-shirt with very wide sleeves reaching almost to the wrist, hanging to the hips, over a patterned silk lower cloth. The lower cloth is NOT a wrapped skirt, sarong or trousers: its two ends are pulled together between the legs and tucked in at the back, so it forms loose pleated breeches that end at the knee, with the lower legs bare. Avoid: sarong, longyi, wrapped skirt, shorts hanging loose, long trousers. On his head is a tall, narrow, brimless white cloth hat shaped like a slender cone, about as tall as his head again, with thin gold bands near the base, tied under the chin with a cord. Barefoot; a pair of pointed heel-less slippers set beside him. Avoid also: hat brim, wide-brimmed hat, witch hat, farmer's hat, conical straw hat. (16:9 aspect ratio)

Image 2 (`A2-commoner-man`):
Full-body view: a Siamese commoner man in his twenties, bare-chested and barefoot, wearing a knee-length painted-cotton lower cloth, standing in front of a small bamboo stilt house whose doorway has a short bamboo ladder hanging from it by ropes, holding a woven fish trap. The lower cloth is NOT a wrapped skirt, sarong or trousers: its two ends are pulled together between the legs and tucked in at the back, so it forms loose pleated breeches that end at the knee, with the lower legs bare. Avoid: sarong, longyi, wrapped skirt, shorts hanging loose, long trousers. (16:9 aspect ratio)

Image 3 (`A3-wellborn-woman`):
Medium shot: a well-to-do Siamese woman in her thirties sitting on a reed mat with both legs folded to one side, wearing a black wrap skirt and a single white muslin cloth wrapped once around her chest covering both breasts, its two loose ends draped back over both shoulders like a shawl and hanging down on both sides; pear-shaped gold earrings, several rings on her last three fingers; a betel box beside her. Avoid also: one-shoulder sash, diagonal sash, cloth over only one shoulder, hair bun. (16:9 aspect ratio)
```

## ชุด B — style `reality_late` (ราว 2373–2400) — แชตใหม่
```text
Please generate the following 3 historical illustrations, each in 16:9 aspect ratio. Generate one image per turn: start with Image 1 now, and after each image I will simply say "next" for the following one. Do not skip or merge images. Keep the same painterly style for all 3.

Every image MUST strictly follow this exact STYLE & HISTORICAL RULE BLOCK:
"Historical illustration of everyday life in Siam (Ayutthaya kingdom), early-to-mid 19th century (about 1830 to 1855). Muted earthy watercolor and ink on textured paper, soft natural daylight, restrained palette of ochre, indigo, rust and off-white. Grounded, documentary, ordinary weathered faces without makeup. Unless stated otherwise, Siamese men shave the head close except for a round tuft of short upright hair on the crown; Siamese women crop their hair short all over with the crown hair brushed up into a small crest, not shaved bald, so from behind a woman can be hard to tell from a man; the teeth of both sexes are blackened from chewing betel. Commoner men are bare-chested. Men's lower cloth is pulled between the legs and tucked in at the back, forming loose pleated breeches that end at the knee, lower legs bare. A woman wears a wrap skirt and a long scarf draped diagonally over one shoulder and passing under the opposite arm; a lower-class woman may instead wear a plain tight long-sleeved white cotton jacket. Commoner houses are small, of woven split-bamboo panels raised on tall bamboo piles, entered by a short bamboo ladder hanging from the doorway by ropes with its foot off the ground. Any children present are bare-chested and wear a small lower cloth; children under eleven have shaved heads with a small topknot of hair left on the crown. Avoid: modern clothing or objects, tourist-poster look, fantasy costume, glossy digital rendering, glamour or model-like faces, makeup, long loose hair, bob haircuts, a bun or long hair on women, a high-fade or undercut hairstyle with sharply shaved sides, modern Thai costume, shirts on commoner men, a sarong, longyi or wrapped skirt on men, long trousers, tiled roofs or ornate gable finials on commoner houses, ladders leaning on the ground, shorts or shirts on children."

Image 1 (`B1-woman-jacket-scarf`):
Medium shot: a Siamese woman in her thirties sitting on a reed mat inside a timber house with her legs folded to one side, wearing a black wrap skirt, a plain tight long-sleeved white cotton jacket, and a long white crape scarf draped diagonally over one shoulder and passing under the opposite arm; short dark hair brushed up into a small crest on the crown, blackened teeth, small gold earrings; a betel box beside her. (16:9 aspect ratio)

Image 2 (`B2-couple-from-behind`):
Wide view from behind: a Siamese man and a Siamese woman walking away from the viewer side by side along a dirt path beside a canal toward a stilt house; the man bare-chested in a knee-length pleated lower cloth with a round tuft of short upright hair on his crown; the woman in a wrap skirt, a plain tight long-sleeved white cotton jacket and a scarf over one shoulder, her short hair brushed up into a small crest; from behind their hair looks very similar. (16:9 aspect ratio)

Image 3 (`B3-commoner-man`):
Full-body view: a Siamese commoner man in his twenties, bare-chested and barefoot, hair shaved close except a round tuft of short upright hair on the crown, wearing a knee-length patterned cloth drawn between the legs into loose pleats and tucked in at the back with a cloth sash at the waist, standing in front of a small bamboo stilt house whose doorway has a short bamboo ladder hanging from it by ropes with its foot off the ground, holding a woven fish trap. (16:9 aspect ratio)
```

## เกณฑ์ผ่าน
- A3/B1: ผมสั้นมีหงอนหรือกระจุกบนกระหม่อม ไม่ใช่โกนข้างสูงทรงทันสมัย ไม่เกล้ามวย
- A3: ผ้าห่มพาดสองไหล่ (ไม่ใช่เฉียงไหล่เดียว) ส่วน B1: ผ้าพาดไหล่เดียวถูกต้องและไม่ถูกเปลี่ยนเป็นสองไหล่
- B2: ผมไม่ต่างกันมากจนบอกเพศได้จากผมอย่างเดียว; ผู้หญิงไม่เปลือยอกด้านหลัง ไม่มีเรื่องเพศ
- ทุกภาพ: ผ้านุ่งชายจีบพองถึงเข่า ไม่ใช่ผ้าถุง; ฟันดำ; กฎเดิมครบ (บันไดแขวนปลายลอย ไม่มีปั้นลมงอนบนเรือนสามัญ)

## ผลรอบ 04 (style v0.3 ก่อนแก้ปากและผม)

| ภาพ | ผ้า/เครื่องแต่งกาย | ผม | ปาก/ฟัน | คะแนน |
|---|---|---|---|---|
| A1 ขุนนาง | ✅ ผ้านุ่งจีบพองถึงเข่า ลอมพอกกรวย เสื้อผ่าหน้า | (ไม่เห็น) | – | 4 (องค์ประกอบแคบอยู่กลางเฟรม) |
| A2 ชายสามัญ | ✅ จีบพอง บันไดเชือกแขวนปลายลอย | ❌ โกนข้างเรียบทรงทันสมัย | – | 3 |
| A3 หญิงมีฐานะ | ✅ ห่มพาดสองไหล่ | ❌ ทรงสูงเหมือน pompadour โกนข้าง (แย่กว่ารอบ 03b) | ❌ ริมฝีปากดำ | 3 |
| B1 หญิง เสื้อขาว+ผ้าไหล่เดียว | ✅ ตามที่สั่งช่วงปลายเกม | ⚠️ เสยหลังเรียบ ไม่เห็นหงอน แต่ไม่ผิด | ⚠️ ปากคล้ำ | 4 |
| B2 คู่มองจากหลัง | ✅ ผ้านุ่งชายจีบ หญิงเสื้อขาว+ผ้าพาด | ❌ ชายทรง mohawk/fade หญิงเกล้ามวย (ผิดกฎ) | – | 3 |
| B3 ชายสามัญ | ✅ จีบพอง บันไดแขวนปลายลอย | ❌ mohawk/fade มีวงกลมบนหัว | ❌ ปากดำ | 3 |

**สรุป:** ผ้านุ่ง/ผ้าห่มตามยุคใช้ได้ (แยก reality/late ได้ผล) แต่ผมไม่ดีขึ้น — คำว่า "shaved" ทำให้ Gemini วาดทรงทันสมัย และปากดำทุกภาพที่เห็นหน้าใกล้ → แก้ใน style.json แล้ว ทดสอบซ้ำที่ art/rounds/04b-batch.md
ข้อสังเกต: ตัวบท ลา ลูแบร์ (ตัดระดับบนใบหูโกนข้างล่าง) ทำให้ช่วง 2295–2315 หลีกเลี่ยงทรงโกนข้างไม่ได้เต็มที่ ยอมรับถ้าไม่เป็นหงอนสูง
