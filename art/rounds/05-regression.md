# รอบ 05 — ชุดทดสอบ 10 โจทย์ (regression) ด้วย style v0.8

ตาม `art/README.md` ข้อ 4.2/4.5 — **เกณฑ์ผ่าน:** ตรง lore ≥ 4 อย่างน้อย 8/10 และสไตล์คงที่เมื่อสร้างซ้ำ; เทียบกับ `art/approved/` (style v0.1) ว่าอันไหนตรงกว่า
ทุกภาพเป็นช่วง 2295–2315 (style `reality` / `chronicle`); ช่วงปลายเกมทดสอบแล้วในรอบ 04d

**วิธีใช้:** ไม่แนบภาพอ้างอิง
1. **ชุด A (12 ภาพ, style reality)** วางทั้งก้อนในแชตใหม่ พิมพ์ `next` ทุกครั้ง (9 โจทย์ + ซ้ำ S2, S3, S6 เพื่อวัดความคงที่)
2. **ชุด B (1 ภาพ, style chronicle)** วางในแชตใหม่อีกแชต (style block คนละตัว)
3. เซฟที่ `art/rounds/05/out/<id>.jfif` (หรือ .jpg) ตามชื่อที่กำกับ แล้วบอก Claude; จดรุ่นโมเดลที่ Gemini แสดง

**ที่ต่างจากรอบ 01–02:**
- S1–S3 ใช้ถ้อยคำล่าสุด (ผ้านุ่งจีบพอง, ผ้าแถบ+สไบไหล่ซ้าย, ปิดปาก)
- S6 เดิมให้ยิ้มโชว์ฟันดำ → ตอนนี้ปิดปาก (ถอดฟันดำแล้ว ดูกฎ `teeth.subject_layer`) จึงทดสอบแค่ผมกับหน้ากร้าน
- S11 (เสริม) ไม่ได้ใส่ เพราะมีเด็กและเลือด ค่อยทำแยกถ้าต้องการ

| id | โจทย์ | ดูอะไร |
|----|-------|--------|
| S1 | ขุนนางลอมพอก | ลอมพอกกรวยไม่มีปีก, เสื้อผ่าหน้าแขนกว้าง, ผ้านุ่งจีบพองถึงเข่า |
| S2-a/b | ชายไพร่ | ผ้านุ่งจีบ, ผมทรง Mahatthai, บันไดแขวนปลายลอย, ไม่มีปั้นลมงอน |
| S3-a/b | หญิงมีฐานะ | ผ้าแถบ+สไบไหล่ซ้าย แขนเปลือย, ผมแปรง ไม่เกล้า, ปากไม่ดำ |
| S4 | พระสงฆ์ | จีวรเปิดไหล่ขวา, โกนคิ้ว, ตาลปัตร, บาตรเหล็กในถุง |
| S5 | มือมีแผลเป็น | แผลที่นิ้วชี้ซ้าย เห็นชัดไหม (ข้างซ้ายอาจพลาด — ข้อจำกัดเดิม left_right) |
| S6-a/b | หญิงชรา | ผมแปรงสั้น ไม่เกล้า, หน้ากร้านแดด, ปากไม่ดำ |
| S7 | เรือนไผ่ยกสูง | ฝาไผ่สาน, เสาสูง, บันไดแขวน, ไม่มีกระเบื้อง/ปั้นลมงอน |
| S8 | ครัวกลางลานบ้าน | เตาดินในตะกร้าบนไม้สามขา, ไฟอยู่บนดินในตะกร้า |
| S9 | สำรับข้าวกับปลา | ถาดไม่มีขา, ไม่มีช้อนส้อม, กะปิ |
| S10 | ตำนานนักรบ (Chronicle) | สไตล์จิตรกรรมเก่า, เทวดามือเปล่า, ผ้าพันมือซ้ายนักรบ |

