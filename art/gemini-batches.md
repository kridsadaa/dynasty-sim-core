# Prompt แบบจัดชุดสำหรับ Gemini Chat บนเว็บ (25 ภาพที่ยังขาด)

> **วิธีใช้:**
> 1. ก๊อปปี้กล่องโค้ดของแต่ละชุดไปวางใน Gemini Chat บนเว็บ
> 2. ถ้า Gemini สร้างให้ทีละภาพ เมื่อได้ภาพที่ 1 แล้ว พิมพ์แค่ **`Next image (#2), 16:9 aspect ratio`** ในแชตเดิมได้เลย (การสร้างในแชตเดียวกันจะช่วยให้ใบหน้าตัวละครชาย/หญิงเป็นคนเดียวกันต่อเนื่องกันทุกช่วงวัย)
> 3. เซฟภาพที่ได้ลงโฟลเดอร์ `art/generated/<id>.jpg` (หรือ `.png` / `.webp`) ตามชื่อที่กำกับไว้

---

## ชุดที่ 1: ภาพฉากราชการและงานวัด (4 ภาพ)
- `scene.palace_pages`
- `scene.audience_hall`
- `scene.night_patrol`
- `scene.temple_fair`

```text
Please generate the following 4 historical illustrations in 16:9 aspect ratio. If you can only generate one image per turn, generate #1 first and I will say "next" for #2, #3, and #4.

Every image MUST strictly follow this exact STYLE & HISTORICAL RULE BLOCK:
"Historical illustration of everyday life in Siam (Ayutthaya kingdom), mid-18th century. Muted earthy watercolor and ink on textured paper, soft natural daylight, restrained palette of ochre, indigo, rust and off-white. Grounded, documentary, ordinary weathered faces without makeup. Unless stated otherwise, Siamese adults of both sexes wear their black hair cropped level with the top of the ears, the hair below shaved close, lifted off the forehead, and their teeth are blackened from chewing betel. A well-to-do woman's wrap cloth is wrapped horizontally around the chest, its two ends thrown back over both shoulders. Commoner houses are small, of woven split-bamboo panels raised on tall bamboo piles, entered by a short bamboo ladder hanging from the doorway by ropes with its foot off the ground. Children under eleven have shaved heads with a small topknot of hair left on the crown and wear traditional woven lower cloths. Avoid: modern clothing or objects, tourist-poster look, fantasy costume, glossy digital rendering, glamour or model-like faces, makeup, buns or topknots on adult women, long loose hair, bob haircuts, one-shoulder diagonal sash, modern Thai costume, tiled roofs or ornate gable finials on commoner houses, ladders leaning on the ground."

Image 1 (`scene.palace_pages`):
A paved palace courtyard beside a pavilion with tiered roofs: a row of young royal pages under twenty-five in white muslin over-shirts and silk lower cloths kneeling and sitting in order, one holding a lacquered betel box, an older official in a tall white conical hat with gold bands watching them. No king or royal figure visible. (16:9 aspect ratio)

Image 2 (`scene.audience_hall`):
Interior of a palace audience hall seen from behind the officials: rows of Siamese officials in open-front white muslin over-shirts and tall white conical hats with gold bands prostrating on the floor in strict order, betel boxes beside them, tall red columns; the throne area is off-frame. No king or royal figure visible. (16:9 aspect ratio)

Image 3 (`scene.night_patrol`):
Night by a canal bank: three Siamese patrol men in traditional lower cloths, carrying burning torches and wooden staves, surrounding a man crouching beside a water buffalo; firelight on the water, stilt houses dark in the background. (16:9 aspect ratio)

Image 4 (`scene.temple_fair`):
A crowded temple festival: people in new bright lower cloths walking around the temple grounds, in the middle a ring of spectators watching two traditional boxers whose hands are wrapped with cord, a man releasing small birds from a bamboo cage, stalls with food in coconut shells. (16:9 aspect ratio)
```

---

## ชุดที่ 2: ภาพฉากประเพณีและพิธีกรรม (4 ภาพ)
- `scene.lanterns`
- `scene.bathing_elders`
- `scene.ordination`
- `scene.topknot`

