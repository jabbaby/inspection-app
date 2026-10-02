import { useEffect, useState } from "react";
import { db } from "../../db/db";

/**
 * An object URL for a stored file (e.g. a photo's working copy), released
 * when the component unmounts or the id changes.
 */
export function useBlobUrl(blobId: string | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!blobId) return;
    let current = true;
    let made: string | null = null;
    void db.blobs.get(blobId).then((stored) => {
      if (!current || !stored) return;
      made = URL.createObjectURL(
        new Blob([stored.data], { type: stored.type }),
      );
      setUrl(made);
    });
    return () => {
      current = false;
      if (made) URL.revokeObjectURL(made);
      setUrl(null);
    };
  }, [blobId]);
  return url;
}
