import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TextInput, 
  TouchableOpacity, 
  ScrollView, 
  Dimensions, 
  ActivityIndicator, 
  Alert,
  Animated,
  Easing
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
  FolderHeart, 
  Heart, 
  HardDrive, 
  Wifi, 
  WifiOff, 
  Plus, 
  ListPlus, 
  Terminal, 
  Settings, 
  RefreshCw, 
  Shuffle, 
  Repeat 
} from 'lucide-react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type ThemeMode = 'green' | 'red' | 'blue' | 'gold';
type TabMode = 'library' | 'search' | 'playlists' | 'ssh_settings';

interface Song {
  id: string;
  title: string;
  artist: string;
  album: string;
  year: string;
  duration: number;
  filename: string; 
  url: string;
  thumbnail: string | null;
  liked?: boolean;
  isDownloaded?: boolean;
  localUri?: string | null;
}

interface Playlist {
  id: string;
  name: string;
  description: string;
  coverUrl: string | null;
  songIds: string[];
}

const THEMES = {
  green: {
    primary: '#00ff66',
    primaryGlow: 'rgba(0, 255, 102, 0.4)',
    dim: '#05b84c',
    dark: '#093016',
    background: '#030603',
    panel: 'rgba(8, 14, 8, 0.9)',
    border: 'rgba(0, 255, 102, 0.25)',
    borderActive: 'rgba(0, 255, 102, 0.65)',
    text: '#f5fff5',
    gray: '#8fa693'
  },
  red: {
    primary: '#ff003c',
    primaryGlow: 'rgba(255, 0, 60, 0.4)',
    dim: '#c2002d',
    dark: '#3d020d',
    background: '#060303',
    panel: 'rgba(14, 8, 8, 0.9)',
    border: 'rgba(255, 0, 60, 0.25)',
    borderActive: 'rgba(255, 0, 60, 0.65)',
    text: '#fff5f5',
    gray: '#a68f94'
  },
  blue: {
    primary: '#00bfff',
    primaryGlow: 'rgba(0, 191, 255, 0.4)',
    dim: '#0090c2',
    dark: '#022b3a',
    background: '#030506',
    panel: 'rgba(8, 12, 14, 0.9)',
    border: 'rgba(0, 191, 255, 0.25)',
    borderActive: 'rgba(0, 191, 255, 0.65)',
    text: '#f5faff',
    gray: '#8fa0a6'
  },
  gold: {
    primary: '#ffb700',
    primaryGlow: 'rgba(255, 183, 0, 0.4)',
    dim: '#c28b00',
    dark: '#3b2a02',
    background: '#060503',
    panel: 'rgba(14, 12, 8, 0.9)',
    border: 'rgba(255, 183, 0, 0.25)',
    borderActive: 'rgba(255, 183, 0, 0.65)',
    text: '#fffff5',
    gray: '#a69e8f'
  }
};

