'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import GifIcon from '@mui/icons-material/Gif';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';

const EXPANDED_WIDTH = 260;
const COLLAPSED_WIDTH = 72;

interface SidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export default function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!isMobile) {
      const stored = localStorage.getItem('sidebar-collapsed');
      if (stored !== null) setCollapsed(stored === 'true');
    }
  }, [isMobile]);

  useEffect(() => {
    if (isMobile) onMobileClose();
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('sidebar-collapsed', String(next));
  };

  const width = isMobile ? EXPANDED_WIDTH : collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH;
  const showExpanded = isMobile || !collapsed;

  const menuItems = [
    { label: 'PDF Editor', href: '/pdf-editor', icon: <PictureAsPdfIcon /> },
    { label: 'GIF Maker', href: '/gif-maker', icon: <GifIcon /> },
  ];

  const drawerContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          px: showExpanded ? 2 : 0,
          py: 1.5,
          minHeight: 64,
          justifyContent: showExpanded ? 'flex-start' : 'center',
          gap: 1.5,
          flexShrink: 0,
        }}
      >
        <Box
          component={Link}
          href="/"
          sx={{ display: 'flex', alignItems: 'center', gap: 1.5, textDecoration: 'none', flexGrow: 1, minWidth: 0 }}
        >
          {showExpanded && (
            <Typography variant="h6" sx={{ color: 'text.primary', fontWeight: 700, whiteSpace: 'nowrap' }}>
              Tools
            </Typography>
          )}
        </Box>
        {showExpanded && !isMobile && (
          <IconButton onClick={toggleCollapsed} size="small" sx={{ color: 'text.secondary' }}>
            <ChevronLeftIcon />
          </IconButton>
        )}
        {!showExpanded && !isMobile && (
          <IconButton onClick={toggleCollapsed} size="small" sx={{ color: 'text.secondary', position: 'absolute', right: 4, top: 20 }}>
            <ChevronRightIcon fontSize="small" />
          </IconButton>
        )}
      </Box>

      <Divider sx={{ borderColor: 'divider', flexShrink: 0 }} />

      <List sx={{ flex: 1, px: 1, pt: 1 }}>
        {menuItems.map((item) => (
          <ListItemButton
            key={item.href}
            component={Link}
            href={item.href}
            selected={pathname === item.href || pathname.startsWith(item.href + '/')}
            sx={{ justifyContent: showExpanded ? 'flex-start' : 'center' }}
          >
            <ListItemIcon sx={{ minWidth: showExpanded ? 36 : 'auto' }}>
              {item.icon}
            </ListItemIcon>
            {showExpanded && <ListItemText primary={item.label} />}
          </ListItemButton>
        ))}
      </List>
    </Box>
  );

  if (isMobile) {
    return (
      <Drawer variant="temporary" open={mobileOpen} onClose={onMobileClose} ModalProps={{ keepMounted: true }}
        sx={{ '& .MuiDrawer-paper': { width: EXPANDED_WIDTH, boxSizing: 'border-box' } }}>
        {drawerContent}
      </Drawer>
    );
  }

  return (
    <Drawer variant="permanent"
      sx={{
        width, flexShrink: 0,
        '& .MuiDrawer-paper': { width, boxSizing: 'border-box', transition: 'width 0.2s ease', overflowX: 'hidden' },
      }}>
      {drawerContent}
    </Drawer>
  );
}

export { EXPANDED_WIDTH, COLLAPSED_WIDTH };
