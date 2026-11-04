# ชุดภาพช่วงปลายเกมชุดแรก — 2 ภาพของ event ที่ยังไม่มีภาพ (style v0.8 · reality_late)

> **วิธีใช้:** ก๊อปกล่องโค้ดด้านล่างทั้งก้อนไปวางใน Gemini Chat แชตใหม่ แล้วพิมพ์ **`next`** เมื่อได้ภาพแรก
> **สร้างภาพละ 2 ครั้งแล้วคัด** (สไตล์ reality_late ยังไม่เคยใช้กับภาพผลิตจริง) — เซฟภาพที่เลือกลง `art/generated/<id>.jpg`
>
> | # | id | ใช้กับ event |
> |---|----|--------|
> | 1 | `scene.plague_news` | `plague.news` — ข่าวไข้ป่วงใหญ่มาถึง |
> | 2 | `scene.inoculation` | `health.inoculation` — หมอหลวงปลูกฝี |
>
> **เช็กก่อนรับภาพ:**
> - ผมผู้ใหญ่สั้นตั้งแบบแปรงทั้งชายหญิง ไม่มีมวย ไม่มีผมยาว ไม่ใช่ทรงอันเดอร์คัต · ปากไม่ดำ
> - ผู้หญิงมีผ้าพาดไหล่เดียว หรือเสื้อขาวแขนยาว · ชายสามัญไม่ใส่เสื้อ ผ้านุ่งจีบถึงเข่า ไม่ใช่ผ้าถุง
> - เด็กเล็กหัวโกนไว้จุก **ต้องเห็นผ้านุ่งท่อนล่างชัด** (art/README.md ข้อ 6)
> - ภาพ 1: ไม่มีคนป่วยหรือศพ · ภาพ 2: ไม่เห็นมีด แผล หรือวิธีปลูกฝี
>
> หลังเซฟภาพแล้ว: `npm run art:ingest` และลบ 2 event นี้ออกจาก `AWAITING_ART` ใน `src/art/select.test.ts`
> ข้อควรรู้: style block ของ reality_late ยังเขียนว่า "Siam (Ayutthaya kingdom)" ซึ่งไม่ตรงกับช่วงเวลา จึงเติม "Set in early Bangkok … not Ayutthaya" ไว้ในโจทย์แต่ละภาพ

```text
Please generate the following 2 historical illustrations, each in 16:9 aspect ratio. Generate one image per turn: start with Image 1 now, and after each image I will simply say "next" for the following one. Do not skip or merge images. Keep the same painterly style for both.

Every image MUST strictly follow this exact STYLE & HISTORICAL RULE BLOCK:
"Historical illustration of everyday life in Siam (Ayutthaya kingdom), early-to-mid 19th century (about 1830 to 1855). Muted earthy watercolor and ink on textured paper, soft natural daylight, restrained palette of ochre, indigo, rust and off-white. Grounded, documentary, ordinary weathered faces without makeup. Unless stated otherwise, Siamese men and women crop the hair short, only an inch or two long, standing up like a brush; men keep a round patch about four inches across on the crown where the hair is only slightly longer, and women a smaller such patch, all in the same upright brush-like texture and never tied up into a bun or knot, with no contrast between shaved sides and a longer top, so from behind a woman can be hard to tell from a man; faces are natural and unmade-up, with natural muted reddish-brown lips. Commoner men are bare-chested. Men's lower cloth is pulled between the legs and tucked in at the back, forming loose pleated breeches that end at the knee, lower legs bare. A woman wears a wrap skirt and a long scarf draped diagonally over one shoulder and passing under the opposite arm; a lower-class woman may instead wear a plain tight long-sleeved white cotton jacket. Commoner houses are small, of woven split-bamboo panels raised on tall bamboo piles, entered by a short bamboo ladder hanging from the doorway by ropes with its foot off the ground. Any children present are bare-chested and wear a small lower cloth; children under eleven have shaved heads with a small topknot of hair left on the crown. Avoid: modern clothing or objects, tourist-poster look, fantasy costume, glossy digital rendering, glamour or model-like faces, makeup, long loose hair, bob haircuts, a bun, topknot or long hair on adults, a high-fade, undercut or mohawk hairstyle, a pompadour, black lips, dark lipstick, black-painted mouth, open-mouth grin, modern Thai costume, shirts on commoner men, a sarong, longyi or wrapped skirt on men, long trousers, tiled roofs or ornate gable finials on commoner houses, ladders leaning on the ground, shorts or shirts on children."

Image 1 (`scene.plague_news`):
Set in early Bangkok (about 1820 to 1850), not Ayutthaya. A wooden landing on a Bangkok canal at morning: a trader standing in his long boat moored at the steps, telling news and pointing back downriver; a small crowd of townspeople on the landing listening with worried faces, a woman pulling a child close, two men whispering to each other; behind them a few market stalls on the bank half empty, baskets covered; further along the canal one family loading rolled mats, pots and bundles into a small boat as if to leave. Overcast hot-season light, uneasy quiet mood. No sick or dead people shown, no bodies. (16:9 aspect ratio)

Image 2 (`scene.inoculation`):
Set in early Bangkok times (about 1840), not Ayutthaya. An open-sided wooden sala with a thatched roof at the edge of a village, dry-season daylight: an older man of some standing, the royal physician, seated cross-legged on a mat at the far end with a closed cloth bundle beside him, speaking calmly to a father; in the foreground several mothers and fathers sitting on the floor waiting their turn with small children on their laps, one child clinging to his mother's neck in fear, another looking curiously toward the physician; villagers watching from outside. The procedure itself is not shown: no blades, no wounds, no needles. (16:9 aspect ratio)
```
