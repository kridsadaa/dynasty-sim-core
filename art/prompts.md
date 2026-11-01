# Prompt ภาพประกอบ (สร้างจาก `npm run art:prompts` — ห้ามแก้มือ)

style v0.1 · อัตราส่วน 16:9 · สร้างภาพละ 2 ครั้งแล้วคัด

ขั้นตอน: คัดลอก prompt ไปสร้างใน Gemini → บันทึกภาพที่คัดแล้วเป็น `art/generated/<id>.jpg` (หรือ .png/.webp) → `npm run art:ingest`

กฎที่ต้องตรวจก่อนรับภาพ (`art/style.json` › subjectRules):
- **framing.adult_commoner_women** — หญิงสามัญตามหลักฐานไม่มีผ้าคลุมอก — ใช้ portrait ครอปไหล่ / มุมข้าง / มุมหลัง / ระยะไกล; ไม่ใช้ภาพเปลือยด้านหน้า; ห้ามเน้นเชิงเพศ
- **framing.children** — เด็กไม่ใส่เสื้อได้ แต่ท่อนล่างต้องมีผ้านุ่งและเห็นชัด; ถ้าถูกบังจนไม่แน่ใจให้ถือว่าภาพไม่ผ่าน
- **closeup.no_shirt** — ภาพระยะใกล้ของชายสามัญต้องระบุ 'bare-chested, no shirt' ในชั้น SUBJECT เสมอ ไม่เช่นนั้นเครื่องมือเติมเสื้อ

## Baseline (สร้างใหม่ด้วย style ปัจจุบัน แล้วแทนภาพใน art/approved)

### baseline.stilt_house

แทน `art/approved/reality-stilt-house.jpg` — สร้างด้วย style block v0.2 แต่ style.json ตรึง reality ที่ v0.3 — สร้างใหม่ด้วย v0.3 ให้ชุด regression เป็นสไตล์เดียวกัน

lore: `material.houses_1680s` (attested, verified)

```
Historical illustration of everyday life in Siam (Ayutthaya kingdom), mid-18th century. Muted earthy watercolor and ink on textured paper, soft natural daylight, restrained palette of ochre, indigo, rust and off-white. Grounded, documentary, ordinary weathered faces without makeup. Unless stated otherwise, Siamese adults of both sexes wear their black hair cropped level with the top of the ears, the hair below shaved close, lifted off the forehead, and their teeth are blackened from chewing betel. Commoner men are bare-chested. A well-to-do woman's breast-cloth is wrapped around the chest covering both breasts, its two ends thrown back over both shoulders. Commoner houses are small, of woven split-bamboo panels raised on tall bamboo piles, entered by a short bamboo ladder hanging from the doorway by ropes with its foot off the ground. Any children present are bare-chested and wear a small lower cloth; children under eleven have shaved heads with a small topknot of hair left on the crown. Avoid: modern clothing or objects, tourist-poster look, fantasy costume, glossy digital rendering, glamour or model-like faces, makeup, buns or topknots on adult women, long loose hair, bob haircuts, a breast-cloth worn as a one-shoulder diagonal sash, modern Thai costume, shirts on commoner men, tiled roofs or ornate gable finials on commoner houses, ladders leaning on the ground, shorts or shirts on children.

Wide view of a small Siamese commoner house by a canal: walls, floor and roof of woven split-bamboo panels, raised about four metres on six tall bamboo piles because of seasonal floods, reached by a hanging bamboo ladder tied with ropes; open muddy bank sloping down to the water with banana trees and coconut palms, a small dugout boat tied to a post; river behind, rainy-season sky. No enclosed perimeter fence, no people in the foreground.
```

### baseline.meal_tray

แทน `art/approved/reality-meal-tray.jpg` — สร้างด้วย style block v0.2 — รอบ 01 ได้ปลาทั้งตัว (lore: อาหารหั่นเป็นชิ้นมาแล้ว)

lore: `material.food_1680s` (attested), `material.household_objects_1680s` (attested)

```
Historical illustration of everyday life in Siam (Ayutthaya kingdom), mid-18th century. Muted earthy watercolor and ink on textured paper, soft natural daylight, restrained palette of ochre, indigo, rust and off-white. Grounded, documentary, ordinary weathered faces without makeup. Unless stated otherwise, Siamese adults of both sexes wear their black hair cropped level with the top of the ears, the hair below shaved close, lifted off the forehead, and their teeth are blackened from chewing betel. Commoner men are bare-chested. A well-to-do woman's breast-cloth is wrapped around the chest covering both breasts, its two ends thrown back over both shoulders. Commoner houses are small, of woven split-bamboo panels raised on tall bamboo piles, entered by a short bamboo ladder hanging from the doorway by ropes with its foot off the ground. Any children present are bare-chested and wear a small lower cloth; children under eleven have shaved heads with a small topknot of hair left on the crown. Avoid: modern clothing or objects, tourist-poster look, fantasy costume, glossy digital rendering, glamour or model-like faces, makeup, buns or topknots on adult women, long loose hair, bob haircuts, a breast-cloth worn as a one-shoulder diagonal sash, modern Thai costume, shirts on commoner men, tiled roofs or ornate gable finials on commoner houses, ladders leaning on the ground, shorts or shirts on children.

Top-down still life on a reed mat: a round footless lacquered wooden tray holding a mound of rice, dried salted fish already cut into small pieces, a small bowl of fermented shrimp paste with garlic, spring onions and fresh herbs, coconut-shell and earthenware bowls, a bamboo water tube; no whole fish, no spoons, forks or chopsticks.
```

## ภาพฉาก (Reality)

### scene.compound — เรือนหมู่ไม้จริงของขุนนางผู้น้อย มีชานแล่น โรงครัว เรือนบ่าวไพร่ในรั้วไผ่ริมคลองตะเคียน

✅ มีภาพแล้ว · tag: `group:family` `event:family.legend_truth` `place:domestic`

lore: `material.houses_1680s` (attested, verified), `material.household_objects_1680s` (attested)

```
Historical illustration of everyday life in Siam (Ayutthaya kingdom), mid-18th century. Muted earthy watercolor and ink on textured paper, soft natural daylight, restrained palette of ochre, indigo, rust and off-white. Grounded, documentary, ordinary weathered faces without makeup. Unless stated otherwise, Siamese adults of both sexes wear their black hair cropped level with the top of the ears, the hair below shaved close, lifted off the forehead, and their teeth are blackened from chewing betel. Commoner men are bare-chested. A well-to-do woman's breast-cloth is wrapped around the chest covering both breasts, its two ends thrown back over both shoulders. Commoner houses are small, of woven split-bamboo panels raised on tall bamboo piles, entered by a short bamboo ladder hanging from the doorway by ropes with its foot off the ground. Any children present are bare-chested and wear a small lower cloth; children under eleven have shaved heads with a small topknot of hair left on the crown. Avoid: modern clothing or objects, tourist-poster look, fantasy costume, glossy digital rendering, glamour or model-like faces, makeup, buns or topknots on adult women, long loose hair, bob haircuts, a breast-cloth worn as a one-shoulder diagonal sash, modern Thai costume, shirts on commoner men, tiled roofs or ornate gable finials on commoner houses, ladders leaning on the ground, shorts or shirts on children.

Wide view of a minor Siamese official's compound (ruean mu) by a canal: a main cluster of raised teak-wood pavilions with traditional recessed-panelled timber walls (fa pakon), open sitting hall (ho nang), and a separate semi-open kitchen house at the back, all linked by a broad raised wooden deck (chan laen) on stout timber posts; inside the surrounding bamboo compound fence stand two smaller woven-bamboo houses for minor wives and household slaves; shaded by betel-nut palms, banana clusters, and a large takian tree by a wooden canal landing with a moored boat; earthenware water jars, servants pound rice and carry water under the high stilts, an elderly woman seated on the veranda, a child with a topknot playing in the yard; morning light.
```

### scene.village — เรือนไผ่ยกสูงของชาวบ้านริมน้ำ

🟡 ใช้ภาพชั่วคราว `art/approved/reality-stilt-house.jpg` · tag: `group:intent` `event:intent.befriend.done` `event:intent.befriend.failed` `event:intent.befriend.mischief` `event:intent.called_home`

lore: `material.houses_1680s` (attested, verified)

```
Historical illustration of everyday life in Siam (Ayutthaya kingdom), mid-18th century. Muted earthy watercolor and ink on textured paper, soft natural daylight, restrained palette of ochre, indigo, rust and off-white. Grounded, documentary, ordinary weathered faces without makeup. Unless stated otherwise, Siamese adults of both sexes wear their black hair cropped level with the top of the ears, the hair below shaved close, lifted off the forehead, and their teeth are blackened from chewing betel. Commoner men are bare-chested. A well-to-do woman's breast-cloth is wrapped around the chest covering both breasts, its two ends thrown back over both shoulders. Commoner houses are small, of woven split-bamboo panels raised on tall bamboo piles, entered by a short bamboo ladder hanging from the doorway by ropes with its foot off the ground. Any children present are bare-chested and wear a small lower cloth; children under eleven have shaved heads with a small topknot of hair left on the crown. Avoid: modern clothing or objects, tourist-poster look, fantasy costume, glossy digital rendering, glamour or model-like faces, makeup, buns or topknots on adult women, long loose hair, bob haircuts, a breast-cloth worn as a one-shoulder diagonal sash, modern Thai costume, shirts on commoner men, tiled roofs or ornate gable finials on commoner houses, ladders leaning on the ground, shorts or shirts on children.

Wide view of a small Siamese commoner house by a canal: walls, floor and roof of woven split-bamboo panels, raised about four metres on six tall bamboo piles because of seasonal floods, reached by a hanging bamboo ladder tied with ropes; open muddy bank sloping down to the water with banana trees and coconut palms, a small dugout boat tied to a post; river behind, rainy-season sky. No enclosed perimeter fence, no people in the foreground.
```

### scene.kitchen_yard — ลานครัวหลังเรือน มีเตาไฟกองเล็กและข้าวของทำครัว

✅ มีภาพแล้ว · tag: `place:kitchen` `situation:kitchen_work` `group:chore` `group:childhood` `chore:kitchen` `event:childhood.kitchen_cut` `event:chore.learn_chop`

lore: `material.houses_1680s` (attested, verified), `material.kitchen_tasks` (inferred, verified), `material.food_1680s` (attested)

```
Historical illustration of everyday life in Siam (Ayutthaya kingdom), mid-18th century. Muted earthy watercolor and ink on textured paper, soft natural daylight, restrained palette of ochre, indigo, rust and off-white. Grounded, documentary, ordinary weathered faces without makeup. Unless stated otherwise, Siamese adults of both sexes wear their black hair cropped level with the top of the ears, the hair below shaved close, lifted off the forehead, and their teeth are blackened from chewing betel. Commoner men are bare-chested. A well-to-do woman's breast-cloth is wrapped around the chest covering both breasts, its two ends thrown back over both shoulders. Commoner houses are small, of woven split-bamboo panels raised on tall bamboo piles, entered by a short bamboo ladder hanging from the doorway by ropes with its foot off the ground. Any children present are bare-chested and wear a small lower cloth; children under eleven have shaved heads with a small topknot of hair left on the crown. Avoid: modern clothing or objects, tourist-poster look, fantasy costume, glossy digital rendering, glamour or model-like faces, makeup, buns or topknots on adult women, long loose hair, bob haircuts, a breast-cloth worn as a one-shoulder diagonal sash, modern Thai costume, shirts on commoner men, tiled roofs or ornate gable finials on commoner houses, ladders leaning on the ground, shorts or shirts on children.

Medium-wide view of an outdoor kitchen in a house yard seen from the side: a small wood fire on the ground with an earthenware pot, a grating board and split coconuts, garlic and shallots on a flat basket, dried fish hanging from a pole, bamboo water tubes; a woman squatting by the fire with her back half turned, a child in a lower cloth watching; stilt house behind.
```

### scene.chore_housework — เด็กช่วยงานบ้าน กวาดชาน ขัดพื้นกระดาน และหาบน้ำขึ้นเรือน

✅ มีภาพแล้ว · tag: `chore:housework`

lore: `material.floor_polishing` (invented, verified), `material.houses_1680s` (attested, verified), `material.household_objects_1680s` (attested), `kinship.child_chores_by_strength` (inferred, verified)

```
Historical illustration of everyday life in Siam (Ayutthaya kingdom), mid-18th century. Muted earthy watercolor and ink on textured paper, soft natural daylight, restrained palette of ochre, indigo, rust and off-white. Grounded, documentary, ordinary weathered faces without makeup. Unless stated otherwise, Siamese adults of both sexes wear their black hair cropped level with the top of the ears, the hair below shaved close, lifted off the forehead, and their teeth are blackened from chewing betel. Commoner men are bare-chested. A well-to-do woman's breast-cloth is wrapped around the chest covering both breasts, its two ends thrown back over both shoulders. Commoner houses are small, of woven split-bamboo panels raised on tall bamboo piles, entered by a short bamboo ladder hanging from the doorway by ropes with its foot off the ground. Any children present are bare-chested and wear a small lower cloth; children under eleven have shaved heads with a small topknot of hair left on the crown. Avoid: modern clothing or objects, tourist-poster look, fantasy costume, glossy digital rendering, glamour or model-like faces, makeup, buns or topknots on adult women, long loose hair, bob haircuts, a breast-cloth worn as a one-shoulder diagonal sash, modern Thai costume, shirts on commoner men, tiled roofs or ornate gable finials on commoner houses, ladders leaning on the ground, shorts or shirts on children.

Medium-wide view of a timber house platform and yard in the morning: a girl of about eight kneeling on the plank floor of the open veranda, rubbing the boards with half a coconut shell, a woven palm-rib broom and a bamboo water bucket beside her; below in the yard a boy of about ten carrying two bamboo water tubes on a shoulder pole toward the house and a small bundle of firewood stacked by a post; an older woman watching from the doorway.
```

### scene.chore_craft — หญิงชรานั่งสานเสื่อบนชานเรือน เด็กหญิงนั่งหัดเย็บปักผ้าอยู่ข้างๆ

⬜ ยังไม่มีภาพ · tag: `chore:craft`

