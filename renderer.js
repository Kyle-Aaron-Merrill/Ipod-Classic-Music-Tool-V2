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
import { setupDragAndDrop } from './scripts/dnd.js';
import { linkConverter } from './scripts/yt_link_converter.js';

window.addEventListener('DOMContentLoaded', () => {
  console.debug('[Renderer] DOM fully loaded. Initializing drag-and-drop.');
  setupDragAndDrop();
});

// DOM Elements
const ytLinkInput = document.getElementById('yt-link');
const ytButton = document.getElementById('yt-button');
const btnSearch = document.getElementById('btn-search');
const btnDownloads = document.getElementById('btn-downloads');

const progressBar = document.getElementById('progress-bar');
const totalProgressBar = document.getElementById('total-progress-bar');

const terminalContainer = document.getElementById('terminal-container');
const terminal = document.getElementById('terminal');

let totalLinks = 0;
let completedLinks = 0;
let processingLinks = [];

/**
 * Append message to terminal
 */
function appendTerminal(text) {
  terminal.textContent += `${text}\n`;
  terminal.scrollTop = terminal.scrollHeight;
  console.debug('[Renderer] Appended to terminal:', text);
}

/**
 * Extract all "Link ..." entries from terminal
 */
function getLinksFromTerminal() {
  const content = terminal.tagName === 'TEXTAREA' || terminal.tagName === 'INPUT'
    ? terminal.value
    : terminal.textContent;

  return content.split('\n').filter(line => line.startsWith('Link ')).map(line => line.replace('Link ', '').trim());
}

/**
 * Handle YouTube Link Processing
 */
ytButton.onclick = async () => {
  processingLinks = getLinksFromTerminal();
  totalLinks = processingLinks.length;
  completedLinks = 0;
  totalProgressBar.max = totalLinks;
  totalProgressBar.value = 0;

  if (totalLinks === 0) {
    appendTerminal('❌ No URLs found in terminal.');
    return;
  }

  appendTerminal(`🔍 Processing ${totalLinks} links...`);
  console.log('Processing links:', processingLinks);

  for (const rawLink of processingLinks) {
    try {
      const finalUrl = rawLink.includes('browse')
        ? await window.electronAPI.getBrowseUrl(rawLink)
        : rawLink;

      console.log('Resolved URL:', finalUrl);

      const processInfo = await linkConverter(finalUrl);

      const ytUrl = await window.electronAPI.runProcessLink(
        processInfo.cleanedLink,
        processInfo.service,
        processInfo.media
      );

      if (ytUrl) {
        appendTerminal(`✅ Found YouTube URL: ${ytUrl}`);
      } else {
        appendTerminal(`⚠️ No YouTube URL found for: ${processInfo.cleanedLink}`);
      }

    } catch (error) {
      console.error('Error processing link:', error);
      appendTerminal(`❌ Error processing link: ${rawLink}`);
    }
  }

  progressBar.value = 1;
  console.debug('[Renderer] Metadata and conversion complete.');
};

/**
 * Event Listener for processing results from main process
 */
window.electronAPI.onProcessLinkResult((_event, { success, url, error }) => {
  // Remove line from terminal
  const lines = terminal.textContent.split('\n');
  const updated = lines.filter(line => !line.includes(`Link ${url}`));
  terminal.textContent = updated.join('\n');

  completedLinks++;
  totalProgressBar.value = completedLinks;

  if (success) {
    appendTerminal(`🎵 Done: ${url}`);
  } else {
    appendTerminal(`❌ Failed: ${url} (${error || 'Unknown error'})`);
  }

  if (completedLinks === totalLinks) {
    appendTerminal(`🎉 All ${totalLinks} links processed.`);
  }
});

/**
 * YouTube Music button handler
 */
btnSearch.onclick = () => {
  console.debug('[Renderer] Opening YouTube Music...');
  window.open("https://music.youtube.com/", "_blank");
  appendTerminal("🎧 Opening YouTube Music...");
};

/**
 * Downloads button handler
 */
btnDownloads.onclick = () => {
  console.debug('[Renderer] Requesting downloads folder...');
  window.electronAPI.openDownloadsFolder()
    .then(result => {
      if (result) {
        appendTerminal(`❌ Failed to open folder: ${result}`);
      } else {
        appendTerminal("📂 Opening Downloads folder...");
      }
    })
    .catch(err => {
      console.error('[Renderer] Error opening folder:', err);
      appendTerminal(`❌ Error: ${err.message}`);
    });
};

/**
 * Input listener for quick link paste
 */
ytLinkInput.addEventListener('input', (e) => {
  const value = e.target.value.trim();
  if (value) {
    appendTerminal('Link ' + value);
    ytLinkInput.value = '';
  }
});

// Initialize progress
progressBar.value = 0;
totalProgressBar.value = 0;
console.debug('[Renderer] Progress bars initialized.');