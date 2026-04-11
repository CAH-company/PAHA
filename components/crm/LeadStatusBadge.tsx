'use client';

import { Badge } from '@/components/ui/badge';
import { LEAD_STATUS_LABELS, LEAD_STATUS_COLORS } from '@/lib/utils';
import type { LeadStatus } from '@/types';

export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  return (
    <Badge color={LEAD_STATUS_COLORS[status]}>
      {LEAD_STATUS_LABELS[status]}
    </Badge>
  );
}
