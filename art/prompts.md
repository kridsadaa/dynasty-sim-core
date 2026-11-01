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

Wide view of a small Siamese commoner house: walls, floor and roof of woven split-bamboo panels, raised about four metres on six tall bamboo piles because of floods, reached by a hanging bamboo ladder; a bamboo fence around the yard; river behind, rainy-season sky. No people in the foreground.
```

### baseline.meal_tray

แทน `art/approved/reality-meal-tray.jpg` — สร้างด้วย style block v0.2 — รอบ 01 ได้ปลาทั้งตัว (lore: อาหารหั่นเป็นชิ้นมาแล้ว)

lore: `material.food_1680s` (attested), `material.household_objects_1680s` (attested)

```
Historical illustration of everyday life in Siam (Ayutthaya kingdom), mid-18th century. Muted earthy watercolor and ink on textured paper, soft natural daylight, restrained palette of ochre, indigo, rust and off-white. Grounded, documentary, ordinary weathered faces without makeup. Unless stated otherwise, Siamese adults of both sexes wear their black hair cropped level with the top of the ears, the hair below shaved close, lifted off the forehead, and their teeth are blackened from chewing betel. Commoner men are bare-chested. A well-to-do woman's breast-cloth is wrapped around the chest covering both breasts, its two ends thrown back over both shoulders. Commoner houses are small, of woven split-bamboo panels raised on tall bamboo piles, entered by a short bamboo ladder hanging from the doorway by ropes with its foot off the ground. Any children present are bare-chested and wear a small lower cloth; children under eleven have shaved heads with a small topknot of hair left on the crown. Avoid: modern clothing or objects, tourist-poster look, fantasy costume, glossy digital rendering, glamour or model-like faces, makeup, buns or topknots on adult women, long loose hair, bob haircuts, a breast-cloth worn as a one-shoulder diagonal sash, modern Thai costume, shirts on commoner men, tiled roofs or ornate gable finials on commoner houses, ladders leaning on the ground, shorts or shirts on children.

Top-down still life on a reed mat: a round footless lacquered wooden tray holding a mound of rice, dried salted fish already cut into small pieces, a small bowl of fermented shrimp paste with garlic, spring onions and fresh herbs, coconut-shell and earthenware bowls, a bamboo water tube; no whole fish, no spoons, forks or chopsticks.
```

## ภาพฉาก (Reality)

### scene.compound — เรือนไม้ของขุนนางผู้น้อยกับเรือนเล็กในรั้วไผ่

⬜ ยังไม่มีภาพ · tag: `group:family` `event:family.legend_truth` `place:domestic`

lore: `material.houses_1680s` (attested, verified), `material.household_objects_1680s` (attested)

```
Historical illustration of everyday life in Siam (Ayutthaya kingdom), mid-18th century. Muted earthy watercolor and ink on textured paper, soft natural daylight, restrained palette of ochre, indigo, rust and off-white. Grounded, documentary, ordinary weathered faces without makeup. Unless stated otherwise, Siamese adults of both sexes wear their black hair cropped level with the top of the ears, the hair below shaved close, lifted off the forehead, and their teeth are blackened from chewing betel. Commoner men are bare-chested. A well-to-do woman's breast-cloth is wrapped around the chest covering both breasts, its two ends thrown back over both shoulders. Commoner houses are small, of woven split-bamboo panels raised on tall bamboo piles, entered by a short bamboo ladder hanging from the doorway by ropes with its foot off the ground. Any children present are bare-chested and wear a small lower cloth; children under eleven have shaved heads with a small topknot of hair left on the crown. Avoid: modern clothing or objects, tourist-poster look, fantasy costume, glossy digital rendering, glamour or model-like faces, makeup, buns or topknots on adult women, long loose hair, bob haircuts, a breast-cloth worn as a one-shoulder diagonal sash, modern Thai costume, shirts on commoner men, tiled roofs or ornate gable finials on commoner houses, ladders leaning on the ground, shorts or shirts on children.

Wide view of a minor Siamese official's household compound: a single-storey house of real timber planks raised on wooden posts, with two smaller woven-bamboo houses for wives and household slaves inside the same bamboo fence; a packed-earth yard with a jar of water by the ladder, an elderly woman seated on the veranda, a child playing below; canal behind, morning light.
```

### scene.village — เรือนไผ่ยกสูงของชาวบ้านริมน้ำ

🟡 ใช้ภาพชั่วคราว `art/approved/reality-stilt-house.jpg` · tag: `group:intent` `event:intent.befriend.done` `event:intent.befriend.failed` `event:intent.befriend.mischief` `event:intent.called_home`

lore: `material.houses_1680s` (attested, verified)

```
Historical illustration of everyday life in Siam (Ayutthaya kingdom), mid-18th century. Muted earthy watercolor and ink on textured paper, soft natural daylight, restrained palette of ochre, indigo, rust and off-white. Grounded, documentary, ordinary weathered faces without makeup. Unless stated otherwise, Siamese adults of both sexes wear their black hair cropped level with the top of the ears, the hair below shaved close, lifted off the forehead, and their teeth are blackened from chewing betel. Commoner men are bare-chested. A well-to-do woman's breast-cloth is wrapped around the chest covering both breasts, its two ends thrown back over both shoulders. Commoner houses are small, of woven split-bamboo panels raised on tall bamboo piles, entered by a short bamboo ladder hanging from the doorway by ropes with its foot off the ground. Any children present are bare-chested and wear a small lower cloth; children under eleven have shaved heads with a small topknot of hair left on the crown. Avoid: modern clothing or objects, tourist-poster look, fantasy costume, glossy digital rendering, glamour or model-like faces, makeup, buns or topknots on adult women, long loose hair, bob haircuts, a breast-cloth worn as a one-shoulder diagonal sash, modern Thai costume, shirts on commoner men, tiled roofs or ornate gable finials on commoner houses, ladders leaning on the ground, shorts or shirts on children.

