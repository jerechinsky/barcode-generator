"use client";

import { MantineProvider, Tooltip, createTheme } from "@mantine/core";
import type { ReactNode } from "react";

const theme = createTheme({
  primaryColor: "studio",
  primaryShade: 7,
  colors: {
    studio: ["#f4f8f2", "#e5f1e9", "#c9e4d7", "#9dceb7", "#70b895", "#42a076", "#19885e", "#006f4f", "#07593e", "#104531"],
  },
  black: "#111713",
  white: "#ffffff",
  fontFamily: '"Geist Local", Arial, sans-serif',
  fontFamilyMonospace: '"Geist Mono Local", monospace',
  defaultRadius: 0,
  respectReducedMotion: true,
  components: {
    Tooltip: Tooltip.extend({
      defaultProps: { radius: 0, openDelay: 400, withArrow: true, multiline: true, maw: 280, events: { hover: true, focus: true, touch: false } },
      classNames: { tooltip: "studio-tooltip" },
    }),
  },
});

export default function StudioProvider({ children }: { children: ReactNode }) {
  return <MantineProvider theme={theme} forceColorScheme="light">{children}</MantineProvider>;
}