lore: `material.crafts_1680s` (attested, verified), `kinship.child_chores_by_strength` (inferred, verified), `material.household_objects_1680s` (attested)

```
Historical illustration of everyday life in Siam (Ayutthaya kingdom), mid-18th century. Muted earthy watercolor and ink on textured paper, soft natural daylight, restrained palette of ochre, indigo, rust and off-white. Grounded, documentary, ordinary weathered faces without makeup. Unless stated otherwise, Siamese adults of both sexes wear their black hair cropped level with the top of the ears, the hair below shaved close, lifted off the forehead, and their teeth are blackened from chewing betel. Commoner men are bare-chested. A well-to-do woman's breast-cloth is wrapped around the chest covering both breasts, its two ends thrown back over both shoulders. Commoner houses are small, of woven split-bamboo panels raised on tall bamboo piles, entered by a short bamboo ladder hanging from the doorway by ropes with its foot off the ground. Any children present are bare-chested and wear a small lower cloth; children under eleven have shaved heads with a small topknot of hair left on the crown. Avoid: modern clothing or objects, tourist-poster look, fantasy costume, glossy digital rendering, glamour or model-like faces, makeup, buns or topknots on adult women, long loose hair, bob haircuts, a breast-cloth worn as a one-shoulder diagonal sash, modern Thai costume, shirts on commoner men, tiled roofs or ornate gable finials on commoner houses, ladders leaning on the ground, shorts or shirts on children.

Medium view of a shaded veranda of a house: an old woman seated on the floor plaiting a reed mat, strips of dried reed fanned out around her and a half-finished mat across her lap; beside her a girl of about ten, head bent, sewing a small piece of cotton cloth with a needle and thread, a flat basket of thread and cloth between them; afternoon light, a younger child playing in the shade under the house below.
```

### scene.chore_flowers — เด็กหญิงนั่งร้อยดอกไม้เป็นพวงกับผู้ใหญ่ มีดอกบัวกองอยู่บนกระด้ง

✅ มีภาพแล้ว · tag: `chore:flowers`

lore: `material.flower_stringing` (inferred, verified), `material.boats_1680s` (attested), `material.household_objects_1680s` (attested)

```
Historical illustration of everyday life in Siam (Ayutthaya kingdom), mid-18th century. Muted earthy watercolor and ink on textured paper, soft natural daylight, restrained palette of ochre, indigo, rust and off-white. Grounded, documentary, ordinary weathered faces without makeup. Unless stated otherwise, Siamese adults of both sexes wear their black hair cropped level with the top of the ears, the hair below shaved close, lifted off the forehead, and their teeth are blackened from chewing betel. Commoner men are bare-chested. A well-to-do woman's breast-cloth is wrapped around the chest covering both breasts, its two ends thrown back over both shoulders. Commoner houses are small, of woven split-bamboo panels raised on tall bamboo piles, entered by a short bamboo ladder hanging from the doorway by ropes with its foot off the ground. Any children present are bare-chested and wear a small lower cloth; children under eleven have shaved heads with a small topknot of hair left on the crown. Avoid: modern clothing or objects, tourist-poster look, fantasy costume, glossy digital rendering, glamour or model-like faces, makeup, buns or topknots on adult women, long loose hair, bob haircuts, a breast-cloth worn as a one-shoulder diagonal sash, modern Thai costume, shirts on commoner men, tiled roofs or ornate gable finials on commoner houses, ladders leaning on the ground, shorts or shirts on children.

Medium view of women and a girl seated on a reed mat on a veranda, threading small white and yellow flowers onto long strings to make simple hanging strands, a flat round winnowing basket heaped with loose blossoms and a few pink lotus buds with folded-back petals, a bowl of water to keep the flowers fresh, a canal with a small boat visible beyond the house posts. Simple strands of flowers only. Avoid: elaborate modern garlands, ribbons, tassels.
```

### scene.chore_merit — พระยืนเงียบที่หน้าประตูเรือนยามเช้า ผู้หญิงกับเด็กใส่ข้าวลงบาตร

✅ มีภาพแล้ว · tag: `chore:merit`

lore: `ritual.alms_round_1680s` (attested, verified), `attire.monks_1680s` (attested), `material.household_objects_1680s` (attested)

```
Historical illustration of everyday life in Siam (Ayutthaya kingdom), mid-18th century. Muted earthy watercolor and ink on textured paper, soft natural daylight, restrained palette of ochre, indigo, rust and off-white. Grounded, documentary, ordinary weathered faces without makeup. Unless stated otherwise, Siamese adults of both sexes wear their black hair cropped level with the top of the ears, the hair below shaved close, lifted off the forehead, and their teeth are blackened from chewing betel. Commoner men are bare-chested. A well-to-do woman's breast-cloth is wrapped around the chest covering both breasts, its two ends thrown back over both shoulders. Commoner houses are small, of woven split-bamboo panels raised on tall bamboo piles, entered by a short bamboo ladder hanging from the doorway by ropes with its foot off the ground. Any children present are bare-chested and wear a small lower cloth; children under eleven have shaved heads with a small topknot of hair left on the crown. Avoid: modern clothing or objects, tourist-poster look, fantasy costume, glossy digital rendering, glamour or model-like faces, makeup, buns or topknots on adult women, long loose hair, bob haircuts, a breast-cloth worn as a one-shoulder diagonal sash, modern Thai costume, shirts on commoner men, tiled roofs or ornate gable finials on commoner houses, ladders leaning on the ground, shorts or shirts on children.

Early morning in front of a house gate: a Buddhist monk in an ochre robe standing silently with his alms bowl held at his waist, eyes lowered; a woman and a child of about eight kneeling on a mat at the gate, the child lifting a spoonful of cooked rice from a covered bowl into the monk's bowl, a tray with bananas and small leaf-wrapped food beside them; misty light, bamboo fence, other houses in the background.
```

### scene.meal — สำรับข้าวกับปลาแห้งบนถาดไม่มีขา

🟡 ใช้ภาพชั่วคราว `art/approved/reality-meal-tray.jpg` · tag: `situation:feast`

lore: `material.food_1680s` (attested), `material.household_objects_1680s` (attested)

```
Historical illustration of everyday life in Siam (Ayutthaya kingdom), mid-18th century. Muted earthy watercolor and ink on textured paper, soft natural daylight, restrained palette of ochre, indigo, rust and off-white. Grounded, documentary, ordinary weathered faces without makeup. Unless stated otherwise, Siamese adults of both sexes wear their black hair cropped level with the top of the ears, the hair below shaved close, lifted off the forehead, and their teeth are blackened from chewing betel. Commoner men are bare-chested. A well-to-do woman's breast-cloth is wrapped around the chest covering both breasts, its two ends thrown back over both shoulders. Commoner houses are small, of woven split-bamboo panels raised on tall bamboo piles, entered by a short bamboo ladder hanging from the doorway by ropes with its foot off the ground. Any children present are bare-chested and wear a small lower cloth; children under eleven have shaved heads with a small topknot of hair left on the crown. Avoid: modern clothing or objects, tourist-poster look, fantasy costume, glossy digital rendering, glamour or model-like faces, makeup, buns or topknots on adult women, long loose hair, bob haircuts, a breast-cloth worn as a one-shoulder diagonal sash, modern Thai costume, shirts on commoner men, tiled roofs or ornate gable finials on commoner houses, ladders leaning on the ground, shorts or shirts on children.

Top-down still life on a reed mat: a round footless lacquered wooden tray holding a mound of rice, dried salted fish already cut into small pieces, a small bowl of fermented shrimp paste with garlic, spring onions and fresh herbs, coconut-shell and earthenware bowls, a bamboo water tube; no whole fish, no spoons, forks or chopsticks.
```

### scene.court_feast — แขกนั่งล้อมถาดอาหารบนเสื่อในงานเลี้ยงของขุนนาง

✅ มีภาพแล้ว · tag: `event:adult.court_feast`

lore: `material.household_objects_1680s` (attested), `material.food_1680s` (attested)

```
Historical illustration of everyday life in Siam (Ayutthaya kingdom), mid-18th century. Muted earthy watercolor and ink on textured paper, soft natural daylight, restrained palette of ochre, indigo, rust and off-white. Grounded, documentary, ordinary weathered faces without makeup. Unless stated otherwise, Siamese adults of both sexes wear their black hair cropped level with the top of the ears, the hair below shaved close, lifted off the forehead, and their teeth are blackened from chewing betel. Commoner men are bare-chested. A well-to-do woman's breast-cloth is wrapped around the chest covering both breasts, its two ends thrown back over both shoulders. Commoner houses are small, of woven split-bamboo panels raised on tall bamboo piles, entered by a short bamboo ladder hanging from the doorway by ropes with its foot off the ground. Any children present are bare-chested and wear a small lower cloth; children under eleven have shaved heads with a small topknot of hair left on the crown. Avoid: modern clothing or objects, tourist-poster look, fantasy costume, glossy digital rendering, glamour or model-like faces, makeup, buns or topknots on adult women, long loose hair, bob haircuts, a breast-cloth worn as a one-shoulder diagonal sash, modern Thai costume, shirts on commoner men, tiled roofs or ornate gable finials on commoner houses, ladders leaning on the ground, shorts or shirts on children.

Medium-wide view inside a timber house during a household feast: adult men seated cross-legged on reed mats in small groups around round footless trays of rice and dishes, lacquered betel boxes beside them, eating with their right hands, a servant kneeling to bring a water jar; lamplight in the evening.
```

### scene.newborn — แม่ลูกอ่อนนอนอยู่ไฟ ทารกนอนบนเสื่อข้างตัว

✅ มีภาพแล้ว · tag: `event:family.newborn` `event:family.grandchild_naming` `situation:childbirth`

lore: `ritual.yu_fai_placenta` (inferred)

```
Historical illustration of everyday life in Siam (Ayutthaya kingdom), mid-18th century. Muted earthy watercolor and ink on textured paper, soft natural daylight, restrained palette of ochre, indigo, rust and off-white. Grounded, documentary, ordinary weathered faces without makeup. Unless stated otherwise, Siamese adults of both sexes wear their black hair cropped level with the top of the ears, the hair below shaved close, lifted off the forehead, and their teeth are blackened from chewing betel. Commoner men are bare-chested. A well-to-do woman's breast-cloth is wrapped around the chest covering both breasts, its two ends thrown back over both shoulders. Commoner houses are small, of woven split-bamboo panels raised on tall bamboo piles, entered by a short bamboo ladder hanging from the doorway by ropes with its foot off the ground. Any children present are bare-chested and wear a small lower cloth; children under eleven have shaved heads with a small topknot of hair left on the crown. Avoid: modern clothing or objects, tourist-poster look, fantasy costume, glossy digital rendering, glamour or model-like faces, makeup, buns or topknots on adult women, long loose hair, bob haircuts, a breast-cloth worn as a one-shoulder diagonal sash, modern Thai costume, shirts on commoner men, tiled roofs or ornate gable finials on commoner houses, ladders leaning on the ground, shorts or shirts on children.

Interior of a house at dusk: a young mother wrapped in a lower cloth and a shawl lying on a reed mat beside a low glowing fire, a swaddled newborn on a cloth beside her, an older woman fanning the fire with a woven fan; seen from the side at a respectful distance.
```

### scene.sickbed — ผู้เฒ่านอนป่วยบนเสื่อ ลูกนั่งเฝ้าข้างกาย

✅ มีภาพแล้ว · tag: `event:family.parent_illness` `event:family.hard_to_raise` `situation:illness`

lore: `material.household_objects_1680s` (attested)

```
Historical illustration of everyday life in Siam (Ayutthaya kingdom), mid-18th century. Muted earthy watercolor and ink on textured paper, soft natural daylight, restrained palette of ochre, indigo, rust and off-white. Grounded, documentary, ordinary weathered faces without makeup. Unless stated otherwise, Siamese adults of both sexes wear their black hair cropped level with the top of the ears, the hair below shaved close, lifted off the forehead, and their teeth are blackened from chewing betel. Commoner men are bare-chested. A well-to-do woman's breast-cloth is wrapped around the chest covering both breasts, its two ends thrown back over both shoulders. Commoner houses are small, of woven split-bamboo panels raised on tall bamboo piles, entered by a short bamboo ladder hanging from the doorway by ropes with its foot off the ground. Any children present are bare-chested and wear a small lower cloth; children under eleven have shaved heads with a small topknot of hair left on the crown. Avoid: modern clothing or objects, tourist-poster look, fantasy costume, glossy digital rendering, glamour or model-like faces, makeup, buns or topknots on adult women, long loose hair, bob haircuts, a breast-cloth worn as a one-shoulder diagonal sash, modern Thai costume, shirts on commoner men, tiled roofs or ornate gable finials on commoner houses, ladders leaning on the ground, shorts or shirts on children.

Interior of a house in dim daylight: an old man lying ill on a reed mat under a thin cotton cloth, a grown son kneeling beside him holding an earthenware bowl of herbal medicine, a bundle of dried roots and leaves on a tray; quiet, worried mood.
```

### scene.funeral_home — ศพห่อผ้าขาวในเรือน ญาตินั่งล้อม พระสวด

✅ มีภาพแล้ว · tag: `event:family.death` `event:family.death_bad`

lore: `ritual.funeral_cremation` (inferred, verified), `attire.monks_1680s` (attested)

```
Historical illustration of everyday life in Siam (Ayutthaya kingdom), mid-18th century. Muted earthy watercolor and ink on textured paper, soft natural daylight, restrained palette of ochre, indigo, rust and off-white. Grounded, documentary, ordinary weathered faces without makeup. Unless stated otherwise, Siamese adults of both sexes wear their black hair cropped level with the top of the ears, the hair below shaved close, lifted off the forehead, and their teeth are blackened from chewing betel. Commoner men are bare-chested. A well-to-do woman's breast-cloth is wrapped around the chest covering both breasts, its two ends thrown back over both shoulders. Commoner houses are small, of woven split-bamboo panels raised on tall bamboo piles, entered by a short bamboo ladder hanging from the doorway by ropes with its foot off the ground. Any children present are bare-chested and wear a small lower cloth; children under eleven have shaved heads with a small topknot of hair left on the crown. Avoid: modern clothing or objects, tourist-poster look, fantasy costume, glossy digital rendering, glamour or model-like faces, makeup, buns or topknots on adult women, long loose hair, bob haircuts, a breast-cloth worn as a one-shoulder diagonal sash, modern Thai costume, shirts on commoner men, tiled roofs or ornate gable finials on commoner houses, ladders leaning on the ground, shorts or shirts on children.

Interior of a house: a body wrapped entirely in white cloth lying on a mat, only the outline visible, relatives seated on the floor around it with heads bowed, three monks in yellow patched robes seated in a row holding palm-leaf fans in front of their faces while chanting, candles burning; sombre evening light. No visible face or wound on the body.
```

