import { supabase } from './supabase';
import { supabaseUrl, supabaseAnonKey } from './env';

async function callEdgeFunction<T>(name: string, body: unknown): Promise<T> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;

  const url = `${supabaseUrl}/functions/v1/${name}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: supabaseAnonKey,
    },
    body: JSON.stringify(body),
  });

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

  const data = await res.json();
  return data as T;
}

export { callEdgeFunction };