Wide view of a small Siamese commoner house: walls, floor and roof of woven split-bamboo panels, raised about four metres on six tall bamboo piles because of floods, reached by a hanging bamboo ladder; a bamboo fence around the yard; river behind, rainy-season sky. No people in the foreground.
```

### scene.kitchen_yard — ลานครัวหลังเรือน มีเตาไฟกองเล็กและข้าวของทำครัว

⬜ ยังไม่มีภาพ · tag: `place:kitchen` `situation:kitchen_work` `group:chore` `group:childhood` `event:childhood.kitchen_cut` `event:chore.learn` `event:chore.learn_chop`

lore: `material.houses_1680s` (attested, verified), `material.kitchen_tasks` (inferred, verified), `material.food_1680s` (attested)

```
Historical illustration of everyday life in Siam (Ayutthaya kingdom), mid-18th century. Muted earthy watercolor and ink on textured paper, soft natural daylight, restrained palette of ochre, indigo, rust and off-white. Grounded, documentary, ordinary weathered faces without makeup. Unless stated otherwise, Siamese adults of both sexes wear their black hair cropped level with the top of the ears, the hair below shaved close, lifted off the forehead, and their teeth are blackened from chewing betel. Commoner men are bare-chested. A well-to-do woman's breast-cloth is wrapped around the chest covering both breasts, its two ends thrown back over both shoulders. Commoner houses are small, of woven split-bamboo panels raised on tall bamboo piles, entered by a short bamboo ladder hanging from the doorway by ropes with its foot off the ground. Any children present are bare-chested and wear a small lower cloth; children under eleven have shaved heads with a small topknot of hair left on the crown. Avoid: modern clothing or objects, tourist-poster look, fantasy costume, glossy digital rendering, glamour or model-like faces, makeup, buns or topknots on adult women, long loose hair, bob haircuts, a breast-cloth worn as a one-shoulder diagonal sash, modern Thai costume, shirts on commoner men, tiled roofs or ornate gable finials on commoner houses, ladders leaning on the ground, shorts or shirts on children.

Medium-wide view of an outdoor kitchen in a house yard seen from the side: a small wood fire on the ground with an earthenware pot, a grating board and split coconuts, garlic and shallots on a flat basket, dried fish hanging from a pole, bamboo water tubes; a woman squatting by the fire with her back half turned, a child in a lower cloth watching; stilt house behind.
```

### scene.meal — สำรับข้าวกับปลาแห้งบนถาดไม่มีขา

🟡 ใช้ภาพชั่วคราว `art/approved/reality-meal-tray.jpg` · tag: `situation:feast`

lore: `material.food_1680s` (attested), `material.household_objects_1680s` (attested)

```
Historical illustration of everyday life in Siam (Ayutthaya kingdom), mid-18th century. Muted earthy watercolor and ink on textured paper, soft natural daylight, restrained palette of ochre, indigo, rust and off-white. Grounded, documentary, ordinary weathered faces without makeup. Unless stated otherwise, Siamese adults of both sexes wear their black hair cropped level with the top of the ears, the hair below shaved close, lifted off the forehead, and their teeth are blackened from chewing betel. Commoner men are bare-chested. A well-to-do woman's breast-cloth is wrapped around the chest covering both breasts, its two ends thrown back over both shoulders. Commoner houses are small, of woven split-bamboo panels raised on tall bamboo piles, entered by a short bamboo ladder hanging from the doorway by ropes with its foot off the ground. Any children present are bare-chested and wear a small lower cloth; children under eleven have shaved heads with a small topknot of hair left on the crown. Avoid: modern clothing or objects, tourist-poster look, fantasy costume, glossy digital rendering, glamour or model-like faces, makeup, buns or topknots on adult women, long loose hair, bob haircuts, a breast-cloth worn as a one-shoulder diagonal sash, modern Thai costume, shirts on commoner men, tiled roofs or ornate gable finials on commoner houses, ladders leaning on the ground, shorts or shirts on children.

Top-down still life on a reed mat: a round footless lacquered wooden tray holding a mound of rice, dried salted fish already cut into small pieces, a small bowl of fermented shrimp paste with garlic, spring onions and fresh herbs, coconut-shell and earthenware bowls, a bamboo water tube; no whole fish, no spoons, forks or chopsticks.
```

### scene.court_feast — แขกนั่งล้อมถาดอาหารบนเสื่อในงานเลี้ยงของขุนนาง

⬜ ยังไม่มีภาพ · tag: `event:adult.court_feast`

lore: `material.household_objects_1680s` (attested), `material.food_1680s` (attested)

```
Historical illustration of everyday life in Siam (Ayutthaya kingdom), mid-18th century. Muted earthy watercolor and ink on textured paper, soft natural daylight, restrained palette of ochre, indigo, rust and off-white. Grounded, documentary, ordinary weathered faces without makeup. Unless stated otherwise, Siamese adults of both sexes wear their black hair cropped level with the top of the ears, the hair below shaved close, lifted off the forehead, and their teeth are blackened from chewing betel. Commoner men are bare-chested. A well-to-do woman's breast-cloth is wrapped around the chest covering both breasts, its two ends thrown back over both shoulders. Commoner houses are small, of woven split-bamboo panels raised on tall bamboo piles, entered by a short bamboo ladder hanging from the doorway by ropes with its foot off the ground. Any children present are bare-chested and wear a small lower cloth; children under eleven have shaved heads with a small topknot of hair left on the crown. Avoid: modern clothing or objects, tourist-poster look, fantasy costume, glossy digital rendering, glamour or model-like faces, makeup, buns or topknots on adult women, long loose hair, bob haircuts, a breast-cloth worn as a one-shoulder diagonal sash, modern Thai costume, shirts on commoner men, tiled roofs or ornate gable finials on commoner houses, ladders leaning on the ground, shorts or shirts on children.

