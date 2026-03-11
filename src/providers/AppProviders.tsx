// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
import { PropsWithChildren } from 'react';

import { ThemeProvider } from './ThemeProvider';

export const AppProviders = ({ children }: PropsWithChildren) => {
  return (
    <ThemeProvider>
      {children}
    </ThemeProvider>
  );
};
