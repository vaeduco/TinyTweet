import * as React from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * The app's shared empty-state block: a centered icon + bold title + muted
 * description, with room for an optional call-to-action (a button, or an inline
 * list of suggestions) below. Matches the hand-rolled empty states it replaces
 * (`px-6 py-16 text-center`).
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  children,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("px-6 py-16 text-center", className)}>
      {Icon && (
        <Icon className="mx-auto h-7 w-7 text-muted-foreground" aria-hidden="true" />
      )}
      <p className={cn("text-lg font-bold", Icon && "mt-3")}>{title}</p>
      {description && (
        <p className="mx-auto mt-1 max-w-xs text-muted-foreground">
          {description}
        </p>
      )}
      {children && <div className="mt-6">{children}</div>}
    </div>
  );
}
