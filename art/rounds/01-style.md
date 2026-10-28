# รอบ 01 — หาสไตล์ (ใส่การแก้จากรอบ 00)

เป้าหมาย: ดูว่า style block ฉบับแก้ทำให้ภาพ **ตรง lore** และ **คงที่** ขึ้นไหม — ไม่ได้ทดสอบขอบเขตอีกแล้ว
การจัดภาพเป็นไปตามที่ตัดสินใจไว้ (art/README.md ข้อ 6): portrait ครอปไหล่, มุมหลัง/ข้าง/ระยะไกล, ไม่มีภาพเปลือยด้านหน้า

**วิธีทดสอบ**
- แชทใหม่ทุก prompt; จดชื่อ/เวอร์ชันโมเดลที่ Gemini แสดง
- สร้าง **ทุกโจทย์ 2 ครั้ง** (แชทใหม่ทั้งสองครั้ง) — ถ้าเวลาน้อย อย่างน้อย S2, S3, S6 ให้ครบ 2 ครั้ง
- บันทึกภาพเป็น `art/rounds/01/S1-a.jfif`, `S1-b.jfif`, … (ไม่ขึ้น git)
- ใส่ style block แทน `[REALITY]` / `[CHRONICLE]` หน้า prompt

## Style block v0.2

เปลี่ยนจาก v0.1 (รอบ 00): ทรงผม, หน้าคนธรรมดา, เด็กไม่ใส่เสื้อแต่นุ่งผ้าท่อนล่าง (ห้ามกางเกงขาสั้น), สไบ, เรือนชาวบ้าน, จิตรกรรมดูเก่า

**REALITY v0.2**
```
Historical illustration of everyday life in Siam (Ayutthaya kingdom), mid-18th century. Muted earthy watercolor and ink on textured paper, soft natural daylight, restrained palette of ochre, indigo, rust and off-white. Grounded, documentary, ordinary weathered faces without makeup. Unless stated otherwise, Siamese adults of both sexes wear their black hair cropped level with the top of the ears, the hair below shaved close, lifted off the forehead, and their teeth are blackened from chewing betel. Commoner houses are small, of woven split-bamboo panels raised on tall bamboo piles, reached by a hanging bamboo ladder. Any children present are bare-chested and wear a small lower cloth. Avoid: modern clothing or objects, tourist-poster look, fantasy costume, glossy digital rendering, glamour or model-like faces, makeup, buns or topknots on women, long loose hair, bob haircuts, a breast-cloth worn as a one-shoulder diagonal sash, modern Thai costume, tiled roofs or ornate gable finials on commoner houses, shorts or shirts on children.
```

**CHRONICLE v0.2**
```
In the style of an 18th-century Thai temple mural painting: flat colors without shading, deep red-brown background, fine dark hand-painted outlines of uneven weight, no Western perspective, stylized figures in profile and three-quarter view, scenes separated by zig-zag dividing lines, decorative trees, rocks and water patterns. Aged mineral pigments, faded and slightly flaking plaster surface. Avoid: 3D shading, photorealism, crisp vector look, modern objects, tiled roofs on commoner houses.
```

## โจทย์ 10 ข้อ (ตาม art/README.md ข้อ 4.2)

| # | โจทย์ | lore | จัดภาพ | ดูอะไรเป็นพิเศษ |
|---|---|---|---|---|
| S1 | ขุนนางสวมลอมพอก | `attire.officials_1680s` | กึ่งตัว นั่ง | ลอมพอก, เสื้อผ่าหน้าแขนกว้าง |
| S2 | ชายไพร่ | `attire.commoner_men_1680s`, `attire.hair_1680s` | เต็มตัว | ผ้านุ่งแบบโจง, ทรงผม, บันไดแขวน |
| S3 | หญิงมีฐานะ | `attire.women_1680s` | กึ่งตัว นั่งพับเพียบ | **วิธีพาดผ้าห่ม** (ข้ามไหล่ทั้งสองไปด้านหลัง), ทรงผม |
| S4 | พระสงฆ์ | `attire.monks_1680s` | เต็มตัว | จีวรเปิดไหล่ขวา, โกนคิ้ว, ตาลปัตร, บาตรในถุง |
| S5 | แผลเป็นที่นิ้วชี้ซ้าย | `STATE` | ภาพมือระยะใกล้ | แผลเห็นชัดไหม, นิ้วเบี้ยวเล็กน้อย |
| S6 | หญิงชรา | `attire.hair_1680s` | portrait ครอปไหล่ | ทรงผม, ฟันดำ, หน้ากร้าน |
| S7 | เรือนไผ่ยกสูง | `material.houses_1680s` | ฉากกว้าง | ฝาไผ่สาน, เสาสูง, บันไดแขวน, ไม่มีกระเบื้อง |
| S8 | ครัวกลางลานบ้าน | `material.houses_1680s` | ระยะไกล คนเห็นด้านข้าง | **เตาดินในตะกร้าบนไม้สามขา** (รอบ 00 ตีความผิด) |
| S9 | สำรับข้าวกับปลา | `material.food_1680s`, `material.household_objects_1680s` | มองจากบน | ถาดไม่มีขา, ไม่มีช้อนส้อม, กะปิ |
| S10 | ตำนานนักรบ (Chronicle) | `attire.wat_ko_kaeo_reference` | ฉากจิตรกรรม | ความเก่าของภาพ, เทวดาไม่ถือดาบ |
| *S11* | *(เสริม) ความจริงของ S10* | `Legend.truth` | ระยะกลาง | คู่ภาพ ความจริง ↔ ตำนาน |

