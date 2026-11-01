# ชุดเดียวส่งครั้งเดียว — ภาพ event เล็กๆ (5 ภาพ)

> **วิธีใช้:** ก๊อปกล่องโค้ดทั้งก้อนไปวางใน Gemini Chat แชตใหม่ครั้งเดียว แล้วพิมพ์แค่ **`next`** ทุกครั้งที่ได้ภาพ
> เซฟภาพลง `art/generated/<id>.jpg` ตามชื่อที่กำกับ แล้วรัน `npm run art:ingest`
>
> | # | id | ใช้กับ |
> |---|----|--------|
> | 1 | `scene.bedside_first` | `marriage.visit_first` — ไปค้างเรือนเมียครั้งแรก |
> | 2 | `scene.bedside_pregnant` | `marriage.visit_pregnant` — ไปค้างเรือนเมียที่ท้องแก่ |
> | 3 | `scene.bedside_cold` | `marriage.visit_cold` — ไปค้างเรือนเมียที่น้อยใจ |
> | 4 | `scene.court_minor` | `intent.court.minor` — เกี้ยวหญิงที่จะรับเป็นเมียน้อย |
> | 5 | `scene.river_rescue` | `life.drowning` — ช่วยคนตกน้ำ |
>
> ข้อควรระวังตอนคัดภาพ: ผ้าห่มอกของผู้หญิงต้องพาดสองไหล่ (ไม่ใช่สไบเฉียง) ผมของหญิงยาวระดับใบหู (ไม่เกรียนจนเหมือนผู้ชาย)
> ภาพ 1–3 ผู้ชายผู้หญิงแต่งกายเรียบร้อยครบ ไม่มีฉากเชิงเพศ ถ้า Gemini ปฏิเสธหรือวาดล่อแหลม ให้ลดคำว่า "bedchamber" เป็น "inner room"
> เตียงนอนแบบแท่นไม้ยกเตี้ย ที่นอนบาง หมอนสามเหลี่ยม มุ้ง เป็นการอนุมาน (ไม่มี lore ตรงๆ) — จดไว้ใน BACKLOG

```text
Please generate the following 5 historical illustrations, each in 16:9 aspect ratio. Generate one image per turn: start with Image 1 now, and after each image I will simply say "next" for the following one. Do not skip or merge images.

Every image MUST strictly follow this exact STYLE & HISTORICAL RULE BLOCK:
"Historical illustration of everyday life in Siam (Ayutthaya kingdom), mid-18th century. Muted earthy watercolor and ink on textured paper, soft natural daylight, restrained palette of ochre, indigo, rust and off-white. Grounded, documentary, ordinary weathered faces without makeup. Unless stated otherwise, Siamese adults of both sexes wear their black hair cropped level with the top of the ears, the hair below shaved close, lifted off the forehead, and their teeth are blackened from chewing betel. Commoner men are bare-chested. A well-to-do woman's breast-cloth is wrapped around the chest covering both breasts, its two ends thrown back over both shoulders. Commoner houses are small, of woven split-bamboo panels raised on tall bamboo piles, entered by a short bamboo ladder hanging from the doorway by ropes with its foot off the ground. Any children present are bare-chested and wear a small lower cloth; children under eleven have shaved heads with a small topknot of hair left on the crown. Avoid: modern clothing or objects, tourist-poster look, fantasy costume, glossy digital rendering, glamour or model-like faces, makeup, buns or topknots on adult women, long loose hair, bob haircuts, a breast-cloth worn as a one-shoulder diagonal sash, modern Thai costume, shirts on commoner men, tiled roofs or ornate gable finials on commoner houses, ladders leaning on the ground, shorts or shirts on children."

Image 1 (`scene.bedside_first`):
Interior of a small timber bedchamber at night, lit by a single small oil lamp standing on the floor: a Siamese man in his thirties and a young woman in her twenties sit side by side on the edge of a low raised wooden sleeping platform covered with a thin cotton mattress and a woven mat, a rolled triangular pillow and a mosquito net tied up above; he gently holds her hand in both of his, she looks shyly down at their hands and then up toward his face; she wears a dark wrap skirt and a single white muslin breast-cloth wrapped horizontally around her chest covering both breasts with both ends clearly thrown back over BOTH shoulders; he is bare-chested in a knee-length lower cloth; modest and tender, both fully clothed, seen from the side at a respectful distance. (16:9 aspect ratio)

Image 2 (`scene.bedside_pregnant`):
Interior of a small timber bedchamber at night, lit by a single small oil lamp on the floor: a visibly pregnant Siamese woman in her twenties sits propped against a rolled pillow on a low raised wooden sleeping platform with a thin cotton mattress and woven mat, her rounded belly under a dark wrap skirt, wearing a white muslin breast-cloth wrapped horizontally around her chest covering both breasts with both ends thrown back over BOTH shoulders; a Siamese man in his thirties, bare-chested in a lower cloth, sits beside her holding her hand in one hand with his other hand resting gently on the mat near her belly, both looking into each other's eyes with tired warm smiles; mosquito net tied up above; modest, fully clothed, seen from the side. (16:9 aspect ratio)

Image 3 (`scene.bedside_cold`):
Interior of a small timber bedchamber at night, lit by a single small oil lamp on the floor: a young Siamese woman in her twenties sits at the far end of a low raised wooden sleeping platform, turned half away with her arms wrapped around her drawn-up knees and her eyes lowered, wearing a dark wrap skirt and a white muslin breast-cloth wrapped horizontally around her chest covering both breasts with both ends thrown back over BOTH shoulders; a Siamese man in his thirties, bare-chested in a lower cloth, sits near the other end holding a small cloth-wrapped gift in both hands, looking at her with a hesitant, apologetic expression; an untouched lacquered tray of rice and a bowl on the floor beside the platform; silent, tense mood, both fully clothed. (16:9 aspect ratio)

Image 4 (`scene.court_minor`):
Dusk at the foot of a small bamboo stilt house: a Siamese man in his thirties, bare-chested in a knee-length lower cloth, stands at the bottom of the hanging bamboo ladder holding up a small footed tray of betel leaves and areca nuts; at the top of the ladder on the veranda a young woman in a dark wrap skirt and a white breast-cloth wrapped around her chest covering both breasts with both ends thrown back over both shoulders looks down at him with arms folded, guarded and thoughtful; her father and mother sit in the doorway behind her, the mother holding a palm-leaf fan, listening quietly; banana trees, a canal glimpsed behind, warm evening light. (16:9 aspect ratio)

Image 5 (`scene.river_rescue`):
A muddy canal landing just after rain: a bare-chested Siamese man in a knee-length lower cloth, waist-deep in brown water, lifting a coughing child of about seven with a shaved head, a small topknot and a small wet lower cloth toward the muddy bank, a bamboo pole floating nearby and a small dugout boat tipped against a post; in the background two or three villagers running down the bank, one reaching out a hand; wet, urgent but not violent, overcast light. (16:9 aspect ratio)
```