```text
Please generate the following 4 historical illustrations in 16:9 aspect ratio. If you can only generate one image per turn, generate #1 first and I will say "next" for #2, #3, and #4.

Every image MUST strictly follow this exact STYLE & HISTORICAL RULE BLOCK:
"Historical illustration of everyday life in Siam (Ayutthaya kingdom), mid-18th century. Muted earthy watercolor and ink on textured paper, soft natural daylight, restrained palette of ochre, indigo, rust and off-white. Grounded, documentary, ordinary weathered faces without makeup. Unless stated otherwise, Siamese adults of both sexes wear their black hair cropped level with the top of the ears, the hair below shaved close, lifted off the forehead, and their teeth are blackened from chewing betel. A well-to-do woman's wrap cloth is wrapped horizontally around the chest, its two ends thrown back over both shoulders. Commoner houses are small, of woven split-bamboo panels raised on tall bamboo piles, entered by a short bamboo ladder hanging from the doorway by ropes with its foot off the ground. Children under eleven have shaved heads with a small topknot of hair left on the crown and wear traditional woven lower cloths. Avoid: modern clothing or objects, tourist-poster look, fantasy costume, glossy digital rendering, glamour or model-like faces, makeup, buns or topknots on adult women, long loose hair, bob haircuts, one-shoulder diagonal sash, modern Thai costume, tiled roofs or ornate gable finials on commoner houses, ladders leaning on the ground."

Image 1 (`scene.lanterns`):
Night on a wide river as the floodwater begins to fall: the water covered with many small painted paper lanterns of different sizes floating with the current, their flames reflected, people on the bank and in small boats setting more lanterns on the water. (16:9 aspect ratio)

Image 2 (`scene.bathing_elders`):
Bright hot-season day in a house yard: an elderly couple seated on a low bench while their grown sons and daughters pour scented water from small bowls over their hands and shoulders, grandchildren waiting with more bowls, flowers floating in the water jar. (16:9 aspect ratio)

Image 3 (`scene.ordination`):
A procession toward a temple: a young man of about twenty-one with a shaved head, dressed in white robes, walking under a tall ceremonial umbrella held by a relative, family members carrying folded yellow robes and an alms bowl, a drummer and a reed-pipe player in front. (16:9 aspect ratio)

Image 4 (`scene.topknot`):
Interior of a house: a child of about eleven wearing a traditional white ceremony cloth and lower wrap cloth, seated on a mat with head bowed, the small topknot on the crown about to be cut by an elderly man with a pair of shears, a monk seated nearby holding a palm-leaf fan, relatives watching with bowls of water and flowers. (16:9 aspect ratio)
```

---

## ชุดที่ 3: ภาพตัวละครชาย — วัยเด็กและวัยหนุ่ม (5 ภาพ — คนเดียวกันทุกภาพ)
- `portrait.m.child.commoner`
- `portrait.m.child.noble`
- `portrait.m.youth.noble`
- `portrait.m.youth.page`
- `portrait.m.youth.monk`