### S1
```
[REALITY] Medium shot: a Siamese official, an adult man in his forties, sitting cross-legged on a reed mat inside a timber house, wearing an open-front collarless white muslin over-shirt with wide sleeves reaching almost to the wrist over a silk lower cloth, and a tall white conical pointed hat with gold bands and a chin strap; barefoot, a pair of pointed heel-less slippers set aside.
```

### S2
```
[REALITY] Full-body view: a Siamese commoner man in his twenties, bare-chested and barefoot, wearing a knee-length painted-cotton lower cloth drawn between the legs and tucked at the back, standing in front of a small bamboo stilt house with a hanging bamboo ladder, holding a woven fish trap.
```

### S3
```
[REALITY] Medium shot: a well-to-do Siamese woman in her thirties kneeling with her legs folded to one side on a reed mat, wearing a black wrap skirt and a single white muslin breast-cloth laid across the bosom with both ends thrown back over both shoulders so they hang down her back; pear-shaped gold earrings, several rings on her last three fingers; a betel box beside her.
```

### S4
```
[REALITY] Full-body view: a Siamese Buddhist monk, adult, barefoot, head and eyebrows shaved, wearing a yellow patched robe that leaves the right shoulder bare and a yellow waist sash, holding a palm-leaf fan, an iron alms bowl carried in a cloth bag over his shoulder, walking along a dirt path at dawn.
```

### S5
```
[REALITY] Close-up of the hands of a Siamese commoner man in his thirties weaving a bamboo basket; a pale, raised old scar runs across the middle joint of his left index finger, which is slightly crooked; his other fingers are unmarked.
```

### S6
```
[REALITY] Portrait from the shoulders up: an elderly Siamese village woman in her sixties, deeply lined sun-weathered face, grey hair cropped level with the top of the ears and lifted off the forehead, smiling slightly to show teeth blackened from chewing betel, gold pear-shaped earrings; plain background of a bamboo wall.
```

### S7
```
[REALITY] Wide view of a small Siamese commoner house: walls, floor and roof of woven split-bamboo panels, raised about four metres on six tall bamboo piles because of floods, reached by a hanging bamboo ladder; a bamboo fence around the yard; river behind, rainy-season sky. No people in the foreground.
```

### S8
```
[REALITY] Wide shot of the yard beneath and beside a bamboo stilt house: a cooking fire made inside a basket filled with earth, which rests on three short sticks, with a clay pot sitting directly on it; an adult commoner woman seen from the side at a distance squats beside it stirring; dried fish hanging from a pole, chickens, firewood.
```

### S9
```
[REALITY] Top-down still life on a reed mat: a round footless lacquered wooden tray holding a mound of rice, dried salted fish, a small bowl of fermented shrimp paste with garlic, spring onions and fresh herbs, food already cut into small pieces, coconut-shell and earthenware bowls, a bamboo water tube; no spoons, forks or chopsticks.
```

### S10
```
[CHRONICLE] A family legend: a warrior wielding a two-handed sword fights several enemy soldiers on a battlefield during the fall of the old capital; above him a guardian spirit hovers on a cloud with empty hands joined in a respectful greeting; the warrior's left hand is bandaged.
```

