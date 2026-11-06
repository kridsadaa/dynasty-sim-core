# ชุดภาพที่พร้อมสร้าง รอบ 2 (style block v0.8) — จาก art/needed-images.md ข้อ 6 7 8 10

> **วิธีใช้:** ก๊อปกล่องโค้ดไปวางใน Gemini Chat แชตใหม่ (ชุด A กับชุด B แยกแชต เพราะคนละ style) แล้วพิมพ์แค่ **`next`** ทุกครั้งที่ได้ภาพ
> เซฟภาพที่คัดแล้วลง `art/generated/<id>.jpg` แล้วรัน `npm run art:ingest`
>
> ทุกภาพอยู่ใน `art/assets.spec.json` แล้ว (prompt ฉบับเต็มอยู่ใน `art/prompts.md` หลังรัน `npm run art:prompts`)
> **ไม่ต้องลบ tag ของภาพเดิม:** ชุด A ตัด `role:official_*` ออกจากภาพ `portrait.m.elder.official` ใน spec แล้ว (ภาพเดิมกลายเป็นภาพสำรองของขุนนางสูงวัยกรมอื่น) ชุด B ใช้ tag เฉพาะเรื่อง ได้คะแนนสูงกว่า `history.war`/`history.famine` อยู่แล้ว
>
> ตรวจก่อนรับภาพ (`art/style.json` › subjectRules): ไม่มีพระมหากษัตริย์ในฉาก · ปากปิด ไม่ทาปากดำ · เด็กต้องเห็นผ้านุ่งชัด · ชายสามัญไม่ใส่เสื้อ · ไม่มีเลือดสาด/ศพ
> ภาพ `history.war_naval`: lore ไม่มีรายละเอียดเรือรบ (ขนาด ปืน ธง) — ภาพเป็นจิตรกรรมแบบแผน ไม่อ้างว่าเป็นหลักฐานรูปเรือ ห้ามใส่ใน `loreRefs` ว่ายืนยันรายละเอียดเรือ
> ข้อ 6/7: เรื่องสมมติหลัง 2400 ไม่มี lore ภาพจึงอิงแค่ลักษณะจิตรกรรมไทยทั่วไป
>
> **ชุด A — ภาพตัวละคร (portrait) 3 ภาพ**
>
> | # | id | ภาพ | tag |
> |---|----|-----|-----|
| 1 | `portrait.m.elder.official_patrol` | ขุนนางกรมกระเวนสูงวัย ดาบวางบนที่วางข้างตัว | `role:official`, `role:official_patrol` |
| 2 | `portrait.m.elder.official_palace` | ขุนนางกรมชาวที่สูงวัย ข้างพานเครื่องทอง | `role:official`, `role:official_palace` |
| 3 | `portrait.m.elder.official_scholar` | ราชบัณฑิตสูงวัย ข้างสมุดไทยดำและเครื่องเขียน | `role:official`, `role:official_scholar` |
>
> **ชุด B — ภาพจิตรกรรม (chronicle) 6 ภาพ**
>
> | # | id | ภาพ | tag |
> |---|----|-----|-----|
| 1 | `history.war_naval` | ภาพจิตรกรรม: กองเรือรบพายออกจากท่า ธงทิวและปืนบนเรือ | `history:annam_war_2376`, `history:thalang_war` |
| 2 | `history.flood` | ภาพจิตรกรรม: น้ำท่วมใหญ่ ผู้คนอพยพขึ้นเรือและขึ้นที่สูง | `fiction:great_flood` |
| 3 | `history.fire` | ภาพจิตรกรรม: ไฟไหม้เรือนหนาแน่นริมน้ำ ผู้คนวิ่งหนีและตักน้ำ | `fiction:city_fire` |
| 4 | `history.drought` | ภาพจิตรกรรม: แล้งจัด ชาวบ้านตักน้ำก้นบ่อและทำพิธีขอฝน | `fiction:drought` |
| 5 | `history.good_harvest` | ภาพจิตรกรรม: ปีข้าวดี เก็บเกี่ยวรวงข้าวหนักเต็มท้องนา | `fiction:good_harvest`, `fiction:royal_grace`, `historykind:boon` |
| 6 | `history.trade_boom` | ภาพจิตรกรรม: ท่าน้ำคึกคัก เรือสินค้าเรียงเต็มและพ่อค้าซื้อขาย | `fiction:trade_boom` |

