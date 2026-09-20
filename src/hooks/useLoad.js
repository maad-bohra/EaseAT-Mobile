import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { messageOf } from '../utils/errors';

/**
 * Loads data whenever the screen comes into focus (so tabs always show fresh
 * numbers after edits elsewhere) and exposes a reload for pull-to-refresh and
 * for after a change. Late responses from an older request are ignored.
 */
export function useLoad(loader, deps = []) {
  const [state, setState] = useState({ data: null, error: '', loading: true });
  const [refreshing, setRefreshing] = useState(false);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const latest = useRef(0);

  const reload = useCallback(async () => {
    const id = ++latest.current;
    try {
      const data = await loaderRef.current();
      if (id === latest.current) setState({ data, error: '', loading: false });
    } catch (error) {
      if (id === latest.current) setState((prev) => ({ ...prev, error: messageOf(error), loading: false }));
    }
  }, []);

  const key = JSON.stringify(deps);
  useFocusEffect(
    useCallback(() => {
      reload();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [reload, key]),
  );

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }, [reload]);

  return { ...state, reload, refresh, refreshing };
}
