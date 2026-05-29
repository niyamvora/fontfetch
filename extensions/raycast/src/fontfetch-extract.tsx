/**
 * "Extract Fonts from URL" — paste a URL, run fontfetch via npx, parse the
 * resulting fonts.css + provenance.json, show the families + per-family
 * file count, copy the @font-face block to clipboard on submit.
 */
import { ActionPanel, Action, Form, Detail, showToast, Toast, Clipboard, useNavigation } from "@raycast/api";
import { useState } from "react";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";

const execFileP = promisify(execFile);

interface ExtractionResult {
  outDir: string;
  fontsCss: string;
  families: string[];
  totalKb: number;
}

async function runFontfetch(url: string): Promise<ExtractionResult> {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "fontfetch-raycast-"));
  await execFileP("npx", ["--yes", "fontfetch", url, tmp], {
    timeout: 90_000,
    maxBuffer: 16 * 1024 * 1024,
  });
  const hostDirs = await fs.readdir(tmp);
  if (hostDirs.length === 0) throw new Error("fontfetch produced no output directory");
  const outDir = path.join(tmp, hostDirs[0]);
  const fontsCss = await fs.readFile(path.join(outDir, "fonts.css"), "utf-8");
  const fontsJson = JSON.parse(await fs.readFile(path.join(outDir, "fonts.json"), "utf-8"));
  type ProvenanceFile = { bytes: number | null };
  type ProvenanceFace = { family: string; files: ProvenanceFile[] };
  const provenance = JSON.parse(
    await fs.readFile(path.join(outDir, "provenance.json"), "utf-8"),
  ) as { faces: ProvenanceFace[] };
  const families = [...new Set<string>(provenance.faces.map((f: ProvenanceFace) => f.family))];
  const totalBytes = provenance.faces.reduce(
    (acc: number, f: ProvenanceFace) =>
      acc + f.files.reduce((s: number, file: ProvenanceFile) => s + (file.bytes ?? 0), 0),
    0,
  );
  void fontsJson;
  return { outDir, fontsCss, families, totalKb: totalBytes / 1024 };
}

export default function Command(): JSX.Element {
  const { push } = useNavigation();
  const [urlError, setUrlError] = useState<string | undefined>();

  async function handleSubmit(values: { url: string }): Promise<void> {
    const url = values.url.trim();
    try {
      new URL(url);
    } catch {
      setUrlError("Enter a valid URL");
      return;
    }
    await showToast({ style: Toast.Style.Animated, title: "Extracting fonts…" });
    try {
      const result = await runFontfetch(url);
      await Clipboard.copy(result.fontsCss);
      await showToast({
        style: Toast.Style.Success,
        title: "CSS copied to clipboard",
        message: `${result.families.length} families, ${result.totalKb.toFixed(1)} KB`,
      });
      push(<ResultView result={result} />);
    } catch (e) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Extraction failed",
        message: (e as Error).message,
      });
    }
  }

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Extract Fonts" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.TextField
        id="url"
        title="URL"
        placeholder="https://example.com"
        error={urlError}
        onChange={() => setUrlError(undefined)}
      />
    </Form>
  );
}

function ResultView({ result }: { result: ExtractionResult }): JSX.Element {
  const markdown = [
    "# fontfetch — extraction complete",
    "",
    `**${result.families.length} families, ${result.totalKb.toFixed(1)} KB**`,
    "",
    ...result.families.map((f) => `- ${f}`),
    "",
    "## `fonts.css`",
    "",
    "```css",
    result.fontsCss.slice(0, 4000),
    result.fontsCss.length > 4000 ? "/* …truncated */" : "",
    "```",
  ].join("\n");
  return (
    <Detail
      markdown={markdown}
      actions={
        <ActionPanel>
          <Action.CopyToClipboard title="Copy fonts.css" content={result.fontsCss} />
          <Action.OpenWith title="Open Output Folder" path={result.outDir} />
        </ActionPanel>
      }
    />
  );
}