Medium-wide view inside a timber house during a household feast: adult men seated cross-legged on reed mats in small groups around round footless trays of rice and dishes, lacquered betel boxes beside them, eating with their right hands, a servant kneeling to bring a water jar; lamplight in the evening.
```

### scene.newborn — แม่ลูกอ่อนนอนอยู่ไฟ ทารกนอนบนเสื่อข้างตัว

⬜ ยังไม่มีภาพ · tag: `event:family.newborn` `event:family.grandchild_naming` `situation:childbirth`

lore: `ritual.yu_fai_placenta` (inferred)

```
Historical illustration of everyday life in Siam (Ayutthaya kingdom), mid-18th century. Muted earthy watercolor and ink on textured paper, soft natural daylight, restrained palette of ochre, indigo, rust and off-white. Grounded, documentary, ordinary weathered faces without makeup. Unless stated otherwise, Siamese adults of both sexes wear their black hair cropped level with the top of the ears, the hair below shaved close, lifted off the forehead, and their teeth are blackened from chewing betel. Commoner men are bare-chested. A well-to-do woman's breast-cloth is wrapped around the chest covering both breasts, its two ends thrown back over both shoulders. Commoner houses are small, of woven split-bamboo panels raised on tall bamboo piles, entered by a short bamboo ladder hanging from the doorway by ropes with its foot off the ground. Any children present are bare-chested and wear a small lower cloth; children under eleven have shaved heads with a small topknot of hair left on the crown. Avoid: modern clothing or objects, tourist-poster look, fantasy costume, glossy digital rendering, glamour or model-like faces, makeup, buns or topknots on adult women, long loose hair, bob haircuts, a breast-cloth worn as a one-shoulder diagonal sash, modern Thai costume, shirts on commoner men, tiled roofs or ornate gable finials on commoner houses, ladders leaning on the ground, shorts or shirts on children.

Interior of a house at dusk: a young mother wrapped in a lower cloth and a shawl lying on a reed mat beside a low glowing fire, a swaddled newborn on a cloth beside her, an older woman fanning the fire with a woven fan; seen from the side at a respectful distance.
```

### scene.sickbed — ผู้เฒ่านอนป่วยบนเสื่อ ลูกนั่งเฝ้าข้างกาย

⬜ ยังไม่มีภาพ · tag: `event:family.parent_illness` `event:family.hard_to_raise` `situation:illness`

lore: `material.household_objects_1680s` (attested)

```
Historical illustration of everyday life in Siam (Ayutthaya kingdom), mid-18th century. Muted earthy watercolor and ink on textured paper, soft natural daylight, restrained palette of ochre, indigo, rust and off-white. Grounded, documentary, ordinary weathered faces without makeup. Unless stated otherwise, Siamese adults of both sexes wear their black hair cropped level with the top of the ears, the hair below shaved close, lifted off the forehead, and their teeth are blackened from chewing betel. Commoner men are bare-chested. A well-to-do woman's breast-cloth is wrapped around the chest covering both breasts, its two ends thrown back over both shoulders. Commoner houses are small, of woven split-bamboo panels raised on tall bamboo piles, entered by a short bamboo ladder hanging from the doorway by ropes with its foot off the ground. Any children present are bare-chested and wear a small lower cloth; children under eleven have shaved heads with a small topknot of hair left on the crown. Avoid: modern clothing or objects, tourist-poster look, fantasy costume, glossy digital rendering, glamour or model-like faces, makeup, buns or topknots on adult women, long loose hair, bob haircuts, a breast-cloth worn as a one-shoulder diagonal sash, modern Thai costume, shirts on commoner men, tiled roofs or ornate gable finials on commoner houses, ladders leaning on the ground, shorts or shirts on children.

Interior of a house in dim daylight: an old man lying ill on a reed mat under a thin cotton cloth, a grown son kneeling beside him holding an earthenware bowl of herbal medicine, a bundle of dried roots and leaves on a tray; quiet, worried mood.
```

### scene.funeral_home — ศพห่อผ้าขาวในเรือน ญาตินั่งล้อม พระสวด

⬜ ยังไม่มีภาพ · tag: `event:family.death` `event:family.death_bad`

lore: `ritual.funeral_cremation` (inferred, verified), `attire.monks_1680s` (attested)

```
Historical illustration of everyday life in Siam (Ayutthaya kingdom), mid-18th century. Muted earthy watercolor and ink on textured paper, soft natural daylight, restrained palette of ochre, indigo, rust and off-white. Grounded, documentary, ordinary weathered faces without makeup. Unless stated otherwise, Siamese adults of both sexes wear their black hair cropped level with the top of the ears, the hair below shaved close, lifted off the forehead, and their teeth are blackened from chewing betel. Commoner men are bare-chested. A well-to-do woman's breast-cloth is wrapped around the chest covering both breasts, its two ends thrown back over both shoulders. Commoner houses are small, of woven split-bamboo panels raised on tall bamboo piles, entered by a short bamboo ladder hanging from the doorway by ropes with its foot off the ground. Any children present are bare-chested and wear a small lower cloth; children under eleven have shaved heads with a small topknot of hair left on the crown. Avoid: modern clothing or objects, tourist-poster look, fantasy costume, glossy digital rendering, glamour or model-like faces, makeup, buns or topknots on adult women, long loose hair, bob haircuts, a breast-cloth worn as a one-shoulder diagonal sash, modern Thai costume, shirts on commoner men, tiled roofs or ornate gable finials on commoner houses, ladders leaning on the ground, shorts or shirts on children.

