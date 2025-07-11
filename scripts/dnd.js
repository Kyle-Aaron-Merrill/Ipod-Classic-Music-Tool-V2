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

export function setupDragAndDrop() {
  const dropZone = document.getElementById('yt-container');
  const ytLinkInput = document.getElementById('yt-link');
  const terminal = document.getElementById('terminal');

  if (!dropZone || !ytLinkInput || !terminal) {
    console.warn('[DND] Required elements missing!');
    return;
  }

  // Prevent default on window to allow drops
  window.addEventListener('dragover', e => e.preventDefault());

  dropZone.addEventListener('dragover', e => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });

  dropZone.addEventListener('dragleave', e => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
  });

  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('dragover');

    const dataTransfer = e.dataTransfer;
    if (!dataTransfer) return;

    if (dataTransfer.items) {
      for (let i = 0; i < dataTransfer.items.length; i++) {
        const item = dataTransfer.items[i];
        if (item.kind === 'string') {
          item.getAsString(str => {
            const trimmed = str.trim();
            if (isValidURL(trimmed)) {
              appendLinkToTerminal(trimmed);
            }
          });
        }
      }
    } else if (dataTransfer.getData) {
      const text = dataTransfer.getData('text');
      if (isValidURL(text)) {
        appendLinkToTerminal(text);
      }
    }
  });

  function isValidURL(url) {
    try {
      const parsed = new URL(url);
      return ['http:', 'https:'].includes(parsed.protocol);
    } catch {
      return false;
    }
  }

  function appendLinkToTerminal(url) {
    const currentValue = terminal.value;
    if (currentValue.includes(url)) {
      console.debug('[DND] Skipping duplicate URL:', url);
      return;
    }
  
    if (terminal.tagName === 'TEXTAREA' || terminal.tagName === 'INPUT') {
      terminal.value += `Link ${url}\n`;
      terminal.scrollTop = terminal.scrollHeight;
    } else {
      console.debug('[DND] Error: No Terminal Located', url);
    }
  
    ytLinkInput.value = '';
    console.debug('[DND] Added dropped URL:', url);
  }
  
}
