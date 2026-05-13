"use client";

import { CacheProvider } from "@chakra-ui/next-js";
import { ChakraProvider, extendTheme } from "@chakra-ui/react";

const theme = extendTheme({
  fonts: {
    heading: "var(--font-geist-sans), system-ui, sans-serif",
    body: "var(--font-geist-sans), system-ui, sans-serif",
  },
  colors: {
    brand: {
      50: "#fdf6ec",
      100: "#f8e3c3",
      200: "#f2cc8f",
      300: "#e9ab5a",
      400: "#d97c18",
      500: "#b85c00",
      600: "#924500",
      700: "#6b3200",
      800: "#452000",
      900: "#200e00",
    },
  },
  config: {
    initialColorMode: "light",
    useSystemColorMode: false,
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <CacheProvider>
      <ChakraProvider theme={theme}>{children}</ChakraProvider>
    </CacheProvider>
  );
}
