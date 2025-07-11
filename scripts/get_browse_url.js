/**
 * Copyright (c) 2025 Kyle Aaron Merrill
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

const puppeteer = require('puppeteer');

async function get_browse_url(urlString) {
  let input = urlString || 'Link https://music.youtube.com/browse/MPREb_qhNIvcOiQ8i';

  console.log('[DEBUG] Original input:', input);
  debugger;

  // Remove the 'Link ' prefix (if it exists)
  if (input.startsWith('Link ')) {
    input = input.slice(5);  // removes first 5 characters "Link "
    console.log('[DEBUG] Removed "Link " prefix, input is now:', input);
    debugger;
  }

  let urlObj;
  try {
    urlObj = new URL(input);
    console.log('[DEBUG] Parsed URL:', urlObj.href);
    debugger;
  } catch (e) {
    console.error('[ERROR] Invalid URL:', input);
    throw e;
  }

  const browseUrl = urlObj.pathname + urlObj.search + urlObj.hash;
  console.log('[DEBUG] Extracted browse URL path:', browseUrl);
  debugger;

  const browser = await puppeteer.launch({ headless: true, defaultViewport: null });
  const page = await browser.newPage();

  // Optional: set user agent to a popular browser one
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
    'AppleWebKit/537.36 (KHTML, like Gecko) ' +
    'Chrome/114.0.0.0 Safari/537.36'
  );

  // Disable cache and service workers to prevent stale content
  await page.setCacheEnabled(false);
  await page.evaluateOnNewDocument(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations()
        .then(regs => regs.forEach(reg => reg.unregister()));
    }
  });

  try {
    console.log('[DEBUG] Navigating directly to full browse URL:', urlObj.href);
    await page.goto(urlObj.href, { waitUntil: 'domcontentloaded', timeout: 30000 });

    const finalUrl = page.url();
    console.log('[DEBUG] Final loaded URL:', finalUrl);
    await browser.close();
    return finalUrl;
  } catch (err) {
    console.error('[ERROR] Puppeteer navigation error:', err);
    await browser.close();
    throw err;
  }
}

module.exports = { get_browse_url };
