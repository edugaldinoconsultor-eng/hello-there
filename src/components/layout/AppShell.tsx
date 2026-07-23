import { useState, type ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { SoulAIPanel } from "./SoulAIPanel";

export function AppShell({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [aiOpen, setAiOpen] = useState(true);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      <Sidebar open={sidebarOpen} onToggle={() => setSidebarOpen((v) => !v)} />

      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          onToggleSidebar={() => setSidebarOpen((v) => !v)}
          onToggleAI={() => setAiOpen((v) => !v)}
          aiOpen={aiOpen}
        />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1600px] px-6 py-6">{children}</div>
        </main>
      </div>

      <SoulAIPanel open={aiOpen} onClose={() => setAiOpen(false)} />
    </div>
  );
}
