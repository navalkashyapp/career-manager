import { chromium } from 'playwright';

export class PdfGeneratorService {
  /**
   * Normalize text for ATS compatibility by converting problematic Unicode.
   * Adapted from career-ops/generate-pdf.mjs
   */
  private static normalizeTextForATS(html: string): string {
    const masks: string[] = [];
    const masked = html.replace(
      /<(style|script)\b[^>]*>[\s\S]*?<\/\1>/gi,
      (match) => {
        const token = `\u0000MASK${masks.length}\u0000`;
        masks.push(match);
        return token;
      }
    );

    let out = '';
    let i = 0;
    while (i < masked.length) {
      const lt = masked.indexOf('<', i);
      if (lt === -1) { out += this.sanitizeText(masked.slice(i)); break; }
      out += this.sanitizeText(masked.slice(i, lt));
      const gt = masked.indexOf('>', lt);
      if (gt === -1) { out += masked.slice(lt); break; }
      out += masked.slice(lt, gt + 1);
      i = gt + 1;
    }

    const restored = out.replace(/\u0000MASK(\d+)\u0000/g, (_, n) => masks[Number(n)]);
    return restored;
  }

  private static sanitizeText(text: string): string {
    if (!text) return text;
    let t = text;
    t = t.replace(/\u2014/g, '-'); // em-dash
    t = t.replace(/\u2013/g, '-'); // en-dash
    t = t.replace(/[\u201C\u201D\u201E\u201F]/g, '"'); // smart double quotes
    t = t.replace(/[\u2018\u2019\u201A\u201B]/g, "'"); // smart single quotes
    t = t.replace(/\u2026/g, '...'); // ellipsis
    t = t.replace(/[\u200B\u200C\u200D\u2060\uFEFF]/g, ''); // zero-width
    t = t.replace(/\u00A0/g, ' '); // nbsp
    t = t.replace(/\s*\u2192\s*/g, ' to '); // right-arrow
    t = t.replace(/\s*\u2190\s*/g, ' from '); // left-arrow
    t = t.replace(/\s*[\u2191\u2193]\s*/g, ' '); // vert-arrow
    t = t.replace(/\s*\u00B7\s*/g, ' | '); // middot
    t = t.replace(/\s*\u2022\s*/g, ' | '); // bullet
    return t;
  }

  /**
   * Generates a PDF buffer from HTML content.
   * 
   * @param htmlContent The HTML string to render
   * @returns A Buffer containing the PDF data
   */
  public static async generatePdf(htmlContent: string): Promise<Buffer> {
    const normalizedHtml = this.normalizeTextForATS(htmlContent);
    
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      
      await page.setContent(normalizedHtml, { waitUntil: 'networkidle' });

      // Apply some basic print styles if not already present
      await page.addStyleTag({
        content: `
          @page { margin: 0.6in; }
          body { font-family: sans-serif; }
          a { text-decoration: none; color: black; }
        `
      });

      const pdfBuffer = await page.pdf({
        format: 'Letter',
        printBackground: true,
        displayHeaderFooter: false
      });

      return pdfBuffer;
    } catch (error) {
      console.error('Failed to generate PDF:', error);
      throw new Error(`PDF generation failed: ${(error as Error).message}`);
    } finally {
      await browser.close();
    }
  }
}
