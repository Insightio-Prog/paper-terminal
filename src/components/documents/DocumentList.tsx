import { useEffect, useMemo, useState } from "react";
import { useDocumentStore } from "../../stores/documentStore";
import { DocumentDetail } from "./DocumentDetail";
import { documentPrimaryButtonClass } from "./documentsStyles";

const CATEGORY_FILTERS = [
  { key: "all", label: "All" },
  { key: "General", label: "General" },
  { key: "Proposal", label: "Proposal" },
  { key: "Contract", label: "Contract" },
  { key: "Email", label: "Email" },
  { key: "Notes", label: "Notes" },
] as const;

type CategoryFilter = (typeof CATEGORY_FILTERS)[number]["key"];

function formatUpdatedDate(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export interface DocumentListProps {
  fixedCategory?: string;
}

export function DocumentList({ fixedCategory }: DocumentListProps = {}) {
  const documents = useDocumentStore((s) => s.documents);
  const loadDocuments = useDocumentStore((s) => s.loadDocuments);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [activeDocumentId, setActiveDocumentId] = useState<
    string | null | undefined
  >(undefined);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  const filtered = useMemo(() => {
    if (fixedCategory) {
      return documents.filter((document) => document.category === fixedCategory);
    }

    return categoryFilter === "all"
      ? documents
      : documents.filter((document) => document.category === categoryFilter);
  }, [documents, categoryFilter, fixedCategory]);

  const pageTitle = fixedCategory ?? "Documents";
  const newButtonLabel =
    fixedCategory === "Email"
      ? "New Email +"
      : fixedCategory
        ? `New ${fixedCategory} +`
        : "New Document +";
  const emptyMessage =
    fixedCategory === "Email"
      ? "❯ No emails saved yet"
      : fixedCategory
        ? `❯ No ${fixedCategory.toLowerCase()} documents yet`
        : documents.length === 0
          ? "❯ No documents yet"
          : "No documents in this category.";

  function handleBack() {
    void loadDocuments();
    setActiveDocumentId(undefined);
  }

  if (activeDocumentId !== undefined) {
    return (
      <DocumentDetail
        documentId={activeDocumentId}
        onBack={handleBack}
        fixedCategory={fixedCategory}
      />
    );
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-bg">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-2">
        <h1 className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink">
          {pageTitle}
        </h1>
        <button
          type="button"
          onClick={() => setActiveDocumentId(null)}
          className={documentPrimaryButtonClass}
        >
          {newButtonLabel}
        </button>
      </div>

      {!fixedCategory && (
        <div className="flex shrink-0 gap-4 border-b border-border px-4">
          {CATEGORY_FILTERS.map((tab) => {
            const isActive = categoryFilter === tab.key;

            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setCategoryFilter(tab.key)}
                className={[
                  "border-b-2 py-2 font-mono text-[11px] uppercase tracking-[0.08em] transition-colors duration-150",
                  isActive
                    ? "border-ink text-ink"
                    : "border-transparent text-ink-secondary hover:text-ink",
                ].join(" ")}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-auto">
        {filtered.length === 0 ? (
          <p className="px-4 py-12 text-center font-mono text-[13px] text-ink-faint">
            {emptyMessage}
          </p>
        ) : (
          <table className="w-full border-collapse font-mono text-[13px]">
            <thead className="sticky top-0 z-10 bg-bg">
              <tr className="border-b border-border">
                {["Title", "Category", "Updated"].map((label) => (
                  <th
                    key={label}
                    className={[
                      "h-9 px-4 text-left font-mono text-[11px] font-normal uppercase tracking-[0.08em] text-ink-secondary",
                      label === "Updated" ? "text-right" : "",
                    ].join(" ")}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((document) => (
                <tr
                  key={document.id}
                  onClick={() => setActiveDocumentId(document.id)}
                  className="h-9 cursor-pointer border-b border-border transition-colors duration-150 hover:bg-bg-raised"
                >
                  <td className="px-4 font-medium text-ink">{document.title}</td>
                  <td className="px-4 font-mono text-[11px] uppercase tracking-[0.08em] text-ink-faint">
                    {document.category}
                  </td>
                  <td className="px-4 text-right text-ink-faint">
                    {formatUpdatedDate(document.updated_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