```text
Please generate a series of 5 character portraits (16:9 aspect ratio) of the SAME Siamese male character across childhood and youth in different social statuses and roles. Keep his facial features consistent across all images (warm olive-brown skin, broad cheekbones, calm dark eyes, straight nose, slightly square jaw). If you can only generate one image per turn, generate #1 first and I will say "next" for the rest.

Style for all images:
"Historical illustration of everyday life in Siam (Ayutthaya kingdom), mid-18th century. Muted earthy watercolor and ink on textured paper, soft natural daylight, restrained palette of ochre, indigo, rust and off-white. Grounded, documentary, ordinary weathered faces without makeup. Avoid: modern clothing, tourist-poster look, fantasy costume, glossy digital rendering, glamour faces."

Image 1 (`portrait.m.child.commoner`):
Portrait from the shoulders up: an eight-year-old Siamese village boy with warm olive-brown skin, broad cheekbones, calm dark eyes, and a straight nose; shaved head with a small traditional topknot left on the crown, standing in a bamboo yard. (16:9 aspect ratio)

Image 2 (`portrait.m.child.noble`):
Portrait from the shoulders up: an eight-year-old well-born Siamese boy with warm olive-brown skin, broad cheekbones, calm dark eyes, and a straight nose; shaved head with a neat topknot on the crown fastened with a small gold pin and flower garland, wearing a small gold neck ornament on the timber veranda of a house. (16:9 aspect ratio)

Image 3 (`portrait.m.youth.noble`):
Medium portrait: a well-born Siamese young man of about eighteen years old with warm olive-brown skin, broad cheekbones, calm dark eyes, straight nose, and a slightly square jaw; black hair cropped level with the top of the ears and shaved close below, wearing a fine patterned Indian chintz lower cloth with a betel pouch at the waist, seated on a reed mat inside a timber house. (16:9 aspect ratio)

Image 4 (`portrait.m.youth.page`):
Medium portrait: a young Siamese royal page of about nineteen with warm olive-brown skin, broad cheekbones, calm dark eyes, straight nose, and a slightly square jaw; black hair cropped level with the top of the ears and shaved close below, bare-headed without a hat, wearing an open-front collarless white muslin over-shirt with wide long sleeves over a patterned silk lower cloth, kneeling respectfully beside a lacquered betel box in a palace pavilion. (16:9 aspect ratio)

Image 5 (`portrait.m.youth.monk`):
Medium portrait from the waist up: a young Siamese Buddhist monk in his early twenties with warm olive-brown skin, broad cheekbones, calm dark eyes, straight nose, and a slightly square jaw; completely shaved head and shaved eyebrows, wearing a patched ochre-yellow robe leaving the right shoulder uncovered and a yellow waist sash, holding an iron alms bowl in a cloth sling inside a quiet monastery hall. (16:9 aspect ratio)
```

---

## ชุดที่ 4: ภาพตัวละครชาย — วัยผู้ใหญ่และวัยชรา (5 ภาพ — คนเดิมจากชุดที่ 3)
- `portrait.m.adult.noble`
- `portrait.m.elder.commoner`
- `portrait.m.elder.noble`
- `portrait.m.elder.official`
- `portrait.m.elder.monk`

```text
Please generate 5 more character portraits (16:9 aspect ratio) of the SAME Siamese male character in adulthood and old age across different social statuses and roles. Keep his facial features consistent (warm olive-brown skin, broad cheekbones, calm dark eyes, straight nose, slightly square jaw). If you can only generate one image per turn, generate #1 first and I will say "next" for the rest.

Style for all images:
"Historical illustration of everyday life in Siam (Ayutthaya kingdom), mid-18th century. Muted earthy watercolor and ink on textured paper, soft natural daylight, restrained palette of ochre, indigo, rust and off-white. Grounded, documentary, ordinary weathered faces without makeup. Avoid: modern clothing, tourist-poster look, fantasy costume, glossy digital rendering, glamour faces."

Image 1 (`portrait.m.adult.noble`):
Medium portrait: a well-to-do Siamese household head in his thirties with warm olive-brown skin, broad cheekbones, calm dark eyes, straight nose, and a slightly square jaw, teeth darkened from chewing betel; black hair cropped level with the top of the ears and shaved close below, wearing a fine patterned silk lower cloth, seated cross-legged on a reed mat beside a lacquered betel box inside a timber house. (16:9 aspect ratio)

Image 2 (`portrait.m.elder.commoner`):
Medium portrait: an elderly Siamese village man in his sixties with a deeply lined weathered face, warm olive-brown skin, broad cheekbones, calm dark eyes, straight nose, and a slightly square jaw, teeth darkened from chewing betel; grey hair cropped level with the top of the ears and shaved close below, wearing a plain cotton lower cloth, seated on the veranda of a bamboo stilt house. (16:9 aspect ratio)

Image 3 (`portrait.m.elder.noble`):
Medium portrait: an elderly well-to-do Siamese household patriarch in his sixties with a lined dignified face, warm olive-brown skin, broad cheekbones, calm dark eyes, straight nose, and a slightly square jaw, teeth darkened from chewing betel; grey hair cropped level with the top of the ears and shaved close below, wearing a fine patterned silk lower cloth, seated on a reed mat beside a lacquered betel set inside a timber house. (16:9 aspect ratio)

Image 4 (`portrait.m.elder.official`):
Medium portrait: an elderly senior Siamese official in his sixties with a deeply lined face, warm olive-brown skin, broad cheekbones, calm dark eyes, straight nose, and a slightly square jaw, grey hair visible beneath a tall brimless white conical cloth hat (lomphok) with gold bands near the base and a chin cord; wearing an open-front collarless white muslin over-shirt with wide sleeves over a patterned silk lower cloth, seated on a reed mat inside a timber hall. Avoid: hat brim, wide-brimmed hat. (16:9 aspect ratio)

Image 5 (`portrait.m.elder.monk`):
Medium portrait: an elderly Siamese Buddhist monk in his sixties with a serene deeply lined face, warm olive-brown skin, broad cheekbones, calm dark eyes, and a straight nose; completely shaved head and shaved eyebrows, wearing a patched ochre-yellow robe, seated on a mat holding a palm-leaf fan inside a temple hall. (16:9 aspect ratio)
```

