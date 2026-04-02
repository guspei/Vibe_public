import { create } from 'zustand';
import { getDB, storeBlob, getBlobUrl, deleteBlob } from '@/lib/db';
import type {
  IGifProject, IGifProjectCreate, IGifProjectUpdate,
  IGifFrame, IGifFrameStored, IGifSettings,
} from '@/lib/types';

const DEFAULT_SETTINGS: IGifSettings = {
  frameDuration: 1500,
  defaultFontSize: 48,
  defaultVerticalPosition: 50,
  defaultTextColor: '#FFFFFF',
  defaultFontFamily: 'Montserrat',
  defaultBold: true,
  defaultItalic: false,
  maxWidth: 480,
  loopCount: 0,
  aspectRatioFrame: 0,
};

interface GifEditorState {
  projects: IGifProject[];
  activeProject: IGifProject | null;
  isLoading: boolean;
  isGenerating: boolean;

  fetchProjects: () => Promise<void>;
  createProject: (data: IGifProjectCreate) => Promise<IGifProject>;
  fetchProject: (id: string) => Promise<void>;
  updateProject: (id: string, data: IGifProjectUpdate) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  setActiveProject: (project: IGifProject | null) => void;
  uploadFrames: (projectId: string, files: File[]) => Promise<string[]>;
  setIsGenerating: (value: boolean) => void;
}

// Convert stored frames (blob IDs) to runtime frames (object URLs)
async function storedToRuntime(stored: IGifFrameStored[]): Promise<IGifFrame[]> {
  return Promise.all(
    stored.map(async (f) => {
      const url = await getBlobUrl(f.imageBlobId);
      return {
        imageUrl: url || '',
        texts: f.texts,
        settings: f.settings,
      };
    }),
  );
}

// Convert runtime frames back to stored frames
async function runtimeToStored(frames: IGifFrame[], existingStored: IGifFrameStored[]): Promise<IGifFrameStored[]> {
  // Build a map of imageUrl -> existing blobId for reuse
  const urlToBlobId = new Map<string, string>();
  // We track which URLs already have blob IDs by checking existing stored data
  // For new frames (from upload), the imageUrl is an object URL that we already stored

  const result: IGifFrameStored[] = [];
  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    // Try to find existing stored frame by matching position or reuse
    let blobId: string | undefined;

    // Check if there's a matching existing stored frame
    if (i < existingStored.length) {
      // Check if it's the same image (not changed)
      const existingUrl = await getBlobUrl(existingStored[i].imageBlobId);
      if (existingUrl && frame.imageUrl === existingUrl) {
        blobId = existingStored[i].imageBlobId;
      }
    }

    // Search all existing stored frames for a match
    if (!blobId) {
      for (const es of existingStored) {
        if (urlToBlobId.has(frame.imageUrl)) {
          blobId = urlToBlobId.get(frame.imageUrl);
          break;
        }
        const existingUrl = await getBlobUrl(es.imageBlobId);
        if (existingUrl === frame.imageUrl) {
          blobId = es.imageBlobId;
          urlToBlobId.set(frame.imageUrl, es.imageBlobId);
          break;
        }
      }
    }

    // If still no blobId, it must be a blob URL we created during upload
    // The blobId is stored on the frame object as a transient property
    if (!blobId) {
      blobId = (frame as IGifFrame & { _blobId?: string })._blobId;
    }

    if (!blobId) {
      // Fallback: fetch the blob URL and store it
      try {
        const res = await fetch(frame.imageUrl);
        const data = await res.arrayBuffer();
        blobId = await storeBlob(data, 'image/webp');
      } catch {
        continue; // Skip broken frames
      }
    }

    result.push({
      imageBlobId: blobId,
      texts: frame.texts,
      settings: frame.settings,
    });
  }
  return result;
}