Interior of a house: a body wrapped entirely in white cloth lying on a mat, only the outline visible, relatives seated on the floor around it with heads bowed, three monks in yellow patched robes seated in a row holding palm-leaf fans in front of their faces while chanting, candles burning; sombre evening light. No visible face or wound on the body.
```

### scene.betrothal — ผู้ใหญ่สองฝ่ายนั่งเจรจาสู่ขอ มีพานหมากอยู่ตรงกลาง

⬜ ยังไม่มีภาพ · tag: `group:marriage` `event:family.arranged_match` `event:intent.court.accepted_formal` `event:marriage.refused` `event:marriage.milk_claim`

lore: `kinship.betrothal_khanmak_three_seals` (attested, verified), `material.household_objects_1680s` (attested)

```
Historical illustration of everyday life in Siam (Ayutthaya kingdom), mid-18th century. Muted earthy watercolor and ink on textured paper, soft natural daylight, restrained palette of ochre, indigo, rust and off-white. Grounded, documentary, ordinary weathered faces without makeup. Unless stated otherwise, Siamese adults of both sexes wear their black hair cropped level with the top of the ears, the hair below shaved close, lifted off the forehead, and their teeth are blackened from chewing betel. Commoner men are bare-chested. A well-to-do woman's breast-cloth is wrapped around the chest covering both breasts, its two ends thrown back over both shoulders. Commoner houses are small, of woven split-bamboo panels raised on tall bamboo piles, entered by a short bamboo ladder hanging from the doorway by ropes with its foot off the ground. Any children present are bare-chested and wear a small lower cloth; children under eleven have shaved heads with a small topknot of hair left on the crown. Avoid: modern clothing or objects, tourist-poster look, fantasy costume, glossy digital rendering, glamour or model-like faces, makeup, buns or topknots on adult women, long loose hair, bob haircuts, a breast-cloth worn as a one-shoulder diagonal sash, modern Thai costume, shirts on commoner men, tiled roofs or ornate gable finials on commoner houses, ladders leaning on the ground, shorts or shirts on children.

Interior of a timber house: two groups of middle-aged adults seated on reed mats facing each other, between them three bowls of betel nut and betel leaves on footed trays, the elders talking seriously; a young woman half-hidden behind a doorway listening.
```

### scene.wedding — ขบวนขันหมากเดินไปเรือนเจ้าสาว

⬜ ยังไม่มีภาพ · tag: `event:marriage.wedding` `event:marriage.minor_wife`

lore: `kinship.betrothal_khanmak_three_seals` (attested, verified), `material.houses_1680s` (attested, verified)

```
Historical illustration of everyday life in Siam (Ayutthaya kingdom), mid-18th century. Muted earthy watercolor and ink on textured paper, soft natural daylight, restrained palette of ochre, indigo, rust and off-white. Grounded, documentary, ordinary weathered faces without makeup. Unless stated otherwise, Siamese adults of both sexes wear their black hair cropped level with the top of the ears, the hair below shaved close, lifted off the forehead, and their teeth are blackened from chewing betel. Commoner men are bare-chested. A well-to-do woman's breast-cloth is wrapped around the chest covering both breasts, its two ends thrown back over both shoulders. Commoner houses are small, of woven split-bamboo panels raised on tall bamboo piles, entered by a short bamboo ladder hanging from the doorway by ropes with its foot off the ground. Any children present are bare-chested and wear a small lower cloth; children under eleven have shaved heads with a small topknot of hair left on the crown. Avoid: modern clothing or objects, tourist-poster look, fantasy costume, glossy digital rendering, glamour or model-like faces, makeup, buns or topknots on adult women, long loose hair, bob haircuts, a breast-cloth worn as a one-shoulder diagonal sash, modern Thai costume, shirts on commoner men, tiled roofs or ornate gable finials on commoner houses, ladders leaning on the ground, shorts or shirts on children.

Wide view of a small procession walking along a path beside a canal toward a stilt house: men and women carrying bowls of betel nut, bananas and sugar cane on footed trays, a young man in a clean lower cloth among them, a drum and a reed pipe; relatives waiting at the top of the ladder; bright morning.
```

### scene.courtship — หนุ่มสาวคุยกันที่ท่าน้ำ ฝ่ายหญิงถือหม้อน้ำ

⬜ ยังไม่มีภาพ · tag: `event:intent.court.trial` `event:intent.court.gossip` `event:intent.court.accepted` `event:intent.court.rejected` `event:marriage.divorce`

lore: `kinship.courtship_liberty_1680s` (attested, verified), `attire.women_1680s` (attested)

```
Historical illustration of everyday life in Siam (Ayutthaya kingdom), mid-18th century. Muted earthy watercolor and ink on textured paper, soft natural daylight, restrained palette of ochre, indigo, rust and off-white. Grounded, documentary, ordinary weathered faces without makeup. Unless stated otherwise, Siamese adults of both sexes wear their black hair cropped level with the top of the ears, the hair below shaved close, lifted off the forehead, and their teeth are blackened from chewing betel. Commoner men are bare-chested. A well-to-do woman's breast-cloth is wrapped around the chest covering both breasts, its two ends thrown back over both shoulders. Commoner houses are small, of woven split-bamboo panels raised on tall bamboo piles, entered by a short bamboo ladder hanging from the doorway by ropes with its foot off the ground. Any children present are bare-chested and wear a small lower cloth; children under eleven have shaved heads with a small topknot of hair left on the crown. Avoid: modern clothing or objects, tourist-poster look, fantasy costume, glossy digital rendering, glamour or model-like faces, makeup, buns or topknots on adult women, long loose hair, bob haircuts, a breast-cloth worn as a one-shoulder diagonal sash, modern Thai costume, shirts on commoner men, tiled roofs or ornate gable finials on commoner houses, ladders leaning on the ground, shorts or shirts on children.

