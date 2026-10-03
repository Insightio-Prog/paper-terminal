import { useState } from "react";
import {
  createDraftInvoice,
  useInvoiceStore,
} from "../../stores/invoiceStore";
import { InvoiceDetail } from "./InvoiceDetail";
import { InvoiceListView } from "./InvoiceListView";

export function InvoiceList() {
  const activeInvoice = useInvoiceStore((s) => s.activeInvoice);
  const invoices = useInvoiceStore((s) => s.invoices);
  const setActiveInvoice = useInvoiceStore((s) => s.setActiveInvoice);
  const [statusFilter, setStatusFilter] = useState<
    "all" | "draft" | "sent" | "overdue" | "paid"
  >("all");

  if (activeInvoice) {
    return <InvoiceDetail />;
  }

  return (
    <InvoiceListView
      statusFilter={statusFilter}
      onStatusFilterChange={setStatusFilter}
      onNewInvoice={() => setActiveInvoice(createDraftInvoice())}
      onSelectInvoice={(invoiceId) => {
        const invoice = invoices.find((item) => item.id === invoiceId);
        if (invoice) {
          setActiveInvoice(invoice);
        }
      }}
      invoices={invoices}
    />
  );
}
