'use client';

import { use } from 'react';
import GifEditorView from '@/components/gif-editor/GifEditorView';

export default function GifMakerProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params);
  return <GifEditorView projectId={projectId} />;
}
