# ชุดภาพขบวนเรือหลวงเดือน 12 — 3 ภาพ (style v0.9 · reality)

> **ทำไมมีชุดนี้:** ขบวนเรือหลวงเดือน 12 เข้าเกมแล้ว (PLAN ข้อ 15, [docs/design-barge-procession.md](../docs/design-barge-procession.md)) แต่ event ฝีพายและขุนนางยังไม่มีภาพ ส่วน event ดูกระบวนยืมภาพวันพระไปก่อน
> หลังนำเข้าให้ลบ `barge.rowing` `barge.official` (และ `barge.levy` ถ้าจะให้ใช้ภาพฝีพาย — ต้องเติม tag `event:barge.levy` ใน `scene.barge_rowers`) ออกจาก `AWAITING_ART` ใน `src/art/select.test.ts`
>
> | # | id | event | สิ่งที่ต้องเห็น |
> |---|----|----|----|
> | 1 | `scene.barge_rowers` | `barge.rowing` | มุมกลางลำเรือดั้งยาว · ฝีพาย**นั่งขัดสมาธิเป็นคู่**เต็มความกว้างลำ · พายสั้นถือสองมือ ไม่ติดกราบ · คนหัวเรือนั่งคนเดียวยกพายสูง · นายท้ายยืน ถือพายยาว · เรือลำอื่นสองแถวข้างหน้า |
> | 2 | `scene.barge_official` | `barge.official` | ขุนนางผู้น้อยนั่งยกพื้นใต้**ร่มคันเดียว**กลางเรือของตัว · ฝีพายหยุดพาย ก้มหมอบ · เรือนิ่งชิดตลิ่ง · เรือปิดทองรูปสัตว์ผ่านไปไกล ๆ |
> | 3 | `scene.barge_watch` | `festival.barge_watch` | ชาวบ้าน หญิง เด็ก คนแก่ หมอบพนมมือริมตลิ่งและในเรือเล็ก · แม่กดหลังลูกให้หมอบ · เรือปิดทองหัวรูปสัตว์แล่นผ่านกลางน้ำ พายยกพร้อมกัน |
>
> **หลักฐาน:** ลา ลูแบร์ (`ritual.royal_balons_1680s`, `social.officer_rowers_from_band_1680s`) — นั่งขัดสมาธิเป็นคู่ คนหัวเรือตีจังหวะ ร่มคันเดียวสำหรับขุนนางสามัญ เรือหยุดและหมอบเมื่อเรือหลวงผ่าน · Finlayson 2365 (`ritual.barge_procession_bangkok_1822`) — เรือยาว 60–80 ฟุต หัวท้ายงอนสูง สลักปิดทองรูปสัตว์
> ชุดนี้ใช้ style สมัยปลายอยุธยา (ฝีพายเปลือยท่อนบน) — **ไม่ใส่เสื้อแดงหมวกแดง** เพราะหลักฐานเสื้อแดงเป็นของสมัย ร.2 (2365) ถ้าอยากได้ภาพสมัยหลังค่อยทำอีกชุด
>
> **วิธีใช้:** แชต Gemini ใหม่ 1 แชต ก๊อปกล่องโค้ดไปวาง พิมพ์ **`next`** ทีละภาพ · ผมหลุดพิมพ์ **`redo hair`** · เห็นคนในบุษบกพิมพ์ **"no person visible in the royal barge, make it far away and curtained"**
> วางภาพใน Downloads แล้วบอกให้คัด (Gemini เรียงภาพไม่แน่นอน ผมจะจับคู่จากเนื้อภาพ)
>
> **ตรวจก่อนรับ:**
> - **ไม่เห็นพระมหากษัตริย์หรือเจ้านาย** — เรือปิดทองอยู่ไกล บุษบกปิดม่านหรือว่าง (README ห้ามวาดเจ้านาย)
> - ฝีพาย**นั่ง**ขัดสมาธิ ไม่ยืนพาย ไม่ใช่ไม้พายติดกราบแบบเรือฝรั่ง ไม่มีใบเรือ
> - ผมชายเป็นวงสั้นบนหัว รอบหัวโกน ไม่ undercut · **ผมหญิงสั้นตั้งเป็นแปรง ห้ามเกล้ามวย** (หลุดบ่อยที่สุดในรอบก่อน) · เด็กหัวโกนไว้จุก
> - ปากปิดทุกคน · ไม่มีเสื้อแดง หมวก หรือเครื่องแบบ · ขุนนางใส่เสื้อมัสลินขาวผ่าหน้าได้ คนอื่นเปลือยท่อนบน (หญิงคาดอก)

