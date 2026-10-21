import { http } from './http';

export type HealthResponse = { status: string; service: string };
export const getHealth = () => http<HealthResponse>('/api/health');
