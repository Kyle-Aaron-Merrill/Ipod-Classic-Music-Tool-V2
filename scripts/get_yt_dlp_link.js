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

import puppeteer from 'puppeteer';
import fetch from 'node-fetch'; // If Node.js version <18; if 18+, native fetch is available globally
import * as cheerio from 'cheerio';

export async function get_yt_dlp_link(url, media, album, track, puppeteerInstance = puppeteer) {
    console.log(`[yt-dlp-link] Running Function. Params: URL=${url}, Media=${media}, Album=${album}, Track=${track}`);
    let browser;

    try {
        console.debug('[yt-dlp-link] Launching Puppeteer for URL:', url);
        browser = await puppeteerInstance.launch({ headless: true });
        const page = await browser.newPage();
        page.on('console', (msg) => {
          for (let i = 0; i < msg.args().length; ++i)
            console.log(`PAGE_CONSOLE: ${i}: ${msg.args()[i]}`);
        });

        await page.goto(url, { waitUntil: 'networkidle2' });

        await page.setDefaultNavigationTimeout(0);

        // Use the updated scrollToLoadAll function
        const releases = await scrollToLoadAll(page);

        console.log('Total items after scrolling and collecting:', releases.length);
        for (const i in releases) {
            console.log(i, JSON.stringify(releases[i], null, 2));
        }

        // Assuming the first item is the album itself or you need to find it by title
        const foundAlbum = releases.find(item =>
          item.title.toLowerCase().includes(album.toLowerCase())
        );
        if (foundAlbum){
          const playlistUrl = await toPlaylistUrl(foundAlbum.url);
          console.log('[yt-dlp-link] Album URL found: ', playlistUrl, ' Searching track ', track);

          if (media === 'track') {
            if (foundAlbum) {
                const foundTrackUrl = await getTrackUrl(playlistUrl, track);
                console.log('[yt-dlp-link] Track URL found: ' + foundTrackUrl);
                return foundTrackUrl;
            } else {
                console.warn('[yt-dlp-link] Track title not matched or not found in playlist');
                await browser.close();
                return null;
            }
          }
  
          if (media === 'album') {
            if (foundAlbum) {
                console.log('[yt-dlp-link] Album match found:', playlistUrl);
                await browser.close();
                return playlistUrl; // Or the URL of the first track if that's the desired behavior
            } else {
                console.warn('[yt-dlp-link] Album title not matched or not found in collected releases');
                await browser.close();
                return null;
            }
          }
        }
        else{
          console.warn('[yt-dlp-link] Album not found in collected releases');
          return null;
        }

        await browser.close();
        return null;

    } catch (err) {
        console.error('[yt-dlp-link] Error occurred:', err);
        if (browser) await browser.close();
        return null;
    }
}

async function toPlaylistUrl(watchUrl) {
  const url = new URL(watchUrl);
  const listId = url.searchParams.get('list');
  if (!listId) return null;
  console.log(`https://www.youtube.com/playlist?list=${listId}`);
  return 'https://www.youtube.com/playlist?list=' + listId;
}

