import { Sparkles, ArrowRight, AlertTriangle, Package, Truck, Send } from "lucide-react";
import { aiInsights, aiAttention, aiQuickPrompts } from "@/mocks/soul-ai";

/**
 * Visual-only Soul AI surface.
 *
 * IMPORTANT: Soul AI does NOT talk to the database directly. Future integration
 * will call authorized tools/APIs. Any financial action, deletion or critical
 * change MUST require explicit human confirmation before execution.
 *
 * This component is a reusable shell for future capabilities:
 *  - chat
 *  - contextual insights for the current screen
 *  - recommendations & suggested actions
 *  - deep-links into modules
 */
export function SoulAI() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-5 p-4">
        {/* Highlighted insight */}
        {aiInsights.map((insight) => (
          <div
            key={insight.id}
            className="rounded-lg border border-primary/30 bg-primary/10 p-3"
          >
            <div className="flex items-start gap-2">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <p className="text-xs leading-relaxed text-foreground">
                <span className="font-semibold">{insight.headline}</span>{" "}
                {insight.body}
              </p>
            </div>
            <button className="mt-2 flex items-center gap-1 text-[11px] font-medium text-primary hover:text-primary/80">
              {insight.cta} <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        ))}

        {/* Attention */}
        <div>
          <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Atenção necessária
          </h3>
          <ul className="space-y-2">
            {aiAttention.map((item) => {
              const Icon =
                item.icon === "alert"
                  ? AlertTriangle
                  : item.icon === "package"
                    ? Package
                    : Truck;
              const tone =
                item.tone === "danger"
                  ? "text-destructive"
                  : item.tone === "warning"
                    ? "text-warning"
                    : "text-info";
              return (
                <li
                  key={item.id}
                  className="flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-secondary/60"
                >
                  <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${tone}`} />
                  <span className="text-xs leading-snug text-foreground">
                    {item.label}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Quick prompts */}
        <div>
          <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Perguntas rápidas
          </h3>
          <div className="space-y-1.5">
            {aiQuickPrompts.map((p) => (
              <button
                key={p}
                className="w-full rounded-md border border-border bg-secondary/40 px-3 py-2 text-left text-xs text-foreground hover:border-primary/40 hover:bg-secondary"
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Composer */}
      <div className="border-t border-border p-3">
        <div className="flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1.5 focus-within:border-primary/50">
          <input
            type="text"
            placeholder="Pergunte ao Soul AI..."
            className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          <button
            className="flex h-6 w-6 items-center justify-center rounded bg-primary text-primary-foreground hover:bg-primary/90"
            aria-label="Enviar"
          >
            <Send className="h-3 w-3" />
          </button>
        </div>
        <p className="mt-1.5 text-[10px] leading-tight text-muted-foreground">
          Soul AI sugere ações. Confirmações humanas são obrigatórias para operações
          críticas.
        </p>
      </div>
    </div>
  );
}
