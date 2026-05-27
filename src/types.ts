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
}

export interface PullResult {
  outDir: string;
  faces: FontFace[];
  downloaded: number;
  total: number;
}

export interface CssSource {
  text: string;
  base: string;
}
