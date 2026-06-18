import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { promises as fs } from 'fs'
import { join } from 'path'

const app = new Hono()

// Enable CORS for frontend development
app.use('/api/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}))

const DOWNLOADS_DIR = '/home/edu/Dev/Omniplayer/downloads'
const DB_PATH = join('/home/edu/Dev/Omniplayer/backend-hono', 'database.json')
const PYTHON_API_URL = 'http://127.0.0.1:8000'

// Initialize database if it doesn't exist
async function initDb() {
  try {
    await fs.access(DB_PATH)
  } catch {
    await fs.writeFile(DB_PATH, JSON.stringify({
      downloadPath: DOWNLOADS_DIR,
      songs: [],
      playlists: []
    }, null, 2))
  }
}

interface Song {
  id: string;
  title: string;
  artist: string;
  album: string;
  year: string;
  duration: number;
  filename: string; // empty means streaming (not downloaded)
  url: string;
  thumbnail: string | null;
  addedAt?: string;
  liked?: boolean;
  isDownloaded: boolean;
}

interface Playlist {
  id: string;
  name: string;
  description: string;
  coverUrl: string | null;
  songIds: string[];
  createdAt: string;
}

interface LibraryDb {
  downloadPath: string;
  songs: Song[];
  playlists: Playlist[];
}

// Read database with automatic migration checks
async function readDb(): Promise<LibraryDb> {
  await initDb()
  const raw = await fs.readFile(DB_PATH, 'utf-8')
  let data = JSON.parse(raw)
  
  let migrated = false

  // 1. If it was a simple flat array of songs
  if (Array.isArray(data)) {
    data = {
      downloadPath: DOWNLOADS_DIR,
      songs: data,
      playlists: []
    }
    migrated = true
  }

  // 2. Ensure basic properties exist
  if (!data.downloadPath) {
    data.downloadPath = DOWNLOADS_DIR
    migrated = true
  }
  if (!data.songs) {
    data.songs = []
    migrated = true
  }
  if (!data.playlists) {
    data.playlists = []
    migrated = true
  }

  // 3. Migrate songs to have isDownloaded flag
  data.songs = data.songs.map((song: any) => {
    const isDownloaded = typeof song.isDownloaded === 'boolean' 
      ? song.isDownloaded 
      : (song.filename && song.filename.length > 0);
    
    if (song.isDownloaded !== isDownloaded || typeof song.liked !== 'boolean') {
      migrated = true;
      return {
        ...song,
        isDownloaded,
        liked: typeof song.liked === 'boolean' ? song.liked : false
      };
    }
    return song;
  });

  if (migrated) {
    await writeDb(data)
  }
  return data as LibraryDb
}

// Write database
async function writeDb(data: LibraryDb) {
  await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2))
}

// Check if a song is still used in any playlist or liked
function isSongActive(song: Song, playlists: Playlist[]): boolean {
  if (song.liked || song.isDownloaded) return true;
  return playlists.some(p => p.songIds.includes(song.id));
}

// Serve root message
app.get('/', (c) => {
  return c.text('Omniplayer Hono Backend Active')
})

// Search songs on YouTube (proxies to Python API)
app.get('/api/search', async (c) => {
  const query = c.req.query('q')
  if (!query) {
    return c.json({ error: 'Search query is required' }, 400)
  }

  try {
    const response = await fetch(`${PYTHON_API_URL}/search?q=${encodeURIComponent(query)}`)
    if (!response.ok) {
      return c.json({ error: 'Failed to search YouTube from Python service' }, 500)
    }
    const data = await response.json()
    return c.json(data)
  } catch (error: any) {
    console.error('Error fetching search results:', error)
    return c.json({ error: 'Python downloader service offline or unreachable', details: error.message }, 503)
  }
})

