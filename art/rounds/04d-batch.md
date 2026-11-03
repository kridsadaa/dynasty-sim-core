# รอบ 04c — style v0.6 (reality ปรับตามภาพที่ผู้ใช้เลือก) — 6 ภาพ ไม่แนบภาพอ้างอิง

**เปลี่ยนจากรอบ 04b:** `reality` ใช้แนวผม/ผ้าตามที่ผู้ใช้เลือกจากภาพ Gemini_Generated_Image_5tsgaj5tsgaj5tsg (การตัดสินใจเชิงศิลป์ ดู lore attire.art_direction_user_2569_11_03); ฟันดำอยู่ชั้น SUBJECT เฉพาะภาพที่อ้าปาก; `reality_late` ยังเป็นตามตัวบท (ผมแปรง เสื้อขาว ผ้าพาดไหล่เดียว)

**วิธีใช้:** ชุด A (4 ภาพ) วางในแชตใหม่ พิมพ์ `next` ทุกครั้ง แล้ว **ชุด B (2 ภาพ) วางในแชตใหม่อีกแชต** (style block คนละตัว) ไม่ต้องแนบภาพ
เซฟที่ `art/rounds/04d/out/<id>.jfif` (หรือ .jpg) ตามชื่อที่กำกับ แล้วบอก Claude

| id | ชุด | ดูอะไร |
|----|-----|--------|
| A2-commoner-man | A | ผมทรง Mahatthai แสกกลางหวีเรียบ โกนรอบ; อ้าปากฟันดำ ริมฝีปากไม่ดำ; ผ้านุ่งจีบ; บันไดแขวนปลายลอย |
| A3-wellborn-woman | A | ผมแปรงตั้งยอดแบน; ผ้าแถบ+สไบไหล่ซ้าย แขนเปลือย ไม่มีแขนเสื้อ; ริมฝีปากไม่ดำ |
| A3-wellborn-woman-b | A | ซ้ำ A3 (ผ้าห่มสำเร็จราวครึ่งต่อครึ่ง ให้คัด) |
| A4-man-hair-from-behind | A | ทรง Mahatthai: ผมกลางกระหม่อมแสกกลางหวีเรียบ แนวโกนรอบหัวคมชัด (ใหม่ — ดูก่อนว่าออกมาแบบไหน) |
| B1-woman-jacket-scarf | B | เสื้อขาวแขนยาว+ผ้าพาดไหล่เดียว (ตัวบท); อ้าปากฟันดำ ริมฝีปากไม่ดำ; ไม่เกล้า |
| B3-commoner-man | B | วงผมกระหม่อมไม่เป็นมวย ไม่ mohawk; อ้าปากฟันดำ ริมฝีปากไม่ดำ |

## ชุด A — style `reality` v0.6
```text
Please generate the following 1 historical illustrations, each in 16:9 aspect ratio. Generate one image per turn: start with Image 1 now, and after each image I will simply say "next" for the following one. Do not skip or merge images. Keep the same painterly style for all 1.

Every image MUST strictly follow this exact STYLE & HISTORICAL RULE BLOCK:
"Historical illustration of everyday life in Siam (Ayutthaya kingdom), mid-18th century. Muted earthy watercolor and ink on textured paper, soft natural daylight, restrained palette of ochre, indigo, rust and off-white. Grounded, documentary, ordinary weathered faces without makeup. Unless stated otherwise, Men wear the traditional 'Mahatthai' hairstyle: short, slightly wavy hair is kept only on the top of the head (about 3-5 cm long) and combed to the side, while the sides and back of the head below the crown are shaved close to the skin with a sharp, straight, clean-edged perimeter line. Siamese women have short black hair on the top crown brushed straight up into a neat, flat-topped, brush-like crest about 4 to 5 cm high, the lower sides and back clipped very short, with very short thin sideburn wisps in front of the ears that end strictly at earlobe level. Faces are natural and unmade-up, with natural muted reddish-brown lips. Commoner men are bare-chested. Men's lower cloth is pulled between the legs and tucked in at the back, forming loose pleated breeches that end at the knee, lower legs bare. Commoner women are either bare-chested or wear only a tight horizontal breast-cloth wrapped around the chest, leaving both shoulders and both arms completely bare. Well-to-do women wear a horizontal breast-cloth wrapped snugly around the torso, optionally with a single-shoulder diagonal sash over the left shoulder only, leaving the right shoulder and both arms completely bare and uncovered. Commoner houses are small, of woven split-bamboo panels raised on tall bamboo piles, entered by a short bamboo ladder hanging from the doorway by ropes with its foot off the ground. Any children present are bare-chested and wear a small lower cloth; children under eleven have shaved heads with a small topknot of hair left on the crown. Avoid: black lips, dark lipstick, black-painted mouth, open-mouth grin, a shaved bald head, modern clothing or objects, tourist-poster look, fantasy costume, glossy digital rendering, glamour or model-like faces, makeup, buns or topknots on adult women, long loose hair, bob haircuts, a shawl covering both shoulders, fabric draping over the upper arms like sleeves, fitted blouses, sleeves of any kind, modern Thai costume, shirts on commoner men, a sarong, longyi or wrapped skirt on men, long trousers, tiled roofs or ornate gable finials on commoner houses, ladders leaning on the ground, shorts or shirts on children."

Image 1 (`A2-commoner-man`):
Full-body view: a Siamese commoner man in his twenties, bare-chested and barefoot, wearing a knee-length painted-cotton lower cloth, standing in front of a small bamboo stilt house whose doorway has a short bamboo ladder hanging from it by ropes, holding a woven fish trap; mouth closed with a calm natural expression. The lower cloth is NOT a wrapped skirt, sarong or trousers: its two ends are pulled together between the legs and tucked in at the back, so it forms loose pleated breeches that end at the knee, with the lower legs bare. Avoid: sarong, longyi, wrapped skirt, shorts hanging loose, long trousers. (16:9 aspect ratio)
```

