import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Pause, 
  SkipForward, 
  SkipBack, 
  Search, 
  Music, 
  Download, 
  Trash2, 
  Volume2, 
  VolumeX, 
  RotateCw, 
  FolderHeart, 
  Disc, 
  ListMusic,
  CheckCircle,
  AlertCircle,
  FolderOpen,
  Heart,
  HardDrive,
  Wifi,
  WifiOff,
  Plus,
  ListPlus,
  Pencil,
  Upload,
  Shuffle,
  Repeat
} from 'lucide-react';
import ThreeDVisualizer from './ThreeDVisualizer';

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

interface SearchResult {
  id: string;
  title: string;
  artist: string;
  duration: number;
  url: string;
  thumbnail: string | null;
}

type ThemeMode = 'green' | 'red' | 'blue' | 'gold';

const API_BASE = 'http://127.0.0.1:3000/api';
const AUDIO_BASE = 'http://127.0.0.1:3000/songs';

export default function App() {
  // App states
  const [activeTab, setActiveTab] = useState<'library' | 'search' | 'playlist'>('library');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [library, setLibrary] = useState<Song[]>([]);
  const [isLoadingSearch, setIsLoadingSearch] = useState(false);
  const [downloadingIds, setDownloadingIds] = useState<Record<string, 'downloading' | 'success' | 'error'>>({});
  
  // Custom directory state
  const [downloadPath, setDownloadPath] = useState('/home/edu/Dev/Omniplayer/downloads');
  const [showPathModal, setShowPathModal] = useState(false);
  const [pathInput, setPathInput] = useState('');
  const [pathStatus, setPathStatus] = useState<{ type: 'success' | 'error' | null, message: string }>({ type: null, message: '' });

  // Playlists states
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [newPlName, setNewPlName] = useState('');
  const [newPlDesc, setNewPlDesc] = useState('');
  const [newPlCover, setNewPlCover] = useState('');
  const [showAddToPlModal, setShowAddToPlModal] = useState<Song | SearchResult | null>(null);

  // Import playlist states
  const [showImportPlModal, setShowImportPlModal] = useState(false);
  const [importPlUrl, setImportPlUrl] = useState('');
  const [isImportingPl, setIsImportingPl] = useState(false);

  // Edit playlist states
  const [showEditPlModal, setShowEditPlModal] = useState(false);
  const [editingPlId, setEditingPlId] = useState<string | null>(null);
  const [editPlName, setEditPlName] = useState('');
  const [editPlDesc, setEditPlDesc] = useState('');
  const [editPlCover, setEditPlCover] = useState('');
  const [isUploadingCover, setIsUploadingCover] = useState(false);

  // Network connection state
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Theme state: classic green, albedo red, ultimate blue, mad ben gold
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('omniplayer_theme');
    return (saved as ThemeMode) || 'green';
  });

  // Playback states
  const [currentTrack, setCurrentTrack] = useState<Song | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState<number>(() => {
    const saved = localStorage.getItem('omniplayer_volume');
    return saved !== null ? parseFloat(saved) : 0.8;
  });
  const [isMuted, setIsMuted] = useState<boolean>(() => {
    const saved = localStorage.getItem('omniplayer_muted');
    return saved === 'true';
  });
  const [isShuffle, setIsShuffle] = useState<boolean>(() => {
    const saved = localStorage.getItem('omniplayer_shuffle');
    return saved === 'true';
  });
  const [isRepeat, setIsRepeat] = useState<boolean>(() => {
    const saved = localStorage.getItem('omniplayer_repeat');
    return saved === 'true';
  });
  const [queue, setQueue] = useState<Song[]>([]);
  const [currentQueueIndex, setCurrentQueueIndex] = useState(-1);

  // Streaming states
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [isExtractingStream, setIsExtractingStream] = useState(false);

  // HTML Audio Ref
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Apply Theme CSS variables
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'green') {
      root.style.setProperty('--color-green-neon', '#00ff66');
      root.style.setProperty('--color-green-neon-glow', 'rgba(0, 255, 102, 0.4)');
      root.style.setProperty('--color-green-dim', '#05b84c');
      root.style.setProperty('--color-green-dark', '#093016');
    } else if (theme === 'red') {
      root.style.setProperty('--color-green-neon', '#ff003c');
      root.style.setProperty('--color-green-neon-glow', 'rgba(255, 0, 60, 0.4)');
      root.style.setProperty('--color-green-dim', '#c2002d');
      root.style.setProperty('--color-green-dark', '#3d020d');
    } else if (theme === 'blue') {
      root.style.setProperty('--color-green-neon', '#00bfff');
      root.style.setProperty('--color-green-neon-glow', 'rgba(0, 191, 255, 0.4)');
      root.style.setProperty('--color-green-dim', '#0090c2');
      root.style.setProperty('--color-green-dark', '#022b3a');
    } else if (theme === 'gold') {
      root.style.setProperty('--color-green-neon', '#ffb700');
      root.style.setProperty('--color-green-neon-glow', 'rgba(255, 183, 0, 0.4)');
      root.style.setProperty('--color-green-dim', '#c28b00');
      root.style.setProperty('--color-green-dark', '#3b2a02');
    }
  }, [theme]);

  // Persist playback preferences in localStorage
  useEffect(() => {
    localStorage.setItem('omniplayer_theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('omniplayer_volume', volume.toString());
  }, [volume]);

  useEffect(() => {
    localStorage.setItem('omniplayer_muted', isMuted.toString());
  }, [isMuted]);

  useEffect(() => {
    localStorage.setItem('omniplayer_shuffle', isShuffle.toString());
  }, [isShuffle]);

  useEffect(() => {
    localStorage.setItem('omniplayer_repeat', isRepeat.toString());
  }, [isRepeat]);

  // Load library on mount
  useEffect(() => {
    fetchLibrary();
  }, []);

  // Sync Library with Queue
  useEffect(() => {
    if (library.length > 0 && queue.length === 0) {
      setQueue(library);
    }
  }, [library, queue]);

  // Network connection state listener
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
    };
    const handleOffline = () => {
      setIsOnline(false);
      // Pause streaming tracks if we go offline
      if (currentTrack && !currentTrack.isDownloaded) {
        setIsPlaying(false);
        alert('Conexión de red perdida. Las canciones online se han deshabilitado.');
      }
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [currentTrack]);

  // Fetch stream URL for virtual tracks
  const fetchStreamUrl = async (song: Song) => {
    setIsExtractingStream(true);
    setStreamUrl(null);
    try {
      const response = await fetch(`${API_BASE}/stream?url=${encodeURIComponent(song.url)}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.stream_url) {
          setStreamUrl(data.stream_url);
          setIsPlaying(true);
        } else {
          alert('No se pudo obtener el enlace de reproducción de YouTube.');
          setIsPlaying(false);
        }
      } else {
        alert('Error al conectar con el servidor de streaming.');
        setIsPlaying(false);
      }
    } catch (err) {
      console.error('Streaming error:', err);
      alert('Error de red al intentar reproducir desde YouTube.');
      setIsPlaying(false);
    } finally {
      setIsExtractingStream(false);
    }
  };

  // Sync virtual tracks streaming loading
  useEffect(() => {
    if (!currentTrack) return;
    
    // If it's a virtual track (no local filename)
    if (!currentTrack.filename) {
      if (isOnline) {
        fetchStreamUrl(currentTrack);
      } else {
        setIsPlaying(false);
        alert('Esta canción requiere conexión a internet para reproducirse.');
      }
    } else {
      setStreamUrl(null);
    }
  }, [currentTrack]);

  const handleNextRef = useRef<(() => void) | null>(null);
  const isRepeatRef = useRef<boolean>(false);

  useEffect(() => {
    handleNextRef.current = handleNext;
    isRepeatRef.current = isRepeat;
  });

  // Initialize dynamic HTML Audio element on mount
  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };
    const onLoadedMetadata = () => {
      setDuration(audio.duration);
    };
    const onEnded = () => {
      if (isRepeatRef.current) {
        audio.currentTime = 0;
        audio.play().catch(err => console.warn('Playback repeat error:', err));
      } else {
        if (handleNextRef.current) {
          handleNextRef.current();
        }
      }
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('ended', onEnded);
      audio.pause();
      audioRef.current = null;
    };
  }, []);

  // Sync Audio source when track or stream URL changes
  useEffect(() => {
    if (!audioRef.current) return;

    if (currentTrack) {
      if (currentTrack.isDownloaded && currentTrack.filename) {
        audioRef.current.src = `${AUDIO_BASE}/${encodeURIComponent(currentTrack.filename)}`;
      } else if (streamUrl) {
        audioRef.current.src = streamUrl;
      } else {
        return;
      }
      audioRef.current.load();
      if (isPlaying) {
        audioRef.current.play().catch(err => {
          console.warn('Playback error on src change:', err.message);
          setIsPlaying(false);
        });
      }
    } else {
      audioRef.current.src = '';
    }
  }, [currentTrack, streamUrl]);

  // Sync Audio Playback
  useEffect(() => {
    if (!audioRef.current) return;

    if (isPlaying) {
      // If we are currently extracting a stream, do not trigger play yet
      if (currentTrack && !currentTrack.filename && !streamUrl) {
        return;
      }
      audioRef.current.play().catch(err => {
        console.warn('Playback error:', err.message);
        setIsPlaying(false);
      });
    } else {
      audioRef.current.pause();
    }
  }, [isPlaying, currentTrack, streamUrl]);

  // Sync volume
  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.volume = isMuted ? 0 : volume;
  }, [volume, isMuted]);

  // Web Media Session API synchronization
  useEffect(() => {
    if ('mediaSession' in navigator && currentTrack) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.title,
        artist: currentTrack.artist,
        album: currentTrack.album || 'YouTube Library',
        artwork: [
          { 
            src: currentTrack.thumbnail || 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=512&q=80', 
            sizes: '512x512', 
            type: 'image/jpeg' 
          }
        ]
      });

      navigator.mediaSession.setActionHandler('play', () => setIsPlaying(true));
      navigator.mediaSession.setActionHandler('pause', () => setIsPlaying(false));
      navigator.mediaSession.setActionHandler('previoustrack', handlePrev);
      navigator.mediaSession.setActionHandler('nexttrack', handleNext);
    }
  }, [currentTrack]);

  // Fetch local library configuration & tracks
  const fetchLibrary = async () => {
    try {
      const response = await fetch(`${API_BASE}/songs`);
      if (response.ok) {
        const data = await response.json();
        setLibrary(data.songs || []);
        setPlaylists(data.playlists || []);
        setDownloadPath(data.downloadPath || '/home/edu/Dev/Omniplayer/downloads');
        setPathInput(data.downloadPath || '/home/edu/Dev/Omniplayer/downloads');
      }
    } catch (error) {
      console.error('Failed to load library:', error);
    }
  };

  // Search YouTube
  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsLoadingSearch(true);
    setSearchResults([]);
    try {
      const response = await fetch(`${API_BASE}/search?q=${encodeURIComponent(searchQuery)}`);
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.results || []);
      } else {
        alert('Search API error');
      }
    } catch (error) {
      console.error('Search error:', error);
      alert('Could not search. Make sure Hono and Python backends are running.');
    } finally {
      setIsLoadingSearch(false);
    }
  };

  // Save custom folder path configuration
  const handleSavePath = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pathInput.trim()) return;

    setPathStatus({ type: null, message: '' });
    try {
      const response = await fetch(`${API_BASE}/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ downloadPath: pathInput.trim() })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setDownloadPath(data.downloadPath);
        setPathStatus({ type: 'success', message: 'Ruta de almacenamiento guardada con éxito.' });
        
        setTimeout(() => {
          setShowPathModal(false);
          setPathStatus({ type: null, message: '' });
          fetchLibrary();
        }, 1200);
      } else {
        setPathStatus({ type: 'error', message: data.error || 'Error al guardar la ruta' });
      }
    } catch (err: any) {
      setPathStatus({ type: 'error', message: 'No se pudo conectar con el servidor backend.' });
    }
  };

  // Toggle Like status of a track
  const handleToggleLike = async (song: Song | SearchResult, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    
    // Find current liked status
    const existing = library.find(s => s.id === song.id);
    const wasLiked = existing ? !!existing.liked : false;
    const nextLiked = !wasLiked;

    try {
      const response = await fetch(`${API_BASE}/songs/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          song: {
            id: song.id,
            title: song.title,
            artist: song.artist,
            album: 'album' in song ? (song.album || 'YouTube Stream') : 'YouTube Stream',
            year: 'year' in song ? (song.year || 'Unknown') : 'Unknown',
            duration: song.duration,
            url: song.url,
            thumbnail: song.thumbnail
          },
          liked: nextLiked
        })
      });

      if (response.ok) {
        await fetchLibrary();
        
        // Dynamic state update for active current track
        if (currentTrack?.id === song.id) {
          setCurrentTrack(prev => prev ? { ...prev, liked: nextLiked } : null);
        }
      }
    } catch (error) {
      console.error('Failed to toggle like status:', error);
    }
  };

  // Playlists creation
  const handleCreatePlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlName.trim()) return;

    try {
      const response = await fetch(`${API_BASE}/playlists`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newPlName.trim(),
          description: newPlDesc.trim(),
          coverUrl: newPlCover.trim() || null
        })
      });

      if (response.ok) {
        setNewPlName('');
        setNewPlDesc('');
        setNewPlCover('');
        setShowPlaylistModal(false);
        await fetchLibrary();
      }
    } catch (error) {
      console.error('Failed to create playlist:', error);
    }
  };

  // Import playlist from YouTube URL
  const handleImportPlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importPlUrl.trim()) return;

    setIsImportingPl(true);
    try {
      const response = await fetch(`${API_BASE}/playlists/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: importPlUrl.trim() })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setImportPlUrl('');
        setShowImportPlModal(false);
        await fetchLibrary();
        
        if (data.playlist && data.playlist.id) {
          setSelectedPlaylistId(data.playlist.id);
          setActiveTab('playlist');
        }
        alert(`Playlist importada correctamente con ${data.songsCount} canciones virtuales.`);
      } else {
        alert(data.error || 'Error al importar playlist de YouTube.');
      }
    } catch (err) {
      console.error('Error importing playlist:', err);
      alert('Error de red al conectar con el servidor.');
    } finally {
      setIsImportingPl(false);
    }
  };

  // Cover image upload handler (for local file inputs)
  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>, isEditMode: boolean) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    if (isEditMode) {
      setIsUploadingCover(true);
    }
    
    try {
      const response = await fetch(`${API_BASE}/playlists/upload-cover`, {
        method: 'POST',
        body: formData
      });
      const data = await response.json();
      if (response.ok && data.coverUrl) {
        if (isEditMode) {
          setEditPlCover(data.coverUrl);
        } else {
          setNewPlCover(data.coverUrl);
        }
        alert('Imagen de portada subida correctamente.');
      } else {
        alert(data.error || 'Error al subir la imagen.');
      }
    } catch (err) {
      console.error('Error uploading cover:', err);
      alert('Error al subir la imagen al servidor.');
    } finally {
      setIsUploadingCover(false);
    }
  };

  // Open edit playlist modal helper
  const handleOpenEditPlaylist = (playlist: Playlist) => {
    setEditingPlId(playlist.id);
    setEditPlName(playlist.name);
    setEditPlDesc(playlist.description);
    setEditPlCover(playlist.coverUrl || '');
    setShowEditPlModal(true);
  };

  // Save edited playlist details
  const handleEditPlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlId || !editPlName.trim()) return;

    try {
      const response = await fetch(`${API_BASE}/playlists/${editingPlId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editPlName.trim(),
          description: editPlDesc.trim(),
          coverUrl: editPlCover.trim() || null
        })
      });

      if (response.ok) {
        setEditingPlId(null);
        setEditPlName('');
        setEditPlDesc('');
        setEditPlCover('');
        setShowEditPlModal(false);
        await fetchLibrary();
      } else {
        const data = await response.json();
        alert(data.error || 'Error al actualizar la playlist.');
      }
    } catch (error) {
      console.error('Failed to update playlist:', error);
      alert('Error de red al actualizar la playlist.');
    }
  };

  // Delete Playlist
  const handleDeletePlaylist = async (playlistId: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar esta playlist? Las canciones descargadas permanecerán en tu biblioteca.')) return;
    try {
      const response = await fetch(`${API_BASE}/playlists/${playlistId}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        if (selectedPlaylistId === playlistId) {
          setSelectedPlaylistId(null);
          setActiveTab('library');
        }
        await fetchLibrary();
      }
    } catch (error) {
      console.error('Failed to delete playlist:', error);
    }
  };

  // Add song to Playlist
  const handleAddSongToPlaylist = async (playlistId: string, song: Song | SearchResult) => {
    try {
      const response = await fetch(`${API_BASE}/playlists/${playlistId}/songs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          song: {
            id: song.id,
            title: song.title,
            artist: song.artist,
            album: 'album' in song ? (song.album || 'YouTube Stream') : 'YouTube Stream',
            year: 'year' in song ? (song.year || 'Unknown') : 'Unknown',
            duration: song.duration,
            url: song.url,
            thumbnail: song.thumbnail
          }
        })
      });
      if (response.ok) {
        setShowAddToPlModal(null);
        await fetchLibrary();
        alert('Canción añadida a la playlist correctamente.');
      }
    } catch (error) {
      console.error('Failed to add song to playlist:', error);
    }
  };

  // Remove song from Playlist
  const handleRemoveSongFromPlaylist = async (playlistId: string, songId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('¿Quitar esta canción de la playlist?')) return;
    try {
      const response = await fetch(`${API_BASE}/playlists/${playlistId}/songs/${songId}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        await fetchLibrary();
      }
    } catch (error) {
      console.error('Failed to remove song from playlist:', error);
    }
  };

  // Download song from YouTube
  const handleDownload = async (item: SearchResult) => {
    if (downloadingIds[item.id] === 'downloading') return;

    setDownloadingIds(prev => ({ ...prev, [item.id]: 'downloading' }));

    try {
      const response = await fetch(`${API_BASE}/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: item.url })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.song) {
          setDownloadingIds(prev => ({ ...prev, [item.id]: 'success' }));
          
          await fetchLibrary();
          
          setQueue(prev => {
            if (prev.some(s => s.id === data.song.id)) return prev;
            return [...prev, data.song];
          });
        } else {
          throw new Error('Invalid server metadata response');
        }
      } else {
        throw new Error('Download request failed');
      }
    } catch (error) {
      console.error('Download error:', error);
      setDownloadingIds(prev => ({ ...prev, [item.id]: 'error' }));
    }
  };

  // Delete song
  const handleDeleteSong = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('¿Deseas eliminar el archivo descargado de tu almacenamiento local?')) return;

    try {
      const response = await fetch(`${API_BASE}/songs/${id}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        await fetchLibrary();
      } else {
        alert('Failed to delete file');
      }
    } catch (error) {
      console.error('Delete song error:', error);
    }
  };

  // Playback execution
  const playSong = (song: Song) => {
    // Check offline rules
    if (!isOnline && !song.isDownloaded) {
      alert('Estás en modo sin conexión. No puedes reproducir canciones en streaming.');
      return;
    }

    let activeQueueList = [...queue];
    
    // Set queue source depending on active tab
    if (activeTab === 'playlist' && selectedPlaylistId) {
      const activePl = playlists.find(p => p.id === selectedPlaylistId);
      if (activePl) {
        // filter global library matches for the playlist
        const plSongs = activePl.songIds
          .map(id => library.find(s => s.id === id))
          .filter((s): s is Song => !!s && (isOnline || s.isDownloaded));
        activeQueueList = plSongs;
      }
    } else {
      activeQueueList = library.filter(s => isOnline || s.isDownloaded);
    }

    let idx = activeQueueList.findIndex(s => s.id === song.id);
    if (idx === -1) {
      activeQueueList.push(song);
      idx = activeQueueList.length - 1;
    }
    
    setQueue(activeQueueList);
    setCurrentTrack(song);
    setCurrentQueueIndex(idx);
    setIsPlaying(true);
    setCurrentTime(0);
  };

  const handlePrev = () => {
    const activeQueueList = queue.filter(s => isOnline || s.isDownloaded);
    if (activeQueueList.length === 0) return;
    let nextIndex = currentQueueIndex - 1;
    if (nextIndex < 0) {
      nextIndex = activeQueueList.length - 1;
    }
    setCurrentQueueIndex(nextIndex);
    setCurrentTrack(activeQueueList[nextIndex]);
    setIsPlaying(true);
    setCurrentTime(0);
  };

  const handleNext = () => {
    const activeQueueList = queue.filter(s => isOnline || s.isDownloaded);
    if (activeQueueList.length === 0) return;
    
    let nextIndex = 0;
    if (isShuffle) {
      nextIndex = Math.floor(Math.random() * activeQueueList.length);
    } else {
      nextIndex = currentQueueIndex + 1;
      if (nextIndex >= activeQueueList.length) {
        nextIndex = isRepeat ? 0 : -1;
      }
    }

    if (nextIndex > -1) {
      setCurrentQueueIndex(nextIndex);
      setCurrentTrack(activeQueueList[nextIndex]);
      setIsPlaying(true);
      setCurrentTime(0);
    } else {
      setIsPlaying(false);
    }
  };

  const togglePlay = () => {
    if (!currentTrack) {
      const playable = library.filter(s => isOnline || s.isDownloaded);
      if (playable.length > 0) {
        playSong(playable[0]);
      }
    } else {
      setIsPlaying(!isPlaying);
    }
  };



  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setCurrentTime(val);
    if (audioRef.current) {
      audioRef.current.currentTime = val;
    }
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Theme indicators
  const getThemeText = () => {
    if (theme === 'green') return 'CLASSIC GREEN';
    if (theme === 'red') return 'ALBEDO RED';
    if (theme === 'blue') return 'ULTIMATE BLUE';
    return 'MAD BEN GOLD';
  };

  const toggleTheme = () => {
    const themes: ThemeMode[] = ['green', 'red', 'blue', 'gold'];
    const currentIdx = themes.indexOf(theme);
    const nextIdx = (currentIdx + 1) % themes.length;
    setTheme(themes[nextIdx]);
  };

  // Playlist view helper
  const getSelectedPlaylistSongs = () => {
    if (!selectedPlaylistId) return [];
    const pl = playlists.find(p => p.id === selectedPlaylistId);
    if (!pl) return [];
    
    // map playlist songIds into the fully populated library Song objects
    return pl.songIds
      .map(id => library.find(s => s.id === id))
      .filter((s): s is Song => !!s);
  };

  const activePlaylist = playlists.find(p => p.id === selectedPlaylistId);

  const progressPercentage = duration ? (currentTime / duration) * 100 : 0;
  const activeVolume = isMuted ? 0 : volume;
  const volumePercentage = activeVolume * 100;

  const getVolumeColor = (vol: number) => {
    if (vol > 0.75) return '#ff003c'; // Danger red / Overdrive Albedo style
    if (vol > 0.3) return 'var(--color-green-neon)'; // Normal active neon
    return 'var(--color-green-dim)'; // Safe dim neon
  };

  return (
    <div className="app-container">
      {/* PWA Offline indicator strip */}
      {!isOnline && (
        <div style={{
          background: 'rgba(255, 0, 60, 0.95)',
          color: '#ffffff',
          padding: '6px 24px',
          textAlign: 'center',
          fontSize: '0.85rem',
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          fontFamily: 'var(--font-mono)'
        }}>
          <WifiOff size={14} />
          <span>MODO SIN CONEXIÓN ACTIVO • Las canciones online están deshabilitadas temporalmente</span>
        </div>
      )}

      <div className="hologram-overlay"></div>

      {/* Main Grid Layout */}
      <div className="main-view">
        
        {/* Sidebar */}
        <aside className="glass-panel" style={{ padding: '20px' }}>
          
          {/* 3D Visualizer centerpiece (hidden on mobile, SVG logo shown instead) */}
          <div className="hide-on-mobile" style={{ marginBottom: '16px' }}>
            <ThreeDVisualizer theme={theme} isPlaying={isPlaying && !isExtractingStream} />
          </div>

          {/* Fallback SVG Logo for mobile layout (hidden on desktop) */}
          <div className="hide-on-desktop flex flex-col items-center" style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div 
              onClick={toggleTheme}
              className={`omnitrix-active ${isPlaying ? 'omnitrix-spin-fast' : 'omnitrix-spin-slow'}`}
              style={{
                width: '100px',
                height: '100px',
                cursor: 'pointer',
                margin: '0 auto 12px auto',
                borderRadius: '50%'
              }}
            >
              <svg viewBox="0 0 100 100" width="100%" height="100%">
                <circle cx="50" cy="50" r="46" fill="#1c241c" stroke="#3c4c3c" strokeWidth="3" />
                <circle cx="50" cy="50" r="29" fill="#050805" />
                <path d="M26,26 L74,26 L50,50 Z M26,74 L74,74 L50,50 Z" fill="var(--color-green-neon)" />
                <circle cx="50" cy="50" r="6" fill="#0d120d" stroke="var(--color-green-neon)" strokeWidth="2" />
              </svg>
            </div>
            <h1 className="text-neon" style={{ fontSize: '1.2rem', fontWeight: 800 }}>OMNIPLAYER</h1>
          </div>

          <p className="text-mono hide-on-mobile" style={{ fontSize: '0.7rem', color: 'var(--color-gray-text)', textAlign: 'center', marginBottom: '16px' }}>
            SKIN OMNITRIX: <span className="text-neon" style={{ cursor: 'pointer' }} onClick={toggleTheme}>{getThemeText()}</span>
          </p>

          {/* Navigation Links */}
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button 
              onClick={() => { setActiveTab('library'); setSelectedPlaylistId(null); }}
              className={`btn-neon ${activeTab === 'library' ? 'glass-panel-active' : ''}`}
              style={{ justifyContent: 'flex-start', width: '100%', border: activeTab === 'library' ? 'var(--border-neon-active)' : '1px solid transparent' }}
            >
              <Music size={18} />
              <span>Mi Biblioteca</span>
            </button>
            <button 
              onClick={() => { setActiveTab('search'); setSelectedPlaylistId(null); }}
              className={`btn-neon ${activeTab === 'search' ? 'glass-panel-active' : ''}`}
              style={{ justifyContent: 'flex-start', width: '100%', border: activeTab === 'search' ? 'var(--border-neon-active)' : '1px solid transparent' }}
            >
              <Search size={18} />
              <span>Buscar en YouTube</span>
            </button>
          </nav>

          {/* Playlist Sections */}
          <div style={{ marginTop: '20px', borderTop: '1px solid rgba(0, 255, 102, 0.1)', paddingTop: '16px', display: 'flex', flexDirection: 'column', flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--color-gray-text)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
              <span>Playlists</span>
              <button 
                onClick={() => setShowPlaylistModal(true)}
                style={{ background: 'transparent', border: 'none', color: 'var(--color-green-neon)', cursor: 'pointer' }}
                title="Crear Playlist"
              >
                <Plus size={16} />
              </button>
            </div>

            <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '180px' }} className="hide-on-mobile">
              {playlists.map(pl => (
                <button
                  key={pl.id}
                  onClick={() => {
                    setSelectedPlaylistId(pl.id);
                    setActiveTab('playlist');
                  }}
                  className="btn-neon"
                  style={{ 
                    justifyContent: 'flex-start', 
                    width: '100%', 
                    padding: '6px 12px',
                    fontSize: '0.85rem',
                    background: 'transparent',
                    border: selectedPlaylistId === pl.id ? '1px solid var(--color-green-neon)' : '1px solid transparent',
                    color: selectedPlaylistId === pl.id ? 'var(--color-green-neon)' : 'var(--color-white)'
                  }}
                >
                  <ListMusic size={14} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pl.name}</span>
                </button>
              ))}
              {playlists.length === 0 && (
                <span style={{ fontSize: '0.75rem', color: 'var(--color-gray-text)', textAlign: 'center', marginTop: '12px', marginBottom: '8px' }}>
                  Sin playlists creadas
                </span>
              )}

              <button
                onClick={() => setShowImportPlModal(true)}
                className="btn-neon text-mono"
                style={{
                  justifyContent: 'center',
                  fontSize: '0.75rem',
                  padding: '6px',
                  borderStyle: 'dashed',
                  borderColor: 'rgba(0, 255, 102, 0.4)',
                  color: 'var(--color-gray-text)',
                  marginTop: '8px',
                  width: '100%'
                }}
              >
                <Upload size={12} style={{ marginRight: '6px' }} />
                <span>Importar Playlist YT</span>
              </button>
            </div>
          </div>

          {/* Folder Path Config */}
          <div style={{ marginTop: 'auto', borderTop: '1px solid rgba(0, 255, 102, 0.1)', paddingTop: '16px' }} className="hide-on-mobile">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--color-gray-text)', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FolderHeart size={16} className="text-neon" />
                <span>Biblioteca Local</span>
              </div>
              <button 
                onClick={() => {
                  setPathInput(downloadPath);
                  setPathStatus({ type: null, message: '' });
                  setShowPathModal(true);
                }}
                className="btn-icon-neon"
                style={{ width: '28px', height: '28px' }}
                title="Cambiar carpeta de almacenamiento"
              >
                <FolderOpen size={14} />
              </button>
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--color-gray-text)', marginTop: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={downloadPath}>
              Carpeta: <span style={{ color: 'var(--color-white)' }}>{downloadPath.split('/').pop() || downloadPath}</span>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="glass-panel" style={{ padding: '24px', position: 'relative' }}>
          
          <div style={{ position: 'relative', zIndex: 1, height: '100%', display: 'flex', flexDirection: 'column' }}>
            
            {/* SEARCH TAB */}
            {activeTab === 'search' && (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                
                <div style={{ marginBottom: '20px' }}>
                  <h2 style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: '4px' }}>Buscador Holográfico</h2>
                  <p style={{ color: 'var(--color-gray-text)', fontSize: '0.9rem' }}>
                    Busca música en YouTube, reprodúcela en vivo o añádela a la base de datos de tu biblioteca.
                  </p>
                </div>

                <form onSubmit={handleSearch} style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <Search 
                      size={20} 
                      style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-gray-text)' }} 
                    />
                    <input
                      type="text"
                      placeholder="Busca por canción, artista, álbum..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '12px 16px 12px 48px',
                        background: 'rgba(25, 39, 25, 0.4)',
                        border: 'var(--border-neon)',
                        borderRadius: '24px',
                        color: 'var(--color-white)',
                        fontSize: '1rem',
                        outline: 'none'
                      }}
                    />
                  </div>
                  <button type="submit" className="btn-neon" style={{ borderRadius: '24px', padding: '0 24px' }}>
                    {isLoadingSearch ? <RotateCw className="omnitrix-spin-fast" size={18} /> : 'Buscar'}
                  </button>
                </form>

                <div style={{ flex: 1, overflowY: 'auto' }}>
                  {isLoadingSearch ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '200px', gap: '12px' }}>
                      <RotateCw className="text-neon omnitrix-spin-fast" size={40} />
                      <p className="text-mono" style={{ color: 'var(--color-gray-text)' }}>Conectando con el escáner de YouTube...</p>
                    </div>
                  ) : searchResults.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {searchResults.map((item) => {
                        const status = downloadingIds[item.id];
                        const isThisSongSelected = currentTrack?.id === item.id;
                        
                        // Check if song exists in library to check like status
                        const libMatch = library.find(s => s.id === item.id);
                        const isLiked = libMatch ? !!libMatch.liked : false;

                        return (
                          <div 
                            key={item.id} 
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              padding: '12px 16px',
                              background: 'rgba(17, 26, 17, 0.5)',
                              border: isThisSongSelected ? '1px solid var(--color-green-neon)' : '1px solid rgba(0,255,102,0.08)',
                              borderRadius: '12px',
                              gap: '16px'
                            }}
                          >
                            <div style={{ width: '50px', height: '50px', borderRadius: '6px', overflow: 'hidden', flexShrink: 0, position: 'relative' }}>
                              {item.thumbnail ? (
                                <img src={item.thumbnail} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : (
                                <Disc size={20} style={{ position: 'absolute', left: '15px', top: '15px', color: 'var(--color-gray-text)' }} />
                              )}
                            </div>

                            <div style={{ flex: 1, minWidth: 0 }}>
                              <h4 style={{ fontSize: '0.95rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: isThisSongSelected ? 'var(--color-green-neon)' : 'var(--color-white)' }}>
                                {item.title}
                              </h4>
                              <p style={{ color: 'var(--color-gray-text)', fontSize: '0.8rem', marginTop: '2px' }}>
                                {item.artist}
                              </p>
                            </div>

                            <span className="text-mono" style={{ fontSize: '0.85rem', color: 'var(--color-gray-text)' }}>
                              {formatTime(item.duration)}
                            </span>

                            {/* Actions Row */}
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              
                              {/* Toggle Like */}
                              <button 
                                onClick={(e) => handleToggleLike(item, e)}
                                className="btn-icon-neon"
                                style={{ color: isLiked ? 'var(--color-green-neon)' : 'var(--color-gray-text)' }}
                                title={isLiked ? "Quitar de biblioteca" : "Añadir a biblioteca (Like)"}
                              >
                                <Heart size={16} fill={isLiked ? "var(--color-green-neon)" : "none"} />
                              </button>

                              {/* Add to Playlist button */}
                              <button 
                                onClick={() => setShowAddToPlModal(item)}
                                className="btn-icon-neon"
                                title="Añadir a Playlist"
                              >
                                <ListPlus size={16} />
                              </button>

                              {/* Play Stream */}
                              <button
                                onClick={() => {
                                  if (!isOnline) {
                                    alert('No tienes conexión a internet para reproducir streaming.');
                                    return;
                                  }
                                  const virtualTrack: Song = {
                                    id: item.id,
                                    title: item.title,
                                    artist: item.artist,
                                    album: 'YouTube Stream',
                                    year: 'Unknown',
                                    duration: item.duration,
                                    filename: '',
                                    url: item.url,
                                    thumbnail: item.thumbnail,
                                    liked: isLiked,
                                    isDownloaded: false
                                  };
                                  if (isThisSongSelected) {
                                    setIsPlaying(!isPlaying);
                                  } else {
                                    playSong(virtualTrack);
                                  }
                                }}
                                disabled={!isOnline}
                                className="btn-icon-neon"
                                style={{
                                  background: isThisSongSelected && isPlaying ? 'var(--color-green-neon)' : 'rgba(0, 255, 102, 0.1)',
                                  color: isThisSongSelected && isPlaying ? 'var(--color-black-deep)' : 'var(--color-green-neon)',
                                  boxShadow: isThisSongSelected && isPlaying ? 'var(--shadow-neon-glow)' : 'none',
                                  opacity: isOnline ? 1 : 0.4,
                                  cursor: isOnline ? 'pointer' : 'not-allowed'
                                }}
                              >
                                {isThisSongSelected && isExtractingStream ? (
                                  <RotateCw className="omnitrix-spin-fast" size={14} />
                                ) : isThisSongSelected && isPlaying ? (
                                  <Pause size={14} fill="currentColor" />
                                ) : (
                                  <Play size={14} fill="currentColor" style={{ marginLeft: '2px' }} />
                                )}
                              </button>

                              {/* Local Download */}
                              <div style={{ minWidth: '100px', display: 'flex', justifyContent: 'flex-end' }}>
                                {status === 'downloading' ? (
                                  <button disabled className="btn-neon" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
                                    <RotateCw className="omnitrix-spin-fast" size={14} />
                                    <span>Descargando</span>
                                  </button>
                                ) : status === 'success' ? (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-green-neon)', fontSize: '0.85rem' }}>
                                    <CheckCircle size={16} />
                                    <span>Descargado</span>
                                  </div>
                                ) : status === 'error' ? (
                                  <button onClick={() => handleDownload(item)} className="btn-neon" style={{ padding: '6px 12px', fontSize: '0.8rem', borderColor: '#ff003c', color: '#ff003c', background: 'rgba(255,0,60,0.05)' }}>
                                    <AlertCircle size={14} />
                                    <span>Reintentar</span>
                                  </button>
                                ) : (
                                  <button onClick={() => handleDownload(item)} className="btn-neon" style={{ padding: '6px 12px', fontSize: '0.8rem' }} disabled={!isOnline}>
                                    <Download size={14} />
                                    <span>Descargar</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '200px', color: 'var(--color-gray-text)' }}>
                      <Disc size={48} style={{ opacity: 0.1, marginBottom: '12px' }} />
                      <p>Busca tus pistas favoritas para escanear, escucharlas en vivo o guardarlas.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* LIBRARY TAB */}
            {activeTab === 'library' && (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '24px' }}>
                  <div>
                    <h2 style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: '4px' }}>Mi Biblioteca</h2>
                    <p style={{ color: 'var(--color-gray-text)', fontSize: '0.9rem' }}>
                      Pistas favoritas y archivos guardados en el disco.
                    </p>
                  </div>
                  {library.length > 0 && (
                    <button 
                      onClick={() => {
                        const playable = library.filter(s => isOnline || s.isDownloaded);
                        if (playable.length > 0) playSong(playable[0]);
                      }} 
                      className="btn-neon"
                    >
                      <Play size={16} fill="currentColor" />
                      <span>Reproducir Todo</span>
                    </button>
                  )}
                </div>

                <div style={{ flex: 1, overflowY: 'auto' }}>
                  {library.length > 0 ? (
                    <table className="song-table">
                      <thead>
                        <tr>
                          <th style={{ width: '40px', textAlign: 'center' }}>#</th>
                          <th>Título</th>
                          <th>Álbum</th>
                          <th style={{ width: '80px' }}>Año</th>
                          <th>Tipo</th>
                          <th style={{ width: '90px' }}>Duración</th>
                          <th style={{ width: '110px', textAlign: 'right' }}>Acción</th>
                        </tr>
                      </thead>
                      <tbody>
                        {library.map((song, index) => {
                          const isActive = currentTrack?.id === song.id;
                          const isSongPlayable = isOnline || song.isDownloaded;
                          return (
                            <tr 
                              key={song.id} 
                              onClick={() => isSongPlayable && playSong(song)}
                              className={`song-row ${isActive ? 'song-row-active' : ''}`}
                              style={{ 
                                opacity: isSongPlayable ? 1 : 0.3,
                                cursor: isSongPlayable ? 'pointer' : 'not-allowed'
                              }}
                            >
                              <td style={{ textAlign: 'center' }}>
                                {isActive && isPlaying ? (
                                  <div className="visualizer-container visualizer-active" style={{ display: 'inline-flex', verticalAlign: 'middle' }}>
                                    <div className="visualizer-bar"></div>
                                    <div className="visualizer-bar"></div>
                                    <div className="visualizer-bar"></div>
                                    <div className="visualizer-bar"></div>
                                  </div>
                                ) : (
                                  <span className="text-mono" style={{ color: isActive ? 'var(--color-green-neon)' : 'var(--color-gray-text)' }}>
                                    {index + 1}
                                  </span>
                                )}
                              </td>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                  <div style={{ width: '36px', height: '36px', borderRadius: '4px', overflow: 'hidden', flexShrink: 0 }}>
                                    {song.thumbnail ? (
                                      <img src={song.thumbnail} alt={song.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    ) : (
                                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--color-gray-text)', background: '#111' }}>
                                        <Music size={16} />
                                      </div>
                                    )}
                                  </div>
                                  <span style={{ fontWeight: isActive ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }} title={song.title}>
                                    {song.title}
                                  </span>
                                </div>
                              </td>
                              <td style={{ color: isActive ? 'var(--color-green-neon)' : 'var(--color-gray-text)', fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '130px' }} title={song.album}>
                                {song.album}
                              </td>
                              <td className="text-mono" style={{ color: isActive ? 'var(--color-green-neon)' : 'var(--color-gray-text)', fontSize: '0.85rem' }}>
                                {song.year}
                              </td>
                              
                              {/* Download status identification icon column */}
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  {song.isDownloaded ? (
                                    <span title="Descargado localmente (Disponible offline)">
                                      <HardDrive size={14} className="text-neon" />
                                    </span>
                                  ) : !isOnline ? (
                                    <span title="Requiere internet (No disponible offline)">
                                      <WifiOff size={14} style={{ color: '#ff003c' }} />
                                    </span>
                                  ) : (
                                    <span title="Streaming en vivo">
                                      <Wifi size={14} style={{ color: 'var(--color-gray-text)' }} />
                                    </span>
                                  )}
                                  <span className="text-mono" style={{ fontSize: '0.7rem', color: song.isDownloaded ? 'var(--color-green-neon)' : 'var(--color-gray-text)' }}>
                                    {song.isDownloaded ? 'LOCAL' : 'STREAM'}
                                  </span>
                                </div>
                              </td>

                              <td className="text-mono" style={{ color: isActive ? 'var(--color-green-neon)' : 'var(--color-gray-text)' }}>
                                {formatTime(song.duration)}
                              </td>
                              
                              <td style={{ textAlign: 'right' }}>
                                <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                                  {/* Like heart */}
                                  <button 
                                    onClick={() => handleToggleLike(song)} 
                                    className="btn-icon-neon"
                                    style={{ color: song.liked ? 'var(--color-green-neon)' : 'var(--color-gray-text)' }}
                                  >
                                    <Heart size={14} fill={song.liked ? "var(--color-green-neon)" : "none"} />
                                  </button>

                                  {/* Add to playlist */}
                                  <button 
                                    onClick={() => setShowAddToPlModal(song)} 
                                    className="btn-icon-neon"
                                    title="Añadir a Playlist"
                                  >
                                    <ListPlus size={14} />
                                  </button>

                                  {/* Delete local file */}
                                  {song.isDownloaded ? (
                                    <button 
                                      onClick={(e) => handleDeleteSong(song.id, e)} 
                                      className="btn-icon-neon"
                                      title="Borrar archivo del disco"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  ) : (
                                    // Let users download directly from library
                                    <button 
                                      onClick={() => handleDownload(song)} 
                                      disabled={!isOnline}
                                      className="btn-icon-neon"
                                      title="Descargar localmente"
                                    >
                                      <Download size={14} />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '300px', gap: '16px' }}>
                      <div className="omnitrix-active" style={{ border: 'var(--border-neon)', padding: '24px', borderRadius: '50%', background: 'rgba(0,255,102,0.02)' }}>
                        <ListMusic className="text-neon" size={48} />
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <h3>Biblioteca Vacía</h3>
                        <p style={{ color: 'var(--color-gray-text)', fontSize: '0.85rem', marginTop: '6px', maxWidth: '300px', margin: '6px auto 0 auto' }}>
                          Añade canciones dándole Like (corazón) en el buscador, o descárgalas directamente.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* PLAYLIST TAB */}
            {activeTab === 'playlist' && activePlaylist && (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                
                {/* Playlist Banner Header */}
                <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-end', marginBottom: '24px' }}>
                  
                  {/* Playlist Cover Art with chromatic mesh style */}
                  <div style={{ 
                    width: '160px', 
                    height: '160px', 
                    borderRadius: '12px', 
                    overflow: 'hidden', 
                    background: activePlaylist.coverUrl ? 'none' : 'linear-gradient(135deg, var(--color-green-dark) 0%, var(--color-black-deep) 100%)',
                    border: 'var(--border-neon-active)',
                    boxShadow: 'var(--shadow-neon-glow)',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {activePlaylist.coverUrl ? (
                      <img src={activePlaylist.coverUrl} alt={activePlaylist.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <ListMusic size={64} className="text-neon" />
                    )}
                  </div>

                  <div style={{ flex: 1 }}>
                    <span className="text-mono text-neon" style={{ fontSize: '0.8rem', letterSpacing: '2px', fontWeight: 'bold' }}>PLAYLIST DIGITAL</span>
                    <h2 style={{ fontSize: '2.5rem', fontWeight: 800, marginTop: '4px', lineHeight: '1.1' }}>{activePlaylist.name}</h2>
                    <p style={{ color: 'var(--color-gray-text)', fontSize: '0.95rem', marginTop: '8px' }}>
                      {activePlaylist.description || 'Sin descripción holográfica.'}
                    </p>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginTop: '16px' }}>
                      <span className="text-mono" style={{ fontSize: '0.85rem', color: 'var(--color-white)' }}>
                        {activePlaylist.songIds.length} canciones
                      </span>
                      <button 
                        onClick={() => handleOpenEditPlaylist(activePlaylist)}
                        className="btn-neon text-mono"
                        style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                      >
                        <Pencil size={12} />
                        <span>Editar Playlist</span>
                      </button>
                      <button 
                        onClick={() => handleDeletePlaylist(activePlaylist.id)}
                        className="btn-neon"
                        style={{ padding: '6px 12px', fontSize: '0.8rem', borderColor: '#ff003c', color: '#ff003c', background: 'transparent' }}
                      >
                        <Trash2 size={12} />
                        <span>Eliminar Playlist</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Playlist Tracks Table */}
                <div style={{ flex: 1, overflowY: 'auto' }}>
                  {getSelectedPlaylistSongs().length > 0 ? (
                    <table className="song-table">
                      <thead>
                        <tr>
                          <th style={{ width: '40px', textAlign: 'center' }}>#</th>
                          <th>Título</th>
                          <th>Álbum</th>
                          <th style={{ width: '80px' }}>Año</th>
                          <th>Tipo</th>
                          <th style={{ width: '80px', textAlign: 'right' }}>Acción</th>
                        </tr>
                      </thead>
                      <tbody>
                        {getSelectedPlaylistSongs().map((song, index) => {
                          const isActive = currentTrack?.id === song.id;
                          const isSongPlayable = isOnline || song.isDownloaded;
                          return (
                            <tr 
                              key={song.id} 
                              onClick={() => isSongPlayable && playSong(song)}
                              className={`song-row ${isActive ? 'song-row-active' : ''}`}
                              style={{ 
                                opacity: isSongPlayable ? 1 : 0.3,
                                cursor: isSongPlayable ? 'pointer' : 'not-allowed'
                              }}
                            >
                              <td style={{ textAlign: 'center' }}>
                                {isActive && isPlaying ? (
                                  <div className="visualizer-container visualizer-active" style={{ display: 'inline-flex', verticalAlign: 'middle' }}>
                                    <div className="visualizer-bar"></div>
                                    <div className="visualizer-bar"></div>
                                    <div className="visualizer-bar"></div>
                                    <div className="visualizer-bar"></div>
                                  </div>
                                ) : (
                                  <span className="text-mono" style={{ color: isActive ? 'var(--color-green-neon)' : 'var(--color-gray-text)' }}>
                                    {index + 1}
                                  </span>
                                )}
                              </td>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                  <div style={{ width: '36px', height: '36px', borderRadius: '4px', overflow: 'hidden', flexShrink: 0 }}>
                                    {song.thumbnail ? (
                                      <img src={song.thumbnail} alt={song.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    ) : (
                                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--color-gray-text)', background: '#111' }}>
                                        <Music size={16} />
                                      </div>
                                    )}
                                  </div>
                                  <span style={{ fontWeight: isActive ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '220px' }}>
                                    {song.title}
                                  </span>
                                </div>
                              </td>
                              <td style={{ color: isActive ? 'var(--color-green-neon)' : 'var(--color-gray-text)', fontSize: '0.85rem' }}>
                                {song.album}
                              </td>
                              <td className="text-mono" style={{ color: isActive ? 'var(--color-green-neon)' : 'var(--color-gray-text)', fontSize: '0.85rem' }}>
                                {song.year}
                              </td>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  {song.isDownloaded ? (
                                    <HardDrive size={14} className="text-neon" />
                                  ) : !isOnline ? (
                                    <WifiOff size={14} style={{ color: '#ff003c' }} />
                                  ) : (
                                    <Wifi size={14} style={{ color: 'var(--color-gray-text)' }} />
                                  )}
                                  <span className="text-mono" style={{ fontSize: '0.7rem', color: song.isDownloaded ? 'var(--color-green-neon)' : 'var(--color-gray-text)' }}>
                                    {song.isDownloaded ? 'LOCAL' : 'STREAM'}
                                  </span>
                                </div>
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }} onClick={e => e.stopPropagation()}>
                                  <button 
                                    onClick={() => handleToggleLike(song)} 
                                    className="btn-icon-neon"
                                    style={{ color: song.liked ? 'var(--color-green-neon)' : 'var(--color-gray-text)' }}
                                  >
                                    <Heart size={14} fill={song.liked ? "var(--color-green-neon)" : "none"} />
                                  </button>
                                  <button 
                                    onClick={(e) => handleRemoveSongFromPlaylist(activePlaylist.id, song.id, e)} 
                                    className="btn-icon-neon"
                                    title="Quitar de playlist"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '200px', color: 'var(--color-gray-text)' }}>
                      <ListMusic size={48} style={{ opacity: 0.1, marginBottom: '12px' }} />
                      <p>No hay canciones en esta playlist.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>
        </main>
      </div>

      {/* Path Folder Config Modal */}
      {showPathModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: '20px'
        }}>
          <div className="glass-panel" style={{
            width: '100%',
            maxWidth: '500px',
            padding: '24px',
            border: 'var(--border-neon-active)',
            boxShadow: '0 0 25px rgba(0, 255, 102, 0.25)',
            background: 'rgba(8,16,8,0.95)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 className="text-neon" style={{ fontSize: '1.2rem', fontWeight: 700, letterSpacing: '1px' }}>
                CONFIGURACIÓN DE RUTA LOCAL
              </h3>
              <button 
                onClick={() => setShowPathModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--color-white)', fontSize: '1.5rem', cursor: 'pointer', outline: 'none' }}
              >
                &times;
              </button>
            </div>
            
            <form onSubmit={handleSavePath}>
              <p style={{ fontSize: '0.85rem', color: 'var(--color-gray-text)', marginBottom: '16px', lineHeight: '1.4' }}>
                Establece la ruta absoluta en tu sistema local donde se guardarán las canciones MP3 y se escaneará tu biblioteca local. El servidor Hono creará la ruta automáticamente si no existe.
              </p>
              
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--color-gray-text)', marginBottom: '6px', fontWeight: 600 }}>
                  Ruta Absoluta del Directorio:
                </label>
                <input
                  type="text"
                  value={pathInput}
                  onChange={(e) => setPathInput(e.target.value)}
                  placeholder="/ejemplo/ruta/descargas"
                  required
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    background: 'rgba(0,0,0,0.5)',
                    border: 'var(--border-neon)',
                    borderRadius: '6px',
                    color: 'var(--color-white)',
                    outline: 'none',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.85rem'
                  }}
                />
              </div>

              {pathStatus.type && (
                <div style={{
                  padding: '10px 12px',
                  borderRadius: '6px',
                  fontSize: '0.85rem',
                  marginBottom: '16px',
                  background: pathStatus.type === 'success' ? 'rgba(0, 255, 102, 0.1)' : 'rgba(255, 0, 60, 0.1)',
                  border: pathStatus.type === 'success' ? '1px solid rgba(0, 255, 102, 0.3)' : '1px solid rgba(255, 0, 60, 0.3)',
                  color: pathStatus.type === 'success' ? 'var(--color-green-neon)' : '#ff003c',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  {pathStatus.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                  <span>{pathStatus.message}</span>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button 
                  type="button" 
                  onClick={() => setShowPathModal(false)}
                  className="btn-neon" 
                  style={{ background: 'transparent', borderColor: 'transparent' }}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn-neon">
                  Guardar Configuración
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Playlist Modal */}
      {showPlaylistModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: '20px'
        }}>
          <div className="glass-panel" style={{
            width: '100%',
            maxWidth: '500px',
            padding: '24px',
            border: 'var(--border-neon-active)',
            boxShadow: '0 0 25px rgba(0, 255, 102, 0.25)',
            background: 'rgba(8,16,8,0.95)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 className="text-neon" style={{ fontSize: '1.1rem', fontWeight: 700, letterSpacing: '1px' }}>
                CREAR PLAYLIST HOLOGRÁFICA
              </h3>
              <button onClick={() => setShowPlaylistModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--color-white)', fontSize: '1.5rem', cursor: 'pointer' }}>
                &times;
              </button>
            </div>

            <form onSubmit={handleCreatePlaylist}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--color-gray-text)', marginBottom: '4px' }}>Nombre:</label>
                <input 
                  type="text" 
                  value={newPlName} 
                  onChange={e => setNewPlName(e.target.value)} 
                  required
                  placeholder="Ej. Alien Hits"
                  style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.5)', border: 'var(--border-neon)', borderRadius: '6px', color: '#fff' }} 
                />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--color-gray-text)', marginBottom: '4px' }}>Descripción:</label>
                <textarea 
                  value={newPlDesc} 
                  onChange={e => setNewPlDesc(e.target.value)} 
                  placeholder="Pistas de energía cromática..."
                  rows={3}
                  style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.5)', border: 'var(--border-neon)', borderRadius: '6px', color: '#fff', resize: 'none' }} 
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--color-gray-text)', marginBottom: '4px' }}>Imagen de Portada (Opcional):</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input 
                    type="text" 
                    value={newPlCover} 
                    onChange={e => setNewPlCover(e.target.value)} 
                    placeholder="URL de imagen o archivo local..."
                    style={{ flex: 1, padding: '10px', background: 'rgba(0,0,0,0.5)', border: 'var(--border-neon)', borderRadius: '6px', color: '#fff' }} 
                  />
                  <label className="btn-neon text-mono" style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', padding: '10px 12px', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                    <Upload size={14} />
                    <span>Subir</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={e => handleCoverUpload(e, false)} 
                      style={{ display: 'none' }} 
                    />
                  </label>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" onClick={() => setShowPlaylistModal(false)} className="btn-neon" style={{ background: 'transparent', borderColor: 'transparent' }}>Cancelar</button>
                <button type="submit" className="btn-neon">Crear Playlist</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Song to Playlist Modal */}
      {showAddToPlModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: '20px'
        }}>
          <div className="glass-panel" style={{
            width: '100%',
            maxWidth: '400px',
            padding: '24px',
            border: 'var(--border-neon-active)',
            boxShadow: '0 0 25px rgba(0, 255, 102, 0.25)',
            background: 'rgba(8,16,8,0.95)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 className="text-neon" style={{ fontSize: '1.1rem', fontWeight: 700 }}>AÑADIR A PLAYLIST</h3>
              <button onClick={() => setShowAddToPlModal(null)} style={{ background: 'transparent', border: 'none', color: 'var(--color-white)', fontSize: '1.5rem', cursor: 'pointer' }}>
                &times;
              </button>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--color-gray-text)', marginBottom: '16px' }}>
              Selecciona una playlist para añadir "<strong>{showAddToPlModal.title}</strong>":
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '250px', overflowY: 'auto' }}>
              {playlists.map(pl => (
                <button
                  key={pl.id}
                  onClick={() => handleAddSongToPlaylist(pl.id, showAddToPlModal)}
                  className="btn-neon"
                  style={{ justifyContent: 'flex-start', width: '100%' }}
                >
                  <ListMusic size={16} />
                  <span>{pl.name}</span>
                </button>
              ))}
              {playlists.length === 0 && (
                <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--color-gray-text)' }}>
                  <p style={{ fontSize: '0.85rem' }}>No tienes playlists creadas.</p>
                  <button 
                    onClick={() => { setShowAddToPlModal(null); setShowPlaylistModal(true); }}
                    className="btn-neon" 
                    style={{ margin: '12px auto 0 auto' }}
                  >
                    Crear Playlist
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Playlist Modal */}
      {showEditPlModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: '20px'
        }}>
          <div className="glass-panel" style={{
            width: '100%',
            maxWidth: '500px',
            padding: '24px',
            border: 'var(--border-neon-active)',
            boxShadow: '0 0 25px rgba(0, 255, 102, 0.25)',
            background: 'rgba(8,16,8,0.95)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 className="text-neon text-mono" style={{ fontSize: '1.1rem', fontWeight: 700, letterSpacing: '1px' }}>
                EDITAR PLAYLIST HOLOGRÁFICA
              </h3>
              <button onClick={() => setShowEditPlModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--color-white)', fontSize: '1.5rem', cursor: 'pointer' }}>
                &times;
              </button>
            </div>

            <form onSubmit={handleEditPlaylist}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--color-gray-text)', marginBottom: '4px' }}>Nombre:</label>
                <input 
                  type="text" 
                  value={editPlName} 
                  onChange={e => setEditPlName(e.target.value)} 
                  required
                  placeholder="Ej. Alien Hits"
                  style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.5)', border: 'var(--border-neon)', borderRadius: '6px', color: '#fff' }} 
                />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--color-gray-text)', marginBottom: '4px' }}>Descripción:</label>
                <textarea 
                  value={editPlDesc} 
                  onChange={e => setEditPlDesc(e.target.value)} 
                  placeholder="Pistas de energía cromática..."
                  rows={3}
                  style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.5)', border: 'var(--border-neon)', borderRadius: '6px', color: '#fff', resize: 'none' }} 
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--color-gray-text)', marginBottom: '4px' }}>Imagen de Portada (Opcional):</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input 
                    type="text" 
                    value={editPlCover} 
                    onChange={e => setEditPlCover(e.target.value)} 
                    placeholder="URL de imagen o archivo local..."
                    style={{ flex: 1, padding: '10px', background: 'rgba(0,0,0,0.5)', border: 'var(--border-neon)', borderRadius: '6px', color: '#fff' }} 
                  />
                  <label className="btn-neon text-mono" style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', padding: '10px 12px', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                    <Upload size={14} />
                    <span>{isUploadingCover ? 'Subiendo...' : 'Subir'}</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={e => handleCoverUpload(e, true)} 
                      disabled={isUploadingCover}
                      style={{ display: 'none' }} 
                    />
                  </label>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" onClick={() => setShowEditPlModal(false)} className="btn-neon text-mono" style={{ background: 'transparent', borderColor: 'transparent' }}>Cancelar</button>
                <button type="submit" className="btn-neon text-mono">Guardar Cambios</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import Playlist Modal */}
      {showImportPlModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: '20px'
        }}>
          <div className="glass-panel" style={{
            width: '100%',
            maxWidth: '500px',
            padding: '24px',
            border: 'var(--border-neon-active)',
            boxShadow: '0 0 25px rgba(0, 255, 102, 0.25)',
            background: 'rgba(8,16,8,0.95)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 className="text-neon text-mono" style={{ fontSize: '1.1rem', fontWeight: 700, letterSpacing: '1px' }}>
                IMPORTAR PLAYLIST DE YOUTUBE
              </h3>
              <button onClick={() => setShowImportPlModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--color-white)', fontSize: '1.5rem', cursor: 'pointer' }}>
                &times;
              </button>
            </div>

            <form onSubmit={handleImportPlaylist}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--color-gray-text)', marginBottom: '4px' }}>URL de la Playlist de YouTube:</label>
                <input 
                  type="url" 
                  value={importPlUrl} 
                  onChange={e => setImportPlUrl(e.target.value)} 
                  required
                  placeholder="https://www.youtube.com/playlist?list=..."
                  style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.5)', border: 'var(--border-neon)', borderRadius: '6px', color: '#fff' }} 
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" onClick={() => setShowImportPlModal(false)} className="btn-neon text-mono" style={{ background: 'transparent', borderColor: 'transparent' }} disabled={isImportingPl}>Cancelar</button>
                <button type="submit" className="btn-neon text-mono" disabled={isImportingPl}>
                  {isImportingPl ? 'Importando...' : 'Importar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Player Bar (Bottom) */}
      <footer className="glass-panel" style={{ 
        flexDirection: 'row', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        padding: '0 24px',
        margin: '0 8px 8px 8px',
        borderRadius: '12px'
      }}>
        
        {/* Track details (Left) */}
        <div style={{ width: '30%', display: 'flex', alignItems: 'center', gap: '14px' }}>
          {currentTrack ? (
            <>
              {/* Cover Art */}
              <div 
                className={isPlaying && !isExtractingStream ? 'omnitrix-active' : ''}
                style={{ 
                  width: '56px', 
                  height: '56px', 
                  borderRadius: '8px', 
                  overflow: 'hidden', 
                  background: 'var(--color-black-deep)',
                  flexShrink: 0,
                  border: '1px solid rgba(0, 255, 102, 0.2)',
                  boxShadow: isPlaying && !isExtractingStream ? '0 0 10px rgba(0,255,102,0.2)' : 'none'
                }}
              >
                {currentTrack.thumbnail ? (
                  <img src={currentTrack.thumbnail} alt={currentTrack.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--color-green-neon)' }}>
                    <Music size={24} />
                  </div>
                )}
              </div>
              
              {/* Titles */}
              <div style={{ minWidth: 0, flex: 1 }}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={currentTrack.title}>
                  {currentTrack.title}
                </h4>
                <p className="text-neon" style={{ fontSize: '0.75rem', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={currentTrack.artist}>
                  {currentTrack.artist} {currentTrack.album && `• ${currentTrack.album}`}
                </p>
              </div>

              {/* Dynamic Like Heart in Player Bar (like Spotify) */}
              <button 
                onClick={() => handleToggleLike(currentTrack)}
                className="btn-icon-neon"
                style={{ color: currentTrack.liked ? 'var(--color-green-neon)' : 'var(--color-gray-text)', flexShrink: 0 }}
                title={currentTrack.liked ? "Quitar de biblioteca" : "Añadir a biblioteca (Like)"}
              >
                <Heart size={16} fill={currentTrack.liked ? "var(--color-green-neon)" : "none"} />
              </button>
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--color-gray-text)' }}>
              <Disc size={28} className="omnitrix-spin-slow" />
              <div style={{ fontSize: '0.8rem' }}>
                <p>Ningún tema seleccionado</p>
                <p style={{ fontSize: '0.7rem' }}>Elige uno de la biblioteca</p>
              </div>
            </div>
          )}
        </div>

        {/* Playback Control (Center) */}
        <div style={{ width: '40%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          
          {/* Main Controls row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* Shuffle */}
            <button 
              onClick={() => setIsShuffle(!isShuffle)}
              className={`btn-icon-neon ${isShuffle ? 'btn-icon-neon-active' : ''}`}
              title="Aleatorio"
            >
              <Shuffle size={16} />
            </button>

            {/* Prev */}
            <button 
              onClick={handlePrev} 
              className="btn-icon-neon" 
              disabled={queue.length === 0}
            >
              <SkipBack size={20} fill="currentColor" />
            </button>

            {/* Play/Pause */}
            <button 
              onClick={togglePlay} 
              className="btn-icon-neon" 
              disabled={isExtractingStream}
              style={{
                width: '44px',
                height: '44px',
                background: 'var(--color-green-neon)',
                color: 'var(--color-black-deep)',
                boxShadow: 'var(--shadow-neon-glow)'
              }}
            >
              {isExtractingStream ? (
                <RotateCw className="omnitrix-spin-fast" size={20} />
              ) : isPlaying ? (
                <Pause size={20} fill="currentColor" />
              ) : (
                <Play size={20} fill="currentColor" style={{ marginLeft: '2px' }} />
              )}
            </button>

            {/* Next */}
            <button 
              onClick={handleNext} 
              className="btn-icon-neon" 
              disabled={queue.length === 0}
            >
              <SkipForward size={20} fill="currentColor" />
            </button>

            {/* Repeat */}
            <button 
              onClick={() => setIsRepeat(!isRepeat)}
              className={`btn-icon-neon ${isRepeat ? 'btn-icon-neon-active' : ''}`}
              title="Repetir tema"
            >
              <Repeat size={16} />
            </button>
          </div>

          {/* Timeline Bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%' }}>
            {isExtractingStream ? (
              <span className="text-neon text-mono font-bold" style={{ fontSize: '0.8rem', textAlign: 'center', width: '100%', letterSpacing: '1px' }}>
                <RotateCw className="omnitrix-spin-fast" size={12} style={{ display: 'inline-block', marginRight: '6px', verticalAlign: 'middle' }} />
                CONECTANDO FRECUENCIA HOLOGRÁFICA... (YOUTUBE STREAM)
              </span>
            ) : (
              <>
                <span className="text-mono" style={{ fontSize: '0.75rem', width: '35px', textAlign: 'right', color: 'var(--color-gray-text)' }}>
                  {formatTime(currentTime)}
                </span>
                <input
                  type="range"
                  min="0"
                  max={duration || 100}
                  value={currentTime}
                  onChange={handleSliderChange}
                  style={{
                    flex: 1,
                    background: `linear-gradient(to right, var(--color-green-neon) 0%, var(--color-green-neon) ${progressPercentage}%, var(--color-black-light) ${progressPercentage}%, var(--color-black-light) 100%)`
                  }}
                />
                <span className="text-mono" style={{ fontSize: '0.75rem', width: '35px', color: 'var(--color-gray-text)' }}>
                  {formatTime(duration)}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Volume Controls (Right) */}
        <div style={{ width: '30%', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px' }}>
          
          {/* Active Audio Waveform bars */}
          {isPlaying && !isExtractingStream && (
            <div className="visualizer-container visualizer-active" style={{ marginRight: '16px' }}>
              <div className="visualizer-bar" style={{ height: '6px' }}></div>
              <div className="visualizer-container visualizer-active">
                <div className="visualizer-bar" style={{ height: '12px' }}></div>
                <div className="visualizer-bar" style={{ height: '8px' }}></div>
                <div className="visualizer-bar" style={{ height: '14px' }}></div>
              </div>
              <div className="visualizer-bar" style={{ height: '5px' }}></div>
            </div>
          )}

          {/* Volume icon */}
          <button 
            onClick={() => setIsMuted(!isMuted)} 
            className="btn-icon-neon"
          >
            {isMuted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>

          {/* Volume slider */}
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={isMuted ? 0 : volume}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              setVolume(val);
              setIsMuted(false);
            }}
            style={{
              width: '100px',
              background: `linear-gradient(to right, ${getVolumeColor(activeVolume)} 0%, ${getVolumeColor(activeVolume)} ${volumePercentage}%, var(--color-black-light) ${volumePercentage}%, var(--color-black-light) 100%)`,
              transition: 'background 0.15s ease'
            }}
          />
        </div>

      </footer>
    </div>
  );
}