// Stream song from YouTube directly (proxies to Python API)
app.get('/api/stream', async (c) => {
  const url = c.req.query('url')
  if (!url) {
    return c.json({ error: 'YouTube URL is required' }, 400)
  }

  try {
    const response = await fetch(`${PYTHON_API_URL}/stream?url=${encodeURIComponent(url)}`)
    if (!response.ok) {
      const errText = await response.text()
      return c.json({ error: 'Failed to extract stream from Python service', details: errText }, 500)
    }
    const data = await response.json()
    return c.json(data)
  } catch (error: any) {
    console.error('Error proxying stream URL:', error)
    return c.json({ error: 'Python downloader service offline or unreachable', details: error.message }, 503)
  }
})

// List downloaded songs and configuration
app.get('/api/songs', async (c) => {
  try {
    const db = await readDb()
    return c.json(db) // Returns { downloadPath, songs, playlists }
  } catch (error: any) {
    return c.json({ error: 'Failed to read library', details: error.message }, 500)
  }
})

// Update library storage configuration path
app.post('/api/config', async (c) => {
  try {
    const { downloadPath } = await c.req.json()
    if (!downloadPath) {
      return c.json({ error: 'Download path is required' }, 400)
    }

    try {
      await fs.mkdir(downloadPath, { recursive: true })
    } catch (err: any) {
      return c.json({ error: `Cannot write or create directory: ${err.message}` }, 400)
    }

    const db = await readDb()
    db.downloadPath = downloadPath
    await writeDb(db)

    console.log(`Library storage path updated to: ${downloadPath}`)
    return c.json({ success: true, downloadPath })
  } catch (error: any) {
    return c.json({ error: 'Failed to save configuration', details: error.message }, 500)
  }
})

// Like / Unlike song (adds it to library virtually if not downloaded)
app.post('/api/songs/like', async (c) => {
  try {
    const { song, liked } = await c.req.json()
    if (!song || !song.id) {
      return c.json({ error: 'Song details are required' }, 400)
    }

    const db = await readDb()
    const songIndex = db.songs.findIndex((s: any) => s.id === song.id)

    if (songIndex > -1) {
      // Song exists, toggle liked status
      db.songs[songIndex].liked = liked
      
      // Cleanup: If not downloaded AND not liked AND not in any playlist, remove from global list
      if (!liked && !db.songs[songIndex].isDownloaded && !isSongActive(db.songs[songIndex], db.playlists)) {
        db.songs.splice(songIndex, 1)
      }
    } else if (liked) {
      // Song doesn't exist, create it virtually
      const newSong: Song = {
        id: song.id,
        title: song.title,
        artist: song.artist,
        album: song.album || 'YouTube Stream',
        year: song.year || 'Unknown',
        duration: song.duration,
        filename: '', // empty means not downloaded
        url: song.url,
        thumbnail: song.thumbnail,
        liked: true,
        isDownloaded: false,
        addedAt: new Date().toISOString()
      }
      db.songs.push(newSong)
    }

    await writeDb(db)
    return c.json({ success: true, songs: db.songs })
  } catch (error: any) {
    console.error('Like toggle error:', error)
    return c.json({ error: 'Failed to toggle like', details: error.message }, 500)
  }
})

