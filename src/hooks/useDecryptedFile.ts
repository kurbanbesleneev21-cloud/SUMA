import { useCallback, useEffect, useRef, useState } from 'react';
import { cachedUri, fetchDecrypted } from '@/services/attachments';
import type { AttachmentRef } from '@/services/payload';
import { humanError } from '@/utils/errors';

// Local plaintext URI of an attachment, downloading + decrypting on demand (or automatically).
export function useDecryptedFile(ref: AttachmentRef | null, part: 'main' | 'thumb', auto: boolean) {
  const [uri, setUri] = useState<string | null>(() => (ref ? cachedUri(ref, part) : null));
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const start = useCallback(async () => {
    if (!ref) return null;
    setError(null);
    setProgress(0);
    try {
      const local = await fetchDecrypted(ref, part, (f) => alive.current && setProgress(f));
      if (alive.current) {
        setUri(local);
        setProgress(null);
      }
      return local;
    } catch (e) {
      if (alive.current) {
        setError(humanError(e));
        setProgress(null);
      }
      return null;
    }
  }, [ref, part]);

  useEffect(() => {
    if (ref && !uri && auto && progress === null && !error) start();
  }, [ref, uri, auto, progress, error, start]);

  return { uri, progress, error, start };
}
