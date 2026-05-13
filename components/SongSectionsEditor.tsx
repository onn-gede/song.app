"use client";

import { useMemo, useState } from "react";

type SectionInput = {
  id?: string;
  section_type?: string;
  section_label?: string | null;
  content?: string | null;
};

type Props = {
  sections: SectionInput[];
  songTitle?: string;
};


function normalizeTextForCompare(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/^[\s\d.\-–—_]+/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function stripRepeatedSongTitle(content: string, songTitle?: string) {
  if (!songTitle) return content;
  const normalizedTitle = normalizeTextForCompare(songTitle);
  return content
    .split(/\r?\n/)
    .filter((line, index) => {
      if (index > 2) return true;
      return normalizeTextForCompare(line) !== normalizedTitle;
    })
    .join("\n")
    .trim();
}

const SECTION_TYPES = [
  { value: "verse", label: "Strofă" },
  { value: "chorus", label: "Refren" },
  { value: "bridge", label: "Bridge" },
  { value: "prechorus", label: "Pre-refren" },
  { value: "ending", label: "Final" },
  { value: "text", label: "Text" }
];

function createEmptySection(index: number): Required<Pick<SectionInput, "section_type" | "section_label" | "content">> & { id: string } {
  return {
    id: `new-${Date.now()}-${index}`,
    section_type: "verse",
    section_label: "",
    content: ""
  };
}

export function SongSectionsEditor({ sections, songTitle }: Props) {
  const initialSections = useMemo(() => {
    if (sections.length > 0) {
      return sections.map((section, index) => ({
        id: section.id || `section-${index}`,
        section_type: section.section_type || "verse",
        section_label: section.section_label || "",
        content: stripRepeatedSongTitle(section.content || "", songTitle)
      }));
    }

    return [createEmptySection(0)];
  }, [sections, songTitle]);

  const [items, setItems] = useState(initialSections);

  function updateItem(index: number, key: "section_type" | "section_label" | "content", value: string) {
    setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item));
  }

  function addSection(afterIndex?: number) {
    setItems((current) => {
      const next = [...current];
      const insertAt = typeof afterIndex === "number" ? afterIndex + 1 : next.length;
      next.splice(insertAt, 0, createEmptySection(next.length + 1));
      return next;
    });
  }

  function removeSection(index: number) {
    setItems((current) => current.length <= 1 ? current : current.filter((_, itemIndex) => itemIndex !== index));
  }

  function moveSection(index: number, direction: -1 | 1) {
    setItems((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return next;
    });
  }

  return (
    <div className="section-editor">
      <input type="hidden" name="sections_count" value={items.length} />

      <div className="section-editor-header">
        <div>
          <h2>Versuri pe secțiuni</h2>
          <p className="muted small">Poți modifica textul, etichetele și ordinea. Câmpurile goale nu vor fi salvate.</p>
        </div>
        <button className="btn secondary btn-compact" type="button" onClick={() => addSection()}>+ Adaugă secțiune</button>
      </div>

      <div className="grid">
        {items.map((section, index) => (
          <div className="section-edit-card" key={section.id || index}>
            <div className="section-edit-top">
              <span className="program-position">{index + 1}</span>
              <label className="label section-type-field">Tip
                <select className="select" name={`section_type_${index}`} value={section.section_type} onChange={(event) => updateItem(index, "section_type", event.target.value)}>
                  {SECTION_TYPES.map((type) => <option value={type.value} key={type.value}>{type.label}</option>)}
                </select>
              </label>
              <label className="label section-label-field">Etichetă
                <input className="input" name={`section_label_${index}`} value={section.section_label || ""} onChange={(event) => updateItem(index, "section_label", event.target.value)} placeholder="ex: 1 / R / Bridge" />
              </label>
              <div className="section-edit-actions">
                <button className="icon-btn" type="button" onClick={() => moveSection(index, -1)} disabled={index === 0} title="Mută sus">↑</button>
                <button className="icon-btn" type="button" onClick={() => moveSection(index, 1)} disabled={index === items.length - 1} title="Mută jos">↓</button>
                <button className="icon-btn" type="button" onClick={() => addSection(index)} title="Adaugă după">+</button>
                <button className="icon-btn danger-text" type="button" onClick={() => removeSection(index)} disabled={items.length <= 1} title="Șterge">×</button>
              </div>
            </div>
            <textarea
              className="textarea lyrics-editor"
              name={`section_content_${index}`}
              value={section.content || ""}
              onChange={(event) => updateItem(index, "content", event.target.value)}
              placeholder="Scrie aici textul secțiunii..."
            />
          </div>
        ))}
      </div>
    </div>
  );
}
