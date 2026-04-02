'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid2';
import Button from '@mui/material/Button';
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
import Badge from '@mui/material/Badge';
import CircularProgress from '@mui/material/CircularProgress';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import DeleteIcon from '@mui/icons-material/Delete';
import DownloadIcon from '@mui/icons-material/Download';
import CreateNewFolderIcon from '@mui/icons-material/CreateNewFolder';
import FolderIcon from '@mui/icons-material/Folder';
import EditIcon from '@mui/icons-material/Edit';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import {
  DndContext, closestCenter, rectIntersection, PointerSensor, KeyboardSensor,
  useSensor, useSensors, type DragEndEvent, DragOverlay, type DragStartEvent, type CollisionDetection,
} from '@dnd-kit/core';
import {
  SortableContext, sortableKeyboardCoordinates, rectSortingStrategy, arrayMove, useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useSnackbar } from 'notistack';
import usePdfEditorStore from '@/store/pdfEditorStore';
import PageHeader from '@/components/common/PageHeader';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import type { IPdfProject, IPdfGroup } from '@/lib/types';

type GridItem =
  | { type: 'pdf'; id: string; project: IPdfProject }
  | { type: 'group'; id: string; group: IPdfGroup; count: number };

function SortablePdfCard({ project, onOpen, onDelete, onDownload }: {
  project: IPdfProject; onOpen: (id: string) => void; onDelete: (id: string) => void; onDownload: (project: IPdfProject) => void;
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
            sx={{ bgcolor: 'background.paper', boxShadow: 1, '&:hover': { bgcolor: 'background.paper' } }}>
            <MoreVertIcon fontSize="small" />
          </IconButton>
        </Box>
        <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={() => setMenuAnchor(null)}>
          {project.pdfUrl && (
            <MenuItem onClick={() => { setMenuAnchor(null); onDownload(project); }}>
              <ListItemIcon><DownloadIcon fontSize="small" /></ListItemIcon><ListItemText>Download</ListItemText>
            </MenuItem>
          )}
          <MenuItem onClick={() => { setMenuAnchor(null); onDelete(project.id); }} sx={{ color: 'error.main' }}>
            <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon><ListItemText>Delete</ListItemText>
          </MenuItem>
        </Menu>
        <CardActionArea component="a" href={`/pdf-editor/${project.id}`} onClick={(e: React.MouseEvent) => { e.preventDefault(); onOpen(project.id); }}>
          {project.thumbnailUrl ? (
            <CardMedia component="img" image={project.thumbnailUrl} alt={project.title} sx={{ height: 180, objectFit: 'contain', bgcolor: '#f5f5f5' }} />
          ) : (
            <Box sx={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#f5f5f5' }}>
              <PictureAsPdfIcon sx={{ fontSize: 48, color: 'text.disabled' }} />
            </Box>
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

function SortableGroupCard({ group, count, onOpen, onDelete, onRename, onDownloadAll, pdfDragging }: {
  group: IPdfGroup; count: number; onOpen: (id: string) => void; onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void; onDownloadAll: (groupId: string) => void; pdfDragging: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver } = useSortable({ id: group.id });
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(group.name);
  const handleRename = () => { if (name.trim() && name !== group.name) onRename(group.id, name.trim()); setEditing(false); };
  const effectiveTransform = pdfDragging ? null : transform;
  return (
    <Grid size={{ xs: 6, sm: 4, md: 3 }} ref={setNodeRef} style={{ transform: CSS.Transform.toString(effectiveTransform), transition, opacity: isDragging ? 0.4 : 1 }}>
      <Card variant="outlined" sx={{
        position: 'relative', '&:hover .card-actions': { opacity: 1 }, '&:hover .drag-handle': { opacity: 0.5 },
        ...(pdfDragging && isOver ? { borderColor: 'primary.main', borderWidth: 2, bgcolor: 'action.hover', boxShadow: 3 } : {}),
      }}>
        <Box className="drag-handle" {...attributes} {...listeners} sx={{ position: 'absolute', top: 4, left: 4, zIndex: 2, opacity: 0, cursor: 'grab', color: 'text.secondary', transition: 'opacity 0.15s', '&:hover': { opacity: 1 } }}>
          <DragIndicatorIcon fontSize="small" />
        </Box>
        <Box className="card-actions" sx={{ position: 'absolute', top: 4, right: 4, zIndex: 2, opacity: 0, transition: 'opacity 0.15s' }}>
          <IconButton size="small" onClick={(e) => { e.stopPropagation(); setMenuAnchor(e.currentTarget); }}
            sx={{ bgcolor: 'background.paper', boxShadow: 1, '&:hover': { bgcolor: 'background.paper' } }}>
            <MoreVertIcon fontSize="small" />
          </IconButton>
        </Box>
        <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={() => setMenuAnchor(null)}>
          <MenuItem onClick={() => { setMenuAnchor(null); setEditing(true); }}>
            <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon><ListItemText>Rename</ListItemText>
          </MenuItem>
          {count > 0 && (
            <MenuItem onClick={() => { setMenuAnchor(null); onDownloadAll(group.id); }}>
              <ListItemIcon><DownloadIcon fontSize="small" /></ListItemIcon><ListItemText>Download all</ListItemText>
            </MenuItem>
          )}
          <MenuItem onClick={() => { setMenuAnchor(null); onDelete(group.id); }} sx={{ color: 'error.main' }}>
            <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon><ListItemText>Delete group</ListItemText>
          </MenuItem>
        </Menu>
        <CardActionArea component="a" href={`/pdf-editor/group/${group.id}`} onClick={(e: React.MouseEvent) => { e.preventDefault(); onOpen(group.id); }}>
          <Box sx={{ height: 180, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', bgcolor: '#f0f4f8' }}>
            <Badge badgeContent={count} color="primary" showZero sx={{ '& .MuiBadge-badge': { fontSize: 11, minWidth: 18, height: 18 } }}>
              <FolderIcon sx={{ fontSize: 56, color: 'action.active' }} />
            </Badge>
          </Box>
        </CardActionArea>
        <CardContent sx={{ py: 1.5, px: 1.5, '&:last-child': { pb: 1.5 } }}>
          {editing ? (
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onBlur={handleRename}
              onKeyDown={(e) => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') { setName(group.name); setEditing(false); } }}
              style={{ width: '100%', border: '1px solid #1976d2', borderRadius: 3, outline: 'none', fontSize: 13, fontWeight: 600, padding: '2px 6px', background: 'white' }} />
          ) : (
            <Typography variant="body2" sx={{ fontWeight: 600, cursor: 'pointer' }} noWrap onClick={() => setEditing(true)}>{group.name}</Typography>
          )}
          <Typography variant="caption" color="text.secondary">{count} PDF{count !== 1 ? 's' : ''}</Typography>
        </CardContent>
      </Card>
    </Grid>
  );
}

function createGroupAwareCollision(groupIds: Set<string>): CollisionDetection {
  return (args) => {
    const activeId = String(args.active.id);
    if (groupIds.has(activeId)) return closestCenter(args);
    const intersections = rectIntersection(args);
    const groupHit = intersections.find((c) => groupIds.has(String(c.id)));
    if (groupHit) return [groupHit];
    return closestCenter(args);
  };
}

export default function PdfProjectList() {
  const router = useRouter();
  const { enqueueSnackbar } = useSnackbar();
  const projects = usePdfEditorStore((s) => s.projects);
  const groups = usePdfEditorStore((s) => s.groups);
  const isLoading = usePdfEditorStore((s) => s.isLoading);
  const fetchProjects = usePdfEditorStore((s) => s.fetchProjects);
  const deleteProject = usePdfEditorStore((s) => s.deleteProject);
  const createGroup = usePdfEditorStore((s) => s.createGroup);
  const updateGroup = usePdfEditorStore((s) => s.updateGroup);
  const deleteGroupAction = usePdfEditorStore((s) => s.deleteGroup);
  const reorderProjects = usePdfEditorStore((s) => s.reorderProjects);
  const setProjects = usePdfEditorStore((s) => s.setProjects);
  const bulkUpload = usePdfEditorStore((s) => s.bulkUpload);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleteGroupTarget, setDeleteGroupTarget] = useState<string | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  const gridItems: GridItem[] = useMemo(() => {
    const items: GridItem[] = [];
    for (const g of groups) { items.push({ type: 'group', id: g.id, group: g, count: projects.filter((p) => p.groupId === g.id).length }); }
    for (const p of projects.filter((pr) => !pr.groupId)) { items.push({ type: 'pdf', id: p.id, project: p }); }
    items.sort((a, b) => {
      const orderA = a.type === 'group' ? a.group.sortOrder : a.project.sortOrder;
      const orderB = b.type === 'group' ? b.group.sortOrder : b.project.sortOrder;
      return orderA - orderB;
    });
    return items;
  }, [projects, groups]);

  const groupIds = useMemo(() => new Set(groups.map((g) => g.id)), [groups]);
  const collisionDetection = useMemo(() => createGroupAwareCollision(groupIds), [groupIds]);

  const handleOpen = useCallback((id: string) => { router.push(`/pdf-editor/${id}`); }, [router]);
  const handleOpenGroup = useCallback((id: string) => { router.push(`/pdf-editor/group/${id}`); }, [router]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    try { await deleteProject(deleteTarget); enqueueSnackbar('PDF deleted', { variant: 'success' }); }
    catch { enqueueSnackbar('Error deleting PDF', { variant: 'error' }); }
    setDeleteTarget(null);
  }, [deleteTarget, deleteProject, enqueueSnackbar]);

  const handleDownload = useCallback((project: IPdfProject) => {
    if (!project.pdfUrl) return;
    const a = document.createElement('a'); a.href = project.pdfUrl; a.download = `${project.title || 'pdf'}.pdf`; a.target = '_blank'; a.click();
  }, []);

  const handleDownloadAllInGroup = useCallback(async (groupId: string) => {
    const groupProjects = projects.filter((p) => p.groupId === groupId);
    for (const p of groupProjects) {
      if (p.pdfUrl) { const a = document.createElement('a'); a.href = p.pdfUrl; a.download = `${p.title || 'pdf'}.pdf`; a.target = '_blank'; a.click(); await new Promise((r) => setTimeout(r, 300)); }
    }
  }, [projects]);

  const handleCreateGroup = useCallback(async () => {
    try { await createGroup({ name: 'New Group' }); }
    catch { enqueueSnackbar('Error creating group', { variant: 'error' }); }
  }, [createGroup, enqueueSnackbar]);

  const handleRenameGroup = useCallback(async (id: string, name: string) => {
    try { await updateGroup(id, { name }); }
    catch { enqueueSnackbar('Error renaming group', { variant: 'error' }); }
  }, [updateGroup, enqueueSnackbar]);

  const handleDeleteGroupConfirm = useCallback(async () => {
    if (!deleteGroupTarget) return;
    try { await deleteGroupAction(deleteGroupTarget); enqueueSnackbar('Group deleted', { variant: 'success' }); }
    catch { enqueueSnackbar('Error deleting group', { variant: 'error' }); }
    setDeleteGroupTarget(null);
  }, [deleteGroupTarget, deleteGroupAction, enqueueSnackbar]);

  const handleBulkUpload = useCallback(async (files: FileList | File[]) => {
    const allFiles = Array.from(files);
    console.log('handleBulkUpload called, files:', allFiles.map(f => ({ name: f.name, type: f.type, size: f.size })));
    const pdfFiles = allFiles.filter((f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
    console.log('pdfFiles after filter:', pdfFiles.length);
    if (pdfFiles.length === 0) { enqueueSnackbar('No valid PDF files selected', { variant: 'warning' }); return; }
    setUploading(true);
    try { const created = await bulkUpload(pdfFiles); console.log('bulkUpload success:', created.length); enqueueSnackbar(`${created.length} PDF${created.length !== 1 ? 's' : ''} uploaded`, { variant: 'success' }); }
    catch (err) { console.error('bulkUpload failed:', err); enqueueSnackbar('Error uploading PDFs', { variant: 'error' }); }
    finally { setUploading(false); }
  }, [bulkUpload, enqueueSnackbar]);

  const handleFileDrop = useCallback((e: React.DragEvent) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files.length > 0) handleBulkUpload(e.dataTransfer.files); }, [handleBulkUpload]);
  const handleDragStart = useCallback((event: DragStartEvent) => { setActiveDragId(String(event.active.id)); }, []);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const activeItem = gridItems.find((i) => i.id === String(active.id));
    const overItem = gridItems.find((i) => i.id === String(over.id));
    if (!activeItem || !overItem) return;
    if (activeItem.type === 'pdf' && overItem.type === 'group') {
      const updatedProjects = projects.map((p) => p.id === activeItem.id ? { ...p, groupId: overItem.group.id } : p);
      setProjects(updatedProjects);
      try { await reorderProjects([{ id: activeItem.id, sortOrder: activeItem.project.sortOrder, groupId: overItem.group.id }]); }
      catch { enqueueSnackbar('Error moving PDF to group', { variant: 'error' }); }
      return;
    }
    const ids = gridItems.map((i) => i.id);
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove([...gridItems], oldIndex, newIndex);
    const updatedProjects = projects.map((p) => {
      if (p.groupId) return p;
      const idx = reordered.findIndex((i) => i.type === 'pdf' && i.id === p.id);
      return idx !== -1 ? { ...p, sortOrder: idx } : p;
    });
    setProjects(updatedProjects);
    try {
      const items = updatedProjects.filter((p) => !p.groupId).map((p) => ({ id: p.id, sortOrder: p.sortOrder, groupId: p.groupId }));
      await reorderProjects(items);
    } catch { enqueueSnackbar('Error reordering', { variant: 'error' }); }
  }, [gridItems, projects, setProjects, reorderProjects, enqueueSnackbar]);

  const draggedItem = activeDragId ? gridItems.find((i) => i.id === activeDragId) : null;
  const pdfDragging = draggedItem?.type === 'pdf';

  if (isLoading) return <LoadingSpinner />;

  return (
    <Box>
      <PageHeader title="PDF Editor" action={
        <Button variant="outlined" startIcon={<CreateNewFolderIcon />} onClick={handleCreateGroup} size="small">New Group</Button>
      } />
      <Box onDrop={handleFileDrop} onDragOver={(e) => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)}
        onClick={() => fileInputRef.current?.click()}
        sx={{ border: 2, borderStyle: 'dashed', borderRadius: 2, py: 2.5, mb: 3, textAlign: 'center', cursor: 'pointer', transition: 'all 0.15s',
          borderColor: dragOver ? 'primary.main' : 'divider', bgcolor: dragOver ? 'action.hover' : 'transparent',
          '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' } }}>
        {uploading ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5 }}>
            <CircularProgress size={20} /><Typography variant="body2" color="text.secondary">Uploading...</Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
            <UploadFileIcon sx={{ color: 'text.disabled' }} /><Typography variant="body2" color="text.secondary">Drop PDF files here or click to upload</Typography>
          </Box>
        )}
      </Box>
      <DndContext sensors={sensors} collisionDetection={collisionDetection} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <SortableContext items={gridItems.map((i) => i.id)} strategy={rectSortingStrategy}>
          <Grid container spacing={2}>
            {gridItems.map((item) =>
              item.type === 'pdf' ? (
                <SortablePdfCard key={item.id} project={item.project} onOpen={handleOpen} onDelete={setDeleteTarget} onDownload={handleDownload} />
              ) : (
                <SortableGroupCard key={item.id} group={item.group} count={item.count}
                  onOpen={handleOpenGroup} onDelete={setDeleteGroupTarget} onRename={handleRenameGroup}
                  onDownloadAll={handleDownloadAllInGroup} pdfDragging={pdfDragging} />
              ),
            )}
          </Grid>
        </SortableContext>
        <DragOverlay>
          {draggedItem ? (
            <Card variant="outlined" sx={{ width: 200, opacity: 0.9, boxShadow: 4 }}>
              {draggedItem.type === 'pdf' ? (
                <>
                  {draggedItem.project.thumbnailUrl ? (
                    <CardMedia component="img" image={draggedItem.project.thumbnailUrl} sx={{ height: 120, objectFit: 'contain', bgcolor: '#f5f5f5' }} />
                  ) : (
                    <Box sx={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#f5f5f5' }}><PictureAsPdfIcon sx={{ fontSize: 36, color: 'text.disabled' }} /></Box>
                  )}
                  <CardContent sx={{ py: 1, px: 1.5, '&:last-child': { pb: 1 } }}><Typography variant="caption" noWrap>{draggedItem.project.title || 'Untitled'}</Typography></CardContent>
                </>
              ) : (
                <>
                  <Box sx={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#f0f4f8' }}>
                    <Badge badgeContent={draggedItem.count} color="primary" showZero><FolderIcon sx={{ fontSize: 36, color: 'action.active' }} /></Badge>
                  </Box>
                  <CardContent sx={{ py: 1, px: 1.5, '&:last-child': { pb: 1 } }}><Typography variant="caption" noWrap>{draggedItem.group.name}</Typography></CardContent>
                </>
              )}
            </Card>
          ) : null}
        </DragOverlay>
      </DndContext>
      <input ref={fileInputRef} type="file" accept="application/pdf" multiple hidden
        onChange={(e) => { if (e.target.files && e.target.files.length > 0) { handleBulkUpload(e.target.files); e.target.value = ''; } }} />
      <ConfirmDialog open={!!deleteTarget} title="Delete PDF" message="Are you sure you want to delete this PDF?" onConfirm={handleDeleteConfirm} onCancel={() => setDeleteTarget(null)} />
      <ConfirmDialog open={!!deleteGroupTarget} title="Delete Group" message="Are you sure you want to delete this group? PDFs inside will be ungrouped, not deleted." onConfirm={handleDeleteGroupConfirm} onCancel={() => setDeleteGroupTarget(null)} />
    </Box>
  );
}
