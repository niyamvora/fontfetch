import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ClassifiedFace } from '../src/license/license.js';
import type { InspectionReport } from '../src/inspect/inspect.js';

const inspectMock = vi.hoisted(() => vi.fn());

vi.mock('../src/inspect/inspect.js', async () => {
  const actual = await vi.importActual<typeof import('../src/inspect/inspect.js')>(
    '../src/inspect/inspect.js',
  );
  return { ...actual, inspect: inspectMock };
});

const { crossRefLicenseFromBinaries } = await import('../src/license/binary-license.js');

function face(family: string, localFile: string): ClassifiedFace {
  return {
    face: {
      family,
      weight: '400',
      style: 'normal',
      display: null,
      unicodeRange: null,
      sources: [
        { url: `https://cdn.example.com/${localFile}`, format: 'woff2', localFile },
      ],
    },
    classification: { status: 'unknown', reason: 'No matching CDN or known-family signature' },
  };
}

function inspectionReport(overrides: Partial<InspectionReport['license']> = {}): InspectionReport {
  return {
    filePath: '/dummy',
    format: 'woff2',
    bytes: 0,
    familyName: 'Dummy',
    subfamilyName: null,
    fullName: null,
    postscriptName: null,
    copyright: null,
    designer: null,
    vendor: null,
    version: null,
    glyphCount: 0,
    unitsPerEm: 0,
    isVariable: false,
    variationAxes: [],
    features: [],
    scripts: [],
    isFixedPitch: false,
    license: { description: null, url: null, isOFL: false, hasRFN: false, ...overrides },
  };
}

describe('crossRefLicenseFromBinaries', () => {
  let tmpDir: string;

  beforeEach(async () => {
    inspectMock.mockReset();
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fontfetch-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  async function writeStub(localFile: string): Promise<void> {
    const full = path.join(tmpDir, localFile);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, 'stub');
  }

  it('promotes unknown → open when the binary self-declares OFL', async () => {
    await writeStub('google/Inter.woff2');
    inspectMock.mockResolvedValueOnce(
      inspectionReport({ isOFL: true, url: 'https://openfontlicense.org' }),
    );
    const out = await crossRefLicenseFromBinaries([face('Inter', 'google/Inter.woff2')], tmpDir);
    expect(out[0].classification.status).toBe('open');
    expect(out[0].classification.reason).toMatch(/OFL/);
    expect(out[0].classification.reason).toMatch(/openfontlicense\.org/);
  });

  it('keeps unknown when the binary does not self-declare OFL', async () => {
    await writeStub('self-hosted/Mystery.woff2');
    inspectMock.mockResolvedValueOnce(inspectionReport({ isOFL: false }));
    const out = await crossRefLicenseFromBinaries(
      [face('Mystery', 'self-hosted/Mystery.woff2')],
      tmpDir,
    );
    expect(out[0].classification.status).toBe('unknown');
  });

  it('never demotes a commercial classification', async () => {
    await writeStub('adobe-typekit/Sohne.woff2');
    inspectMock.mockResolvedValueOnce(inspectionReport({ isOFL: true })); // Even with OFL self-claim
    const input: ClassifiedFace = {
      ...face('Söhne', 'adobe-typekit/Sohne.woff2'),
      classification: { status: 'commercial', reason: 'Served from Adobe Typekit' },
    };
    const out = await crossRefLicenseFromBinaries([input], tmpDir);
    expect(out[0].classification.status).toBe('commercial');
    expect(out[0].classification.reason).toBe('Served from Adobe Typekit');
  });

  it('attaches hasRFN when the binary carries the RFN clause, even for already-open classifications', async () => {
    await writeStub('google/Inter.woff2');
    inspectMock.mockResolvedValueOnce(inspectionReport({ isOFL: true, hasRFN: true }));
    const input: ClassifiedFace = {
      ...face('Inter', 'google/Inter.woff2'),
      classification: { status: 'open', reason: 'Served from Google Fonts' },
    };
    const out = await crossRefLicenseFromBinaries([input], tmpDir);
    expect(out[0].classification.status).toBe('open');
    expect(out[0].classification.hasRFN).toBe(true);
  });

  it('leaves classification untouched when the binary is missing from disk', async () => {
    const input = face('Phantom', 'self-hosted/Phantom.woff2');
    const out = await crossRefLicenseFromBinaries([input], tmpDir);
    expect(out[0]).toStrictEqual(input);
    expect(inspectMock).not.toHaveBeenCalled();
  });

  it('leaves classification untouched when fontkit fails to parse', async () => {
    await writeStub('self-hosted/Broken.woff2');
    inspectMock.mockRejectedValueOnce(new Error('fontkit could not parse'));
    const input = face('Broken', 'self-hosted/Broken.woff2');
    const out = await crossRefLicenseFromBinaries([input], tmpDir);
    expect(out[0].classification.status).toBe('unknown');
    expect(out[0].classification.hasRFN).toBeUndefined();
  });
});
