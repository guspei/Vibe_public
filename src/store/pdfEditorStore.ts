import { create } from 'zustand';
import { getDB, toUint8, storeBlob, getBlobUrl, deleteBlob } from '@/lib/db';
import type {
  IPdfProject, IPdfProjectCreate, IPdfProjectUpdate,
  IPdfTextField, IPdfUploadedFont,
  IPdfGroup, IPdfGroupCreate, IPdfGroupUpdate,
} from '@/lib/types';

interface PdfEditorState {
  projects: IPdfProject[];
  groups: IPdfGroup[];
  activeProject: IPdfProject | null;
  isLoading: boolean;

  currentPage: number;
  totalPages: number;
  scale: number;
  selectedFieldId: string | null;
  pdfBytes: Uint8Array | null;
  resolvedFonts: Record<string, ArrayBuffer>;

  fetchProjects: () => Promise<void>;
  createProject: (data: IPdfProjectCreate) => Promise<IPdfProject>;
  fetchProject: (id: string) => Promise<void>;
  updateProject: (id: string, data: IPdfProjectUpdate) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  setActiveProject: (project: IPdfProject | null) => void;
  uploadPdf: (projectId: string, file: File) => Promise<string>;
  uploadFont: (projectId: string, file: File, fontName: string) => Promise<IPdfUploadedFont>;
  uploadThumbnail: (projectId: string, blob: Blob) => Promise<string>;
  bulkUpload: (files: File[], groupId?: string) => Promise<IPdfProject[]>;

  fetchGroups: () => Promise<void>;
  createGroup: (data: IPdfGroupCreate) => Promise<IPdfGroup>;
  updateGroup: (id: string, data: IPdfGroupUpdate) => Promise<void>;
  deleteGroup: (id: string) => Promise<void>;

  reorderProjects: (items: Array<{ id: string; sortOrder: number; groupId: string | null }>) => Promise<void>;
  setProjects: (projects: IPdfProject[]) => void;

  setCurrentPage: (page: number) => void;
  setTotalPages: (total: number) => void;
  setScale: (scale: number) => void;
  setSelectedFieldId: (id: string | null) => void;
  setPdfBytes: (bytes: Uint8Array | null) => void;
  setResolvedFont: (fontName: string, buffer: ArrayBuffer) => void;
  addField: (field: IPdfTextField) => void;
  updateField: (fieldId: string, newText: string) => void;
  removeField: (fieldId: string) => void;
  setFields: (fields: IPdfTextField[]) => void;
}

// Generate thumbnail from PDF using pdfjs on client
async function generateThumbnail(pdfData: Uint8Array): Promise<Uint8Array | null> {
  try {
    const pdfjsLib = await import('pdfjs-dist');
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
    }
    const doc = await pdfjsLib.getDocument({ data: new Uint8Array(pdfData) }).promise;
    const page = await doc.getPage(1);
    const viewport = page.getViewport({ scale: 0.5 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d')!;
    await page.render({ canvasContext: ctx, viewport }).promise;
    doc.destroy();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) return null;
    return new Uint8Array(await blob.arrayBuffer());
  } catch {
    return null;
  }
}

