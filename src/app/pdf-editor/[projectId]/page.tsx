'use client';

import { use } from 'react';
import PdfEditorView from '@/components/pdf-editor/PdfEditorView';

export default function PdfEditorProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params);
  return <PdfEditorView projectId={projectId} />;
}
