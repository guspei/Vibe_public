'use client';

import { useRef, useEffect } from 'react';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Slider from '@mui/material/Slider';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import IconButton from '@mui/material/IconButton';
import ToggleButton from '@mui/material/ToggleButton';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import Button from '@mui/material/Button';
import DeleteIcon from '@mui/icons-material/Delete';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import ZoomOutMapIcon from '@mui/icons-material/ZoomOutMap';
import FormatBoldIcon from '@mui/icons-material/FormatBold';
import FormatItalicIcon from '@mui/icons-material/FormatItalic';
import AddIcon from '@mui/icons-material/Add';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import AspectRatioIcon from '@mui/icons-material/AspectRatio';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { IGifFrameSettings, IGifTextBlock } from '@/lib/types';

const FONT_OPTIONS = [
  'Montserrat', 'Arial', 'Impact', 'Georgia', 'Courier New',
  'Comic Sans MS', 'Trebuchet MS', 'Verdana', 'Times New Roman',
];

const SCALE_WIDTHS = { focused: 360, neighbor: 220, normal: 180 } as const;

interface GifFrameCardProps {
  id: string;
  index: number;
  imageUrl: string;
  texts: IGifTextBlock[];
  frameSettings?: IGifFrameSettings;
  globalDuration: number;
  defaultTextBlock: IGifTextBlock;
  scale?: 'focused' | 'neighbor' | 'normal';
  onTextsChange: (texts: IGifTextBlock[]) => void;
  onSettingsChange: (settings: IGifFrameSettings) => void;
  onDelete: () => void;
  isAspectRatioRef?: boolean;
  onToggleAspectRatioRef?: () => void;
  onDuplicate?: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
  onMaximize?: () => void;
}

