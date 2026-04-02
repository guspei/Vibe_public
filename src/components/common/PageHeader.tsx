'use client';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

interface PageHeaderProps {
  title: string;
  action?: React.ReactNode;
}

export default function PageHeader({ title, action }: PageHeaderProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: { xs: 'column', sm: 'row' },
        justifyContent: 'space-between',
        alignItems: { xs: 'flex-start', sm: 'center' },
        gap: 1,
        mb: 3,
      }}
    >
      <Typography variant="h4" sx={{ fontSize: { xs: '1.5rem', sm: '2.125rem' } }}>
        {title}
      </Typography>
      {action && <Box>{action}</Box>}
    </Box>
  );
}
