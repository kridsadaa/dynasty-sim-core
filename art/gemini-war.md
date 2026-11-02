# Prompt สำหรับ Gemini: ฉากศึกพม่า 2308–2310 (9 ภาพ)

> ภาพประกอบ event ชุด `war.*` (ดู `docs/design-war-2308.md` หัวข้อ 6) — ตอนนี้ event เหล่านี้ยังไม่มีภาพของตัวเอง
>
> **วิธีใช้:** วางทั้งก้อนใน Gemini (ถ้าทำได้ทีละภาพ ให้บอก "next") เซฟภาพไว้ใน `art/generated/` ชื่ออะไรก็ได้ แล้วบอก Claude ให้ตรวจ เปลี่ยนชื่อตาม id ในวงเล็บ เพิ่มลง `art/assets.spec.json` (ท้ายไฟล์) และรัน `npm run art:ingest`
>
> ลำดับความคุ้ม (ถ้าโควตาจำกัดให้ทำจากบนลงล่าง): 1 → 5 → 7 → 4 → 8 → 2 → 3 → 6 → 9
>
> ข้อควรระวังตาม `art/README.md` ข้อ 6: ไม่วาดพระมหากษัตริย์/เจ้านาย ไม่วาดบุคคลจริงให้ระบุตัวได้ (พระยาตากเป็นแค่ขบวนคนตัวเล็กไกลๆ) ความรุนแรงเป็นนัย ไม่มีภาพเลือดสาด ภาพเด็กต้องมีผ้านุ่งท่อนล่างเสมอ

- `scene.war_news` — `event:war.news_tenasserim` ข่าวศึกที่ท่าน้ำ/ตลาด
- `scene.war_refugees` — `event:war.west_falls` ผู้คนหนีจากหัวเมืองตะวันตกมาถึง
- `scene.war_levy` — `event:war.levy` เกณฑ์พล
- `scene.war_bury` — `event:war.prepare` ฝังเงินทองใต้เรือน
- `scene.war_leave` — `event:war.decide_leave` ครอบครัวลงเรือออกจากกรุง
- `scene.war_siege` — `event:war.siege_begins` ล้อมกรุง
- `scene.war_hunger` — `event:war.rice_gone` ข้าวหมดยุ้ง
- `scene.war_breakout` — `event:war.taksin_breakout` ฝ่าวงล้อมตอนกลางคืน
- `scene.war_captives` — `history:captive_after_fall` ขบวนผู้ถูกกวาดต้อน (ใช้กับตอนกรุงแตก/ผู้ถูกกวาดต้อน)

