'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Slider from '@mui/material/Slider';
import IconButton from '@mui/material/IconButton';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';

import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DeleteIcon from '@mui/icons-material/Delete';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DownloadIcon from '@mui/icons-material/Download';
import ReplayIcon from '@mui/icons-material/Replay';
import CloseIcon from '@mui/icons-material/Close';
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, sortableKeyboardCoordinates, horizontalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable';
import { useSnackbar } from 'notistack';
import useGifEditorStore from '@/store/gifEditorStore';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import GifFrameCard from './GifFrameCard';
import type { IGifFrame, IGifFrameSettings, IGifTextBlock } from '@/lib/types';

interface GifEditorViewProps { projectId: string; }

const DEFAULT_SETTINGS = {
  frameDuration: 1500, defaultFontSize: 48, defaultVerticalPosition: 50,
  defaultTextColor: '#FFFFFF', defaultFontFamily: 'Montserrat',
  defaultBold: true, defaultItalic: false, maxWidth: 480, loopCount: 0, aspectRatioFrame: 0,
};

const FONT_OPTIONS = ['Montserrat', 'Arial', 'Impact', 'Georgia', 'Courier New', 'Comic Sans MS', 'Trebuchet MS', 'Verdana', 'Times New Roman'];

export default function GifEditorView({ projectId }: GifEditorViewProps) {
  const router = useRouter();
  const { enqueueSnackbar } = useSnackbar();
  const project = useGifEditorStore((s) => s.activeProject);
  const isLoading = useGifEditorStore((s) => s.isLoading);
  const isGenerating = useGifEditorStore((s) => s.isGenerating);
  const fetchProject = useGifEditorStore((s) => s.fetchProject);
  const createProject = useGifEditorStore((s) => s.createProject);
  const updateProject = useGifEditorStore((s) => s.updateProject);
  const deleteProject = useGifEditorStore((s) => s.deleteProject);
  const uploadFrames = useGifEditorStore((s) => s.uploadFrames);
  const setActiveProject = useGifEditorStore((s) => s.setActiveProject);
  const setIsGenerating = useGifEditorStore((s) => s.setIsGenerating);

  const isNew = project?.id === 'new';
  const [title, setTitle] = useState('');
  const titleDirty = useRef(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [gifBlobUrl, setGifBlobUrl] = useState<string | null>(null);
  const [uploadingFrames, setUploadingFrames] = useState(false);
  const [focusedFrame, setFocusedFrame] = useState<number | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [draggingOver, setDraggingOver] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const getDefaultTextBlock = useCallback((): IGifTextBlock => {
    const s = useGifEditorStore.getState().activeProject?.settings ?? DEFAULT_SETTINGS;
    return { text: '', verticalPosition: s.defaultVerticalPosition, fontSize: s.defaultFontSize, textColor: s.defaultTextColor, fontFamily: s.defaultFontFamily, bold: s.defaultBold, italic: s.defaultItalic };
  }, []);

  useEffect(() => {
    if (projectId === 'new') {
      const current = useGifEditorStore.getState().activeProject;
      if (!current || current.id === 'new') {
        setActiveProject({ id: 'new', title: '', frames: [], settings: { ...DEFAULT_SETTINGS }, gifUrl: null, createdAt: '', updatedAt: '' });
      }
    } else { fetchProject(projectId); }
    return () => { setActiveProject(null); clearTimeout(saveTimer.current); };
  }, [projectId, fetchProject, setActiveProject]);

  useEffect(() => { if (project) setTitle(project.title); }, [project?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const persistNew = useCallback(async (): Promise<string> => {
    const p = useGifEditorStore.getState().activeProject;
    const sb = await createProject({ title: p?.title || 'Untitled' });
    useGifEditorStore.setState((s) => ({ activeProject: s.activeProject ? { ...s.activeProject, id: sb.id } : null }));
    window.history.replaceState(null, '', `/gif-maker/${sb.id}`);
    return sb.id;
  }, [createProject]);

  const getRealId = useCallback(async (): Promise<string> => {
    const p = useGifEditorStore.getState().activeProject;
    if (p?.id === 'new') return persistNew();
    return p?.id || projectId;
  }, [projectId, persistNew]);

  const debouncedSave = useCallback((frames: IGifFrame[]) => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const realId = await getRealId();
      updateProject(realId, { frames }).catch(() => {});
    }, 1500);
  }, [getRealId, updateProject]);

  const handleTitleBlur = useCallback(async () => {
    if (!project || !titleDirty.current) return;
    titleDirty.current = false;
    useGifEditorStore.setState((s) => ({ activeProject: s.activeProject ? { ...s.activeProject, title } : null }));
    if (isNew) return;
    try { await updateProject(project.id, { title }); }
    catch { enqueueSnackbar('Error saving title', { variant: 'error' }); }
  }, [project, title, isNew, updateProject, enqueueSnackbar]);

  const handleUploadFiles = useCallback(async (files: FileList | File[]) => {
    if (!project) return;
    const imageFiles = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (!imageFiles.length) return;
    setUploadingFrames(true);
    try {
      const realId = await getRealId();
      if (project.id !== realId) { await updateProject(realId, { title: title || 'Untitled', settings: project.settings }); }
      const urls = await uploadFrames(realId, imageFiles);
      const newFrames: IGifFrame[] = urls.map((url) => ({ imageUrl: url, texts: [] }));
      const currentFrames = useGifEditorStore.getState().activeProject?.frames || [];
      const updatedFrames = [...currentFrames, ...newFrames];
      await updateProject(realId, { frames: updatedFrames });
    } catch { enqueueSnackbar('Error uploading images', { variant: 'error' }); }
    finally { setUploadingFrames(false); }
  }, [project, title, getRealId, uploadFrames, updateProject, enqueueSnackbar]);

  const handleFrameTextsChange = useCallback((index: number, texts: IGifTextBlock[]) => {
    if (!project) return;
    const frames = [...project.frames]; frames[index] = { ...frames[index], texts };
    useGifEditorStore.setState((s) => ({ activeProject: s.activeProject ? { ...s.activeProject, frames } : null }));
    debouncedSave(frames);
  }, [project, debouncedSave]);

  const handleFrameSettingsChange = useCallback((index: number, frameSettings: IGifFrameSettings) => {
    if (!project) return;
    const frames = [...project.frames]; frames[index] = { ...frames[index], settings: frameSettings };
    useGifEditorStore.setState((s) => ({ activeProject: s.activeProject ? { ...s.activeProject, frames } : null }));
    debouncedSave(frames);
  }, [project, debouncedSave]);

  const handleApplySettingsToAll = useCallback(async () => {
    if (!project) return;
    const s = project.settings;
    const frames = project.frames.map((f) => ({ ...f, settings: { duration: s.frameDuration }, texts: (f.texts ?? []).map((t) => ({ ...t, fontSize: s.defaultFontSize, textColor: s.defaultTextColor, fontFamily: s.defaultFontFamily, verticalPosition: s.defaultVerticalPosition })) }));
    useGifEditorStore.setState((st) => ({ activeProject: st.activeProject ? { ...st.activeProject, frames } : null }));
    if (!isNew) { await updateProject(project.id, { frames }); }
  }, [project, isNew, updateProject]);

  const handleFrameDelete = useCallback(async (index: number) => {
    if (!project) return;
    const frames = project.frames.filter((_, i) => i !== index);
    useGifEditorStore.setState((s) => ({ activeProject: s.activeProject ? { ...s.activeProject, frames } : null }));
    if (!isNew) { await updateProject(project.id, { frames }); }
  }, [project, isNew, updateProject]);

  const handleFrameDuplicate = useCallback(async (index: number) => {
    if (!project) return;
    const source = project.frames[index];
    const copy: IGifFrame = { ...source, texts: source.texts.map((t) => ({ ...t })), settings: source.settings ? { ...source.settings } : undefined };
    const frames = [...project.frames]; frames.splice(index + 1, 0, copy);
    useGifEditorStore.setState((s) => ({ activeProject: s.activeProject ? { ...s.activeProject, frames } : null }));
    setFocusedFrame(index + 1);
    if (!isNew) { await updateProject(project.id, { frames }); }
  }, [project, isNew, updateProject]);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    if (!project) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = project.frames.findIndex((_, i) => `frame-${i}` === active.id);
    const newIndex = project.frames.findIndex((_, i) => `frame-${i}` === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(project.frames, oldIndex, newIndex);
    useGifEditorStore.setState((s) => ({ activeProject: s.activeProject ? { ...s.activeProject, frames: reordered } : null }));
    if (!isNew) { await updateProject(project.id, { frames: reordered }); }
  }, [project, isNew, updateProject]);

  const handleSettingChange = useCallback(async (key: string, value: unknown) => {
    if (!project || isNew) return;
    await updateProject(project.id, { settings: { [key]: value } });
  }, [project, isNew, updateProject]);

  const handleGenerate = useCallback(async () => {
    if (!project || project.frames.length === 0) return;
    setFocusedFrame(null);
    setIsGenerating(true);
    try {
      const { encode } = await import('modern-gif');
      const settings = project.settings;
      const canvasWidth = settings.maxWidth;
      const refIndex = Math.min(settings.aspectRatioFrame ?? 0, project.frames.length - 1);
      const refImg = await loadImage(project.frames[refIndex].imageUrl);
      const canvasHeight = Math.round(canvasWidth * (refImg.height / refImg.width));
      const canvas = document.createElement('canvas');
      canvas.width = canvasWidth; canvas.height = canvasHeight;
      const ctx = canvas.getContext('2d')!;
      const encoderFrames: Array<{ data: CanvasImageSource; delay: number }> = [];
      for (const frame of project.frames) {
        const img = await loadImage(frame.imageUrl);
        const frameDuration = frame.settings?.duration ?? settings.frameDuration;
        ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        const sc = Math.min(canvasWidth / img.width, canvasHeight / img.height);
        const x = (canvasWidth - img.width * sc) / 2;
        const y = (canvasHeight - img.height * sc) / 2;
        ctx.drawImage(img, x, y, img.width * sc, img.height * sc);
        for (const block of (frame.texts ?? [])) {
          if (!block.text) continue;
          const weight = block.bold ? 'bold' : 'normal';
          const fontStyle = block.italic ? 'italic' : 'normal';
          ctx.font = `${fontStyle} ${weight} ${block.fontSize}px ${block.fontFamily}, sans-serif`;
          ctx.textAlign = 'center';
          const padding = 12; const margin = 16;
          const maxTextWidth = canvasWidth - margin * 2 - padding * 2;
          const lineHeight = block.fontSize * 1.25;
          const words = block.text.split(' '); const lines: string[] = []; let currentLine = '';
          for (const word of words) {
            const testLine = currentLine ? `${currentLine} ${word}` : word;
            if (ctx.measureText(testLine).width > maxTextWidth && currentLine) { lines.push(currentLine); currentLine = word; } else { currentLine = testLine; }
          }
          if (currentLine) lines.push(currentLine);
          const longestLineWidth = Math.max(...lines.map((l) => ctx.measureText(l).width));
          const totalTextHeight = lines.length * lineHeight;
          const bgW = longestLineWidth + padding * 2; const bgH = totalTextHeight + padding;
          const vPos = block.verticalPosition ?? 50;
          let bgY = (canvasHeight * vPos / 100) - (bgH / 2);
          bgY = Math.max(margin, Math.min(bgY, canvasHeight - margin - bgH));
          const bgX = (canvasWidth - bgW) / 2;
          ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.beginPath(); ctx.roundRect(bgX, bgY, bgW, bgH, 8); ctx.fill();
          ctx.fillStyle = block.textColor;
          const firstLineY = bgY + padding / 2 + block.fontSize;
          for (let li = 0; li < lines.length; li++) { ctx.fillText(lines[li], canvasWidth / 2, firstLineY + li * lineHeight); }
        }
        const bitmap = await createImageBitmap(canvas);
        encoderFrames.push({ data: bitmap, delay: frameDuration });
      }
      const output = await encode({ width: canvasWidth, height: canvasHeight, frames: encoderFrames });
      const blob = new Blob([output], { type: 'image/gif' });
      if (gifBlobUrl) URL.revokeObjectURL(gifBlobUrl);
      setGifBlobUrl(URL.createObjectURL(blob));
      enqueueSnackbar('GIF generated', { variant: 'success' });
    } catch (err) {
      console.error('GIF generation error:', err);
      enqueueSnackbar('Error generating GIF', { variant: 'error' });
    } finally { setIsGenerating(false); }
  }, [project, gifBlobUrl, setIsGenerating, enqueueSnackbar]);

  const handleDelete = useCallback(async () => {
    if (isNew) { setActiveProject(null); router.push('/gif-maker'); return; }
    try { await deleteProject(project!.id); enqueueSnackbar('Project deleted', { variant: 'success' }); router.push('/gif-maker'); }
    catch { enqueueSnackbar('Error deleting project', { variant: 'error' }); }
  }, [project, isNew, deleteProject, setActiveProject, enqueueSnackbar, router]);

  const handleToggleAspectRatioRef = useCallback(async (index: number) => {
    if (!project) return;
    const current = project.settings.aspectRatioFrame ?? 0;
    const val = current === index ? 0 : index;
    useGifEditorStore.setState((s) => ({ activeProject: s.activeProject ? { ...s.activeProject, settings: { ...s.activeProject.settings, aspectRatioFrame: val } } : null }));
    if (!isNew) { handleSettingChange('aspectRatioFrame', val); }
  }, [project, isNew, handleSettingChange]);

  if ((projectId !== 'new' && isLoading) || !project) return <LoadingSpinner />;

  const frames = project.frames;
  const settings = project.settings;

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <IconButton onClick={() => router.push('/gif-maker')} size="small"><ArrowBackIcon /></IconButton>
        <TextField value={title}
          onChange={(e) => { setTitle(e.target.value); titleDirty.current = true; useGifEditorStore.setState((s) => ({ activeProject: s.activeProject ? { ...s.activeProject, title: e.target.value } : null })); }}
          onBlur={handleTitleBlur} variant="standard" placeholder="GIF title..."
          InputProps={{ disableUnderline: true }} inputProps={{ style: { fontSize: '1.5rem', fontWeight: 700 } }}
          sx={{ flex: 1, '& .MuiInputBase-root': { borderBottom: '1px dashed transparent', '&:hover': { borderBottom: '1px dashed', borderColor: 'divider' }, '&.Mui-focused': { borderBottom: '1px solid', borderColor: 'primary.main' } } }} />
        <IconButton onClick={() => setDeleteOpen(true)} size="small" sx={{ opacity: 0.4, '&:hover': { opacity: 1, color: 'error.main' } }}><DeleteIcon /></IconButton>
      </Box>

      <Paper variant="outlined" sx={{ p: 1.5, px: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, alignItems: 'center' }}>
          <Box sx={{ minWidth: 160 }}>
            <Typography variant="caption" color="text.secondary">Duration per frame</Typography>
            <Slider value={settings.frameDuration}
              onChange={(_e, v) => { useGifEditorStore.setState((s) => ({ activeProject: s.activeProject ? { ...s.activeProject, settings: { ...s.activeProject.settings, frameDuration: v as number } } : null })); }}
              onChangeCommitted={(_e, v) => handleSettingChange('frameDuration', v)} min={200} max={5000} step={100} size="small" valueLabelDisplay="auto" valueLabelFormat={(v) => `${v}ms`} />
          </Box>
          <Box sx={{ minWidth: 120 }}>
            <Typography variant="caption" color="text.secondary">Font size</Typography>
            <Slider value={settings.defaultFontSize}
              onChange={(_e, v) => { useGifEditorStore.setState((s) => ({ activeProject: s.activeProject ? { ...s.activeProject, settings: { ...s.activeProject.settings, defaultFontSize: v as number } } : null })); }}
              onChangeCommitted={(_e, v) => handleSettingChange('defaultFontSize', v)} min={12} max={200} step={2} size="small" valueLabelDisplay="auto" valueLabelFormat={(v) => `${v}px`} />
          </Box>
          <Box sx={{ minWidth: 80 }}>
            <Typography variant="caption" color="text.secondary">Text color</Typography>
            <Box component="input" type="color" value={settings.defaultTextColor}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => { useGifEditorStore.setState((s) => ({ activeProject: s.activeProject ? { ...s.activeProject, settings: { ...s.activeProject.settings, defaultTextColor: e.target.value } } : null })); }}
              onBlur={(e: React.FocusEvent<HTMLInputElement>) => handleSettingChange('defaultTextColor', e.target.value)}
              sx={{ width: 40, height: 32, border: 'none', cursor: 'pointer', mt: 0.5, display: 'block' }} />
          </Box>
          <Box sx={{ minWidth: 130 }}>
            <Typography variant="caption" color="text.secondary">Font</Typography>
            <Select value={settings.defaultFontFamily}
              onChange={(e) => { const val = e.target.value as string; useGifEditorStore.setState((s) => ({ activeProject: s.activeProject ? { ...s.activeProject, settings: { ...s.activeProject.settings, defaultFontFamily: val } } : null })); handleSettingChange('defaultFontFamily', val); }}
              size="small" sx={{ mt: 0.5, height: 32, fontSize: 13, width: '100%' }}
              renderValue={(val) => <span style={{ fontFamily: val }}>{val}</span>}>
              {FONT_OPTIONS.map((f) => (<MenuItem key={f} value={f} sx={{ fontSize: 13, fontFamily: f }}>{f}</MenuItem>))}
            </Select>
          </Box>
          <Box sx={{ minWidth: 120 }}>
            <Typography variant="caption" color="text.secondary">Max width</Typography>
            <Slider value={settings.maxWidth}
              onChange={(_e, v) => { useGifEditorStore.setState((s) => ({ activeProject: s.activeProject ? { ...s.activeProject, settings: { ...s.activeProject.settings, maxWidth: v as number } } : null })); }}
              onChangeCommitted={(_e, v) => handleSettingChange('maxWidth', v)} min={200} max={1200} step={40} size="small" valueLabelDisplay="auto" valueLabelFormat={(v) => `${v}px`} />
          </Box>
          <Box sx={{ minWidth: 120 }}>
            <Typography variant="caption" color="text.secondary">Text position</Typography>
            <Slider value={settings.defaultVerticalPosition ?? 50}
              onChange={(_e, v) => { useGifEditorStore.setState((s) => ({ activeProject: s.activeProject ? { ...s.activeProject, settings: { ...s.activeProject.settings, defaultVerticalPosition: v as number } } : null })); }}
              onChangeCommitted={(_e, v) => handleSettingChange('defaultVerticalPosition', v)} min={5} max={95} step={1} size="small" valueLabelDisplay="auto" valueLabelFormat={(v) => `${v}%`} />
          </Box>
          {frames.length > 0 && (
            <Button size="small" variant="outlined" onClick={handleApplySettingsToAll} sx={{ fontSize: 11, textTransform: 'none', ml: 'auto' }}>Apply to all frames</Button>
          )}
        </Box>
      </Paper>

      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
          <Typography variant="subtitle2">Frames ({frames.length})</Typography>
          <Box sx={{ flex: 1 }} />
          <Button variant="outlined" size="small" startIcon={uploadingFrames ? <CircularProgress size={14} /> : <UploadFileIcon />}
            onClick={() => fileInputRef.current?.click()} disabled={uploadingFrames}>
            {uploadingFrames ? 'Uploading...' : 'Upload images'}
          </Button>
          <input ref={fileInputRef} type="file" accept="image/*" multiple hidden
            onChange={(e) => { if (e.target.files?.length) { handleUploadFiles(e.target.files); e.target.value = ''; } }} />
        </Box>
        {frames.length > 0 ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={frames.map((_, i) => `frame-${i}`)} strategy={horizontalListSortingStrategy}>
              <Box sx={{ display: 'flex', gap: 1.5, overflowX: 'auto', pb: 2, scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' }, alignItems: 'flex-start' }}>
                {frames.map((frame, i) => {
                  let sc: 'focused' | 'neighbor' | 'normal' = 'normal';
                  if (focusedFrame === i) sc = 'focused';
                  else if (focusedFrame !== null && Math.abs(focusedFrame - i) === 1) sc = 'neighbor';
                  return (
                    <GifFrameCard key={`frame-${i}`} id={`frame-${i}`} index={i} imageUrl={frame.imageUrl}
                      texts={frame.texts} frameSettings={frame.settings} globalDuration={settings.frameDuration}
                      defaultTextBlock={getDefaultTextBlock()} scale={sc}
                      isAspectRatioRef={i === (settings.aspectRatioFrame ?? 0)}
                      onToggleAspectRatioRef={() => handleToggleAspectRatioRef(i)}
                      onTextsChange={(texts) => handleFrameTextsChange(i, texts)}
                      onSettingsChange={(s) => handleFrameSettingsChange(i, s)}
                      onDelete={() => handleFrameDelete(i)} onDuplicate={() => handleFrameDuplicate(i)}
                      onFocus={() => setFocusedFrame(i)} onBlur={() => setFocusedFrame((prev) => prev === i ? null : prev)}
                      onMaximize={() => setLightboxUrl(frame.imageUrl)} />
                  );
                })}
              </Box>
            </SortableContext>
          </DndContext>
        ) : (
          <Box onDrop={(e) => { e.preventDefault(); setDraggingOver(false); if (e.dataTransfer.files.length) handleUploadFiles(e.dataTransfer.files); }}
            onDragOver={(e) => e.preventDefault()}
            onDragEnter={() => setDraggingOver(true)}
            onDragLeave={() => setDraggingOver(false)}
            onClick={() => fileInputRef.current?.click()}
            sx={{ border: 2, borderStyle: 'dashed', borderColor: draggingOver ? 'primary.main' : 'divider', borderRadius: 2, py: 8, textAlign: 'center', cursor: 'pointer', bgcolor: draggingOver ? 'action.hover' : 'transparent', transition: 'border-color 0.2s, background-color 0.2s', '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' } }}>
            {uploadingFrames ? <CircularProgress /> : (
              <>
                <UploadFileIcon sx={{ fontSize: 48, color: draggingOver ? 'primary.main' : 'text.disabled', mb: 1 }} />
                <Typography color={draggingOver ? 'primary.main' : 'text.secondary'}>Click or drag image files here to start</Typography>
              </>
            )}
          </Box>
        )}
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <Button variant="contained" onMouseDown={() => setFocusedFrame(null)} onClick={handleGenerate}
          disabled={isGenerating || frames.length === 0}
          startIcon={isGenerating ? <CircularProgress size={16} color="inherit" /> : undefined}>
          {isGenerating ? 'Generating...' : 'Generate GIF'}
        </Button>
        {gifBlobUrl && (
          <Button variant="outlined" size="small" startIcon={<DownloadIcon />}
            onClick={() => { const a = document.createElement('a'); a.href = gifBlobUrl; a.download = `${project.title || 'output'}.gif`; a.click(); }}>
            Download
          </Button>
        )}
      </Box>

      {gifBlobUrl && (
        <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 1 }}>
            <Typography variant="subtitle2">Preview</Typography>
            <IconButton size="small" onClick={() => setPreviewKey((k) => k + 1)} sx={{ width: 24, height: 24 }}><ReplayIcon sx={{ fontSize: 16 }} /></IconButton>
          </Box>
          <Box key={previewKey} component="img" src={gifBlobUrl} alt="GIF Preview" sx={{ maxWidth: '100%', maxHeight: 500, borderRadius: 1 }} />
        </Paper>
      )}

      <Dialog open={!!lightboxUrl} onClose={() => setLightboxUrl(null)} maxWidth={false}
        slotProps={{ paper: { sx: { bgcolor: 'transparent', boxShadow: 'none', maxWidth: '90vw', maxHeight: '90vh' } } }}>
        <IconButton onClick={() => setLightboxUrl(null)} sx={{ position: 'absolute', top: 8, right: 8, bgcolor: 'rgba(0,0,0,0.5)', color: '#fff', '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' } }}><CloseIcon /></IconButton>
        {lightboxUrl && <Box component="img" src={lightboxUrl} alt="Full size" sx={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', display: 'block' }} />}
      </Dialog>

      <ConfirmDialog open={deleteOpen} title="Delete Project" message="Are you sure you want to delete this GIF project?" onConfirm={handleDelete} onCancel={() => setDeleteOpen(false)} />
    </Box>
  );
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image(); img.crossOrigin = 'anonymous'; img.onload = () => resolve(img); img.onerror = reject; img.src = src;
  });
}