A wooden landing on a canal in late afternoon: a young woman wearing a lower cloth and a breast-cloth wrapped around her chest covering both breasts, ends thrown back over both shoulders, holding an earthenware water jar on her hip, and a young man standing a few steps away speaking to her; other villagers bathing far off in the water.
```

### scene.lotus_pond — เรือลำเล็กกลางบึงบัว

⬜ ยังไม่มีภาพ · tag: `group:outing` `event:outing.lotus_f` `event:outing.lotus_m` `event:outing.lotus_fall_f` `event:outing.lotus_fall_m`

lore: `kinship.lotus_boat_meeting` (invented)

```
Historical illustration of everyday life in Siam (Ayutthaya kingdom), mid-18th century. Muted earthy watercolor and ink on textured paper, soft natural daylight, restrained palette of ochre, indigo, rust and off-white. Grounded, documentary, ordinary weathered faces without makeup. Unless stated otherwise, Siamese adults of both sexes wear their black hair cropped level with the top of the ears, the hair below shaved close, lifted off the forehead, and their teeth are blackened from chewing betel. Commoner men are bare-chested. A well-to-do woman's breast-cloth is wrapped around the chest covering both breasts, its two ends thrown back over both shoulders. Commoner houses are small, of woven split-bamboo panels raised on tall bamboo piles, entered by a short bamboo ladder hanging from the doorway by ropes with its foot off the ground. Any children present are bare-chested and wear a small lower cloth; children under eleven have shaved heads with a small topknot of hair left on the crown. Avoid: modern clothing or objects, tourist-poster look, fantasy costume, glossy digital rendering, glamour or model-like faces, makeup, buns or topknots on adult women, long loose hair, bob haircuts, a breast-cloth worn as a one-shoulder diagonal sash, modern Thai costume, shirts on commoner men, tiled roofs or ornate gable finials on commoner houses, ladders leaning on the ground, shorts or shirts on children.

Wide view of a lotus pond in the morning: two teenagers in a small narrow wooden dugout boat among lotus leaves and pink blossoms, one paddling, one reaching out to pick a flower, the boat tilting slightly; seen from a distance.
```

### scene.palace_pages — มหาดเล็กหนุ่มนั่งเรียงรอรับใช้ในลานพระราชวัง

⬜ ยังไม่มีภาพ · tag: `group:career` `place:court` `event:career.page_duty` `event:career.page_mistake` `event:career.page_found_out` `event:career.punished_page` `event:career.present_page` `event:career.assign_department`

lore: `social.royal_pages_1680s` (inferred, verified), `attire.officials_1680s` (attested)

```
Historical illustration of everyday life in Siam (Ayutthaya kingdom), mid-18th century. Muted earthy watercolor and ink on textured paper, soft natural daylight, restrained palette of ochre, indigo, rust and off-white. Grounded, documentary, ordinary weathered faces without makeup. Unless stated otherwise, Siamese adults of both sexes wear their black hair cropped level with the top of the ears, the hair below shaved close, lifted off the forehead, and their teeth are blackened from chewing betel. Commoner men are bare-chested. A well-to-do woman's breast-cloth is wrapped around the chest covering both breasts, its two ends thrown back over both shoulders. Commoner houses are small, of woven split-bamboo panels raised on tall bamboo piles, entered by a short bamboo ladder hanging from the doorway by ropes with its foot off the ground. Any children present are bare-chested and wear a small lower cloth; children under eleven have shaved heads with a small topknot of hair left on the crown. Avoid: modern clothing or objects, tourist-poster look, fantasy costume, glossy digital rendering, glamour or model-like faces, makeup, buns or topknots on adult women, long loose hair, bob haircuts, a breast-cloth worn as a one-shoulder diagonal sash, modern Thai costume, shirts on commoner men, tiled roofs or ornate gable finials on commoner houses, ladders leaning on the ground, shorts or shirts on children.

