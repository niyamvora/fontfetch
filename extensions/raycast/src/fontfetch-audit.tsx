/**
 * "Audit URL" — run `fontfetch audit <url> --json` and surface the
 * AuditReport in a readable Detail view. Useful for designers checking
 * client sites before kickoff.
 */
import { ActionPanel, Action, Form, Detail, showToast, Toast, useNavigation } from "@raycast/api";
import { useState } from "react";
import { execFile } from "node:child_process";

interface AuditReport {
  passed: boolean;
  url: string;
  summary: {
    families: number;
    faces: number;
    files: number;
    totalBytes: number;
    byStatus: { open: number; commercial: number; unknown: number };
    perFamilyBytes: Record<string, number>;
  };
  violations: Array<{ type: string; message: string }>;
}

async function runAudit(url: string, maxKb: number | undefined, noCommercial: boolean): Promise<AuditReport> {
  const args = ["--yes", "fontfetch", "audit", url, "--json"];
  if (maxKb && maxKb > 0) args.push("--max-kb", String(maxKb));
  if (noCommercial) args.push("--no-commercial");
  return new Promise((resolve, reject) => {
    execFile(
      "npx",
      args,
      { timeout: 90_000, maxBuffer: 16 * 1024 * 1024 },
      (err, stdout) => {
        // The CLI exits non-zero on audit failure, but stdout still carries valid JSON.
        try {
          const report = JSON.parse(stdout) as AuditReport;
          resolve(report);
        } catch {
          reject(err ?? new Error("Could not parse audit JSON"));
        }
      },
    );
  });
}

export default function Command(): JSX.Element {
  const { push } = useNavigation();
  const [urlError, setUrlError] = useState<string | undefined>();

  async function handleSubmit(values: { url: string; maxKb: string; noCommercial: boolean }): Promise<void> {
    const url = values.url.trim();
    try {
      new URL(url);
    } catch {
      setUrlError("Enter a valid URL");
      return;
    }
    const max = values.maxKb ? Number.parseInt(values.maxKb, 10) : undefined;
    await showToast({ style: Toast.Style.Animated, title: "Auditing…" });
    try {
      const report = await runAudit(url, max, values.noCommercial);
      await showToast({
        style: report.passed ? Toast.Style.Success : Toast.Style.Failure,
        title: report.passed ? "Audit passed" : `Audit failed: ${report.violations.length} violation(s)`,
      });
      push(<ReportView report={report} />);
    } catch (e) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Audit failed",
        message: (e as Error).message,
      });
    }
  }

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Run Audit" onSubmit={handleSubmit} />
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
      <Form.TextField id="maxKb" title="Max KB (optional)" placeholder="200" />
      <Form.Checkbox id="noCommercial" label="Fail on commercial fonts" defaultValue={false} />
    </Form>
  );
}

function ReportView({ report }: { report: AuditReport }): JSX.Element {
  const status = report.passed ? "✅ Passed" : "🚨 Failed";
  const md = [
    `# fontfetch audit — ${status}`,
    "",
    `URL: ${report.url}`,
    "",
    `- Families: ${report.summary.families}`,
    `- Faces: ${report.summary.faces}`,
    `- Files: ${report.summary.files}`,
    `- Total: ${(report.summary.totalBytes / 1024).toFixed(1)} KB`,
    `- License: ${report.summary.byStatus.open} open / ${report.summary.byStatus.commercial} commercial / ${report.summary.byStatus.unknown} unknown`,
    "",
    "## Per-family bytes",
    "",
    ...Object.entries(report.summary.perFamilyBytes).map(
      ([fam, b]) => `- **${fam}** — ${(b / 1024).toFixed(1)} KB`,
    ),
  ];
  if (report.violations.length > 0) {
    md.push("", "## Violations", "");
    for (const v of report.violations) {
      md.push(`- **${v.type}** — ${v.message}`);
    }
  }
  return (
    <Detail
      markdown={md.join("\n")}
      actions={
        <ActionPanel>
          <Action.CopyToClipboard title="Copy Report JSON" content={JSON.stringify(report, null, 2)} />
        </ActionPanel>
      }
    />
  );
}
