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
from os import error
import sys
import io
from mutagen.mp3 import MP3
from io import BytesIO
import requests
import magic
from mutagen.id3 import (
    TXXX, COMM, TPUB, TENC, WCOP, TCOP, TCOM, TPE3,
    TMOO, TPOS, TKEY, TBPM, TCMP, TSST, POPM, TPE2, TRCK,
    TPOS, TLEN, TBPM, TSRC, ID3, TIT2, TPE1, TALB, TDRC, TCON, APIC, Encoding 
)

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

def embed_metadata(metadata_list):
    songs = metadata_list
    print("Raw input received from stdin:")
    print(repr(songs))  # This will show you exactly what's being passed
    tracks = songs

    for track in tracks:
        title = track["title"]
        subtitle = track["subtitle"]
        rating = track["rating"]
        comments = track["comments"]
        contributing_artist = track["contributing_artist"]
        album_artist = track["album_artist"]
        album = track["album"]
        year = track["year"]
        track_number = track["track_number"]
        disc_number = track["disc_number"]
        genre = track["genre"]
        length = track["length"]
        bit_rate = track["bit_rate"]
        publisher = track["publisher"]
        encoded_by = track["encoded_by"]
        author_url = track["author_url"]
        copyright = track["copyright"]
        parental_rating_reason = track["parental_rating_reason"]
        composers = track["composers"]
        conductors = track["conductors"]
        group_description = track["group_description"]
        mood = track["mood"]
        part_of_set = track["part_of_set"]
        initial_key = track["initial_key"]
        beats_per_minute_bpm = track["beats_per_minute_bpm"]
        protected = track["protected"]
        part_of_compilation = track["part_of_compilation"]
        isrc = track["isrc"]
        album_art_path = track["album art path"] 
        file_path = track["file_path"]

        try:
            audio = MP3(file_path, ID3=ID3)  # Make sure ID3 is correctly imported at the top
        except Exception as e:
            print(f"Error loading MP3 file: {e}")
            return

        # Ensure ID3 tags exist
        if audio.tags is None:
            audio.add_tags()
        elif not audio.tags:
            audio.tags.update_to_v23()

        # Define a function to clean non-ASCII characters if necessary
        def strip_hex_chars(input_string):
            if isinstance(input_string, str):
                return ''.join(char for char in input_string if ord(char) < 128)
            else:
                return str(input_string)  # Convert integers to strings

        def set_txxx(tag, desc, value):
            audio.tags.add(TXXX(encoding=3, desc=desc, text=value))

        # Apply cleaned metadata to the audio file
        audio.tags.setall('TIT2', [TIT2(encoding=3, text=title)])  # Title
        audio.tags.setall('TPE1', [TPE1(encoding=3, text=contributing_artist)])  # Contributing Artist
        audio.tags.setall('TALB', [TALB(encoding=3, text=album)])  # Album
        audio.tags.setall('TDRC', [TDRC(encoding=3, text=str(year))])  # Year
        audio.tags.setall('TRCK', [TRCK(encoding=3, text=str(track_number))])  # Track Number
        audio.tags.setall('TCON', [TCON(encoding=3, text=genre)])  # Genre

        # Custom TXXX fields
        # Standard ID3 tag replacements:
        if comments:
            audio['COMM'] = COMM(encoding=3, lang='eng', desc='', text=comments)

        if publisher:
            audio['TPUB'] = TPUB(encoding=3, text=publisher)

        if encoded_by:
            audio['TENC'] = TENC(encoding=3, text=encoded_by)

        if author_url:
            audio['WOAR'] = WCOP(encoding=3, url=author_url)  # No exact match, using WCOP for lack of WOAR

        if copyright:
            audio['TCOP'] = TCOP(encoding=3, text=copyright)

        if parental_rating_reason:
            set_txxx(audio, 'Parental Rating', parental_rating_reason)  # No standard tag; keep as TXXX

        if composers:
            audio['TCOM'] = TCOM(encoding=3, text=composers)

        if conductors:
            audio['TPE3'] = TPE3(encoding=3, text=conductors)

        if group_description:
            set_txxx(audio, 'Group Description', group_description)

        if mood:
            audio['TMOO'] = TMOO(encoding=3, text=mood)

        if part_of_set:
            audio['TPOS'] = TPOS(encoding=3, text=part_of_set)

        if initial_key:
            audio['TKEY'] = TKEY(encoding=3, text=initial_key)

        if beats_per_minute_bpm:
            audio['TBPM'] = TBPM(encoding=3, text=str(beats_per_minute_bpm))

        if protected is not None:
            set_txxx(audio, 'Protected', str(protected))

        if part_of_compilation is not None:
            audio['TCMP'] = TXXX(encoding=3, desc='TCMP', text=str(part_of_compilation))  # unofficial, iTunes uses this

        if subtitle:
            audio['TSST'] = TSST(encoding=3, text=subtitle)  # Set subtitle as TSST (Set subtitle)

        if rating:
            # POPM is structured: email, rating (0-255), play count
            audio['POPM'] = POPM(email='user@example.com', rating=int(rating), count=0)

        if album_artist:
            audio['TPE2'] = TPE2(encoding=3, text=album_artist)

        if disc_number:
            audio['TPOS'] = TPOS(encoding=3, text=str(disc_number))

        if length:
            # TLEN expects duration in milliseconds
            mins, secs = map(int, length.split(':'))
            millis = (mins * 60 + secs) * 1000
            audio['TLEN'] = TLEN(encoding=3, text=str(millis))

        if bit_rate:
            set_txxx(audio, 'Bitrate', str(bit_rate))  # No standard tag for bitrate; custom TXXX

        if isrc:
            audio['TSRC'] = TSRC(encoding=3, text=isrc)

        # Save changes
        try:
            audio.save()
            print("Metadata embedded successfully!")
        except Exception as e:
            print(f"Error saving metadata: {e}")

        # Download and embed album art
        if album_art_path:
            try:
                with open(album_art_path, 'rb') as img_file:
                    image_data = img_file.read()

                mime_type = magic.Magic(mime=True).from_buffer(image_data[:2048])

                if mime_type in ['image/jpeg', 'image/png']:
                    audio.tags.add(APIC(
                        encoding=3,       # UTF-8
                        mime=mime_type,   # image mime type
                        type=3,           # front cover
                        desc='Cover',
                        data=image_data
                    ))
                else:
                    print("Unsupported image format. Convert to JPEG or PNG before embedding.")

            except FileNotFoundError:
                print(f"Album art file not found: {album_art_path}")
            except Exception as e:
                print(f"Error loading album art: {e}")

        try:
            audio.save(v2_version=3)  # Save with ID3v2.3 tag version
            print("Album art and metadata saved successfully!")
        except Exception as e:
            print(f"Error saving album art: {e}")


if __name__ == "__main__":
    with open('fetch_metadata_output.txt', 'r', encoding='utf-8') as f:
        input_json = f.read()

    metadata_list = json.loads(input_json)  # Now metadata_list is a Python list
    print(f"Read list with {len(metadata_list)} entries.")

    embed_metadata(metadata_list) 
    # Print JSON stringified results for Node.js to parse
    #with open("fetch_metadata_output.txt", "w", encoding="utf-8") as f:
        #json.dump(results, f, ensure_ascii=False, indent=2)