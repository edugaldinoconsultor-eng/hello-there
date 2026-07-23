import { createFileRoute } from "@tanstack/react-router";
import { Plus, Users } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/EmptyState";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { NovoClienteModal } from "@/components/customers/NovoClienteModal";
import { useCustomers, type Customer } from "@/mocks/customers";
import { maskCpfCnpj, maskPhoneBR } from "@/lib/masks";
import { useUIEvent } from "@/lib/ui-events";

export const Route = createFileRoute("/clientes")({
  head: () => ({
    meta: [
      { title: "Clientes · SoulERP" },
      { name: "description", content: "Cadastro e gestão de clientes do distribuidor." },
      { property: "og:title", content: "Clientes · SoulERP" },
      { property: "og:description", content: "Gestão de clientes no SoulERP." },
    ],
  }),
  component: ClientesPage,
});

function ClientesPage() {
  const { customers } = useCustomers();
  const [open, setOpen] = useState(false);

  // Header dispara "customer:new" — a página é a dona do modal.
  useUIEvent("customer:new", () => setOpen(true));

  const columns: Column<Customer>[] = [
    {
      key: "legalName",
      header: "Cliente",
      render: (c) => (
        <div>
          <div className="font-medium text-foreground">{c.legalName}</div>
          {c.tradeName && (
            <div className="text-[11px] text-muted-foreground">{c.tradeName}</div>
          )}
        </div>
      ),
    },
    {
      key: "document",
      header: "CPF/CNPJ",
      render: (c) => <span className="text-muted-foreground">{maskCpfCnpj(c.document)}</span>,
    },
    {
      key: "phone",
      header: "Telefone",
      render: (c) => <span className="text-muted-foreground">{maskPhoneBR(c.phone)}</span>,
    },
    {
      key: "commercial",
      header: "Vendedor",
      render: (c) => (
        <span className="text-muted-foreground">
          {c.commercial.salespersonName ?? "—"}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (c) => (
        <div className="flex items-center gap-1.5">
          <StatusBadge variant={c.status.active ? "confirmed" : "neutral"}>
            {c.status.active ? "Ativo" : "Inativo"}
          </StatusBadge>
          {c.status.diamond && (
            <StatusBadge variant="separating">Diamante</StatusBadge>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Clientes
          </h1>
          <p className="text-xs text-muted-foreground">
            {customers.length} cliente{customers.length === 1 ? "" : "s"} cadastrado
            {customers.length === 1 ? "" : "s"}.
          </p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
          <Plus className="h-3.5 w-3.5" />
          Novo cliente
        </Button>
      </div>

      {customers.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nenhum cliente cadastrado ainda"
          description="Cadastre o primeiro cliente para começar a lançar pedidos, acompanhar recompras e alimentar as recomendações da Soul AI."
          action={{ label: "Novo cliente", onClick: () => setOpen(true) }}

        />
      ) : (
        <section className="rounded-lg border border-border bg-card">
          <DataTable columns={columns} data={customers} />
        </section>
      )}

      <NovoClienteModal open={open} onOpenChange={setOpen} />
    </div>
  );
}
