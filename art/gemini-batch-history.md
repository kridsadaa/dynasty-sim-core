# ชุดเดียวส่งครั้งเดียว — ภาพรอบที่ 2 (7 ภาพ)

> **วิธีใช้:** ก๊อปกล่องโค้ดทีละกล่อง (2 กล่อง = 2 แชต เพราะสไตล์ต่างกัน) ไปวางใน Gemini Chat แชตใหม่ครั้งเดียว แล้วพิมพ์แค่ **`next`** ทุกครั้งที่ได้ภาพ
> เซฟภาพลง `art/generated/<id>.jpg` ตามชื่อที่กำกับ แล้วรัน `npm run art:ingest`
>
> | กล่อง | # | id | ใช้กับ |
> |---|---|----|--------|
> | A | 1 | `scene.court_boat` | `intent.court.boat` (ใหม่) |
> | A | 2 | `scene.chore_craft` | สร้างซ้ำ — ภาพเดิมหญิงชราเปลือยอกด้านหน้า |
> | A | 3 | `scene.wife_jealousy` | สร้างซ้ำ — ภาพเดิมผ้าห่มพันเฉียง |
> | B | 1 | `history.fall_of_ayutthaya` | เหตุการณ์เสียกรุง 2310 |
> | B | 2 | `history.famine` | ข้าวยาก 2311–2312 |
> | B | 3 | `history.plague` | อหิวาต์ 2363 / 2365 / 2392 |
> | B | 4 | `history.war` | ศึกสงครามทุกครั้งหลังเสียกรุง |
>
> กล่อง A เป็นสไตล์ reality (v0.3) กล่อง B เป็นสไตล์ chronicle ภาพจิตรกรรมฝาผนัง
> ภาพ A2–A3 ควรสร้าง 2 ครั้งแล้วคัดอันที่ถูก lore (ผ้าพาดสองไหล่) แล้ววางทับไฟล์เดิม

## กล่อง A — ฉากชีวิต (reality)

```text
Please generate the following 3 historical illustrations, each in 16:9 aspect ratio. Generate one image per turn: start with Image 1 now, and after each image I will simply say "next" for the following one. Do not skip or merge images.

Every image MUST strictly follow this exact STYLE & HISTORICAL RULE BLOCK:
"Historical illustration of everyday life in Siam (Ayutthaya kingdom), mid-18th century. Muted earthy watercolor and ink on textured paper, soft natural daylight, restrained palette of ochre, indigo, rust and off-white. Grounded, documentary, ordinary weathered faces without makeup. Unless stated otherwise, Siamese adults of both sexes wear their black hair cropped level with the top of the ears, the hair below shaved close, lifted off the forehead, and their teeth are blackened from chewing betel. Commoner men are bare-chested. A well-to-do woman's breast-cloth is wrapped around the chest covering both breasts, its two ends thrown back over both shoulders. Commoner houses are small, of woven split-bamboo panels raised on tall bamboo piles, entered by a short bamboo ladder hanging from the doorway by ropes with its foot off the ground. Any children present are bare-chested and wear a small lower cloth; children under eleven have shaved heads with a small topknot of hair left on the crown. Avoid: modern clothing or objects, tourist-poster look, fantasy costume, glossy digital rendering, glamour or model-like faces, makeup, buns or topknots on adult women, long loose hair, bob haircuts, a breast-cloth worn as a one-shoulder diagonal sash, modern Thai costume, shirts on commoner men, tiled roofs or ornate gable finials on commoner houses, ladders leaning on the ground, shorts or shirts on children."

Image 1 (`scene.court_boat`):
Early evening on a narrow canal: a young Siamese man and a young woman in a small narrow wooden dugout boat, he paddling at the stern, she seated in front with her hands in her lap; she wears a lower cloth and a breast-cloth wrapped around her chest covering both breasts with both ends thrown back over both shoulders; stilt houses and banana trees along the bank, no other people near, golden low light on the water, shy quiet mood, seen from a distance. (16:9 aspect ratio)

Image 2 (`scene.chore_craft`):
Medium view, a little farther back than before, of a shaded veranda of a house: an old woman seen mostly from the side, wearing a lower cloth and a breast-cloth wrapped around her chest covering both breasts with both ends thrown back over both shoulders, seated on the floor plaiting a reed mat, strips of dried reed fanned out around her and a half-finished mat across her lap; beside her a girl of about ten with a shaved head and small topknot, bare-chested, in a small lower cloth, head bent, sewing a small piece of cotton cloth, a flat basket of thread and cloth between them; afternoon light, a younger child in a lower cloth playing in the shade under the house below. (16:9 aspect ratio)

Image 3 (`scene.wife_jealousy`):
Interior of a timber house in the evening: a wife of the household in her thirties sitting upright on a reed mat beside a lacquered betel box, turned slightly away with a cold expression and lowered eyes, while a younger woman, the minor wife, kneels respectfully at the far side of the room with her head bowed, offering a small tray of betel; BOTH women wear a black wrap skirt and a single white muslin breast-cloth wrapped horizontally around the chest covering both breasts, with its two ends clearly thrown back over BOTH shoulders (not a diagonal one-shoulder sash); the tension is only in posture and gaze, a single oil lamp between them. (16:9 aspect ratio)
```

