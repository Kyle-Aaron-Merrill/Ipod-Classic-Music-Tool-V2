# Copyright (c) 2025 Kyle-Aaron-Merrill
# 
# Permission is hereby granted, free of charge, to any person obtaining a copy
# of this software and associated documentation files (the "Software"), to deal
# in the Software without restriction, including without limitation the rights
# to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
# copies of the Software, and to permit persons to whom the Software is
# furnished to do so, subject to the following conditions:
# 
# The above copyright notice and this permission notice shall be included in all
# copies or substantial portions of the Software.
# 
# THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
# IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
# FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
# AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
# LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
# OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
# SOFTWARE.

import re
import sys
import yt_dlp
import json
import subprocess

def patch_url_for_regular_youtube(url):
        if "music.youtube.com" in url:
            # Replace with the regular watch URL
            return url.replace("music.youtube.com", "www.youtube.com")
        return url

def update_yt_dlp():
    eprint("[INFO] Attempting to update yt-dlp via pip...")
    try:
        subprocess.run([sys.executable, "-m", "pip", "install", "--upgrade", "yt-dlp"], check=True)
        eprint("[INFO] yt-dlp updated successfully via pip.")
    except subprocess.CalledProcessError as e:
        eprint("[ERROR] Failed to update yt-dlp via pip.")
        eprint(e)


def eprint(*args, **kwargs):
    print(*args, file=sys.stderr, **kwargs)

def getCookies(service):
    eprint(f"[DEBUG] Getting cookies for: {service}")
    if service.lower() != 'youtube_music':
        return 'scripts/cookies.txt'
    return 'scripts/cookies_youtubemusic.txt'

def getLinks(url):
    eprint(f"[DEBUG] Getting playlist links from: {url}")
    if 'music.youtube.com' in url:
        url = url.replace('music.youtube.com', 'www.youtube.com')

    ydl_opts = {
        'extract_flat': 'in_playlist',
        'quiet': True,
        'skip_download': True,
        'force_generic_extractor': False,
    }

    urls = []
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info_dict = ydl.extract_info(url, download=False)
        eprint(f"[DEBUG] Extracted playlist info")

        if 'entries' in info_dict:
            for entry in info_dict['entries']:
                eprint(f"[DEBUG] Found entry: {entry.get('url', 'N/A')}")
                urls.append(entry['url'])
    return urls

def download_song(url, playlistUrl, thumbnailUrl, service, media):
    eprint(f"[DOWNLOAD] URL: {url} | Service: {service} | Media: {media}")
    cookies = getCookies(service)

    metadata_list = []

    if media == 'track' and service != 'youtube_music':
        metadata = download_song_with_metadata(url, playlistUrl,  cookies_file_path=cookies, musicPath='music')
        metadata_list.append(metadata)
    elif media == 'track' and service == 'youtube_music':
        metadata = download_song_with_metadata(url, playlistUrl, cookies_file_path=cookies, musicPath='music')
        metadata_list.append(metadata)
    elif "list=" not in url:
        metadata = download_song_with_metadata(url, playlistUrl, thumbnailUrl, cookies_file_path=cookies, musicPath='music')
        metadata_list.append(metadata)
    elif "list=" in url:
        playlist = getLinks(url)
        track_number = 1
        for song_url in playlist:
            eprint(f"[DEBUG] Downloading track #{track_number}: {song_url}")
            metadata = download_song_with_metadata(song_url, playlist, thumbnailUrl, cookies_file_path=cookies, musicPath='music', index=track_number)
            if metadata:
                metadata_list.append(metadata)
            else:
                eprint(f"[WARN] Failed to download metadata for: {song_url}")
            track_number += 1

    return metadata_list  # Final metadata list for internal Python or JSON output

def sanitize_filename(filename: str) -> str:
    return re.sub(r'[\\/:"*?<>|]+', '-', filename).strip()

def get_playlist_dict(url):
        ydl_opts_info = {}

        # Extract metadata first
        with yt_dlp.YoutubeDL(ydl_opts_info) as ydl:
            info_dict = ydl.extract_info(url, download=False)

        {
            'quiet': True,
            'extract_flat': True,
            'force_generic_extractor': True,
        }

        return info_dict

