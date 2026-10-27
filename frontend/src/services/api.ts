export class ApiError extends Error {
  status: number;
  fields: Record<string, string>;
  constructor(status: number, message: string, fields: Record<string, string> = {}) {
    super(message); this.status = status; this.fields = fields;
  }
}

export async function api<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch('/api' + endpoint, { ...options, credentials: 'include', headers: { ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...options.headers } });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError(0, 'No podemos conectar con AvisoSur. Comprueba que el servidor esté iniciado.');
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(response.status, data.message || 'No se pudo completar la solicitud.', data.fields);
  return data as T;
}

export const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Ocurrió un problema. Inténtalo de nuevo.';
export const price = (value: number) => 'S/ ' + new Intl.NumberFormat('es-PE', { maximumFractionDigits: 2 }).format(value);
export const date = (value: string) => new Intl.DateTimeFormat('es-PE', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Lima' }).format(new Date(value));