// Download song (and link with liked status if already liked)
app.post('/api/download', async (c) => {
  try {
    const { url } = await c.req.json()
    if (!url) {
      return c.json({ error: 'YouTube URL is required' }, 400)
    }

    const db = await readDb()
    const activePath = db.downloadPath || DOWNLOADS_DIR

    console.log(`Forwarding download request to Python API for URL: ${url} (Path: ${activePath})`)

    const response = await fetch(`${PYTHON_API_URL}/download`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        url,
        download_path: activePath
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Python download service error:', errorText)
      return c.json({ error: 'Downloader failed to fetch/convert video', details: errorText }, 500)
    }

    const result = await response.json()
    if (result.success && result.metadata) {
      // Find if song was already liked/in database
      const existingIndex = db.songs.findIndex((s: any) => s.id === result.metadata.id)
      const wasLiked = existingIndex > -1 ? db.songs[existingIndex].liked : false

      const songMetadata: Song = {
        id: result.metadata.id,
        title: result.metadata.title,
        artist: result.metadata.artist,
        album: result.metadata.album || 'YouTube Single',
        year: result.metadata.year || 'Unknown',
        duration: result.metadata.duration,
        filename: result.metadata.filename,
        url: result.metadata.url,
        thumbnail: result.metadata.thumbnail,
        liked: wasLiked,
        isDownloaded: true,
        addedAt: new Date().toISOString()
      }

      if (existingIndex > -1) {
        db.songs[existingIndex] = songMetadata
      } else {
        db.songs.push(songMetadata)
      }

      await writeDb(db)
      return c.json({ success: true, song: songMetadata })
    } else {
      return c.json({ error: 'Invalid response from downloader service' }, 500)
    }
  } catch (error: any) {
    console.error('Download route error:', error)
    return c.json({ error: 'Downloader service is unreachable', details: error.message }, 503)
  }
})

// Delete downloaded file (keeps entry in database as streaming only if liked or in playlist)
app.delete('/api/songs/:id', async (c) => {
  const id = c.req.param('id')
  try {
    const db = await readDb()
    const songIndex = db.songs.findIndex((s: any) => s.id === id)
    if (songIndex === -1) {
      return c.json({ error: 'Song not found in library' }, 404)
    }

    const song = db.songs[songIndex]
    
    // Delete file if it exists on disk
    if (song.filename) {
      const filePath = join(db.downloadPath, song.filename)
      try {
        await fs.unlink(filePath)
        console.log(`Deleted audio file from disk: ${filePath}`)
      } catch (err: any) {
        console.warn(`File could not be deleted from disk: ${err.message}`)
      }
    }

    // Update state to not downloaded
    song.isDownloaded = false
    song.filename = ""

    // Remove from DB if not liked and not used in any playlist
    if (!isSongActive(song, db.playlists)) {
      db.songs.splice(songIndex, 1)
      console.log(`Removed song ${id} completely from library index.`)
    } else {
      db.songs[songIndex] = song
      console.log(`Kept song ${id} in library index as virtual (liked/in-playlist).`)
    }

    await writeDb(db)
    return c.json({ success: true, message: 'Song deleted from disk successfully' })
  } catch (error: any) {
    return c.json({ error: 'Failed to delete song', details: error.message }, 500)
  }
})

// Playlists: Create a new playlist
app.post('/api/playlists', async (c) => {
  try {
    const { name, description, coverUrl } = await c.req.json()
    if (!name) {
      return c.json({ error: 'Playlist name is required' }, 400)
    }

    const db = await readDb()
    const newPlaylist: Playlist = {
      id: 'pl_' + Math.random().toString(36).substring(2, 11),
      name,
      description: description || '',
      coverUrl: coverUrl || null,
      songIds: [],
      createdAt: new Date().toISOString()
    }

    db.playlists.push(newPlaylist)
    await writeDb(db)

    return c.json(newPlaylist)
  } catch (error: any) {
    return c.json({ error: 'Failed to create playlist', details: error.message }, 500)
  }
})

// Playlists: Delete a playlist
app.delete('/api/playlists/:id', async (c) => {
  const id = c.req.param('id')
  try {
    const db = await readDb()
    const plIndex = db.playlists.findIndex(p => p.id === id)
    if (plIndex === -1) {
      return c.json({ error: 'Playlist not found' }, 404)
    }

    db.playlists.splice(plIndex, 1)
    
    // Cleanup songs that are no longer used anywhere
    db.songs = db.songs.filter(s => isSongActive(s, db.playlists))

    await writeDb(db)
    return c.json({ success: true, message: 'Playlist deleted successfully' })
  } catch (error: any) {
    return c.json({ error: 'Failed to delete playlist', details: error.message }, 500)
  }
})

