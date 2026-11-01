# Prompt สำหรับ Gemini: ภาพตัวละครที่ต้องทำใหม่ (9 ภาพ)

> ภาพในช่องเหล่านี้ตอนนี้เป็นภาพแทน (ไฟล์ซ้ำกันหลายช่อง หรือภาพหลายคน/เต็มตัวที่หน้าเล็กเกินไป) และ `portrait.f.youth.commoner` ทรงผมยาวปิดหูผิดยุค
>
> **วิธีใช้:** เหมือน [gemini-batches.md](gemini-batches.md) — วางทีละชุดใน Gemini, เซฟภาพเป็น `art/generated/<id>.jpg` แล้วบอก Claude ให้รัน `npm run art:ingest`
> ภาพตัวละครแสดงในกรอบ 16:9 ที่ตัดเหลือส่วนบน จึงขอคนเดียว หน้าอยู่ค่อนบน

---

## ชุดที่ 1: ชายชาวบ้านและขุนนาง 3 กรม (5 ภาพ — คนเดียวกันทุกภาพ)
- `portrait.m.youth.commoner`
- `portrait.m.adult.commoner`
- `portrait.m.adult.official_patrol`
- `portrait.m.adult.official_palace`
- `portrait.m.adult.official_scholar`

```text
Please generate the following 5 character portraits (16:9 aspect ratio) of the SAME Siamese man; keep his face consistent across all images. If you can only generate one image per turn, generate #1 first and I will say "next" for the rest.

Every image MUST strictly follow this exact STYLE & HISTORICAL RULE BLOCK:
"Historical illustration of everyday life in Siam (Ayutthaya kingdom), mid-18th century. Muted earthy watercolor and ink on textured paper, soft natural daylight, restrained palette of ochre, indigo, rust and off-white. Grounded, documentary, ordinary weathered faces without makeup. Unless stated otherwise, Siamese adults of both sexes wear their black hair cropped level with the top of the ears, the hair below shaved close, lifted off the forehead, and their teeth are blackened from chewing betel. A well-to-do woman's wrap cloth is wrapped horizontally around the chest, its two ends thrown back over both shoulders. Commoner houses are small, of woven split-bamboo panels raised on tall bamboo piles, entered by a short bamboo ladder hanging from the doorway by ropes with its foot off the ground. Children under eleven have shaved heads with a small topknot of hair left on the crown and wear traditional woven lower cloths. Avoid: modern clothing or objects, tourist-poster look, fantasy costume, glossy digital rendering, glamour or model-like faces, makeup, buns or topknots on adult women, long loose hair, bob haircuts, one-shoulder diagonal sash, modern Thai costume, tiled roofs or ornate gable finials on commoner houses, ladders leaning on the ground."

Composition for every image: ONE person only, no other people in frame; framed from the waist or chest up, face in the upper third of the image and fully visible, simple background of the setting described; the image will be cropped to a 16:9 window aligned near the top.

Image 1 (`portrait.m.youth.commoner`):
Medium portrait from the waist up: a Siamese commoner young man of about eighteen with warm olive-brown skin, broad cheekbones, calm dark eyes, straight nose, and a slightly square jaw; black hair cropped level with the top of the ears and shaved close below, bare-chested, no shirt, wearing a knee-length painted-cotton lower cloth, standing beside a bamboo fence. (16:9 aspect ratio)

Image 2 (`portrait.m.adult.commoner`):
Medium portrait from the waist up: a Siamese commoner man in his thirties with a sun-weathered face, warm olive-brown skin, broad cheekbones, calm dark eyes, straight nose, and a slightly square jaw, teeth blackened from chewing betel; black hair cropped level with the top of the ears and shaved close below, bare-chested, no shirt, wearing a knee-length cotton lower cloth tucked at the back, standing in front of a bamboo stilt house. (16:9 aspect ratio)

Image 3 (`portrait.m.adult.official_patrol`):
Medium portrait: a Siamese patrol-department official in his thirties with warm olive-brown skin, broad cheekbones, calm dark eyes, straight nose, and a slightly square jaw; wearing an open-front collarless white muslin over-shirt with wide sleeves over a patterned silk lower cloth, and a tall brimless white conical cloth hat (lomphok) with thin gold bands near the base and a chin cord; a sheathed sword resting on a stand beside him inside a timber hall. Avoid: hat brim, wide-brimmed hat. (16:9 aspect ratio)

Image 4 (`portrait.m.adult.official_palace`):
Medium portrait: a Siamese palace-chamber official in his thirties with warm olive-brown skin, broad cheekbones, calm dark eyes, straight nose, and a slightly square jaw; seated cross-legged on a reed mat in a palace hall, wearing an open-front collarless white muslin over-shirt with wide sleeves over a rich patterned silk lower cloth, and a tall brimless white conical cloth hat (lomphok) with gold bands and chin cord, a footed brass tray and betel box beside him. Avoid: hat brim, wide-brimmed hat. (16:9 aspect ratio)

Image 5 (`portrait.m.adult.official_scholar`):
Medium portrait: a Siamese royal-scholar official in his thirties with warm olive-brown skin, broad cheekbones, calm dark eyes, straight nose, and a slightly square jaw; seated cross-legged on a reed mat, wearing an open-front collarless white muslin over-shirt with wide sleeves over a silk lower cloth, and a tall brimless white conical cloth hat (lomphok) with gold bands and chin cord, an accordion-folded black khoi-paper manuscript (samut thai dam) and white steatite stylus on a low tray before him. Avoid: hat brim, wide-brimmed hat. (16:9 aspect ratio)
```

---

## ชุดที่ 2: หญิงสาวและนางขุนนาง (4 ภาพ)
- `portrait.f.youth.noble`
- `portrait.f.adult.noble`
- `portrait.f.adult.head`
- `portrait.f.youth.commoner`