```text
Please generate the following 9 historical illustrations in 16:9 aspect ratio. If you can only generate one image per turn, generate #1 first and I will say "next" for each following image.

Every image MUST strictly follow this exact STYLE & HISTORICAL RULE BLOCK:
"Historical illustration of everyday life in Siam (Ayutthaya kingdom), mid-18th century. Muted earthy watercolor and ink on textured paper, soft natural daylight, restrained palette of ochre, indigo, rust and off-white. Grounded, documentary, ordinary weathered faces without makeup. Unless stated otherwise, Siamese adults of both sexes wear their black hair cropped level with the top of the ears, the hair below shaved close, lifted off the forehead, and their teeth are blackened from chewing betel. Commoner men are bare-chested. A well-to-do woman's breast-cloth is wrapped around the chest covering both breasts, its two ends thrown back over both shoulders. Commoner houses are small, of woven split-bamboo panels raised on tall bamboo piles, entered by a short bamboo ladder hanging from the doorway by ropes with its foot off the ground. Any children present are bare-chested and wear a small lower cloth; children under eleven have shaved heads with a small topknot of hair left on the crown. Avoid: modern clothing or objects, tourist-poster look, fantasy costume, glossy digital rendering, glamour or model-like faces, makeup, buns or topknots on adult women, long loose hair, bob haircuts, a breast-cloth worn as a one-shoulder diagonal sash, modern Thai costume, shirts on commoner men, tiled roofs or ornate gable finials on commoner houses, ladders leaning on the ground, shorts or shirts on children, gore, blood spray, kings or crowned figures, recognisable portraits of real people."

Composition for every image: a full-bleed painting filling the whole 16:9 frame edge to edge, no white paper margins; the main figures and their hands clearly visible in the upper two-thirds, since the image may be cropped near the top. Women's hair in every image: cropped very short like a man's, level with the top of the ears, the sides shaved close, nothing hanging down; breast-cloth wrapped horizontally around the chest with both ends thrown back over both shoulders.

Image 1 (`scene.war_news`):
A busy river landing and market at midday: a travelling boatman, still standing in his boat, speaking urgently to a small crowd of merchants, porters and women who have stopped their trading; baskets of fruit and fish forgotten on the ground, one old man with a hand over his mouth, a child holding a woman's lower cloth; covered boats and a canal lined with raised houses behind. The mood is uneasy murmuring, not panic. (16:9 aspect ratio)

Image 2 (`scene.war_refugees`):
Late afternoon at a canal landing on the edge of a city: a long low boat just touching the bank, crowded with exhausted families from the west carrying cloth bundles, cooking pots, a rolled mat and a caged chicken; a mother lifting a thin child ashore, an old man leaning on a staff, locals standing on the bank offering a water jar and a bowl of rice; dust-covered clothes, dull tired faces. (16:9 aspect ratio)

Image 3 (`scene.war_levy`):
Morning in the open yard of a pillared hall at a district office: a row of village men in plain lower cloths and head cloths standing in line, bare-chested, some with spears or long knives; a clerk seated on a mat writing names in a palm-leaf register with a stylus, an officer in a plain white lower cloth and a simple sash standing over him pointing along the line; wives and mothers watching quietly from beyond a bamboo fence. No crowns, no gold regalia. (16:9 aspect ratio)

Image 4 (`scene.war_bury`):
Night under a raised timber house: by the light of a single clay oil lamp held by a woman, a man digging in the packed earth between the house posts with a short hoe, a sealed clay jar with a wax-and-cloth cover beside the hole, sacks of rice stacked against a post; shadows large on the underside of the floorboards, a child asleep on a mat in the background. Quiet, secretive mood, small intimate scene. (16:9 aspect ratio)

Image 5 (`scene.war_leave`):
Grey dawn at the family landing below a raised house: a family loading a long covered boat — a man handing bundles and a rolled mat to a boatman, a woman with a baby on her hip, two children with shaved heads and small topknots in small lower cloths, a sack of rice and a few pots; behind them the house door left half-open and the bamboo ladder hanging; mist on the water, a neighbour watching from his veranda. (16:9 aspect ratio)

Image 6 (`scene.war_siege`):
A brick city wall of Ayutthaya seen from inside the city on an overcast day: men standing and kneeling along the top of the wall behind low battlements with spears, bows and a few old cannons; women and boys below carrying baskets of bricks and jars of water up a ramp; thin columns of smoke rising beyond the wall in the distance, a bare-chested officer shouting an order. The figures are small, the wall large. (16:9 aspect ratio)

Image 7 (`scene.war_hunger`):
Inside a house at evening: an empty woven rice bin standing open on the floor, a woman kneeling and scraping the last few grains from the bottom into a clay pot with her hand, a man sitting with his head lowered beside her, two thin children with shaved heads and topknots, in small lower cloths, waiting quietly; a single small fish on a footless tray. Dim warm light from the doorway, bare and quiet, no melodrama. (16:9 aspect ratio)

Image 8 (`scene.war_breakout`):
Night: a gap in a burning-edged city wall seen from a distance, a long column of small figures — mounted men and men on foot with spears, a few torches — streaming out through the opening into the dark countryside, fires glowing behind the wall and reflected on a river; the column is far away and the figures are tiny, no faces visible. Dark indigo sky, orange firelight, ink-wash feel. (16:9 aspect ratio)

Image 9 (`scene.war_captives`):
A long line of roped-together civilians — men, women and children, thin and dust-covered, carrying small bundles — being walked along a dusty dry-season road lined with sparse trees by a few armed guards in foreign dress at the edge of the frame; a mother carrying a child on her hip, an old man helped by a boy; the burning city a dark smudge of smoke on the horizon. Seen from a distance and from the side; sorrowful but restrained. (16:9 aspect ratio)
```

---

## หลังได้ภาพ — รายการที่ต้องเพิ่มใน `art/assets.spec.json`

ทุกภาพใช้ `"style": "reality"` ใส่ `tags` ตามนี้ (Claude ทำให้ตอน ingest):

| id | tags |
|---|---|
| `scene.war_news` | `event:war.news_tenasserim`, `place:market` |
| `scene.war_refugees` | `event:war.west_falls` |
| `scene.war_levy` | `event:war.levy` |
| `scene.war_bury` | `event:war.prepare` |
| `scene.war_leave` | `event:war.decide_leave` |
| `scene.war_siege` | `event:war.siege_begins` |
| `scene.war_hunger` | `event:war.rice_gone` |
| `scene.war_breakout` | `event:war.taksin_breakout` |
| `scene.war_captives` | `history:captive_after_fall` |

หมายเหตุ: ภาพเหล่านี้เป็นภาพ "แต่ง" (invented) ไม่ใช่การบันทึกหลักฐาน — ลง `loreRefs` เฉพาะที่มี lore จริง (`event.fall_of_ayutthaya_2310`) ส่วนภาพที่ Gemini วาดผมผู้หญิงเป็นทรงบ็อบ/ห่มผ้าเฉียงไหล่ ให้ยอมรับไว้หรือทำใหม่ตามบันทึกใน `art/gemini-chores.md`
