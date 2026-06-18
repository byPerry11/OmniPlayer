import os
import logging
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import yt_dlp

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("omniplayer-downloader")

app = FastAPI(title="Omniplayer Downloader API")

# Allow CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DOWNLOADS_DIR = "/home/edu/Dev/Omniplayer/downloads"
FFMPEG_PATH = "/home/edu/Dev/Omniplayer/bin"

os.makedirs(DOWNLOADS_DIR, exist_ok=True)

class DownloadRequest(BaseModel):
    url: str
    download_path: str = "/home/edu/Dev/Omniplayer/downloads"

@app.get("/search")
def search_youtube(q: str, limit: int = 10):
    if not q:
        raise HTTPException(status_code=400, detail="Search query cannot be empty")
    
    logger.info(f"Searching YouTube for: {q}")
    ydl_opts = {
        'format': 'bestaudio/best',
        'noplaylist': True,
        'extract_flat': True,
        'quiet': True,
    }
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            # ytsearchX:query returns X results
            search_query = f"ytsearch{limit}:{q}"
            result = ydl.extract_info(search_query, download=False)
            
            songs = []
            if 'entries' in result:
                for entry in result['entries']:
                    if not entry:
                        continue
                    
                    # Some entries might be private or unavailable
                    video_id = entry.get('id')
                    if not video_id:
                        continue
                        
                    # Extract thumbnails
                    thumbnails = entry.get('thumbnails', [])
                    thumbnail_url = None
                    if thumbnails:
                        # Grab the best quality thumbnail or the first one
                        thumbnail_url = thumbnails[-1].get('url') if thumbnails else None
                        
                    songs.append({
                        "id": video_id,
                        "title": entry.get("title", "Unknown Title"),
                        "artist": entry.get("uploader", "Unknown Artist"),
                        "duration": entry.get("duration", 0),
                        "url": f"https://www.youtube.com/watch?v={video_id}",
                        "thumbnail": thumbnail_url
                    })
            return {"results": songs}
    except Exception as e:
        logger.error(f"Error searching YouTube: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")

@app.post("/download")
def download_audio(request: DownloadRequest):
    url = request.url
    download_dir = request.download_path or DOWNLOADS_DIR
    if not url:
        raise HTTPException(status_code=400, detail="URL is required")
        
    logger.info(f"Downloading from URL: {url} to folder: {download_dir}")
    
    # Ensure custom directory exists
    os.makedirs(download_dir, exist_ok=True)
    
    # Define yt-dlp options
    ydl_opts = {
        'format': 'bestaudio/best',
        'outtmpl': os.path.join(download_dir, '%(id)s.%(ext)s'),
        'ffmpeg_location': FFMPEG_PATH,
        'writethumbnail': True,
        'updatetime': False, # Avoid modifying the file modification time
        'nokeepalive': True,
        'youtube_include_dash_manifest': False,
        'youtube_include_hls_manifest': False,
        'extractor_args': {
            'youtube': {
                'player_client': ['web', 'default']
            }
        },
        'postprocessors': [
            {
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '192',
            },
            {
                # Embed the downloaded thumbnail into the audio file
                'key': 'EmbedThumbnail',
            },
            {
                # Add metadata (title, artist, etc.) to the audio file
                'key': 'FFmpegMetadata',
                'add_chapters': True,
                'add_metadata': True,
            }
        ],
        'quiet': False,
    }
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            # Extract info first
            info = ydl.extract_info(url, download=True)
            video_id = info.get('id')
            
            # Extract rich metadata if available
            track_title = info.get('track') or info.get('title') or 'Unknown Title'
            artist_name = info.get('artist') or info.get('creator') or info.get('uploader') or 'Unknown Artist'
            album_name = info.get('album') or 'YouTube Single'
            
            # Release year logic (uploader date year fallback)
            release_year = info.get('release_year')
            if not release_year and info.get('upload_date'):
                try:
                    release_year = int(info.get('upload_date')[:4])
                except ValueError:
                    release_year = None
            if not release_year:
                release_year = 'Unknown'
                
            duration = info.get('duration', 0)
            
            # Clean up the thumbnail file that yt-dlp writes temporarily
            # yt-dlp usually deletes this automatically, but just in case:
            possible_thumb = os.path.join(download_dir, f"{video_id}.jpg")
            if os.path.exists(possible_thumb):
                try:
                    os.remove(possible_thumb)
                except Exception:
                    pass
            
            possible_thumb_webp = os.path.join(download_dir, f"{video_id}.webp")
            if os.path.exists(possible_thumb_webp):
                try:
                    os.remove(possible_thumb_webp)
                except Exception:
                    pass
            
            # Form metadata response with advanced metadata
            metadata = {
                "id": video_id,
                "title": track_title,
                "artist": artist_name,
                "album": album_name,
                "year": str(release_year),
                "duration": duration,
                "filename": f"{video_id}.mp3",
                "url": url,
                "thumbnail": info.get('thumbnail')
            }
            logger.info(f"Successfully downloaded and processed: {track_title}")
            return {"success": True, "metadata": metadata}
            
    except Exception as e:
        logger.error(f"Error downloading video: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Download failed: {str(e)}")

