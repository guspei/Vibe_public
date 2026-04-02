'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid2';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardActionArea from '@mui/material/CardActionArea';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import PhotoLibraryIcon from '@mui/icons-material/PhotoLibrary';
import useGifEditorStore from '@/store/gifEditorStore';
import PageHeader from '@/components/common/PageHeader';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import type { IGifProject } from '@/lib/types';

export default function GifProjectList() {
  const router = useRouter();
  const projects = useGifEditorStore((s) => s.projects);
  const isLoading = useGifEditorStore((s) => s.isLoading);
  const fetchProjects = useGifEditorStore((s) => s.fetchProjects);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  if (isLoading) return <LoadingSpinner />;

  return (
    <Box>
      <PageHeader title="GIF Maker" action={
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => router.push('/gif-maker/new')}>New GIF</Button>
      } />
      <Grid container spacing={2} sx={{ mt: 1 }}>
        {projects.map((project: IGifProject) => (
          <Grid size={{ xs: 12, sm: 6, md: 4 }} key={project.id}>
            <Card variant="outlined">
              <CardActionArea onClick={() => router.push(`/gif-maker/${project.id}`)}>
                {project.frames.length > 0 && (
                  <Box component="img" src={project.frames[0].imageUrl} alt={project.title}
                    sx={{ width: '100%', aspectRatio: '16/9', objectFit: 'contain', display: 'block', bgcolor: '#000' }} />
                )}
                <CardContent sx={{ py: 1.5, px: 2 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }} noWrap>{project.title || 'Untitled'}</Typography>
                  <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                    <PhotoLibraryIcon sx={{ fontSize: 14 }} color="action" />
                    <Typography variant="caption" color="text.secondary">{project.frames.length} frame{project.frames.length !== 1 ? 's' : ''}</Typography>
                  </Box>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>
      {projects.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>No GIF projects yet. Create one to get started.</Box>
      )}
    </Box>
  );
}