A paved palace courtyard beside a pavilion with tiered roofs: a row of young royal pages under twenty-five in white muslin over-shirts and silk lower cloths kneeling and sitting in order, one holding a lacquered betel box, an older official in a tall white conical hat with gold bands watching them. No king or royal figure visible.
```

### scene.audience_hall — ขุนนางสวมลอมพอกหมอบเฝ้าเป็นแถวในท้องพระโรง

⬜ ยังไม่มีภาพ · tag: `event:career.audience_late` `event:career.promotion` `event:career.punished` `event:career.gift_offered` `event:career.rival_accuses` `event:career.reported` `event:career.recall`

lore: `attire.officials_1680s` (attested), `social.court_attendance_rules` (attested, verified)

```
Historical illustration of everyday life in Siam (Ayutthaya kingdom), mid-18th century. Muted earthy watercolor and ink on textured paper, soft natural daylight, restrained palette of ochre, indigo, rust and off-white. Grounded, documentary, ordinary weathered faces without makeup. Unless stated otherwise, Siamese adults of both sexes wear their black hair cropped level with the top of the ears, the hair below shaved close, lifted off the forehead, and their teeth are blackened from chewing betel. Commoner men are bare-chested. A well-to-do woman's breast-cloth is wrapped around the chest covering both breasts, its two ends thrown back over both shoulders. Commoner houses are small, of woven split-bamboo panels raised on tall bamboo piles, entered by a short bamboo ladder hanging from the doorway by ropes with its foot off the ground. Any children present are bare-chested and wear a small lower cloth; children under eleven have shaved heads with a small topknot of hair left on the crown. Avoid: modern clothing or objects, tourist-poster look, fantasy costume, glossy digital rendering, glamour or model-like faces, makeup, buns or topknots on adult women, long loose hair, bob haircuts, a breast-cloth worn as a one-shoulder diagonal sash, modern Thai costume, shirts on commoner men, tiled roofs or ornate gable finials on commoner houses, ladders leaning on the ground, shorts or shirts on children.

Interior of a palace audience hall seen from behind the officials: rows of Siamese officials in open-front white muslin over-shirts and tall white conical hats with gold bands prostrating on the floor in strict order, betel boxes beside them, tall red columns; the throne area is off-frame. No king or royal figure visible.
```

### scene.night_patrol — กองตระเวนถือคบไฟจับขโมยควายริมคลอง

⬜ ยังไม่มีภาพ · tag: `event:career.patrol_thief` `situation:combat`

lore: `social.patrol_department_ladder` (attested, verified), `attire.commoner_men_1680s` (attested)

```
Historical illustration of everyday life in Siam (Ayutthaya kingdom), mid-18th century. Muted earthy watercolor and ink on textured paper, soft natural daylight, restrained palette of ochre, indigo, rust and off-white. Grounded, documentary, ordinary weathered faces without makeup. Unless stated otherwise, Siamese adults of both sexes wear their black hair cropped level with the top of the ears, the hair below shaved close, lifted off the forehead, and their teeth are blackened from chewing betel. Commoner men are bare-chested. A well-to-do woman's breast-cloth is wrapped around the chest covering both breasts, its two ends thrown back over both shoulders. Commoner houses are small, of woven split-bamboo panels raised on tall bamboo piles, entered by a short bamboo ladder hanging from the doorway by ropes with its foot off the ground. Any children present are bare-chested and wear a small lower cloth; children under eleven have shaved heads with a small topknot of hair left on the crown. Avoid: modern clothing or objects, tourist-poster look, fantasy costume, glossy digital rendering, glamour or model-like faces, makeup, buns or topknots on adult women, long loose hair, bob haircuts, a breast-cloth worn as a one-shoulder diagonal sash, modern Thai costume, shirts on commoner men, tiled roofs or ornate gable finials on commoner houses, ladders leaning on the ground, shorts or shirts on children.

Night by a canal bank: three patrol men, bare-chested, in lower cloths, carrying burning torches and wooden staves, surrounding a man crouching beside a water buffalo; firelight on the water, stilt houses dark in the background.
```

### scene.temple_holy_day — ชาวบ้านนำของไปถวายพระที่วัดในวันพระ

⬜ ยังไม่มีภาพ · tag: `group:festival` `group:ritual` `event:festival.holy_day` `event:ritual.elder_precepts`

lore: `ritual.holy_days_1680s` (attested, verified), `ritual.alms_round_1680s` (attested, verified), `attire.monks_1680s` (attested)

```
Historical illustration of everyday life in Siam (Ayutthaya kingdom), mid-18th century. Muted earthy watercolor and ink on textured paper, soft natural daylight, restrained palette of ochre, indigo, rust and off-white. Grounded, documentary, ordinary weathered faces without makeup. Unless stated otherwise, Siamese adults of both sexes wear their black hair cropped level with the top of the ears, the hair below shaved close, lifted off the forehead, and their teeth are blackened from chewing betel. Commoner men are bare-chested. A well-to-do woman's breast-cloth is wrapped around the chest covering both breasts, its two ends thrown back over both shoulders. Commoner houses are small, of woven split-bamboo panels raised on tall bamboo piles, entered by a short bamboo ladder hanging from the doorway by ropes with its foot off the ground. Any children present are bare-chested and wear a small lower cloth; children under eleven have shaved heads with a small topknot of hair left on the crown. Avoid: modern clothing or objects, tourist-poster look, fantasy costume, glossy digital rendering, glamour or model-like faces, makeup, buns or topknots on adult women, long loose hair, bob haircuts, a breast-cloth worn as a one-shoulder diagonal sash, modern Thai costume, shirts on commoner men, tiled roofs or ornate gable finials on commoner houses, ladders leaning on the ground, shorts or shirts on children.