## ชุด B — style `reality_late` — แชตใหม่
```text
Please generate the following 2 historical illustrations, each in 16:9 aspect ratio. Generate one image per turn: start with Image 1 now, and after each image I will simply say "next" for the following one. Do not skip or merge images. Keep the same painterly style for all 2.

Every image MUST strictly follow this exact STYLE & HISTORICAL RULE BLOCK:
"Historical illustration of everyday life in Siam (Ayutthaya kingdom), early-to-mid 19th century (about 1830 to 1855). Muted earthy watercolor and ink on textured paper, soft natural daylight, restrained palette of ochre, indigo, rust and off-white. Grounded, documentary, ordinary weathered faces without makeup. Unless stated otherwise, Siamese men and women crop the hair short, only an inch or two long, standing up like a brush; men keep a round patch about four inches across on the crown where the hair is only slightly longer, and women a smaller such patch, all in the same upright brush-like texture and never tied up into a bun or knot, with no contrast between shaved sides and a longer top, so from behind a woman can be hard to tell from a man; faces are natural and unmade-up, with natural muted reddish-brown lips. Commoner men are bare-chested. Men's lower cloth is pulled between the legs and tucked in at the back, forming loose pleated breeches that end at the knee, lower legs bare. A woman wears a wrap skirt and a long scarf draped diagonally over one shoulder and passing under the opposite arm; a lower-class woman may instead wear a plain tight long-sleeved white cotton jacket. Commoner houses are small, of woven split-bamboo panels raised on tall bamboo piles, entered by a short bamboo ladder hanging from the doorway by ropes with its foot off the ground. Any children present are bare-chested and wear a small lower cloth; children under eleven have shaved heads with a small topknot of hair left on the crown. Avoid: modern clothing or objects, tourist-poster look, fantasy costume, glossy digital rendering, glamour or model-like faces, makeup, long loose hair, bob haircuts, a bun, topknot or long hair on adults, a high-fade, undercut or mohawk hairstyle, a pompadour, black lips, dark lipstick, black-painted mouth, open-mouth grin, modern Thai costume, shirts on commoner men, a sarong, longyi or wrapped skirt on men, long trousers, tiled roofs or ornate gable finials on commoner houses, ladders leaning on the ground, shorts or shirts on children."

Image 1 (`B1-woman-jacket-scarf`):
Medium shot: a Siamese woman in her thirties sitting on a reed mat inside a timber house with her legs folded to one side, wearing a black wrap skirt, a plain tight long-sleeved white cotton jacket, and a long white crape scarf draped diagonally over one shoulder and passing under the opposite arm; short brush-like dark hair an inch or two long standing up with a smaller round patch at the crown where it is slightly longer (no bun), mouth closed with a calm natural expression, small gold earrings; a betel box beside her. (16:9 aspect ratio)

Image 2 (`B3-commoner-man`):
Full-body view: a Siamese commoner man in his twenties, bare-chested and barefoot, hair an inch or two long standing up like a brush with a round palm-sized patch on the crown where the hair is only slightly longer, never tied into a knot or bun, mouth closed with a calm natural expression, wearing a knee-length patterned cloth drawn between the legs into loose pleats and tucked in at the back with a cloth sash at the waist, standing in front of a small bamboo stilt house whose doorway has a short bamboo ladder hanging from it by ropes with its foot off the ground, holding a woven fish trap. (16:9 aspect ratio)
```

## ผลรอบ 04d (style v0.6, ปิดปาก ไม่มีฟันดำ)

| ภาพ | ผ้า/ผม | ปาก | บันไดและเรือน | คะแนน |
|---|---|---|---|---|
| A2 ชายสามัญ (reality) | ✅ จีบพองถึงเข่า; ผมสั้นบนหัว โกนข้างแนวคม | ✅ ปิดปาก ริมฝีปากธรรมชาติ | ✅ บันไดแขวนปลายลอยใกล้พื้น | 5 |
| B1 หญิง late | ✅ เสื้อขาวแขนยาว+ผ้าพาดไหล่เดียว; ผมสั้นแปรง ไม่เกล้า | ✅ ปิดปาก สีน้ำตาลแดงจาง | – | 5 |
| B3 ชายสามัญ late | ✅ จีบพอง คาดผ้า; ผมแปรงสั้นตั้ง | ✅ ปิดปาก ริมฝีปากธรรมชาติ | ⚠️ ปลายบันไดแตะพื้น; เรือนไกลมีปั้นลมงอนเล็ก | 4 |

**สรุป:** ปากดำหายในทั้ง 3 ภาพ → ยืนยันว่าสาเหตุคือคำว่าฟันดำ ทั้งใน block และใน SUBJECT; ภาพไม่แสดงฟันดำ (ผลข้างเคียงที่ยอมรับ)
ที่เหลือ: ชุดทดสอบ README ข้อ 4.2 ครบ 10 โจทย์ (pendingRegression), ตัดสินใจแทนภาพ approved เดิม
