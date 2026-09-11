import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as Handlebars from 'handlebars';
import puppeteer, { Browser } from 'puppeteer';

@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);
  private browser: Browser | null = null;

  // Держим один браузер на весь процесс — открывать новый на каждый документ дорого
  private async getBrowser(): Promise<Browser> {
    if (!this.browser || !this.browser.connected) {
      this.browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
    }
    return this.browser;
  }

  private loadTemplate(templateFileName: string): HandlebarsTemplateDelegate {
    const filePath = path.join(__dirname, 'templates', templateFileName);
    const source = fs.readFileSync(filePath, 'utf-8');
    return Handlebars.compile(source);
  }

  async renderHtml(
    templateFileName: string,
    data: Record<string, unknown>,
  ): Promise<string> {
    const template = this.loadTemplate(templateFileName);
    return template(data);
  }

  async htmlToPdfBuffer(html: string): Promise<Buffer> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    try {
      await page.setContent(html, { waitUntil: 'load' });
      const pdfUint8Array = await page.pdf({
        format: 'A4',
        printBackground: true,
      });
      return Buffer.from(pdfUint8Array);
    } finally {
      await page.close();
    }
  }

  async generatePdf(
    templateFileName: string,
    data: Record<string, unknown>,
  ): Promise<Buffer> {
    const html = await this.renderHtml(templateFileName, data);
    return this.htmlToPdfBuffer(html);
  }
}
