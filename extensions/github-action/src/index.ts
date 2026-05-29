/**
 * fontfetch-action — GitHub Action entry point.
 *
 * Runs `fontfetch audit <url> [flags] --json` on the requested URL,
 * surfaces the AuditReport as Action outputs, and optionally posts a PR
 * comment with the verdict + a per-family table. Non-zero exit when any
 * configured rule fails so the workflow goes red on font drift.
 *
 * Distributed via:
 *   uses: niyamvora/fontfetch-action@v1
 *   with:
 *     url: https://staging.acme.com
 *     max-kb: 200
 *     no-commercial: 'true'
 *
 * The action wraps the published `fontfetch` CLI rather than reimplementing
 * the audit logic — staying thin keeps it in lockstep with future
 * @fontfetch/core releases.
 */
import { execFileSync } from 'node:child_process';
import * as core from '@actions/core';
import * as github from '@actions/github';
import type { AuditReport } from 'fontfetch';

interface ActionInputs {
  url: string;
  maxKb: string;
  perFamilyKb: string;
  noCommercial: boolean;
  comment: boolean;
  githubToken: string;
  fontfetchVersion: string;
}

function readInputs(): ActionInputs {
  return {
    url: core.getInput('url', { required: true }),
    maxKb: core.getInput('max-kb'),
    perFamilyKb: core.getInput('per-family-kb'),
    noCommercial: core.getBooleanInput('no-commercial'),
    comment: core.getBooleanInput('comment'),
    githubToken: core.getInput('github-token'),
    fontfetchVersion: core.getInput('fontfetch-version') || 'latest',
  };
}

function buildArgs(inputs: ActionInputs): string[] {
  const args = ['audit', inputs.url, '--json'];
  if (inputs.maxKb) args.push('--max-kb', inputs.maxKb);
  if (inputs.perFamilyKb) args.push('--per-family-kb', inputs.perFamilyKb);
  if (inputs.noCommercial) args.push('--no-commercial');
  return args;
}

function runFontfetch(version: string, args: string[]): { stdout: string; exitCode: number } {
  const spec = version === 'latest' ? 'fontfetch' : `fontfetch@${version}`;
  try {
    const stdout = execFileSync('npx', ['--yes', spec, ...args], {
      encoding: 'utf-8',
      maxBuffer: 16 * 1024 * 1024,
    });
    return { stdout, exitCode: 0 };
  } catch (err) {
    const e = err as { status?: number; stdout?: Buffer | string };
    const stdout = typeof e.stdout === 'string' ? e.stdout : e.stdout?.toString() ?? '';
    return { stdout, exitCode: e.status ?? 1 };
  }
}

function renderComment(report: AuditReport): string {
  const status = report.passed ? '✅ **Passed**' : '🚨 **Failed**';
  const lines: string[] = [];
  lines.push(`### fontfetch audit — ${status}`);
  lines.push('');
  lines.push(`URL: ${report.url}`);
  lines.push('');
  lines.push(`- Families: ${report.summary.families}`);
  lines.push(`- Faces: ${report.summary.faces}`);
  lines.push(`- Files: ${report.summary.files}`);
  lines.push(`- Total: ${(report.summary.totalBytes / 1024).toFixed(1)} KB`);
  lines.push(
    `- License: ${report.summary.byStatus.open} open / ${report.summary.byStatus.commercial} commercial / ${report.summary.byStatus.unknown} unknown`,
  );
  if (report.violations.length > 0) {
    lines.push('');
    lines.push('#### Violations');
    lines.push('');
    for (const v of report.violations) {
      lines.push(`- **${v.type}** — ${v.message}`);
    }
  }
  return lines.join('\n');
}

async function postComment(token: string, body: string): Promise<void> {
  const ctx = github.context;
  const pr = ctx.payload.pull_request;
  if (!pr) {
    core.info('Not running in a pull request context; skipping comment.');
    return;
  }
  const octokit = github.getOctokit(token);
  await octokit.rest.issues.createComment({
    owner: ctx.repo.owner,
    repo: ctx.repo.repo,
    issue_number: pr.number,
    body,
  });
}

async function main(): Promise<void> {
  const inputs = readInputs();
  const args = buildArgs(inputs);
  core.info(`Running: npx fontfetch ${args.join(' ')}`);
  const { stdout, exitCode } = runFontfetch(inputs.fontfetchVersion, args);

  let report: AuditReport;
  try {
    report = JSON.parse(stdout);
  } catch (e) {
    core.setFailed(`Could not parse fontfetch output as JSON: ${(e as Error).message}\n\nstdout:\n${stdout}`);
    return;
  }

  core.setOutput('passed', String(report.passed));
  core.setOutput('total-kb', String(Math.round(report.summary.totalBytes / 1024)));
  core.setOutput(
    'families',
    Object.keys(report.summary.perFamilyBytes).join(','),
  );
  core.setOutput('report-json', JSON.stringify(report));

  const commentBody = renderComment(report);
  core.summary.addRaw(commentBody).write();

  if (inputs.comment && inputs.githubToken) {
    try {
      await postComment(inputs.githubToken, commentBody);
    } catch (e) {
      core.warning(`Could not post PR comment: ${(e as Error).message}`);
    }
  }

  if (!report.passed) {
    core.setFailed(`fontfetch audit failed with ${report.violations.length} violation(s).`);
    process.exitCode = exitCode || 1;
  }
}

main().catch((e) => core.setFailed((e as Error).message));