// Playlists: Add song to playlist
app.post('/api/playlists/:id/songs', async (c) => {
  const playlistId = c.req.param('id')
  try {
    const { song } = await c.req.json()
    if (!song || !song.id) {
      return c.json({ error: 'Song details are required' }, 400)
    }

    const db = await readDb()
    const plIndex = db.playlists.findIndex(p => p.id === playlistId)
    if (plIndex === -1) {
      return c.json({ error: 'Playlist not found' }, 404)
    }

    // Add song to global index if not exists (virtually, not downloaded)
    const songIndex = db.songs.findIndex(s => s.id === song.id)
    if (songIndex === -1) {
      const newSong: Song = {
        id: song.id,
        title: song.title,
        artist: song.artist,
        album: song.album || 'YouTube Stream',
        year: song.year || 'Unknown',
        duration: song.duration,
        filename: '', 
        url: song.url,
        thumbnail: song.thumbnail,
        liked: false,
        isDownloaded: false,
        addedAt: new Date().toISOString()
      }
      db.songs.push(newSong)
    }

    // Append to playlist
    if (!db.playlists[plIndex].songIds.includes(song.id)) {
      db.playlists[plIndex].songIds.push(song.id)
    }

    await writeDb(db)
    return c.json(db.playlists[plIndex])
  } catch (error: any) {
    return c.json({ error: 'Failed to add song to playlist', details: error.message }, 500)
  }
})

// Playlists: Remove song from playlist
app.delete('/api/playlists/:id/songs/:songId', async (c) => {
  const playlistId = c.req.param('id')
  const songId = c.req.param('songId')
  try {
    const db = await readDb()
    const plIndex = db.playlists.findIndex(p => p.id === playlistId)
    if (plIndex === -1) {
      return c.json({ error: 'Playlist not found' }, 404)
    }

    // Remove from playlist
    db.playlists[plIndex].songIds = db.playlists[plIndex].songIds.filter(id => id !== songId)

    // Cleanup song from global list if no longer used anywhere
    const songIndex = db.songs.findIndex(s => s.id === songId)
    if (songIndex > -1 && !isSongActive(db.songs[songIndex], db.playlists)) {
      db.songs.splice(songIndex, 1)
    }

    await writeDb(db)
    return c.json(db.playlists[plIndex])
  } catch (error: any) {
    return c.json({ error: 'Failed to remove song from playlist', details: error.message }, 500)
  }
})

// Custom static server supporting HTTP Range requests for seekability
app.get('/songs/:filename', async (c) => {
  const filename = c.req.param('filename')
  
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return c.text('Forbidden', 403)
  }

  const db = await readDb()
  const filePath = join(db.downloadPath, filename)

  try {
    const stat = await fs.stat(filePath)
    const fileSize = stat.size
    const range = c.req.header('range')

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-')
      const start = parseInt(parts[0], 10)
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1

      if (start >= fileSize || end >= fileSize) {
        return c.body('Requested Range Not Satisfiable', 416, {
          'Content-Range': `bytes */${fileSize}`
        })
      }

      const chunksize = (end - start) + 1
      const file = await fs.open(filePath, 'r')
      const buffer = Buffer.alloc(chunksize)
      await file.read(buffer, 0, chunksize, start)
      await file.close()

      return c.body(buffer, 206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize.toString(),
        'Content-Type': 'audio/mpeg',
      })
    } else {
      const data = await fs.readFile(filePath)
      return c.body(data, 200, {
        'Content-Length': fileSize.toString(),
        'Content-Type': 'audio/mpeg',
        'Accept-Ranges': 'bytes',
      })
    }
  } catch (error: any) {
    console.error(`Error serving file ${filename}:`, error.message)
    return c.text('Song file not found', 404)
  }
})