---

## ชุดที่ 5: ภาพตัวละครหญิง — วัยเด็ก วัยสาว วัยผู้ใหญ่ และตั้งครรภ์ (7 ภาพ — คนเดียวกันทุกภาพ)
- `portrait.f.child.commoner`
- `portrait.f.child.noble`
- `portrait.f.youth.commoner`
- `portrait.f.adult.commoner`
- `portrait.f.adult.minor_wife`
- `portrait.f.pregnant.commoner`
- `portrait.f.pregnant.noble`

```text
Please generate a series of 7 character portraits (16:9 aspect ratio) of the SAME Siamese female character across childhood, youth, adulthood, and motherhood in different social statuses. Keep her facial structure consistent across all images (warm olive-brown skin, gentle oval face, high cheekbones, calm dark eyes). If you can only generate one image per turn, generate #1 first and I will say "next" for the rest.

Style for all images:
"Historical illustration of everyday life in Siam (Ayutthaya kingdom), mid-18th century. Muted earthy watercolor and ink on textured paper, soft natural daylight, restrained palette of ochre, indigo, rust and off-white. Grounded, documentary, ordinary weathered faces without makeup. Adult women wear their black hair cropped level with the top of the ears, shaved close below, lifted off the forehead. Wrap cloths are wrapped horizontally across the chest with both ends draped back over both shoulders (never a one-shoulder diagonal sash). Avoid: modern clothing, tourist-poster look, fantasy costume, glossy digital rendering, glamour faces, makeup, buns or topknots on adult women, long loose hair, one-shoulder diagonal sash."

Image 1 (`portrait.f.child.commoner`):
Portrait from the shoulders up: an eight-year-old Siamese village girl with warm olive-brown skin, gentle oval face, high cheekbones, and calm dark eyes; shaved head with a small topknot of hair left on the crown, standing in a house yard. (16:9 aspect ratio)

Image 2 (`portrait.f.child.noble`):
Portrait from the shoulders up: an eight-year-old well-born Siamese girl with warm olive-brown skin, gentle oval face, high cheekbones, and calm dark eyes; shaved head with a neat topknot on the crown adorned with a small flower garland and gold pin, wearing small gold earrings on a timber veranda. (16:9 aspect ratio)

Image 3 (`portrait.f.youth.commoner`):
Portrait cropped at the upper shoulders in three-quarter view: a young Siamese village woman of about eighteen with warm olive-brown skin, gentle oval face, high cheekbones, and calm dark eyes; black hair cropped level with the top of the ears, shaved close below and combed up off the forehead; soft daylight against a woven bamboo wall. (16:9 aspect ratio)

Image 4 (`portrait.f.adult.commoner`):
Portrait cropped at the upper shoulders in three-quarter view: an adult Siamese village woman in her thirties with warm olive-brown skin, gentle oval face, high cheekbones, calm dark eyes, and a faint smile showing teeth darkened from chewing betel; black hair cropped level with the top of the ears and lifted off the forehead; bamboo house background. (16:9 aspect ratio)

Image 5 (`portrait.f.adult.minor_wife`):
Medium portrait: a young Siamese minor wife in her twenties with warm olive-brown skin, gentle oval face, high cheekbones, and calm dark eyes; black hair cropped level with the top of the ears and lifted off the forehead, seated modestly on a reed mat with legs folded to one side in a small bamboo-and-timber house, wearing a dark wrap skirt and a soft off-white cotton chest wrap covering the torso with both ends thrown back over both shoulders, small gold earrings. Avoid: one-shoulder diagonal sash. (16:9 aspect ratio)

Image 6 (`portrait.f.pregnant.commoner`):
Medium portrait in three-quarter profile: a visibly pregnant Siamese village woman in her twenties with warm olive-brown skin, gentle oval face, high cheekbones, and calm dark eyes; black hair cropped level with the top of the ears and lifted off the forehead, wearing a plain cotton chest wrap horizontally across the torso and a woven wrap skirt over her rounded pregnant abdomen, one hand resting gently on her belly, standing on the veranda of a bamboo stilt house. Avoid: one-shoulder diagonal sash. (16:9 aspect ratio)

Image 7 (`portrait.f.pregnant.noble`):
Medium portrait: a visibly pregnant well-to-do Siamese woman in her twenties with warm olive-brown skin, gentle oval face, high cheekbones, and calm dark eyes; black hair cropped level with the top of the ears and lifted off the forehead, wearing a black wrap skirt over her rounded pregnant abdomen and a white muslin chest wrap horizontally across the torso with its two ends thrown back over both shoulders, pear-shaped gold earrings, seated on a reed mat with one hand resting gently on her belly inside a timber house. Avoid: one-shoulder diagonal sash. (16:9 aspect ratio)
```