## ชุด A (3 ภาพ)

```text
Please generate the following 3 historical illustrations, each in 16:9 aspect ratio. Generate one image per turn: start with Image 1 now, and after each image I will simply say "next" for the following one. Do not skip or merge images. Keep the same painterly style for all 3.

Every image MUST strictly follow this exact STYLE & HISTORICAL RULE BLOCK:
"Historical illustration of everyday life in Siam (Ayutthaya kingdom), mid-18th century. Muted earthy watercolor and ink on textured paper, soft natural daylight, restrained palette of ochre, indigo, rust and off-white. Grounded, documentary, ordinary weathered faces without makeup. Unless stated otherwise, Men wear the traditional 'Mahatthai' hairstyle: short, slightly wavy hair is kept only on the top of the head (about 3-5 cm long) and combed to the side, while the sides and back of the head below the crown are shaved close to the skin with a sharp, straight, clean-edged perimeter line. Siamese women have short black hair on the top crown brushed straight up into a neat, flat-topped, brush-like crest about 4 to 5 cm high, the lower sides and back clipped very short, with very short thin sideburn wisps in front of the ears that end strictly at earlobe level. Faces are natural and unmade-up, with natural muted reddish-brown lips. Commoner men are bare-chested. Men's lower cloth is pulled between the legs and tucked in at the back, forming loose pleated breeches that end at the knee, lower legs bare. Commoner women are either bare-chested or wear only a tight horizontal breast-cloth wrapped around the chest, leaving both shoulders and both arms completely bare. Well-to-do women wear a horizontal breast-cloth wrapped snugly around the torso, optionally with a single-shoulder diagonal sash over the left shoulder only, leaving the right shoulder and both arms completely bare and uncovered. Commoner houses are small, of woven split-bamboo panels raised on tall bamboo piles, entered by a short bamboo ladder hanging from the doorway by ropes with its foot off the ground. Any children present are bare-chested and wear a small lower cloth; children under eleven have shaved heads with a small topknot of hair left on the crown. Avoid: black lips, dark lipstick, black-painted mouth, open-mouth grin, a shaved bald head, modern clothing or objects, tourist-poster look, fantasy costume, glossy digital rendering, glamour or model-like faces, makeup, buns or topknots on adult women, long loose hair, bob haircuts, a shawl covering both shoulders, fabric draping over the upper arms like sleeves, fitted blouses, sleeves of any kind, modern Thai costume, shirts on commoner men, a sarong, longyi or wrapped skirt on men, long trousers, tiled roofs or ornate gable finials on commoner houses, ladders leaning on the ground, shorts or shirts on children."

Image 1 (`portrait.m.elder.official_patrol`):
Medium portrait: an elderly senior Siamese patrol-department official in his sixties with a deeply lined face, warm olive-brown skin, broad cheekbones, calm dark eyes, straight nose, and a slightly square jaw, grey hair visible beneath a tall brimless white conical cloth hat (lomphok) with gold bands near the base and a chin cord; wearing an open-front collarless white muslin over-shirt with wide sleeves over a patterned silk lower cloth, seated on a reed mat inside a timber hall, a sheathed sword resting on a stand beside him and a rolled warrant cloth on a low tray. Avoid: hat brim, wide-brimmed hat. Hair: the Mahatthai cut under the hat, the sides and back shaved close, grey at the temples. Mouth closed, natural muted reddish-brown lips. (16:9 aspect ratio)

Image 2 (`portrait.m.elder.official_palace`):
Medium portrait: an elderly senior Siamese palace-chamber official in his sixties with a deeply lined face, warm olive-brown skin, broad cheekbones, calm dark eyes, straight nose, and a slightly square jaw, grey hair visible beneath a tall brimless white conical cloth hat (lomphok) with gold bands near the base and a chin cord; wearing an open-front collarless white muslin over-shirt with wide sleeves over a patterned silk lower cloth, seated cross-legged on a reed mat in a palace hall, a footed brass tray and betel box beside him. Avoid: hat brim, wide-brimmed hat. Hair: the Mahatthai cut under the hat, the sides and back shaved close, grey at the temples. Mouth closed, natural muted reddish-brown lips. (16:9 aspect ratio)

Image 3 (`portrait.m.elder.official_scholar`):
Medium portrait: an elderly senior Siamese royal-scholar official in his sixties with a deeply lined face, warm olive-brown skin, broad cheekbones, calm dark eyes, straight nose, and a slightly square jaw, grey hair visible beneath a tall brimless white conical cloth hat (lomphok) with gold bands near the base and a chin cord; wearing an open-front collarless white muslin over-shirt with wide sleeves over a patterned silk lower cloth, seated cross-legged on a reed mat, an accordion-folded black khoi-paper manuscript (samut thai dam) and a white steatite stylus on a low tray before him. Avoid: hat brim, wide-brimmed hat. Hair: the Mahatthai cut under the hat, the sides and back shaved close, grey at the temples. Mouth closed, natural muted reddish-brown lips. (16:9 aspect ratio)

```

