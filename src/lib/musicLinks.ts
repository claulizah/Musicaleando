import { Linking } from 'react-native';

// Community Trends' `songs` catalog only stores clean artista/titulo (no
// Spotify track ID — that only exists for Torneo Sonoro's artist-level
// data, a different table). A search deep link is the reliable option:
// the 30s preview API is being deprecated by Spotify and already too
// flaky to depend on for Torneo Sonoro, so we don't attempt embedded
// playback here either — same call, same reasoning.
function searchQuery(artista: string, titulo: string): string {
  return encodeURIComponent(`${artista} ${titulo}`);
}

function spotifySearchUrl(artista: string, titulo: string): string {
  return `https://open.spotify.com/search/${searchQuery(artista, titulo)}`;
}

function youtubeMusicSearchUrl(artista: string, titulo: string): string {
  return `https://music.youtube.com/search?q=${searchQuery(artista, titulo)}`;
}

// Opens Spotify search for the track; if that fails to open (no browser/
// Spotify handler available), falls back to YouTube Music search.
export async function openListenLink(artista: string, titulo: string): Promise<void> {
  try {
    await Linking.openURL(spotifySearchUrl(artista, titulo));
  } catch {
    await Linking.openURL(youtubeMusicSearchUrl(artista, titulo));
  }
}
