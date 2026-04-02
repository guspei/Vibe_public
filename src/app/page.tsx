'use client';

import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import Typography from '@mui/material/Typography';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import GifIcon from '@mui/icons-material/Gif';

const tools = [
  { label: 'PDF Editor', description: 'Edit, annotate and modify PDF files', href: '/pdf-editor', icon: <PictureAsPdfIcon sx={{ fontSize: 56, color: 'primary.main' }} /> },
  { label: 'GIF Maker', description: 'Create animated GIFs from images', href: '/gif-maker', icon: <GifIcon sx={{ fontSize: 56, color: 'primary.main' }} /> },
];

export default function HomePage() {
  const router = useRouter();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', pt: { xs: 4, sm: 8 } }}>
      <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>Welcome to Tools</Typography>
      <Typography color="text.secondary" sx={{ mb: 5 }}>Select a tool to get started</Typography>
      <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', justifyContent: 'center' }}>
        {tools.map((tool) => (
          <Card key={tool.href} variant="outlined" sx={{ width: 220, transition: 'all 0.2s', '&:hover': { borderColor: 'primary.main', boxShadow: 3 } }}>
            <CardActionArea onClick={() => router.push(tool.href)} sx={{ p: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5 }}>
              {tool.icon}
              <Typography variant="h6" sx={{ fontWeight: 600 }}>{tool.label}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>{tool.description}</Typography>
            </CardActionArea>
          </Card>
        ))}
      </Box>
    </Box>
  );
}