---

## กล่อง B — ภาพจิตรกรรมเหตุการณ์บ้านเมือง (chronicle)

```text
Please generate the following 4 illustrations, each in 16:9 aspect ratio. Generate one image per turn: start with Image 1 now, and after each image I will simply say "next" for the following one. Do not skip or merge images.

Every image MUST strictly follow this exact STYLE BLOCK:
"In the style of an 18th-century Thai temple mural painting: a single unified continuous scene filling the entire frame, flat colors without shading, deep red-brown background, fine dark hand-painted outlines of uneven weight, no Western perspective, stylized figures in profile and three-quarter view, decorative trees, rocks and water patterns naturally framing the composition. Aged mineral pigments, faded and slightly flaking plaster surface. Avoid: 3D shading, photorealism, crisp vector look, modern objects, tiled roofs or curved horn-shaped gable ornaments on commoner houses, zig-zag dividing lines, geometric frame borders, split panels, multiple framed vignettes."

Image 1 (`history.fall_of_ayutthaya`):
A walled royal city burning at night: flames rising from tiered-roof pavilions and temple spires inside the city walls, invading soldiers with spears and shields climbing the walls and streaming through a gate, townspeople fleeing along the riverbank carrying bundles, boats crowded on the river, smoke curling in stylized patterns; no gore, no close-up of wounds. (16:9 aspect ratio)

Image 2 (`history.famine`):
A village in time of famine: thin villagers in plain lower cloths sitting and standing in a line before a monastery gate where monks and a few officials distribute small portions of rice from large pots, an elderly woman and a child receiving rice into a coconut-shell bowl, empty rice barns on stilts and dry cracked fields in the background, a thin dog, decorative trees; sombre but dignified, no corpses. (16:9 aspect ratio)

Image 3 (`history.plague`):
A river landing during an epidemic: sick people lying on mats under a shelter on the bank, relatives wiping their faces with cloths, monks in a row seated chanting with palm-leaf fans in front of their faces, a few bodies wrapped entirely in white cloth being carried on poles toward a temple compound, boats moored, decorative trees and water patterns; no visible faces or wounds on the bodies. (16:9 aspect ratio)

Image 4 (`history.war`):
An army marching to war: a column of soldiers with spears, swords and shields following a war elephant with a mahout and a howdah, standard-bearers carrying tall banners, drummers and a conch blower at the front, officials on horseback, villagers watching from the roadside with palms pressed together, decorative trees and rocks; stylized, no fighting shown. (16:9 aspect ratio)
```
