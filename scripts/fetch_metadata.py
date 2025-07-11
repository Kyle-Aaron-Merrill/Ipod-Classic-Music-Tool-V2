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

import json
import sys
from crop_thumbnail import crop_thumbnail
from chat_gpt import get_all_metadata
import io
from yt_dlp import YoutubeDL

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

def chat_gpt_api(meta):

    # Create the metadata dictionary
    test_metadata = {
        "title": meta.get('title', '') ,
        "contributing_artist": meta.get('artist',''),
        "album": meta.get('album'),
        "track_number": meta.get('track_number')
    }

    # Fetch filled metadata from the OpenAI model
    metadata = get_all_metadata(test_metadata)

    # Process the metadata
    processed_metadata = {
        "title": metadata.get("title", ""),
        "subtitle": metadata.get("subtitle", ""),
        "rating": metadata.get("rating", 0),
        "comments": metadata.get("comments", ""),
        "contributing_artist": metadata.get("contributing_artist", ""),
        "album_artist": metadata.get("album_artist", ""),
        "album": metadata.get("album", ""),
        "year": metadata.get("year", 0),
        "track_number": metadata.get("track_number", 0),
        "disc_number": metadata.get("disc_number", 0),
        "genre": metadata.get("genre", ""),
        "length": metadata.get("length", ""),
        "bit_rate": metadata.get("bit_rate", 0),
        "publisher": metadata.get("publisher", ""),
        "encoded_by": metadata.get("encoded_by", ""),
        "author_url": metadata.get("author_url", ""),
        "copyright": metadata.get("copyright", ""),
        "parental_rating_reason": metadata.get("parental_rating_reason", ""),
        "composers": ', '.join(metadata.get("composers", [])),
        "conductors": ', '.join(metadata.get("conductors", [])),
        "group_description": metadata.get("group_description", ""),
        "mood": metadata.get("mood", ""),
        "part_of_set": metadata.get("part_of_set", ""),
        "initial_key": metadata.get("initial_key", ""),
        "beats_per_minute_bpm": metadata.get("beats_per_minute_bpm", 0),
        "protected": metadata.get("protected", False),
        "part_of_compilation": metadata.get("part_of_compilation", False),
        "isrc": metadata.get("isrc", ""),
        "album_art_url": metadata.get("spotify_album_art_url", "")
    }

    return processed_metadata    

gpt_meta = []

def fetch_metadata(yt_metadata):
    # Your JSON metadata string (usually you get this from a file or an API)
    songs = yt_metadata

    # Parse JSON string into Python data structure (list of dicts)
    print("Raw input received from stdin:")
    print(repr(songs))  # This will show you exactly what's being passed
    tracks = songs
    downloaded_albums = set()
    downloaded_thumbnails = set()

    print(f"Type of tracks: {type(tracks)}")
    if isinstance(tracks, list) and len(tracks) > 0:
        print(f"Type of first track: {type(tracks[0])}")
    # Example: iterate and print unpacked info
    for track in tracks:

        current_song_meta = set()
        
        track_number = track['Track Number']
        title = track['Track Title']
        artist = track['Artist']
        album = track['Album']
        file_path = track['File Path']
        thumbnail_url = track['Thumbnail URL']
        service = track['Service']
        albumUrl = track['Album URL']

        current_song_meta = {
            'track_number': track_number,
            'title': title,
            'artist': artist,
            'album': album,
            'file_path': file_path,
            'thumbnail_url': thumbnail_url
        } 

        print(f"Track Number: {track_number}")
        print(f"Title: {title}")
        print(f"Artist: {artist}")
        print(f"Album: {album}")
        print(f"File Path: {file_path}")
        print(f"Thumbnail URL: {thumbnail_url}")
        print("-" * 40)

        save_path = f"assets/bin/thumbnails/"

        metadata = chat_gpt_api(current_song_meta)
        gpt_meta.append({
            **metadata,
            'album art path': save_path + metadata['album'] + '.png',
            'file_path': file_path
        })

        if (album) not in downloaded_albums:
            if (service != "youtube_music"):
                thumbnail_url = get_album_thumbnail(albumUrl)
                album = metadata["album"]
                if (album.lower() != get_album_from_albumUrl(albumUrl).lower()):
                    album = get_album_from_albumUrl(albumUrl)
                    gpt_meta[-1]['album'] = album
                    gpt_meta[-1]['album art path'] = save_path + album + '.png'
            crop_thumbnail(thumbnail_url, save_path, album)
            downloaded_albums.add(album)
            downloaded_thumbnails.add(thumbnail_url)


        
        print(metadata)
    
    return(gpt_meta)

def get_album_from_albumUrl(url):
    ydl_opts = {
        'quiet': True,
        'skip_download': True,
        'extract_flat': True,
    }

    with YoutubeDL(ydl_opts) as ydl:
        try:
            info_dict = ydl.extract_info(url, download=False)
            album_title = info_dict.get('title')
            return album_title if album_title else ''
        except Exception as e:
            print(f"[ERROR] Could not extract album title from URL: {url}\n{e}")
            return ''


def get_album_thumbnail(url):
    ydl_opts = {
        'quiet': True,
        'skip_download': True,
        'extract_flat': True,  # Speeds up if it's a playlist
    }

    with YoutubeDL(ydl_opts) as ydl:
        try:
            info_dict = ydl.extract_info(url, download=False)
            # For single videos or playlists, 'thumbnail' key may be in different places
            if 'thumbnails' in info_dict:
                return info_dict['thumbnails'][1]['url']
            elif 'entries' in info_dict and info_dict['entries']:
                # Check first item in playlist
                return info_dict['entries'][0].get('thumbnail')
            else:
                print("[WARN] No thumbnail found in info_dict.")
                return None
        except Exception as e:
            print(f"[ERROR] Failed to extract thumbnail from URL {url}: {e}")
            return None

if __name__ == "__main__":
    with open('download_song_output.txt', 'r', encoding='utf-8') as f:
        input_json = f.read()

    metadata_list = json.loads(input_json)  # Now metadata_list is a Python list
    print(f"Read list with {len(metadata_list)} entries.")

    # Call your main processing function with the list
    results = fetch_metadata(metadata_list)

    # Print JSON stringified results for Node.js to parse
    with open("fetch_metadata_output.txt", "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
            