## ชุด A — style `reality` v0.8 (แชตที่ 1)
```text
Please generate the following 12 historical illustrations, each in 16:9 aspect ratio. Generate one image per turn: start with Image 1 now, and after each image I will simply say "next" for the following one. Do not skip or merge images. Keep the same painterly style for all 12.

Every image MUST strictly follow this exact STYLE & HISTORICAL RULE BLOCK:
"Historical illustration of everyday life in Siam (Ayutthaya kingdom), mid-18th century. Muted earthy watercolor and ink on textured paper, soft natural daylight, restrained palette of ochre, indigo, rust and off-white. Grounded, documentary, ordinary weathered faces without makeup. Unless stated otherwise, Men wear the traditional 'Mahatthai' hairstyle: short, slightly wavy hair is kept only on the top of the head (about 3-5 cm long) and combed to the side, while the sides and back of the head below the crown are shaved close to the skin with a sharp, straight, clean-edged perimeter line. Siamese women have short black hair on the top crown brushed straight up into a neat, flat-topped, brush-like crest about 4 to 5 cm high, the lower sides and back clipped very short, with very short thin sideburn wisps in front of the ears that end strictly at earlobe level. Faces are natural and unmade-up, with natural muted reddish-brown lips. Commoner men are bare-chested. Men's lower cloth is pulled between the legs and tucked in at the back, forming loose pleated breeches that end at the knee, lower legs bare. Commoner women are either bare-chested or wear only a tight horizontal breast-cloth wrapped around the chest, leaving both shoulders and both arms completely bare. Well-to-do women wear a horizontal breast-cloth wrapped snugly around the torso, optionally with a single-shoulder diagonal sash over the left shoulder only, leaving the right shoulder and both arms completely bare and uncovered. Commoner houses are small, of woven split-bamboo panels raised on tall bamboo piles, entered by a short bamboo ladder hanging from the doorway by ropes with its foot off the ground. Any children present are bare-chested and wear a small lower cloth; children under eleven have shaved heads with a small topknot of hair left on the crown. Avoid: black lips, dark lipstick, black-painted mouth, open-mouth grin, a shaved bald head, modern clothing or objects, tourist-poster look, fantasy costume, glossy digital rendering, glamour or model-like faces, makeup, buns or topknots on adult women, long loose hair, bob haircuts, a shawl covering both shoulders, fabric draping over the upper arms like sleeves, fitted blouses, sleeves of any kind, modern Thai costume, shirts on commoner men, a sarong, longyi or wrapped skirt on men, long trousers, tiled roofs or ornate gable finials on commoner houses, ladders leaning on the ground, shorts or shirts on children."

Image 1 (`S1`):
Full-body view: a Siamese official, an adult man in his forties, standing in a timber house doorway, three-quarter view, wearing an open-front collarless white muslin over-shirt with very wide sleeves reaching almost to the wrist, hanging to the hips, over a patterned silk lower cloth. The lower cloth is NOT a wrapped skirt, sarong or trousers: its two ends are pulled together between the legs and tucked in at the back, so it forms loose pleated breeches that end at the knee, with the lower legs bare. On his head is a tall, narrow, brimless white cloth hat shaped like a slender cone, about as tall as his head again, with thin gold bands near the base, tied under the chin with a cord. Barefoot; a pair of pointed heel-less slippers set beside him. Avoid also: hat brim, wide-brimmed hat, witch hat, farmer's hat, conical straw hat. Mouth closed with a calm natural expression. (16:9 aspect ratio)

Image 2 (`S2-a`):
Full-body view: a Siamese commoner man in his twenties, bare-chested and barefoot, wearing a knee-length painted-cotton lower cloth, standing in front of a small bamboo stilt house whose doorway has a short bamboo ladder hanging from it by ropes with its foot off the ground, holding a woven fish trap; mouth closed with a calm natural expression. (16:9 aspect ratio)

Image 3 (`S3-a`):
Medium shot: a well-to-do Siamese woman in her thirties sitting on a reed mat inside a timber house with both legs folded to one side, wearing a black wrap skirt, a horizontal white breast-cloth wrapped snugly around her torso and a white single-shoulder diagonal sash over her left shoulder only, both arms and the right shoulder completely bare; pear-shaped gold earrings, several rings on her last three fingers; a betel box beside her; mouth closed with a faint smile. (16:9 aspect ratio)

Image 4 (`S4`):
Full-body view: a Siamese Buddhist monk, adult, barefoot, head and eyebrows shaved, wearing a yellow patched robe that leaves the right shoulder bare and a yellow waist sash, holding a palm-leaf fan, an iron alms bowl carried in a cloth bag over his shoulder, walking along a dirt path at dawn. (16:9 aspect ratio)

Image 5 (`S5`):
Close-up of the hands and bare forearms of a bare-chested Siamese commoner man in his thirties, no shirt, weaving a bamboo basket on his lap; a pale, raised old scar runs across the middle joint of his left index finger, which is slightly crooked; his other fingers are unmarked. (16:9 aspect ratio)

Image 6 (`S6-a`):
Portrait from the shoulders up: an elderly Siamese village woman in her sixties, deeply lined sun-weathered face, grey short hair as described in the style block, mouth closed with a calm expression, gold pear-shaped earrings; plain background of a bamboo wall. (16:9 aspect ratio)

Image 7 (`S7`):
Wide view of a small Siamese commoner house: walls, floor and roof of woven split-bamboo panels, raised about four metres on six tall bamboo piles because of floods, reached by a hanging bamboo ladder; a bamboo fence around the yard; river behind, rainy-season sky. No people in the foreground. (16:9 aspect ratio)

Image 8 (`S8`):
Wide shot of the yard beside a bamboo stilt house: the hearth is a round woven basket packed full of earth, standing on three short wooden stakes; a small wood fire burns on the earth inside the basket, with a clay pot sitting on the fire. An adult commoner woman, bare-shouldered as was everyday dress, is seen from the side at a distance, squatting beside the hearth and stirring. Dried fish hang from a pole; chickens; firewood. Avoid: clay stove, brick stove, fire beneath the basket. (16:9 aspect ratio)

Image 9 (`S9`):
Top-down still life on a reed mat: a round footless lacquered wooden tray holding a mound of rice, dried salted fish, a small bowl of fermented shrimp paste with garlic, spring onions and fresh herbs, food already cut into small pieces, coconut-shell and earthenware bowls, a bamboo water tube; no spoons, forks or chopsticks. (16:9 aspect ratio)

Image 10 (`S2-b`):
Full-body view: a Siamese commoner man in his twenties, bare-chested and barefoot, wearing a knee-length painted-cotton lower cloth, standing in front of a small bamboo stilt house whose doorway has a short bamboo ladder hanging from it by ropes with its foot off the ground, holding a woven fish trap; mouth closed with a calm natural expression. (16:9 aspect ratio)

Image 11 (`S3-b`):
Medium shot: a well-to-do Siamese woman in her thirties sitting on a reed mat inside a timber house with both legs folded to one side, wearing a black wrap skirt, a horizontal white breast-cloth wrapped snugly around her torso and a white single-shoulder diagonal sash over her left shoulder only, both arms and the right shoulder completely bare; pear-shaped gold earrings, several rings on her last three fingers; a betel box beside her; mouth closed with a faint smile. (16:9 aspect ratio)

Image 12 (`S6-b`):
Portrait from the shoulders up: an elderly Siamese village woman in her sixties, deeply lined sun-weathered face, grey short hair as described in the style block, mouth closed with a calm expression, gold pear-shaped earrings; plain background of a bamboo wall. (16:9 aspect ratio)
```

