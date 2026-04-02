'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import IconButton from '@mui/material/IconButton';
import CircularProgress from '@mui/material/CircularProgress';
import Tooltip from '@mui/material/Tooltip';

import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DeleteIcon from '@mui/icons-material/Delete';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DownloadIcon from '@mui/icons-material/Download';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import FontDownloadIcon from '@mui/icons-material/FontDownload';

import { useSnackbar } from 'notistack';
import usePdfEditorStore from '@/store/pdfEditorStore';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import { matchFont, getDefaultFontPath, loadFontBytes } from '@/lib/pdfFontLibrary';
import type { IPdfTextField, PdfFontSource } from '@/lib/types';

interface PdfEditorViewProps {
  projectId: string;
}

interface TextItem {
  str: string;
  transform: number[];
  width: number;
  height: number;
  fontName: string;
}

interface TextBlock {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontName: string;
  items: TextItem[];
}

export default function PdfEditorView({ projectId }: PdfEditorViewProps) {
  const router = useRouter();
  const { enqueueSnackbar } = useSnackbar();

  const project = usePdfEditorStore((s) => s.activeProject);
  const isLoading = usePdfEditorStore((s) => s.isLoading);
  const currentPage = usePdfEditorStore((s) => s.currentPage);
  const totalPages = usePdfEditorStore((s) => s.totalPages);
  const scale = usePdfEditorStore((s) => s.scale);
  const selectedFieldId = usePdfEditorStore((s) => s.selectedFieldId);
  const pdfBytes = usePdfEditorStore((s) => s.pdfBytes);

  const fetchProject = usePdfEditorStore((s) => s.fetchProject);
  const createProject = usePdfEditorStore((s) => s.createProject);
  const updateProject = usePdfEditorStore((s) => s.updateProject);
  const deleteProject = usePdfEditorStore((s) => s.deleteProject);
  const setActiveProject = usePdfEditorStore((s) => s.setActiveProject);
  const uploadPdf = usePdfEditorStore((s) => s.uploadPdf);

  const setCurrentPage = usePdfEditorStore((s) => s.setCurrentPage);
  const setTotalPages = usePdfEditorStore((s) => s.setTotalPages);
  const setScale = usePdfEditorStore((s) => s.setScale);
  const setSelectedFieldId = usePdfEditorStore((s) => s.setSelectedFieldId);
  const setPdfBytes = usePdfEditorStore((s) => s.setPdfBytes);
  const addField = usePdfEditorStore((s) => s.addField);
  const updateField = usePdfEditorStore((s) => s.updateField);

  const isNew = project?.id === 'new';
  const [title, setTitle] = useState('');
  const titleDirty = useRef(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [textBlocks, setTextBlocks] = useState<TextBlock[]>([]);
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [draggingOver, setDraggingOver] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fontInputRef = useRef<HTMLInputElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pdfDocRef = useRef<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  const [canvasDimensions, setCanvasDimensions] = useState({ width: 0, height: 0 });
  const loadedFontFaces = useRef<Set<string>>(new Set());
  const [cssFontMap, setCssFontMap] = useState<Record<string, string>>({});

  const registerCssFont = useCallback(async (fontPath: string, fontName: string) => {
    if (loadedFontFaces.current.has(fontPath)) return;
    loadedFontFaces.current.add(fontPath);
    try {
      const cssFamily = `pdf-font-${fontName.replace(/[^a-zA-Z0-9]/g, '')}`;
      const res = await fetch(fontPath);
      if (!res.ok) return;
      const buffer = await res.arrayBuffer();
      const face = new FontFace(cssFamily, buffer);
      await face.load();
      document.fonts.add(face);
      setCssFontMap((prev) => ({ ...prev, [fontPath]: cssFamily }));
    } catch {
      // Fallback
    }
  }, []);

  useEffect(() => {
    if (projectId === 'new') {
      const current = usePdfEditorStore.getState().activeProject;
      if (!current || current.id === 'new') {
        setActiveProject({
          id: 'new', title: '', pdfUrl: null, thumbnailUrl: null,
          modifiedPdfUrl: null, fields: [], uploadedFonts: [],
          groupId: null, sortOrder: 0, createdAt: '', updatedAt: '',
        });
      }
    } else {
      fetchProject(projectId);
    }
    return () => {
      setActiveProject(null);
      setPdfBytes(null);
      clearTimeout(saveTimer.current);
      pdfDocRef.current = null;
    };
  }, [projectId, fetchProject, setActiveProject, setPdfBytes]);

  useEffect(() => {
    if (project) setTitle(project.title);
  }, [project?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (project?.pdfUrl && !pdfBytes) {
      fetch(project.pdfUrl)
        .then((res) => res.arrayBuffer())
        .then((buf) => setPdfBytes(new Uint8Array(buf)))
        .catch(() => enqueueSnackbar('Error loading PDF', { variant: 'error' }));
    }
  }, [project?.pdfUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!pdfBytes) return;
    renderPage();
  }, [pdfBytes, currentPage, scale]); // eslint-disable-line react-hooks/exhaustive-deps

  const persistNew = useCallback(async (): Promise<string> => {
    const p = usePdfEditorStore.getState().activeProject;
    const created = await createProject({ title: p?.title || 'Untitled' });
    usePdfEditorStore.setState((s) => ({
      activeProject: s.activeProject ? { ...s.activeProject, id: created.id } : null,
    }));
    window.history.replaceState(null, '', `/pdf-editor/${created.id}`);
    return created.id;
  }, [createProject]);

  const getRealId = useCallback(async (): Promise<string> => {
    const p = usePdfEditorStore.getState().activeProject;
    if (p?.id === 'new') return persistNew();
    return p?.id || projectId;
  }, [projectId, persistNew]);

  const debouncedSave = useCallback(() => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const state = usePdfEditorStore.getState();
      if (!state.activeProject || state.activeProject.id === 'new') return;
      updateProject(state.activeProject.id, { fields: state.activeProject.fields }).catch(() => {});
    }, 1500);
  }, [updateProject]);

  const renderPage = useCallback(async () => {
    if (!pdfBytes || !canvasRef.current) return;
    const pdfjsLib = await import('pdfjs-dist');
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
    }
    if (!pdfDocRef.current) {
      const loadingTask = pdfjsLib.getDocument({ data: pdfBytes.slice() });
      pdfDocRef.current = await loadingTask.promise;
      setTotalPages(pdfDocRef.current.numPages);
    }
    const page = await pdfDocRef.current.getPage(currentPage + 1);
    const viewport = page.getViewport({ scale });
    const canvas = canvasRef.current;
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    setCanvasDimensions({ width: viewport.width, height: viewport.height });
    const ctx = canvas.getContext('2d')!;
    await page.render({ canvasContext: ctx, viewport }).promise;

    const textContent = await page.getTextContent();
    const blocks: TextBlock[] = [];
    for (const item of textContent.items) {
      const ti = item as TextItem;
      if (!ti.str || !ti.str.trim()) continue;
      const tx = ti.transform[4];
      const ty = ti.transform[5];
      const fontSize = Math.abs(ti.transform[0]) || Math.abs(ti.transform[3]) || 12;
      const x = tx * scale;
      const y = viewport.height - (ty * scale) - (fontSize * scale);
      const w = ti.width * scale;
      const h = fontSize * scale;
      blocks.push({ text: ti.str, x, y, width: w, height: h, fontSize, fontName: ti.fontName || '', items: [ti] });
    }
    setTextBlocks(blocks);
  }, [pdfBytes, currentPage, scale, setTotalPages]);

  const handleTitleBlur = useCallback(async () => {
    if (!project || !titleDirty.current) return;
    titleDirty.current = false;
    usePdfEditorStore.setState((s) => ({
      activeProject: s.activeProject ? { ...s.activeProject, title } : null,
    }));
    if (isNew) return;
    try { await updateProject(project.id, { title }); }
    catch { enqueueSnackbar('Error saving title', { variant: 'error' }); }
  }, [project, title, isNew, updateProject, enqueueSnackbar]);

  const handleUploadPdf = useCallback(async (file: File) => {
    console.log('handleUploadPdf called:', file.name, 'type:', file.type, 'size:', file.size);
    if (!file || (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf'))) {
      console.warn('PDF rejected: invalid type/extension', file.type, file.name);
      enqueueSnackbar('Please select a valid PDF file', { variant: 'error' });
      return;
    }
    setUploading(true);
    try {
      const realId = await getRealId();
      console.log('realId:', realId, 'project.id:', project?.id);
      if (project && project.id !== realId) {
        await updateProject(realId, { title: title || 'Untitled' });
      }
      await uploadPdf(realId, file);
      setCurrentPage(0);
      pdfDocRef.current = null;
      enqueueSnackbar('PDF uploaded', { variant: 'success' });
    } catch (err) { console.error('PDF upload failed:', err); enqueueSnackbar('Error uploading PDF', { variant: 'error' }); }
    finally { setUploading(false); }
  }, [project, title, getRealId, uploadPdf, updateProject, setCurrentPage, enqueueSnackbar]);

  const handleTextBlockClick = useCallback((block: TextBlock) => {
    const fields = usePdfEditorStore.getState().activeProject?.fields || [];
    const existing = fields.find(
      (f) => f.pageIndex === currentPage && f.originalText === block.text &&
        Math.abs(f.x - block.x) < 2 && Math.abs(f.y - block.y) < 2,
    );
    if (existing) {
      setSelectedFieldId(existing.id);
      setEditingFieldId(existing.id);
      setEditValue(existing.newText || existing.originalText);
      return;
    }
    const fontMatch = matchFont(block.fontName);
    const id = crypto.randomUUID();
    const field: IPdfTextField = {
      id, pageIndex: currentPage, originalText: block.text, newText: block.text,
      x: block.x, y: block.y, width: block.width, height: block.height,
      fontSize: block.fontSize, fontName: block.fontName,
      fontSource: (fontMatch?.source || 'default') as PdfFontSource,
      fontUrl: fontMatch?.path || null,
    };
    addField(field);
    setSelectedFieldId(id);
    setEditingFieldId(id);
    setEditValue(block.text);
    debouncedSave();
    const fontPath = fontMatch?.path || getDefaultFontPath();
    registerCssFont(fontPath, block.fontName);
  }, [currentPage, addField, setSelectedFieldId, debouncedSave, registerCssFont]);

  const handleFieldEditDone = useCallback((fieldId: string) => {
    updateField(fieldId, editValue);
    setEditingFieldId(null);
    debouncedSave();
  }, [editValue, updateField, debouncedSave]);

  const handleDelete = useCallback(async () => {
    if (isNew) { setActiveProject(null); router.push('/pdf-editor'); return; }
    try {
      await deleteProject(project!.id);
      enqueueSnackbar('Project deleted', { variant: 'success' });
      router.push('/pdf-editor');
    } catch { enqueueSnackbar('Error deleting project', { variant: 'error' }); }
  }, [project, isNew, deleteProject, setActiveProject, enqueueSnackbar, router]);

  const handleGenerateModifiedPdf = useCallback(async () => {
    if (!pdfBytes || !project) return;
    const fields = project.fields.filter((f) => f.newText !== f.originalText);
    if (fields.length === 0) {
      const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${project.title || 'pdf'}.pdf`; a.click();
      URL.revokeObjectURL(url);
      return;
    }
    setGenerating(true);
    try {
      const { PDFDocument, rgb } = await import('pdf-lib');
      const fontkit = (await import('@pdf-lib/fontkit')).default;
      const pdfDoc = await PDFDocument.load(pdfBytes.slice());
      pdfDoc.registerFontkit(fontkit);
      const fontMap = new Map<string, Awaited<ReturnType<typeof pdfDoc.embedFont>>>();
      for (const field of fields) {
        const fontKey = field.fontUrl || getDefaultFontPath();
        if (!fontMap.has(fontKey)) {
          const fontBytes = await loadFontBytes(fontKey);
          fontMap.set(fontKey, await pdfDoc.embedFont(fontBytes));
        }
      }
      const pages = pdfDoc.getPages();
      for (const field of fields) {
        const page = pages[field.pageIndex];
        if (!page) continue;
        const font = fontMap.get(field.fontUrl || getDefaultFontPath())!;
        const pdfX = field.x / scale;
        const pageHeight = page.getHeight();
        const pdfY = pageHeight - (field.y / scale) - field.fontSize;
        const pdfWidth = field.width / scale;
        const descenderOffset = field.fontSize * 0.25;
        page.drawRectangle({ x: pdfX, y: pdfY - descenderOffset, width: pdfWidth, height: field.fontSize + descenderOffset, color: rgb(1, 1, 1) });
        page.drawText(field.newText, { x: pdfX, y: pdfY, size: field.fontSize, font, color: rgb(0, 0, 0) });
      }
      const modifiedBytes = await pdfDoc.save();
      const blob = new Blob([modifiedBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${project.title || 'modified'}.pdf`; a.click();
      URL.revokeObjectURL(url);
      enqueueSnackbar('PDF generated and downloaded', { variant: 'success' });
    } catch (err) {
      console.error('PDF generation error:', err);
      enqueueSnackbar('Error generating modified PDF', { variant: 'error' });
    } finally { setGenerating(false); }
  }, [pdfBytes, project, scale, enqueueSnackbar]);

  const handleUploadFont = useCallback(async (file: File) => {
    if (!project || !selectedFieldId) return;
    try {
      const realId = await getRealId();
      const fontName = file.name.replace(/\.(ttf|otf)$/i, '');
      const uploaded = await usePdfEditorStore.getState().uploadFont(realId, file, fontName);
      const fields = usePdfEditorStore.getState().activeProject?.fields || [];
      const field = fields.find((f) => f.id === selectedFieldId);
      if (field) {
        usePdfEditorStore.setState((s) => ({
          activeProject: s.activeProject ? {
            ...s.activeProject,
            fields: s.activeProject.fields.map((f) =>
              f.id === selectedFieldId ? { ...f, fontSource: 'uploaded' as PdfFontSource, fontUrl: uploaded.url || null } : f,
            ),
          } : null,
        }));
        debouncedSave();
      }
      enqueueSnackbar(`Font "${fontName}" uploaded`, { variant: 'success' });
    } catch { enqueueSnackbar('Error uploading font', { variant: 'error' }); }
  }, [project, selectedFieldId, getRealId, debouncedSave, enqueueSnackbar]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDraggingOver(false);
    const file = e.dataTransfer.files[0];
    if (!file) { console.warn('Drop: no file found'); return; }
    console.log('Drop file:', file.name, 'type:', file.type, 'size:', file.size);
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      handleUploadPdf(file);
    } else {
      console.warn('Drop: rejected file, not a PDF:', file.type, file.name);
    }
  }, [handleUploadPdf]);

  if ((projectId !== 'new' && isLoading) || !project) return <LoadingSpinner />;

  const fields = project.fields;
  const pageFields = fields.filter((f) => f.pageIndex === currentPage);
  const modifiedCount = fields.filter((f) => f.newText !== f.originalText).length;

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <IconButton onClick={() => router.push('/pdf-editor')} size="small"><ArrowBackIcon /></IconButton>
        <TextField
          value={title}
          onChange={(e) => { setTitle(e.target.value); titleDirty.current = true; usePdfEditorStore.setState((s) => ({ activeProject: s.activeProject ? { ...s.activeProject, title: e.target.value } : null })); }}
          onBlur={handleTitleBlur}
          variant="standard" placeholder="PDF project title..."
          InputProps={{ disableUnderline: true }}
          inputProps={{ style: { fontSize: '1.5rem', fontWeight: 700 } }}
          sx={{ flex: 1, '& .MuiInputBase-root': { borderBottom: '1px dashed transparent', '&:hover': { borderBottom: '1px dashed', borderColor: 'divider' }, '&.Mui-focused': { borderBottom: '1px solid', borderColor: 'primary.main' } } }}
        />
        <IconButton onClick={() => setDeleteOpen(true)} size="small" sx={{ opacity: 0.4, '&:hover': { opacity: 1, color: 'error.main' } }}><DeleteIcon /></IconButton>
      </Box>

      {pdfBytes && (
        <Paper variant="outlined" sx={{ p: 0.75, px: 1.5, mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <IconButton size="small" disabled={currentPage === 0} onClick={() => setCurrentPage(currentPage - 1)}><NavigateBeforeIcon fontSize="small" /></IconButton>
            <Typography variant="caption" sx={{ minWidth: 40, textAlign: 'center' }}>{currentPage + 1}/{totalPages}</Typography>
            <IconButton size="small" disabled={currentPage >= totalPages - 1} onClick={() => setCurrentPage(currentPage + 1)}><NavigateNextIcon fontSize="small" /></IconButton>
            <Box sx={{ width: 1, height: 20, borderLeft: 1, borderColor: 'divider', mx: 0.5 }} />
            <IconButton size="small" onClick={() => setScale(Math.max(0.5, scale - 0.25))}><ZoomOutIcon fontSize="small" /></IconButton>
            <Typography variant="caption" sx={{ minWidth: 32, textAlign: 'center' }}>{Math.round(scale * 100)}%</Typography>
            <IconButton size="small" onClick={() => setScale(Math.min(3, scale + 0.25))}><ZoomInIcon fontSize="small" /></IconButton>
            <Box sx={{ flex: 1 }} />
            <Tooltip title="Replace PDF">
              <IconButton size="small" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                {uploading ? <CircularProgress size={16} /> : <UploadFileIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
            <Tooltip title="Upload custom font (.ttf/.otf)">
              <IconButton size="small" onClick={() => fontInputRef.current?.click()}><FontDownloadIcon fontSize="small" /></IconButton>
            </Tooltip>
            <Button size="small" variant="contained"
              startIcon={generating ? <CircularProgress size={14} color="inherit" /> : <DownloadIcon />}
              onClick={handleGenerateModifiedPdf} disabled={generating}
              sx={{ ml: 0.5, textTransform: 'none', fontSize: 12 }}>
              {generating ? 'Generating...' : modifiedCount > 0 ? `Download (${modifiedCount})` : 'Download'}
            </Button>
          </Box>
        </Paper>
      )}

      {pdfBytes ? (
        <Paper ref={containerRef} variant="outlined" sx={{ position: 'relative', overflow: 'auto', maxHeight: 'calc(100vh - 200px)', bgcolor: '#f0f0f0' }}>
          <Box sx={{ position: 'relative', display: 'inline-block' }}>
            <canvas ref={canvasRef} style={{ display: 'block' }} />
            {textBlocks.map((block, i) => {
              const existingField = pageFields.find((f) => f.originalText === block.text && Math.abs(f.x - block.x) < 2 && Math.abs(f.y - block.y) < 2);
              const isModified = existingField && existingField.newText !== existingField.originalText;
              const isEditing = existingField && editingFieldId === existingField.id;
              const isSelected = existingField && selectedFieldId === existingField.id;
              return (
                <Box key={i} onClick={() => handleTextBlockClick(block)}
                  sx={{
                    position: 'absolute', left: block.x, top: block.y,
                    width: isModified ? 'auto' : block.width + 4, minWidth: block.width + 4, height: block.height + 4,
                    cursor: 'pointer',
                    border: isSelected ? '2px solid' : '1px solid transparent',
                    borderColor: isSelected ? 'primary.main' : 'transparent',
                    bgcolor: isModified ? 'white' : 'transparent', borderRadius: 0.5,
                    display: 'flex', alignItems: 'center',
                    '&:hover': { bgcolor: isModified ? 'white' : 'rgba(25, 118, 210, 0.1)', border: '1px solid', borderColor: isModified ? 'success.main' : 'primary.light' },
                    transition: 'all 0.15s', zIndex: isEditing ? 10 : isModified ? 5 : 1,
                  }}>
                  {isModified && !isEditing && existingField && (
                    <span style={{ fontSize: block.fontSize * scale * 0.85, fontFamily: cssFontMap[existingField.fontUrl || getDefaultFontPath()] || 'sans-serif', color: '#000', whiteSpace: 'nowrap', lineHeight: 1, padding: '0 2px' }}>
                      {existingField.newText}
                    </span>
                  )}
                  {isEditing && existingField && (
                    <input autoFocus value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={() => handleFieldEditDone(existingField.id)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleFieldEditDone(existingField.id); if (e.key === 'Escape') setEditingFieldId(null); }}
                      style={{
                        position: 'absolute', left: -2, top: -2,
                        width: Math.max(block.width + 40, 120), height: block.height + 4,
                        fontSize: block.fontSize * scale * 0.85,
                        fontFamily: cssFontMap[existingField.fontUrl || getDefaultFontPath()] || 'sans-serif',
                        border: '2px solid #1976d2', borderRadius: 3, outline: 'none',
                        padding: '0 4px', background: 'white', zIndex: 20,
                      }}
                    />
                  )}
                </Box>
              );
            })}
          </Box>
        </Paper>
      ) : (
        <Box onDrop={handleDrop} onDragOver={(e) => e.preventDefault()}
          onDragEnter={() => setDraggingOver(true)} onDragLeave={() => setDraggingOver(false)}
          onClick={() => fileInputRef.current?.click()}
          sx={{ border: 2, borderStyle: 'dashed', borderColor: draggingOver ? 'primary.main' : 'divider', borderRadius: 2, py: 8, textAlign: 'center', cursor: 'pointer', bgcolor: draggingOver ? 'action.hover' : 'transparent', transition: 'border-color 0.2s, background-color 0.2s', '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' } }}>
          {uploading ? <CircularProgress /> : (
            <>
              <UploadFileIcon sx={{ fontSize: 48, color: draggingOver ? 'primary.main' : 'text.disabled', mb: 1 }} />
              <Typography color={draggingOver ? 'primary.main' : 'text.secondary'}>Click or drag a PDF file here to start editing</Typography>
            </>
          )}
        </Box>
      )}

      {modifiedCount > 0 && (
        <Paper variant="outlined" sx={{ mt: 2, p: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Modified fields ({modifiedCount})</Typography>
          {fields.filter((f) => f.newText !== f.originalText).map((f) => (
            <Box key={f.id} sx={{ display: 'flex', gap: 2, mb: 0.5, fontSize: 13 }}>
              <Typography variant="caption" sx={{ textDecoration: 'line-through', color: 'text.secondary', flex: 1 }}>{f.originalText}</Typography>
              <Typography variant="caption" sx={{ fontWeight: 600, flex: 1 }}>{f.newText}</Typography>
              <Typography variant="caption" color="text.disabled">p.{f.pageIndex + 1}</Typography>
            </Box>
          ))}
        </Paper>
      )}

      <input ref={fileInputRef} type="file" accept="application/pdf" hidden
        onChange={(e) => { const file = e.target.files?.[0]; if (file) { handleUploadPdf(file); e.target.value = ''; } }} />
      <input ref={fontInputRef} type="file" accept=".ttf,.otf" hidden
        onChange={(e) => { const file = e.target.files?.[0]; if (file) { handleUploadFont(file); e.target.value = ''; } }} />

      <ConfirmDialog open={deleteOpen} title="Delete Project" message="Are you sure you want to delete this PDF project?"
        onConfirm={handleDelete} onCancel={() => setDeleteOpen(false)} />
    </Box>
  );
}
