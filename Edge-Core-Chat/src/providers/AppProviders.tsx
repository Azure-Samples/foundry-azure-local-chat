import { PropsWithChildren } from 'react';

import { ThemeProvider } from './ThemeProvider';

export const AppProviders = ({ children }: PropsWithChildren) => {
  return (
    <ThemeProvider>
      {children}
    </ThemeProvider>
  );
};