### S11 (เสริม)
```
[REALITY] Medium shot in the yard kitchen of a bamboo stilt house: a bare-chested six-year-old Siamese boy in a small lower cloth has just cut his left finger while helping slice a bright orange pumpkin with a kitchen knife; a few drops of blood, the pumpkin split open on a wooden board, his mother hurrying toward him. Everyday, non-graphic scene.
```

## บันทึกผล

โมเดล/เวอร์ชันที่ Gemini แสดง: `Gemini 4 argon` (ตามที่ผู้ทดสอบแจ้ง)  วันที่: `2569-10-28`
สร้างโจทย์ละ 1 ครั้ง (ยังไม่ได้ทดสอบ a/b) — ไฟล์ `art/rounds/01/S1.jfif` … `S11.jfif`

| # | ตรง lore (1–5) | ทรงผมตรงไหม | ของผิดยุค/ผิด lore | ที่ทำได้ดี |
|---|---|---|---|---|
| S1 | 3 | (มีหมวกบัง) | **ลอมพอกมีปีกกว้างแบบหมวกแม่มด** (ลอมพอกจริงทรงสูงแคบไม่มีปีก); แขนเสื้อไม่กว้างนัก | เสื้อมัสลินผ่าหน้าไม่มีปก, ผ้านุ่งไหม, รองเท้าแตะปลายแหลมวางข้าง, ฟันดำ |
| S2 | 4 | ✅ สั้นโกนข้าง | บันไดพิง (ไม่ใช่บันไดแขวน); หลังคามุงจาก | ผ้านุ่งแบบโจง, ไซดักปลา, เรือนฝาไผ่สาน |
| S3 | 3 | ≈ โกนข้าง ด้านบนยาวกว่าที่ควร | **ผ้าห่มยังพาดเฉียงไหล่เดียว** (ผิดเป็นรอบที่สอง); นั่งคุกเข่าแทนพับเพียบ | ผ้านุ่งดำ ต่างหู แหวน ฟันดำ เชี่ยนหมาก; **เด็กไม่ใส่เสื้อนุ่งผ้าท่อนล่างตามกฎใหม่** |
| S4 | 4 | ✅ โกน | บาตรสีทอง (สั่งบาตรเหล็ก); ตาลปัตรเป็นพัดกลม | จีวรปะ, ประคดเอวเหลือง, บาตรในถุงสะพาย, เด็กนุ่งผ้า |
| S5 | 3 | – | **ใส่เสื้อให้ชายไพร่** (ภาพระยะใกล้ทำให้ Gemini เติมเสื้อ) | **แผลเป็นนูนที่นิ้วเห็นชัดมาก** — ระบบแผลเป็นแสดงในภาพได้ |
| S6 | 5 | ✅ สั้น ยกจากหน้าผาก | – | หน้ากร้าน ฟันดำ ต่างหูหยดน้ำ — ดีที่สุดในรอบ |
| S7 | 4 | – | บันไดพิง; หลังคามุงจาก (lore: แผงไผ่สาน); เรือนเตี้ยกว่าสั่ง | ฝาไผ่สาน รั้วไผ่ แม่น้ำ ไม่มีกระเบื้อง |
| S8 | 4 | ✅ สั้นโกนข้าง | **ไฟก่ออยู่ใต้ตะกร้า** (ตะกร้าจะไหม้ — ยังตีความเตาผิด); บันไดพิง; ผู้หญิงกระโจมอก (prompt ไม่ได้ระบุ) | ปลาแห้งแขวน ไก่ ฟืน |
| S9 | 5 | – | ปลาทั้งตัว (lore: หั่นเป็นชิ้นแล้ว) — เล็กน้อย | ถาดไม่มีขา ข้าว กะปิ กระเทียม ต้นหอม กะลา กระบอกไม้ไผ่ ไม่มีช้อนส้อม |
| S10 | 5 (สไตล์) | – | ไม่เห็นว่าเป็น "เสียกรุง" ชัดนัก | **ผนังปูนร้าวดูเก่าจริง**, เทวดามือเปล่าพนมมือ, ผ้าพันมือซ้ายนักรบ, เส้นสินเทา |
| S11 | 4 | แม่ ✅ / **เด็กผมยุ่งทรงสมัยใหม่** | เตาอั้งโล่ (lore: เตาตะกร้าดิน); บันไดพิง; แม่กระโจมอก | ฟักทองสีส้ม, เด็กไม่ใส่เสื้อนุ่งผ้า, **เลือดที่มือซ้าย มีดในมือขวา** ตรงกับตรรกะเกม (บาดมือที่ไม่ถนัด) |

