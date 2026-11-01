# ชุดเดียวส่งครั้งเดียว — 8 ภาพที่ยังขาด (style block v0.3)

> **วิธีใช้:** ก๊อปกล่องโค้ดด้านล่างทั้งก้อนไปวางใน Gemini Chat แชตใหม่ครั้งเดียว แล้วพิมพ์แค่ **`next`** ทุกครั้งที่ได้ภาพ
> เซฟภาพลง `art/generated/<id>.jpg` ตามชื่อที่กำกับ
>
> | # | id | ใช้กับ |
> |---|----|--------|
> | 1 | `scene.chore_craft` | งานฝีมือ (ภาพนี้มีใน spec แล้ว ขาดแค่ไฟล์) |
> | 2 | `scene.village` | สร้างใหม่แทน `reality-stilt-house.jpg` (baseline.stilt_house) |
> | 3 | `scene.meal` | สร้างใหม่แทน `reality-meal-tray.jpg` (baseline.meal_tray) |
> | 4 | `scene.muay_sparring` | `skill.muay_sparring` (ใหม่) |
> | 5 | `scene.night_assassin` | `scheme.assassin` (ใหม่) |
> | 6 | `scene.wife_jealousy` | `marriage.wife_jealousy`, `marriage.wife_jealousy_slave` (ใหม่) |
> | 7 | `scene.elder_visit` | `temple.elder`, `temple.elder_visit` (ใหม่) |
> | 8 | `scene.heavy_heart` | `adult.heavy_heart` (ใหม่) |
>
> ภาพ 4–8 เป็น id ใหม่ ต้องเพิ่มลง `art/assets.spec.json` (พร้อม tag `event:<id>`) ก่อนจึงจะถูกใช้ในเกม
> ภาพ 2–3 ควรสร้าง 2 ครั้งแล้วคัดอันที่ถูก lore (ดู knownLimitations ใน `art/style.json`)

```text
Please generate the following 8 historical illustrations, each in 16:9 aspect ratio. Generate one image per turn: start with Image 1 now, and after each image I will simply say "next" for the following one. Do not skip or merge images. Keep the same painterly style for all 8.

Every image MUST strictly follow this exact STYLE & HISTORICAL RULE BLOCK:
"Historical illustration of everyday life in Siam (Ayutthaya kingdom), mid-18th century. Muted earthy watercolor and ink on textured paper, soft natural daylight, restrained palette of ochre, indigo, rust and off-white. Grounded, documentary, ordinary weathered faces without makeup. Unless stated otherwise, Siamese adults of both sexes wear their black hair cropped level with the top of the ears, the hair below shaved close, lifted off the forehead, and their teeth are blackened from chewing betel. Commoner men are bare-chested. A well-to-do woman's breast-cloth is wrapped around the chest covering both breasts, its two ends thrown back over both shoulders. Commoner houses are small, of woven split-bamboo panels raised on tall bamboo piles, entered by a short bamboo ladder hanging from the doorway by ropes with its foot off the ground. Any children present are bare-chested and wear a small lower cloth; children under eleven have shaved heads with a small topknot of hair left on the crown. Avoid: modern clothing or objects, tourist-poster look, fantasy costume, glossy digital rendering, glamour or model-like faces, makeup, buns or topknots on adult women, long loose hair, bob haircuts, a breast-cloth worn as a one-shoulder diagonal sash, modern Thai costume, shirts on commoner men, tiled roofs or ornate gable finials on commoner houses, ladders leaning on the ground, shorts or shirts on children."

Image 1 (`scene.chore_craft`):
Medium view of a shaded veranda of a house: an old woman seated on the floor plaiting a reed mat, strips of dried reed fanned out around her and a half-finished mat across her lap; beside her a girl of about ten, head bent, sewing a small piece of cotton cloth with a needle and thread, a flat basket of thread and cloth between them; afternoon light, a younger child playing in the shade under the house below. (16:9 aspect ratio)

Image 2 (`scene.village`):
Wide view of a small Siamese commoner house by a canal: walls, floor and roof of woven split-bamboo panels, raised about four metres on six tall bamboo piles because of seasonal floods, reached by a hanging bamboo ladder tied with ropes; open muddy bank sloping down to the water with banana trees and coconut palms, a small dugout boat tied to a post; river behind, rainy-season sky. No enclosed perimeter fence, no people in the foreground. (16:9 aspect ratio)

Image 3 (`scene.meal`):
Top-down still life on a reed mat: a round footless lacquered wooden tray holding a mound of rice, dried salted fish already cut into small pieces, a small bowl of fermented shrimp paste with garlic, spring onions and fresh herbs, coconut-shell and earthenware bowls, a bamboo water tube; no whole fish, no spoons, forks or chopsticks. (16:9 aspect ratio)

Image 4 (`scene.muay_sparring`):
Late afternoon in a shaded house yard under a large tree: two bare-chested young Siamese men in knee-length lower cloths tucked at the back, their hands wrapped with rope cord, sparring with raised fists and a knee strike, bare feet in packed dirt; a few neighbours and boys watching from the edge, an older man with arms folded judging, a stilt house behind. (16:9 aspect ratio)

Image 5 (`scene.night_assassin`):
Night inside the dark ground level under a raised timber house: a cloaked man in a dark lower cloth crouching between the tall posts, a short knife held low, looking up toward the lit floor planks above where a faint lamp glows through the gaps; moonlight on a canal in the far background, no faces clearly lit, tense mood. No blood, no victim shown. (16:9 aspect ratio)

Image 6 (`scene.wife_jealousy`):
Interior of a timber house in the evening: a wife of the household in her thirties sitting upright on a reed mat beside a lacquered betel box, turned slightly away with a cold expression and lowered eyes, while a younger woman, the minor wife, kneels respectfully at the far side of the room with her head bowed, offering a small tray of betel; both wear a black wrap skirt and a white breast-cloth wrapped around the chest covering both breasts with both ends thrown back over both shoulders; the tension is only in posture and gaze, a single oil lamp between them. (16:9 aspect ratio)

Image 7 (`scene.elder_visit`):
Interior of a modest monastery residence in the morning: an elderly Siamese Buddhist monk in his sixties with a shaved head and shaved eyebrows, in a patched ochre robe leaving the right shoulder bare, seated on a raised mat holding a palm-leaf fan; in front of him a layman and his wife kneeling low with palms pressed together, a tray of flowers, candles and betel offerings between them; timber walls, light falling through a small window. (16:9 aspect ratio)

Image 8 (`scene.heavy_heart`):
Dusk on the veranda of a timber house: a Siamese man in his thirties seated alone, bare-chested, in a knee-length lower cloth, one forearm resting on his knee and his head slightly bowed, looking out toward a canal and fading sky; an untouched lacquered betel box beside him, a small oil lamp not yet lit, the rest of the household quiet and out of sight; still, melancholy mood. (16:9 aspect ratio)
```
