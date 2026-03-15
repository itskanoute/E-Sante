import { useMutation, useQueryClient } from '@tanstack/react-query';
import ENDPOINTS, { client } from '../api/endpoints';

export function useUpdateProfile() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (payload) => {
            const { data } = await client.put(ENDPOINTS.patients.profile, payload);
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['profile'] });
        },
    });
}

export function useUpdateParametresVie() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (payload) => {
            const { data } = await client.put(ENDPOINTS.patients.parametresVie, payload);
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['profile'] });
        },
    });
}
