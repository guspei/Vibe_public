'use client';

import { useState } from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import MenuIcon from '@mui/icons-material/Menu';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import Sidebar from './Sidebar';

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh',
          width: 0,
        }}
      >
        {isMobile && (
          <Box sx={{ p: 1 }}>
            <IconButton onClick={() => setMobileOpen(true)}>
              <MenuIcon />
            </IconButton>
          </Box>
        )}
        <Box
          sx={{
            flexGrow: 1,
            height: '100vh',
            overflowY: 'auto',
            overflowX: 'hidden',
            px: { xs: 2, sm: '28px' },
            pt: '12px',
            pb: '19px',
          }}
        >
          {children}
        </Box>
      </Box>
    </Box>
  );
}
