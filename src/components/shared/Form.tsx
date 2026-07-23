import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";

/**
 * Lightweight form primitives for the SoulERP design system.
 * Wire up react-hook-form + zod on top of these in feature modules.
 */

export function FormSection({
  title,
  description,
  children,
}: {
  title?: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3 border-b border-border pb-4 last:border-b-0 last:pb-0">
      {title && (
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
        </div>
      )}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">{children}</div>
    </section>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
  full,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  full?: boolean;
}) {
  return (
    <div className={full ? "md:col-span-2" : undefined}>
      <Label htmlFor={htmlFor} className="mb-1 block text-xs font-medium text-foreground">
        {label}
      </Label>
      {children}
      {error ? (
        <p className="mt-1 text-[11px] text-destructive">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
