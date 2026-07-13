import { zh, type ZhKey } from './zh';

export function t(key: ZhKey, vars?: Record<string, string | number>): string {
  let s: string = zh[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      s = s.replace(`{${k}}`, String(v));
    }
  }
  return s;
}

export type { ZhKey };
