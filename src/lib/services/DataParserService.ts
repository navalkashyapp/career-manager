import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

export class DataParserService {
  private baseDir: string;

  constructor(baseDir: string) {
    this.baseDir = baseDir;
  }

  /**
   * Resolves a relative path against baseDir, preventing path traversal outside the base directory.
   */
  private resolveSafePath(filePath: string): string {
    const resolvedBase = path.resolve(this.baseDir);
    const resolvedPath = path.resolve(this.baseDir, filePath);
    if (!resolvedPath.startsWith(resolvedBase + path.sep) && resolvedPath !== resolvedBase) {
      throw new Error(`Access denied: path traversal detected for "${filePath}"`);
    }
    return resolvedPath;
  }

  /**
   * Reads a markdown file and parses YAML frontmatter if it exists.
   */
  public parseMarkdown(filePath: string): any {
    const fullPath = this.resolveSafePath(filePath);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`File not found: ${fullPath}`);
    }

    const content = fs.readFileSync(fullPath, 'utf8');
    const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
    const match = content.match(frontmatterRegex);

    if (match) {
      try {
        const metadata = yaml.load(match[1]);
        return {
          metadata,
          content: match[2].trim(),
        };
      } catch (e) {
        throw new Error(`Failed to parse YAML frontmatter in ${filePath}: ${e}`);
      }
    }

    return { metadata: {}, content: content.trim() };
  }

  /**
   * Reads a plain YAML file.
   */
  public parseYaml(filePath: string): any {
    const fullPath = this.resolveSafePath(filePath);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`File not found: ${fullPath}`);
    }

    const content = fs.readFileSync(fullPath, 'utf8');
    try {
      return yaml.load(content);
    } catch (e) {
      throw new Error(`Failed to parse YAML file ${filePath}: ${e}`);
    }
  }

  /**
   * Writes content back to a file.
   */
  public writeContent(filePath: string, content: string): void {
    const fullPath = this.resolveSafePath(filePath);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(fullPath, content, 'utf8');
  }
}