### scene.betrothal — ผู้ใหญ่สองฝ่ายนั่งเจรจาสู่ขอ มีพานหมากอยู่ตรงกลาง

✅ มีภาพแล้ว · tag: `group:marriage` `event:family.arranged_match` `event:intent.court.accepted_formal` `event:marriage.refused` `event:marriage.refused_f` `event:marriage.milk_claim` `event:marriage.milk_claim_f`

lore: `kinship.betrothal_khanmak_three_seals` (attested, verified), `material.household_objects_1680s` (attested)

```
Historical illustration of everyday life in Siam (Ayutthaya kingdom), mid-18th century. Muted earthy watercolor and ink on textured paper, soft natural daylight, restrained palette of ochre, indigo, rust and off-white. Grounded, documentary, ordinary weathered faces without makeup. Unless stated otherwise, Siamese adults of both sexes wear their black hair cropped level with the top of the ears, the hair below shaved close, lifted off the forehead, and their teeth are blackened from chewing betel. Commoner men are bare-chested. A well-to-do woman's breast-cloth is wrapped around the chest covering both breasts, its two ends thrown back over both shoulders. Commoner houses are small, of woven split-bamboo panels raised on tall bamboo piles, entered by a short bamboo ladder hanging from the doorway by ropes with its foot off the ground. Any children present are bare-chested and wear a small lower cloth; children under eleven have shaved heads with a small topknot of hair left on the crown. Avoid: modern clothing or objects, tourist-poster look, fantasy costume, glossy digital rendering, glamour or model-like faces, makeup, buns or topknots on adult women, long loose hair, bob haircuts, a breast-cloth worn as a one-shoulder diagonal sash, modern Thai costume, shirts on commoner men, tiled roofs or ornate gable finials on commoner houses, ladders leaning on the ground, shorts or shirts on children.

Interior of a timber house: two groups of middle-aged adults seated on reed mats facing each other, between them three bowls of betel nut and betel leaves on footed trays, the elders talking seriously; a young woman half-hidden behind a doorway listening.
```

### scene.wedding — พิธีแต่งงาน เจ้าบ่าวเจ้าสาวนั่งเคียงกันรับน้ำสังข์จากผู้ใหญ่

✅ มีภาพแล้ว · tag: `event:marriage.wedding` `event:marriage.wedding_f` `event:marriage.minor_wife` `event:family.child_wedding`

lore: `kinship.betrothal_khanmak_three_seals` (attested, verified), `attire.women_1680s` (attested), `material.houses_1680s` (attested, verified)

```
Historical illustration of everyday life in Siam (Ayutthaya kingdom), mid-18th century. Muted earthy watercolor and ink on textured paper, soft natural daylight, restrained palette of ochre, indigo, rust and off-white. Grounded, documentary, ordinary weathered faces without makeup. Unless stated otherwise, Siamese adults of both sexes wear their black hair cropped level with the top of the ears, the hair below shaved close, lifted off the forehead, and their teeth are blackened from chewing betel. Commoner men are bare-chested. A well-to-do woman's breast-cloth is wrapped around the chest covering both breasts, its two ends thrown back over both shoulders. Commoner houses are small, of woven split-bamboo panels raised on tall bamboo piles, entered by a short bamboo ladder hanging from the doorway by ropes with its foot off the ground. Any children present are bare-chested and wear a small lower cloth; children under eleven have shaved heads with a small topknot of hair left on the crown. Avoid: modern clothing or objects, tourist-poster look, fantasy costume, glossy digital rendering, glamour or model-like faces, makeup, buns or topknots on adult women, long loose hair, bob haircuts, a breast-cloth worn as a one-shoulder diagonal sash, modern Thai costume, shirts on commoner men, tiled roofs or ornate gable finials on commoner houses, ladders leaning on the ground, shorts or shirts on children.

Interior of a Siamese timber bridal house: a young bride and groom seated side by side on a reed mat with palms pressed together in respectful greeting, wearing white sacred cotton thread rings (mongkhonแฝด) linked between their heads; the bride wears a black wrap skirt and a white muslin chest wrap horizontally across her chest with both ends thrown back over both shoulders, the groom wears a fine patterned lower cloth; an elderly couple in front of them pouring lustral water from a white conch shell over the couple's joined hands over a brass bowl of flowers, footed trays of betel nut and offerings nearby, relatives watching warmly. Avoid: one-shoulder diagonal sash, modern bridal costume.
```

### scene.courtship — หนุ่มสาวคุยกันที่ท่าน้ำ ฝ่ายหญิงถือหม้อน้ำ

✅ มีภาพแล้ว · tag: `event:intent.court.trial` `event:intent.court.gossip` `event:intent.court.accepted` `event:intent.court.rejected` `event:marriage.divorce`

lore: `kinship.courtship_liberty_1680s` (attested, verified), `attire.women_1680s` (attested)

```
Historical illustration of everyday life in Siam (Ayutthaya kingdom), mid-18th century. Muted earthy watercolor and ink on textured paper, soft natural daylight, restrained palette of ochre, indigo, rust and off-white. Grounded, documentary, ordinary weathered faces without makeup. Unless stated otherwise, Siamese adults of both sexes wear their black hair cropped level with the top of the ears, the hair below shaved close, lifted off the forehead, and their teeth are blackened from chewing betel. Commoner men are bare-chested. A well-to-do woman's breast-cloth is wrapped around the chest covering both breasts, its two ends thrown back over both shoulders. Commoner houses are small, of woven split-bamboo panels raised on tall bamboo piles, entered by a short bamboo ladder hanging from the doorway by ropes with its foot off the ground. Any children present are bare-chested and wear a small lower cloth; children under eleven have shaved heads with a small topknot of hair left on the crown. Avoid: modern clothing or objects, tourist-poster look, fantasy costume, glossy digital rendering, glamour or model-like faces, makeup, buns or topknots on adult women, long loose hair, bob haircuts, a breast-cloth worn as a one-shoulder diagonal sash, modern Thai costume, shirts on commoner men, tiled roofs or ornate gable finials on commoner houses, ladders leaning on the ground, shorts or shirts on children.

A wooden landing on a canal in late afternoon: a young woman wearing a lower cloth and a breast-cloth wrapped around her chest covering both breasts, ends thrown back over both shoulders, holding an earthenware water jar on her hip, and a young man standing a few steps away speaking to her; other villagers bathing far off in the water.
```

### scene.lotus_pond — เรือลำเล็กกลางบึงบัว

✅ มีภาพแล้ว · tag: `group:outing` `event:outing.lotus_f` `event:outing.lotus_m` `event:outing.lotus_fall_f` `event:outing.lotus_fall_m`

lore: `kinship.lotus_boat_meeting` (invented)

```
Historical illustration of everyday life in Siam (Ayutthaya kingdom), mid-18th century. Muted earthy watercolor and ink on textured paper, soft natural daylight, restrained palette of ochre, indigo, rust and off-white. Grounded, documentary, ordinary weathered faces without makeup. Unless stated otherwise, Siamese adults of both sexes wear their black hair cropped level with the top of the ears, the hair below shaved close, lifted off the forehead, and their teeth are blackened from chewing betel. Commoner men are bare-chested. A well-to-do woman's breast-cloth is wrapped around the chest covering both breasts, its two ends thrown back over both shoulders. Commoner houses are small, of woven split-bamboo panels raised on tall bamboo piles, entered by a short bamboo ladder hanging from the doorway by ropes with its foot off the ground. Any children present are bare-chested and wear a small lower cloth; children under eleven have shaved heads with a small topknot of hair left on the crown. Avoid: modern clothing or objects, tourist-poster look, fantasy costume, glossy digital rendering, glamour or model-like faces, makeup, buns or topknots on adult women, long loose hair, bob haircuts, a breast-cloth worn as a one-shoulder diagonal sash, modern Thai costume, shirts on commoner men, tiled roofs or ornate gable finials on commoner houses, ladders leaning on the ground, shorts or shirts on children.

Wide view of a lotus pond in the morning: two teenagers in a small narrow wooden dugout boat among lotus leaves and pink blossoms, one paddling, one reaching out to pick a flower, the boat tilting slightly; seen from a distance.
```

### scene.palace_pages — มหาดเล็กหนุ่มนั่งเรียงรอรับใช้ในลานพระราชวัง

✅ มีภาพแล้ว · tag: `group:career` `place:court` `event:career.page_duty` `event:career.page_mistake` `event:career.page_found_out` `event:career.punished_page` `event:career.present_page` `event:career.assign_department`

lore: `social.royal_pages_1680s` (inferred, verified), `attire.officials_1680s` (attested)

```
Historical illustration of everyday life in Siam (Ayutthaya kingdom), mid-18th century. Muted earthy watercolor and ink on textured paper, soft natural daylight, restrained palette of ochre, indigo, rust and off-white. Grounded, documentary, ordinary weathered faces without makeup. Unless stated otherwise, Siamese adults of both sexes wear their black hair cropped level with the top of the ears, the hair below shaved close, lifted off the forehead, and their teeth are blackened from chewing betel. Commoner men are bare-chested. A well-to-do woman's breast-cloth is wrapped around the chest covering both breasts, its two ends thrown back over both shoulders. Commoner houses are small, of woven split-bamboo panels raised on tall bamboo piles, entered by a short bamboo ladder hanging from the doorway by ropes with its foot off the ground. Any children present are bare-chested and wear a small lower cloth; children under eleven have shaved heads with a small topknot of hair left on the crown. Avoid: modern clothing or objects, tourist-poster look, fantasy costume, glossy digital rendering, glamour or model-like faces, makeup, buns or topknots on adult women, long loose hair, bob haircuts, a breast-cloth worn as a one-shoulder diagonal sash, modern Thai costume, shirts on commoner men, tiled roofs or ornate gable finials on commoner houses, ladders leaning on the ground, shorts or shirts on children.

A paved palace courtyard beside a pavilion with tiered roofs: a row of young royal pages under twenty-five in white muslin over-shirts and silk lower cloths kneeling and sitting in order, one holding a lacquered betel box, an older official in a tall white conical hat with gold bands watching them. No king or royal figure visible.
```

### scene.audience_hall — ขุนนางสวมลอมพอกหมอบเฝ้าเป็นแถวในท้องพระโรง

✅ มีภาพแล้ว · tag: `event:career.audience_late` `event:career.promotion` `event:career.punished` `event:career.gift_offered` `event:career.rival_accuses` `event:career.reported` `event:career.recall`

lore: `attire.officials_1680s` (attested), `social.court_attendance_rules` (attested, verified)

```
Historical illustration of everyday life in Siam (Ayutthaya kingdom), mid-18th century. Muted earthy watercolor and ink on textured paper, soft natural daylight, restrained palette of ochre, indigo, rust and off-white. Grounded, documentary, ordinary weathered faces without makeup. Unless stated otherwise, Siamese adults of both sexes wear their black hair cropped level with the top of the ears, the hair below shaved close, lifted off the forehead, and their teeth are blackened from chewing betel. Commoner men are bare-chested. A well-to-do woman's breast-cloth is wrapped around the chest covering both breasts, its two ends thrown back over both shoulders. Commoner houses are small, of woven split-bamboo panels raised on tall bamboo piles, entered by a short bamboo ladder hanging from the doorway by ropes with its foot off the ground. Any children present are bare-chested and wear a small lower cloth; children under eleven have shaved heads with a small topknot of hair left on the crown. Avoid: modern clothing or objects, tourist-poster look, fantasy costume, glossy digital rendering, glamour or model-like faces, makeup, buns or topknots on adult women, long loose hair, bob haircuts, a breast-cloth worn as a one-shoulder diagonal sash, modern Thai costume, shirts on commoner men, tiled roofs or ornate gable finials on commoner houses, ladders leaning on the ground, shorts or shirts on children.

Interior of a palace audience hall seen from behind the officials: rows of Siamese officials in open-front white muslin over-shirts and tall white conical hats with gold bands prostrating on the floor in strict order, betel boxes beside them, tall red columns; the throne area is off-frame. No king or royal figure visible.
```

### scene.night_patrol — กองตระเวนถือคบไฟจับขโมยควายริมคลอง

✅ มีภาพแล้ว · tag: `event:career.patrol_thief` `situation:combat`

lore: `social.patrol_department_ladder` (attested, verified), `attire.commoner_men_1680s` (attested)

```
Historical illustration of everyday life in Siam (Ayutthaya kingdom), mid-18th century. Muted earthy watercolor and ink on textured paper, soft natural daylight, restrained palette of ochre, indigo, rust and off-white. Grounded, documentary, ordinary weathered faces without makeup. Unless stated otherwise, Siamese adults of both sexes wear their black hair cropped level with the top of the ears, the hair below shaved close, lifted off the forehead, and their teeth are blackened from chewing betel. Commoner men are bare-chested. A well-to-do woman's breast-cloth is wrapped around the chest covering both breasts, its two ends thrown back over both shoulders. Commoner houses are small, of woven split-bamboo panels raised on tall bamboo piles, entered by a short bamboo ladder hanging from the doorway by ropes with its foot off the ground. Any children present are bare-chested and wear a small lower cloth; children under eleven have shaved heads with a small topknot of hair left on the crown. Avoid: modern clothing or objects, tourist-poster look, fantasy costume, glossy digital rendering, glamour or model-like faces, makeup, buns or topknots on adult women, long loose hair, bob haircuts, a breast-cloth worn as a one-shoulder diagonal sash, modern Thai costume, shirts on commoner men, tiled roofs or ornate gable finials on commoner houses, ladders leaning on the ground, shorts or shirts on children.

Night by a canal bank: three patrol men, bare-chested, in lower cloths, carrying burning torches and wooden staves, surrounding a man crouching beside a water buffalo; firelight on the water, stilt houses dark in the background.
```