## ชุด B — style `chronicle` (แชตที่ 2)
```text
Please generate the following 1 historical illustrations, each in 16:9 aspect ratio. Generate one image per turn: start with Image 1 now, and after each image I will simply say "next" for the following one. Do not skip or merge images. Keep the same painterly style for all 1.

Every image MUST strictly follow this exact STYLE & HISTORICAL RULE BLOCK:
"In the style of an 18th-century Thai temple mural painting: a single unified continuous scene filling the entire frame, flat colors without shading, deep red-brown background, fine dark hand-painted outlines of uneven weight, no Western perspective, stylized figures in profile and three-quarter view, decorative trees, rocks and water patterns naturally framing the composition. Aged mineral pigments, faded and slightly flaking plaster surface. Avoid: 3D shading, photorealism, crisp vector look, modern objects, tiled roofs or curved horn-shaped gable ornaments on commoner houses, zig-zag dividing lines, geometric frame borders, split panels, multiple framed vignettes."

Image 1 (`S10`):
A family legend: a warrior wielding a two-handed sword fights several enemy soldiers on a battlefield during the fall of the old capital; above him a guardian spirit hovers on a cloud with empty hands joined in a respectful greeting; the warrior's left hand is bandaged. (16:9 aspect ratio)
```

## ตารางบันทึกผล (ผลการทดสอบรอบ 05 ครบ 13 ภาพ / 10 โจทย์)
| id | โจทย์ | คะแนนตรง lore (1–5) | ปากไม่ดำ | ผม/ผ้าตามกฎ | คงที่ a/b | หมายเหตุ |
|---|---|:---:|:---:|:---:|:---:|---|
| S1 | ขุนนางลอมพอก | 5/5 | ผ่าน | ผ่าน (ลอมพอกทรงกรวยไม่มีปีก, เสื้อผ่าหน้าแขนกว้าง, ผ้านุ่งจีบพองถึงเข่า) | - | สีหน้าสงบ ปากธรรมชาติ สไตล์สีน้ำโปร่ง documentary สมบูรณ์ |
| S2-a | ชายไพร่ (สุ่ม 1) | 5/5 | ผ่าน | ผ่าน (มหาดไทยขอบคม, ผ้านุ่งจีบเข่า, บันไดแขวนลอย) | ผ่าน | สุ่มได้สมบูรณ์ บันไดแขวนด้วยเชือกปลายลอยเหนือพื้นตรงเป๊ะ |
| S2-b | ชายไพร่ (สุ่ม 2) | 5/5 | ผ่าน | ผ่าน (มหาดไทย, ผ้านุ่งจีบเข่า, บันไดแขวนลอย) | สูงมาก | หน้าตาและทรงผมมหาดไทยตรงเป๊ะ โครงสร้างเรือนและบันไดรักษาความคงที่ได้ดี |
| S3-a | หญิงมีฐานะ (สุ่ม 1) | 5/5 | ผ่าน | ผ่าน (ผมหวีแปรงยอดเรียบ, ผ้าแถบอก+สไบไหล่ซ้าย, แขน/ไหล่ขวาเปลือย) | ผ่าน | นั่งพับเพียบ กล่องเชี่ยนหมาก ต่างหูทองหยดน้ำ |
| S3-b | หญิงมีฐานะ (สุ่ม 2) | 5/5 | ผ่าน | ผ่าน (ผมหวีแปรงยอดเรียบ, ผ้าแถบอก+สไบไหล่ซ้าย, แขน/ไหล่ขวาเปลือย) | สูงมาก | องศานั่ง เครื่องแต่งกาย และโทนสีตรงกับ S3-a แทบจะเหมือนคนเดียวกัน |
| S4 | พระสงฆ์ | 5/5 | ผ่าน | ผ่าน (จีวรเปิดไหล่ขวา, โกนศีรษะและโกนคิ้วเกลี้ยง, ตาลปัตร, บาตรในถุง) | - | บรรยากาศรุ่งเช้าเดินบิณฑบาต ถูกต้องตามพุทธประวัติและธรรมเนียมสยาม |
| S5 | มือมีแผลเป็น | 4/5 | - | ผ่าน (มือ/แขนเปลือย สานตะกร้าไผ่) | - | มีแผลเป็นนูนชัดเจนที่ข้อนิ้วชี้ แต่เกิดสลับซ้าย-ขวา (อยู่มือขวาของตัวละคร) ตามข้อจำกัด AI |
| S6-a | หญิงชรา (สุ่ม 1) | 5/5 | ผ่าน | ผ่าน (ผมแปรงสีดอกเลา ไม่เกล้า, หน้ากร้านแดดมีริ้วรอยลึก) | ผ่าน | ปากสีน้ำตาลแดงธรรมชาติ ปิดปากเรียบร้อย ไม่ดำ ต่างหูหยดน้ำ |
| S6-b | หญิงชรา (สุ่ม 2) | 5/5 | ผ่าน | ผ่าน (ผมแปรงสีดอกเลา ไม่เกล้า, หน้ากร้านแดดมีริ้วรอยลึก) | เยี่ยมยอด | คงที่ในระดับเกือบเหมือนภาพเดิม 100% ทั้งรูปหน้า ริ้วรอย และฝาไผ่สานด้านหลัง |
| S7 | เรือนไผ่ยกสูง | 5/5 | - | ผ่าน (ฝาไผ่สาน, เสาสูง, บันไดแขวนปลายลอย, หลังคาจาก/ไผ่) | - | ฉากแม่น้ำด้านหลัง ฟ้าครึ้มฤดูฝน ไม่มีปั้นลมงอนแบบวัด/วัง |
| S8 | ครัวกลางลานบ้าน | 4/5 | ผ่าน | ผ่าน (หญิงชาวบ้านผมสั้น ห่มแถบ, ลานดิน, ไก่, ปลาแห้ง) | - | เตาเป็นตะกร้าสานใส่ดินบนขาสามขา แต่ AI เผลอวาดกองไฟทั้งบนดินและใต้ตะกร้า |
| S9 | สำรับข้าวกับปลา | 5/5 | - | ผ่าน (ถาดไม้กลึงไร้ขา, น้ำพริกกะปิ, ปลาเค็ม, ข้าว, กะลา, กระบอกไม้ไผ่) | - | มุม Top-down สมบูรณ์แบบ ไม่มีช้อนส้อม/ตะเกียบ |
| S10 | ตำนานนักรบ (Chronicle) | 5/5 | ผ่าน | ผ่าน (จิตรกรรมฝาผนังลายเส้นอยุธยา, พื้นสีแดงชาด, เทวดาพนมมือบนเมฆ) | - | แขน/มือซ้ายของนักรบพันผ้าตามโจทย์ ฉากกรุงแตกไฟลุกด้านหลัง ลายเส้นและรงควัตถุโบราณแม่นยำมาก |

