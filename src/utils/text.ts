export function normalizeName(name: string = ''): string {
  return name
    .toUpperCase()
    .replace(/\(A\)/g, '')
    .replace(/\./g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function truncateText(text: string, maxChars: number): string {
  if (text.length <= maxChars) {
    return text;
  }
  if (maxChars <= 3) {
    return text.slice(0, maxChars);
  }
  return `${text.slice(0, maxChars - 3)}...`;
}

export function padCell(value: string | number | null | undefined, width: number, align: 'left' | 'right'): string {
  const text = `${value == null ? '--' : value}`;
  if (text.length >= width) {
    return text.slice(0, width);
  }
  const pad = ' '.repeat(width - text.length);
  return align === 'left' ? `${text}${pad}` : `${pad}${text}`;
}

export function padEndText(value: string | number | null | undefined, width: number): string {
  const text = `${value == null ? '' : value}`;
  if (text.length >= width) {
    return text.slice(0, width);
  }
  return `${text}${' '.repeat(width - text.length)}`;
}

export function padStartText(value: string | number | null | undefined, width: number): string {
  const text = `${value == null ? '' : value}`;
  if (text.length >= width) {
    return text.slice(0, width);
  }
  return `${' '.repeat(width - text.length)}${text}`;
}