A temple compound on a holy day: villagers in clean lower cloths carrying fruit, cloth and rice in baskets toward a monastery hall, older people in white sitting on mats listening to a monk preaching from a raised seat while holding a palm-leaf fan, candles lit; whitewashed brick hall with a tiled roof, bodhi tree.
```

### scene.temple_fair — งานวัด คนมาในผ้าใหม่ มีชกมวยพันเชือก

⬜ ยังไม่มีภาพ · tag: `event:festival.temple_fair`

lore: `ritual.temple_festival_1680s` (attested, verified), `material.household_objects_1680s` (attested)

```
Historical illustration of everyday life in Siam (Ayutthaya kingdom), mid-18th century. Muted earthy watercolor and ink on textured paper, soft natural daylight, restrained palette of ochre, indigo, rust and off-white. Grounded, documentary, ordinary weathered faces without makeup. Unless stated otherwise, Siamese adults of both sexes wear their black hair cropped level with the top of the ears, the hair below shaved close, lifted off the forehead, and their teeth are blackened from chewing betel. Commoner men are bare-chested. A well-to-do woman's breast-cloth is wrapped around the chest covering both breasts, its two ends thrown back over both shoulders. Commoner houses are small, of woven split-bamboo panels raised on tall bamboo piles, entered by a short bamboo ladder hanging from the doorway by ropes with its foot off the ground. Any children present are bare-chested and wear a small lower cloth; children under eleven have shaved heads with a small topknot of hair left on the crown. Avoid: modern clothing or objects, tourist-poster look, fantasy costume, glossy digital rendering, glamour or model-like faces, makeup, buns or topknots on adult women, long loose hair, bob haircuts, a breast-cloth worn as a one-shoulder diagonal sash, modern Thai costume, shirts on commoner men, tiled roofs or ornate gable finials on commoner houses, ladders leaning on the ground, shorts or shirts on children.

A crowded temple festival: people in new bright lower cloths walking around the temple grounds, in the middle a ring of spectators watching two boxers whose hands are wrapped with cord, a man releasing small birds from a bamboo cage, stalls with food in coconut shells.
```

### scene.lanterns — ลำน้ำเต็มไปด้วยโคมกระดาษลอยตามน้ำยามค่ำ

⬜ ยังไม่มีภาพ · tag: `event:festival.lanterns`

lore: `ritual.floating_lanterns_1680s` (attested, verified)

```
Historical illustration of everyday life in Siam (Ayutthaya kingdom), mid-18th century. Muted earthy watercolor and ink on textured paper, soft natural daylight, restrained palette of ochre, indigo, rust and off-white. Grounded, documentary, ordinary weathered faces without makeup. Unless stated otherwise, Siamese adults of both sexes wear their black hair cropped level with the top of the ears, the hair below shaved close, lifted off the forehead, and their teeth are blackened from chewing betel. Commoner men are bare-chested. A well-to-do woman's breast-cloth is wrapped around the chest covering both breasts, its two ends thrown back over both shoulders. Commoner houses are small, of woven split-bamboo panels raised on tall bamboo piles, entered by a short bamboo ladder hanging from the doorway by ropes with its foot off the ground. Any children present are bare-chested and wear a small lower cloth; children under eleven have shaved heads with a small topknot of hair left on the crown. Avoid: modern clothing or objects, tourist-poster look, fantasy costume, glossy digital rendering, glamour or model-like faces, makeup, buns or topknots on adult women, long loose hair, bob haircuts, a breast-cloth worn as a one-shoulder diagonal sash, modern Thai costume, shirts on commoner men, tiled roofs or ornate gable finials on commoner houses, ladders leaning on the ground, shorts or shirts on children.

Night on a wide river as the floodwater begins to fall: the water covered with many small painted paper lanterns of different sizes floating with the current, their flames reflected, people on the bank and in small boats setting more lanterns on the water.
```

### scene.bathing_elders — ลูกหลานรดน้ำพ่อแม่ในวันเพ็ญเดือนห้า

⬜ ยังไม่มีภาพ · tag: `event:festival.bathing`

lore: `ritual.fifth_month_bathing_1680s` (attested, verified)

```
Historical illustration of everyday life in Siam (Ayutthaya kingdom), mid-18th century. Muted earthy watercolor and ink on textured paper, soft natural daylight, restrained palette of ochre, indigo, rust and off-white. Grounded, documentary, ordinary weathered faces without makeup. Unless stated otherwise, Siamese adults of both sexes wear their black hair cropped level with the top of the ears, the hair below shaved close, lifted off the forehead, and their teeth are blackened from chewing betel. Commoner men are bare-chested. A well-to-do woman's breast-cloth is wrapped around the chest covering both breasts, its two ends thrown back over both shoulders. Commoner houses are small, of woven split-bamboo panels raised on tall bamboo piles, entered by a short bamboo ladder hanging from the doorway by ropes with its foot off the ground. Any children present are bare-chested and wear a small lower cloth; children under eleven have shaved heads with a small topknot of hair left on the crown. Avoid: modern clothing or objects, tourist-poster look, fantasy costume, glossy digital rendering, glamour or model-like faces, makeup, buns or topknots on adult women, long loose hair, bob haircuts, a breast-cloth worn as a one-shoulder diagonal sash, modern Thai costume, shirts on commoner men, tiled roofs or ornate gable finials on commoner houses, ladders leaning on the ground, shorts or shirts on children.

