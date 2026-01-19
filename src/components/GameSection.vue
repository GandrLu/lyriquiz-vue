<script setup lang="ts">
import { ref } from 'vue';
import type { Ref } from 'vue';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface Song {
  album: { name: null | string },
  name: string,
  artists: [{ "name": "" }]
}

interface Question {
  lyrics: string,
  question?: string,
  correctAnswer?: string,
  wrongAnswers?: string[],
  song: Song
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
const redirect_uri: string = '0.0.0.0';
const numberOfQuestions = 1;

// ============================================================================
// REACTIVE STATE
// ============================================================================

let params: Record<string, string> = {};
const hasAccessToken = ref(!!localStorage.getItem('access_token'));
const topSong = ref({ 'name': 'Testname', 'artist': 'Testartist' });

const currentQuestionSong: Ref<Question> = ref({
  lyrics: '',
  song: { album: { name: null }, name: '', artists: [{ "name": "" }] }
});

const songList = new Map<Song, string>();
let questionIdices: number [] = [];
for (let i = 0; i < numberOfQuestions; i++) {
  questionIdices.push(i);
}
questionIdices = randomizeArray(questionIdices);
// const currentlyUsedSong: Song | null = null;
let sptfySongs: Song[] = [];

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
  return globalThis.crypto.subtle.digest('SHA-256', data)
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

function randomizeArray<T>(array: T[]): T[] {
  return array.sort(() => Math.random() - 0.5);
}

// function setUpQuestion() {
//   let idx = questionIdices.pop();
//   if (idx === undefined) {
//     idx = 0;
//   }
//   const song = sptfySongs[idx];
//   if (song === undefined) {
//     console.error("No song found for question index:", idx);
//     return;
//   }
//   currentQuestionSong.value = { song: song, lyrics: songList.get(song) || '', correctAnswer: song.name };
// } 

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

function prepareQuestion(fetchedLyrics: string, song: Song): Question {
  /* Uses regex to collect the positions of break lines in the lyrics string */
  const regex = /\n/gi;
  let result: RegExpExecArray | null;
  const indicies: number [] = [];
  while( (result = regex.exec(fetchedLyrics)) ){
    indicies.push(result.index);
  }
  if (indicies.length < 1){
    indicies.push(0);
  }

  let questionSnippet = "";

  for(let i = 0; i < 5; i++){
    /* Gets a random index of the array with line break positions */
    const randIndex = Math.floor( Math.random() * indicies.length );
    
    /* Slices the lyrics at the random line break position and at the position 3 line breaks before, 
    so is ensured even if randomly the last position is choosen, that the other position exists. 
    Stores this approx. 3 lines in the lyrics snippet property of the current question. */
    const start = indicies[randIndex - 3] !== undefined ? indicies[randIndex - 3] : -1 + 1;
    const end = indicies[randIndex] !== undefined ? indicies[randIndex] + 1 : fetchedLyrics.length;
    questionSnippet = fetchedLyrics.slice(start, end);
    if(questionSnippet.length < 12){
      questionSnippet = fetchedLyrics.slice(0, Math.min(50, fetchedLyrics.length));
    }
    else{
      break;
    }
  }

  const newQuestion: Question = {
    lyrics: fetchedLyrics,
    question: questionSnippet,
    correctAnswer: song.name,
    wrongAnswers: [],
    song: song
  };
  
  let wrongAnswerIndices: number [] = [];
  for (let i = 0; i < sptfySongs.length; i++) {
    wrongAnswerIndices.push(i);
  }
  wrongAnswerIndices = randomizeArray(wrongAnswerIndices);

  newQuestion.wrongAnswers?.push(song.name);
  for (let i = 0; i < sptfySongs.length; i++) {
    const idx = wrongAnswerIndices.pop();
    if(idx !== undefined && sptfySongs[idx] !== undefined && sptfySongs[idx] !== song){
      newQuestion.wrongAnswers?.push(sptfySongs[idx].name);
    }
    if(newQuestion.wrongAnswers === undefined || newQuestion.wrongAnswers.length >= 4){
      console.log("break");
      break;
    }
  };
  newQuestion.wrongAnswers = randomizeArray(newQuestion.wrongAnswers || []);

  return newQuestion;
  //debugging console.log("Questions: ", this.Questions);
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
  localStorage.setItem('refresh_token', response.refresh_token);
  localStorage.setItem('access_token_expiration',
    (Date.now() + response.expires_in * 1000).toString());
}

const getRefreshToken = async function () {
  const refresh_token = localStorage.getItem('refresh_token');
  if (!refresh_token) {
    console.error("No refresh token found in local storage.");
    return;
  }

  const url = "https://accounts.spotify.com/api/token";
  const payload = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refresh_token,
      client_id: client_id,
    }),
  }

  const body = await fetch(url, payload);
  const response = await body.json();

  console.log("Refresh Response:", response);
  if(response.error == "invalid_grant"){
    console.error("Refresh token is invalid. User needs to re-authenticate.");
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('access_token');
    localStorage.removeItem('access_token_expiration');
    redirectToSpotifyLogin();
    return;
  }
  
  localStorage.setItem('access_token', response.access_token);
  localStorage.setItem('access_token_expiration',
    (Date.now() + response.expires_in * 1000).toString());
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
function fetchSongs(limit: number = 1): Promise<Song[]> {
  const headers = new Headers()
  headers.set('Authorization', 'Bearer ' + localStorage.getItem('access_token'))
  return fetch('https://api.spotify.com/v1/me/top/tracks?time_range=long_term&limit=' + limit, { headers })
    .then(response => response.json())
    .then((data) => {
      console.log("Fetched data:", data);
      return data.items as Song[];
    })
}

