"use client";

import * as React from "react";
import { useTheme } from "next-themes";

import { SectionCard, SettingRow, SegmentedControl } from "@/components/settings/ui";

type ThemeChoice = "light" | "dark" | "system";

export function AppearanceSection() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  // Until mounted the theme is unknown; show "system" to avoid a hydration flip.
  const value: ThemeChoice = (mounted && theme ? theme : "system") as ThemeChoice;

  return (
    <SectionCard title="Appearance">
      <SettingRow label="Theme" hint="Also available from the sun/moon in the nav">
        <SegmentedControl<ThemeChoice>
          value={value}
          onChange={(v) => setTheme(v)}
          options={[
            { value: "light", label: "Light" },
            { value: "dark", label: "Dark" },
            { value: "system", label: "System" },
          ]}
        />
      </SettingRow>
    </SectionCard>
  );
}
