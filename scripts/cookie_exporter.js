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

const fs = require('fs');
const path = require('path');
const { app, BrowserWindow } = require('electron');
const puppeteer = require('puppeteer');

const service = process.argv[2]; // Usage: node cookie_exporter.js youtube_music

const NETSCAPE_HEADER = `# Netscape HTTP Cookie File
# This file was generated by cookie_exporter.js
# https://curl.se/docs/http-cookies.html
`;

function toNetscapeCookies(cookies) {
  return (
    NETSCAPE_HEADER +
    cookies
      .map((cookie) => {
        const domain = cookie.domain.startsWith('.') ? cookie.domain : '.' + cookie.domain;
        const flag = cookie.domain.startsWith('.') ? 'TRUE' : 'FALSE';
        const secure = cookie.secure ? 'TRUE' : 'FALSE';
        const expiry = cookie.expires || Math.floor(Date.now() / 1000) + 1209600; // 2 weeks
        return [
          domain,
          flag,
          cookie.path,
          secure,
          expiry,
          cookie.name,
          cookie.value,
        ].join('\t');
      })
      .join('\n')
  );
}

async function exportCookies(cookies, filename) {
  const netscapeFormatted = toNetscapeCookies(cookies);
  fs.writeFileSync(path.resolve(__dirname, filename), netscapeFormatted);
  console.log(`✅ Cookies saved to ${filename}`);
}

async function exportYoutubeCookies() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('https://www.youtube.com', { waitUntil: 'networkidle2' });

  const cookies = await page.cookies();
  await exportCookies(cookies, 'cookies.txt');
  await browser.close();
}

