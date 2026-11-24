export type ParsedImport = {
  fileName: string;
  fileType: "txt" | "pptx" | "ppt" | "pdf" | "zip" | "other";
  title: string;
  songNumber: string | null;
  lyricsText: string;
  parserNotes: string;
  storagePath?: string | null;
};

export type ImportDuplicateCandidate = {
  songId: string;
  title: string;
  songNumber: string | null;
  collectionName: string | null;
  reason: string;
};

export type ImportPreviewItem = ParsedImport & {
  previewId: string;
  duplicates: ImportDuplicateCandidate[];
  importIssues: string[];
  canImport: boolean;
};

export type ConfirmImportBatchError = {
  previewId: string;
  fileName: string;
  title: string;
  message: string;
};

export type ConfirmImportBatchResult = {
  processed: number;
  createdOrUpdatedIds: string[];
  skipped: number;
  errors: ConfirmImportBatchError[];
};

export type ImportPreviewResult = {
  collectionId: string;
  collectionName: string;
  items: ImportPreviewItem[];
  duplicateCount: number;
  metadata: {
    defaultKey: string | null;
    bpm: number | null;
    structure: string | null;
    notes: string | null;
  };
};
