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

async function convertToPlaylistUrl(url) {
  try {
    const urlObj = new URL(url);
    const listId = urlObj.searchParams.get('list');
    if (!listId) {
      // No playlist ID in the URL
      return null;
    }
    return `https://www.youtube.com/playlist?list=${listId}`;
  } catch (e) {
    // Invalid URL
    return null;
  }
}


export async function process_link(url, service, media, puppeteerInstance = puppeteer) {
  console.log(`Running process_link.js with: url=${url}, service=${service}, media=${media}`);

  async function getYtLink(url, service, media) {
    console.info(`[getYtLink] Looking up YouTube for`, { url, service, media });

    let query = '';

    try {
      switch (service) {
        case 'applemusic':
          //todo
          console.debug('[getYtLink] Extracting Apple Music query...');
          query = await extractAppleMusicQuery(url, media);
          break;
        case 'soundcloud':
          //todo
          console.debug('[getYtLink] Extracting SoundCloud query...');
          query = await extractSoundCloudQuery(url, media);
          break;
        case 'spotify':
          //todo
          console.debug('[getYtLink] Extracting Spotify query...');
          query = await extractSpotifyQuery(url, media);
          break;
        case 'amazon':
          //todo
          console.debug('[getYtLink] Extracting Amazon Music query...');
          query = await extractAmazonMusicQuery(url, media);
          break;
        case 'tidal':
          //todo
          console.debug('[getYtLink] Extracting Tidal query...');
          query = await extractTidalQuery(url, media);
          break;
        case 'deezer':
          //todo
          console.debug('[getYtLink] Extracting Deezer query...');
          query = await extractDeezerQuery(url, media);
          break;
        case 'qobuz':
          //todo
          console.debug('[getYtLink] Extracting Qobuz query...');
          query = await extractQobuzQuery(url, media);
          break;
        case 'discogs':
          //todo
          console.debug('[getYtLink] Extracting Discogs query...');
          query = await extractDiscogsQuery(url, media);
          break;
        default:
          console.warn('[getYtLink] Unknown service:', service);
          return null;
      }
    } catch (err) {
      console.error(`[getYtLink] Error during query extraction for service "${service}":`, err.stack || err);
      return null;
    }

    if (!query) {
      console.warn('[getYtLink] Empty query from extraction');
      return null;
    }

    console.log(`[getYtLink] Search query: ${query.artist}`);
    
    const yt_query_url = await getYouTubeQueryUrl(query.artist);
    const metadata = await get_album_url(query.artist, query.album, query.track, yt_query_url);
    const ytLink = metadata;
    console.log('[getYtLink] ytLink Object:', JSON.stringify(ytLink, null, 2));
    return ytLink;
  }

  async function get_album_url(artist, album, track, yt_query_url) {
    const browser = await puppeteer.launch({ headless: true, quiet: true });
    const page = await browser.newPage();

    console.log(`[getYouTubeSearchUrl] Navigating to Query... ${yt_query_url}`);
    await page.goto(yt_query_url, { waitUntil: 'networkidle2' });


    if(artist){
      const artist_url = await page.evaluate ((artist) => {
        function normalizeString(str) {
          if (typeof str !== 'string') return '';
        
          return str
            .toLowerCase()                       // lowercase everything
            .replace(/\(.*?\)/g, '')             // remove text in parentheses
            .replace(/feat\.?|ft\.?/gi, '')      // remove "feat." or "ft."
            .replace(/[^a-z0-9\s]/gi, '')        // remove non-alphanumeric
            .replace(/\s+/g, ' ')                // collapse multiple spaces
            .trim();                             // trim leading/trailing spaces
        }
        const channels = document.querySelectorAll('#content-section.ytd-channel-renderer');
        for(const channel of channels){
          const channel_name = channel.querySelector('#text.ytd-channel-name').innerHTML;
          const channelAttribute = channel.querySelector('yt-formatted-string#subscribers.style-scope.ytd-channel-renderer').innerHTML

          if(normalizeString(channel_name).includes(normalizeString(artist))){
            return `https://www.youtube.com/${channelAttribute}`;
          }
        }
        return null;
      }, artist);
      let album_url = null;
      let album_art_url = null;

      if(album && artist_url){
        console.log(`[getYouTubeSearchUrl] Navigating to Realeases... ${artist_url}`);
        await page.goto(`${artist_url}/releases`, { waitUntil: 'networkidle2' });
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));

        album_url = await page.evaluate ((album) => {
          function normalizeString(str) {
            if (typeof str !== 'string') return '';
          
            return str
              .toLowerCase()                       // lowercase everything
              .replace(/\(.*?\)/g, '')             // remove text in parentheses
              .replace(/feat\.?|ft\.?/gi, '')      // remove "feat." or "ft."
              .replace(/[^a-z0-9\s]/gi, '')        // remove non-alphanumeric
              .replace(/\s+/g, ' ')                // collapse multiple spaces
              .trim();                             // trim leading/trailing spaces
          }

          const containers = document.querySelectorAll('#contents > ytd-rich-item-renderer');
          for(const container of containers){
            const albumName = container.querySelector('#video-title-link.ytd-rich-grid-media').title;
            const albumUrl = `https://www.youtube.com/playlist?list=${container.querySelector('#video-title-link.ytd-rich-grid-media').href.split('&list=')[1]}`;
            if(normalizeString(albumName).includes(normalizeString(album))){
              console.log(albumUrl);
              return albumUrl;
            }
          }
          return null;
        }, album);

        console.log(`[getYouTubeSearchUrl] Navigating to Playlist... ${album_url}`);
        await page.goto(album_url, { waitUntil: 'networkidle2' });

        album_art_url = await page.evaluate(()=>{
          const img = document.getElementById('img');
          //console.log(img);
          if (img && img.src) {
            console.log('Album art URL:', img.src);
            return img.src;
          } else {
            console.warn('❌ Image with ID "img" not found or has no src.');
            return null;
          }
        });
      }
      let track_Url = album_url;

      if(track){
        track_Url = await page.evaluate((track)=>{
          function normalizeString(str) {
            if (typeof str !== 'string') return '';
          
            return str
              .toLowerCase()                       // lowercase everything
              .replace(/\(.*?\)/g, '')             // remove text in parentheses
              .replace(/feat\.?|ft\.?/gi, '')      // remove "feat." or "ft."
              .replace(/[^a-z0-9\s]/gi, '')        // remove non-alphanumeric
              .replace(/\s+/g, ' ')                // collapse multiple spaces
              .trim();                             // trim leading/trailing spaces
          }

          const containers = document.querySelectorAll('ytd-playlist-video-renderer');
          for(const container of containers){
            const videoTitle = container.querySelector('#video-title.ytd-playlist-video-renderer').title;
            const videoLink = container.querySelector('#video-title.ytd-playlist-video-renderer').href.split('&list=')[0];
            if(normalizeString(videoTitle).includes(normalizeString(track))){
              console.log(container.querySelector('#video-title.ytd-playlist-video-renderer'));
              return videoLink;
            }
          }
        }, track);
      }

      await browser.close();
      
      return {
        artistUrl: artist_url || null,
        albumUrl: album_url || null,
        thumbnailUrl: album_art_url|| null,
        trackUrl: track_Url || null,
      };
    }
  }

  // async function get_track_url(track, albumUrl) {
  //   const browser = await puppeteer.launch({ headless: true, quiet: true });
  //   const page = await browser.newPage();
  
  //   console.log(`[getYouTubeSearchUrl] Navigating to Playlist URL...`);
  //   await page.goto(albumUrl, { waitUntil: 'networkidle2' });
  
  //   const TrackUrl = await page.evaluate((track) => {
  //     const containers = document.querySelectorAll('#meta.ytd-playlist-video-renderer');
  //     for (const container of containers) {
  //       const titleEl = container.querySelector('#video-title.ytd-playlist-video-renderer');
  //       if (!titleEl) continue;
  
  //       let title = titleEl.innerText.trim().toLowerCase();
  //       const link = titleEl.href;

  //       // Remove anything in brackets and trim whitespace
  //       title = title.replace(/\[.*?\]|\(.*?\)/g, '').replace(/[^a-z0-9 ]/gi, '').trim();

  //       const cleanedTrack = track.toLowerCase().replace(/[^a-z0-9 ]/gi, '').trim();

  //       console.log(`Comparing cleaned: "${title}" vs "${cleanedTrack}"`);

  //       if (title.includes(cleanedTrack)) {
  //         console.log(link.split('&list=')[0]);
  //         return `${link.split('&list=')[0]}`;
  //       }
  //     }
  //     return null;
  //   }, track);
  
  //   //await browser.close();
  
  //   if (TrackUrl) {
  //     console.log(`[getYouTubeSearchUrl] Found Matching Track: ${TrackUrl}`);
  //     return TrackUrl;
  //   } else {
  //     console.log(`[getYouTubeSearchUrl] Track not found in playlist.`);
  //     return null;
  //   }
  // }  

  // async function get_album_url(artist, album, track, query_url) {
  //   let channel_url;
  
  //   console.log(`[getYouTubeSearchUrl] 🟢 Starting YouTube search`);
  //   console.log(`[getYouTubeSearchUrl] Artist: "${artist}", Album: "${album}", Track: "${track}"`);
  //   console.log(`[getYouTubeSearchUrl] Query URL: ${query_url}`);
  
  //   const browser = await puppeteer.launch({ headless: false, quiet: true });
  //   const page = await browser.newPage();
  
  //   console.log(`[getYouTubeSearchUrl] 🌐 Navigating to YouTube search results...`);
  //   await page.goto(query_url, { waitUntil: 'networkidle2' });
  
  //   try {
  //     channel_url = await page.evaluate((artist, album, track) => {
  //       console.log(`[evaluate] 🔍 Looking for video containers...`);
  //       const containers = document.querySelectorAll('.text-wrapper.ytd-video-renderer');
  //       console.log(`[evaluate] Found ${containers.length} containers`);
  
  //       function normalize(str) {
  //         return str
  //           .toLowerCase()
  //           .replace(/\(.*?\)/g, '')
  //           .replace(/feat\.?|ft\.?/gi, '')
  //           .replace(/[^a-z0-9\s]/gi, '')
  //           .trim();
  //       }
  
  //       for (const container of containers) {
  //         const titleEl = container.querySelector('#video-title.ytd-video-renderer');
  //         const artistEl = container.querySelector('a.yt-simple-endpoint.yt-formatted-string');
  
  //         if (!titleEl || !artistEl) {
  //           console.log(`[evaluate] ⚠️ Missing title or artist element`);
  //           continue;
  //         }
  
  //         const yt_title = titleEl.title.trim();
  //         const yt_artist = artistEl.innerText.trim();
  //         const channel_link = artistEl.href;
  
  //         const normYtTitle = normalize(yt_title);
  //         const normTrack = normalize(track);
  //         const normAlbum = normalize(album);
  //         const normArtist = normalize(artist);
  //         const normYtArtist = normalize(yt_artist);
  
  //         console.log(`[evaluate] 🎵 YouTube Title: "${yt_title}" (normalized: "${normYtTitle}")`);
  //         console.log(`[evaluate] 🎤 YouTube Artist: "${yt_artist}" (normalized: "${normYtArtist}")`);
  //         console.log(`[evaluate] 🔗 Channel Link: ${channel_link}`);
  
  //         if ((normYtTitle.includes(normTrack) || normYtTitle.includes(normAlbum)) && normYtArtist.includes(normArtist)) {
  //           console.log(`[evaluate] ✅ Match found! Returning channel link.`);
  //           return channel_link;
  //         }
  //       }
  
  //       console.log(`[evaluate] ❌ No matching video found.`);
  //       return null;
  //     }, artist, album, track);
  //   } catch (error) {
  //     console.error(`[getYouTubeSearchUrl] 🛑 Error while evaluating initial search: ${error.message}`);
  //   }
  
  //   try {
  //     if (channel_url) {
  //       console.log(`[getYouTubeSearchUrl] 📺 Navigating to channel: ${channel_url}`);
  //       await page.goto(channel_url, { waitUntil: 'networkidle2' });
  
  //       console.log(`[getYouTubeSearchUrl] ⏳ Waiting for channel handle...`);
  //       await page.waitForSelector('.yt-core-attributed-string--link-inherit-color', { timeout: 5000 });
  
  //       const channelAttribute = await page.evaluate(() => {
  //         const elements = Array.from(document.querySelectorAll('.yt-core-attributed-string--link-inherit-color'));
  //         const match = elements.find(el => el.textContent?.trim().startsWith('@'));
  //         return match ? match.textContent.trim() : null;
  //       });
  
  //       if (channelAttribute) {
  //         console.log(`[getYouTubeSearchUrl] 🎯 Channel handle found: ${channelAttribute}`);
  //         const releasesUrl = `https://www.youtube.com/${channelAttribute}/releases`;
  //         console.log(`[getYouTubeSearchUrl] 🔄 Navigating to releases: ${releasesUrl}`);
  //         await page.goto(releasesUrl, { waitUntil: 'networkidle2' });
  
  //         await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  
  //         const video_url = await page.evaluate((album) => {
  //           const containers = document.querySelectorAll('ytd-rich-item-renderer');
  //           console.log(`[evaluate] 📦 Found ${containers.length} rich media items`);
  
  //           for (const container of containers) {
  //             const linkEl = container.querySelector('#video-title-link.ytd-rich-grid-media');
  //             if (!linkEl) continue;
  
  //             const video_link = linkEl.href;
  //             const album_title = linkEl.innerText.trim();
  
  //             console.log(`[evaluate] Album Title: ${album_title}, Looking for: ${album}`);
  //             if (album_title.toLowerCase() === album.toLowerCase()) {
  //               console.log(`[evaluate] ✅ Matching album found: ${video_link}`);
  //               return video_link;
  //             }
  //           }
  
  //           console.log(`[evaluate] ❌ No matching album found.`);
  //           return null;
  //         }, album);
  
  //         if (video_url) {
  //           const playlistId = video_url.split('list=')[1];
  //           const playlistUrl = `https://www.youtube.com/playlist?list=${playlistId}`;
  //           console.log(`[getYouTubeSearchUrl] 📃 Playlist found: ${playlistUrl}`);
  //           await page.goto(playlistUrl, { waitUntil: 'networkidle2' });
  
  //           const img_url = await page.evaluate(() => {
  //             const img = document.querySelector('img#img.style-scope.yt-img-shadow');
  //             return img ? img.src : null;
  //           });
  
  //           const songUrl = await page.evaluate((track) => {
  //             console.log(`[evaluate] 🕵️ Looking for track: ${track}`);
  //             if (!track) {
  //               console.log(`[evaluate] ⚠️ Track name is empty`);
  //               return null;
  //             }
  
  //             const titles = document.querySelectorAll('ytd-playlist-video-renderer');
  //             console.log(`[evaluate] Found ${titles.length} track items`);
  
  //             function normalize(str) {
  //               return str.toLowerCase()
  //                         .replace(/\(.*?\)/g, '')
  //                         .replace(/feat\.?|ft\.?/gi, '')
  //                         .replace(/[^a-z0-9\s]/gi, '')
  //                         .trim();
  //             }
  
  //             const normTrack = normalize(track);
  
  //             for (const title of titles) {
  //               const videoTitleEl = title.querySelector('#video-title.ytd-playlist-video-renderer');
  //               if (!videoTitleEl) continue;
  
  //               const video_title = videoTitleEl.title;
  //               const normTitle = normalize(video_title);
  
  //               console.log(`[evaluate] 🎼 Compare: "${normTitle}" vs "${normTrack}"`);
  //               if (normTitle.includes(normTrack)) {
  //                 const resultUrl = videoTitleEl.href.split('&list=')[0];
  //                 console.log(`[evaluate] ✅ Track matched. Returning URL: ${resultUrl}`);
  //                 return resultUrl;
  //               }
  //             }
  
  //             console.log(`[evaluate] ❌ No track match found`);
  //             return null;
  //           }, track);
  
  //           console.log(`[getYouTubeSearchUrl] 🎯 Final TrackUrl: ${songUrl}`);
  //           console.log(`[getYouTubeSearchUrl] 🖼️ Thumbnail: ${img_url}`);
  
  //           await browser.close();
  
  //           return {
  //             albumUrl: playlistUrl,
  //             thumbnailURL: img_url || null,
  //             TrackUrl: songUrl || null
  //           };
  //         } else {
  //           console.log(`[getYouTubeSearchUrl] ❌ No album video found.`);
  //         }
  //       } else {
  //         console.log(`[getYouTubeSearchUrl] ❌ Channel handle not found.`);
  //       }
  //     } else {
  //       console.log(`[getYouTubeSearchUrl] ❌ Channel URL was null.`);
  //     }
  //   } catch (error) {
  //     console.error(`[getYouTubeSearchUrl] 🛑 Secondary error: ${error.message}`);
  //   } finally {
  //     if (browser && browser.isConnected()) {
  //       console.log(`[getYouTubeSearchUrl] 🧹 Cleaning up browser session...`);
  //       await browser.close();
  //     }
  //   }
  // }
  

  async function getYouTubeQueryUrl(artist) {
    const queryParts = [artist].filter(Boolean);
    const rawQuery = queryParts.join(' ').toLowerCase().trim();

    const extraEncode = str => encodeURIComponent(str)
      .replace(/'/g, '%27')     // apostrophe
      .replace(/%20/g, '+');    // use `+` for YouTube-style spacing

    const encodedQuery = extraEncode(rawQuery);

    // YouTube filter: "Type: Channel" (base64-encoded filter)
    const channelFilter = 'EgIQAg%3D%3D';

    const url = `https://www.youtube.com/results?search_query=${encodedQuery}&sp=${channelFilter}`;
    console.log('[getYouTubeQueryUrl]', url);

    return url;
  }

  async function extractAmazonMusicQuery(url, media) {
    try {
      console.debug('[extractAmazonMusicQuery] Fetching URL:', url);
      const res = await fetch(url);
      const html = await res.text();
      const $ = cheerio.load(html);

      const title = $('meta[property="og:title"]').attr('content') || '';
      const artist = $('meta[name="music:musician"]').attr('content') || '';
      console.debug('[extractAmazonMusicQuery] Parsed title:', title, 'artist:', artist);

      if (media === 'album') return `${title} ${artist} album`;
      if (media === 'track') return `${title} ${artist}`;
      return artist;
    } catch (err) {
      console.error('[AmazonMusic Extract Error]', err.stack || err);
      return '';
    }
  }

  async function extractSpotifyQuery(url, media) {
    let browser;
    try {
        console.debug('[extractSpotifyQuery] Launching Puppeteer for URL:', url);
        browser = await puppeteerInstance.launch();
        const page = await browser.newPage();

        await page.goto(url, { waitUntil: 'networkidle2' });

        if (media == 'album'){
            const album = await page.$eval('section h1[data-encore-id="text"]',el => el.textContent.trim().replace(/\u2019/g, "'"));            
            const artist = await page.$eval('a[data-testid="creator-link"]', el => el.textContent.trim());
            const track = null;
            console.debug('[extractSpotifyQuery] Extracted album:', album, 'artist:', artist);
            return {artist, album, track}
        }
        if (media == 'track'){
            const artist = await page.$eval('a[data-testid="creator-link"]', el => el.textContent.trim());
            const album = await page.$eval('section span[data-encore-id="text"]:nth-child(3) > a', el => el.textContent.trim().replace(/\u2019/g, "'"));
            const track = await page.$eval('section span > h1[data-encore-id="text"]',el => el.textContent.trim().replace(/\u2019/g, "'"));
            console.debug('[extractSpotifyQuery] Extracted album:', album, 'artist:', artist, "track:", track);
            return {artist, album, track}
        }
    } catch (err) {
        console.error('[Spotify Extract Error]', err.stack || err);
        return '';
    } finally {
        if (browser) {
            await browser.close();
            console.debug('[extractSpotifyQuery] Puppeteer browser closed');
        }
    }
  }

  async function extractTidalQuery(url, media) {
    try {
      console.debug('[extractTidalQuery] Fetching URL:', url);
      const res = await fetch(url);
      const html = await res.text();
      const $ = cheerio.load(html);

      const title = $('meta[property="og:title"]').attr('content') || '';
      const artist = ($('meta[property="og:description"]').attr('content') || '').split(' · ')[0] || '';
      console.debug('[extractTidalQuery] Parsed title:', title, 'artist:', artist);

      if (media === 'album') return `${title} ${artist} album`;
      if (media === 'track') return `${title} ${artist}`;
      return artist;
    } catch (err) {
      console.error('[Tidal Extract Error]', err.stack || err);
      return '';
    }
  }

  async function extractDeezerQuery(url, media) {
    try {
      console.debug('[extractDeezerQuery] Fetching URL:', url);
      const res = await fetch(url);
      const html = await res.text();
      const $ = cheerio.load(html);

      const title = $('meta[property="og:title"]').attr('content') || '';
      const artist = $('meta[property="music:musician"]').attr('content') || '';
      console.debug('[extractDeezerQuery] Parsed title:', title, 'artist:', artist);

      if (media === 'album') return `${title} ${artist} album`;
      if (media === 'track') return `${title} ${artist}`;
      return artist;
    } catch (err) {
      console.error('[Deezer Extract Error]', err.stack || err);
      return '';
    }
  }

  async function extractQobuzQuery(url, media) {
    try {
      console.debug('[extractQobuzQuery] Fetching URL:', url);
      const res = await fetch(url);
      const html = await res.text();
      const $ = cheerio.load(html);

      const title = $('meta[property="og:title"]').attr('content') || '';
      const artist = ($('meta[property="og:description"]').attr('content') || '').split(' - ')[0] || '';
      console.debug('[extractQobuzQuery] Parsed title:', title, 'artist:', artist);

      if (media === 'album') return `${title} ${artist} album`;
      if (media === 'track') return `${title} ${artist}`;
      return artist;
    } catch (err) {
      console.error('[Qobuz Extract Error]', err.stack || err);
      return '';
    }
  }

  async function extractDiscogsQuery(url, media) {
    try {
      console.debug('[extractDiscogsQuery] Fetching URL:', url);
      const res = await fetch(url);
      const html = await res.text();
      const $ = cheerio.load(html);

      const title = $('meta[property="og:title"]').attr('content') || '';
      const artist = $('meta[name="twitter:audio:artist_name"]').attr('content') || '';
      console.debug('[extractDiscogsQuery] Parsed title:', title, 'artist:', artist);

      if (media === 'album') return `${title} ${artist} album`;
      if (media === 'track') return `${title} ${artist}`;
      return artist;
    } catch (err) {
      console.error('[Discogs Extract Error]', err.stack || err);
      return '';
    }
  }

  async function extractAppleMusicQuery(url, media) {
    try {
      console.debug('[extractAppleMusicQuery] Fetching URL:', url);
      const res = await fetch(url);
      const html = await res.text();
      const $ = cheerio.load(html);

      const metaTitle = $('meta[property="og:title"]').attr('content') || '';
      const metaArtist = $('meta[name="apple:artist"]').attr('content') || '';
      console.debug('[extractAppleMusicQuery] Parsed title:', metaTitle, 'artist:', metaArtist);

      switch (media) {
        case 'track':
          return `${metaTitle} ${metaArtist}`;
        case 'album':
          return `${metaTitle} ${metaArtist} album`;
        case 'artist':
          return `${metaArtist}`;
        default:
          return '';
      }
    } catch (err) {
      console.error('[AppleMusic Extract Error]', err.stack || err);
      return '';
    }
  }

  async function extractSoundCloudQuery(url, media) {
    try {
      console.debug('[extractSoundCloudQuery] Fetching URL:', url);
      const res = await fetch(url);
      const html = await res.text();
      const $ = cheerio.load(html);

      const title = $('meta[property="og:title"]').attr('content') || '';
      const artist = $('meta[property="soundcloud:creator"]').attr('content') || '';
      console.debug('[extractSoundCloudQuery] Parsed title:', title, 'artist:', artist);

      switch (media) {
        case 'track':
          return `${title}`;
        case 'album':
          return `${title} ${artist} album`;
        case 'artist':
          return `${artist}`;
        default:
          return '';
      }
    } catch (err) {
      console.error('[SoundCloud Extract Error]', err.stack || err);
      return '';
    }
  }

  const ytUrl = await getYtLink(url, service, media);
  if (ytUrl) {
    console.log(`[YT] Found YouTube URL: ${ytUrl.yt_search_url}`);
    return ytUrl;
  } else {
    console.warn('[process_link] No YouTube URL found.');
    return null;
  }
}
