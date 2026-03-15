import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ENDPOINTS, { client } from '../api/endpoints';
import { useAuth } from '../context/AuthContext';

export function useTraitements() {
    const { user } = useAuth();
    return useQuery({
        queryKey: ['traitements', user?.id],
        queryFn: async () => {
            const { data } = await client.get(ENDPOINTS.traitements.base);
            const result = data.data || data;
            return Array.isArray(result) ? result : result.traitements || [];
        },
        enabled: !!user?.id,
    });
}

export function useTraitement(id) {
    const { user } = useAuth();
    return useQuery({
        queryKey: ['traitements', user?.id, id],
        queryFn: async () => {
            const { data } = await client.get(ENDPOINTS.traitements.byId(id));
            const result = data.data || data;
            return result.traitement || result;
        },
        enabled: !!user?.id && !!id,
    });
}

export function useCreateTraitement() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (payload) => {
            const { data } = await client.post(ENDPOINTS.traitements.base, payload);
            return data;
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['traitements'] }),
    });
}

export function useUpdateTraitement() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, ...payload }) => {
            const { data } = await client.put(ENDPOINTS.traitements.byId(id), payload);
            return data;
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['traitements'] }),
    });
}

export function useDeleteTraitement() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id) => {
            await client.delete(ENDPOINTS.traitements.byId(id));
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['traitements'] }),
    });
}