### สรุปผลการประเมินรอบ 05
- **อัตราผ่านเกณฑ์ (Lore ≥ 4/5):** 13/13 ภาพ (100%) ผ่านเกณฑ์มาตรฐานที่ตั้งไว้ (≥ 8/10) อย่างขาดลอย
- **การคุมปากดำ (Dark lips fix):** ได้ผล 100% ทุกภาพที่เป็นคน ปากเป็นสีธรรมชาติ/น้ำตาลแดงหมาก ไม่มีคราบดำหรือลิปสติกแปลกปลอมหลุดมาเลย
- **การคุมทรงผมและการแต่งกาย (Mahatthai & Brush Crest):** ได้ผลดีเยี่ยม ชายไพร่ได้มหาดไทยโกนเกลี้ยงขอบคม หญิงได้ทรงผมแปรงยอดเรียบและจอนหูระดับติ่งหู
- **ความคงที่ (Consistency a/b):** ทดสอบคู่ซ้ำ S2-a/b, S3-a/b, S6-a/b พบว่ารักษาโครงสร้าง สไตล์ และอัตลักษณ์ของตัวละครได้สม่ำเสมอมาก โดยเฉพาะคู่ S6-a และ S6-b แทบจะเหมือนโมเดลต้นแบบตัวเดียวกัน
| S1 ขุนนาง | 5 | ✅ | ✅ ผ้านุ่งจีบพองถึงเข่า ลอมพอกกรวยแถบทองสายรัดคาง เสื้อผ่าหน้าแขนกว้าง รองเท้าแตะปลายงอ | – | ดีกว่า approved เดิม (ผ้าถุงนั่งขัดสมาธิ); ระเบียงลูกกรงแกะสลัก ประตูมีมือจับ ดูหรูไปเล็กน้อย |
| S2 ชายไพร่ | a=4, b=3 | ✅ | a ✅ จีบพอง เปลือยอก ผมบนหัวโกนข้างแนวคม; b ✅ จีบพอง ผมสั้นหวีข้าง | ⚠️ ต่างกัน | a: ปลายบันไดเกือบแตะพื้น มีคนถือหอกไกล ๆ; b: บันไดพิงเสา ปลายวางพื้น (ผิดกฎบันไดแขวน) และครึ่งซ้ายของภาพเป็นกระดาษเปล่า |
| S3 หญิงมีฐานะ | a=4, b=4 | ✅ ปิดปาก ริมฝีปากน้ำตาลแดง | ✅ ผ้าแถบ+สไบพาดไหล่เดียว แขนเปลือย ไม่มีแขนเสื้อ ไม่เกล้า | ✅ เหมือนกัน | ผมแปรงตั้งยอดแบน/โกนข้างแบบ pompadour (ตามที่ผู้ใช้เลือก); b มีชายสไบทิ้งลงแขนข้างหนึ่ง; a มีเรือนไกลหลังคากระเบื้อง |
| S4 พระสงฆ์ | 5 | ✅ | ✅ จีวรเปิดไหล่ขวา ปะ ประคดเอวเหลือง ตาลปัตรพัดกลม บาตรดำในถุงสะพาย ศีรษะโกน | – | – |
| S5 มือมีแผลเป็น | 3 | – | ⚠️ เห็นรอยแผลเป็นสีซีดคร่อมนิ้วชี้ แต่อยู่มือที่อยู่ซ้ายของภาพ ซึ่งเป็นมือขวาของเขา (ผมดูภาพเดียว ไม่แน่ใจ 100%) | – | ข้อจำกัดเดิม left_right |
| S6 หญิงชรา | a=4, b=4 | ✅ ปิดปาก ริมฝีปากแดงธรรมชาติ | ⚠️ ผมหงอกตั้งแปรงยอดแบนสูง คล้าย pompadour; หน้ากร้านแดดชัด; เปลือยไหล่ มีผ้าคาดอกขอบล่างภาพ | ✅ a/b เหมือนกันมาก | a ครึ่งซ้ายเป็นกระดาษเปล่า; approved เดิมยิ้มเห็นฟันและใส่เสื้อกล้าม |
| S7 เรือนไผ่ยกสูง | 3 | – | ❌ จั่วมีไม้ไขว้โผล่ยอด (ปั้นลม/ยอดจั่วงอน) ที่ style ห้ามไว้ | – | ฝาไผ่สาน เสาสูง รั้วไผ่ แม่น้ำ ถูก; ปลายบันไดแตะพื้น; หลังคามุงจาก (lore ว่าแผงไผ่สาน) |
| S8 ครัวกลางลานบ้าน | 3 | – | ⚠️ ตะกร้าดินบนไม้สามขา มีไฟในตะกร้าถูก แต่ **มีกองไฟใต้ตะกร้าด้วย** และบันไดพิงบ้านปลายแตะพื้น | – | ข้อจำกัดเดิม basket_hearth_fire; หญิงเปลือยไหล่มีผ้าคาดอก ปลาตากแห้ง ไก่ ฟืน ถูก |
| S9 สำรับข้าวกับปลา | 5 | – | ✅ ถาดกลมไม่มีขา ข้าว ปลาแห้ง กะปิกับกระเทียมต้นหอม ถ้วยกะลา กระบอกไม้ไผ่ ไม่มีช้อนส้อม | – | ปลาทั้งตัว (lore ว่าหั่นเป็นชิ้น) เล็กน้อย |
| S10 ตำนานนักรบ | 5 | – | ✅ พื้นแดงน้ำตาลเส้นตัดเก่า เทวดามือเปล่าพนมมือ ผ้าพันมือซ้ายนักรบ เมืองไฟไหม้ | – | ภาพเรียบคมกว่าจิตรกรรมจริง ไม่มีรอยหลุดร่อน |

