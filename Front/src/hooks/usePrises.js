import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ENDPOINTS, { client } from '../api/endpoints';
import { useAuth } from '../context/AuthContext';

export function usePrisesToday() {
    const { user } = useAuth();
    return useQuery({
        queryKey: ['prises', 'today', user?.id],
        queryFn: async () => {
            const { data } = await client.get(ENDPOINTS.prises.aujourdhui);
            return data.data || data.prises || data;
        },
        enabled: !!user?.id,
        refetchInterval: 60000,
    });
}

export function usePrisesHistory(params = {}) {
    const { user } = useAuth();
    return useQuery({
        queryKey: ['prises', 'history', user?.id, params],
        queryFn: async () => {
            const { data } = await client.get(ENDPOINTS.prises.history, { params });
            return data.data || data.historique || data;
        },
        enabled: !!user?.id,
    });
}

export function useConfirmerPrise() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, statut = 'pris', date_heure_reelle = null }) => {
            const { data } = await client.post(ENDPOINTS.prises.confirmer(id), {
                statut,
                ...(date_heure_reelle ? { date_heure_reelle } : {}),
            });
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['prises'] });
            queryClient.invalidateQueries({ queryKey: ['stats'] });
        },
    });
}

export function useSkipPrise() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id) => {
            const { data } = await client.post(ENDPOINTS.prises.confirmer(id), {
                statut: 'reporte',
            });
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['prises'] });
            queryClient.invalidateQueries({ queryKey: ['stats'] });
        },
    });
}
