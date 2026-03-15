import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ENDPOINTS, { client } from '../api/endpoints';
import { useAuth } from '../context/AuthContext';

export function useOrdonnances() {
    const { user } = useAuth();
    return useQuery({
        queryKey: ['ordonnances', user?.id],
        queryFn: async () => {
            const { data } = await client.get(ENDPOINTS.ordonnances.base);
            return data.data || data.ordonnances || data;
        },
        enabled: !!user?.id,
    });
}

export function useScanOrdonnance() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (file) => {
            const formData = new FormData();
            formData.append('image', file);
            const { data } = await client.post(ENDPOINTS.ordonnances.scan, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['ordonnances'] });
            queryClient.invalidateQueries({ queryKey: ['traitements'] });
        },
    });
}

export function useValiderOrdonnance() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, corrections = [] }) => {
            const body = Array.isArray(corrections) ? { corrections } : { corrections: [] };
            const { data } = await client.post(ENDPOINTS.ordonnances.valider(id), body);
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['ordonnances'] });
            queryClient.invalidateQueries({ queryKey: ['traitements'] });
        },
    });
}