const useGifEditorStore = create<GifEditorState>((set) => ({
  projects: [],
  activeProject: null,
  isLoading: false,
  isGenerating: false,

  fetchProjects: async () => {
    set({ isLoading: true });
    const db = await getDB();
    const rawProjects = await db.getAll('gifProjects');

    const projects: IGifProject[] = await Promise.all(
      rawProjects.map(async (p) => {
        const frames = await storedToRuntime(p.frames);
        return {
          id: p.id,
          title: p.title,
          frames,
          settings: { ...DEFAULT_SETTINGS, ...p.settings },
          gifUrl: p.gifData ? URL.createObjectURL(new Blob([p.gifData.buffer as ArrayBuffer], { type: 'image/gif' })) : null,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
        };
      }),
    );

    set({ projects, isLoading: false });
  },

  createProject: async (data) => {
    const db = await getDB();
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const stored = {
      id,
      title: data.title,
      frames: [],
      settings: { ...DEFAULT_SETTINGS },
      gifData: null,
      createdAt: now,
      updatedAt: now,
    };
    await db.put('gifProjects', stored);
    const project: IGifProject = {
      id,
      title: data.title,
      frames: [],
      settings: { ...DEFAULT_SETTINGS },
      gifUrl: null,
      createdAt: now,
      updatedAt: now,
    };
    set((s) => ({ projects: [project, ...s.projects] }));
    return project;
  },

  fetchProject: async (id) => {
    set({ isLoading: true });
    const db = await getDB();
    const p = await db.get('gifProjects', id);
    if (!p) { set({ isLoading: false }); return; }

    const frames = await storedToRuntime(p.frames);
    const project: IGifProject = {
      id: p.id,
      title: p.title,
      frames,
      settings: { ...DEFAULT_SETTINGS, ...p.settings },
      gifUrl: p.gifData ? URL.createObjectURL(new Blob([p.gifData.buffer as ArrayBuffer], { type: 'image/gif' })) : null,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    };
    set({ activeProject: project, isLoading: false });
  },

  updateProject: async (id, data) => {
    const db = await getDB();
    const existing = await db.get('gifProjects', id);
    if (!existing) return;

    const updated = { ...existing, updatedAt: new Date().toISOString() };

    if (data.title !== undefined) updated.title = data.title;
    if (data.settings) updated.settings = { ...updated.settings, ...data.settings };
    if (data.frames !== undefined) {
      updated.frames = await runtimeToStored(data.frames, existing.frames);
    }

    await db.put('gifProjects', updated);

    // Build runtime project for state
    const frames = await storedToRuntime(updated.frames);
    const project: IGifProject = {
      id: updated.id,
      title: updated.title,
      frames,
      settings: { ...DEFAULT_SETTINGS, ...updated.settings },
      gifUrl: updated.gifData ? URL.createObjectURL(new Blob([updated.gifData.buffer as ArrayBuffer], { type: 'image/gif' })) : null,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };

    set((s) => ({
      activeProject: s.activeProject?.id === id ? project : s.activeProject,
      projects: s.projects.map((p) => (p.id === id ? project : p)),
    }));
  },

  deleteProject: async (id) => {
    const db = await getDB();
    const existing = await db.get('gifProjects', id);
    if (existing) {
      for (const f of existing.frames) {
        await deleteBlob(f.imageBlobId);
      }
    }
    await db.delete('gifProjects', id);
    set((s) => ({
      projects: s.projects.filter((p) => p.id !== id),
      activeProject: s.activeProject?.id === id ? null : s.activeProject,
    }));
  },

  setActiveProject: (project) => set({ activeProject: project }),

  uploadFrames: async (projectId, files) => {
    const urls: string[] = [];
    const newStoredFrames: IGifFrameStored[] = [];

    for (const file of files) {
      if (!file.type.startsWith('image/')) continue;
      const buffer = new Uint8Array(await file.arrayBuffer());
      const blobId = await storeBlob(buffer, file.type);
      const url = await getBlobUrl(blobId);
      if (url) {
        urls.push(url);
        newStoredFrames.push({ imageBlobId: blobId, texts: [] });
      }
    }

    // Append to DB
    const db = await getDB();
    const existing = await db.get('gifProjects', projectId);
    if (existing) {
      existing.frames = [...existing.frames, ...newStoredFrames];
      existing.updatedAt = new Date().toISOString();
      await db.put('gifProjects', existing);
    }

    return urls;
  },

  setIsGenerating: (value) => set({ isGenerating: value }),
}));

export default useGifEditorStore;
