import { useQuery } from '@tanstack/react-query';
import client from '../api/client';
import ENDPOINTS from '../api/endpoints';
import { useAuth } from '../context/AuthContext';

export function useObservanceStats(params = {}) {
    const { user } = useAuth();
    return useQuery({
        queryKey: ['stats', 'observance', user?.id, params],
        queryFn: async () => {
            const { data } = await client.get(ENDPOINTS.statistiques.observance, { params });
            return data.data || data;
        },
        enabled: !!user?.id,
    });
}

export function useTendances() {
    const { user } = useAuth();
    return useQuery({
        queryKey: ['stats', 'tendances', user?.id],
        queryFn: async () => {
            const { data } = await client.get(ENDPOINTS.statistiques.tendances);
            return data.data || data;
        },
        enabled: !!user?.id,
    });
}

export function useRisques() {
    const { user } = useAuth();
    return useQuery({
        queryKey: ['stats', 'risques', user?.id],
        queryFn: async () => {
            const { data } = await client.get(ENDPOINTS.statistiques.risque);
            return data.data || data;
        },
        enabled: !!user?.id,
    });
}
