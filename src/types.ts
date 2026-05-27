export interface FontSource {
  url: string;
  format: string | null;
  localFile?: string;
}

export interface FontFace {
  family: string;
  weight: string;
  style: string;
  display: string | null;
  unicodeRange: string | null;
  sources: FontSource[];
}

export interface PullOptions {
  url: string;
  baseDir: string;
  headless?: boolean;
  /** Framework targets to emit alongside the default css output. */
  emit?: ('next' | 'tailwind' | 'vite')[];
}

export interface OrphanFile {
  url: string;
  file: string;
}

export interface PullResult {
  outDir: string;
  faces: FontFace[];
  orphans: OrphanFile[];
  downloaded: number;
  total: number;
}

export interface CssSource {
  text: string;
  base: string;
}
