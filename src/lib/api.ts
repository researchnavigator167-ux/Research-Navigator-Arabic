import { supabase } from './supabase';
import { supabaseUrl, supabaseAnonKey } from './env';

async function callEdgeFunction<T>(name: string, body: unknown): Promise<T> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (sessionError || !token) throw new Error('AUTH_REQUIRED');

  const url = `${supabaseUrl}/functions/v1/${name}`;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 30000);
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        apikey: supabaseAnonKey,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw new Error('REQUEST_TIMEOUT');
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }

  if (!res.ok) {
    let errorMsg = `Request failed (${res.status})`;
    try {
      const errBody = await res.json();
      errorMsg = errBody.error || errorMsg;
    } catch {
      // ignore parse error
    }
    throw new Error(errorMsg);
  }

  const data: unknown = await res.json();
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('INVALID_RESPONSE');
  }
  return data as T;
}

export { callEdgeFunction };
