import { createTheme } from '@mui/material/styles';

const forgeTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#F59E0B',
      dark: '#D97706',
      light: '#FEF3C7',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#78716C',
      dark: '#57534E',
      light: '#D6D3D1',
      contrastText: '#FFFFFF',
    },
    background: {
      default: '#FAFAFA',
      paper: '#FFFFFF',
    },
    text: {
      primary: '#1C1917',
      secondary: '#78716C',
      disabled: '#A8A29E',
    },
    divider: '#E7E5E4',
    error: { main: '#EF4444' },
    warning: { main: '#F59E0B' },
    success: { main: '#22C55E' },
    info: { main: '#3B82F6' },
    action: {
      hover: 'rgba(120, 113, 108, 0.04)',
      selected: 'rgba(245, 158, 11, 0.08)',
      disabledBackground: '#F5F5F4',
      focus: 'rgba(245, 158, 11, 0.12)',
    },
  },
  typography: {
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif',
    h1: { fontWeight: 600, fontSize: '2rem', letterSpacing: '-0.02em', lineHeight: 1.2 },
    h2: { fontWeight: 600, fontSize: '1.5rem', letterSpacing: '-0.02em', lineHeight: 1.3 },
    h3: { fontWeight: 600, fontSize: '1.25rem', letterSpacing: '-0.01em', lineHeight: 1.4 },
    h4: { fontWeight: 600, fontSize: '1.1rem', letterSpacing: '-0.01em', lineHeight: 1.4 },
    h5: { fontWeight: 600, fontSize: '1rem', lineHeight: 1.4 },
    h6: { fontWeight: 600, fontSize: '0.875rem', lineHeight: 1.4 },
    body1: { fontSize: '0.9375rem', lineHeight: 1.6 },
    body2: { fontSize: '0.8125rem', lineHeight: 1.5 },
    button: { fontWeight: 500, fontSize: '0.8125rem', textTransform: 'none' as const },
    caption: { fontSize: '0.75rem', color: '#78716C' },
  },
  shape: { borderRadius: 8 },
  shadows: [
    'none',
    '0 1px 2px rgba(28, 25, 23, 0.04)',
    '0 2px 4px rgba(28, 25, 23, 0.04)',
    '0 2px 8px rgba(28, 25, 23, 0.06)',
    '0 4px 12px rgba(28, 25, 23, 0.06)',
    '0 8px 24px rgba(28, 25, 23, 0.08)',
    '0 12px 32px rgba(28, 25, 23, 0.08)',
    ...Array(18).fill('0 12px 32px rgba(28, 25, 23, 0.08)'),
  ] as any, // eslint-disable-line @typescript-eslint/no-explicit-any
  components: {
    MuiCssBaseline: {
      styleOverrides: { body: { backgroundColor: '#FAFAFA' } },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: 8, padding: '6px 16px', fontSize: '0.8125rem', fontWeight: 500, minHeight: 36 },
        outlined: { borderColor: '#E7E5E4', color: '#1C1917', '&:hover': { borderColor: '#D6D3D1', backgroundColor: '#F5F5F4' } },
      },
    },
    MuiCard: {
      defaultProps: { variant: 'outlined' as const },
      styleOverrides: {
        root: { borderRadius: 12, borderColor: '#E7E5E4', boxShadow: '0 1px 2px rgba(28, 25, 23, 0.04)', '&:hover': { boxShadow: '0 2px 8px rgba(28, 25, 23, 0.06)' } },
      },
    },
    MuiCardContent: {
      styleOverrides: { root: { padding: '20px 24px', '&:last-child': { paddingBottom: '20px' } } },
    },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: { root: { backgroundImage: 'none' }, outlined: { borderColor: '#E7E5E4' } },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: { borderRadius: 8, fontSize: '0.8125rem', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#E7E5E4' }, '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#F59E0B', borderWidth: 1.5 } },
        input: { padding: '10px 14px' },
      },
    },
    MuiDialog: {
      styleOverrides: { paper: { borderRadius: 12, boxShadow: '0 8px 24px rgba(28, 25, 23, 0.12)' } },
    },
    MuiMenu: {
      styleOverrides: { paper: { borderRadius: 8, border: '1px solid #E7E5E4', boxShadow: '0 4px 12px rgba(28, 25, 23, 0.08)', marginTop: 4 } },
    },
    MuiMenuItem: {
      styleOverrides: { root: { fontSize: '0.8125rem', padding: '8px 16px', borderRadius: 4, margin: '2px 4px' } },
    },
    MuiIconButton: {
      styleOverrides: { root: { borderRadius: 8, color: '#78716C', '&:hover': { backgroundColor: 'rgba(120, 113, 108, 0.06)', color: '#1C1917' } } },
    },
    MuiListItemIcon: {
      styleOverrides: { root: { minWidth: 36, color: '#78716C' } },
    },
    MuiListItemText: {
      styleOverrides: { primary: { fontSize: '0.8125rem', fontWeight: 500 } },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 8, margin: '2px 8px', padding: '6px 12px',
          '&.Mui-selected': { backgroundColor: '#FEF3C7', color: '#D97706', '&:hover': { backgroundColor: '#FDE68A' }, '& .MuiListItemIcon-root': { color: '#D97706' } },
        },
      },
    },
    MuiChip: {
      styleOverrides: { root: { borderRadius: 6, height: 28, fontSize: '0.75rem', fontWeight: 500 } },
    },
    MuiTooltip: {
      styleOverrides: { tooltip: { backgroundColor: '#1C1917', fontSize: '0.75rem', borderRadius: 6, padding: '6px 12px' } },
    },
    MuiDrawer: {
      styleOverrides: { paper: { backgroundColor: '#F5F5F4', borderRight: '1px solid #E7E5E4' } },
    },
  },
});

export default forgeTheme;
