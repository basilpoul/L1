import { useState, useCallback } from 'react';
import { VirtualFileSystem } from '../vfs/fileSystem';

export function useVFS() {
  const [vfs] = useState(() => new VirtualFileSystem());
  const [version, setVersion] = useState(0);

  const refresh = useCallback(() => {
    setVersion(v => v + 1);
  }, []);

  const resetFileSystem = useCallback(() => {
    vfs.reset();
    setVersion(v => v + 1);
  }, [vfs]);

  return {
    vfs,
    version,
    resetFileSystem,
    refresh,
  };
}
