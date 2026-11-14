import { useCallback, useEffect, useRef, useState } from 'react';
import { liveQuery } from 'dexie';
import { db } from './db';
import { loadPackage, installPackage, deletePackage } from './packageManager';
import { useNetworkStatus } from './network';

export function useOfflineData() {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);
  const [personal, setPersonal] = useState({ favorites: new Set(), history: [] });
  const { offline } = useNetworkStatus();
  const busy = useRef(false);
  const autoAttempted = useRef(false);
  const reload = useCallback(async () => {
    const loaded = await loadPackage();
    setData(loaded);
    setStatus(loaded ? 'ready' : 'missing');
    return loaded;
  }, []);
  const sync = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setStatus('installing'); setError(''); setProgress(0);
    try {
      await installPackage(setProgress);
      await reload();
    } catch (e) { setError(e.message); setStatus('error'); }
    finally { busy.current = false; }
  }, [reload]);

  useEffect(() => {
    let alive = true;
    loadPackage().then(loaded => {
      if (!alive) return;
      setData(loaded); setStatus(loaded ? 'ready' : 'missing');
    }).catch(e => { if (alive) { setError(`Không truy cập được bộ nhớ thiết bị: ${e.message}`); setStatus('error'); } });
    const subscription = liveQuery(async () => ({
      favorites: new Set((await db.favorites.toArray()).map(f => f.placeId)),
      history: await db.history.orderBy('visitedAt').reverse().toArray(),
    })).subscribe({ next: value => { if (alive) setPersonal(value); }, error: e => { if (alive) setError(e.message); } });
    return () => { alive = false; subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (status === 'missing' && !offline && !autoAttempted.current) {
      autoAttempted.current = true;
      // Installation updates an external store and intentionally starts once on first connected visit.
      void sync();
    }
  }, [status, offline, sync]);

  const remove = useCallback(async () => {
    if (busy.current) return;
    // A deliberate removal must not trigger the first-visit auto installer again.
    autoAttempted.current = true;
    busy.current = true;
    try { await deletePackage(); setData(null); setStatus('missing'); }
    catch (e) { setError(e.message); }
    finally { busy.current = false; }
  }, []);
  return { data, status, error, progress, personal, sync, remove };
}
