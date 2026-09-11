"use client";

import React from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { CardTitle } from "@/components/ui/card";
import {
  cloneTemplate,
  createDefaultTemplate,
  editorCanvasSizePx,
  exportTemplatesJson,
  importTemplatesJsonFile,
  saveCustomTemplatesToStorage,
  type CustomTemplate,
  type TemplateElement,
} from "@/lib/custom-template";
import { squareLogoElements } from "@/lib/lab-layout";
import { createBuiltinTemplatePreset } from "@/lib/builtin-template-presets";
import type { RenderAssets, SlideType } from "@/lib/lab-slide-render";
import { EditorCanvas } from "@/components/vdidlab/template-editor/editor-canvas";
import {
  ElementProperties,
  TemplateMetaFields,
} from "@/components/vdidlab/template-editor/element-properties";
import {
  ElementLayerList,
  TemplateList,
} from "@/components/vdidlab/template-editor/template-list";

export type TemplateEditorModalProps = {
  open: boolean;
  onClose: () => void;
  templates: CustomTemplate[];
  onTemplatesChange: (templates: CustomTemplate[]) => void;
  assets: RenderAssets;
  /** Current preview aspect (width/height) */
  editorAspect: number;
};

export function TemplateEditorModal({
  open,
  onClose,
  templates,
  onTemplatesChange,
  assets,
  editorAspect,
}: TemplateEditorModalProps) {
  const [selectedTemplateId, setSelectedTemplateId] = React.useState<string | null>(
    templates[0]?.id ?? null,
  );
  const [selectedElementId, setSelectedElementId] = React.useState<string | null>(
    null,
  );
  const importRef = React.useRef<HTMLInputElement>(null);

  const selectedTemplate =
    templates.find((t) => t.id === selectedTemplateId) ?? null;

  React.useEffect(() => {
    if (!open) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  React.useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  React.useEffect(() => {
    if (templates.length === 0) {
      setSelectedTemplateId(null);
      return;
    }
    if (!selectedTemplateId || !templates.some((t) => t.id === selectedTemplateId)) {
      setSelectedTemplateId(templates[0].id);
    }
  }, [templates, selectedTemplateId]);

  const persist = (next: CustomTemplate[]) => {
    onTemplatesChange(next);
    saveCustomTemplatesToStorage(next);
  };

  const updateTemplate = (updated: CustomTemplate) => {
    persist(
      templates.map((t) =>
        t.id === updated.id
          ? {
              ...updated,
              baseAspect: editorAspect,
              elements: squareLogoElements(updated.elements, editorAspect),
            }
          : t,
      ),
    );
  };

  const handleNew = () => {
    const t = createDefaultTemplate();
    t.baseAspect = editorAspect;
    t.elements = squareLogoElements(t.elements, editorAspect);
    persist([...templates, t]);
    setSelectedTemplateId(t.id);
    setSelectedElementId(null);
  };

  const handleNewFromPreset = (slideType: string) => {
    const t = createBuiltinTemplatePreset(
      slideType as Exclude<SlideType, "custom">,
      editorAspect,
    );
    persist([...templates, t]);
    setSelectedTemplateId(t.id);
    setSelectedElementId(null);
  };

  const handleDuplicate = (id: string) => {
    const src = templates.find((t) => t.id === id);
    if (!src) return;
    const copy = cloneTemplate(src);
    copy.baseAspect = editorAspect;
    copy.elements = squareLogoElements(copy.elements, editorAspect);
    persist([...templates, copy]);
    setSelectedTemplateId(copy.id);
  };

  const handleDelete = (id: string) => {
    if (!confirm("Vorlage wirklich löschen?")) return;
    const next = templates.filter((t) => t.id !== id);
    persist(next);
    if (selectedTemplateId === id) {
      setSelectedTemplateId(next[0]?.id ?? null);
    }
  };

  const handleImport = () => importRef.current?.click();

  const onImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const imported = await importTemplatesJsonFile(file);
    if (imported.length === 0) return;
    const merged = [...templates];
    for (const t of imported) {
      merged.push({
        ...t,
        id: crypto.randomUUID(),
        baseAspect: editorAspect,
        elements: squareLogoElements(t.elements, editorAspect),
      });
    }
    persist(merged);
    e.target.value = "";
  };

  const editorTemplate = selectedTemplate
    ? {
        ...selectedTemplate,
        baseAspect: editorAspect,
        elements: squareLogoElements(selectedTemplate.elements, editorAspect),
      }
    : null;

  const selectedElement =
    editorTemplate?.elements.find((el) => el.id === selectedElementId) ?? null;

  const canvasSize = editorCanvasSizePx(editorAspect);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex flex-col bg-black/60"
      role="dialog"
      aria-modal="true"
      aria-label="Vorlagen bearbeiten"
    >
      <div className="flex h-full flex-col bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <CardTitle className="text-lg">Vorlagen bearbeiten</CardTitle>
          <Button type="button" variant="outline" onClick={onClose}>
            Schließen
          </Button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 overflow-y-auto lg:grid-cols-[220px_1fr_260px] lg:overflow-hidden">
          <aside className="min-h-0 overflow-y-auto border-b border-slate-200 p-4 dark:border-slate-700 lg:border-b-0 lg:border-r">
            <TemplateList
              templates={templates}
              selectedId={selectedTemplateId}
              assets={assets}
              onSelect={(id) => {
                setSelectedTemplateId(id);
                setSelectedElementId(null);
              }}
              onNew={handleNew}
              onNewFromPreset={handleNewFromPreset}
              onDuplicate={handleDuplicate}
              onDelete={handleDelete}
              onImport={handleImport}
              onExport={() => exportTemplatesJson(templates)}
            />
            <input
              ref={importRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={onImportFile}
            />
          </aside>

          <main className="min-h-0 overflow-y-auto p-4">
            {editorTemplate ? (
              <EditorCanvas
                template={editorTemplate}
                assets={assets}
                selectedElementId={selectedElementId}
                onSelectElement={setSelectedElementId}
                onUpdateTemplate={updateTemplate}
              />
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Vorlage anlegen oder aus der Liste wählen.
              </p>
            )}
          </main>

          <aside className="flex min-h-0 flex-col border-t border-slate-200 dark:border-slate-700 lg:border-l lg:border-t-0">
            {editorTemplate && (
              <>
                <div className="min-h-0 flex-1 overflow-y-auto p-4">
                  <TemplateMetaFields
                    template={editorTemplate}
                    onChange={updateTemplate}
                  />
                  <div className="mb-3 mt-4">
                    <p className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                      Ebenen
                    </p>
                    <ElementLayerList
                      elements={editorTemplate.elements}
                      selectedId={selectedElementId}
                      onSelect={setSelectedElementId}
                      onReorder={(elements) =>
                        updateTemplate({ ...editorTemplate, elements })
                      }
                    />
                  </div>
                  <ElementProperties
                    element={selectedElement}
                    canvasWidthPx={canvasSize.width}
                    canvasHeightPx={canvasSize.height}
                    onChange={(element) => {
                      updateTemplate({
                        ...editorTemplate,
                        elements: editorTemplate.elements.map((el) =>
                          el.id === element.id ? element : el,
                        ),
                      });
                    }}
                  />
                </div>
                {selectedElement && (
                  <div className="shrink-0 border-t border-slate-200 p-4 dark:border-slate-700">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full text-red-600"
                      onClick={() => {
                        updateTemplate({
                          ...editorTemplate,
                          elements: editorTemplate.elements.filter(
                            (el) => el.id !== selectedElement.id,
                          ),
                        });
                        setSelectedElementId(null);
                      }}
                    >
                      Element löschen
                    </Button>
                  </div>
                )}
              </>
            )}
          </aside>
        </div>
      </div>
    </div>,
    document.body,
  );
}