function fetchLyrics(song: Song): Promise<string> {
  // Placeholder function to simulate fetching lyrics
  return fetch('https://api.lyrics.ovh/v1/' + song.artists[0].name + '/' + song.name)
    .then(response => response.json())
    .then((data) => {
      // console.log("Fetched lyrics:", data);
      return data.lyrics as string;
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

function checkAnswer(e) {
  console.log("Clicked answer:", e);
  if(e.target.innerText === currentQuestionSong.value.correctAnswer){
    console.log("Correct answer!");
    e.target.style.backgroundColor = "#90ee9038";
  }
  else{
    console.log("Wrong answer!");
    e.target.style.backgroundColor = "#f0808045";
  }
}

/**
 * Starts the game by fetching user's top song
 */
function start() {
  console.log("Starting the game...");
  fetchSongs(20).then(songs => {
    console.log("Fetched songs:", songs);
    sptfySongs = songs;
    songs.forEach(song => {
      fetchLyrics(song).then(lyrics => {
        if(lyrics == undefined || lyrics == null){
          // songList.delete(song);
          songs.splice(songs.indexOf(song), 1);
          console.log("Deleted song from array due to missing lyrics:", song.name);
        }
        else{
          songList.set(song, lyrics);
        }
        console.log("Updated song list map with lyrics: ", songList.size);
        
        if(songList.size >= numberOfQuestions){
          console.log("Collected enough songs for questions.", currentQuestionSong);
          if (currentQuestionSong.value.lyrics === ''){
            currentQuestionSong.value = prepareQuestion(lyrics, song);
          }
          // setUpQuestion();
        }
      }).catch(error => {
        console.error("Error fetching lyrics for song", song.name, ":", error);
        if(songList.size >= numberOfQuestions){
          console.log("Collected enough songs for questions.", currentQuestionSong);
          // setUpQuestion();
        }
      });
    });

    console.log("Song list map:", songList);
    
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
  const access_token_expiration = Number(localStorage.getItem('access_token_expiration'));
  if (access_token != null) {
    console.log("Access token already exists:", access_token);
    if (access_token_expiration != null && access_token_expiration > Date.now()) {
      console.log("Access token is still valid.");
    } else {
      console.log("Access token has expired. Need to re-authenticate.");
      getRefreshToken();
    }
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
    <div v-if="!currentQuestionSong.question">
      <h3>
        Welcome to the Lyriquiz app!
        Test your knowledge of song lyrics and have fun!
      </h3>
      <button v-if="hasAccessToken" @click="start">Start</button>
      <button v-else @click="login">Login</button>
    </div>
    <div v-else>
      <p>Which song are this lyrics from?</p>
      <h3>{{ currentQuestionSong.question }}</h3>
      <!-- <p>{{ currentQuestionSong.correctAnswer }}</p> -->
      <button @click="checkAnswer">{{ currentQuestionSong.wrongAnswers?.[0] }}</button>
      <button @click="checkAnswer">{{ currentQuestionSong.wrongAnswers?.[1] }}</button>
      <button @click="checkAnswer">{{ currentQuestionSong.wrongAnswers?.[2] }}</button>
      <button @click="checkAnswer">{{ currentQuestionSong.wrongAnswers?.[3] }}</button>
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
