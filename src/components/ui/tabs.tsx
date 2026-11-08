"use client";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import type { ReactNode } from "react";
export function Tabs({
  tabs,
  defaultValue,
}: {
  tabs: { value: string; label: string; content: ReactNode }[];
  defaultValue?: string;
}) {
  return (
    <TabsPrimitive.Root defaultValue={defaultValue ?? tabs[0].value}>
      <TabsPrimitive.List className="tabs-list" aria-label="Content sections">
        {tabs.map((tab) => (
          <TabsPrimitive.Trigger
            className="tabs-trigger"
            key={tab.value}
            value={tab.value}
          >
            {tab.label}
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>
      {tabs.map((tab) => (
        <TabsPrimitive.Content
          className="tabs-content"
          key={tab.value}
          value={tab.value}
        >
          {tab.content}
        </TabsPrimitive.Content>
      ))}
    </TabsPrimitive.Root>
  );
}