### scene.temple_holy_day — ชาวบ้านนำของไปถวายพระที่วัดในวันพระ

✅ มีภาพแล้ว · tag: `group:festival` `group:ritual` `event:festival.holy_day` `event:ritual.elder_precepts` `group:temple`

lore: `ritual.holy_days_1680s` (attested, verified), `ritual.alms_round_1680s` (attested, verified), `attire.monks_1680s` (attested)

```
Historical illustration of everyday life in Siam (Ayutthaya kingdom), mid-18th century. Muted earthy watercolor and ink on textured paper, soft natural daylight, restrained palette of ochre, indigo, rust and off-white. Grounded, documentary, ordinary weathered faces without makeup. Unless stated otherwise, Siamese adults of both sexes wear their black hair cropped level with the top of the ears, the hair below shaved close, lifted off the forehead, and their teeth are blackened from chewing betel. Commoner men are bare-chested. A well-to-do woman's breast-cloth is wrapped around the chest covering both breasts, its two ends thrown back over both shoulders. Commoner houses are small, of woven split-bamboo panels raised on tall bamboo piles, entered by a short bamboo ladder hanging from the doorway by ropes with its foot off the ground. Any children present are bare-chested and wear a small lower cloth; children under eleven have shaved heads with a small topknot of hair left on the crown. Avoid: modern clothing or objects, tourist-poster look, fantasy costume, glossy digital rendering, glamour or model-like faces, makeup, buns or topknots on adult women, long loose hair, bob haircuts, a breast-cloth worn as a one-shoulder diagonal sash, modern Thai costume, shirts on commoner men, tiled roofs or ornate gable finials on commoner houses, ladders leaning on the ground, shorts or shirts on children.

A temple compound on a holy day: villagers in clean lower cloths carrying fruit, cloth and rice in baskets toward a monastery hall, older people in white sitting on mats listening to a monk preaching from a raised seat while holding a palm-leaf fan, candles lit; whitewashed brick hall with a tiled roof, bodhi tree.
```

### scene.temple_fair — งานวัด คนมาในผ้าใหม่ มีชกมวยพันเชือก

✅ มีภาพแล้ว · tag: `event:festival.temple_fair`

lore: `ritual.temple_festival_1680s` (attested, verified), `material.household_objects_1680s` (attested)

```
Historical illustration of everyday life in Siam (Ayutthaya kingdom), mid-18th century. Muted earthy watercolor and ink on textured paper, soft natural daylight, restrained palette of ochre, indigo, rust and off-white. Grounded, documentary, ordinary weathered faces without makeup. Unless stated otherwise, Siamese adults of both sexes wear their black hair cropped level with the top of the ears, the hair below shaved close, lifted off the forehead, and their teeth are blackened from chewing betel. Commoner men are bare-chested. A well-to-do woman's breast-cloth is wrapped around the chest covering both breasts, its two ends thrown back over both shoulders. Commoner houses are small, of woven split-bamboo panels raised on tall bamboo piles, entered by a short bamboo ladder hanging from the doorway by ropes with its foot off the ground. Any children present are bare-chested and wear a small lower cloth; children under eleven have shaved heads with a small topknot of hair left on the crown. Avoid: modern clothing or objects, tourist-poster look, fantasy costume, glossy digital rendering, glamour or model-like faces, makeup, buns or topknots on adult women, long loose hair, bob haircuts, a breast-cloth worn as a one-shoulder diagonal sash, modern Thai costume, shirts on commoner men, tiled roofs or ornate gable finials on commoner houses, ladders leaning on the ground, shorts or shirts on children.

A crowded temple festival: people in new bright lower cloths walking around the temple grounds, in the middle a ring of spectators watching two boxers whose hands are wrapped with cord, a man releasing small birds from a bamboo cage, stalls with food in coconut shells.
```

### scene.lanterns — ลำน้ำเต็มไปด้วยโคมกระดาษลอยตามน้ำยามค่ำ

✅ มีภาพแล้ว · tag: `event:festival.lanterns`

lore: `ritual.floating_lanterns_1680s` (attested, verified)

```
Historical illustration of everyday life in Siam (Ayutthaya kingdom), mid-18th century. Muted earthy watercolor and ink on textured paper, soft natural daylight, restrained palette of ochre, indigo, rust and off-white. Grounded, documentary, ordinary weathered faces without makeup. Unless stated otherwise, Siamese adults of both sexes wear their black hair cropped level with the top of the ears, the hair below shaved close, lifted off the forehead, and their teeth are blackened from chewing betel. Commoner men are bare-chested. A well-to-do woman's breast-cloth is wrapped around the chest covering both breasts, its two ends thrown back over both shoulders. Commoner houses are small, of woven split-bamboo panels raised on tall bamboo piles, entered by a short bamboo ladder hanging from the doorway by ropes with its foot off the ground. Any children present are bare-chested and wear a small lower cloth; children under eleven have shaved heads with a small topknot of hair left on the crown. Avoid: modern clothing or objects, tourist-poster look, fantasy costume, glossy digital rendering, glamour or model-like faces, makeup, buns or topknots on adult women, long loose hair, bob haircuts, a breast-cloth worn as a one-shoulder diagonal sash, modern Thai costume, shirts on commoner men, tiled roofs or ornate gable finials on commoner houses, ladders leaning on the ground, shorts or shirts on children.

Night on a wide river as the floodwater begins to fall: the water covered with many small painted paper lanterns of different sizes floating with the current, their flames reflected, people on the bank and in small boats setting more lanterns on the water.
```

### scene.bathing_elders — ลูกหลานรดน้ำพ่อแม่ในวันเพ็ญเดือนห้า

✅ มีภาพแล้ว · tag: `event:festival.bathing`

lore: `ritual.fifth_month_bathing_1680s` (attested, verified)

```
Historical illustration of everyday life in Siam (Ayutthaya kingdom), mid-18th century. Muted earthy watercolor and ink on textured paper, soft natural daylight, restrained palette of ochre, indigo, rust and off-white. Grounded, documentary, ordinary weathered faces without makeup. Unless stated otherwise, Siamese adults of both sexes wear their black hair cropped level with the top of the ears, the hair below shaved close, lifted off the forehead, and their teeth are blackened from chewing betel. Commoner men are bare-chested. A well-to-do woman's breast-cloth is wrapped around the chest covering both breasts, its two ends thrown back over both shoulders. Commoner houses are small, of woven split-bamboo panels raised on tall bamboo piles, entered by a short bamboo ladder hanging from the doorway by ropes with its foot off the ground. Any children present are bare-chested and wear a small lower cloth; children under eleven have shaved heads with a small topknot of hair left on the crown. Avoid: modern clothing or objects, tourist-poster look, fantasy costume, glossy digital rendering, glamour or model-like faces, makeup, buns or topknots on adult women, long loose hair, bob haircuts, a breast-cloth worn as a one-shoulder diagonal sash, modern Thai costume, shirts on commoner men, tiled roofs or ornate gable finials on commoner houses, ladders leaning on the ground, shorts or shirts on children.

Bright hot-season day in a house yard: an elderly couple seated on a low bench while their grown sons and daughters pour scented water from small bowls over their hands and shoulders, grandchildren in lower cloths waiting with more bowls, flowers floating in the water jar.
```

### scene.ordination — แห่นาคไปวัดพร้อมร่มและดนตรี

✅ มีภาพแล้ว · tag: `event:ritual.ordination`

lore: `ritual.ordination` (inferred, verified), `attire.monks_1680s` (attested)

```
Historical illustration of everyday life in Siam (Ayutthaya kingdom), mid-18th century. Muted earthy watercolor and ink on textured paper, soft natural daylight, restrained palette of ochre, indigo, rust and off-white. Grounded, documentary, ordinary weathered faces without makeup. Unless stated otherwise, Siamese adults of both sexes wear their black hair cropped level with the top of the ears, the hair below shaved close, lifted off the forehead, and their teeth are blackened from chewing betel. Commoner men are bare-chested. A well-to-do woman's breast-cloth is wrapped around the chest covering both breasts, its two ends thrown back over both shoulders. Commoner houses are small, of woven split-bamboo panels raised on tall bamboo piles, entered by a short bamboo ladder hanging from the doorway by ropes with its foot off the ground. Any children present are bare-chested and wear a small lower cloth; children under eleven have shaved heads with a small topknot of hair left on the crown. Avoid: modern clothing or objects, tourist-poster look, fantasy costume, glossy digital rendering, glamour or model-like faces, makeup, buns or topknots on adult women, long loose hair, bob haircuts, a breast-cloth worn as a one-shoulder diagonal sash, modern Thai costume, shirts on commoner men, tiled roofs or ornate gable finials on commoner houses, ladders leaning on the ground, shorts or shirts on children.

A procession toward a temple: a young man of about twenty-one with a shaved head, dressed in white, walking under a tall ceremonial umbrella held by a relative, family members carrying folded yellow robes and an alms bowl, a drummer and a reed-pipe player in front.
```

### scene.topknot — เด็กนั่งให้ผู้ใหญ่ตัดจุก

✅ มีภาพแล้ว · tag: `event:ritual.topknot`

lore: `ritual.topknot_cutting` (inferred, verified), `attire.monks_1680s` (attested)

```
Historical illustration of everyday life in Siam (Ayutthaya kingdom), mid-18th century. Muted earthy watercolor and ink on textured paper, soft natural daylight, restrained palette of ochre, indigo, rust and off-white. Grounded, documentary, ordinary weathered faces without makeup. Unless stated otherwise, Siamese adults of both sexes wear their black hair cropped level with the top of the ears, the hair below shaved close, lifted off the forehead, and their teeth are blackened from chewing betel. Commoner men are bare-chested. A well-to-do woman's breast-cloth is wrapped around the chest covering both breasts, its two ends thrown back over both shoulders. Commoner houses are small, of woven split-bamboo panels raised on tall bamboo piles, entered by a short bamboo ladder hanging from the doorway by ropes with its foot off the ground. Any children present are bare-chested and wear a small lower cloth; children under eleven have shaved heads with a small topknot of hair left on the crown. Avoid: modern clothing or objects, tourist-poster look, fantasy costume, glossy digital rendering, glamour or model-like faces, makeup, buns or topknots on adult women, long loose hair, bob haircuts, a breast-cloth worn as a one-shoulder diagonal sash, modern Thai costume, shirts on commoner men, tiled roofs or ornate gable finials on commoner houses, ladders leaning on the ground, shorts or shirts on children.

Interior of a house: a child of about eleven, bare-chested and wearing a lower cloth, seated on a mat with head bowed, the small topknot on the crown about to be cut by an elderly man with a pair of shears, a monk seated nearby holding a palm-leaf fan, relatives watching with bowls of water and flowers.
```

## ภาพตำนาน (Chronicle)

### legend.battle — ภาพจิตรกรรม: นักรบฟันข้าศึก

🟡 ใช้ภาพชั่วคราว `art/approved/chronicle-legend-warrior.jpg` · tag: `legend:any` `place:battlefield` `situation:combat` `situation:war`

lore: `attire.wat_ko_kaeo_reference` (attested)

```
In the style of an 18th-century Thai temple mural painting: a single unified continuous scene filling the entire frame, flat colors without shading, deep red-brown background, fine dark hand-painted outlines of uneven weight, no Western perspective, stylized figures in profile and three-quarter view, decorative trees, rocks and water patterns naturally framing the composition. Aged mineral pigments, faded and slightly flaking plaster surface. Avoid: 3D shading, photorealism, crisp vector look, modern objects, tiled roofs or curved horn-shaped gable ornaments on commoner houses, zig-zag dividing lines, geometric frame borders, split panels, multiple framed vignettes.

A lone warrior with a sword cutting down several enemy soldiers in a battle scene, celestial beings watching from above with hands joined, decorative trees, rocks and water framing the battlefield.
```

### legend.duel — ภาพจิตรกรรม: สองคนประลองดาบต่อหน้าผู้คน

✅ มีภาพแล้ว · tag: `place:duel_ground`

lore: `attire.wat_ko_kaeo_reference` (attested)

```
In the style of an 18th-century Thai temple mural painting: a single unified continuous scene filling the entire frame, flat colors without shading, deep red-brown background, fine dark hand-painted outlines of uneven weight, no Western perspective, stylized figures in profile and three-quarter view, decorative trees, rocks and water patterns naturally framing the composition. Aged mineral pigments, faded and slightly flaking plaster surface. Avoid: 3D shading, photorealism, crisp vector look, modern objects, tiled roofs or curved horn-shaped gable ornaments on commoner houses, zig-zag dividing lines, geometric frame borders, split panels, multiple framed vignettes.

Two men dueling with swords and shields on an open ground, a crowd of onlookers seated in rows around them, one fighter leaping in a heroic pose, decorative trees and rocks.
```

### legend.court — ภาพจิตรกรรม: ขุนนางหมอบรับความชอบในวัง

✅ มีภาพแล้ว · tag: `place:court`

lore: `attire.wat_ko_kaeo_reference` (attested), `attire.officials_1680s` (attested)

```
In the style of an 18th-century Thai temple mural painting: a single unified continuous scene filling the entire frame, flat colors without shading, deep red-brown background, fine dark hand-painted outlines of uneven weight, no Western perspective, stylized figures in profile and three-quarter view, decorative trees, rocks and water patterns naturally framing the composition. Aged mineral pigments, faded and slightly flaking plaster surface. Avoid: 3D shading, photorealism, crisp vector look, modern objects, tiled roofs or curved horn-shaped gable ornaments on commoner houses, zig-zag dividing lines, geometric frame borders, split panels, multiple framed vignettes.

A palace scene: an official in a tall pointed hat prostrating to receive a reward of cloth and a sword on a tray, other officials kneeling in rows, a pavilion with tiered roofs; the ruler is not shown, only an empty raised seat behind a curtain.
```

### legend.spirit — ภาพจิตรกรรม: ผีบรรพบุรุษคุ้มครองลูกหลาน

