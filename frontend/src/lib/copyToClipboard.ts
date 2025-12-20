/**
 * Копіює текст у буфер обміну
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    } else {
      // Fallback для старих браузерів
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      return successful;
    }
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
}

/**
 * Копіює таблицю у форматі TSV (Tab-Separated Values)
 */
export function copyTableToClipboard(
  headers: string[],
  rows: string[][]
): string {
  const lines = [
    headers.join('\t'),
    ...rows.map(row => row.join('\t'))
  ];
  return lines.join('\n');
}

/**
 * Форматує значення для копіювання
 */
export function formatValueForCopy(value: any): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'Так' : 'Ні';
  if (value instanceof Date) return value.toLocaleString('uk-UA');
  return String(value);
}