Bright hot-season day in a house yard: an elderly couple seated on a low bench while their grown sons and daughters pour scented water from small bowls over their hands and shoulders, grandchildren in lower cloths waiting with more bowls, flowers floating in the water jar.
```

### scene.ordination — แห่นาคไปวัดพร้อมร่มและดนตรี

⬜ ยังไม่มีภาพ · tag: `event:ritual.ordination`

lore: `ritual.ordination` (inferred, verified), `attire.monks_1680s` (attested)

```
Historical illustration of everyday life in Siam (Ayutthaya kingdom), mid-18th century. Muted earthy watercolor and ink on textured paper, soft natural daylight, restrained palette of ochre, indigo, rust and off-white. Grounded, documentary, ordinary weathered faces without makeup. Unless stated otherwise, Siamese adults of both sexes wear their black hair cropped level with the top of the ears, the hair below shaved close, lifted off the forehead, and their teeth are blackened from chewing betel. Commoner men are bare-chested. A well-to-do woman's breast-cloth is wrapped around the chest covering both breasts, its two ends thrown back over both shoulders. Commoner houses are small, of woven split-bamboo panels raised on tall bamboo piles, entered by a short bamboo ladder hanging from the doorway by ropes with its foot off the ground. Any children present are bare-chested and wear a small lower cloth; children under eleven have shaved heads with a small topknot of hair left on the crown. Avoid: modern clothing or objects, tourist-poster look, fantasy costume, glossy digital rendering, glamour or model-like faces, makeup, buns or topknots on adult women, long loose hair, bob haircuts, a breast-cloth worn as a one-shoulder diagonal sash, modern Thai costume, shirts on commoner men, tiled roofs or ornate gable finials on commoner houses, ladders leaning on the ground, shorts or shirts on children.

A procession toward a temple: a young man of about twenty-one with a shaved head, dressed in white, walking under a tall ceremonial umbrella held by a relative, family members carrying folded yellow robes and an alms bowl, a drummer and a reed-pipe player in front.
```

### scene.topknot — เด็กนั่งให้ผู้ใหญ่ตัดจุก

⬜ ยังไม่มีภาพ · tag: `event:ritual.topknot`

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

⬜ ยังไม่มีภาพ · tag: `place:duel_ground`

lore: `attire.wat_ko_kaeo_reference` (attested)

```
In the style of an 18th-century Thai temple mural painting: a single unified continuous scene filling the entire frame, flat colors without shading, deep red-brown background, fine dark hand-painted outlines of uneven weight, no Western perspective, stylized figures in profile and three-quarter view, decorative trees, rocks and water patterns naturally framing the composition. Aged mineral pigments, faded and slightly flaking plaster surface. Avoid: 3D shading, photorealism, crisp vector look, modern objects, tiled roofs or curved horn-shaped gable ornaments on commoner houses, zig-zag dividing lines, geometric frame borders, split panels, multiple framed vignettes.

Two men dueling with swords and shields on an open ground, a crowd of onlookers seated in rows around them, one fighter leaping in a heroic pose, decorative trees and rocks.
```

### legend.court — ภาพจิตรกรรม: ขุนนางหมอบรับความชอบในวัง

⬜ ยังไม่มีภาพ · tag: `place:court`

lore: `attire.wat_ko_kaeo_reference` (attested), `attire.officials_1680s` (attested)

```
In the style of an 18th-century Thai temple mural painting: a single unified continuous scene filling the entire frame, flat colors without shading, deep red-brown background, fine dark hand-painted outlines of uneven weight, no Western perspective, stylized figures in profile and three-quarter view, decorative trees, rocks and water patterns naturally framing the composition. Aged mineral pigments, faded and slightly flaking plaster surface. Avoid: 3D shading, photorealism, crisp vector look, modern objects, tiled roofs or curved horn-shaped gable ornaments on commoner houses, zig-zag dividing lines, geometric frame borders, split panels, multiple framed vignettes.

A palace scene: an official in a tall pointed hat prostrating to receive a reward of cloth and a sword on a tray, other officials kneeling in rows, a pavilion with tiered roofs; the ruler is not shown, only an empty raised seat behind a curtain.
```

### legend.spirit — ภาพจิตรกรรม: ผีบรรพบุรุษคุ้มครองลูกหลาน

⬜ ยังไม่มีภาพ · tag: `supernatural:guardian_spirit` `supernatural:phi`

lore: `attire.wat_ko_kaeo_reference` (attested), `belief.spirits_1680s` (inferred, verified)

```
In the style of an 18th-century Thai temple mural painting: a single unified continuous scene filling the entire frame, flat colors without shading, deep red-brown background, fine dark hand-painted outlines of uneven weight, no Western perspective, stylized figures in profile and three-quarter view, decorative trees, rocks and water patterns naturally framing the composition. Aged mineral pigments, faded and slightly flaking plaster surface. Avoid: 3D shading, photorealism, crisp vector look, modern objects, tiled roofs or curved horn-shaped gable ornaments on commoner houses, zig-zag dividing lines, geometric frame borders, split panels, multiple framed vignettes.

An ancestral spirit drawn as a pale floating figure above a house, shielding a sleeping family below from dark demonic figures at the edge of the scene.
```

### legend.omen — ภาพจิตรกรรม: นิมิตประหลาดบนฟ้า

⬜ ยังไม่มีภาพ · tag: `supernatural:omen`

lore: `attire.wat_ko_kaeo_reference` (attested), `belief.chronicle_omens` (inferred, verified)

```
In the style of an 18th-century Thai temple mural painting: a single unified continuous scene filling the entire frame, flat colors without shading, deep red-brown background, fine dark hand-painted outlines of uneven weight, no Western perspective, stylized figures in profile and three-quarter view, decorative trees, rocks and water patterns naturally framing the composition. Aged mineral pigments, faded and slightly flaking plaster surface. Avoid: 3D shading, photorealism, crisp vector look, modern objects, tiled roofs or curved horn-shaped gable ornaments on commoner houses, zig-zag dividing lines, geometric frame borders, split panels, multiple framed vignettes.

A strange omen in the sky: a comet and a ring around the sun above a town wall, small figures below pointing upward in alarm.
```