✅ มีภาพแล้ว · tag: `supernatural:guardian_spirit` `supernatural:phi`

lore: `attire.wat_ko_kaeo_reference` (attested), `belief.spirits_1680s` (inferred, verified)

```
In the style of an 18th-century Thai temple mural painting: a single unified continuous scene filling the entire frame, flat colors without shading, deep red-brown background, fine dark hand-painted outlines of uneven weight, no Western perspective, stylized figures in profile and three-quarter view, decorative trees, rocks and water patterns naturally framing the composition. Aged mineral pigments, faded and slightly flaking plaster surface. Avoid: 3D shading, photorealism, crisp vector look, modern objects, tiled roofs or curved horn-shaped gable ornaments on commoner houses, zig-zag dividing lines, geometric frame borders, split panels, multiple framed vignettes.

An ancestral spirit drawn as a pale floating figure above a house, shielding a sleeping family below from dark demonic figures at the edge of the scene.
```

### legend.omen — ภาพจิตรกรรม: นิมิตประหลาดบนฟ้า

✅ มีภาพแล้ว · tag: `supernatural:omen`

lore: `attire.wat_ko_kaeo_reference` (attested), `belief.chronicle_omens` (inferred, verified)

```
In the style of an 18th-century Thai temple mural painting: a single unified continuous scene filling the entire frame, flat colors without shading, deep red-brown background, fine dark hand-painted outlines of uneven weight, no Western perspective, stylized figures in profile and three-quarter view, decorative trees, rocks and water patterns naturally framing the composition. Aged mineral pigments, faded and slightly flaking plaster surface. Avoid: 3D shading, photorealism, crisp vector look, modern objects, tiled roofs or curved horn-shaped gable ornaments on commoner houses, zig-zag dividing lines, geometric frame borders, split panels, multiple framed vignettes.

A strange omen in the sky: a comet and a ring around the sun above a town wall, small figures below pointing upward in alarm.
```

## ภาพตัวละคร (Portrait)

### portrait.m.child.commoner — เด็กชายชาวบ้านหัวโกนไว้จุก

✅ มีภาพแล้ว · tag: `sex:m` `age:child` `estate:phrai_luang` `estate:phrai_som` `estate:that`

lore: `ritual.month_old_tham_khwan` (inferred), `ritual.topknot_cutting` (inferred, verified), `attire.commoner_men_1680s` (attested)

```
Historical illustration of everyday life in Siam (Ayutthaya kingdom), mid-18th century. Muted earthy watercolor and ink on textured paper, soft natural daylight, restrained palette of ochre, indigo, rust and off-white. Grounded, documentary, ordinary weathered faces without makeup. Unless stated otherwise, Siamese adults of both sexes wear their black hair cropped level with the top of the ears, the hair below shaved close, lifted off the forehead, and their teeth are blackened from chewing betel. Commoner men are bare-chested. A well-to-do woman's breast-cloth is wrapped around the chest covering both breasts, its two ends thrown back over both shoulders. Commoner houses are small, of woven split-bamboo panels raised on tall bamboo piles, entered by a short bamboo ladder hanging from the doorway by ropes with its foot off the ground. Any children present are bare-chested and wear a small lower cloth; children under eleven have shaved heads with a small topknot of hair left on the crown. Avoid: modern clothing or objects, tourist-poster look, fantasy costume, glossy digital rendering, glamour or model-like faces, makeup, buns or topknots on adult women, long loose hair, bob haircuts, a breast-cloth worn as a one-shoulder diagonal sash, modern Thai costume, shirts on commoner men, tiled roofs or ornate gable finials on commoner houses, ladders leaning on the ground, shorts or shirts on children.

Medium portrait from the waist up: a young Siamese commoner boy of about eight years old with warm olive-brown skin, broad cheekbones, calm dark eyes, and a straight nose; shaved head with a small topknot left on the crown, bare-chested, no shirt, wearing a plain knee-length woven cotton lower cloth, standing in a bamboo yard.
```

### portrait.m.child.noble — เด็กชายลูกขุนนางหัวโกนไว้จุก สวมกำไลทอง

✅ มีภาพแล้ว · tag: `sex:m` `age:child` `estate:noble` `estate:merchant` `estate:royal`

lore: `attire.children_1680s` (attested), `ritual.topknot_cutting` (inferred, verified), `attire.indian_chintz_royal` (inferred)

```
Historical illustration of everyday life in Siam (Ayutthaya kingdom), mid-18th century. Muted earthy watercolor and ink on textured paper, soft natural daylight, restrained palette of ochre, indigo, rust and off-white. Grounded, documentary, ordinary weathered faces without makeup. Unless stated otherwise, Siamese adults of both sexes wear their black hair cropped level with the top of the ears, the hair below shaved close, lifted off the forehead, and their teeth are blackened from chewing betel. Commoner men are bare-chested. A well-to-do woman's breast-cloth is wrapped around the chest covering both breasts, its two ends thrown back over both shoulders. Commoner houses are small, of woven split-bamboo panels raised on tall bamboo piles, entered by a short bamboo ladder hanging from the doorway by ropes with its foot off the ground. Any children present are bare-chested and wear a small lower cloth; children under eleven have shaved heads with a small topknot of hair left on the crown. Avoid: modern clothing or objects, tourist-poster look, fantasy costume, glossy digital rendering, glamour or model-like faces, makeup, buns or topknots on adult women, long loose hair, bob haircuts, a breast-cloth worn as a one-shoulder diagonal sash, modern Thai costume, shirts on commoner men, tiled roofs or ornate gable finials on commoner houses, ladders leaning on the ground, shorts or shirts on children.

Medium portrait from the waist up: a young well-born Siamese boy of about eight years old with warm olive-brown skin, broad cheekbones, calm dark eyes, and a straight nose; shaved head with a neat topknot on the crown fastened with a small gold pin, bare-chested, no shirt, wearing gold bracelets at the wrists and a patterned Indian chintz lower cloth, on the timber veranda of a house.
```

### portrait.m.youth.commoner — ชายหนุ่มชาวบ้านเปลือยท่อนบน นุ่งผ้าโจง

✅ มีภาพแล้ว · tag: `sex:m` `age:youth` `estate:phrai_luang` `estate:phrai_som` `estate:that`

lore: `attire.commoner_men_1680s` (attested), `attire.hair_1680s` (attested)

```
Historical illustration of everyday life in Siam (Ayutthaya kingdom), mid-18th century. Muted earthy watercolor and ink on textured paper, soft natural daylight, restrained palette of ochre, indigo, rust and off-white. Grounded, documentary, ordinary weathered faces without makeup. Unless stated otherwise, Siamese adults of both sexes wear their black hair cropped level with the top of the ears, the hair below shaved close, lifted off the forehead, and their teeth are blackened from chewing betel. Commoner men are bare-chested. A well-to-do woman's breast-cloth is wrapped around the chest covering both breasts, its two ends thrown back over both shoulders. Commoner houses are small, of woven split-bamboo panels raised on tall bamboo piles, entered by a short bamboo ladder hanging from the doorway by ropes with its foot off the ground. Any children present are bare-chested and wear a small lower cloth; children under eleven have shaved heads with a small topknot of hair left on the crown. Avoid: modern clothing or objects, tourist-poster look, fantasy costume, glossy digital rendering, glamour or model-like faces, makeup, buns or topknots on adult women, long loose hair, bob haircuts, a breast-cloth worn as a one-shoulder diagonal sash, modern Thai costume, shirts on commoner men, tiled roofs or ornate gable finials on commoner houses, ladders leaning on the ground, shorts or shirts on children.

Medium portrait from the waist up: a Siamese commoner young man of about eighteen with warm olive-brown skin, broad cheekbones, calm dark eyes, straight nose, and a slightly square jaw; black hair cropped level with the top of the ears and shaved close below, bare-chested, no shirt, wearing a knee-length painted-cotton lower cloth, standing beside a bamboo fence.
```

### portrait.m.youth.noble — ชายหนุ่มลูกขุนนางในเรือนไม้

✅ มีภาพแล้ว · tag: `sex:m` `age:youth` `estate:noble` `estate:merchant`

lore: `attire.hair_1680s` (attested), `attire.indian_chintz_royal` (inferred)

```
Historical illustration of everyday life in Siam (Ayutthaya kingdom), mid-18th century. Muted earthy watercolor and ink on textured paper, soft natural daylight, restrained palette of ochre, indigo, rust and off-white. Grounded, documentary, ordinary weathered faces without makeup. Unless stated otherwise, Siamese adults of both sexes wear their black hair cropped level with the top of the ears, the hair below shaved close, lifted off the forehead, and their teeth are blackened from chewing betel. Commoner men are bare-chested. A well-to-do woman's breast-cloth is wrapped around the chest covering both breasts, its two ends thrown back over both shoulders. Commoner houses are small, of woven split-bamboo panels raised on tall bamboo piles, entered by a short bamboo ladder hanging from the doorway by ropes with its foot off the ground. Any children present are bare-chested and wear a small lower cloth; children under eleven have shaved heads with a small topknot of hair left on the crown. Avoid: modern clothing or objects, tourist-poster look, fantasy costume, glossy digital rendering, glamour or model-like faces, makeup, buns or topknots on adult women, long loose hair, bob haircuts, a breast-cloth worn as a one-shoulder diagonal sash, modern Thai costume, shirts on commoner men, tiled roofs or ornate gable finials on commoner houses, ladders leaning on the ground, shorts or shirts on children.

Medium portrait from the waist up: a well-born Siamese young man of about eighteen years old with warm olive-brown skin, broad cheekbones, calm dark eyes, straight nose, and a slightly square jaw; black hair cropped level with the top of the ears and shaved close below, bare-chested, no shirt, wearing a fine patterned Indian chintz lower cloth with a betel pouch at the waist, seated on a reed mat inside a timber house.
```

### portrait.m.youth.page — มหาดเล็กหนุ่มสวมเสื้อมัสลินขาวผ่าหน้า หมอบรับใช้ในวัง

✅ มีภาพแล้ว · tag: `sex:m` `age:youth` `age:adult` `estate:noble` `role:page`

lore: `social.royal_pages_1680s` (inferred, verified), `attire.officials_1680s` (attested), `attire.hair_1680s` (attested)

```
Historical illustration of everyday life in Siam (Ayutthaya kingdom), mid-18th century. Muted earthy watercolor and ink on textured paper, soft natural daylight, restrained palette of ochre, indigo, rust and off-white. Grounded, documentary, ordinary weathered faces without makeup. Unless stated otherwise, Siamese adults of both sexes wear their black hair cropped level with the top of the ears, the hair below shaved close, lifted off the forehead, and their teeth are blackened from chewing betel. Commoner men are bare-chested. A well-to-do woman's breast-cloth is wrapped around the chest covering both breasts, its two ends thrown back over both shoulders. Commoner houses are small, of woven split-bamboo panels raised on tall bamboo piles, entered by a short bamboo ladder hanging from the doorway by ropes with its foot off the ground. Any children present are bare-chested and wear a small lower cloth; children under eleven have shaved heads with a small topknot of hair left on the crown. Avoid: modern clothing or objects, tourist-poster look, fantasy costume, glossy digital rendering, glamour or model-like faces, makeup, buns or topknots on adult women, long loose hair, bob haircuts, a breast-cloth worn as a one-shoulder diagonal sash, modern Thai costume, shirts on commoner men, tiled roofs or ornate gable finials on commoner houses, ladders leaning on the ground, shorts or shirts on children.

Medium portrait: a young Siamese royal page of about nineteen with warm olive-brown skin, broad cheekbones, calm dark eyes, straight nose, and a slightly square jaw; black hair cropped level with the top of the ears and shaved close below, bare-headed without a hat, wearing an open-front collarless white muslin over-shirt with wide long sleeves over a patterned silk lower cloth, kneeling respectfully beside a lacquered betel box in a palace pavilion.
```

### portrait.m.youth.monk — พระภิกษุหนุ่มครองจีวรเหลือง

✅ มีภาพแล้ว · tag: `sex:m` `age:youth` `age:adult` `estate:monk` `role:monk`

lore: `attire.monks_1680s` (attested), `ritual.ordination` (inferred, verified)

```
Historical illustration of everyday life in Siam (Ayutthaya kingdom), mid-18th century. Muted earthy watercolor and ink on textured paper, soft natural daylight, restrained palette of ochre, indigo, rust and off-white. Grounded, documentary, ordinary weathered faces without makeup. Unless stated otherwise, Siamese adults of both sexes wear their black hair cropped level with the top of the ears, the hair below shaved close, lifted off the forehead, and their teeth are blackened from chewing betel. Commoner men are bare-chested. A well-to-do woman's breast-cloth is wrapped around the chest covering both breasts, its two ends thrown back over both shoulders. Commoner houses are small, of woven split-bamboo panels raised on tall bamboo piles, entered by a short bamboo ladder hanging from the doorway by ropes with its foot off the ground. Any children present are bare-chested and wear a small lower cloth; children under eleven have shaved heads with a small topknot of hair left on the crown. Avoid: modern clothing or objects, tourist-poster look, fantasy costume, glossy digital rendering, glamour or model-like faces, makeup, buns or topknots on adult women, long loose hair, bob haircuts, a breast-cloth worn as a one-shoulder diagonal sash, modern Thai costume, shirts on commoner men, tiled roofs or ornate gable finials on commoner houses, ladders leaning on the ground, shorts or shirts on children.

Medium portrait from the waist up: a young Siamese Buddhist monk in his early twenties with warm olive-brown skin, broad cheekbones, calm dark eyes, straight nose, and a slightly square jaw; completely shaved head and shaved eyebrows, wearing a patched ochre-yellow robe leaving the right shoulder bare and a yellow waist sash, holding an iron alms bowl in a cloth sling inside a quiet monastery hall.
```

### portrait.m.adult.commoner — ชายผู้ใหญ่ชาวบ้านเปลือยท่อนบน นุ่งผ้าโจง

✅ มีภาพแล้ว · tag: `sex:m` `age:adult` `estate:phrai_luang` `estate:phrai_som` `estate:that`

lore: `attire.commoner_men_1680s` (attested), `attire.hair_1680s` (attested)

