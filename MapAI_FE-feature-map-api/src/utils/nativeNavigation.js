const authPaths = new Set(['/verify-email', '/reset-password']);

export function nativeAuthPath(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'mapai:' || url.hostname !== 'auth' || !authPaths.has(url.pathname)) return null;
    return `${url.pathname}${url.search}`;
  } catch {
    return null;
  }
}
