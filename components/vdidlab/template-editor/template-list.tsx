"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import type { CustomTemplate, TemplateElement } from "@/lib/custom-template";
import { renderCustomTemplateThumbnail } from "@/lib/custom-template-render";
import { BUILTIN_TEMPLATE_PRESETS } from "@/lib/builtin-template-presets";
import type { RenderAssets } from "@/lib/lab-slide-render";
import { cn } from "@/lib/utils";

export type TemplateListProps = {
  templates: CustomTemplate[];
  selectedId: string | null;
  assets: RenderAssets;
  onSelect: (id: string) => void;
  onNew: () => void;
  onNewFromPreset: (slideType: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onImport: () => void;
  onExport: () => void;
};

export function TemplateList({
  templates,
  selectedId,
  assets,
  onSelect,
  onNew,
  onNewFromPreset,
  onDuplicate,
  onDelete,
  onImport,
  onExport,
}: TemplateListProps) {
  const [thumbs, setThumbs] = React.useState<Map<string, string>>(new Map());

  React.useEffect(() => {
    const next = new Map<string, string>();
    for (const t of templates) {
      const url = renderCustomTemplateThumbnail(t, assets, 80);
      if (url) next.set(t.id, url);
    }
    setThumbs(next);
  }, [templates, assets]);

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={onNew}>
          Neu
        </Button>
        <select
          className="h-8 max-w-[10rem] rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          defaultValue=""
          onChange={(e) => {
            const v = e.target.value;
            if (v) {
              onNewFromPreset(v);
              e.target.value = "";
            }
          }}
          aria-label="Aus Standard-Vorlage erstellen"
        >
          <option value="" disabled>
            Aus Standard-Vorlage…
          </option>
          {BUILTIN_TEMPLATE_PRESETS.map((p) => (
            <option key={p.slideType} value={p.slideType}>
              {p.name}
            </option>
          ))}
        </select>
        <Button type="button" size="sm" variant="outline" onClick={onImport}>
          Import
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onExport}>
          Export
        </Button>
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
        {templates.length === 0 && (
          <p className="text-sm text-slate-500 dark:text-slate-400">Noch keine eigenen Vorlagen.</p>
        )}
        {templates.map((t) => (
          <div
            key={t.id}
            className={cn(
              "rounded-lg border p-2 transition-colors",
              selectedId === t.id
                ? "border-vdidBlue bg-blue-50/50 dark:bg-vdidBlue/15"
                : "border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-500",
            )}
          >
            <button
              type="button"
              className="flex w-full items-center gap-2 text-left"
              onClick={() => onSelect(t.id)}
            >
              {thumbs.get(t.id) ? (
                <img
                  src={thumbs.get(t.id)}
                  alt=""
                  className="h-14 w-11 shrink-0 rounded border border-slate-200 object-cover"
                />
              ) : (
                <div className="h-14 w-11 shrink-0 rounded bg-slate-100" />
              )}
              <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{t.name}</span>
            </button>
            <div className="mt-2 flex gap-1">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs"
                onClick={() => onDuplicate(t.id)}
              >
                Duplizieren
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs text-red-600"
                onClick={() => onDelete(t.id)}
              >
                Löschen
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export type ElementLayerListProps = {
  elements: TemplateElement[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onReorder: (elements: TemplateElement[]) => void;
};

export function ElementLayerList({
  elements,
  selectedId,
  onSelect,
  onReorder,
}: ElementLayerListProps) {
  const move = (id: string, dir: -1 | 1) => {
    const idx = elements.findIndex((e) => e.id === id);
    if (idx < 0) return;
    const next = [...elements];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    onReorder(next);
  };

  return (
    <ul className="space-y-1">
      {[...elements].reverse().map((el) => (
        <li key={el.id}>
          <button
            type="button"
            className={cn(
              "flex w-full items-center justify-between rounded px-2 py-1 text-left text-xs",
              selectedId === el.id ? "bg-vdidBlue text-white" : "hover:bg-slate-100 dark:hover:bg-slate-800",
            )}
            onClick={() => onSelect(el.id)}
          >
            <span>{el.kind}</span>
            <span className="flex gap-1">
              <span
                role="button"
                tabIndex={0}
                className="rounded px-1 hover:bg-black/10"
                onClick={(e) => {
                  e.stopPropagation();
                  move(el.id, 1);
                }}
              >
                ↑
              </span>
              <span
                role="button"
                tabIndex={0}
                className="rounded px-1 hover:bg-black/10"
                onClick={(e) => {
                  e.stopPropagation();
                  move(el.id, -1);
                }}
              >
                ↓
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
