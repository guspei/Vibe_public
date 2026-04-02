'use client';

import { use } from 'react';
import PdfGroupView from '@/components/pdf-editor/PdfGroupView';

export default function PdfGroupPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = use(params);
  return <PdfGroupView groupId={groupId} />;
}