```text
Please generate the following 4 character portraits (16:9 aspect ratio). Images 1-3 show the SAME well-born woman at different ages and roles; image 4 is a different village woman. If you can only generate one image per turn, generate #1 first and I will say "next" for the rest.

Every image MUST strictly follow this exact STYLE & HISTORICAL RULE BLOCK:
"Historical illustration of everyday life in Siam (Ayutthaya kingdom), mid-18th century. Muted earthy watercolor and ink on textured paper, soft natural daylight, restrained palette of ochre, indigo, rust and off-white. Grounded, documentary, ordinary weathered faces without makeup. Unless stated otherwise, Siamese adults of both sexes wear their black hair cropped level with the top of the ears, the hair below shaved close, lifted off the forehead, and their teeth are blackened from chewing betel. A well-to-do woman's wrap cloth is wrapped horizontally around the chest, its two ends thrown back over both shoulders. Commoner houses are small, of woven split-bamboo panels raised on tall bamboo piles, entered by a short bamboo ladder hanging from the doorway by ropes with its foot off the ground. Children under eleven have shaved heads with a small topknot of hair left on the crown and wear traditional woven lower cloths. Avoid: modern clothing or objects, tourist-poster look, fantasy costume, glossy digital rendering, glamour or model-like faces, makeup, buns or topknots on adult women, long loose hair, bob haircuts, one-shoulder diagonal sash, modern Thai costume, tiled roofs or ornate gable finials on commoner houses, ladders leaning on the ground."

Composition for every image: ONE person only, no other people in frame; framed from the waist or chest up, face in the upper third of the image and fully visible, simple background of the setting described; the image will be cropped to a 16:9 window aligned near the top.

Image 1 (`portrait.f.youth.noble`):
Medium portrait: a young well-to-do Siamese woman of about eighteen with warm olive-brown skin, gentle oval face, high cheekbones, and calm dark eyes; black hair cropped level with the top of the ears and lifted off the forehead, wearing a black wrap skirt and a single white muslin breast-cloth wrapped horizontally around her chest covering both breasts with its two ends thrown back over both shoulders, pear-shaped gold earrings, seated on a mat in a timber house. Avoid: one-shoulder diagonal sash. (16:9 aspect ratio)

Image 2 (`portrait.f.adult.noble`):
Medium portrait: a well-to-do Siamese noble wife in her thirties with warm olive-brown skin, gentle oval face, high cheekbones, calm dark eyes, and teeth blackened from chewing betel; black hair cropped level with the top of the ears and lifted off the forehead, wearing a black wrap skirt and a single white muslin breast-cloth wrapped around her chest covering both breasts with its two loose ends draped back over both shoulders, pear-shaped gold earrings and gold rings on her last three fingers, a lacquered betel box beside her. Avoid: one-shoulder diagonal sash. (16:9 aspect ratio)

Image 3 (`portrait.f.adult.head`):
Medium portrait: a dignified Siamese female household head in her thirties with warm olive-brown skin, gentle oval face, high cheekbones, calm dark eyes, and teeth blackened from chewing betel; black hair cropped level with the top of the ears, wearing a fine black wrap skirt and a white muslin breast-cloth wrapped around her chest covering both breasts with both ends draped over both shoulders, pear-shaped gold earrings and gold finger rings, seated upright beside a wooden chest and betel set inside a timber house. Avoid: one-shoulder diagonal sash. (16:9 aspect ratio)

Image 4 (`portrait.f.youth.commoner`):
Portrait cropped from the upper shoulders up in three-quarter view: a young Siamese village woman of about eighteen with warm olive-brown skin, gentle oval face, high cheekbones, and calm dark eyes; black hair cropped level with the top of the ears, shaved close below and combed up off the forehead; soft daylight against a woven bamboo wall. (16:9 aspect ratio)
```

---

## ผลรอบแรก (1 พ.ย. 2569) และภาพที่ยังขาด

ได้ภาพที่ใช้ได้ 3 ภาพ: หญิงสาวขุนนาง หญิงเจ้าเรือน และหญิงไพร่สาว
ภาพที่ไม่ผ่านมี 3 ภาพ เก็บไว้ที่ `art/generated/unused/`
- ทรงผมเป็นบ็อบเกล้าสูง ทั้งที่กติกาห้ามไว้
- ข้างภาพเป็นกระดาษขาวว่าง ซึ่งจะโผล่ออกมาเมื่อตัดเข้ากรอบ

ตอนนี้ `portrait.f.adult.noble` ยืมภาพหญิงสาวขุนนางไปใช้ก่อน เลยยังต้องสร้างภาพนี้ใหม่อีก 1 ภาพ ให้วาง prompt ด้านล่างต่อจาก style block ของชุดที่ 2:

```text
Image (`portrait.f.adult.noble`):
Medium portrait, full-bleed painting filling the whole 16:9 frame edge to edge with no white paper margins: a well-to-do Siamese noble wife of about thirty-five, visibly older than an eighteen-year-old, with warm olive-brown skin, gentle oval face, high cheekbones, faint lines at the eyes, calm dark eyes, and teeth blackened from chewing betel; her black hair is cut very short like a man's, cropped level with the top of the ears, the sides and back shaved close, the top brushed straight up off the forehead, nothing hanging down; wearing a black wrap skirt and a white muslin breast-cloth wrapped horizontally around her chest with both ends thrown back over both shoulders, pear-shaped gold earrings and gold rings on her last three fingers, seated on a reed mat beside a lacquered betel box in a timber house. Avoid: bob haircut, hair bun, hair covering the ears, hair longer than the earlobe, white borders, one-shoulder diagonal sash. (16:9 aspect ratio)
```
