# ชุดภาพที่พร้อมสร้าง (style block v0.8) — จาก art/needed-images.md ข้อ 1–5, 12

> **วิธีใช้:** ก๊อปกล่องโค้ดไปวางใน Gemini Chat แชตใหม่ (ชุด A กับชุด B แยกแชต เพราะคนละ style) แล้วพิมพ์แค่ **`next`** ทุกครั้งที่ได้ภาพ
> เซฟภาพที่คัดแล้วลง `art/generated/<id>.jpg` แล้วรัน `npm run art:ingest`
>
> ทุกภาพอยู่ใน `art/assets.spec.json` แล้ว (prompt ฉบับเต็มต่อภาพอยู่ใน `art/prompts.md`)
> **หลังได้ภาพแต่ละภาพ ก่อนรัน ingest:** ลบ `event:` tag ของภาพนั้นออกจากภาพเดิมใน spec — `scene.audience_hall` (gift_offered rival_accuses punished promotion) และ `scene.sickbed` (child_grave_illness hard_to_raise) — ไม่งั้นคะแนนเท่ากันแล้วเกมสลับภาพเก่า/ใหม่ไปมา
>
> **ชุด A — ภาพฉากและภาพตัวละคร (reality)**
>
> | # | id | ภาพ | ใช้กับ |
> |---|----|-----|--------|
> | 1 | `scene.sick_child` | แม่อุ้มลูกตัวร้อน หมอขวัญผูกด้ายขาวที่ข้อมือเด็ก | `event:family.child_grave_illness` `event:family.hard_to_raise` |
> | 2 | `scene.gift_offered` | คู่ความหมอบนำของกำนัลมาให้ขุนนางที่ชานเรือน | `event:career.gift_offered` |
> | 3 | `scene.rival_accuses` | ขุนนางกรมเดียวกันกล่าวโทษอีกคนต่อหน้าเจ้ากรม | `event:career.rival_accuses` |
> | 4 | `scene.punished` | ขุนนางถูกใส่คานั่งก้มหน้าอยู่หน้ากำแพงที่ทำการ | `event:career.punished` |
> | 5 | `scene.promotion` | ขุนนางหมอบรับเครื่องยศที่ได้พระราชทาน | `event:career.promotion` |
> | 6 | `scene.petition` | ชายหนุ่มกับญาติผู้ใหญ่หมอบฝากตัวกับเจ้ากรมพร้อมของกำนัล | `event:career.petition` |
> | 7 | `portrait.f.elder.head` | แม่เรือนสูงวัยผู้นำตระกูล นั่งตัวตรงข้างหีบไม้และเชี่ยนหมาก | `role:household_head` |
> | 8 | `portrait.f.youth.head` | หญิงสาวที่ต้องขึ้นเป็นเจ้าเรือน นั่งข้างหีบไม้และเชี่ยนหมาก สีหน้าจริงจัง | `role:household_head` |
>
> **ชุด B — ภาพจิตรกรรม (chronicle)**
>
> | # | id | ภาพ | ใช้กับ |
> |---|----|-----|--------|
> | 1 | `history.succession` | ภาพจิตรกรรม: คืนผลัดแผ่นดิน ทหารเฝ้าประตูวัง ขุนนางหมอบรอฟังข่าว | `historykind:succession` |
>
> ตรวจก่อนรับภาพ (`art/style.json` › subjectRules): ไม่มีพระมหากษัตริย์ในฉาก · ปากปิด ไม่ทาปากดำ · เด็กต้องเห็นผ้านุ่งชัด · ชายสามัญไม่ใส่เสื้อ · ภาพตัวละครหญิงสร้าง 2 ครั้งแล้วคัด (การห่มผ้ายังสุ่ม)

## ชุด A (8 ภาพ)

