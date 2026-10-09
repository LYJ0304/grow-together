const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8080';

export type HealthResponse = { status: string; service: string };

export async function getHealth(): Promise<HealthResponse> {
  const response = await fetch(`${apiUrl}/api/health`);
  if (!response.ok) throw new Error(`Health check failed: ${response.status}`);
  return response.json() as Promise<HealthResponse>;
}
