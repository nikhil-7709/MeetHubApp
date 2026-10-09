import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { darkPalette, lightPalette, type AppPalette } from '../theme/palette';

type ThemeContextValue = {
  dark: boolean;
  colors: AppPalette;
  toggle: () => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  dark: false,
  colors: lightPalette,
  toggle: () => undefined,
});

export function ThemeProvider({ children }: React.PropsWithChildren) {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('meethub:dark-mode')
      .then((saved) => setDark(saved === 'true'))
      .catch((error: unknown) => console.warn('Unable to load theme preference', error));
  }, []);

  const value = useMemo(
    () => ({
      dark,
      colors: dark ? darkPalette : lightPalette,
      toggle: () => {
        setDark((current) => {
          const next = !current;
          AsyncStorage.setItem('meethub:dark-mode', String(next)).catch((error: unknown) =>
            console.warn('Unable to save theme preference', error),
          );
          return next;
        });
      },
    }),
    [dark],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  return useContext(ThemeContext);
}