---

## ชุดที่ 6: ภาพตัวละครหญิงวัยชรา (และวัยสาว/ผู้ใหญ่ตระกูลขุนนาง) + ฉากแต่งงานรดน้ำสังข์คู่บ่าวสาว
> **แนะนำ:** ก๊อปปี้ไปวางต่อในแชตเดียวกับ **ชุดที่ 5** ได้เลย เพื่อให้ใบหน้าตัวละครหญิงเป็นคนเดิมต่อเนื่องไปจนถึงวัยชรา (รวม 3 ภาพหลัก หรือ 6 ภาพหากต้องการเปลี่ยนภาพสาว/ภรรยาขุนนางที่เคยใช้ภาพชั่วคราวด้วย)

### 6A. ภาพที่ขอนำเข้าเพิ่ม (3 ภาพ: หญิงชรา 2 ภาพ + ฉากแต่งงานรดน้ำสังข์คู่บ่าวสาว 1 ภาพ)
- `portrait.f.elder.commoner`
- `portrait.f.elder.noble`
- `scene.wedding`

```text
Please generate 3 more historical illustrations (16:9 aspect ratio) in this same style. For Images 1 and 2, depict the SAME Siamese female character from our previous portraits, now aged into her sixties. For Image 3, depict a traditional Siamese wedding ceremony showing the bride and groom side by side. If you can only generate one image per turn, generate #1 first and I will say "next" for #2 and #3.

Style for all images:
"Historical illustration of everyday life in Siam (Ayutthaya kingdom), mid-18th century. Muted earthy watercolor and ink on textured paper, soft natural daylight, restrained palette of ochre, indigo, rust and off-white. Grounded, documentary, ordinary weathered faces without makeup. Siamese adults of both sexes wear their hair cropped level with the top of the ears, shaved close below, lifted off the forehead, and their teeth are darkened from chewing betel. Wrap cloths on women are wrapped horizontally across the chest with both ends thrown back over both shoulders (never a one-shoulder diagonal sash). Avoid: modern clothing, tourist-poster look, fantasy costume, glossy digital rendering, glamour faces, makeup, buns or topknots on adult women, long loose hair, one-shoulder diagonal sash."

Image 1 (`portrait.f.elder.commoner`):
Portrait cropped at the upper shoulders: the same Siamese woman now in her sixties as an elderly village woman, with a deeply lined sun-weathered oval face, warm olive-brown skin, high cheekbones, calm dark eyes, grey hair cropped level with the top of the ears and lifted off the forehead, smiling slightly to show teeth darkened from chewing betel; plain background of a woven bamboo wall. (16:9 aspect ratio)

Image 2 (`portrait.f.elder.noble`):
Medium portrait: the same Siamese woman now in her sixties as an elderly well-to-do matriarch, with a lined dignified oval face, warm olive-brown skin, high cheekbones, calm dark eyes, grey hair cropped level with the top of the ears and lifted off the forehead, teeth darkened from chewing betel; wearing a black wrap skirt, a white muslin chest wrap horizontally across her chest with both ends thrown back over both shoulders, and gold pear-shaped earrings, seated on a reed mat beside a betel set inside a timber house. Avoid: one-shoulder diagonal sash. (16:9 aspect ratio)

Image 3 (`scene.wedding`):
Interior of a Siamese timber bridal house: a young Siamese bride and groom seated side by side on a reed mat with their palms pressed together in respectful greeting, wearing white sacred cotton thread circles linked between their heads; the bride has short cropped hair level with the top of the ears and wears a dark wrap skirt and a white muslin chest wrap horizontally across her chest with both ends thrown back over both shoulders, and the groom has short cropped hair and wears a fine patterned lower cloth; an elderly couple in front of them pouring blessing water from a white conch shell (rod nam sang) over the couple's joined hands above a brass bowl of flowers, footed trays of betel nut and offerings nearby, relatives watching warmly. Avoid: one-shoulder diagonal sash, modern bridal costume, tall crowns. (16:9 aspect ratio)
```

