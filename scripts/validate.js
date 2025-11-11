// Node script to validate title, meta description length, and JSON-LD structured data
import { request } from 'undici';
import { JSDOM } from 'jsdom';
import { AllValidators } from 'structured-data-testing-tool';

import fs from 'fs/promises';

const urls = (await fs.readFile('config/urls.txt', 'utf8'))
  .split('\n')
  .map((s) => s.trim())
  .filter(Boolean);

let hasErrors = false;

for (const url of urls) {
  try {
    const res = await request(url);
    const html = await res.body.text();
    const dom = new JSDOM(html);
    const d = dom.window.document;

    const title = d.querySelector('title')?.textContent?.trim() || '';
    const metaDesc =
      d.querySelector('meta[name="description"]')?.getAttribute('content') || '';
    if (title.length < 30 || title.length > 65) {
      console.log(`WARN [${url}] Title length ${title.length} (recommended: ~50–60 characters).`);
    }
    if (metaDesc.length < 110 || metaDesc.length > 170) {
      console.log(
        `WARN [${url}] Meta description length ${metaDesc.length} (recommended: ~120–155 characters).`
      );
    }

    // JSON-LD blocks
    const jsonLd = [...d.querySelectorAll('script[type="application/ld+json"]')]
      .map((s) => s.textContent)
      .join('\n');
    if (jsonLd) {
      try {
        const data = JSON.parse(jsonLd);
        const { results } = await AllValidators(data, url);
        const failures = results.filter((r) => r.status !== 'passed');
        failures.forEach((f) => {
          console.log(`SCHEMA ${f.status} [${url}] ${f.name}: ${f.description}`);
        });
        if (failures.length) hasErrors = true;
      } catch (e) {
        console.log(`SCHEMA ERROR [${url}] invalid JSON-LD: ${e.message}`);
        hasErrors = true;
      }
    } else {
      console.log(`WARN [${url}] No JSON-LD found`);
    }
  } catch (error) {
    console.error(`ERROR fetching ${url}:`, error.message);
    hasErrors = true;
  }
}

if (hasErrors) {
  process.exit(1);
}