const usePdfEditorStore = create<PdfEditorState>((set, get) => ({
  projects: [],
  groups: [],
  activeProject: null,
  isLoading: false,

  currentPage: 0,
  totalPages: 0,
  scale: 1.5,
  selectedFieldId: null,
  pdfBytes: null,
  resolvedFonts: {},

  fetchProjects: async () => {
    set({ isLoading: true });
    const db = await getDB();
    const [rawProjects, groups] = await Promise.all([
      db.getAll('pdfProjects'),
      db.getAll('pdfGroups'),
    ]);

    // Convert stored data to runtime objects with blob URLs
    const projects: IPdfProject[] = await Promise.all(
      rawProjects.map(async (p) => {
        const pdfUrl = p.pdfData ? URL.createObjectURL(new Blob([p.pdfData.buffer as ArrayBuffer], { type: 'application/pdf' })) : null;
        const thumbnailUrl = p.thumbnailData ? URL.createObjectURL(new Blob([p.thumbnailData.buffer as ArrayBuffer], { type: 'image/png' })) : null;
        return {
          id: p.id,
          title: p.title,
          pdfUrl,
          thumbnailUrl,
          modifiedPdfUrl: null,
          fields: p.fields,
          uploadedFonts: p.uploadedFonts,
          groupId: p.groupId,
          sortOrder: p.sortOrder,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
        };
      }),
    );

    set({ projects, groups, isLoading: false });
  },

  createProject: async (data) => {
    const db = await getDB();
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const stored = {
      id,
      title: data.title,
      pdfData: null,
      thumbnailData: null,
      modifiedPdfData: null,
      fields: [],
      uploadedFonts: [],
      groupId: null,
      sortOrder: Date.now(),
      createdAt: now,
      updatedAt: now,
    };
    await db.put('pdfProjects', stored);
    const project: IPdfProject = {
      id,
      title: data.title,
      pdfUrl: null,
      thumbnailUrl: null,
      modifiedPdfUrl: null,
      fields: [],
      uploadedFonts: [],
      groupId: null,
      sortOrder: stored.sortOrder,
      createdAt: now,
      updatedAt: now,
    };
    set((s) => ({ projects: [...s.projects, project] }));
    return project;
  },

  fetchProject: async (id) => {
    set({ isLoading: true });
    const db = await getDB();
    const p = await db.get('pdfProjects', id);
    if (!p) { set({ isLoading: false }); return; }

    const pdfUrl = p.pdfData ? URL.createObjectURL(new Blob([p.pdfData.buffer as ArrayBuffer], { type: 'application/pdf' })) : null;
    const thumbnailUrl = p.thumbnailData ? URL.createObjectURL(new Blob([p.thumbnailData.buffer as ArrayBuffer], { type: 'image/png' })) : null;

    // Resolve font blob URLs
    const uploadedFonts = await Promise.all(
      p.uploadedFonts.map(async (f) => {
        const url = await getBlobUrl(f.blobId);
        return { ...f, url: url || undefined };
      }),
    );

    const project: IPdfProject = {
      id: p.id,
      title: p.title,
      pdfUrl,
      thumbnailUrl,
      modifiedPdfUrl: null,
      fields: p.fields,
      uploadedFonts,
      groupId: p.groupId,
      sortOrder: p.sortOrder,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    };
    set({ activeProject: project, isLoading: false });
  },

  updateProject: async (id, data) => {
    const db = await getDB();
    const existing = await db.get('pdfProjects', id);
    if (!existing) return;

    const updated = {
      ...existing,
      ...(data.title !== undefined && { title: data.title }),
      ...(data.fields !== undefined && { fields: data.fields }),
      ...(data.groupId !== undefined && { groupId: data.groupId }),
      ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
      updatedAt: new Date().toISOString(),
    };
    await db.put('pdfProjects', updated);

    // Update runtime state
    const state = get();
    if (state.activeProject?.id === id) {
      set({
        activeProject: {
          ...state.activeProject,
          ...(data.title !== undefined && { title: data.title }),
          ...(data.fields !== undefined && { fields: data.fields }),
          ...(data.groupId !== undefined && { groupId: data.groupId }),
          ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
        },
      });
    }
    set((s) => ({
      projects: s.projects.map((p) =>
        p.id === id ? {
          ...p,
          ...(data.title !== undefined && { title: data.title }),
          ...(data.fields !== undefined && { fields: data.fields }),
          ...(data.groupId !== undefined && { groupId: data.groupId }),
          ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
        } : p,
      ),
    }));
  },

  deleteProject: async (id) => {
    const db = await getDB();
    const existing = await db.get('pdfProjects', id);
    if (existing) {
      // Clean up font blobs
      for (const f of existing.uploadedFonts) {
        await deleteBlob(f.blobId);
      }
    }
    await db.delete('pdfProjects', id);
    set((s) => ({
      projects: s.projects.filter((p) => p.id !== id),
      activeProject: s.activeProject?.id === id ? null : s.activeProject,
    }));
  },

  setActiveProject: (project) => set({ activeProject: project }),

  uploadPdf: async (projectId, file) => {
    const db = await getDB();
    const pdfData = toUint8(await file.arrayBuffer());
    const thumbData = await generateThumbnail(pdfData);

    const existing = await db.get('pdfProjects', projectId);
    if (!existing) throw new Error(`Project not found: ${projectId}`);

    existing.pdfData = pdfData;
    existing.thumbnailData = thumbData;
    existing.modifiedPdfData = null;
    existing.fields = [];
    existing.updatedAt = new Date().toISOString();
    await db.put('pdfProjects', existing);

    const pdfUrl = URL.createObjectURL(new Blob([pdfData.buffer as ArrayBuffer], { type: 'application/pdf' }));
    const thumbnailUrl = thumbData ? URL.createObjectURL(new Blob([thumbData.buffer as ArrayBuffer], { type: 'image/png' })) : null;
    const bytes = pdfData;

    set((s) => ({
      pdfBytes: bytes,
      activeProject: s.activeProject?.id === projectId
        ? { ...s.activeProject, pdfUrl, thumbnailUrl, modifiedPdfUrl: null, fields: [] }
        : s.activeProject,
      projects: s.projects.map((p) => (p.id === projectId ? { ...p, pdfUrl, thumbnailUrl } : p)),
    }));
    return pdfUrl;
  },

  uploadFont: async (projectId, file, fontName) => {
    const buffer = toUint8(await file.arrayBuffer());
    const blobId = await storeBlob(buffer, file.type || 'font/ttf');
    const url = await getBlobUrl(blobId);

    const font: IPdfUploadedFont = { name: fontName, blobId, url: url || undefined };

    const db = await getDB();
    const existing = await db.get('pdfProjects', projectId);
    if (existing) {
      existing.uploadedFonts = [...existing.uploadedFonts, { name: fontName, blobId }];
      existing.updatedAt = new Date().toISOString();
      await db.put('pdfProjects', existing);
    }

    set((s) => ({
      activeProject: s.activeProject?.id === projectId
        ? { ...s.activeProject, uploadedFonts: [...(s.activeProject.uploadedFonts || []), font] }
        : s.activeProject,
    }));
    return font;
  },

  uploadThumbnail: async (projectId, blob) => {
    const buffer = toUint8(await blob.arrayBuffer());
    const db = await getDB();
    const existing = await db.get('pdfProjects', projectId);
    if (existing) {
      existing.thumbnailData = buffer;
      existing.updatedAt = new Date().toISOString();
      await db.put('pdfProjects', existing);
    }
    const url = URL.createObjectURL(new Blob([buffer.buffer as ArrayBuffer], { type: 'image/png' }));
    set((s) => ({
      activeProject: s.activeProject?.id === projectId
        ? { ...s.activeProject, thumbnailUrl: url }
        : s.activeProject,
      projects: s.projects.map((p) => (p.id === projectId ? { ...p, thumbnailUrl: url } : p)),
    }));
    return url;
  },

  bulkUpload: async (files, groupId) => {
    const created: IPdfProject[] = [];
    for (const file of files) {
      if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) continue;
      const db = await getDB();
      const pdfData = toUint8(await file.arrayBuffer());
      const thumbData = await generateThumbnail(pdfData);
      const now = new Date().toISOString();
      const id = crypto.randomUUID();
      const title = file.name.replace(/\.pdf$/i, '');

      const stored = {
        id,
        title,
        pdfData,
        thumbnailData: thumbData,
        modifiedPdfData: null,
        fields: [],
        uploadedFonts: [],
        groupId: groupId || null,
        sortOrder: Date.now(),
        createdAt: now,
        updatedAt: now,
      };
      await db.put('pdfProjects', stored);

      const pdfUrl = URL.createObjectURL(new Blob([pdfData.buffer as ArrayBuffer], { type: 'application/pdf' }));
      const thumbnailUrl = thumbData ? URL.createObjectURL(new Blob([thumbData.buffer as ArrayBuffer], { type: 'image/png' })) : null;

      const project: IPdfProject = {
        id, title, pdfUrl, thumbnailUrl,
        modifiedPdfUrl: null, fields: [], uploadedFonts: [],
        groupId: groupId || null, sortOrder: stored.sortOrder,
        createdAt: now, updatedAt: now,
      };
      created.push(project);
    }
    set((s) => ({ projects: [...s.projects, ...created] }));
    return created;
  },

  // Groups
  fetchGroups: async () => {
    const db = await getDB();
    const groups = await db.getAll('pdfGroups');
    set({ groups });
  },

  createGroup: async (data) => {
    const db = await getDB();
    const now = new Date().toISOString();
    const group: IPdfGroup = {
      id: crypto.randomUUID(),
      name: data.name,
      sortOrder: Date.now(),
      createdAt: now,
      updatedAt: now,
    };
    await db.put('pdfGroups', group);
    set((s) => ({ groups: [...s.groups, group] }));
    return group;
  },

  updateGroup: async (id, data) => {
    const db = await getDB();
    const existing = await db.get('pdfGroups', id);
    if (!existing) return;
    const updated = { ...existing, ...data, updatedAt: new Date().toISOString() };
    await db.put('pdfGroups', updated);
    set((s) => ({ groups: s.groups.map((g) => (g.id === id ? updated : g)) }));
  },

  deleteGroup: async (id) => {
    const db = await getDB();
    await db.delete('pdfGroups', id);
    // Ungroup projects
    const tx = db.transaction('pdfProjects', 'readwrite');
    const store = tx.objectStore('pdfProjects');
    let cursor = await store.openCursor();
    while (cursor) {
      if (cursor.value.groupId === id) {
        await cursor.update({ ...cursor.value, groupId: null });
      }
      cursor = await cursor.continue();
    }
    await tx.done;

    set((s) => ({
      groups: s.groups.filter((g) => g.id !== id),
      projects: s.projects.map((p) => (p.groupId === id ? { ...p, groupId: null } : p)),
    }));
  },

  reorderProjects: async (items) => {
    const db = await getDB();
    const tx = db.transaction('pdfProjects', 'readwrite');
    const store = tx.objectStore('pdfProjects');
    for (const item of items) {
      const existing = await store.get(item.id);
      if (existing) {
        await store.put({ ...existing, sortOrder: item.sortOrder, groupId: item.groupId });
      }
    }
    await tx.done;
  },

  setProjects: (projects) => set({ projects }),

  setCurrentPage: (page) => set({ currentPage: page }),
  setTotalPages: (total) => set({ totalPages: total }),
  setScale: (scale) => set({ scale }),
  setSelectedFieldId: (id) => set({ selectedFieldId: id }),
  setPdfBytes: (bytes) => set({ pdfBytes: bytes }),

  setResolvedFont: (fontName, buffer) =>
    set((s) => ({ resolvedFonts: { ...s.resolvedFonts, [fontName]: buffer } })),

  addField: (field) => {
    const { activeProject } = get();
    if (!activeProject) return;
    set({ activeProject: { ...activeProject, fields: [...activeProject.fields, field] } });
  },

  updateField: (fieldId, newText) => {
    const { activeProject } = get();
    if (!activeProject) return;
    const fields = activeProject.fields.map((f) => f.id === fieldId ? { ...f, newText } : f);
    set({ activeProject: { ...activeProject, fields } });
  },

  removeField: (fieldId) => {
    const { activeProject } = get();
    if (!activeProject) return;
    const fields = activeProject.fields.filter((f) => f.id !== fieldId);
    set({ activeProject: { ...activeProject, fields } });
  },

  setFields: (fields) => {
    const { activeProject } = get();
    if (!activeProject) return;
    set({ activeProject: { ...activeProject, fields } });
  },
}));

export default usePdfEditorStore;
