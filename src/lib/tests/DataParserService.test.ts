import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DataParserService } from '../services/DataParserService';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('DataParserService Path Traversal Protection', () => {
  let tempDir: string;
  let service: DataParserService;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'career-ops-test-'));
    service = new DataParserService(tempDir);
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('allows reading valid files inside the base directory', () => {
    const testFile = 'test.md';
    fs.writeFileSync(path.join(tempDir, testFile), '---\ntitle: Safe\n---\nHello World');
    const result = service.parseMarkdown(testFile);
    expect(result.metadata.title).toBe('Safe');
    expect(result.content).toBe('Hello World');
  });

  it('rejects path traversal attempts with ../ in parseMarkdown', () => {
    expect(() => {
      service.parseMarkdown('../../etc/passwd');
    }).toThrow('Access denied: path traversal detected');
  });

  it('rejects path traversal attempts with ../ in parseYaml', () => {
    expect(() => {
      service.parseYaml('../../etc/hosts');
    }).toThrow('Access denied: path traversal detected');
  });

  it('rejects path traversal attempts with ../ in writeContent', () => {
    expect(() => {
      service.writeContent('../escaped.txt', 'malicious content');
    }).toThrow('Access denied: path traversal detected');
  });
});
