export function parseTeeTime(teeValue: string | undefined | null): string | null {
  if (!teeValue) {
    return null;
  }
  const teeDate = new Date(teeValue);
  if (Number.isNaN(teeDate.getTime())) {
    return null;
  }
  return teeDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}
