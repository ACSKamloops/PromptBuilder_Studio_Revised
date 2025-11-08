export type StudioTestWindow = Window &
  typeof globalThis & {
    __testCreateNode?: (id: string, x?: number, y?: number) => void;
    __testReplaceFlow?: (snap: unknown) => void;
    __testOpenCommandPalette?: () => void;
    __testOpenQuickInsert?: (edgeId: string) => void;
    __testOpenNodeMenu?: (id: string) => void;
    __testGetExtraIds?: () => string[];
  };
