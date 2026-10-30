/** Freedom Pay signature helpers (pure, testable). */
export type FpParams = Record<string, string>;

/** Values sorted by key, joined as `script;v1;v2;...;secret`. pg_sig itself is excluded. */
export function fpSignString(script: string, params: FpParams, secret: string): string {
  const values = Object.keys(params)
    .filter((k) => k !== "pg_sig")
    .sort()
    .map((k) => params[k]);
  return [script, ...values, secret].join(";");
}

export async function fpSign(script: string, params: FpParams, secret: string): Promise<string> {
  const { createHash } = await import("node:crypto");
  return createHash("md5").update(fpSignString(script, params, secret), "utf8").digest("hex");
}

export async function fpVerify(script: string, params: FpParams, secret: string): Promise<boolean> {
  const sig = params["pg_sig"];
  if (!sig) return false;
  const expected = await fpSign(script, params, secret);
  const { timingSafeEqual } = await import("node:crypto");
  const a = Buffer.from(sig.toLowerCase());
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function xmlValue(xml: string, tag: string): string | null {
  const m = xml.match(new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${tag}>`));
  return m?.[1] ? m[1].trim() : null;
}