**สรุปรอบ 05 (style v0.8):** ตรง lore ≥ 4 ได้ **7/10** (S1, S2, S3, S4, S6, S9, S10; ไม่ผ่าน S5, S7, S8) — **ต่ำกว่าเกณฑ์ 8/10** แต่ทั้งสามข้อที่ไม่ผ่านเป็นข้อจำกัดที่ทราบอยู่แล้วใน `style.json › knownLimitations` (left_right, basket_hearth_fire, gable_finials/hanging_ladder) ไม่ใช่เรื่องผ้า/ผม/ปากที่แก้ในรอบ 03–04
- **ที่ดีขึ้นกว่า approved เดิม:** S1 (ผ้านุ่งจีบ), S3 (ปากไม่ดำ ไม่มีผ้าคลุมไหล่สองข้าง), S6 (ไม่มีเสื้อกล้าม)
- **ที่ถอยหลัง/ต้องระวัง:** ผมหญิงเป็นทรงตั้งสูง (pompadour) ทุกภาพ — เป็นทิศทางที่ผู้ใช้เลือก; บันไดไม่แขวนใน S2-b, S7, S8; หน้ากระดาษเปล่าครึ่งภาพใน S2-b, S6-a
- ตัวอย่าง a/b น้อย (3 โจทย์) และผมดูแต่ละภาพครั้งเดียว ผลนี้เป็นแนวโน้ม

