import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { EmailCampaign } from '@/types';

async function fetchCampaigns(): Promise<EmailCampaign[]> {
  const res = await fetch('/api/email-campaigns');
  if (!res.ok) throw new Error('Failed to fetch campaigns');
  return res.json();
}

export function useEmailCampaigns() {
  const { data: campaigns = [], isLoading: loading } = useQuery({
    queryKey: ['email-campaigns'],
    queryFn: fetchCampaigns,
  });

  const queryClient = useQueryClient();
  const refetch = () => queryClient.invalidateQueries({ queryKey: ['email-campaigns'] });

  return { campaigns, loading, refetch };
}