```text
Please generate the following 3 illustrations, each in 16:9 aspect ratio. Generate one image per turn: start with Image 1 now, and after each image I will simply say "next" for the following one. Do not skip or merge images. All three show the same yearly royal barge procession on the river at the start of the twelfth lunar month (end of the rainy season, high brown water), seen from three different places; keep the same painterly style for all 3.

HAIR RULE FOR EVERY IMAGE — it overrides any hair wording in the style block below. MEN: the traditional old Siamese men's hairstyle (ทรงผมไทยโบราณ, the Mahatthai cut): a round patch of short black hair only 2 to 3 cm long on top of the head, never combed back; around it the head is shaved close with a soft natural edge. Not bald, not an undercut, not a sharp fade line, not slicked back. ADULT WOMEN: hair far too short to tie — a short flat-topped brush-like crest on the crown, sides and back clipped very short; absolutely no bun, no knot, no ponytail, no hair gathered at the back of the head. CHILDREN under eleven: shaved head with one small topknot on the crown. If I reply "redo hair", draw the same image again with this rule fixed.

ROYALTY RULE: never show the king or any royal person. Gilded royal barges may appear only far away in the distance, with their central canopies curtained or empty-looking; nobody in them is distinguishable.

Every image MUST strictly follow this exact STYLE & HISTORICAL RULE BLOCK:
"Historical illustration of everyday life in Siam (Ayutthaya kingdom), mid-18th century. Muted earthy watercolor and ink on textured paper, soft natural daylight, restrained palette of ochre, indigo, rust and off-white. Grounded, documentary, ordinary weathered faces without makeup. Unless stated otherwise, Men wear the traditional 'Mahatthai' hairstyle: short, slightly wavy hair is kept only on the top of the head (about 3-5 cm long) and combed to the side, while the sides and back of the head below the crown are shaved close to the skin with a sharp, straight, clean-edged perimeter line. Siamese women have short black hair on the top crown brushed straight up into a neat, flat-topped, brush-like crest about 4 to 5 cm high, the lower sides and back clipped very short, with very short thin sideburn wisps in front of the ears that end strictly at earlobe level. Faces are natural and unmade-up, with natural muted reddish-brown lips. Commoner men are bare-chested. Men's lower cloth is pulled between the legs and tucked in at the back, forming loose pleated breeches that end at the knee, lower legs bare. Commoner women are either bare-chested or wear only a tight horizontal breast-cloth wrapped around the chest, leaving both shoulders and both arms completely bare. Well-to-do women wear a horizontal breast-cloth wrapped snugly around the torso, optionally with a single-shoulder diagonal sash over the left shoulder only, leaving the right shoulder and both arms completely bare and uncovered. Commoner houses are small, of woven split-bamboo panels raised on tall bamboo piles, entered by a short bamboo ladder hanging from the doorway by ropes with its foot off the ground. Any children present are bare-chested and wear a small lower cloth; children under eleven have shaved heads with a small topknot of hair left on the crown. Avoid: black lips, dark lipstick, black-painted mouth, open-mouth grin, a shaved bald head, modern clothing or objects, tourist-poster look, fantasy costume, glossy digital rendering, glamour or model-like faces, makeup, buns or topknots on adult women, long loose hair, bob haircuts, a shawl covering both shoulders, fabric draping over the upper arms like sleeves, fitted blouses, sleeves of any kind, modern Thai costume, shirts on commoner men, a sarong, longyi or wrapped skirt on men, long trousers, tiled roofs or ornate gable finials on commoner houses, ladders leaning on the ground, shorts or shirts on children."

Image 1 (`scene.barge_rowers`):
Morning on a wide brown river in Siam: view from inside a very long narrow dugout escort barge, carved from a single tree, rowers seated cross-legged in pairs side by side filling the width of the hull, all dipping short hand-held paddles (not fixed to the gunwale) into the water at the same instant, a single rower alone at the high prow raising his paddle high to call the stroke, the steersman standing at the stern with a very long paddle. Other long barges in two lines ahead; crowds on the riverbank and in small boats bowing low. Effort, rhythm, spray. No king or royal figure visible anywhere; the canopy of any royal barge is far away and empty-looking or curtained; mouths closed. (16:9 aspect ratio)

Image 2 (`scene.barge_official`):
A minor Siamese official sits on a low raised platform in the middle of his own long wooden barge under a single umbrella, wearing an open-front white muslin over-shirt and a silk lower cloth; his rowers, men from his own retinue, have stopped paddling and bow low over their paddles, the official himself lowering his head; the boat holds still near the bank while, far off across the water, a line of gilded barges with carved animal prows passes. Calm, formal, respectful stillness. No king or royal figure visible anywhere; the canopy of any royal barge is far away and empty-looking or curtained; mouths closed. (16:9 aspect ratio)

Image 3 (`scene.barge_watch`):
Villagers of all ages, women, old people and children, crowd the riverbank and sit in small dugouts tied along the bank, bowing low with palms together, a child being gently pressed down to bow by its mother; in the middle of the wide river a procession of long gilded barges with high carved animal-shaped prows and rows of paddles rising together speeds past, spray at the bows. Festive but reverent mood, bright late-rainy-season day, high water. No king or royal figure visible anywhere; the canopy of any royal barge is far away and empty-looking or curtained; mouths closed. (16:9 aspect ratio)
```