```text
Please generate the following 8 historical illustrations, each in 16:9 aspect ratio. Generate one image per turn: start with Image 1 now, and after each image I will simply say "next" for the following one. Do not skip or merge images. Keep the same painterly style for all 8.

Every image MUST strictly follow this exact STYLE & HISTORICAL RULE BLOCK:
"Historical illustration of everyday life in Siam (Ayutthaya kingdom), mid-18th century. Muted earthy watercolor and ink on textured paper, soft natural daylight, restrained palette of ochre, indigo, rust and off-white. Grounded, documentary, ordinary weathered faces without makeup. Unless stated otherwise, Men wear the traditional 'Mahatthai' hairstyle: short, slightly wavy hair is kept only on the top of the head (about 3-5 cm long) and combed to the side, while the sides and back of the head below the crown are shaved close to the skin with a sharp, straight, clean-edged perimeter line. Siamese women have short black hair on the top crown brushed straight up into a neat, flat-topped, brush-like crest about 4 to 5 cm high, the lower sides and back clipped very short, with very short thin sideburn wisps in front of the ears that end strictly at earlobe level. Faces are natural and unmade-up, with natural muted reddish-brown lips. Commoner men are bare-chested. Men's lower cloth is pulled between the legs and tucked in at the back, forming loose pleated breeches that end at the knee, lower legs bare. Commoner women are either bare-chested or wear only a tight horizontal breast-cloth wrapped around the chest, leaving both shoulders and both arms completely bare. Well-to-do women wear a horizontal breast-cloth wrapped snugly around the torso, optionally with a single-shoulder diagonal sash over the left shoulder only, leaving the right shoulder and both arms completely bare and uncovered. Commoner houses are small, of woven split-bamboo panels raised on tall bamboo piles, entered by a short bamboo ladder hanging from the doorway by ropes with its foot off the ground. Any children present are bare-chested and wear a small lower cloth; children under eleven have shaved heads with a small topknot of hair left on the crown. Avoid: black lips, dark lipstick, black-painted mouth, open-mouth grin, a shaved bald head, modern clothing or objects, tourist-poster look, fantasy costume, glossy digital rendering, glamour or model-like faces, makeup, buns or topknots on adult women, long loose hair, bob haircuts, a shawl covering both shoulders, fabric draping over the upper arms like sleeves, fitted blouses, sleeves of any kind, modern Thai costume, shirts on commoner men, a sarong, longyi or wrapped skirt on men, long trousers, tiled roofs or ornate gable finials on commoner houses, ladders leaning on the ground, shorts or shirts on children."

Image 1 (`scene.sick_child`):
Night inside a timber house lit by a single small oil lamp: a mother kneeling on a reed mat holds a feverish child of about four in her lap, the child with a shaved head and a small topknot, bare-chested and wearing a small white lower cloth clearly visible at the hips, not hidden by the mother's arms or a blanket, limp and flushed, a damp cloth on the forehead; beside them an older woman, the khwan doctor, ties a loop of white raw cotton thread around the child's wrist, a brass bowl covered with a cloth, a ladle and a small silver bracelet on a tray in front of her; the father sits behind with a worried face. Quiet, anxious mood; mouths closed. Hair: The mother has black hair cropped short all over, standing up like a low soft brush only about 2 to 3 cm high that follows the round shape of the head, never tied up; the khwan doctor has grey hair cropped short all over, standing up like a low soft brush only about 2 to 3 cm high that follows the round shape of the head, never tied up; the father has the Mahatthai cut: a short patch of hair only on top of the head, combed to one side and lying flat, the sides and back shaved close. Avoid: a bun, ponytail or any tied-up hair on women, a tall flat-topped or block-shaped crest, a quiff, pompadour or high fade. (16:9 aspect ratio)

Image 2 (`scene.gift_offered`):
Morning on the front veranda of a minor official's timber house: the official, a man in his forties in an open-front collarless white muslin over-shirt with wide long sleeves and a patterned silk lower cloth, no hat, sits on a raised mat beside a lacquered betel box; on the boards below the edge of the platform a commoner couple kneel low with palms pressed together, the man bare-chested, having set before them a footless tray with folded cloth, a small basket of rice, a bunch of bananas and a small earthenware jar; a household servant waits at the side. Calm, customary, matter-of-fact mood; no coins or money shown. Mouths closed. Hair: The official has the Mahatthai cut: a short patch of hair only on top of the head, combed to one side and lying flat, the sides and back shaved close; the commoner man has the Mahatthai cut: a short patch of hair only on top of the head, combed to one side and lying flat, the sides and back shaved close; his wife has black hair cropped short all over, standing up like a low soft brush only about 2 to 3 cm high that follows the round shape of the head, never tied up. Avoid: a bun, ponytail or any tied-up hair on women, a tall flat-topped or block-shaped crest, a quiff, pompadour or high fade. (16:9 aspect ratio)

Image 3 (`scene.rival_accuses`):
Inside an open-sided timber pavilion of a government department: an elderly department head in an open-front collarless white muslin over-shirt with wide long sleeves and a patterned silk lower cloth sits on a raised platform with a lacquered betel box beside him; on the floor before him two officials in white muslin over-shirts kneel side by side: one leans forward with palms pressed together, speaking earnestly and casting a sideways glance at the other; the other kneels stiffly with eyes lowered and jaw set. Clerks in the background keep their heads down over folded paper books. The tension is only in posture and gaze; mouths closed. No king or royal figure visible. Hair: Every official has the Mahatthai cut: a short patch of hair only on top of the head, combed to one side and lying flat, the sides and back shaved close. Avoid: a bun, ponytail or any tied-up hair on women, a tall flat-topped or block-shaped crest, a quiff, pompadour or high fade. (16:9 aspect ratio)

Image 4 (`scene.punished`):
A packed-earth yard outside the whitewashed wall of a government compound: a middle-aged official without his over-shirt, bare-chested, no shirt, in a silk lower cloth, sits on the ground with a heavy flat wooden cangue, a large square board locked around his neck, his head bowed; two other men in cangues sit near him in a loose circle; a guard with a rattan cane stands nearby, and passers-by glance and look away. No blood, no visible wounds; sober, humiliating mood; mouths closed. Hair: Every man has the Mahatthai cut: a short patch of hair only on top of the head, combed to one side and lying flat, the sides and back shaved close. Avoid: a bun, ponytail or any tied-up hair on women, a tall flat-topped or block-shaped crest, a quiff, pompadour or high fade. (16:9 aspect ratio)

Image 5 (`scene.promotion`):
Inside a department pavilion: an official in his forties in an open-front collarless white muslin over-shirt with wide long sleeves and a patterned silk lower cloth kneels with palms pressed together before a low stand holding his new insignia of rank, a silver betel box and a lacquered tray with a folded cloth, which an elderly senior official in a tall white conical hat with a gold band presents on behalf of the crown; other officials kneel in rows behind, watching; quiet ceremonial mood, mouths closed. No king or royal figure visible. Hair: Every official not wearing a hat has the Mahatthai cut: a short patch of hair only on top of the head, combed to one side and lying flat, the sides and back shaved close. Avoid: a bun, ponytail or any tied-up hair on women, a tall flat-topped or block-shaped crest, a quiff, pompadour or high fade. (16:9 aspect ratio)

Image 6 (`scene.petition`):
Late morning at the veranda of a senior official's large timber house: a young man of about twenty, bare-chested, no shirt, in a knee-length lower cloth, kneels on the lower step beside an older male relative, both with palms pressed together and heads lowered; before them a footless tray of gifts with folded cloth, fruit and a small jar; the senior official, in an open-front collarless white muslin over-shirt with wide long sleeves and a patterned silk lower cloth, seated above on a mat beside his betel box, looks down at the young man appraisingly; servants in the background. Mouths closed. Hair: The young man has the Mahatthai cut: a short patch of hair only on top of the head, combed to one side and lying flat, the sides and back shaved close; his relative has the Mahatthai cut: a short patch of hair only on top of the head, combed to one side and lying flat, the sides and back shaved close; the senior official has the Mahatthai cut: a short patch of hair only on top of the head, combed to one side and lying flat, the sides and back shaved close. Avoid: a bun, ponytail or any tied-up hair on women, a tall flat-topped or block-shaped crest, a quiff, pompadour or high fade. (16:9 aspect ratio)

Image 7 (`portrait.f.elder.head`):
Medium portrait: a dignified elderly Siamese matriarch in her sixties who heads her household, with a lined, firm oval face, warm olive-brown skin, high cheekbones and calm, watchful dark eyes, mouth closed; dressed as a well-to-do woman, with gold pear-shaped earrings and gold finger rings; seated upright on a reed mat beside a wooden chest and a betel set, inside a timber house, her posture that of the one who gives the orders. Hair: She has grey hair cropped short all over, standing up like a low soft brush only about 2 to 3 cm high that follows the round shape of the head, never tied up. Avoid: a bun, ponytail or any tied-up hair on women, a tall flat-topped or block-shaped crest, a quiff, pompadour or high fade. (16:9 aspect ratio)

Image 8 (`portrait.f.youth.head`):
Medium portrait: a young well-to-do Siamese woman of about twenty who has had to become head of her household, with warm olive-brown skin, a gentle oval face, high cheekbones and serious, composed dark eyes, mouth closed; dressed as a well-to-do woman, with pear-shaped gold earrings; seated upright on a mat beside a wooden chest and a betel set inside a timber house, a little stiff, as if still growing into the role. Hair: She has black hair cropped short all over, standing up like a low soft brush only about 2 to 3 cm high that follows the round shape of the head, never tied up. Avoid: a bun, ponytail or any tied-up hair on women, a tall flat-topped or block-shaped crest, a quiff, pompadour or high fade. (16:9 aspect ratio)

```

