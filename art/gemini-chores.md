# Prompt สำหรับ Gemini: ฉากงานบ้าน (4 ภาพ)

> ตอนนี้ event เรื่องงานบ้านทุกหมวด (`chore.ask`, `chore.learn`) ขึ้นภาพลานครัวหมด ภาพชุดนี้แยกให้ตรงหมวดงาน
>
> **วิธีใช้:** วางทั้งก้อนใน Gemini เซฟภาพไว้ใน `art/generated/` ชื่อไฟล์อะไรก็ได้ แล้วบอก Claude ให้ตรวจ เปลี่ยนชื่อ และรัน `npm run art:ingest`

- `scene.chore_housework` — งานบ้าน: กวาดเรือน ขัดพื้น หาบน้ำ ขนฟืน
- `scene.chore_craft` — งานฝีมือ: สานเสื่อ เย็บผ้า ปักผ้า
- `scene.chore_flowers` — งานดอกไม้: ร้อยดอกไม้ พับกลีบบัว
- `scene.chore_merit` — งานบุญ: ใส่บาตร จัดของถวายวัด

```text
Please generate the following 4 historical illustrations in 16:9 aspect ratio. If you can only generate one image per turn, generate #1 first and I will say "next" for #2, #3, and #4.

Every image MUST strictly follow this exact STYLE & HISTORICAL RULE BLOCK:
"Historical illustration of everyday life in Siam (Ayutthaya kingdom), mid-18th century. Muted earthy watercolor and ink on textured paper, soft natural daylight, restrained palette of ochre, indigo, rust and off-white. Grounded, documentary, ordinary weathered faces without makeup. Unless stated otherwise, Siamese adults of both sexes wear their black hair cropped level with the top of the ears, the hair below shaved close, lifted off the forehead, and their teeth are blackened from chewing betel. Commoner men are bare-chested. A well-to-do woman's breast-cloth is wrapped around the chest covering both breasts, its two ends thrown back over both shoulders. Commoner houses are small, of woven split-bamboo panels raised on tall bamboo piles, entered by a short bamboo ladder hanging from the doorway by ropes with its foot off the ground. Any children present are bare-chested and wear a small lower cloth; children under eleven have shaved heads with a small topknot of hair left on the crown. Avoid: modern clothing or objects, tourist-poster look, fantasy costume, glossy digital rendering, glamour or model-like faces, makeup, buns or topknots on adult women, long loose hair, bob haircuts, a breast-cloth worn as a one-shoulder diagonal sash, modern Thai costume, shirts on commoner men, tiled roofs or ornate gable finials on commoner houses, ladders leaning on the ground, shorts or shirts on children."

Composition for every image: a full-bleed painting filling the whole 16:9 frame edge to edge, no white paper margins; the main figures and their hands clearly visible in the upper two-thirds, since the image may be cropped near the top.

Image 1 (`scene.chore_housework`):
Medium-wide view of a timber house platform and yard in the morning: a girl of about eight kneeling on the plank floor of the open veranda, rubbing the boards with half a coconut shell, a woven palm-rib broom and a bamboo water bucket beside her; below in the yard a boy of about ten carrying two bamboo water tubes on a shoulder pole toward the house and a small bundle of firewood stacked by a post; an older woman watching from the doorway. (16:9 aspect ratio)

Image 2 (`scene.chore_craft`):
Medium view of a shaded veranda of a house: an old woman seated on the floor plaiting a reed mat, strips of dried reed fanned out around her and a half-finished mat across her lap; beside her a girl of about ten, head bent, sewing a small piece of cotton cloth with a needle and thread, a flat basket of thread and cloth between them; afternoon light, a younger child playing in the shade under the house below. (16:9 aspect ratio)

Image 3 (`scene.chore_flowers`):
Medium view of women and a girl seated on a reed mat on a veranda, threading small white and yellow flowers onto long strings to make simple hanging strands, a flat round winnowing basket heaped with loose blossoms and a few pink lotus buds with folded-back petals, a bowl of water to keep the flowers fresh, a canal with a small boat visible beyond the house posts. Simple strands of flowers only. Avoid: elaborate modern garlands, ribbons, tassels. (16:9 aspect ratio)

Image 4 (`scene.chore_merit`):
Early morning in front of a house gate: a Buddhist monk in an ochre robe standing silently with his alms bowl held at his waist, eyes lowered; a woman and a child of about eight kneeling on a mat at the gate, the child lifting a spoonful of cooked rice from a covered bowl into the monk's bowl, a tray with bananas and small leaf-wrapped food beside them; misty light, bamboo fence, other houses in the background. (16:9 aspect ratio)
```

---

## ผลรอบแรก (1 พ.ย. 2569)

ได้มา 3 ภาพ ใช้ได้ทั้งหมด: งานบ้าน งานดอกไม้ และงานบุญ ส่วนงานฝีมือยังไม่ได้ เพราะโควตา Gemini หมดก่อน

ข้อบกพร่องที่ยอมรับไว้ก่อน มีจุดเดียวที่ซ้ำกันทุกภาพ คือผู้หญิงผู้ใหญ่ไว้ผมทรงบ็อบ และบางคนห่มผ้าเฉียงไหล่เดียว Gemini ยังวาดแบบนี้ซ้ำแม้ prompt จะห้ามไว้ ถ้าจะสร้างใหม่ ให้ใส่ประโยคบรรยายผมแบบด้านล่างลงไปในตัว prompt โดยตรง (รอบภาพนางขุนนางวิธีนี้ได้ผล)

### ภาพที่ยังขาด: `scene.chore_craft`

วางต่อจาก style block ข้างบน:

```text
Image (`scene.chore_craft`):
Full-bleed painting filling the whole 16:9 frame edge to edge, no white paper margins. Medium view of a shaded veranda of a house: an old woman seated on the floor plaiting a reed mat, strips of dried reed fanned out around her and a half-finished mat across her lap; her grey hair is cut very short like a man's, cropped level with the top of the ears, the sides shaved close, nothing hanging down; her dark breast-cloth wrapped horizontally around her chest with both ends thrown back over both shoulders. Beside her a girl of about ten, bare-chested in a small lower cloth, shaved head with a small topknot on the crown, head bent, sewing a small piece of cotton cloth with a needle and thread; a flat basket of thread and cloth between them; afternoon light, a younger child playing in the shade under the house below. Avoid: bob haircut, hair bun, hair covering the ears, one-shoulder diagonal sash, white borders. (16:9 aspect ratio)
```
