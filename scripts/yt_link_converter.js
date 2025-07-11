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

export async function linkConverter(link) {

  function runProcessLink(url, service, media) {
    if (window?.electronAPI?.runProcessLink) {
      window.electronAPI.runProcessLink(url, service, media);
      
      console.log(`[INFO] Sent link to main process: ${url}, ${service}, ${media}`);
    } else {
      console.error('[ERROR] electronAPI.runProcessLink is not available');
    }

  }

  function getLinkMediaType(url, service) {
    try {
      const parsedUrl = new URL(url);
      const path = parsedUrl.pathname.toLowerCase();
      const search = parsedUrl.search.toLowerCase();
      const segments = path.split('/').filter(Boolean);
      const searchParams = parsedUrl.searchParams;

      if (service === 'spotify') {
        if (segments.includes('album')) return 'album';
        if (segments.includes('track')) return 'track';
        if (segments.includes('playlist')) return 'playlist';
        if (segments.includes('artist')) return 'artist';
      }

      if (service === 'youtube' || service === 'youtube_music') {
        if (searchParams.has('list')) return 'album';
        if (searchParams.has('v') || path.startsWith('/watch')) return 'track';
        if (path.startsWith('/channel/') || path.startsWith('/user/') || path.startsWith('/@')) return 'artist';
        return 'unknown';
      }

      if (service === 'applemusic') {
        if (path.includes('/artist/')) return 'artist';
        if (path.includes('/album/')) {
          if (search !== '') return 'track';
          return 'album';
        }
        return 'unknown';
      }

      if (service === 'deezer' || service === 'tidal') {
        if (segments.includes('album')) return 'album';
        if (segments.includes('track')) return 'track';
        if (segments.includes('artist')) return 'artist';
      }

      if (service === 'soundcloud') {
        if (segments.length === 1) return 'artist';
        if (segments.length === 2) return 'track';
        if (segments.length >= 3 && segments[1] === 'sets') return 'album';
        return 'unknown';
      }

      if (service === 'amazon') {
        if (path.includes('/albums/')) {
          if (searchParams.has('trackAsin')) return 'track';
          return 'album';
        }
        if (path.includes('/artists/')) return 'artist';
      }

      if (service === 'qobuz') {
        if (segments.includes('album')) return 'album';
        if (segments.includes('track')) return 'track';
      }

      if (service === 'discogs') {
        if (segments.includes('release')) return 'track';
        if (segments.includes('master')) return 'album';
        if (segments.includes('artist')) return 'artist';
      }

      return 'unknown';
    } catch (e) {
      console.warn('[ERROR] Invalid URL passed to getLinkMediaType:', url, e.message);
      return 'invalid';
    }
  }

  function getLinkServiceType(link) {
    try {
      const url = new URL(link);
      const hostname = url.hostname.toLowerCase();

      if (hostname.includes('spotify.com')) return 'spotify';
      if (hostname.includes('music.youtube.com')) return 'youtube_music';
      if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) return 'youtube';
      if (hostname.includes('apple.com')) return 'applemusic';
      if (hostname.includes('deezer.com')) return 'deezer';
      if (hostname.includes('tidal.com')) return 'tidal';
      if (hostname.includes('soundcloud.com')) return 'soundcloud';
      if (hostname.includes('amazon.com')) return 'amazon';
      if (hostname.includes('qobuz.com')) return 'qobuz';
      if (hostname.includes('discogs.com')) return 'discogs';

      return 'unknown';
    } catch (e) {
      return 'invalid';
    }
  }

  const match = link.match(/https?:\/\/[^\s]+/);
  const cleanedLink = match ? match[0] : '';

  if (cleanedLink) {
    const service = getLinkServiceType(cleanedLink);
    const media = getLinkMediaType(cleanedLink, service);

    console.log(`[INFO] URL: ${cleanedLink} — Service: ${service} — Media Type: ${media}`);

    if (service && media && service !== 'invalid' && media !== 'invalid') {
      return { cleanedLink, service, media };
    } else {
      console.warn('[WARN] Missing or invalid service or media type');
      return null;
    }
  }
}
