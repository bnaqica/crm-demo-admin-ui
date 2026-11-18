import { useQuery } from '@tanstack/react-query';
import { useApi } from '../api/apiContext';
import { GRANT_POLL_MS, umsGrants } from '../api/ums';

export const pendingGrantsKey = ['grant-requests', 'PENDING'] as const;

/** Pending grant requests, polled every minute; shared by the nav badge and the Approvals page. */
export function usePendingGrants() {
  const api = useApi();
  return useQuery({
    queryKey: pendingGrantsKey,
    queryFn: () => umsGrants.list(api, 'PENDING'),
    refetchInterval: GRANT_POLL_MS,
  });
}
