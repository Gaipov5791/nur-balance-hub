export function specItems(spec: string) {
  return spec.split(/[,;•|]/).map((s) => s.trim()).filter(Boolean);
}

export function priceParts(label: string) {
  return label.split(/\s*[·•|]\s*/).map((s) => s.trim()).filter(Boolean);
}

export function toTelHref(raw: string) {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("8")) return `+7${digits.slice(1)}`;
  if (digits.length === 11 && digits.startsWith("7")) return `+${digits}`;
  if (digits.length === 10) return `+7${digits}`;
  return digits ? `+${digits}` : "";
}

export function formatPhone(raw: string) {
  const href = toTelHref(raw);
  const d = href.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("7")) {
    return `+7 ${d.slice(1, 4)} ${d.slice(4, 7)} ${d.slice(7, 9)} ${d.slice(9)}`;
  }
  return raw.trim();
}

export function extractPhone(text: string) {
  const m = text.match(/(?:\+7|8|\b7)[\s-]?\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}/);
  return m ? formatPhone(m[0]) : null;
}

export function extractInstagram(text: string) {
  const labeled = text.match(/instagram:\s*@?([A-Za-z0-9._]+)/i);
  if (labeled?.[1]) return labeled[1];
  return null;
}