async function scrollToLoadAll(page, scrollDelay = 500, continuationTimeout = 20000, maxScrolls = 100) {
  let scrolls = 0;
  const collectedItems = new Map();
  const itemSelector = 'ytd-rich-item-renderer';
  const continuationSelector = 'ytd-continuation-item-renderer';
  const contentsSelector = 'div#contents';

  console.log(`[scrollToLoadAll] Starting scroll with maxScrolls=${maxScrolls}, scrollDelay=${scrollDelay}ms, waiting for continuation element "${continuationSelector}" to be removed from DOM (timeout: ${continuationTimeout}ms)`);

  // Initial collection
  try {
      await page.waitForSelector(itemSelector, { timeout: 10000 });
      const initialItems = await page.$$(itemSelector);
      console.log(`[scrollToLoadAll] Initial count: ${initialItems.length}`);

      const itemsData = await page.$$eval(itemSelector, elements => {
          return elements.map(el => {
              const title = el.querySelector('yt-formatted-string#video-title')?.textContent.trim() || '';
              const url = el.querySelector('#video-title-link')?.href || '';
              return { title, url };
          });
      });

      itemsData.forEach(item => {
           if (item.url) {
               collectedItems.set(item.url, item);
           }
      });
      console.log(`[scrollToLoadAll] Collected ${collectedItems.size} unique items initially.`);

       // Check if initial count is 0, but allow one scroll attempt
      if (collectedItems.size === 0 && initialItems.length > 0) {
           console.warn("[scrollToLoadAll] Initial unique count is 0 despite finding items. URLs might be missing or duplicate.");
      } else if (initialItems.length === 0) {
          console.warn("[scrollToLoadAll] Initial count is 0, no items found on the page initially.");
          return Array.from(collectedItems.values()); // Exit if no items found at all
      }


  } catch (error) {
       console.error(`[scrollToLoadAll] Failed during initial item collection or wait. Error: ${error.message}`);
       // Attempt to scroll even if initial collection had issues, if the base item selector is valid.
  }


  while (scrolls < maxScrolls) {
      const initialItemCountInLoop = await page.$$eval(itemSelector, elements => elements.length);
      console.log(`[scrollToLoadAll] Scroll #${scrolls + 1}: Current item count before scroll: ${initialItemCountInLoop}. Checking for continuation element...`);

      const continuationElement = await page.$(continuationSelector);

      if (!continuationElement) {
          console.log(`[scrollToLoadAll] Continuation element "${continuationSelector}" not found. Assuming end of content.`);
          break; // Stop if no continuation element is found
      }

      // MODIFIED: Scroll the continuation element specifically into view
      console.log(`[scrollToLoadAll] Scrolling continuation element into view...`);
      try {
          await continuationElement.scrollIntoView();
          // Add a brief pause after scrolling the element into view
           await new Promise(resolve => setTimeout(resolve, scrollDelay));
      } catch (error) {
          console.warn(`[scrollToLoadAll] Failed to scroll continuation element into view. Error: ${error.message}`);
           // If we can't scroll it into view, we probably can't trigger loading, so break.
          break;
      }


      // Wait ONLY for the continuation element to be gone
      let continuationRemoved = false;
      try {
           console.log(`[scrollToLoadAll] Waiting for continuation element "${continuationSelector}" to be removed from DOM (polling: 500ms)...`);
           await page.waitForFunction(
              (sel) => {
                  const el = document.querySelector(sel);
                  const isGone = !el;
                   // Add console log inside the function for debugging
                  // console.log(`[waitForFunction - Continuation Wait] Element found: ${!!el}, Condition met: ${isGone}`);
                   return isGone; // ONLY wait for element to be gone
              },
              { timeout: continuationTimeout, polling: 500 }, // Increased polling interval
              continuationSelector
          );
           console.log(`[scrollToLoadAll] Continuation element removed from DOM.`);
           continuationRemoved = true;

      } catch (error) {
           console.warn(`[scrollToLoadAll] Timeout waiting for continuation element to be removed. Error: ${error.message}`);
           // If the continuation element isn't removed, assume no more content was loaded via this trigger.
      }

       // Small pause after waiting for stability
      await new Promise(resolve => setTimeout(resolve, 500));

      // Collect ALL current items again and find new unique ones
      console.log(`[scrollToLoadAll] Collecting items after scroll #${scrolls + 1}...`);
      const currentItemsData = await page.$$eval(itemSelector, elements => {
          return elements.map(el => {
              const title = el.querySelector('yt-formatted-string#video-title')?.textContent.trim() || '';
              const url = el.querySelector('#video-title-link')?.href || '';
              return { title, url };
          });
      });

      const initialCollectedSize = collectedItems.size;
      let itemsAddedInThisScroll = 0;

      currentItemsData.forEach(item => {
           if (item.url && !collectedItems.has(item.url)) {
               collectedItems.set(item.url, item);
               itemsAddedInThisScroll++;
           }
      });

      const finalItemCountInLoop = currentItemsData.length; // Check the actual count collected

      console.log(`[scrollToLoadAll] Scroll #${scrolls + 1}: Added ${itemsAddedInThisScroll} new unique items. Total unique items collected: ${collectedItems.size}. Total items collected from DOM in this pass: ${finalItemCountInLoop}`);

      // Check if the item count actually increased after the scroll and wait cycle, regardless of wait success
       if (finalItemCountInLoop > initialItemCountInLoop) {
           console.log(`[scrollToLoadAll] Item count increased from ${initialItemCountInLoop} to ${finalItemCountInLoop}.`);
       } else {
           console.log(`[scrollToLoadAll] Item count did NOT increase from ${initialItemCountInLoop}.`);
       }


      // Stop condition:
      // If the continuation element was present at the start of the loop, BUT it was not removed AND no new unique items were added.
      // If the continuation element was NOT found at the start of the loop, the loop already breaks.
       if (!continuationRemoved && itemsAddedInThisScroll === 0) {
           console.log(`[scrollToLoadAll] Continuation element was not removed within timeout, and no new unique items were added. Assuming end of content.`);
           break;
       }

      // Fallback stop condition: If max scrolls reached
      if (scrolls >= maxScrolls - 1) {
           console.log(`[scrollToLoadAll] Max scrolls (${maxScrolls}) reached. Exiting.`);
           break;
      }

      scrolls++;
  }

  console.log(`[scrollToLoadAll] Finished. Total unique items collected: ${collectedItems.size}`);
  return Array.from(collectedItems.values());
}

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function getTrackUrl(playlistUrl, trackName) {
  const pythonScript = path.join(__dirname, 'get_track_url.py');

  console.log('[getTrackUrl] Starting...');
  console.log('[getTrackUrl] Python script path:', pythonScript);
  console.log('[getTrackUrl] Playlist URL:', playlistUrl);
  console.log('[getTrackUrl] Track name:', trackName);

  return new Promise((resolve, reject) => {
    console.log('[getTrackUrl] Spawning python process...');
    const process = spawn('python', [pythonScript, playlistUrl, trackName]);

    let result = '';
    let error = '';

    process.stdout.on('data', (data) => {
      const dataStr = data.toString();
      console.log('[getTrackUrl] stdout:', dataStr.trim());
      result += dataStr;
    });

    process.stderr.on('data', (data) => {
      const dataStr = data.toString();
      console.error('[getTrackUrl] stderr:', dataStr.trim());
      error += dataStr;
    });

    process.on('close', (code) => {
      console.log(`[getTrackUrl] Python process exited with code ${code}`);
      if (code !== 0 || error) {
        console.error('[getTrackUrl] Python error:', error || `Process exited with code ${code}`);
        reject(error || `Process exited with code ${code}`);
      } else {
        try {
          const json = JSON.parse(result);
          console.log('[getTrackUrl] Parsed JSON result:', json);
          resolve(json.url);
        } catch (e) {
          console.error('[getTrackUrl] Failed to parse JSON from Python output:', e);
          reject('[getTrackUrl] Failed to parse JSON from Python output');
        }
      }
    });

    process.on('error', (err) => {
      console.error('[getTrackUrl] Failed to start Python process:', err);
      reject(err);
    });
  });
}
