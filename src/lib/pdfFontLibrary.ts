const FONT_LIBRARY: Record<string, { file: string }> = {
  'inter': { file: '/fonts/pdf-editor/Inter-Variable.ttf' },
  'roboto': { file: '/fonts/pdf-editor/Roboto-Variable.ttf' },
  'opensans': { file: '/fonts/pdf-editor/OpenSans-Variable.ttf' },
  'lato': { file: '/fonts/pdf-editor/Lato-Variable.ttf' },
  'montserrat': { file: '/fonts/pdf-editor/Montserrat-Variable.ttf' },
  'sourcesanspro': { file: '/fonts/pdf-editor/Inter-Variable.ttf' },
  'sourcesans3': { file: '/fonts/pdf-editor/Inter-Variable.ttf' },
  'liberationsans': { file: '/fonts/pdf-editor/LiberationSans-Regular.ttf' },
  'liberationserif': { file: '/fonts/pdf-editor/LiberationSerif-Regular.ttf' },
  'liberationmono': { file: '/fonts/pdf-editor/LiberationMono-Regular.ttf' },
  'helvetica': { file: '/fonts/pdf-editor/Inter-Variable.ttf' },
  'helveticaneue': { file: '/fonts/pdf-editor/Inter-Variable.ttf' },
  'arial': { file: '/fonts/pdf-editor/LiberationSans-Regular.ttf' },
  'timesnewroman': { file: '/fonts/pdf-editor/LiberationSerif-Regular.ttf' },
  'times': { file: '/fonts/pdf-editor/LiberationSerif-Regular.ttf' },
  'courier': { file: '/fonts/pdf-editor/LiberationMono-Regular.ttf' },
  'couriernew': { file: '/fonts/pdf-editor/LiberationMono-Regular.ttf' },
};

const ALIASES: Record<string, string> = {
  'arialmt': 'arial',
  'arial-boldmt': 'arial',
  'timesnewromanpsmt': 'timesnewroman',
  'timesnewromanps-boldmt': 'timesnewroman',
  'couriernewe': 'couriernew',
  'helvetica-bold': 'helvetica',
  'inter-regular': 'inter',
  'inter-bold': 'inter',
  'roboto-regular': 'roboto',
  'roboto-bold': 'roboto',
  'opensans-regular': 'opensans',
  'lato-regular': 'lato',
  'montserrat-regular': 'montserrat',
};

function normalizeFontName(pdfFontName: string): string {
  let name = pdfFontName;
  const plusIndex = name.indexOf('+');
  if (plusIndex !== -1) {
    name = name.substring(plusIndex + 1);
  }
  return name.toLowerCase().replace(/[\s\-_]/g, '');
}

export function matchFont(pdfFontName: string): { path: string; source: 'library' } | null {
  const normalized = normalizeFontName(pdfFontName);

  if (FONT_LIBRARY[normalized]) {
    return { path: FONT_LIBRARY[normalized].file, source: 'library' };
  }

  if (ALIASES[normalized] && FONT_LIBRARY[ALIASES[normalized]]) {
    return { path: FONT_LIBRARY[ALIASES[normalized]].file, source: 'library' };
  }

  for (const [key, entry] of Object.entries(FONT_LIBRARY)) {
    if (normalized.includes(key)) {
      return { path: entry.file, source: 'library' };
    }
  }

  return null;
}

export function getDefaultFontPath(): string {
  return FONT_LIBRARY['inter'].file;
}

const fontCache = new Map<string, ArrayBuffer>();

export async function loadFontBytes(path: string): Promise<ArrayBuffer> {
  const cached = fontCache.get(path);
  if (cached) return cached;

  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load font: ${path}`);
  const buffer = await res.arrayBuffer();
  fontCache.set(path, buffer);
  return buffer;
}