async function exportYoutubeMusicCookiesElectron() {
    const partition = 'persist:ytmusic-login';
  
    return new Promise((resolve) => {
      app.whenReady().then(() => {
        const win = new BrowserWindow({
          width: 1200,
          height: 800,
          webPreferences: {
            partition: partition,
          },
        });
  
        let readyForExport = false;
        let finishedLogin = false;
        // Start with homepage to encourage login
        win.loadURL('https://music.youtube.com/');
  
        win.webContents.on('did-navigate', async (_event, url) => {
          console.log(`[NAVIGATED] ${url}`);
        
          const ses = win.webContents.session;
          const cookies = await ses.cookies.get({ domain: '.youtube.com' });
          const hasSID = cookies.some(c => c.name === 'SID' || c.name === 'SAPISID');
          
          console.log(`[COOKIES] SID/SAPISID present: ${hasSID}`);
          console.log(`[READY FOR EXPORT] ${readyForExport}`);
          console.log(`[FINISHED LOGIN] ${finishedLogin}`)

          if(hasSID) finishedLogin = true;
        
          if (url.startsWith('https://music.youtube.com') && !hasSID && !readyForExport) {
            console.log('[ACTION] Injecting login-instruction prompt...');
            await win.webContents.executeJavaScript(`
              console.log('[DOM] Checking for login-instruction...');
              if (!document.getElementById('login-instruction')) {
                console.log('[DOM] Creating login-instruction div...');
                const div = document.createElement('div');
                div.id = 'login-instruction';
                div.style.position = 'fixed';
                div.style.top = '10px';
                div.style.left = '50%';
                div.style.transform = 'translateX(-50%)';
                div.style.backgroundColor = '#202124';
                div.style.color = 'white';
                div.style.padding = '12px 24px';
                div.style.borderRadius = '8px';
                div.style.fontSize = '14px';
                div.style.fontFamily = 'Arial';
                div.style.zIndex = 999999;
                div.style.boxShadow = '0px 0px 12px rgba(0,0,0,0.5)';
                div.innerText = '⚠️ Please sign into your Google account here. After login You will be re-directed.';
                document.body.appendChild(div);
              }
            `);
          }
        
          if (url.includes('myaccount.google.com/security-checkup')) {
            console.log('🔐 [SECURITY CHECK] Detected security checkup, redirecting...');
            readyForExport = true;
        
            await win.webContents.executeJavaScript(`
              const elem = document.getElementById('login-instruction');
              if (elem) elem.remove();
            `);
        
            await win.webContents.executeJavaScript(`
              console.log('[DOM] Injecting success loader div...');
              if (!document.getElementById('login-success-msg-loader')) {
                const div = document.createElement('div');
                div.id = 'login-success-msg-loader';
                div.style.position = 'fixed';
                div.style.top = '20px';
                div.style.left = '40%';
                div.style.backgroundColor = '#0f9d58';
                div.style.color = 'white';
                div.style.borderRadius = '8px';
                div.style.zIndex = 999999;
                div.style.padding = '12px 24px';
                div.style.fontSize = '14px';
                div.style.fontFamily = 'Arial';
                div.style.boxShadow = '0px 0px 12px rgba(0,0,0,0.5)';
                div.innerText = '🎉 Login successful! Please Wait 2 seconds...';
                document.body.appendChild(div);
              }
            `);
        
            setTimeout(() => {
              if (!win.isDestroyed()) {
                console.log('🔁 [REDIRECT] Returning to music.youtube.com...');
                win.loadURL('https://music.youtube.com');
              }
            }, 2000);
          }

          if(url.startsWith('https://music.youtube.com') && !hasSID && readyForExport){
            await win.webContents.executeJavaScript(`
              console.log('[DEBUG] Attempting to click Sign in button if present...');
              const signInBtn = document.querySelector('a.sign-in-link.app-bar-button');
              if (signInBtn) {
                signInBtn.click();
                console.log('[DEBUG] Sign in button clicked.');
              } else {
                console.log('[DEBUG] Sign in button not found.');
              }
            `);

            finishedLogin = true;
          }
        
          if (url.startsWith('https://music.youtube.com') && hasSID && readyForExport || url.startsWith('https://music.youtube.com') && hasSID && finishedLogin) {
            console.log('✅ [LOGIN DETECTED] Export readiness confirmed. Injecting final success message...');
        
            await win.webContents.executeJavaScript(`
              const loginPrompt = document.getElementById('login-instruction');
              if (loginPrompt) loginPrompt.remove();
            `);
        
            await win.webContents.executeJavaScript(`
              const loaderElem = document.getElementById('login-success-msg-loader');
              if (loaderElem) loaderElem.remove();
            `);
        
            await win.webContents.executeJavaScript(`
              console.log('[DOM] Injecting final login-success-msg...');
              if (!document.getElementById('login-success-msg')) {
                const div = document.createElement('div');
                div.id = 'login-success-msg';
                div.style.position = 'fixed';
                div.style.top = '10px';
                div.style.left = '50%';
                div.style.transform = 'translateX(-50%)';
                div.style.backgroundColor = '#0f9d58';
                div.style.color = 'white';
                div.style.borderRadius = '8px';
                div.style.zIndex = 999999;
                div.style.padding = '12px 24px';
                div.style.fontSize = '14px';
                div.style.fontFamily = 'Arial';
                div.style.boxShadow = '0px 0px 12px rgba(0,0,0,0.5)';
                div.innerText = '🎉 Login successful! You may now close this window.';
                document.body.appendChild(div);
              }
            `);
        
            setTimeout(() => {
              if (!win.isDestroyed()) {
                console.log('🛑 [CLOSING] Login sequence complete, closing window.');
                win.close();
              }
            }, 1000);
          }
        });        


  
        win.on('close', async () => {
          const ses = win.webContents.session;
          if (readyForExport || finishedLogin) {
            const cookies = await ses.cookies.get({});
            const youtubeCookies = cookies.filter(cookie =>
              cookie.domain.includes('youtube.com') || cookie.domain.includes('music.youtube.com')
            );
            await exportCookies(youtubeCookies, 'cookies_youtubemusic.txt');
            console.log('✅ Cookies exported successfully.');
          } else {
            console.log('⚠️ Login not complete — cookies not exported.');
          }
          resolve();
        });
      });
    });
  }  

async function exportCookiesForService(service) {
    if (service === 'youtube_music') {
      await exportYoutubeMusicCookiesElectron();
    } else {
      await exportYoutubeCookies();
    }
  }
  
  module.exports = { exportCookiesForService };
  