def download_song_with_metadata(url, playlistUrl, thumbnailUrl=None, retry=True, cookies_file_path=None, musicPath=None, index=1):
    eprint(f"[INFO] Fetching metadata from: {url}")
    if 'music.youtube.com' in url:
        url = url.replace('music.youtube.com', 'www.youtube.com')

    try:
        ydl_opts_info = {}
        if cookies_file_path:
            ydl_opts_info['cookiefile'] = cookies_file_path

        # Extract metadata first
        with yt_dlp.YoutubeDL(ydl_opts_info) as ydl:
            info_dict = ydl.extract_info(url, download=False)
            raw_title = info_dict.get('title', 'unknown')
            safe_title = sanitize_filename(raw_title)

        output_filename = f"{musicPath}/{index:02d} - {safe_title}.%(ext)s"

        ydl_opts_download = {
            'format': 'bestaudio/best',
            'outtmpl': output_filename,
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '192',
                'nopostoverwrites': False
            }],
        }
        if cookies_file_path:
            ydl_opts_download['cookiefile'] = cookies_file_path

        with yt_dlp.YoutubeDL(ydl_opts_download) as ydl:
            ydl.download([url])

    except Exception as e:
        eprint(f"[ERROR] {e}")

        # If first retry and error is about signature/formats, try again without cookies if we used them
        error_str = str(e).lower()
        if retry and cookies_file_path and any(err in error_str for err in [
            "nsig extraction failed",
            "requested format is not available",
            "some formats may be missing"
        ]):
            eprint("[INFO] Retry without cookies due to error.")
            return download_song_with_metadata(url, retry=False, cookies_file_path=None, musicPath=musicPath, index=index)

        # If already retried or other error, give up
        return None

    def has_na(d):
        return any(value == 'N/A' or value == None for value in d.values())
    
    metadata = {
        "Thumbnail URL": info_dict.get('thumbnail', 'N/A'),
        "Album": info_dict.get('album', 'N/A'),
        "Artist": info_dict.get('artist', 'N/A'),
        "Track Title": info_dict.get('track', raw_title),
        "Track Number": index,
        "File Path": f"{musicPath}/{index:02d} - {safe_title}.mp3",
        "Service": "youtube_music"  # or set dynamically if you want
    }

    keys_to_check = ["Thumbnail URL", "Album", "Artist", "Track Title"]

    if has_na({k: metadata[k] for k in keys_to_check}):
        metadata = {
            "Thumbnail URL": thumbnailUrl if thumbnailUrl is not None else info_dict.get('thumbnail', 'N/A'),
            "Album": info_dict.get('playlist', 'N/A'),
            "Artist": info_dict.get('channel', ['N/A']),
            "Track Title": clean_track_title(info_dict.get('title', 'N/A')),
            "Track Number": index,
            "File Path": f"{musicPath}/{index:02d} - {sanitize_filename(info_dict.get('title', 'unknown'))}.mp3",
            "Service": "youtube_music"
        }

    keys_to_check = ["Thumbnail URL", "Album", "Artist", "Track Title"]

    if has_na({k: metadata[k] for k in keys_to_check}) and playlistUrl:
        info_dict = get_playlist_dict(playlistUrl)
        metadata.update({
            "Thumbnail URL": thumbnailUrl if thumbnailUrl is not None else info_dict['entries'][0]['thumbnail'],
            "Album": info_dict['entries'][0]['playlist'],
            "Artist": info_dict['entries'][0]['uploader'],
            "Track Title": info_dict['title'],
            "Service": "youtube_music"
        })

    eprint("[DEBUG] Metadata generated:")
    for key, value in metadata.items():
        eprint(f"  {key}: {value}")

    return metadata


def clean_track_title(title):
    if not title or title == 'N/A':
        return 'N/A'
    title = re.sub(r'\s*[\(\[].*?(official|audio|video|lyrics?|HD|4K).*?[\)\]]', '', title, flags=re.IGNORECASE)
    if ' - ' in title:
        title = title.split(' - ', 1)[1]
    title = re.sub(r'\s*[\(\[]\s*(?!feat\.|ft\.)[^)\]]*[\)\]]', '', title, flags=re.IGNORECASE)
    return title.strip()

if __name__ == "__main__":
    if len(sys.argv) < 4:
        print(json.dumps({"error": "Missing arguments: url, service, media"}))
        sys.exit(1)

    url = sys.argv[1]
    playlistUrl = sys.argv[2]
    thumbnailUrl = sys.argv[3]
    service = sys.argv[4]
    media = sys.argv[5]

    metadata_list = download_song(url, playlistUrl, thumbnailUrl, service, media)
    for track in metadata_list:
        if track:
            track["Album URL"] = playlistUrl


    with open("download_song_output.txt", "w", encoding="utf-8") as f:
        json.dump(metadata_list, f, ensure_ascii=False, indent=2)