```
Historical illustration of everyday life in Siam (Ayutthaya kingdom), mid-18th century. Muted earthy watercolor and ink on textured paper, soft natural daylight, restrained palette of ochre, indigo, rust and off-white. Grounded, documentary, ordinary weathered faces without makeup. Unless stated otherwise, Siamese adults of both sexes wear their black hair cropped level with the top of the ears, the hair below shaved close, lifted off the forehead, and their teeth are blackened from chewing betel. Commoner men are bare-chested. A well-to-do woman's breast-cloth is wrapped around the chest covering both breasts, its two ends thrown back over both shoulders. Commoner houses are small, of woven split-bamboo panels raised on tall bamboo piles, entered by a short bamboo ladder hanging from the doorway by ropes with its foot off the ground. Any children present are bare-chested and wear a small lower cloth; children under eleven have shaved heads with a small topknot of hair left on the crown. Avoid: modern clothing or objects, tourist-poster look, fantasy costume, glossy digital rendering, glamour or model-like faces, makeup, buns or topknots on adult women, long loose hair, bob haircuts, a breast-cloth worn as a one-shoulder diagonal sash, modern Thai costume, shirts on commoner men, tiled roofs or ornate gable finials on commoner houses, ladders leaning on the ground, shorts or shirts on children.

Medium portrait from the waist up: a Siamese commoner man in his thirties with a sun-weathered face, warm olive-brown skin, broad cheekbones, calm dark eyes, straight nose, and a slightly square jaw, teeth blackened from chewing betel; black hair cropped level with the top of the ears and shaved close below, bare-chested, no shirt, wearing a knee-length cotton lower cloth tucked at the back, standing in front of a bamboo stilt house.
```

### portrait.m.adult.noble — ชายผู้ใหญ่เจ้าเรือนผู้มีฐานะ นั่งข้างเชี่ยนหมาก

✅ มีภาพแล้ว · tag: `sex:m` `age:adult` `estate:noble` `estate:merchant`

lore: `attire.hair_1680s` (attested), `attire.indian_chintz_royal` (inferred), `material.household_objects_1680s` (attested)

```
Historical illustration of everyday life in Siam (Ayutthaya kingdom), mid-18th century. Muted earthy watercolor and ink on textured paper, soft natural daylight, restrained palette of ochre, indigo, rust and off-white. Grounded, documentary, ordinary weathered faces without makeup. Unless stated otherwise, Siamese adults of both sexes wear their black hair cropped level with the top of the ears, the hair below shaved close, lifted off the forehead, and their teeth are blackened from chewing betel. Commoner men are bare-chested. A well-to-do woman's breast-cloth is wrapped around the chest covering both breasts, its two ends thrown back over both shoulders. Commoner houses are small, of woven split-bamboo panels raised on tall bamboo piles, entered by a short bamboo ladder hanging from the doorway by ropes with its foot off the ground. Any children present are bare-chested and wear a small lower cloth; children under eleven have shaved heads with a small topknot of hair left on the crown. Avoid: modern clothing or objects, tourist-poster look, fantasy costume, glossy digital rendering, glamour or model-like faces, makeup, buns or topknots on adult women, long loose hair, bob haircuts, a breast-cloth worn as a one-shoulder diagonal sash, modern Thai costume, shirts on commoner men, tiled roofs or ornate gable finials on commoner houses, ladders leaning on the ground, shorts or shirts on children.

Medium portrait: a well-to-do Siamese household head in his thirties with warm olive-brown skin, broad cheekbones, calm dark eyes, straight nose, and a slightly square jaw, teeth blackened from chewing betel; black hair cropped level with the top of the ears and shaved close below, bare-chested, no shirt, wearing a fine patterned silk lower cloth, seated cross-legged on a reed mat beside a lacquered betel box inside a timber house.
```

### portrait.m.adult.official_patrol — ขุนนางกรมกองกระเวนสวมเสื้อมัสลินและลอมพอก

✅ มีภาพแล้ว · tag: `sex:m` `age:adult` `estate:noble` `role:official` `role:official_patrol`

lore: `attire.officials_1680s` (attested), `social.patrol_department_ladder` (attested, verified)

```
Historical illustration of everyday life in Siam (Ayutthaya kingdom), mid-18th century. Muted earthy watercolor and ink on textured paper, soft natural daylight, restrained palette of ochre, indigo, rust and off-white. Grounded, documentary, ordinary weathered faces without makeup. Unless stated otherwise, Siamese adults of both sexes wear their black hair cropped level with the top of the ears, the hair below shaved close, lifted off the forehead, and their teeth are blackened from chewing betel. Commoner men are bare-chested. A well-to-do woman's breast-cloth is wrapped around the chest covering both breasts, its two ends thrown back over both shoulders. Commoner houses are small, of woven split-bamboo panels raised on tall bamboo piles, entered by a short bamboo ladder hanging from the doorway by ropes with its foot off the ground. Any children present are bare-chested and wear a small lower cloth; children under eleven have shaved heads with a small topknot of hair left on the crown. Avoid: modern clothing or objects, tourist-poster look, fantasy costume, glossy digital rendering, glamour or model-like faces, makeup, buns or topknots on adult women, long loose hair, bob haircuts, a breast-cloth worn as a one-shoulder diagonal sash, modern Thai costume, shirts on commoner men, tiled roofs or ornate gable finials on commoner houses, ladders leaning on the ground, shorts or shirts on children.

Medium portrait: a Siamese patrol-department official in his thirties with warm olive-brown skin, broad cheekbones, calm dark eyes, straight nose, and a slightly square jaw; wearing an open-front collarless white muslin over-shirt with wide sleeves over a patterned silk lower cloth, and a tall brimless white conical cloth hat (lomphok) with thin gold bands near the base and a chin cord; a sheathed sword resting on a stand beside him inside a timber hall. Avoid: hat brim, wide-brimmed hat.
```

### portrait.m.adult.official_palace — ขุนนางกรมชาวที่สวมลอมพอก ข้างพานเครื่องทอง

✅ มีภาพแล้ว · tag: `sex:m` `age:adult` `estate:noble` `role:official` `role:official_palace`

lore: `attire.officials_1680s` (attested), `social.royal_chamber_department_ladder` (attested, verified)

```
Historical illustration of everyday life in Siam (Ayutthaya kingdom), mid-18th century. Muted earthy watercolor and ink on textured paper, soft natural daylight, restrained palette of ochre, indigo, rust and off-white. Grounded, documentary, ordinary weathered faces without makeup. Unless stated otherwise, Siamese adults of both sexes wear their black hair cropped level with the top of the ears, the hair below shaved close, lifted off the forehead, and their teeth are blackened from chewing betel. Commoner men are bare-chested. A well-to-do woman's breast-cloth is wrapped around the chest covering both breasts, its two ends thrown back over both shoulders. Commoner houses are small, of woven split-bamboo panels raised on tall bamboo piles, entered by a short bamboo ladder hanging from the doorway by ropes with its foot off the ground. Any children present are bare-chested and wear a small lower cloth; children under eleven have shaved heads with a small topknot of hair left on the crown. Avoid: modern clothing or objects, tourist-poster look, fantasy costume, glossy digital rendering, glamour or model-like faces, makeup, buns or topknots on adult women, long loose hair, bob haircuts, a breast-cloth worn as a one-shoulder diagonal sash, modern Thai costume, shirts on commoner men, tiled roofs or ornate gable finials on commoner houses, ladders leaning on the ground, shorts or shirts on children.

Medium portrait: a Siamese palace-chamber official in his thirties with warm olive-brown skin, broad cheekbones, calm dark eyes, straight nose, and a slightly square jaw; seated cross-legged on a reed mat in a palace hall, wearing an open-front collarless white muslin over-shirt with wide sleeves over a rich patterned silk lower cloth, and a tall brimless white conical cloth hat (lomphok) with gold bands and chin cord, a footed brass tray and betel box beside him. Avoid: hat brim, wide-brimmed hat.
```

### portrait.m.adult.official_scholar — ขุนนางกรมราชบัณฑิตยสวมลอมพอก ข้างสมุดไทยดำ

✅ มีภาพแล้ว · tag: `sex:m` `age:adult` `estate:noble` `role:official` `role:official_scholar`

lore: `attire.officials_1680s` (attested), `social.royal_scholars_department_ladder` (attested, verified)

```
Historical illustration of everyday life in Siam (Ayutthaya kingdom), mid-18th century. Muted earthy watercolor and ink on textured paper, soft natural daylight, restrained palette of ochre, indigo, rust and off-white. Grounded, documentary, ordinary weathered faces without makeup. Unless stated otherwise, Siamese adults of both sexes wear their black hair cropped level with the top of the ears, the hair below shaved close, lifted off the forehead, and their teeth are blackened from chewing betel. Commoner men are bare-chested. A well-to-do woman's breast-cloth is wrapped around the chest covering both breasts, its two ends thrown back over both shoulders. Commoner houses are small, of woven split-bamboo panels raised on tall bamboo piles, entered by a short bamboo ladder hanging from the doorway by ropes with its foot off the ground. Any children present are bare-chested and wear a small lower cloth; children under eleven have shaved heads with a small topknot of hair left on the crown. Avoid: modern clothing or objects, tourist-poster look, fantasy costume, glossy digital rendering, glamour or model-like faces, makeup, buns or topknots on adult women, long loose hair, bob haircuts, a breast-cloth worn as a one-shoulder diagonal sash, modern Thai costume, shirts on commoner men, tiled roofs or ornate gable finials on commoner houses, ladders leaning on the ground, shorts or shirts on children.

Medium portrait: a Siamese royal-scholar official in his thirties with warm olive-brown skin, broad cheekbones, calm dark eyes, straight nose, and a slightly square jaw; seated cross-legged on a reed mat, wearing an open-front collarless white muslin over-shirt with wide sleeves over a silk lower cloth, and a tall brimless white conical cloth hat (lomphok) with gold bands and chin cord, an accordion-folded black khoi-paper manuscript (samut thai dam) and white steatite stylus on a low tray before him. Avoid: hat brim, wide-brimmed hat.
```

### portrait.m.elder.commoner — ชายชราชาวบ้านผมหงอก เปลือยท่อนบน

✅ มีภาพแล้ว · tag: `sex:m` `age:elder` `estate:phrai_luang` `estate:phrai_som` `estate:that`

lore: `attire.commoner_men_1680s` (attested), `attire.hair_1680s` (attested)

```
Historical illustration of everyday life in Siam (Ayutthaya kingdom), mid-18th century. Muted earthy watercolor and ink on textured paper, soft natural daylight, restrained palette of ochre, indigo, rust and off-white. Grounded, documentary, ordinary weathered faces without makeup. Unless stated otherwise, Siamese adults of both sexes wear their black hair cropped level with the top of the ears, the hair below shaved close, lifted off the forehead, and their teeth are blackened from chewing betel. Commoner men are bare-chested. A well-to-do woman's breast-cloth is wrapped around the chest covering both breasts, its two ends thrown back over both shoulders. Commoner houses are small, of woven split-bamboo panels raised on tall bamboo piles, entered by a short bamboo ladder hanging from the doorway by ropes with its foot off the ground. Any children present are bare-chested and wear a small lower cloth; children under eleven have shaved heads with a small topknot of hair left on the crown. Avoid: modern clothing or objects, tourist-poster look, fantasy costume, glossy digital rendering, glamour or model-like faces, makeup, buns or topknots on adult women, long loose hair, bob haircuts, a breast-cloth worn as a one-shoulder diagonal sash, modern Thai costume, shirts on commoner men, tiled roofs or ornate gable finials on commoner houses, ladders leaning on the ground, shorts or shirts on children.

Medium portrait from the waist up: an elderly Siamese commoner man in his sixties with a deeply lined weathered face, warm olive-brown skin, broad cheekbones, calm dark eyes, straight nose, and a slightly square jaw, teeth blackened from chewing betel; grey hair cropped level with the top of the ears and shaved close below, bare-chested, no shirt, wearing a plain cotton lower cloth, seated on the veranda of a bamboo stilt house.
```

### portrait.m.elder.noble — ชายชราเจ้าเรือนผู้มีฐานะ ผมหงอก นั่งข้างเชี่ยนหมาก

✅ มีภาพแล้ว · tag: `sex:m` `age:elder` `estate:noble` `estate:merchant`

lore: `attire.hair_1680s` (attested), `material.household_objects_1680s` (attested)

```
Historical illustration of everyday life in Siam (Ayutthaya kingdom), mid-18th century. Muted earthy watercolor and ink on textured paper, soft natural daylight, restrained palette of ochre, indigo, rust and off-white. Grounded, documentary, ordinary weathered faces without makeup. Unless stated otherwise, Siamese adults of both sexes wear their black hair cropped level with the top of the ears, the hair below shaved close, lifted off the forehead, and their teeth are blackened from chewing betel. Commoner men are bare-chested. A well-to-do woman's breast-cloth is wrapped around the chest covering both breasts, its two ends thrown back over both shoulders. Commoner houses are small, of woven split-bamboo panels raised on tall bamboo piles, entered by a short bamboo ladder hanging from the doorway by ropes with its foot off the ground. Any children present are bare-chested and wear a small lower cloth; children under eleven have shaved heads with a small topknot of hair left on the crown. Avoid: modern clothing or objects, tourist-poster look, fantasy costume, glossy digital rendering, glamour or model-like faces, makeup, buns or topknots on adult women, long loose hair, bob haircuts, a breast-cloth worn as a one-shoulder diagonal sash, modern Thai costume, shirts on commoner men, tiled roofs or ornate gable finials on commoner houses, ladders leaning on the ground, shorts or shirts on children.

Medium portrait: an elderly well-to-do Siamese household patriarch in his sixties with a lined dignified face, warm olive-brown skin, broad cheekbones, calm dark eyes, straight nose, and a slightly square jaw, teeth blackened from chewing betel; grey hair cropped level with the top of the ears and shaved close below, bare-chested, no shirt, wearing a fine patterned silk lower cloth, seated on a reed mat beside a lacquered betel set inside a timber house.
```

### portrait.m.elder.official — ขุนนางอาวุโสวัยชราสวมเสื้อมัสลินและลอมพอก

