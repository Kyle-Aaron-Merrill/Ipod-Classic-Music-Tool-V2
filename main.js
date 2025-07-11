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

console.log('[MAIN] main.js started');

const { ipcMain, shell, BrowserWindow, app } = require('electron');
const path = require('path');
const puppeteer = require('puppeteer');
const fs = require('fs');
// Import your process_link module
const { process_link } = require('./scripts/process_link.js');
const { get_yt_dlp_link } = require('./scripts/get_yt_dlp_link.js');
const { exportCookiesForService } = require('./scripts/cookie_exporter.js');
const { get_browse_url } = require('./scripts/get_browse_url');

const { execFile } = require('child_process');


function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile('index.html');
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// Handle "open-downloads-folder" as before (uses invoke)
ipcMain.handle('open-downloads-folder', async () => {
  const musicPath = path.join(__dirname, 'music');
  const result = await shell.openPath(musicPath);
  return result; // empty string means success
});

ipcMain.handle('get-browse-url', async (event, url) => {
  return await get_browse_url(url);
});

// ✅ Modified from ipcMain.handle to ipcMain.on:
ipcMain.on('run-process-link', async (event, { url, service, media }) => {
  console.log(`[MAIN] Received process-link for: ${url}, ${service}, ${media}`);

  try {
    if (service != 'youtube_music'){
      const ytUrls = await process_link(url, service, media, puppeteer);
      console.log(`[MAIN] process_link result:`, JSON.stringify(ytUrls, null, 2));
      // Send back result to renderer process
      event.sender.send('process-link-result', { success: true,  });
      //await exportCookiesForService(service);
      await runPythonScript('download_song.py', [ytUrls.trackUrl, ytUrls.albumUrl, ytUrls.thumbnailUrl, service, media]);
      await runPythonScript('fetch_metadata.py', []);
      await runPythonScript('embed_metadata.py', []);
      console.log(`[MAIN] Done processing YouTube Music: ${url}`);
      event.sender.send('process-link-result', {
        success: true,
        url,
        message: 'Processing complete',
        service,
        media
      });
    }
    else if (service == 'youtube_music'){
      const ytUrl = url.toString();
      console.log('process-link-result', { success: true, ytUrl , typeof: typeof ytUrl});
      await exportCookiesForService(service);
      await runPythonScript('download_song.py', [ytUrl, albumUrl=null, service='youtube_music', media]);
      await runPythonScript('fetch_metadata.py', []);
      await runPythonScript('embed_metadata.py', []);
      console.log(`[MAIN] Done processing: ${url}`);
      event.sender.send('process-link-result', {
        success: true,
        url,
        message: 'Processing complete',
        service,
        media
      });
    }
    
  } catch (error) {
    console.error(`[MAIN] process_link error:`, error);
    event.sender.send('process-link-result', {
      success: false,
      error: error.message || error.toString()
    });
  }
});

async function readMetadataFromFile(fileName = 'download_song_output.txt') {
  const filePath = path.join(__dirname, fileName);

  try {
    const fileContents = fs.readFileSync(filePath, 'utf-8');
    const metadata = JSON.parse(fileContents);
    return metadata;
  } catch (error) {
    console.error('Error reading or parsing metadata file:', error);
    return null;
  }
}

function runPythonScript(scriptName, args = []) {
  const scriptPath = path.join(__dirname, 'scripts', scriptName);

  return new Promise((resolve, reject) => {
    execFile('python', [scriptPath, ...args], (error, stdout, stderr) => {
      if (error) {
        console.error(`[ERROR] ${error.message}`);
        reject(error);
        return;
      }
      if (stderr) {
        console.error(`[PY STDERR] ${stderr}`);
      }
      console.log(`[PY STDOUT] ${stdout}`);
      resolve(stdout);
    });
  });
}