// Playlists: Import from YouTube URL
app.post('/api/playlists/import', async (c) => {
  try {
    const { url } = await c.req.json()
    if (!url) {
      return c.json({ error: 'Playlist URL is required' }, 400)
    }

    console.log(`Forwarding playlist extraction to Python API: ${url}`)
    const response = await fetch(`${PYTHON_API_URL}/playlist/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    })

    if (!response.ok) {
      const errText = await response.text()
      return c.json({ error: 'Failed to extract playlist from YouTube service', details: errText }, 500)
    }

    const data = await response.json()
    if (!data.success) {
      return c.json({ error: 'Failed to extract playlist metadata' }, 500)
    }

    const db = await readDb()
    const newPlaylistId = 'pl_' + Math.random().toString(36).substring(2, 11)
    const songIds: string[] = []
    
    // Add playlist tracks virtually to library if not exist
    for (const song of data.songs) {
      const existingIndex = db.songs.findIndex((s: any) => s.id === song.id)
      if (existingIndex === -1) {
        const newSong: Song = {
          id: song.id,
          title: song.title,
          artist: song.artist,
          album: data.title || 'YouTube Playlist',
          year: 'Unknown',
          duration: song.duration,
          filename: '', 
          url: song.url,
          thumbnail: song.thumbnail,
          liked: false,
          isDownloaded: false,
          addedAt: new Date().toISOString()
        }
        db.songs.push(newSong)
      }
      songIds.push(song.id)
    }

    // Create playlist structure
    const newPlaylist: Playlist = {
      id: newPlaylistId,
      name: data.title,
      description: data.description || 'Imported from YouTube',
      coverUrl: data.coverUrl || null,
      songIds,
      createdAt: new Date().toISOString()
    }

    db.playlists.push(newPlaylist)
    await writeDb(db)

    return c.json({ success: true, playlist: newPlaylist, songsCount: songIds.length })
  } catch (error: any) {
    console.error('Playlist import error:', error)
    return c.json({ error: 'Failed to import playlist', details: error.message }, 500)
  }
})

// Playlists: Upload custom cover file
app.post('/api/playlists/upload-cover', async (c) => {
  try {
    const body = await c.req.parseBody()
    const file = body['file'] as any
    
    if (!file || !file.name) {
      return c.json({ error: 'No file uploaded' }, 400)
    }

    const db = await readDb()
    const extension = file.name.split('.').pop() || 'jpg'
    const uniqueFilename = `cover_pl_${Math.random().toString(36).substring(2, 11)}_${Date.now()}.${extension}`
    const filePath = join(db.downloadPath, uniqueFilename)

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    await fs.writeFile(filePath, buffer)

    console.log(`Saved custom playlist cover file: ${filePath}`)
    
    const coverUrl = `http://127.0.0.1:3000/songs/${uniqueFilename}`
    return c.json({ success: true, coverUrl })
  } catch (error: any) {
    console.error('Cover upload error:', error)
    return c.json({ error: 'Failed to upload cover file', details: error.message }, 500)
  }
})

// Playlists: Edit playlist info
app.put('/api/playlists/:id', async (c) => {
  const id = c.req.param('id')
  try {
    const { name, description, coverUrl } = await c.req.json()
    if (!name) {
      return c.json({ error: 'Playlist name is required' }, 400)
    }

    const db = await readDb()
    const plIndex = db.playlists.findIndex(p => p.id === id)
    if (plIndex === -1) {
      return c.json({ error: 'Playlist not found' }, 404)
    }

    db.playlists[plIndex].name = name
    db.playlists[plIndex].description = description || ''
    db.playlists[plIndex].coverUrl = coverUrl || null

    await writeDb(db)
    return c.json(db.playlists[plIndex])
  } catch (error: any) {
    console.error('Playlist edit error:', error)
    return c.json({ error: 'Failed to edit playlist details', details: error.message }, 500)
  }
})

// Start server
const port = 3000
serve({
  fetch: app.fetch,
  port
}, (info) => {
  console.log(`Hono backend running at http://localhost:${info.port}`)
})
