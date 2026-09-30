import { supabase } from './supabase';

async function callEdgeFunction<T>(name: string, body: unknown): Promise<T> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;

  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${name}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
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