export default function App() {
  // Navigation
  const [activeTab, setActiveTab] = useState<TabMode>('library');

  // Persistence Preferences State
  const [theme, setTheme] = useState<ThemeMode>('green');
  const [volume, setVolume] = useState<number>(0.8);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isShuffle, setIsShuffle] = useState<boolean>(false);
  const [isRepeat, setIsRepeat] = useState<boolean>(false);
  const [offlineMode, setOfflineMode] = useState<boolean>(false);

  // Connection settings
  const [serverIp, setServerIp] = useState<string>('192.168.1.100');
  const [sshUser, setSshUser] = useState<string>('user');
  const [sshPassword, setSshPassword] = useState<string>('password');
  const [sshPort, setSshPort] = useState<string>('22');
  const [isSshConnected, setIsSshConnected] = useState<boolean>(false);
  const [isConnectingSsh, setIsConnectingSsh] = useState<boolean>(false);

  // Terminal Console Logs
  const [terminalLogs, setTerminalLogs] = useState<string[]>([
    'OMNITRIX OS v10.0.2 - CONSOLA DE ACCESO REMOTO SECURO',
    'Ingresa los parámetros de conexión para enlazar con la PC...',
    '-------------------------------------------------------'
  ]);
  const [terminalCommand, setTerminalCommand] = useState<string>('');

  // Media Library states
  const [songs, setSongs] = useState<Song[]>([]);
  const [localSongs, setLocalSongs] = useState<Song[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<Song[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);

  // Playback engine states
  const [currentTrack, setCurrentTrack] = useState<Song | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0.1);
  const [isBuffering, setIsBuffering] = useState<boolean>(false);
  const [downloadingSongId, setDownloadingSongId] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);

  // Audio object reference
  const soundRef = useRef<Audio.Sound | null>(null);

  // Animated rotation for the Omnitrix dial
  const rotateAnim = useRef(new Animated.Value(0)).current;

  // Active theme layout colors
  const activeColors = THEMES[theme];

  // Fetch API base URL derived from server IP
  const API_BASE = `http://${serverIp}:3000/api`;

  // Start visualizer rotation loop when playing
  useEffect(() => {
    if (isPlaying) {
      Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 8000,
          easing: Easing.linear,
          useNativeDriver: true
        })
      ).start();
    } else {
      rotateAnim.setValue(0);
    }
  }, [isPlaying]);

  // Load preferences and local library on mount
  useEffect(() => {
    const initApp = async () => {
      try {
        // Load settings
        const savedTheme = await AsyncStorage.getItem('omniplayer_theme');
        if (savedTheme) setTheme(savedTheme as ThemeMode);

        const savedVol = await AsyncStorage.getItem('omniplayer_volume');
        if (savedVol) setVolume(parseFloat(savedVol));

        const savedMute = await AsyncStorage.getItem('omniplayer_muted');
        if (savedMute) setIsMuted(savedMute === 'true');

        const savedShuffle = await AsyncStorage.getItem('omniplayer_shuffle');
        if (savedShuffle) setIsShuffle(savedShuffle === 'true');

        const savedRepeat = await AsyncStorage.getItem('omniplayer_repeat');
        if (savedRepeat) setIsRepeat(savedRepeat === 'true');

        const savedServer = await AsyncStorage.getItem('omniplayer_server_ip');
        if (savedServer) setServerIp(savedServer);

        const savedUser = await AsyncStorage.getItem('omniplayer_ssh_user');
        if (savedUser) setSshUser(savedUser);

        const savedPass = await AsyncStorage.getItem('omniplayer_ssh_pass');
        if (savedPass) setSshPassword(savedPass);

        const savedPort = await AsyncStorage.getItem('omniplayer_ssh_port');
        if (savedPort) setSshPort(savedPort);

        // Load local songs library index from storage
        const savedSongs = await AsyncStorage.getItem('omniplayer_local_songs');
        if (savedSongs) {
          const parsed = JSON.parse(savedSongs);
          setLocalSongs(parsed);
        }
      } catch (e) {
        console.error('Error loading preferences', e);
      }
    };
    initApp();
  }, []);

  // Write preference state changes to AsyncStorage
  useEffect(() => {
    AsyncStorage.setItem('omniplayer_theme', theme);
  }, [theme]);

  useEffect(() => {
    AsyncStorage.setItem('omniplayer_volume', volume.toString());
  }, [volume]);

  useEffect(() => {
    AsyncStorage.setItem('omniplayer_muted', isMuted.toString());
  }, [isMuted]);

  useEffect(() => {
    AsyncStorage.setItem('omniplayer_shuffle', isShuffle.toString());
  }, [isShuffle]);

  useEffect(() => {
    AsyncStorage.setItem('omniplayer_repeat', isRepeat.toString());
  }, [isRepeat]);

  // Fetch PC library when IP changes or when online mode transitions
  useEffect(() => {
    if (!offlineMode && serverIp) {
      fetchPcLibrary();
    }
  }, [serverIp, offlineMode]);

  // Sync sound volume when state changes
  useEffect(() => {
    const updateSoundVolume = async () => {
      if (soundRef.current) {
        try {
          await soundRef.current.setVolumeAsync(isMuted ? 0 : volume);
        } catch (e) {
          console.warn('Volume set error', e);
        }
      }
    };
    updateSoundVolume();
  }, [volume, isMuted]);

  // Fetch PC Hono library
  const fetchPcLibrary = async () => {
    try {
      const response = await fetch(`${API_BASE}/songs`);
      if (response.ok) {
        const data = await response.json();
        setSongs(data.songs || []);
        setPlaylists(data.playlists || []);
        addLog(`[OK] Biblioteca remota sincronizada con la PC.`);
      } else {
        throw new Error('Server response failure');
      }
    } catch (e: any) {
      console.warn('PC Server unreachable', e.message);
      addLog(`[ERROR] No se pudo conectar a la PC (${serverIp}:3000). Cambiando a biblioteca local.`);
    }
  };

  // SSH simulation & console command execution (via secure /api/ssh/execute endpoint on Hono)
  const handleSshConnect = async () => {
    setIsConnectingSsh(true);
    setTerminalLogs(prev => [...prev, `Conectando SSH a ${sshUser}@${serverIp}:${sshPort}...`]);
    
    try {
      // Connect check simply executes "uname -a" or "hostname" via the PC backend
      const response = await fetch(`${API_BASE}/ssh/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: 'hostname' })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setIsSshConnected(true);
        addLog(`[SUCCESS] Sesión SSH establecida con éxito.`);
        setTerminalLogs(prev => [
          ...prev, 
          `[SUCCESS] SSH Conectado a la PC: ${data.stdout.trim() || 'Servidor Hono'}`,
          `Servicios API y descarga listos.`
        ]);
        // Save server configuration
        await AsyncStorage.setItem('omniplayer_server_ip', serverIp);
        await AsyncStorage.setItem('omniplayer_ssh_user', sshUser);
        await AsyncStorage.setItem('omniplayer_ssh_pass', sshPassword);
        await AsyncStorage.setItem('omniplayer_ssh_port', sshPort);
      } else {
        throw new Error(data.stderr || 'Auth rejected');
      }
    } catch (e: any) {
      setIsSshConnected(false);
      setTerminalLogs(prev => [
        ...prev,
        `[AUTH ERROR] Falló la autenticación SSH: ${e.message}`
      ]);
    } finally {
      setIsConnectingSsh(false);
    }
  };

  const handleExecuteSshCommand = async () => {
    if (!terminalCommand.trim()) return;
    const cmd = terminalCommand.trim();
    setTerminalLogs(prev => [...prev, `\n$ ${cmd}`]);
    setTerminalCommand('');

    if (cmd === 'clear') {
      setTerminalLogs([]);
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/ssh/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cmd })
      });
      const data = await response.json();
      if (data.success) {
        if (data.stdout) setTerminalLogs(prev => [...prev, data.stdout.trim()]);
        if (data.stderr) setTerminalLogs(prev => [...prev, `[ERR] ${data.stderr.trim()}`]);
      } else {
        setTerminalLogs(prev => [...prev, `[FAIL] ${data.stderr || 'No response output'}`]);
      }
    } catch (e: any) {
      setTerminalLogs(prev => [...prev, `[CON_ERROR] Error de comunicación: ${e.message}`]);
    }
  };

  const addLog = (log: string) => {
    setTerminalLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${log}`]);
  };

  // Searching songs via PC API
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const response = await fetch(`${API_BASE}/search?q=${encodeURIComponent(searchQuery)}`);
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.results || []);
      } else {
        Alert.alert('Error', 'Falló la búsqueda de YouTube en el servidor.');
      }
    } catch (e) {
      Alert.alert('Error', 'PC Servidor inaccesible. Activa el wifi o configúralo.');
    } finally {
      setIsSearching(false);
    }
  };

  // Physical Song Downloading from PC to Mobile storage
  const handleDownloadToMobile = async (song: Song) => {
    if (offlineMode) {
      Alert.alert('Error', 'Modo offline activo. Conéctate a la PC para descargar.');
      return;
    }

    setDownloadingSongId(song.id);
    setDownloadProgress(0);
    addLog(`Iniciando descarga de: "${song.title}" al móvil...`);

    try {
      // Step 1: Request PC to download it locally to Hono first (to make sure the file exists and is converted to mp3)
      const downloadTrigger = await fetch(`${API_BASE}/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: song.url })
      });
      
      if (!downloadTrigger.ok) {
        throw new Error('La descarga en PC falló.');
      }
      
      const pcResult = await downloadTrigger.json();
      if (!pcResult.success || !pcResult.song || !pcResult.song.filename) {
        throw new Error('No se obtuvo el archivo de audio convertido en la PC.');
      }

      // Step 2: Download converted audio file (.mp3) from PC Hono server to mobile storage
      const filename = pcResult.song.filename;
      const downloadUrl = `${API_BASE.replace('/api', '')}/songs/${encodeURIComponent(filename)}`;
      const fileUri = `${FileSystem.documentDirectory}${song.id}.mp3`;

      const downloadResumable = FileSystem.createDownloadResumable(
        downloadUrl,
        fileUri,
        {},
        (progressData) => {
          const progress = progressData.totalBytesWritten / progressData.totalBytesExpectedToWrite;
          setDownloadProgress(progress);
        }
      );

      const result = await downloadResumable.downloadAsync();
      if (result && result.uri) {
        // Step 3: Save to local index
        const newLocalSong: Song = {
          ...song,
          filename: filename,
          isDownloaded: true,
          localUri: result.uri,
          liked: true // downloaded implies liked/saved locally
        };

        const updatedLocal = [newLocalSong, ...localSongs.filter(s => s.id !== song.id)];
        setLocalSongs(updatedLocal);
        await AsyncStorage.setItem('omniplayer_local_songs', JSON.stringify(updatedLocal));
        
        // Refresh local songs index
        addLog(`Descargado localmente: "${song.title}". Guardado en ${result.uri}`);
        Alert.alert('Éxito', `Canción descargada localmente para reproducción sin internet.`);
      }
    } catch (e: any) {
      console.error(e);
      Alert.alert('Error de descarga', `Ocurrió un error: ${e.message}`);
      addLog(`[ERR] Descarga fallida: ${e.message}`);
    } finally {
      setDownloadingSongId(null);
    }
  };

  const handleDeleteLocalSong = async (songId: string) => {
    const fileUri = `${FileSystem.documentDirectory}${songId}.mp3`;
    try {
      await FileSystem.deleteAsync(fileUri, { idempotent: true });
      const updated = localSongs.filter(s => s.id !== songId);
      setLocalSongs(updated);
      await AsyncStorage.setItem('omniplayer_local_songs', JSON.stringify(updated));
      addLog(`Archivo local eliminado: ${songId}.mp3`);
      Alert.alert('Eliminado', 'Archivo de audio removido del dispositivo.');
    } catch (e: any) {
      Alert.alert('Error', `No se pudo eliminar el archivo: ${e.message}`);
    }
  };

  // Playback Control logic
  const handlePlaySong = async (song: Song) => {
    setIsBuffering(true);
    try {
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
      }

      // Check if we play from local storage or stream it from the PC
      let trackUri = '';
      const localTrack = localSongs.find(s => s.id === song.id);
      
      if (localTrack && localTrack.localUri) {
        trackUri = localTrack.localUri;
        addLog(`[PLAY] Reproduciendo archivo local: ${song.title}`);
      } else {
        if (offlineMode) {
          Alert.alert('Modo sin conexión', 'Esta canción requiere conexión a internet o a la PC.');
          setIsBuffering(false);
          return;
        }

        // Get Stream URL via PC Hono Proxy
        const response = await fetch(`${API_BASE}/stream?url=${encodeURIComponent(song.url)}`);
        const data = await response.json();
        if (response.ok && data.success && data.stream_url) {
          trackUri = data.stream_url;
          addLog(`[PLAY] Transmitiendo desde YouTube: ${song.title}`);
        } else {
          throw new Error(data.details || 'Fallo de extracción');
        }
      }

      const { sound } = await Audio.Sound.createAsync(
        { uri: trackUri },
        { 
          shouldPlay: true, 
          volume: isMuted ? 0 : volume, 
          isMuted: isMuted 
        },
        onPlaybackStatusUpdate
      );

      soundRef.current = sound;
      setCurrentTrack(song);
      setIsPlaying(true);
    } catch (e: any) {
      console.warn(e);
      Alert.alert('Error de reproducción', `Frecuencia holográfica caída: ${e.message}`);
    } finally {
      setIsBuffering(false);
    }
  };

  const onPlaybackStatusUpdate = (status: any) => {
    if (status.isLoaded) {
      setCurrentTime(status.positionMillis / 1000);
      setDuration((status.durationMillis || 1000) / 1000);
      setIsBuffering(status.isBuffering);
      if (status.didJustFinish) {
        handleNextTrack();
      }
    }
  };

  const togglePlayPause = async () => {
    if (!soundRef.current) return;
    try {
      if (isPlaying) {
        await soundRef.current.pauseAsync();
        setIsPlaying(false);
      } else {
        await soundRef.current.playAsync();
        setIsPlaying(true);
      }
    } catch (e) {
      console.warn(e);
    }
  };

  const handleNextTrack = () => {
    const activeQueue = offlineMode ? localSongs : (songs.length > 0 ? songs : localSongs);
    if (activeQueue.length === 0) return;

    let nextIndex = 0;
    if (isShuffle) {
      nextIndex = Math.floor(Math.random() * activeQueue.length);
    } else if (currentTrack) {
      const idx = activeQueue.findIndex(s => s.id === currentTrack.id);
      nextIndex = idx + 1;
      if (nextIndex >= activeQueue.length) {
        nextIndex = isRepeat ? 0 : -1;
      }
    }

    if (nextIndex > -1) {
      handlePlaySong(activeQueue[nextIndex]);
    }
  };

  const handlePrevTrack = () => {
    const activeQueue = offlineMode ? localSongs : (songs.length > 0 ? songs : localSongs);
    if (activeQueue.length === 0) return;

    let prevIndex = 0;
    if (currentTrack) {
      const idx = activeQueue.findIndex(s => s.id === currentTrack.id);
      prevIndex = idx - 1;
      if (prevIndex < 0) prevIndex = activeQueue.length - 1;
    }

    handlePlaySong(activeQueue[prevIndex]);
  };

  // Custom Touch Handlers for Seeker Bar
  const handleSeekTouch = (e: any) => {
    if (!soundRef.current) return;
    const { locationX } = e.nativeEvent;
    const barWidth = SCREEN_WIDTH * 0.7; // 70% width
    const percentage = Math.max(0, Math.min(1, locationX / barWidth));
    const seekTime = percentage * duration;
    soundRef.current.setPositionAsync(seekTime * 1000);
    setCurrentTime(seekTime);
  };

  const handleVolumeTouch = (e: any) => {
    const { locationX } = e.nativeEvent;
    const barWidth = 80; // 80px width
    const newVol = Math.max(0, Math.min(1, locationX / barWidth));
    setVolume(newVol);
    setIsMuted(false);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const toggleTheme = () => {
    const skins: ThemeMode[] = ['green', 'red', 'blue', 'gold'];
    const idx = skins.indexOf(theme);
    const nextIdx = (idx + 1) % skins.length;
    setTheme(skins[nextIdx]);
  };

  // Volume Bar color ranges representing power metrics
  const getVolumeFillColor = () => {
    if (isMuted) return '#555';
    if (volume > 0.75) return '#ff003c'; // Danger overload Albedo Red
    if (volume > 0.3) return activeColors.primary; // Active theme
    return activeColors.dim; // Safe dim theme
  };

  return (
    <View style={[styles.root, { backgroundColor: activeColors.background }]}>
      <StatusBar style={theme === 'green' ? 'light' : 'auto'} />
      
      {/* Hologram scanline HUD overlay */}
      <View style={styles.hologramScanline} pointerEvents="none" />

      {/* HEADER HUD BAR */}
      <View style={[styles.headerHud, { borderBottomColor: activeColors.border }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={toggleTheme} style={[styles.skinBadge, { borderColor: activeColors.borderActive }]}>
            <Text style={[styles.skinText, { color: activeColors.primary }]}>SKIN: {theme.toUpperCase()}</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.headerRight}>
          <TouchableOpacity 
            onPress={() => setOfflineMode(!offlineMode)}
            style={[styles.connectionStatus, { borderColor: offlineMode ? '#ff003c' : activeColors.primary }]}
          >
            {offlineMode ? <WifiOff size={14} color="#ff003c" /> : <Wifi size={14} color={activeColors.primary} />}
            <Text style={[styles.connectionText, { color: offlineMode ? '#ff003c' : activeColors.primary }]}>
              {offlineMode ? 'OFFLINE' : 'ONLINE'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* CORE DISPLAY (CENTER VIEW) */}
      <View style={styles.displayArea}>
        
        {/* OMNITRIX DIAL GRAPHIC CONTAINER */}
        <View style={styles.omnitrixContainer}>
          <Animated.View 
            style={[
              styles.omnitrixDial, 
              { 
                borderColor: activeColors.primary, 
                shadowColor: activeColors.primary,
                transform: [{
                  rotate: rotateAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', '360deg']
                  })
                }]
              }
            ]}
          >
            {/* Thematic Omnitrix Symbol design layout */}
            <View style={[styles.dialCoreWedgeLeft, { borderRightColor: activeColors.primary, borderBottomColor: activeColors.primary }]} />
            <View style={[styles.dialCoreWedgeRight, { borderLeftColor: activeColors.primary, borderTopColor: activeColors.primary }]} />
            <View style={[styles.dialCoreHourglass, { backgroundColor: isPlaying ? activeColors.primaryGlow : 'rgba(0,0,0,0.6)', borderColor: activeColors.primary }]} />
          </Animated.View>
        </View>

        {/* SCREEN TABS BAR */}
        <View style={[styles.tabsBar, { borderBottomColor: activeColors.border }]}>
          <TouchableOpacity onPress={() => setActiveTab('library')} style={styles.tabButton}>
            <Text style={[styles.tabText, activeTab === 'library' && { color: activeColors.primary, textShadowColor: activeColors.primaryGlow, textShadowRadius: 8 }]}>BIBLIOTECA</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setActiveTab('search')} style={styles.tabButton}>
            <Text style={[styles.tabText, activeTab === 'search' && { color: activeColors.primary, textShadowColor: activeColors.primaryGlow, textShadowRadius: 8 }]}>BUSCAR</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setActiveTab('playlists')} style={styles.tabButton}>
            <Text style={[styles.tabText, activeTab === 'playlists' && { color: activeColors.primary, textShadowColor: activeColors.primaryGlow, textShadowRadius: 8 }]}>PLAYLISTS</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setActiveTab('ssh_settings')} style={styles.tabButton}>
            <Text style={[styles.tabText, activeTab === 'ssh_settings' && { color: activeColors.primary, textShadowColor: activeColors.primaryGlow, textShadowRadius: 8 }]}>SSH/PC</Text>
          </TouchableOpacity>
        </View>

        {/* SCREEN PANEL CONTENT */}
        <View style={styles.panelContainer}>
          
          {/* TAB 1: LIBRARY PANEL */}
          {activeTab === 'library' && (
            <ScrollView style={styles.tabScroll}>
              <Text style={[styles.panelSubtitle, { color: activeColors.primary }]}>BIBLIOTECA LOCAL DISPOSITIVO ({localSongs.length})</Text>
              
              {localSongs.map(song => (
                <View key={song.id} style={[styles.songRow, { backgroundColor: activeColors.panel, borderColor: activeColors.border }]}>
                  <HardDrive size={18} color={activeColors.primary} />
                  <View style={styles.songRowDetails}>
                    <Text numberOfLines={1} style={styles.songRowTitle}>{song.title}</Text>
                    <Text numberOfLines={1} style={[styles.songRowArtist, { color: activeColors.gray }]}>{song.artist}</Text>
                  </View>
                  <View style={styles.rowActions}>
                    <TouchableOpacity onPress={() => handlePlaySong(song)} style={styles.actionBtn}>
                      <Play size={16} color={activeColors.primary} fill={activeColors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDeleteLocalSong(song.id)} style={styles.actionBtn}>
                      <Trash2 size={16} color="#ff003c" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}

              {!offlineMode && (
                <>
                  <Text style={[styles.panelSubtitle, { color: activeColors.primary, marginTop: 16 }]}>CANCTONES EN LA PC ({songs.length})</Text>
                  {songs.map(song => {
                    const isDownloaded = localSongs.some(ls => ls.id === song.id);
                    return (
                      <View key={song.id} style={[styles.songRow, { backgroundColor: activeColors.panel, borderColor: activeColors.border, opacity: isDownloaded ? 0.75 : 1 }]}>
                        {isDownloaded ? <HardDrive size={18} color={activeColors.primary} /> : <Wifi size={18} color={activeColors.gray} />}
                        <View style={styles.songRowDetails}>
                          <Text numberOfLines={1} style={styles.songRowTitle}>{song.title}</Text>
                          <Text numberOfLines={1} style={[styles.songRowArtist, { color: activeColors.gray }]}>{song.artist}</Text>
                        </View>
                        <View style={styles.rowActions}>
                          <TouchableOpacity onPress={() => handlePlaySong(song)} style={styles.actionBtn}>
                            <Play size={16} color={activeColors.primary} fill={activeColors.primary} />
                          </TouchableOpacity>
                          {!isDownloaded && (
                            <TouchableOpacity 
                              onPress={() => handleDownloadToMobile(song)} 
                              style={styles.actionBtn}
                              disabled={downloadingSongId === song.id}
                            >
                              {downloadingSongId === song.id ? (
                                <ActivityIndicator size="small" color={activeColors.primary} />
                              ) : (
                                <Download size={16} color={activeColors.primary} />
                              )}
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </>
              )}
            </ScrollView>
          )}

          {/* TAB 2: SEARCH PANEL */}
          {activeTab === 'search' && (
            <View style={styles.searchPanel}>
              <View style={[styles.searchInputWrapper, { borderColor: activeColors.border }]}>
                <TextInput 
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Buscar en YouTube..."
                  placeholderTextColor={activeColors.gray}
                  style={styles.searchInput}
                  onSubmitEditing={handleSearch}
                />
                <TouchableOpacity onPress={handleSearch} style={styles.searchBtn}>
                  {isSearching ? <ActivityIndicator size="small" color={activeColors.primary} /> : <Search size={20} color={activeColors.primary} />}
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.tabScroll}>
                {searchResults.map(song => (
                  <View key={song.id} style={[styles.songRow, { backgroundColor: activeColors.panel, borderColor: activeColors.border }]}>
                    <Music size={18} color={activeColors.primary} />
                    <View style={styles.songRowDetails}>
                      <Text numberOfLines={1} style={styles.songRowTitle}>{song.title}</Text>
                      <Text numberOfLines={1} style={[styles.songRowArtist, { color: activeColors.gray }]}>{song.artist}</Text>
                    </View>
                    <View style={styles.rowActions}>
                      <TouchableOpacity onPress={() => handlePlaySong(song)} style={styles.actionBtn}>
                        <Play size={16} color={activeColors.primary} fill={activeColors.primary} />
                      </TouchableOpacity>
                      <TouchableOpacity 
                        onPress={() => handleDownloadToMobile(song)} 
                        style={styles.actionBtn}
                        disabled={downloadingSongId === song.id}
                      >
                        {downloadingSongId === song.id ? (
                          <ActivityIndicator size="small" color={activeColors.primary} />
                        ) : (
                          <Download size={16} color={activeColors.primary} />
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {/* TAB 3: PLAYLISTS PANEL */}
          {activeTab === 'playlists' && (
            <ScrollView style={styles.tabScroll}>
              <Text style={[styles.panelSubtitle, { color: activeColors.primary }]}>PLAYLISTS EN LA PC</Text>
              
              {playlists.map(pl => (
                <TouchableOpacity 
                  key={pl.id} 
                  onPress={() => setSelectedPlaylistId(selectedPlaylistId === pl.id ? null : pl.id)}
                  style={[styles.playlistHeaderRow, { backgroundColor: activeColors.panel, borderColor: activeColors.border }]}
                >
                  <View>
                    <Text style={styles.playlistName}>{pl.name}</Text>
                    <Text style={[styles.playlistDesc, { color: activeColors.gray }]}>{pl.description || 'Sin descripción holográfica.'}</Text>
                  </View>
                  <Text style={[styles.playlistCount, { color: activeColors.primary }]}>{pl.songIds.length} temas</Text>
                </TouchableOpacity>
              ))}

              {playlists.length === 0 && (
                <Text style={styles.noPlaylistsText}>Conéctate a la PC para sincronizar y ver tus playlists.</Text>
              )}
            </ScrollView>
          )}

          {/* TAB 4: SSH / SERVER SETTINGS PANEL */}
          {activeTab === 'ssh_settings' && (
            <View style={styles.sshLayout}>
              
              {/* Form Input parameters */}
              <View style={[styles.sshFormPanel, { backgroundColor: activeColors.panel, borderColor: activeColors.border }]}>
                <Text style={[styles.sshFormTitle, { color: activeColors.primary }]}>CONEXIÓN SSH / HONO SERVIDOR</Text>
                
                <TextInput 
                  value={serverIp}
                  onChangeText={setServerIp}
                  placeholder="IP Servidor PC (e.g. 192.168.1.50)"
                  placeholderTextColor={activeColors.gray}
                  style={[styles.sshInput, { borderColor: activeColors.border, color: activeColors.text }]}
                />
                
                <View style={styles.rowFormInputs}>
                  <TextInput 
                    value={sshUser}
                    onChangeText={setSshUser}
                    placeholder="SSH User"
                    placeholderTextColor={activeColors.gray}
                    style={[styles.sshInput, { flex: 1, marginRight: 8, borderColor: activeColors.border, color: activeColors.text }]}
                  />
                  <TextInput 
                    value={sshPort}
                    onChangeText={setSshPort}
                    keyboardType="numeric"
                    placeholder="Port"
                    placeholderTextColor={activeColors.gray}
                    style={[styles.sshInput, { width: 60, borderColor: activeColors.border, color: activeColors.text }]}
                  />
                </View>

                <TextInput 
                  value={sshPassword}
                  onChangeText={setSshPassword}
                  secureTextEntry
                  placeholder="SSH Password"
                  placeholderTextColor={activeColors.gray}
                  style={[styles.sshInput, { borderColor: activeColors.border, color: activeColors.text }]}
                />

                <TouchableOpacity 
                  onPress={handleSshConnect} 
                  style={[styles.sshConnectBtn, { backgroundColor: activeColors.dark, borderColor: activeColors.primary }]}
                  disabled={isConnectingSsh}
                >
                  {isConnectingSsh ? (
                    <ActivityIndicator size="small" color={activeColors.primary} />
                  ) : (
                    <Text style={[styles.sshConnectText, { color: activeColors.primary }]}>
                      {isSshConnected ? 'DESCONECTAR SSH (ACTIVO)' : 'ENLAZAR SSH CON PC'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>

              {/* SSH Retro scanline CLI terminal prompt */}
              <View style={styles.terminalContainer}>
                <ScrollView 
                  style={styles.terminalLogs}
                  ref={ref => { if (ref) ref.scrollToEnd({ animated: true }); }}
                >
                  {terminalLogs.map((log, index) => (
                    <Text key={index} style={[styles.terminalText, { color: activeColors.primary }]}>{log}</Text>
                  ))}
                </ScrollView>
                <View style={styles.terminalPromptRow}>
                  <Terminal size={14} color={activeColors.primary} style={{ marginRight: 4 }} />
                  <TextInput 
                    value={terminalCommand}
                    onChangeText={setTerminalCommand}
                    placeholder="Ej: ls, pm2 list, hostname..."
                    placeholderTextColor="rgba(0,255,102,0.3)"
                    onSubmitEditing={handleExecuteSshCommand}
                    style={[styles.terminalInput, { color: activeColors.primary }]}
                  />
                </View>
              </View>

            </View>
          )}

        </View>
      </View>

      {/* FOOTER MEDIA PLAYER BAR */}
      <View style={[styles.playerBar, { backgroundColor: activeColors.panel, borderTopColor: activeColors.border }]}>
        
        {/* Progress Bar (Dynamic fill on touch) */}
        <View style={styles.progressContainer}>
          <Text style={[styles.timeText, { color: activeColors.gray }]}>{formatTime(currentTime)}</Text>
          <TouchableOpacity 
            activeOpacity={1} 
            onPress={handleSeekTouch} 
            style={[styles.progressRail, { backgroundColor: '#111' }]}
          >
            <View 
              style={[
                styles.progressFill, 
                { 
                  backgroundColor: activeColors.primary,
                  width: `${(currentTime / duration) * 100}%` 
                }
              ]} 
            />
          </TouchableOpacity>
          <Text style={[styles.timeText, { color: activeColors.gray }]}>{formatTime(duration)}</Text>
        </View>

        {/* Media Controls details row */}
        <View style={styles.controlsRow}>
          
          {/* Song Info */}
          <View style={styles.songMetadata}>
            <Text numberOfLines={1} style={styles.playerSongTitle}>
              {currentTrack ? currentTrack.title : 'OMNIPLAYER HOLOGRAPH'}
            </Text>
            <Text numberOfLines={1} style={[styles.playerSongArtist, { color: activeColors.gray }]}>
              {currentTrack ? currentTrack.artist : 'Selecciona una pista'}
            </Text>
          </View>

          {/* Core Player buttons */}
          <View style={styles.playbackButtons}>
            <TouchableOpacity onPress={() => setIsShuffle(!isShuffle)} style={styles.btnIcon}>
              <Shuffle size={18} color={isShuffle ? activeColors.primary : activeColors.gray} />
            </TouchableOpacity>

            <TouchableOpacity onPress={handlePrevTrack} style={styles.btnIcon}>
              <SkipBack size={20} color={activeColors.primary} fill={activeColors.primary} />
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={togglePlayPause} 
              style={[styles.btnPlay, { backgroundColor: activeColors.primary }]}
            >
              {isBuffering ? (
                <ActivityIndicator size="small" color="#000" />
              ) : isPlaying ? (
                <Pause size={18} color="#000" fill="#000" />
              ) : (
                <Play size={18} color="#000" fill="#000" style={{ marginLeft: 2 }} />
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={handleNextTrack} style={styles.btnIcon}>
              <SkipForward size={20} color={activeColors.primary} fill={activeColors.primary} />
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setIsRepeat(!isRepeat)} style={styles.btnIcon}>
              <Repeat size={18} color={isRepeat ? activeColors.primary : activeColors.gray} />
            </TouchableOpacity>
          </View>

          {/* Volume Control */}
          <View style={styles.volumeWidget}>
            <TouchableOpacity onPress={() => setIsMuted(!isMuted)}>
              {isMuted || volume === 0 ? (
                <VolumeX size={16} color="#ff003c" />
              ) : (
                <Volume2 size={16} color={activeColors.primary} />
              )}
            </TouchableOpacity>
            
            <TouchableOpacity 
              activeOpacity={1} 
              onPress={handleVolumeTouch}
              style={styles.volumeRail}
            >
              <View 
                style={[
                  styles.volumeFill, 
                  { 
                    backgroundColor: getVolumeFillColor(),
                    width: `${volume * 100}%` 
                  }
                ]} 
              />
            </TouchableOpacity>
          </View>

        </View>

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingTop: 40,
  },
  hologramScanline: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'transparent',
    opacity: 0.1,
    zIndex: 9999,
  },
  headerHud: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  skinBadge: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  skinText: {
    fontSize: 9,
    fontFamily: 'monospace',
    fontWeight: 'bold',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  connectionText: {
    fontSize: 9,
    fontFamily: 'monospace',
    fontWeight: 'bold',
    marginLeft: 4,
  },
  displayArea: {
    flex: 1,
    paddingHorizontal: 12,
  },
  omnitrixContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
  },
  omnitrixDial: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 15,
    elevation: 10,
    overflow: 'hidden',
  },
  dialCoreHourglass: {
    width: 60,
    height: 60,
    transform: [{ rotate: '45deg' }],
    borderWidth: 4,
  },
  dialCoreWedgeLeft: {
    position: 'absolute',
    left: 0,
    width: 70,
    height: 140,
    borderRightWidth: 4,
    borderBottomWidth: 4,
  },
  dialCoreWedgeRight: {
    position: 'absolute',
    right: 0,
    width: 70,
    height: 140,
    borderLeftWidth: 4,
    borderTopWidth: 4,
  },
  tabsBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    paddingBottom: 4,
    marginBottom: 8,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
  },
  tabText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#8fa693',
    fontFamily: 'monospace',
  },
  panelContainer: {
    flex: 1,
  },
  tabScroll: {
    flex: 1,
  },
  panelSubtitle: {
    fontSize: 10,
    fontFamily: 'monospace',
    fontWeight: 'bold',
    marginBottom: 8,
    letterSpacing: 1,
  },
  songRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 6,
    padding: 10,
    marginBottom: 6,
  },
  songRowDetails: {
    flex: 1,
    marginLeft: 10,
  },
  songRowTitle: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  songRowArtist: {
    fontSize: 11,
    marginTop: 2,
  },
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionBtn: {
    padding: 6,
    marginLeft: 8,
  },
  searchPanel: {
    flex: 1,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 8,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    height: 40,
    color: '#fff',
    fontSize: 13,
  },
  searchBtn: {
    padding: 8,
  },
  playlistHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 6,
    padding: 12,
    marginBottom: 8,
  },
  playlistName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  playlistDesc: {
    fontSize: 11,
    marginTop: 2,
  },
  playlistCount: {
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  noPlaylistsText: {
    textAlign: 'center',
    color: '#8fa693',
    marginTop: 40,
    fontSize: 12,
  },
  sshLayout: {
    flex: 1,
  },
  sshFormPanel: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  sshFormTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    fontFamily: 'monospace',
    marginBottom: 8,
  },
  sshInput: {
    borderWidth: 1,
    borderRadius: 4,
    height: 36,
    paddingHorizontal: 8,
    fontSize: 12,
    backgroundColor: 'rgba(0,0,0,0.4)',
    marginBottom: 8,
  },
  rowFormInputs: {
    flexDirection: 'row',
    marginBottom: 0,
  },
  sshConnectBtn: {
    borderWidth: 1,
    height: 36,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  sshConnectText: {
    fontSize: 11,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  terminalContainer: {
    flex: 1,
    backgroundColor: '#000',
    borderWidth: 1,
    borderColor: '#00ff66',
    borderRadius: 6,
    padding: 8,
    minHeight: 120,
  },
  terminalLogs: {
    flex: 1,
  },
  terminalText: {
    fontFamily: 'monospace',
    fontSize: 10,
    lineHeight: 14,
  },
  terminalPromptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,255,102,0.2)',
    paddingTop: 4,
    marginTop: 4,
  },
  terminalInput: {
    flex: 1,
    height: 24,
    fontSize: 10,
    fontFamily: 'monospace',
    padding: 0,
  },
  playerBar: {
    borderTopWidth: 1,
    paddingHorizontal: 12,
    paddingBottom: 12,
    paddingTop: 8,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  timeText: {
    fontSize: 9,
    fontFamily: 'monospace',
    width: 28,
    textAlign: 'center',
  },
  progressRail: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    marginHorizontal: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  songMetadata: {
    width: '30%',
  },
  playerSongTitle: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  playerSongArtist: {
    fontSize: 9,
    marginTop: 1,
  },
  playbackButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '45%',
  },
  btnIcon: {
    padding: 8,
    marginHorizontal: 2,
  },
  btnPlay: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 8,
  },
  volumeWidget: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '25%',
    justifyContent: 'flex-end',
  },
  volumeRail: {
    width: 60,
    height: 4,
    backgroundColor: '#111',
    borderRadius: 2,
    marginLeft: 6,
    overflow: 'hidden',
  },
  volumeFill: {
    height: '100%',
    borderRadius: 2,
  }
});