@app.get("/stream")
def get_stream_url(url: str):
    if not url:
        raise HTTPException(status_code=400, detail="URL is required")
        
    logger.info(f"Extracting stream URL for: {url}")
    ydl_opts = {
        'format': 'bestaudio/best',
        'noplaylist': True,
        'quiet': True,
        'nokeepalive': True,
        'youtube_include_dash_manifest': False,
        'youtube_include_hls_manifest': False,
        'extractor_args': {
            'youtube': {
                'player_client': ['web', 'default']
            }
        },
    }
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            stream_url = info.get('url')
            if not stream_url:
                formats = info.get('formats', [])
                audio_formats = [f for f in formats if f.get('vcodec') == 'none' and f.get('acodec') != 'none']
                if audio_formats:
                    stream_url = audio_formats[-1].get('url')
                    
            if not stream_url:
                raise HTTPException(status_code=404, detail="No playable audio stream found")
                
            track_title = info.get('track') or info.get('title') or 'Unknown Title'
            artist_name = info.get('artist') or info.get('creator') or info.get('uploader') or 'Unknown Artist'
            album_name = info.get('album') or 'YouTube Stream'
            
            release_year = info.get('release_year')
            if not release_year and info.get('upload_date'):
                try:
                    release_year = int(info.get('upload_date')[:4])
                except ValueError:
                    release_year = None
            if not release_year:
                release_year = 'Unknown'
                
            return {
                "success": True,
                "stream_url": stream_url,
                "metadata": {
                    "id": info.get('id'),
                    "title": track_title,
                    "artist": artist_name,
                    "album": album_name,
                    "year": str(release_year),
                    "duration": info.get('duration', 0),
                    "thumbnail": info.get('thumbnail'),
                    "url": url
                }
            }
    except Exception as e:
        logger.error(f"Error extracting stream: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Streaming failed: {str(e)}")

class PlaylistExtractRequest(BaseModel):
    url: str

@app.post("/playlist/extract")
def extract_playlist(request: PlaylistExtractRequest):
    url = request.url
    if not url:
        raise HTTPException(status_code=400, detail="Playlist URL is required")
        
    logger.info(f"Extracting YouTube playlist info from: {url}")
    ydl_opts = {
        'extract_flat': True,
        'quiet': True,
        'noplaylist': False,
    }
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            
            # Check if it is a playlist
            if 'entries' not in info:
                raise HTTPException(status_code=400, detail="Provided URL is not a YouTube playlist")
                
            playlist_title = info.get('title') or 'YouTube Playlist'
            playlist_desc = info.get('description') or 'Imported from YouTube'
            
            # Get playlist thumbnail
            playlist_thumbnails = info.get('thumbnails', [])
            playlist_cover = playlist_thumbnails[-1].get('url') if playlist_thumbnails else None
            
            songs = []
            for entry in info['entries']:
                if not entry:
                    continue
                video_id = entry.get('id')
                if not video_id:
                    continue
                
                # Check for thumbnails
                thumbnails = entry.get('thumbnails', [])
                thumbnail_url = thumbnails[-1].get('url') if thumbnails else None
                if not thumbnail_url:
                    thumbnail_url = f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg"
                
                songs.append({
                    "id": video_id,
                    "title": entry.get("title") or "Unknown Title",
                    "artist": entry.get("uploader") or "Unknown Artist",
                    "duration": int(entry.get("duration") or 0),
                    "url": f"https://www.youtube.com/watch?v={video_id}",
                    "thumbnail": thumbnail_url
                })
                
            return {
                "success": True,
                "title": playlist_title,
                "description": playlist_desc,
                "coverUrl": playlist_cover,
                "songs": songs
            }
    except Exception as e:
        logger.error(f"Error extracting playlist: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Playlist extraction failed: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
