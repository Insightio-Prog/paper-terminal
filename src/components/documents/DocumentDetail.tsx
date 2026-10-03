import { useEffect, useRef, useState } from "react";
import { generateDocumentContent } from "../../ai/documentAi";
import { useDocumentStore } from "../../stores/documentStore";
import {
  documentChipClass,
  documentClaudeInputClass,
  documentClaudeToggleClass,
  documentDeleteButtonClass,
  documentFooterButtonClass,
  documentGhostButtonClass,
  documentSelectClass,
} from "./documentsStyles";

const DOCUMENT_CATEGORIES = [
  "General",
  "Proposal",
  "Contract",
  "Email",
  "Notes",
] as const;

const QUICK_PROMPTS = [
  "Draft from title",
  "Expand this",
  "Make it more professional",
  "Summarise",
  "Write as email",
] as const;

type SaveIndicator = "idle" | "saving" | "saved";

interface DocumentDetailProps {
  documentId: string | null;
  onBack: () => void;
  fixedCategory?: string;
}

function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function safeFilename(title: string): string {
  const base = title.trim() || "Untitled Document";
  return `${base.replace(/[<>:"/\\|?*]/g, "-")}.txt`;
}

export function DocumentDetail({
  documentId,
  onBack,
  fixedCategory,
}: DocumentDetailProps) {
  const documents = useDocumentStore((s) => s.documents);
  const addDocument = useDocumentStore((s) => s.addDocument);
  const updateDocument = useDocumentStore((s) => s.updateDocument);
  const deleteDocument = useDocumentStore((s) => s.deleteDocument);

  const isNew = documentId === null;
  const [savedId, setSavedId] = useState<string | null>(documentId);
  const [title, setTitle] = useState("Untitled Document");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState(() => fixedCategory ?? "General");
  const [saveIndicator, setSaveIndicator] = useState<SaveIndicator>("idle");
  const [hydrated, setHydrated] = useState(false);
  const [claudePanelOpen, setClaudePanelOpen] = useState(false);
  const [claudePrompt, setClaudePrompt] = useState("");
  const [claudeLoading, setClaudeLoading] = useState(false);
  const [claudeError, setClaudeError] = useState<string | null>(null);
  const [claudeResponse, setClaudeResponse] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasEditedRef = useRef(false);
  const hydratedKeyRef = useRef<string | "new" | null>(null);

  useEffect(() => {
    if (documentId === null) {
      if (hydratedKeyRef.current !== "new") {
        hydratedKeyRef.current = "new";
        setHydrated(true);
      }
      return;
    }

    if (hydratedKeyRef.current === documentId) return;

    const document = documents.find((item) => item.id === documentId);
    if (!document) return;

    hydratedKeyRef.current = documentId;
    setTitle(document.title);
    setContent(document.content);
    setCategory(document.category);
    setSavedId(documentId);
    setHydrated(true);
  }, [documentId, documents]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (!hydrated || !hasEditedRef.current) return;

    setSaveIndicator("saving");

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      void (async () => {
        const fields = { title, content, category };

        try {
          if (savedId === null) {
            const id = await addDocument(fields);
            setSavedId(id);
          } else {
            await updateDocument(savedId, fields);
          }

          setSaveIndicator("saved");

          if (savedTimeoutRef.current) {
            clearTimeout(savedTimeoutRef.current);
          }

          savedTimeoutRef.current = setTimeout(() => {
            setSaveIndicator("idle");
          }, 2000);
        } catch {
          setSaveIndicator("idle");
        }
      })();
    }, 1000);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [title, content, category, hydrated, savedId, addDocument, updateDocument]);

  async function handleDelete() {
    if (isNew || savedId === null) return;

    if (!window.confirm("Delete this document?")) return;

    await deleteDocument(savedId);
    onBack();
  }

  function handleExport() {
    downloadTextFile(safeFilename(title), content);
  }

  async function handleClaudeSubmit(promptText?: string) {
    const prompt = (promptText ?? claudePrompt).trim();
    if (!prompt || claudeLoading) return;

    setClaudePrompt(prompt);
    setClaudeLoading(true);
    setClaudeError(null);
    setClaudeResponse(null);

    try {
      const generated = await generateDocumentContent(
        prompt,
        title,
        content,
        category,
      );

      hasEditedRef.current = true;
      setContent(generated);
      setClaudePrompt("");
      setClaudePanelOpen(false);
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : "Claude isn't connected yet — coming in the next update.";
      setClaudeResponse(message);
    } finally {
      setClaudeLoading(false);
    }
  }

  function handleClaudeKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleClaudeSubmit();
    }
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-bg">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-2">
        <button type="button" onClick={onBack} className={documentGhostButtonClass}>
          ← Back
        </button>

        <span className="font-mono text-[11px] text-ink-faint" aria-live="polite">
          {saveIndicator === "saving" && "Saving..."}
          {saveIndicator === "saved" && (
            <>
              <span className="text-income">✓</span> Saved
            </>
          )}
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="shrink-0 px-4 pt-3">
          <input
            type="text"
            value={title}
            onChange={(e) => {
              hasEditedRef.current = true;
              setTitle(e.target.value);
            }}
            placeholder="Document title..."
            className="w-full border-0 border-b border-border bg-transparent py-2 font-mono text-[1.25rem] text-ink placeholder:text-ink-faint focus:outline-none"
          />

          <div className="mt-3 flex items-center justify-between gap-4 pb-3">
            {!fixedCategory ? (
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-faint">
                  Category:
                </span>
                <select
                  value={category}
                  onChange={(e) => {
                    hasEditedRef.current = true;
                    setCategory(e.target.value);
                  }}
                  className={documentSelectClass}
                >
                  {DOCUMENT_CATEGORIES.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div />
            )}

            <button
              type="button"
              onClick={() => {
                setClaudePanelOpen((open) => !open);
                setClaudeError(null);
              }}
              className={documentClaudeToggleClass}
            >
              {claudePanelOpen ? "✕ Close" : "❯ Ask Claude"}
            </button>
          </div>

          {claudePanelOpen && (
            <div className="-mx-4 border-b border-border bg-bg-raised px-4 py-3">
              <input
                type="text"
                value={claudePrompt}
                onChange={(e) => setClaudePrompt(e.target.value)}
                onKeyDown={handleClaudeKeyDown}
                disabled={claudeLoading}
                placeholder="e.g. Write a proposal for a web design project..."
                className={documentClaudeInputClass}
              />

              <div className="mt-2 flex flex-wrap gap-2">
                {QUICK_PROMPTS.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => {
                      setClaudePrompt(chip);
                      void handleClaudeSubmit(chip);
                    }}
                    disabled={claudeLoading}
                    className={documentChipClass}
                  >
                    {chip}
                  </button>
                ))}
              </div>

              {claudeLoading && (
                <p className="mt-2 font-mono text-[12px] text-ink-faint">
                  <span className="text-accent">❯</span> Claude is writing...
                </p>
              )}

              {claudeResponse && (
                <p className="mt-2 font-mono text-[12px] text-ink-faint">
                  {claudeResponse}
                </p>
              )}

              {claudeError && (
                <p className="mt-2 font-mono text-[12px] text-expense">
                  {claudeError}
                </p>
              )}
            </div>
          )}
        </div>

        <textarea
          value={content}
          onChange={(e) => {
            hasEditedRef.current = true;
            setContent(e.target.value);
          }}
          placeholder="Start writing..."
          className="min-h-0 w-full flex-1 resize-none border-0 bg-bg px-4 py-3 font-mono text-[13px] leading-[1.7] text-ink placeholder:text-ink-faint focus:outline-none"
        />
      </div>

      <div className="flex shrink-0 items-center justify-between border-t border-border px-4 py-3">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={handleExport}
            className={documentFooterButtonClass}
          >
            Export .txt
          </button>
          {!isNew && (
            <button
              type="button"
              onClick={() => void handleDelete()}
              className={documentDeleteButtonClass}
            >
              Delete
            </button>
          )}
        </div>
        <div />
      </div>
    </div>
  );
}
