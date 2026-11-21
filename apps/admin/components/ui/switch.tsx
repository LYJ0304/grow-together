"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Switch as SwitchPrimitive } from "radix-ui";

function Switch({
  className,
  size = "default",
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
  size?: "sm" | "default";
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        "peer group/switch relative inline-flex h-11 w-14 shrink-0 items-center rounded-full outline-none before:absolute before:inset-x-1.5 before:top-3 before:h-5 before:rounded-full before:bg-input before:transition-colors data-[state=checked]:before:bg-primary focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none relative z-10 block size-4 rounded-full bg-white transition-transform data-[state=checked]:translate-x-8 data-[state=unchecked]:translate-x-2",
        )}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