### 6B. (ทางเลือกเสริม) หากต้องการให้ภาพหญิงสาว/ผู้ใหญ่ตระกูลขุนนางอีก 3 ภาพ มีใบหน้าตรงกับชุดที่ 5 ด้วย
*(เดิม 3 ภาพนี้ใช้ภาพชั่วคราวจาก `art/approved/reality-wellborn-woman.jpg` อยู่)*
- `portrait.f.youth.noble`
- `portrait.f.adult.noble`
- `portrait.f.adult.head`

```text
Please generate 3 more portraits (16:9 aspect ratio) of the SAME Siamese female character in her noble / well-to-do roles (at age 18 and in her 30s), keeping her facial structure consistent (warm olive-brown skin, gentle oval face, high cheekbones, calm dark eyes):

Image 1 (`portrait.f.youth.noble`):
Medium portrait: the same Siamese woman at about eighteen as a young well-to-do woman with warm olive-brown skin, gentle oval face, high cheekbones, and calm dark eyes; black hair cropped level with the top of the ears and lifted off the forehead, wearing a black wrap skirt and a single white muslin chest wrap horizontally around her torso with its two ends thrown back over both shoulders, pear-shaped gold earrings, seated on a mat in a timber house. Avoid: one-shoulder diagonal sash. (16:9 aspect ratio)

Image 2 (`portrait.f.adult.noble`):
Medium portrait: the same Siamese woman in her thirties as a well-to-do noble principal wife with warm olive-brown skin, gentle oval face, high cheekbones, calm dark eyes, and teeth darkened from chewing betel; black hair cropped level with the top of the ears and lifted off the forehead, wearing a black wrap skirt and a white muslin chest wrap horizontally around her torso with its two loose ends draped back over both shoulders, pear-shaped gold earrings and gold finger rings, a lacquered betel box beside her. Avoid: one-shoulder diagonal sash. (16:9 aspect ratio)

Image 3 (`portrait.f.adult.head`):
Medium portrait: the same Siamese woman in her thirties as a dignified female household head with warm olive-brown skin, gentle oval face, high cheekbones, calm dark eyes, and teeth darkened from chewing betel; black hair cropped level with the top of the ears, wearing a fine black wrap skirt and a white muslin chest wrap horizontally around her torso with both ends draped over both shoulders, pear-shaped gold earrings and gold finger rings, seated upright beside a wooden chest and betel set inside a timber house. Avoid: one-shoulder diagonal sash. (16:9 aspect ratio)
```

