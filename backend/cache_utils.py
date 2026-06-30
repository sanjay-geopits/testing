import time
import threading
from typing import Any, Optional, Dict, Tuple

class InMemoryCache:
    def __init__(self):
        # Format: {key: (value, expires_at)}
        self._cache: Dict[str, Tuple[Any, float]] = {}
        self._lock = threading.Lock()

    def get(self, key: str) -> Optional[Any]:
        with self._lock:
            if key in self._cache:
                value, expires_at = self._cache[key]
                if expires_at > time.time():
                    return value
                else:
                    del self._cache[key]
        return None

    def set(self, key: str, value: Any, ttl_seconds: int = 10):
        expires_at = time.time() + ttl_seconds
        with self._lock:
            self._cache[key] = (value, expires_at)

    def invalidate(self, prefix: str):
        with self._lock:
            keys_to_delete = [k for k in self._cache.keys() if k.startswith(prefix)]
            for k in keys_to_delete:
                del self._cache[k]

    def invalidate_all(self):
        with self._lock:
            self._cache.clear()

# Global cache instance
cache_manager = InMemoryCache()
