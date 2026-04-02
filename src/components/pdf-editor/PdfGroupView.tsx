'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid2';
import Card from '@mui/material/Card';
import CardMedia from '@mui/material/CardMedia';
import CardContent from '@mui/material/CardContent';
import CardActionArea from '@mui/material/CardActionArea';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import CircularProgress from '@mui/material/CircularProgress';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import DeleteIcon from '@mui/icons-material/Delete';
import DownloadIcon from '@mui/icons-material/Download';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor,
  useSensor, useSensors, type DragEndEvent, DragOverlay, type DragStartEvent, useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext, sortableKeyboardCoordinates, rectSortingStrategy, arrayMove, useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useSnackbar } from 'notistack';
import usePdfEditorStore from '@/store/pdfEditorStore';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import type { IPdfProject } from '@/lib/types';

const UNGROUP_DROPPABLE_ID = '__ungroup__';

interface PdfGroupViewProps { groupId: string; }

export default function PdfGroupView({ groupId }: PdfGroupViewProps) {
  const router = useRouter();
  const { enqueueSnackbar } = useSnackbar();
  const projects = usePdfEditorStore((s) => s.projects);
  const groups = usePdfEditorStore((s) => s.groups);
  const isLoading = usePdfEditorStore((s) => s.isLoading);
  const fetchProjects = usePdfEditorStore((s) => s.fetchProjects);
  const deleteProject = usePdfEditorStore((s) => s.deleteProject);
  const reorderProjects = usePdfEditorStore((s) => s.reorderProjects);
  const setProjects = usePdfEditorStore((s) => s.setProjects);
  const bulkUpload = usePdfEditorStore((s) => s.bulkUpload);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => { if (projects.length === 0) fetchProjects(); }, [projects.length, fetchProjects]);

  const group = groups.find((g) => g.id === groupId);
  const groupProjects = projects.filter((p) => p.groupId === groupId).sort((a, b) => a.sortOrder - b.sortOrder);

  const handleBulkUpload = useCallback(async (files: FileList | File[]) => {
    const pdfFiles = Array.from(files).filter((f) => f.type === 'application/pdf');
    if (pdfFiles.length === 0) { enqueueSnackbar('No valid PDF files selected', { variant: 'warning' }); return; }
    setUploading(true);
    try { const created = await bulkUpload(pdfFiles, groupId); enqueueSnackbar(`${created.length} PDF${created.length !== 1 ? 's' : ''} uploaded`, { variant: 'success' }); }
    catch { enqueueSnackbar('Error uploading PDFs', { variant: 'error' }); }
    finally { setUploading(false); }
  }, [bulkUpload, groupId, enqueueSnackbar]);

  const handleFileDrop = useCallback((e: React.DragEvent) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files.length > 0) handleBulkUpload(e.dataTransfer.files); }, [handleBulkUpload]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    try { await deleteProject(deleteTarget); enqueueSnackbar('PDF deleted', { variant: 'success' }); }
    catch { enqueueSnackbar('Error deleting PDF', { variant: 'error' }); }
    setDeleteTarget(null);
  }, [deleteTarget, deleteProject, enqueueSnackbar]);

  const handleRemoveFromGroup = useCallback(async (project: IPdfProject) => {
    const updated = projects.map((p) => p.id === project.id ? { ...p, groupId: null } : p);
    setProjects(updated);
    try { await reorderProjects([{ id: project.id, sortOrder: project.sortOrder, groupId: null }]); enqueueSnackbar('PDF removed from group', { variant: 'success' }); }
    catch { enqueueSnackbar('Error removing from group', { variant: 'error' }); }
  }, [projects, setProjects, reorderProjects, enqueueSnackbar]);

  const handleDownload = useCallback((project: IPdfProject) => {
    if (!project.pdfUrl) return;
    const a = document.createElement('a'); a.href = project.pdfUrl; a.download = `${project.title || 'pdf'}.pdf`; a.target = '_blank'; a.click();
  }, []);

  const handleDragStart = useCallback((event: DragStartEvent) => { setActiveDragId(String(event.active.id)); }, []);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over) return;
    if (String(over.id) === UNGROUP_DROPPABLE_ID) {
      const project = groupProjects.find((p) => p.id === String(active.id));
      if (project) await handleRemoveFromGroup(project);
      return;
    }
    if (active.id === over.id) return;
    const ids = groupProjects.map((p) => p.id);
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove([...groupProjects], oldIndex, newIndex);
    const reorderItems = reordered.map((p, i) => ({ id: p.id, sortOrder: i, groupId: groupId }));
    const updatedProjects = projects.map((p) => { const item = reorderItems.find((r) => r.id === p.id); return item ? { ...p, sortOrder: item.sortOrder } : p; });
    setProjects(updatedProjects);
    try { await reorderProjects(reorderItems); }
    catch { enqueueSnackbar('Error reordering', { variant: 'error' }); }
  }, [groupProjects, projects, groupId, setProjects, reorderProjects, handleRemoveFromGroup, enqueueSnackbar]);

  const draggedProject = activeDragId ? groupProjects.find((p) => p.id === activeDragId) : null;

  if (isLoading) return <LoadingSpinner />;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
          <IconButton onClick={() => router.push('/pdf-editor')} size="small"><ArrowBackIcon /></IconButton>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>{group?.name || 'Group'}</Typography>
          <Typography variant="body2" color="text.secondary">({groupProjects.length} PDF{groupProjects.length !== 1 ? 's' : ''})</Typography>
        </Box>
        <Box onDrop={handleFileDrop} onDragOver={(e) => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)}
          onClick={() => fileInputRef.current?.click()}
          sx={{ border: 2, borderStyle: 'dashed', borderRadius: 2, py: 2.5, mb: 3, textAlign: 'center', cursor: 'pointer', transition: 'all 0.15s',
            borderColor: dragOver ? 'primary.main' : 'divider', bgcolor: dragOver ? 'action.hover' : 'transparent', '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' } }}>
          {uploading ? (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5 }}><CircularProgress size={20} /><Typography variant="body2" color="text.secondary">Uploading...</Typography></Box>
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}><UploadFileIcon sx={{ color: 'text.disabled' }} /><Typography variant="body2" color="text.secondary">Drop PDF files here or click to upload</Typography></Box>
          )}
        </Box>
        <SortableContext items={groupProjects.map((p) => p.id)} strategy={rectSortingStrategy}>
          <Grid container spacing={2}>
            {groupProjects.map((project) => (
              <SortablePdfInGroupCard key={project.id} project={project}
                onOpen={() => router.push(`/pdf-editor/${project.id}`)} onDelete={() => setDeleteTarget(project.id)}
                onDownload={() => handleDownload(project)} onRemoveFromGroup={() => handleRemoveFromGroup(project)} />
            ))}
          </Grid>
        </SortableContext>
        {groupProjects.length === 0 && !uploading && (
          <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}><Typography variant="body2">No PDFs in this group yet.</Typography></Box>
        )}
        {activeDragId && <UngroupDropZone />}
        <input ref={fileInputRef} type="file" accept="application/pdf" multiple hidden
          onChange={(e) => { if (e.target.files && e.target.files.length > 0) { handleBulkUpload(e.target.files); e.target.value = ''; } }} />
        <ConfirmDialog open={!!deleteTarget} title="Delete PDF" message="Are you sure you want to delete this PDF?" onConfirm={handleDeleteConfirm} onCancel={() => setDeleteTarget(null)} />
      </Box>
      <DragOverlay>
        {draggedProject ? (
          <Card variant="outlined" sx={{ width: 200, opacity: 0.9, boxShadow: 4 }}>
            {draggedProject.thumbnailUrl ? (
              <CardMedia component="img" image={draggedProject.thumbnailUrl} sx={{ height: 120, objectFit: 'contain', bgcolor: '#f5f5f5' }} />
            ) : (
              <Box sx={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#f5f5f5' }}><PictureAsPdfIcon sx={{ fontSize: 36, color: 'text.disabled' }} /></Box>
            )}
            <CardContent sx={{ py: 1, px: 1.5, '&:last-child': { pb: 1 } }}><Typography variant="caption" noWrap>{draggedProject.title || 'Untitled'}</Typography></CardContent>
          </Card>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function UngroupDropZone() {
  const { isOver, setNodeRef } = useDroppable({ id: UNGROUP_DROPPABLE_ID });
  return (
    <Box ref={setNodeRef} sx={{ mt: 3, border: 2, borderStyle: 'dashed', borderRadius: 2, py: 2, textAlign: 'center', transition: 'all 0.15s',
      borderColor: isOver ? 'warning.main' : 'divider', bgcolor: isOver ? 'warning.light' : 'transparent', opacity: isOver ? 1 : 0.7 }}>
      <Typography variant="body2" color={isOver ? 'warning.dark' : 'text.secondary'} sx={{ fontWeight: isOver ? 600 : 400 }}>Drop here to remove from group</Typography>
    </Box>
  );
}

function SortablePdfInGroupCard({ project, onOpen, onDelete, onDownload, onRemoveFromGroup }: {
  project: IPdfProject; onOpen: () => void; onDelete: () => void; onDownload: () => void; onRemoveFromGroup: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: project.id });
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  return (
    <Grid size={{ xs: 6, sm: 4, md: 3 }} ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}>
      <Card variant="outlined" sx={{ position: 'relative', '&:hover .card-actions': { opacity: 1 }, '&:hover .drag-handle': { opacity: 0.5 } }}>
        <Box className="drag-handle" {...attributes} {...listeners} sx={{ position: 'absolute', top: 4, left: 4, zIndex: 2, opacity: 0, cursor: 'grab', color: 'text.secondary', transition: 'opacity 0.15s', '&:hover': { opacity: 1 } }}>
          <DragIndicatorIcon fontSize="small" />
        </Box>
        <Box className="card-actions" sx={{ position: 'absolute', top: 4, right: 4, zIndex: 2, opacity: 0, transition: 'opacity 0.15s' }}>
          <IconButton size="small" onClick={(e) => { e.stopPropagation(); setMenuAnchor(e.currentTarget); }}
            sx={{ bgcolor: 'background.paper', boxShadow: 1, '&:hover': { bgcolor: 'background.paper' } }}><MoreVertIcon fontSize="small" /></IconButton>
        </Box>
        <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={() => setMenuAnchor(null)}>
          {project.pdfUrl && (
            <MenuItem onClick={() => { setMenuAnchor(null); onDownload(); }}><ListItemIcon><DownloadIcon fontSize="small" /></ListItemIcon><ListItemText>Download</ListItemText></MenuItem>
          )}
          <MenuItem onClick={() => { setMenuAnchor(null); onRemoveFromGroup(); }}><ListItemIcon><OpenInNewIcon fontSize="small" /></ListItemIcon><ListItemText>Remove from group</ListItemText></MenuItem>
          <MenuItem onClick={() => { setMenuAnchor(null); onDelete(); }} sx={{ color: 'error.main' }}><ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon><ListItemText>Delete</ListItemText></MenuItem>
        </Menu>
        <CardActionArea component="a" href={`/pdf-editor/${project.id}`} onClick={(e: React.MouseEvent) => { e.preventDefault(); onOpen(); }}>
          {project.thumbnailUrl ? (
            <CardMedia component="img" image={project.thumbnailUrl} alt={project.title} sx={{ height: 180, objectFit: 'contain', bgcolor: '#f5f5f5' }} />
          ) : (
            <Box sx={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#f5f5f5' }}><PictureAsPdfIcon sx={{ fontSize: 48, color: 'text.disabled' }} /></Box>
          )}
          <CardContent sx={{ py: 1.5, px: 1.5, '&:last-child': { pb: 1.5 } }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>{project.title || 'Untitled'}</Typography>
            <Typography variant="caption" color="text.secondary">{project.fields.length} field{project.fields.length !== 1 ? 's' : ''}</Typography>
          </CardContent>
        </CardActionArea>
      </Card>
    </Grid>
  );
}
