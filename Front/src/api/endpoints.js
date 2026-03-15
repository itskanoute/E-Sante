import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const client = axios.create({
    baseURL: API_BASE_URL,
    timeout: 15000,
    headers: { 'Content-Type': 'application/json' },
});

client.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('esante_access_token');
        if (token) config.headers.Authorization = `Bearer ${token}`;
        return config;
    },
    (error) => Promise.reject(error)
);

client.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;
            try {
                const refreshToken = localStorage.getItem('esante_refresh_token');
                if (!refreshToken) throw new Error('No refresh token');
                const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken });
                const result = data.data || data;
                const newToken = result.token || result.accessToken;
                if (newToken) localStorage.setItem('esante_access_token', newToken);
                if (result.refreshToken) localStorage.setItem('esante_refresh_token', result.refreshToken);
                originalRequest.headers.Authorization = `Bearer ${newToken}`;
                return client(originalRequest);
            } catch {
                localStorage.removeItem('esante_access_token');
                localStorage.removeItem('esante_refresh_token');
                window.location.href = '/login';
                return Promise.reject(error);
            }
        }
        return Promise.reject(error);
    }
);

/** API endpoint constants — mirrors backend routes */
const ENDPOINTS = {
    auth: {
        login: '/auth/login',
        register: '/auth/register',
        refresh: '/auth/refresh',
        forgotPassword: '/auth/forgot-password',
        resetPassword: '/auth/reset-password',
    },
    patients: {
        profile: '/patients/profile',
        parametresVie: '/patients/parametres-vie',
    },
    traitements: {
        base: '/traitements',
        byId: (id) => `/traitements/${id}`,
        statut: (id) => `/traitements/${id}/statut`,
    },
    prises: {
        aujourdhui: '/prises/aujourd-hui',
        confirmer: (id) => `/prises/${id}/confirmer`,
        history: '/prises/historique',
    },
    ordonnances: {
        base: '/ordonnances',
        scan: '/ordonnances/scan',
        valider: (id) => `/ordonnances/${id}/valider`,
    },
    statistiques: {
        observance: '/statistiques/observance',
        tendances: '/statistiques/tendances',
        risque: '/statistiques/risque',
    },
};

export default ENDPOINTS;
export { client };
