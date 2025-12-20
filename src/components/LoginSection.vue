<script setup lang="ts">
import { ref } from 'vue';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface Song {
  album: { name: null | string },
  name: null | string,
  artists: [{ "name": "ukn" }]
}

// ============================================================================
// PROPS
// ============================================================================

defineProps<{
  msg: string
}>()

// ============================================================================
// CONSTANTS
// ============================================================================

const stateKey = 'code_verifier';
const client_id: string = '43cee162706f463dbb62be67258fbe2f';
const redirect_uri: string = 'http://127.0.0.1:5173/';

// ============================================================================
// REACTIVE STATE
// ============================================================================

let params: Record<string, string> = {};
const hasAccessToken = ref(!!localStorage.getItem('access_token'));
const topSong = ref({ 'name': '', 'artist': '' });

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Generates a random string of specified length
 */
function generateRandomString(length: number): string {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const values = crypto.getRandomValues(new Uint8Array(length));
  return values.reduce((acc, x) => acc + possible[x % possible.length], "");
}

/**
 * Hashes a string using SHA-256
 */
const sha256 = async (plain: string) => {
  const encoder = new TextEncoder()
  const data = encoder.encode(plain)
  return window.crypto.subtle.digest('SHA-256', data)
}

/**
 * Encodes an ArrayBuffer to base64url format
 */
const base64encode = (input: ArrayBuffer) => {
  return btoa(String.fromCharCode(...new Uint8Array(input)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

/**
 * Extracts the parameters out of the redirected URI after Spotify login
 */
function getHashParams(): Record<string, string> {
  const params: Record<string, string> = {};
  const queryString = window.location.hash.substring(1) + '&' + window.location.search.substring(1);

  const regex = /([^&;=]+)=?([^&;]*)/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(queryString))) {
    if (match[1] && match[2]) {
      params[match[1]] = decodeURIComponent(match[2]);
    }
  }

  return params;
}

// ============================================================================
// SPOTIFY AUTHENTICATION & API
// ============================================================================

/**
 * Exchanges authorization code for an access token
 */
const getToken = async function (code: string) {
  if (!code) {
    console.error("No code provided for token exchange.");
    return;
  }

  const codeVerifier = localStorage.getItem('code_verifier');
  if (!codeVerifier) {
    console.error("No code verifier found in local storage.");
    return;
  }

  const url = "https://accounts.spotify.com/api/token";
  const payload = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: client_id,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirect_uri,
      code_verifier: codeVerifier,
    }),
  }

  const body = await fetch(url, payload);
  const response = await body.json();

  console.log("Response:", response);
  localStorage.setItem('access_token', response.access_token);
}

/**
 * Redirects user to Spotify login with PKCE flow
 */
async function redirectToSpotifyLogin() {
  const codeVerifier = generateRandomString(64);
  localStorage.setItem(stateKey, codeVerifier);

  const hashed = await sha256(codeVerifier)
  const codeChallenge = base64encode(hashed);

  const scope = 'user-top-read';

  let url = 'https://accounts.spotify.com/authorize';
  url += '?response_type=code';
  url += '&client_id=' + encodeURIComponent(client_id);
  url += '&scope=' + encodeURIComponent(scope);
  url += '&redirect_uri=' + encodeURIComponent(redirect_uri);
  url += '&code_challenge_method=' + 'S256';
  url += '&code_challenge=' + encodeURIComponent(codeChallenge);
  url += '&show_dialog=true';

  window.location.href = url;
}

/**
 * Fetches user's top songs from Spotify API
 */
function fetchSongs(): Promise<Song[]> {
  const headers = new Headers()
  headers.set('Authorization', 'Bearer ' + localStorage.getItem('access_token'))
  return fetch('https://api.spotify.com/v1/me/top/tracks?time_range=long_term&limit=1', { headers })
    .then(response => response.json())
    .then((data) => {
      console.log("Fetched data:", data);
      return data.items as Song[];
    })
}

// ============================================================================
// USER ACTIONS
// ============================================================================

/**
 * Initiates Spotify login
 */
function login() {
  redirectToSpotifyLogin();
}

/**
 * Starts the game by fetching user's top song
 */
function start() {
  console.log("Starting the game...");
  fetchSongs().then(songs => {
    console.log("Fetched songs:", songs);
    if (songs[0] != undefined && songs[0] != null && songs[0].name != null) {
      topSong.value.name = songs[0].name;
    }
    console.log("Top song name:", topSong.value.name);
    if (songs[0] != undefined && songs[0] != null && songs[0].artists[0] != null) {
      topSong.value.artist = songs[0].artists[0].name;
    }
  }).catch(error => {
    console.error("Error fetching songs:", error);
  });
}

// ============================================================================
// COMPONENT INITIALIZATION
// ============================================================================

console.log('Login component loaded')

if (localStorage.getItem('code_verifier') != null) {
  params = getHashParams();
  console.log("Authenticated:", params);

  const access_token = localStorage.getItem('access_token');
  if (access_token != null && access_token != 'undefined') {
    console.log("Access token already exists:", access_token);
    hasAccessToken.value = true;
  } else {
    console.log("Exchanging code for access token...");
    getToken(params.code || '');
  }
} else {
  console.log("Not authenticated");
}
</script>

<template>
  <div class="greetings">
    <h1 class="green">{{ msg }}</h1>
    <h3>
      Welcome to the Lyriquiz app!
      Test your knowledge of song lyrics and have fun!
    </h3>
    <button v-if="hasAccessToken" @click="start">Start</button>
    <button v-else @click="login">Login</button>
    <div v-if="topSong.name">
      <p>Your top song is: {{ topSong.name }} by {{ topSong.artist }}</p>
    </div>
  </div>
</template>

<style scoped>
h1 {
  font-weight: 500;
  font-size: 2.6rem;
  position: relative;
  top: -10px;
}

h3 {
  font-size: 1.2rem;
}

button {
  border: 2px solid hsla(160, 100%, 37%, 1);
  background-color: var(--color-background);
  color: var(--color-text);
  font-size: 1.2rem;
  padding: 2% 5%;
  margin-top: 5%;
}

button:hover {
  background-color: hsla(160, 100%, 37%, 0.1);
  cursor: pointer;
}

.greetings h1,
.greetings h3 {
  text-align: center;
}

@media (min-width: 1024px) {

  .greetings h1,
  .greetings h3 {
    text-align: left;
  }
}
</style>