**ข้อสังเกตรวม**
- ภาพ Reality ทั้ง 9 ภาพ **ดูเป็นเกมเดียวกันชัดเจน**; S10 (Chronicle) กับ S11 (Reality) เข้าคู่กันได้ดี — แนวคิดภาพความจริง ↔ ตำนานใช้ได้
- ทรงผมผู้ใหญ่ **ดีขึ้นมาก** จากรอบ 00 (ผ่านเกือบทุกภาพ)
- จุดที่ Gemini ไม่รู้จัก แม้สั่งตรงๆ: **บันไดแขวน** (ผิด 4 ภาพ), **วิธีพาดผ้าห่ม** (ผิด 2 รอบ), **ลอมพอก**, **เตาตะกร้าดิน**
- เมื่อ prompt ไม่ระบุท่อนบนของหญิงสามัญ Gemini ใส่ผ้ากระโจมอกให้เอง (S8, S11)

**เกณฑ์ผ่านเพื่อตรึงเป็น v0.1 ของเกม**
- ตรง lore ≥ 4 อย่างน้อย 8 ใน 10 โจทย์ (ไม่นับ S11)
- ทรงผมผู้ใหญ่ตรงคำบรรยายในทุกภาพที่เห็นผม (ยกเว้นพระ)
- ครั้ง a กับ b ของโจทย์เดียวกันดูเป็นเกมเดียวกัน — สไตล์และเครื่องแต่งกายไม่เปลี่ยน
- 10 ภาพวางเรียงกันแล้วดูเป็นเกมเดียวกัน (Reality 9 ภาพ + Chronicle 1 ภาพดูเข้าคู่กัน)

**สรุป:** **ยังไม่ผ่าน** — ตรง lore ≥ 4 ได้ 7 จาก 10 (เกณฑ์ 8), ยังไม่ได้ทดสอบ a/b
แต่ใกล้แล้ว: สไตล์รวมคงที่ ปัญหาที่เหลือเป็นรายละเอียดเฉพาะจุด → รอบ 02 แก้เฉพาะจุด ไม่ต้องรันใหม่ทั้งชุด

## สิ่งที่ต้องแก้ใน v0.3 (รอบ 02)

| ปัญหา | วิธีแก้ใน prompt | ถ้ายังไม่ได้ |
|---|---|---|
| ลอมพอกมีปีก (S1) | `a tall, narrow, brimless white cloth hat shaped like a slender cone, as tall as the head itself, gold bands near the base, tied under the chin` + Avoid `wide brim, witch hat, farmer's hat` | ใช้ภาพที่ไม่เห็นหมวก หรือรอวาดมือ |
| ผ้าห่มพาดเฉียงไหล่เดียว (S3) | `a white cloth wrapped once around the chest covering both breasts, its two loose ends draped back over both shoulders like a shawl` | ยอมรับเป็นข้อจำกัดของเครื่องมือ บันทึกไว้ |
| บันไดแขวน (S2, S7, S8, S11) | `a short bamboo ladder hanging from the doorway by ropes, its foot not resting on the ground` | **ตัดออก** — เป็นรายละเอียดเล็ก ไม่คุ้มเสียรอบ |
| เติมเสื้อในภาพระยะใกล้ (S5) | ระบุ `bare chest and bare forearms, no shirt` ในชั้น SUBJECT ของภาพระยะใกล้ทุกภาพ | – |
| เตาตะกร้าดิน (S8, S11) | `a round woven basket packed full of earth serves as the hearth; a small wood fire burns on the earth inside the basket; the basket stands on three short stakes; no clay stove` | ตัดออกจากฉาก — ใช้ไฟกองเล็กแทน |
| บาตรสีทอง (S4) | `a dark iron alms bowl` | – |
| หญิงสามัญถูกใส่กระโจมอก (S8, S11) | ระบุท่อนบนตามหลักฐานเมื่อเป็นมุมข้าง/หลัง/ระยะไกล ตามข้อ 6 ของ art/README.md | – |
| ทรงผมเด็ก (S11) | ใช้ lore ใหม่ (`ritual.month_old_tham_khwan`, `ritual.topknot_cutting`) + ภาพถ่ายยุค ร.4–ร.5 เป็นต้นแบบ: `children under eleven have shaved heads with a small topknot of hair left on the crown` | – |

รอบ 02: รันเฉพาะ S1, S3, S5, S8 + ทดสอบ a/b กับ S2, S3, S6 → ถ้าผ่านให้ตรึงเป็น **style v0.1** ลง `art/style.json`
