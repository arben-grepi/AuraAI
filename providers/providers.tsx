"use client";

import { ThemeProvider } from "@/components/theme/theme-provider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

interface ProvidersProps {
  children: React.ReactNode;
}

const queryClient = new QueryClient();

export function Providers({ children }: ProvidersProps) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      suppressHydrationWarning
    >
      <QueryClientProvider client={queryClient}>
        {children}
        {/* <ReactQueryDevtools position="left" initialIsOpen={false} /> */}
      </QueryClientProvider>
    </ThemeProvider>
  );
}
