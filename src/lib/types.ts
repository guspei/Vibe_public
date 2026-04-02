// PDF Editor Types

export type PdfFontSource = 'library' | 'extracted' | 'uploaded' | 'default';

export interface IPdfTextField {
  id: string;
  pageIndex: number;
  originalText: string;
  newText: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontName: string;
  fontSource: PdfFontSource;
  fontUrl: string | null;
}

export interface IPdfUploadedFont {
  name: string;
  blobId: string;
  url?: string; // runtime object URL
}

export interface IPdfProject {
  id: string;
  title: string;
  pdfUrl: string | null;
  thumbnailUrl: string | null;
  modifiedPdfUrl: string | null;
  fields: IPdfTextField[];
  uploadedFonts: IPdfUploadedFont[];
  groupId: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface IPdfGroup {
  id: string;
  name: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface IPdfGroupCreate {
  name: string;
}

export interface IPdfGroupUpdate {
  name?: string;
  sortOrder?: number;
}

export interface IPdfProjectCreate {
  title: string;
}

export interface IPdfProjectUpdate {
  title?: string;
  pdfUrl?: string | null;
  thumbnailUrl?: string | null;
  modifiedPdfUrl?: string | null;
  fields?: IPdfTextField[];
  uploadedFonts?: IPdfUploadedFont[];
  groupId?: string | null;
  sortOrder?: number;
}

// GIF Editor Types

export interface IGifFrameSettings {
  duration?: number;
}

export interface IGifTextBlock {
  text: string;
  verticalPosition: number;
  fontSize: number;
  textColor: string;
  fontFamily: string;
  bold: boolean;
  italic: boolean;
}

export interface IGifFrame {
  imageUrl: string;
  texts: IGifTextBlock[];
  settings?: IGifFrameSettings;
}

// Stored version uses blob IDs instead of URLs
export interface IGifFrameStored {
  imageBlobId: string;
  texts: IGifTextBlock[];
  settings?: IGifFrameSettings;
}

export interface IGifSettings {
  frameDuration: number;
  defaultFontSize: number;
  defaultVerticalPosition: number;
  defaultTextColor: string;
  defaultFontFamily: string;
  defaultBold: boolean;
  defaultItalic: boolean;
  maxWidth: number;
  loopCount: number;
  aspectRatioFrame: number;
}

export interface IGifProject {
  id: string;
  title: string;
  frames: IGifFrame[];
  settings: IGifSettings;
  gifUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IGifProjectCreate {
  title: string;
}

export interface IGifProjectUpdate {
  title?: string;
  frames?: IGifFrame[];
  settings?: Partial<IGifSettings>;
  gifUrl?: string | null;
}