export default function GifFrameCard({
  id, index, imageUrl, texts: rawTexts, frameSettings,
  globalDuration, defaultTextBlock,
  scale = 'normal',
  isAspectRatioRef, onToggleAspectRatioRef,
  onTextsChange, onSettingsChange, onDelete, onDuplicate, onFocus, onBlur, onMaximize,
}: GifFrameCardProps) {
  const texts = rawTexts ?? [];
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const cardRef = useRef<HTMLDivElement>(null);
  const isFocused = scale === 'focused';
  const width = SCALE_WIDTHS[scale];

  useEffect(() => {
    if (isFocused && cardRef.current) {
      const el = cardRef.current;
      const timer = setTimeout(() => { el.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' }); }, 50);
      return () => clearTimeout(timer);
    }
  }, [isFocused]);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition ? `${transition}, width 0.25s ease` : 'width 0.25s ease',
    opacity: isDragging ? 0.5 : 1,
  };

  const duration = frameSettings?.duration ?? globalDuration;

  const updateTextBlock = (textIndex: number, updates: Partial<IGifTextBlock>) => {
    const updated = texts.map((t, i) => i === textIndex ? { ...t, ...updates } : t);
    onTextsChange(updated);
  };

  const addTextBlock = () => { onTextsChange([...texts, { ...defaultTextBlock, text: '' }]); };
  const removeTextBlock = (textIndex: number) => { onTextsChange(texts.filter((_, i) => i !== textIndex)); };

  return (
    <Box
      ref={(node: HTMLDivElement | null) => { setNodeRef(node); (cardRef as React.MutableRefObject<HTMLDivElement | null>).current = node; }}
      style={style}
      onBlur={() => {
        requestAnimationFrame(() => {
          setTimeout(() => {
            if (!cardRef.current) return;
            if (cardRef.current.contains(document.activeElement)) return;
            const active = document.activeElement as HTMLElement | null;
            if (active?.closest('[role="listbox"], [role="menu"], [role="presentation"], .MuiPopover-root, .MuiModal-root')) return;
            onBlur?.();
          }, 50);
        });
      }}
      tabIndex={-1}
      sx={{ border: 1, borderColor: isFocused ? 'primary.main' : 'divider', borderRadius: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', width, flexShrink: 0, outline: 'none' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', px: 0.5, py: 0.25, bgcolor: 'action.hover' }}>
        <Box {...attributes} {...listeners} sx={{ cursor: 'grab', display: 'flex', alignItems: 'center', color: 'text.secondary' }}><DragIndicatorIcon sx={{ fontSize: 16 }} /></Box>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, flex: 1 }}>{index + 1}</Typography>
        <IconButton size="small" onClick={onDelete} sx={{ width: 24, height: 24, opacity: 0.4, '&:hover': { opacity: 1, color: 'error.main' } }}><DeleteIcon sx={{ fontSize: 14 }} /></IconButton>
      </Box>
      <Box onMouseDown={onFocus} sx={{ position: 'relative', cursor: 'pointer', '&:hover .maximize-btn': { opacity: 1 } }}>
        <Box component="img" src={imageUrl} alt={`Frame ${index + 1}`} sx={{ width: '100%', aspectRatio: '16/9', objectFit: 'contain', display: 'block', bgcolor: '#000' }} />
        {texts.filter((t) => t.text).map((t, ti) => (
          <Box key={ti} sx={{ position: 'absolute', left: 0, right: 0, top: `${t.verticalPosition ?? 50}%`, transform: 'translateY(-50%)', display: 'flex', justifyContent: 'center', pointerEvents: 'none', px: 0.5 }}>
            <Box sx={{ bgcolor: 'rgba(0,0,0,0.7)', color: t.textColor, fontFamily: t.fontFamily, fontWeight: t.bold ? 700 : 400, fontStyle: t.italic ? 'italic' : 'normal', fontSize: 11, px: 0.75, py: 0.25, borderRadius: 0.5, textAlign: 'center', maxWidth: '95%', wordBreak: 'break-word', lineHeight: 1.2 }}>
              {t.text}
            </Box>
          </Box>
        ))}
        {onMaximize && (
          <IconButton className="maximize-btn" size="small" onClick={onMaximize}
            sx={{ position: 'absolute', top: 4, right: 4, width: 22, height: 22, opacity: 0, transition: 'opacity 0.15s', bgcolor: 'rgba(0,0,0,0.45)', color: '#fff', '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' } }}>
            <ZoomOutMapIcon sx={{ fontSize: 12 }} />
          </IconButton>
        )}
      </Box>
      {isFocused && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <Box sx={{ px: 1.5, pt: 1.5 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>Duration: {duration}ms</Typography>
            <Slider value={duration} onChange={(_e, v) => onSettingsChange({ ...frameSettings, duration: v as number })} min={200} max={5000} step={100} size="small" valueLabelDisplay="auto" valueLabelFormat={(v) => `${v}ms`} sx={{ py: 0.5 }} />
          </Box>
          {texts.map((block, ti) => (
            <Box key={ti} sx={{ px: 1, pb: 0.5, borderTop: ti > 0 ? 1 : 0, borderColor: 'divider' }}>
              <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', mt: 0.5 }}>
                <TextField value={block.text} onChange={(e) => updateTextBlock(ti, { text: e.target.value })} placeholder={`Text ${ti + 1}...`} size="small" multiline minRows={1} maxRows={2}
                  sx={{ flex: 1, '& .MuiInputBase-input': { fontSize: 11, py: 0.5, px: 0.75 }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'divider' } }} />
                <IconButton size="small" onClick={() => removeTextBlock(ti)} sx={{ width: 22, height: 22, opacity: 0.4, '&:hover': { opacity: 1, color: 'error.main' } }}><DeleteIcon sx={{ fontSize: 12 }} /></IconButton>
              </Box>
              <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', mt: 0.5 }}>
                <Select value={block.fontFamily} onChange={(e) => updateTextBlock(ti, { fontFamily: e.target.value })} size="small" sx={{ flex: 1, height: 26, fontSize: 10 }}
                  renderValue={(val) => <span style={{ fontFamily: val, fontSize: 10 }}>{val}</span>}>
                  {FONT_OPTIONS.map((f) => (<MenuItem key={f} value={f} sx={{ fontSize: 11, fontFamily: f }}>{f}</MenuItem>))}
                </Select>
                <ToggleButton value="bold" selected={block.bold} onChange={() => updateTextBlock(ti, { bold: !block.bold })} size="small" sx={{ width: 26, height: 26, p: 0, minWidth: 0 }}><FormatBoldIcon sx={{ fontSize: 14 }} /></ToggleButton>
                <ToggleButton value="italic" selected={block.italic} onChange={() => updateTextBlock(ti, { italic: !block.italic })} size="small" sx={{ width: 26, height: 26, p: 0, minWidth: 0 }}><FormatItalicIcon sx={{ fontSize: 14 }} /></ToggleButton>
              </Box>
              <Box sx={{ mt: 0.5, px: 0.5 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: 9 }}>Position: {block.verticalPosition ?? 50}%</Typography>
                <Slider value={block.verticalPosition ?? 50} onChange={(_e, v) => updateTextBlock(ti, { verticalPosition: v as number })} min={5} max={95} step={1} size="small" sx={{ py: 0.5 }} />
              </Box>
              <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', mt: 0.5 }}>
                <TextField value={block.fontSize} onChange={(e) => updateTextBlock(ti, { fontSize: Number(e.target.value) || 32 })} size="small" type="number"
                  slotProps={{ htmlInput: { min: 8, max: 200, step: 2 } }} sx={{ width: 52, '& .MuiInputBase-input': { fontSize: 10, py: 0.25, px: 0.5 } }} />
                <Box component="input" type="color" value={block.textColor} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateTextBlock(ti, { textColor: e.target.value })}
                  sx={{ width: 26, height: 26, border: 'none', cursor: 'pointer', flexShrink: 0, borderRadius: 0.5 }} />
              </Box>
            </Box>
          ))}
          <Box sx={{ px: 1, pb: 1, display: 'flex', alignItems: 'center' }}>
            <Button size="small" startIcon={<AddIcon sx={{ fontSize: 14 }} />} onClick={addTextBlock} sx={{ fontSize: 11, textTransform: 'none', py: 0.25 }}>Add text</Button>
            <Box sx={{ flex: 1 }} />
            {onToggleAspectRatioRef && (
              <Tooltip title="Use as aspect ratio reference" arrow>
                <IconButton size="small" onClick={(e) => { e.stopPropagation(); onToggleAspectRatioRef(); }}
                  sx={{ width: 24, height: 24, color: isAspectRatioRef ? 'primary.main' : 'text.disabled', opacity: isAspectRatioRef ? 1 : 0.4, '&:hover': { opacity: 1, color: 'primary.main' } }}>
                  <AspectRatioIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </Tooltip>
            )}
            {onDuplicate && (
              <IconButton size="small" onClick={onDuplicate} sx={{ width: 24, height: 24, opacity: 0.4, '&:hover': { opacity: 1 } }}><ContentCopyIcon sx={{ fontSize: 14 }} /></IconButton>
            )}
          </Box>
        </Box>
      )}
    </Box>
  );
}