✅ มีภาพแล้ว · tag: `sex:m` `age:elder` `estate:noble` `role:official` `role:official_patrol` `role:official_palace` `role:official_scholar`

lore: `attire.officials_1680s` (attested), `attire.hair_1680s` (attested)

```
Historical illustration of everyday life in Siam (Ayutthaya kingdom), mid-18th century. Muted earthy watercolor and ink on textured paper, soft natural daylight, restrained palette of ochre, indigo, rust and off-white. Grounded, documentary, ordinary weathered faces without makeup. Unless stated otherwise, Siamese adults of both sexes wear their black hair cropped level with the top of the ears, the hair below shaved close, lifted off the forehead, and their teeth are blackened from chewing betel. Commoner men are bare-chested. A well-to-do woman's breast-cloth is wrapped around the chest covering both breasts, its two ends thrown back over both shoulders. Commoner houses are small, of woven split-bamboo panels raised on tall bamboo piles, entered by a short bamboo ladder hanging from the doorway by ropes with its foot off the ground. Any children present are bare-chested and wear a small lower cloth; children under eleven have shaved heads with a small topknot of hair left on the crown. Avoid: modern clothing or objects, tourist-poster look, fantasy costume, glossy digital rendering, glamour or model-like faces, makeup, buns or topknots on adult women, long loose hair, bob haircuts, a breast-cloth worn as a one-shoulder diagonal sash, modern Thai costume, shirts on commoner men, tiled roofs or ornate gable finials on commoner houses, ladders leaning on the ground, shorts or shirts on children.

Medium portrait: an elderly senior Siamese official in his sixties with a deeply lined face, warm olive-brown skin, broad cheekbones, calm dark eyes, straight nose, and a slightly square jaw, grey hair visible beneath a tall brimless white conical cloth hat (lomphok) with gold bands near the base and a chin cord; wearing an open-front collarless white muslin over-shirt with wide sleeves over a patterned silk lower cloth, seated on a reed mat inside a timber hall. Avoid: hat brim, wide-brimmed hat.
```

### portrait.m.elder.monk — พระเถระชราครองจีวรเหลือง ถือตาลปัตร

✅ มีภาพแล้ว · tag: `sex:m` `age:elder` `estate:monk` `role:monk`

lore: `attire.monks_1680s` (attested)

```
Historical illustration of everyday life in Siam (Ayutthaya kingdom), mid-18th century. Muted earthy watercolor and ink on textured paper, soft natural daylight, restrained palette of ochre, indigo, rust and off-white. Grounded, documentary, ordinary weathered faces without makeup. Unless stated otherwise, Siamese adults of both sexes wear their black hair cropped level with the top of the ears, the hair below shaved close, lifted off the forehead, and their teeth are blackened from chewing betel. Commoner men are bare-chested. A well-to-do woman's breast-cloth is wrapped around the chest covering both breasts, its two ends thrown back over both shoulders. Commoner houses are small, of woven split-bamboo panels raised on tall bamboo piles, entered by a short bamboo ladder hanging from the doorway by ropes with its foot off the ground. Any children present are bare-chested and wear a small lower cloth; children under eleven have shaved heads with a small topknot of hair left on the crown. Avoid: modern clothing or objects, tourist-poster look, fantasy costume, glossy digital rendering, glamour or model-like faces, makeup, buns or topknots on adult women, long loose hair, bob haircuts, a breast-cloth worn as a one-shoulder diagonal sash, modern Thai costume, shirts on commoner men, tiled roofs or ornate gable finials on commoner houses, ladders leaning on the ground, shorts or shirts on children.

Medium portrait: an elderly Siamese Buddhist monk in his sixties with a serene deeply lined face, warm olive-brown skin, broad cheekbones, calm dark eyes, and a straight nose; completely shaved head and shaved eyebrows, wearing a patched ochre-yellow robe leaving the right shoulder bare, seated on a mat holding a palm-leaf fan inside a temple hall.
```

### portrait.f.child.commoner — เด็กหญิงชาวบ้านหัวโกนไว้จุก

✅ มีภาพแล้ว · tag: `sex:f` `age:child` `estate:phrai_luang` `estate:phrai_som` `estate:that`

lore: `ritual.month_old_tham_khwan` (inferred), `ritual.topknot_cutting` (inferred, verified), `attire.children_1680s` (attested)

```
Historical illustration of everyday life in Siam (Ayutthaya kingdom), mid-18th century. Muted earthy watercolor and ink on textured paper, soft natural daylight, restrained palette of ochre, indigo, rust and off-white. Grounded, documentary, ordinary weathered faces without makeup. Unless stated otherwise, Siamese adults of both sexes wear their black hair cropped level with the top of the ears, the hair below shaved close, lifted off the forehead, and their teeth are blackened from chewing betel. Commoner men are bare-chested. A well-to-do woman's breast-cloth is wrapped around the chest covering both breasts, its two ends thrown back over both shoulders. Commoner houses are small, of woven split-bamboo panels raised on tall bamboo piles, entered by a short bamboo ladder hanging from the doorway by ropes with its foot off the ground. Any children present are bare-chested and wear a small lower cloth; children under eleven have shaved heads with a small topknot of hair left on the crown. Avoid: modern clothing or objects, tourist-poster look, fantasy costume, glossy digital rendering, glamour or model-like faces, makeup, buns or topknots on adult women, long loose hair, bob haircuts, a breast-cloth worn as a one-shoulder diagonal sash, modern Thai costume, shirts on commoner men, tiled roofs or ornate gable finials on commoner houses, ladders leaning on the ground, shorts or shirts on children.

Medium portrait from the waist up: a young Siamese commoner girl of about eight years old with warm olive-brown skin, gentle oval face, high cheekbones, and calm dark eyes; shaved head with a small topknot of hair left on the crown, bare-chested, wearing a plain woven cotton wrap skirt at the waist, standing in a house yard.
```

### portrait.f.child.noble — เด็กหญิงลูกขุนนางหัวโกนไว้จุก สวมกำไลและต่างหูทอง

✅ มีภาพแล้ว · tag: `sex:f` `age:child` `estate:noble` `estate:merchant` `estate:royal`

lore: `attire.children_1680s` (attested), `ritual.topknot_cutting` (inferred, verified), `attire.women_1680s` (attested)

```
Historical illustration of everyday life in Siam (Ayutthaya kingdom), mid-18th century. Muted earthy watercolor and ink on textured paper, soft natural daylight, restrained palette of ochre, indigo, rust and off-white. Grounded, documentary, ordinary weathered faces without makeup. Unless stated otherwise, Siamese adults of both sexes wear their black hair cropped level with the top of the ears, the hair below shaved close, lifted off the forehead, and their teeth are blackened from chewing betel. Commoner men are bare-chested. A well-to-do woman's breast-cloth is wrapped around the chest covering both breasts, its two ends thrown back over both shoulders. Commoner houses are small, of woven split-bamboo panels raised on tall bamboo piles, entered by a short bamboo ladder hanging from the doorway by ropes with its foot off the ground. Any children present are bare-chested and wear a small lower cloth; children under eleven have shaved heads with a small topknot of hair left on the crown. Avoid: modern clothing or objects, tourist-poster look, fantasy costume, glossy digital rendering, glamour or model-like faces, makeup, buns or topknots on adult women, long loose hair, bob haircuts, a breast-cloth worn as a one-shoulder diagonal sash, modern Thai costume, shirts on commoner men, tiled roofs or ornate gable finials on commoner houses, ladders leaning on the ground, shorts or shirts on children.

Medium portrait from the waist up: a young well-born Siamese girl of about eight years old with warm olive-brown skin, gentle oval face, high cheekbones, and calm dark eyes; shaved head with a neat topknot on the crown adorned with a small flower garland and gold pin, small gold earrings and gold wrist bangles, bare-chested, wearing a patterned silk wrap skirt at the waist, on a timber veranda.
```

### portrait.f.youth.commoner — หญิงสาวชาวบ้านตัดผมสั้นระดับใบหู

✅ มีภาพแล้ว · tag: `sex:f` `age:youth` `estate:phrai_luang` `estate:phrai_som` `estate:that`

lore: `attire.women_1680s` (attested), `attire.hair_1680s` (attested)

```
Historical illustration of everyday life in Siam (Ayutthaya kingdom), mid-18th century. Muted earthy watercolor and ink on textured paper, soft natural daylight, restrained palette of ochre, indigo, rust and off-white. Grounded, documentary, ordinary weathered faces without makeup. Unless stated otherwise, Siamese adults of both sexes wear their black hair cropped level with the top of the ears, the hair below shaved close, lifted off the forehead, and their teeth are blackened from chewing betel. Commoner men are bare-chested. A well-to-do woman's breast-cloth is wrapped around the chest covering both breasts, its two ends thrown back over both shoulders. Commoner houses are small, of woven split-bamboo panels raised on tall bamboo piles, entered by a short bamboo ladder hanging from the doorway by ropes with its foot off the ground. Any children present are bare-chested and wear a small lower cloth; children under eleven have shaved heads with a small topknot of hair left on the crown. Avoid: modern clothing or objects, tourist-poster look, fantasy costume, glossy digital rendering, glamour or model-like faces, makeup, buns or topknots on adult women, long loose hair, bob haircuts, a breast-cloth worn as a one-shoulder diagonal sash, modern Thai costume, shirts on commoner men, tiled roofs or ornate gable finials on commoner houses, ladders leaning on the ground, shorts or shirts on children.

Portrait cropped from the upper shoulders up in three-quarter view: a young Siamese village woman of about eighteen with warm olive-brown skin, gentle oval face, high cheekbones, and calm dark eyes; black hair cropped level with the top of the ears, shaved close below and combed up off the forehead; soft daylight against a woven bamboo wall.
```

### portrait.f.youth.noble — หญิงสาวตระกูลขุนนางห่มผ้าขาวพาดสองไหล่

✅ มีภาพแล้ว · tag: `sex:f` `age:youth` `estate:noble` `estate:merchant`

lore: `attire.women_1680s` (attested), `attire.hair_1680s` (attested)

```
Historical illustration of everyday life in Siam (Ayutthaya kingdom), mid-18th century. Muted earthy watercolor and ink on textured paper, soft natural daylight, restrained palette of ochre, indigo, rust and off-white. Grounded, documentary, ordinary weathered faces without makeup. Unless stated otherwise, Siamese adults of both sexes wear their black hair cropped level with the top of the ears, the hair below shaved close, lifted off the forehead, and their teeth are blackened from chewing betel. Commoner men are bare-chested. A well-to-do woman's breast-cloth is wrapped around the chest covering both breasts, its two ends thrown back over both shoulders. Commoner houses are small, of woven split-bamboo panels raised on tall bamboo piles, entered by a short bamboo ladder hanging from the doorway by ropes with its foot off the ground. Any children present are bare-chested and wear a small lower cloth; children under eleven have shaved heads with a small topknot of hair left on the crown. Avoid: modern clothing or objects, tourist-poster look, fantasy costume, glossy digital rendering, glamour or model-like faces, makeup, buns or topknots on adult women, long loose hair, bob haircuts, a breast-cloth worn as a one-shoulder diagonal sash, modern Thai costume, shirts on commoner men, tiled roofs or ornate gable finials on commoner houses, ladders leaning on the ground, shorts or shirts on children.

Medium portrait: a young well-to-do Siamese woman of about eighteen with warm olive-brown skin, gentle oval face, high cheekbones, and calm dark eyes; black hair cropped level with the top of the ears and lifted off the forehead, wearing a black wrap skirt and a single white muslin breast-cloth wrapped horizontally around her chest covering both breasts with its two ends thrown back over both shoulders, pear-shaped gold earrings, seated on a mat in a timber house. Avoid: one-shoulder diagonal sash.
```

### portrait.f.adult.commoner — หญิงผู้ใหญ่ชาวบ้านตัดผมสั้น ฟันดำจากหมาก

✅ มีภาพแล้ว · tag: `sex:f` `age:adult` `estate:phrai_luang` `estate:phrai_som` `estate:that`

lore: `attire.women_1680s` (attested), `attire.hair_1680s` (attested)

```
Historical illustration of everyday life in Siam (Ayutthaya kingdom), mid-18th century. Muted earthy watercolor and ink on textured paper, soft natural daylight, restrained palette of ochre, indigo, rust and off-white. Grounded, documentary, ordinary weathered faces without makeup. Unless stated otherwise, Siamese adults of both sexes wear their black hair cropped level with the top of the ears, the hair below shaved close, lifted off the forehead, and their teeth are blackened from chewing betel. Commoner men are bare-chested. A well-to-do woman's breast-cloth is wrapped around the chest covering both breasts, its two ends thrown back over both shoulders. Commoner houses are small, of woven split-bamboo panels raised on tall bamboo piles, entered by a short bamboo ladder hanging from the doorway by ropes with its foot off the ground. Any children present are bare-chested and wear a small lower cloth; children under eleven have shaved heads with a small topknot of hair left on the crown. Avoid: modern clothing or objects, tourist-poster look, fantasy costume, glossy digital rendering, glamour or model-like faces, makeup, buns or topknots on adult women, long loose hair, bob haircuts, a breast-cloth worn as a one-shoulder diagonal sash, modern Thai costume, shirts on commoner men, tiled roofs or ornate gable finials on commoner houses, ladders leaning on the ground, shorts or shirts on children.

Portrait cropped from the upper shoulders up in three-quarter view: an adult Siamese commoner woman in her thirties with warm olive-brown skin, gentle oval face, high cheekbones, calm dark eyes, and a faint smile showing teeth blackened from chewing betel; black hair cropped level with the top of the ears and lifted off the forehead; bamboo house background.
```

### portrait.f.adult.noble — ภรรยาเอกขุนนางห่มผ้าขาวพาดสองไหล่ นั่งข้างเชี่ยนหมาก

✅ มีภาพแล้ว · tag: `sex:f` `age:adult` `estate:noble` `estate:merchant`

lore: `attire.women_1680s` (attested), `attire.hair_1680s` (attested)