## ชุด B (6 ภาพ)

```text
Please generate the following 6 mural-style paintings, each in 16:9 aspect ratio. Generate one image per turn: start with Image 1 now, and after each image I will simply say "next" for the following one. Do not skip or merge images. Keep the same painterly style for all 6.

Every image MUST strictly follow this exact STYLE & HISTORICAL RULE BLOCK:
"In the style of an 18th-century Thai temple mural painting: a single unified continuous scene filling the entire frame, flat colors without shading, deep red-brown background, fine dark hand-painted outlines of uneven weight, no Western perspective, stylized figures in profile and three-quarter view, decorative trees, rocks and water patterns naturally framing the composition. Aged mineral pigments, faded and slightly flaking plaster surface. Avoid: 3D shading, photorealism, crisp vector look, modern objects, tiled roofs or curved horn-shaped gable ornaments on commoner houses, zig-zag dividing lines, geometric frame borders, split panels, multiple framed vignettes."

Image 1 (`history.war_naval`):
A war fleet setting out by river: long narrow war boats packed with oarsmen in two rows, each with a prow platform where soldiers hold spears, swords and shields and a small cannon on a swivel stands, tall banners and umbrellas of rank on the larger boats, a drummer beating a drum on the lead boat, officials in tall white conical hats seated under a canopy, townspeople and monks watching from the bank with palms pressed together, stylized wave and fish patterns; no fighting shown, no gore. (16:9 aspect ratio)

Image 2 (`history.flood`):
A great flood: water covering the fields and rising to the floors of raised houses, families poling and paddling small boats loaded with rice jars, bundles and chickens, a buffalo swimming beside a boat, villagers and monks gathered on a raised temple platform, a woman handing a child up into a boat (child wearing a small lower cloth), stylized water swirls and fish, decorative trees half submerged; calm and dignified, no corpses. (16:9 aspect ratio)

Image 3 (`history.fire`):
A fire in a crowded riverside quarter: flames and curling smoke rising from rows of bamboo and timber houses on piles, people passing water in buckets and clay jars along a line to the river, others carrying chests and children to boats, a man pulling down a burning wall with a long hooked pole, officials directing from a landing, a temple spire untouched in the distance, stylized flame and smoke patterns; no one visibly burned, no gore. (16:9 aspect ratio)

Image 4 (`history.drought`):
A year of drought: cracked dry rice fields and a nearly empty canal, villagers carrying water jars on shoulder poles to a deep well, thin buffalo standing in dry mud, monks and elders seated in a ritual circle praying for rain with offerings of flowers and food on trays, a few farmers looking up at a cloudless sky, withered trees; sombre but dignified, no corpses. (16:9 aspect ratio)

Image 5 (`history.good_harvest`):
A bountiful harvest: golden heavy-headed rice stalks across the fields, villagers cutting and carrying sheaves, a buffalo cart piled with rice, a full rice barn on stilts, children playing at the edge of the field (bare-chested, wearing small lower cloths), a monk receiving alms rice, cheerful and orderly mood, decorative trees and birds; no king or royal figure. (16:9 aspect ratio)

Image 6 (`history.trade_boom`):
A busy river port in a good trading year: many cargo boats moored in rows with sacks, jars and bundles of cloth, porters carrying goods up the landing, merchants in plain lower cloths haggling with scales, Chinese junks with tall battened sails in the distance, a market under awnings with fruit and fish, officials in tall white conical hats inspecting cargo, stylized river waves; no gore. (16:9 aspect ratio)

```
