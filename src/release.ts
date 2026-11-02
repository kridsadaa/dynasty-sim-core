import changelog from './changelog.json';

// ข้อมูลรุ่นของเกม — เลขรุ่นมาจาก package.json, git hash และวันที่ build ฉีดตอน build โดย vite.config.ts
// เพิ่มรุ่นใหม่: เติม entry บนสุดของ src/changelog.json แล้วขึ้นเลข version ใน package.json ให้ตรงกัน (release.test.ts เช็ก)

export interface ChangelogEntry {
  version: string;
  date: string; // YYYY-MM-DD
  summary?: string;
  added?: string[];
  changed?: string[];
  fixed?: string[];
}

export const CHANGELOG: readonly ChangelogEntry[] = changelog;

export const APP_VERSION: string = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : CHANGELOG[0]!.version;
export const GIT_HASH: string = typeof __GIT_HASH__ === 'string' ? __GIT_HASH__ : 'dev';
export const BUILD_DATE: string = typeof __BUILD_DATE__ === 'string' ? __BUILD_DATE__ : '';

export const REPO_URL = 'https://github.com/kridsadaa/dynasty-sim-core';
export const CREATOR = 'kridsadaa';

export const releaseNotes = (version: string): ChangelogEntry | undefined => CHANGELOG.find((e) => e.version === version);

/** วันที่แบบไทย พ.ศ. เช่น 2 พ.ย. 2569 */
export function thaiDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('th-TH-u-ca-buddhist', { day: 'numeric', month: 'short', year: 'numeric' });
}
