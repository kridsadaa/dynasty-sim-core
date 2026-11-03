# ชุดเดียวส่งครั้งเดียว — รอบ 03b (5 ภาพ, ไม่แนบภาพอ้างอิง)

> **วิธีใช้:** ก๊อปกล่องโค้ดด้านล่างทั้งก้อนไปวางใน Gemini Chat แชตใหม่ครั้งเดียว **ไม่ต้องแนบภาพ** แล้วพิมพ์แค่ **`next`** ทุกครั้งที่ได้ภาพ
> เซฟภาพลง `art/rounds/03b/out/<id>.jfif` (หรือ .jpg) ตามชื่อที่กำกับ แล้วบอก Claude
>
> | # | id | โจทย์ | ดูอะไร |
> |---|----|-------|--------|
> | 1 | `S1-a` | ขุนนาง | ผ้านุ่งจีบพองลอดหว่างขา (ไม่ใช่ผ้าถุง) |
> | 2 | `S2-a` | ชายสามัญ | ผ้านุ่งจีบพองถึงเข่า + บันไดแขวน |
> | 3 | `S3-a` | หญิงมีฐานะ | ผ้าห่มพาดสองไหล่ (ไม่ใช่สไบเฉียง) |
> | 4 | `S1-b` | ขุนนาง (ซ้ำ) | ความคงที่ |
> | 5 | `S2-b` | ชายสามัญ (ซ้ำ) | ความคงที่ |
>
> ลำดับสลับโจทย์ตั้งใจ เพื่อไม่ให้ภาพซ้ำติดกันแล้วลอกกันเอง แต่ภาพที่ 4–5 อาจได้รับอิทธิพลจากภาพก่อนหน้าในแชตเดียวกัน ถ้าดูผิดปกติบอกผม จะให้สร้างใหม่ในแชตแยก
> ต่างจากรอบ 03: style block ถูกวางครั้งเดียวต้นแชต (เหมือนการผลิตจริง) ไม่ได้ติดทุก prompt — เนื้อ prompt ของแต่ละโจทย์เหมือนรอบ 03 ตัดย่อหน้าภาพอ้างอิงออก

```text
Please generate the following 5 historical illustrations, each in 16:9 aspect ratio. Generate one image per turn: start with Image 1 now, and after each image I will simply say "next" for the following one. Do not skip or merge images. Keep the same painterly style for all 5.

Every image MUST strictly follow this exact STYLE & HISTORICAL RULE BLOCK:
"Historical illustration of everyday life in Siam (Ayutthaya kingdom), mid-18th century. Muted earthy watercolor and ink on textured paper, soft natural daylight, restrained palette of ochre, indigo, rust and off-white. Grounded, documentary, ordinary weathered faces without makeup. Unless stated otherwise, Siamese adults of both sexes wear their black hair cropped level with the top of the ears, the hair below shaved close, lifted off the forehead, and their teeth are blackened from chewing betel. Commoner men are bare-chested. A well-to-do woman's breast-cloth is wrapped around the chest covering both breasts, its two ends thrown back over both shoulders. Commoner houses are small, of woven split-bamboo panels raised on tall bamboo piles, entered by a short bamboo ladder hanging from the doorway by ropes with its foot off the ground. Any children present are bare-chested and wear a small lower cloth; children under eleven have shaved heads with a small topknot of hair left on the crown. Avoid: modern clothing or objects, tourist-poster look, fantasy costume, glossy digital rendering, glamour or model-like faces, makeup, buns or topknots on adult women, long loose hair, bob haircuts, a breast-cloth worn as a one-shoulder diagonal sash, modern Thai costume, shirts on commoner men, tiled roofs or ornate gable finials on commoner houses, ladders leaning on the ground, shorts or shirts on children."

Image 1 (`S1-a`):
Full-body view: a Siamese official, an adult man in his forties, standing in a timber house doorway, three-quarter view, wearing an open-front collarless white muslin over-shirt with very wide sleeves reaching almost to the wrist, hanging to the hips, over a patterned silk lower cloth. The lower cloth is NOT a wrapped skirt, sarong or trousers: its two ends are pulled together between the legs and tucked in at the back, so it forms loose pleated breeches that end at the knee, with the lower legs bare. Avoid: sarong, longyi, wrapped skirt, shorts hanging loose, long trousers. On his head is a tall, narrow, brimless white cloth hat shaped like a slender cone, about as tall as his head again, with thin gold bands near the base, tied under the chin with a cord. Barefoot; a pair of pointed heel-less slippers set beside him. Avoid also: hat brim, wide-brimmed hat, witch hat, farmer's hat, conical straw hat. (16:9 aspect ratio)

Image 2 (`S2-a`):
Full-body view: a Siamese commoner man in his twenties, bare-chested and barefoot, wearing a knee-length painted-cotton lower cloth, standing in front of a small bamboo stilt house whose doorway has a short bamboo ladder hanging from it by ropes, holding a woven fish trap. The lower cloth is NOT a wrapped skirt, sarong or trousers: its two ends are pulled together between the legs and tucked in at the back, so it forms loose pleated breeches that end at the knee, with the lower legs bare. Avoid: sarong, longyi, wrapped skirt, shorts hanging loose, long trousers. (16:9 aspect ratio)

Image 3 (`S3-a`):
Medium shot: a well-to-do Siamese woman in her thirties sitting on a reed mat with both legs folded to one side, wearing a black wrap skirt and a single white muslin cloth wrapped once around her chest covering both breasts, its two loose ends draped back over both shoulders like a shawl and hanging down on both sides; pear-shaped gold earrings, several rings on her last three fingers; a betel box beside her. Avoid also: one-shoulder sash, diagonal sash, cloth over only one shoulder, hair bun. (16:9 aspect ratio)

Image 4 (`S1-b`):
Full-body view: a Siamese official, an adult man in his forties, standing in a timber house doorway, three-quarter view, wearing an open-front collarless white muslin over-shirt with very wide sleeves reaching almost to the wrist, hanging to the hips, over a patterned silk lower cloth. The lower cloth is NOT a wrapped skirt, sarong or trousers: its two ends are pulled together between the legs and tucked in at the back, so it forms loose pleated breeches that end at the knee, with the lower legs bare. Avoid: sarong, longyi, wrapped skirt, shorts hanging loose, long trousers. On his head is a tall, narrow, brimless white cloth hat shaped like a slender cone, about as tall as his head again, with thin gold bands near the base, tied under the chin with a cord. Barefoot; a pair of pointed heel-less slippers set beside him. Avoid also: hat brim, wide-brimmed hat, witch hat, farmer's hat, conical straw hat. (16:9 aspect ratio)

Image 5 (`S2-b`):
Full-body view: a Siamese commoner man in his twenties, bare-chested and barefoot, wearing a knee-length painted-cotton lower cloth, standing in front of a small bamboo stilt house whose doorway has a short bamboo ladder hanging from it by ropes, holding a woven fish trap. The lower cloth is NOT a wrapped skirt, sarong or trousers: its two ends are pulled together between the legs and tucked in at the back, so it forms loose pleated breeches that end at the knee, with the lower legs bare. Avoid: sarong, longyi, wrapped skirt, shorts hanging loose, long trousers. (16:9 aspect ratio)
```
