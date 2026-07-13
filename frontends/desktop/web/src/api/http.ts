type HttpJsonInit = Omit<RequestInit, 'body'> & {
  body?: BodyInit | Record<string, unknown> | unknown[] | null;
};

export async function httpJson<T = unknown>(
  url: string,
  init: HttpJsonInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  let body: BodyInit | null | undefined = init.body as BodyInit | null | undefined;
  if (
    body != null &&
    typeof body !== 'string' &&
    !(typeof Blob !== 'undefined' && body instanceof Blob) &&
    !(typeof FormData !== 'undefined' && body instanceof FormData) &&
    !(typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams) &&
    !(typeof ArrayBuffer !== 'undefined' && body instanceof ArrayBuffer)
  ) {
    headers.set('Content-Type', headers.get('Content-Type') || 'application/json');
    body = JSON.stringify(body);
  }
  const res = await fetch(url, {
    ...init,
    headers,
    body,
    method: init.method || 'GET',
  });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const errObj = data as { error?: string; message?: string } | null;
    throw new Error(
      (errObj && (errObj.error || errObj.message)) || `${res.status} ${res.statusText}`,
    );
  }
  return data as T;
}