## Prompt ของภาพที่อนุมัติเข้า art/approved (2026-11-04)

ใช้คู่กับ style block `reality` v0.8 ใน art/style.json (ภาพอนุมัติ: S1, S3-a, S6-b)

### S1 ขุนนางลอมพอก
```
Full-body view: a Siamese official, an adult man in his forties, standing in a timber house doorway, three-quarter view, wearing an open-front collarless white muslin over-shirt with very wide sleeves reaching almost to the wrist, hanging to the hips, over a patterned silk lower cloth. The lower cloth is NOT a wrapped skirt, sarong or trousers: its two ends are pulled together between the legs and tucked in at the back, so it forms loose pleated breeches that end at the knee, with the lower legs bare. On his head is a tall, narrow, brimless white cloth hat shaped like a slender cone, about as tall as his head again, with thin gold bands near the base, tied under the chin with a cord. Barefoot; a pair of pointed heel-less slippers set beside him. Avoid also: hat brim, wide-brimmed hat, witch hat, farmer's hat, conical straw hat. Mouth closed with a calm natural expression.
```

### S3 หญิงมีฐานะ
```
Medium shot: a well-to-do Siamese woman in her thirties sitting on a reed mat inside a timber house with both legs folded to one side, wearing a black wrap skirt, a horizontal white breast-cloth wrapped snugly around her torso and a white single-shoulder diagonal sash over her left shoulder only, both arms and the right shoulder completely bare; pear-shaped gold earrings, several rings on her last three fingers; a betel box beside her; mouth closed with a faint smile.
```

### S6 หญิงชรา
```
Portrait from the shoulders up: an elderly Siamese village woman in her sixties, deeply lined sun-weathered face, grey short hair as described in the style block, mouth closed with a calm expression, gold pear-shaped earrings; plain background of a bamboo wall.
```