## ชุด B (1 ภาพ)

```text
Please generate the following 1 mural-style paintings, each in 16:9 aspect ratio. Generate one image per turn: start with Image 1 now, and after each image I will simply say "next" for the following one. Do not skip or merge images. Keep the same painterly style for all 1.

Every image MUST strictly follow this exact STYLE & HISTORICAL RULE BLOCK:
"In the style of an 18th-century Thai temple mural painting: a single unified continuous scene filling the entire frame, flat colors without shading, deep red-brown background, fine dark hand-painted outlines of uneven weight, no Western perspective, stylized figures in profile and three-quarter view, decorative trees, rocks and water patterns naturally framing the composition. Aged mineral pigments, faded and slightly flaking plaster surface. Avoid: 3D shading, photorealism, crisp vector look, modern objects, tiled roofs or curved horn-shaped gable ornaments on commoner houses, zig-zag dividing lines, geometric frame borders, split panels, multiple framed vignettes."

Image 1 (`history.succession`):
A tense night at a royal palace when one reign ends: high palace walls and gates with tiered roofs, guards with spears posted at the gates and along the walls by torchlight, rows of officials in tall white conical hats kneeling in the outer courtyard awaiting news, war boats with oarsmen moored at the river landing, townspeople watching from the far bank with palms pressed together, decorative trees and water patterns; the inner palace is closed and empty. No king or royal figure, no crown, no throne, no fighting. (16:9 aspect ratio)

```
