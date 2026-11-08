// ชั้นยุค (docs/design-eras.md): ยุคของเกมและสถาบัน/กฎหมายที่มีอยู่เฉพาะบางช่วง — อ่านจาก rules.json ที่เดียว
// ระบบอื่นถามที่นี่แทนการฝังปีไว้ในโค้ด เพื่อให้ขยายเรื่องถึง 2484 (PLAN 4c) แก้ที่ข้อมูลได้
import { yearOf, type Ctx } from '../core/ctx';
import type { EraDef, InstitutionId } from '../core/types';

/** ยุคของปีนี้ (ปีนอกช่วง = ยุคแรก/ยุคสุดท้ายที่ใกล้ที่สุด) */
export function eraAt(ctx: Ctx, year = yearOf(ctx, ctx.state.meta.day)): EraDef {
  const eras = ctx.content.eras;
  return eras.find((e) => year >= e.from && year < e.to) ?? (year < eras[0]!.from ? eras[0]! : eras[eras.length - 1]!);
}

/** สถาบันนี้ยังมีอยู่ในปีนี้ไหม (เช่น ทาส การเกณฑ์ไพร่ รายได้ตามศักดินา นามสกุล การปลูกฝี) */
export function institutionActive(ctx: Ctx, id: InstitutionId, year = yearOf(ctx, ctx.state.meta.day)): boolean {
  const def = ctx.content.institutions[id];
  return year >= (def.from ?? -Infinity) && year <= (def.until ?? Infinity) && !(def.gaps ?? []).some(([a, b]) => year >= a && year <= b);
}