```
Historical illustration of everyday life in Siam (Ayutthaya kingdom), mid-18th century. Muted earthy watercolor and ink on textured paper, soft natural daylight, restrained palette of ochre, indigo, rust and off-white. Grounded, documentary, ordinary weathered faces without makeup. Unless stated otherwise, Siamese adults of both sexes wear their black hair cropped level with the top of the ears, the hair below shaved close, lifted off the forehead, and their teeth are blackened from chewing betel. Commoner men are bare-chested. A well-to-do woman's breast-cloth is wrapped around the chest covering both breasts, its two ends thrown back over both shoulders. Commoner houses are small, of woven split-bamboo panels raised on tall bamboo piles, entered by a short bamboo ladder hanging from the doorway by ropes with its foot off the ground. Any children present are bare-chested and wear a small lower cloth; children under eleven have shaved heads with a small topknot of hair left on the crown. Avoid: modern clothing or objects, tourist-poster look, fantasy costume, glossy digital rendering, glamour or model-like faces, makeup, buns or topknots on adult women, long loose hair, bob haircuts, a breast-cloth worn as a one-shoulder diagonal sash, modern Thai costume, shirts on commoner men, tiled roofs or ornate gable finials on commoner houses, ladders leaning on the ground, shorts or shirts on children.

Medium portrait: a well-to-do Siamese noble wife in her thirties with warm olive-brown skin, gentle oval face, high cheekbones, calm dark eyes, and teeth blackened from chewing betel; black hair cropped level with the top of the ears and lifted off the forehead, wearing a black wrap skirt and a single white muslin breast-cloth wrapped around her chest covering both breasts with its two loose ends draped back over both shoulders, pear-shaped gold earrings and gold rings on her last three fingers, a lacquered betel box beside her. Avoid: one-shoulder diagonal sash.
```

### portrait.f.adult.minor_wife — เมียกลางนอกห่มผ้าพาดสองไหล่ นั่งพับเพียบสำรวม

✅ มีภาพแล้ว · tag: `sex:f` `age:youth` `age:adult` `estate:noble` `estate:phrai_luang` `estate:phrai_som` `role:minor_wife`

lore: `attire.women_1680s` (attested), `attire.hair_1680s` (attested)

```
Historical illustration of everyday life in Siam (Ayutthaya kingdom), mid-18th century. Muted earthy watercolor and ink on textured paper, soft natural daylight, restrained palette of ochre, indigo, rust and off-white. Grounded, documentary, ordinary weathered faces without makeup. Unless stated otherwise, Siamese adults of both sexes wear their black hair cropped level with the top of the ears, the hair below shaved close, lifted off the forehead, and their teeth are blackened from chewing betel. Commoner men are bare-chested. A well-to-do woman's breast-cloth is wrapped around the chest covering both breasts, its two ends thrown back over both shoulders. Commoner houses are small, of woven split-bamboo panels raised on tall bamboo piles, entered by a short bamboo ladder hanging from the doorway by ropes with its foot off the ground. Any children present are bare-chested and wear a small lower cloth; children under eleven have shaved heads with a small topknot of hair left on the crown. Avoid: modern clothing or objects, tourist-poster look, fantasy costume, glossy digital rendering, glamour or model-like faces, makeup, buns or topknots on adult women, long loose hair, bob haircuts, a breast-cloth worn as a one-shoulder diagonal sash, modern Thai costume, shirts on commoner men, tiled roofs or ornate gable finials on commoner houses, ladders leaning on the ground, shorts or shirts on children.

Medium portrait: a young Siamese minor wife in her twenties with warm olive-brown skin, gentle oval face, high cheekbones, and calm dark eyes; black hair cropped level with the top of the ears and lifted off the forehead, seated modestly on a reed mat with legs folded to one side in a small bamboo-and-timber house, wearing a dark wrap skirt and a soft off-white cotton breast-cloth wrapped around her chest covering both breasts with both ends thrown back over both shoulders, small gold earrings. Avoid: one-shoulder diagonal sash.
```

### portrait.f.adult.head — เจ้าเรือนหญิงผู้นำตระกูล นั่งข้างหีบไม้และเชี่ยนหมาก

✅ มีภาพแล้ว · tag: `sex:f` `age:adult` `estate:noble` `estate:merchant` `role:household_head`

lore: `attire.women_1680s` (attested), `attire.hair_1680s` (attested), `material.household_objects_1680s` (attested)

```
Historical illustration of everyday life in Siam (Ayutthaya kingdom), mid-18th century. Muted earthy watercolor and ink on textured paper, soft natural daylight, restrained palette of ochre, indigo, rust and off-white. Grounded, documentary, ordinary weathered faces without makeup. Unless stated otherwise, Siamese adults of both sexes wear their black hair cropped level with the top of the ears, the hair below shaved close, lifted off the forehead, and their teeth are blackened from chewing betel. Commoner men are bare-chested. A well-to-do woman's breast-cloth is wrapped around the chest covering both breasts, its two ends thrown back over both shoulders. Commoner houses are small, of woven split-bamboo panels raised on tall bamboo piles, entered by a short bamboo ladder hanging from the doorway by ropes with its foot off the ground. Any children present are bare-chested and wear a small lower cloth; children under eleven have shaved heads with a small topknot of hair left on the crown. Avoid: modern clothing or objects, tourist-poster look, fantasy costume, glossy digital rendering, glamour or model-like faces, makeup, buns or topknots on adult women, long loose hair, bob haircuts, a breast-cloth worn as a one-shoulder diagonal sash, modern Thai costume, shirts on commoner men, tiled roofs or ornate gable finials on commoner houses, ladders leaning on the ground, shorts or shirts on children.

Medium portrait: a dignified Siamese female household head in her thirties with warm olive-brown skin, gentle oval face, high cheekbones, calm dark eyes, and teeth blackened from chewing betel; black hair cropped level with the top of the ears, wearing a fine black wrap skirt and a white muslin breast-cloth wrapped around her chest covering both breasts with both ends draped over both shoulders, pear-shaped gold earrings and gold finger rings, seated upright beside a wooden chest and betel set inside a timber house. Avoid: one-shoulder diagonal sash.
```

### portrait.f.elder.commoner — หญิงชราชาวบ้านผมหงอก ฟันดำ

✅ มีภาพแล้ว · tag: `sex:f` `age:elder` `estate:phrai_luang` `estate:phrai_som` `estate:that`

lore: `attire.hair_1680s` (attested), `attire.women_1680s` (attested)

```
Historical illustration of everyday life in Siam (Ayutthaya kingdom), mid-18th century. Muted earthy watercolor and ink on textured paper, soft natural daylight, restrained palette of ochre, indigo, rust and off-white. Grounded, documentary, ordinary weathered faces without makeup. Unless stated otherwise, Siamese adults of both sexes wear their black hair cropped level with the top of the ears, the hair below shaved close, lifted off the forehead, and their teeth are blackened from chewing betel. Commoner men are bare-chested. A well-to-do woman's breast-cloth is wrapped around the chest covering both breasts, its two ends thrown back over both shoulders. Commoner houses are small, of woven split-bamboo panels raised on tall bamboo piles, entered by a short bamboo ladder hanging from the doorway by ropes with its foot off the ground. Any children present are bare-chested and wear a small lower cloth; children under eleven have shaved heads with a small topknot of hair left on the crown. Avoid: modern clothing or objects, tourist-poster look, fantasy costume, glossy digital rendering, glamour or model-like faces, makeup, buns or topknots on adult women, long loose hair, bob haircuts, a breast-cloth worn as a one-shoulder diagonal sash, modern Thai costume, shirts on commoner men, tiled roofs or ornate gable finials on commoner houses, ladders leaning on the ground, shorts or shirts on children.

Portrait from the shoulders up: an elderly Siamese village woman in her sixties with a deeply lined sun-weathered oval face, warm olive-brown skin, high cheekbones, calm dark eyes, grey hair cropped level with the top of the ears and lifted off the forehead, smiling slightly to show teeth blackened from chewing betel; plain background of a bamboo wall.
```

### portrait.f.elder.noble — แม่เฒ่าเจ้าเรือนผู้ดี ผมหงอก ห่มผ้าขาวพาดสองไหล่

✅ มีภาพแล้ว · tag: `sex:f` `age:elder` `estate:noble` `estate:merchant`

lore: `attire.women_1680s` (attested), `attire.hair_1680s` (attested)

```
Historical illustration of everyday life in Siam (Ayutthaya kingdom), mid-18th century. Muted earthy watercolor and ink on textured paper, soft natural daylight, restrained palette of ochre, indigo, rust and off-white. Grounded, documentary, ordinary weathered faces without makeup. Unless stated otherwise, Siamese adults of both sexes wear their black hair cropped level with the top of the ears, the hair below shaved close, lifted off the forehead, and their teeth are blackened from chewing betel. Commoner men are bare-chested. A well-to-do woman's breast-cloth is wrapped around the chest covering both breasts, its two ends thrown back over both shoulders. Commoner houses are small, of woven split-bamboo panels raised on tall bamboo piles, entered by a short bamboo ladder hanging from the doorway by ropes with its foot off the ground. Any children present are bare-chested and wear a small lower cloth; children under eleven have shaved heads with a small topknot of hair left on the crown. Avoid: modern clothing or objects, tourist-poster look, fantasy costume, glossy digital rendering, glamour or model-like faces, makeup, buns or topknots on adult women, long loose hair, bob haircuts, a breast-cloth worn as a one-shoulder diagonal sash, modern Thai costume, shirts on commoner men, tiled roofs or ornate gable finials on commoner houses, ladders leaning on the ground, shorts or shirts on children.

Medium portrait: an elderly well-to-do Siamese matriarch in her sixties with a lined dignified oval face, warm olive-brown skin, high cheekbones, calm dark eyes, grey hair cropped level with the top of the ears and lifted off the forehead, teeth blackened from chewing betel; wearing a black wrap skirt, a white muslin breast-cloth wrapped around her chest covering both breasts with both ends thrown back over both shoulders, and gold pear-shaped earrings, seated on a reed mat inside a timber house. Avoid: one-shoulder diagonal sash.
```

### portrait.f.pregnant.commoner — หญิงชาวบ้านกำลังตั้งครรภ์

✅ มีภาพแล้ว · tag: `sex:f` `age:youth` `age:adult` `estate:phrai_luang` `estate:phrai_som` `estate:that` `role:pregnant`

lore: `attire.women_1680s` (attested), `attire.hair_1680s` (attested), `ritual.yu_fai_placenta` (inferred)

```
Historical illustration of everyday life in Siam (Ayutthaya kingdom), mid-18th century. Muted earthy watercolor and ink on textured paper, soft natural daylight, restrained palette of ochre, indigo, rust and off-white. Grounded, documentary, ordinary weathered faces without makeup. Unless stated otherwise, Siamese adults of both sexes wear their black hair cropped level with the top of the ears, the hair below shaved close, lifted off the forehead, and their teeth are blackened from chewing betel. Commoner men are bare-chested. A well-to-do woman's breast-cloth is wrapped around the chest covering both breasts, its two ends thrown back over both shoulders. Commoner houses are small, of woven split-bamboo panels raised on tall bamboo piles, entered by a short bamboo ladder hanging from the doorway by ropes with its foot off the ground. Any children present are bare-chested and wear a small lower cloth; children under eleven have shaved heads with a small topknot of hair left on the crown. Avoid: modern clothing or objects, tourist-poster look, fantasy costume, glossy digital rendering, glamour or model-like faces, makeup, buns or topknots on adult women, long loose hair, bob haircuts, a breast-cloth worn as a one-shoulder diagonal sash, modern Thai costume, shirts on commoner men, tiled roofs or ornate gable finials on commoner houses, ladders leaning on the ground, shorts or shirts on children.

Medium portrait in three-quarter profile: a visibly pregnant Siamese village woman in her twenties with warm olive-brown skin, gentle oval face, high cheekbones, and calm dark eyes; black hair cropped level with the top of the ears and lifted off the forehead, wearing a plain cotton breast-cloth wrapped horizontally across the chest and a woven wrap skirt over her rounded pregnant belly, one hand resting gently on her abdomen, standing on the veranda of a bamboo stilt house. Avoid: one-shoulder diagonal sash.
```

### portrait.f.pregnant.noble — หญิงตระกูลขุนนางกำลังตั้งครรภ์ ห่มผ้าขาวพาดสองไหล่

✅ มีภาพแล้ว · tag: `sex:f` `age:youth` `age:adult` `estate:noble` `estate:merchant` `role:pregnant`

lore: `attire.women_1680s` (attested), `attire.hair_1680s` (attested), `ritual.yu_fai_placenta` (inferred)

```
Historical illustration of everyday life in Siam (Ayutthaya kingdom), mid-18th century. Muted earthy watercolor and ink on textured paper, soft natural daylight, restrained palette of ochre, indigo, rust and off-white. Grounded, documentary, ordinary weathered faces without makeup. Unless stated otherwise, Siamese adults of both sexes wear their black hair cropped level with the top of the ears, the hair below shaved close, lifted off the forehead, and their teeth are blackened from chewing betel. Commoner men are bare-chested. A well-to-do woman's breast-cloth is wrapped around the chest covering both breasts, its two ends thrown back over both shoulders. Commoner houses are small, of woven split-bamboo panels raised on tall bamboo piles, entered by a short bamboo ladder hanging from the doorway by ropes with its foot off the ground. Any children present are bare-chested and wear a small lower cloth; children under eleven have shaved heads with a small topknot of hair left on the crown. Avoid: modern clothing or objects, tourist-poster look, fantasy costume, glossy digital rendering, glamour or model-like faces, makeup, buns or topknots on adult women, long loose hair, bob haircuts, a breast-cloth worn as a one-shoulder diagonal sash, modern Thai costume, shirts on commoner men, tiled roofs or ornate gable finials on commoner houses, ladders leaning on the ground, shorts or shirts on children.

Medium portrait: a visibly pregnant well-to-do Siamese woman in her twenties with warm olive-brown skin, gentle oval face, high cheekbones, and calm dark eyes; black hair cropped level with the top of the ears and lifted off the forehead, wearing a black wrap skirt over her rounded pregnant belly and a single white muslin breast-cloth wrapped horizontally around her chest covering both breasts with its two ends thrown back over both shoulders, pear-shaped gold earrings, seated on a reed mat with one hand resting gently on her abdomen inside a timber house. Avoid: one-shoulder diagonal sash.
```
