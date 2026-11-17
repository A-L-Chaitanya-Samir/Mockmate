"use client";
import * as Primitive from "@radix-ui/react-tooltip";
import type { ReactNode } from "react";
export function Tooltip({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <Primitive.Root>
      <Primitive.Trigger asChild>{children}</Primitive.Trigger>
      <Primitive.Portal>
        <Primitive.Content className="tooltip" sideOffset={6}>
          {label}
          <Primitive.Arrow className="fill-current" />
        </Primitive.Content>
      </Primitive.Portal>
    </Primitive.Root>
  );
}
