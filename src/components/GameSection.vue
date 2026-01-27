<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { animate, splitText, stagger } from 'animejs';
import $ from 'jquery';
import { useSpotifyAuth } from '../composables/useSpotifyAuth';
import { useLyricsGame } from '../composables/useLyricsGame';

// ============================================================================
// PROPS
// ============================================================================

defineProps<{
  msg: string
}>()

// ============================================================================
// CONSTANTS
// ============================================================================

const numberOfQuestions = 5;

// ============================================================================
// COMPOSABLES
// ============================================================================

const { hasAccessToken, redirectToSpotifyLogin, fetchSongs, initializeAuth } = useSpotifyAuth();
const { 
  score, 
  currentQuestionSong, 
  areAnswersLocked, 
  checkAnswer: gameCheckAnswer,
  startGame,
  replay
} = useLyricsGame(numberOfQuestions);

// ============================================================================
// LOCAL STATE
// ============================================================================

const isFetching = ref(false);


// ============================================================================
// SPOTIFY AUTHENTICATION & API
// ============================================================================

/**
 * Initiates Spotify login
 */
function login() {
  redirectToSpotifyLogin();
}


// ============================================================================
// GAME STATE & LOGIC
// ============================================================================

/**
 * Wrapper around game checkAnswer to also handle DOM styling
 */
function checkAnswer(e: MouseEvent): void {
  gameCheckAnswer(e);
  
  // Preserve button colors after check
  setTimeout(() => {
    const buttons = document.querySelectorAll('button.answerButton');
    buttons.forEach(btn => {
      if (btn.id.includes('answer')) {
        // Colors will be preserved via Vue binding
      }
    });
  }, 0);
}


// ============================================================================
// USER ACTIONS
// ============================================================================

/**
 * Starts the game by fetching user's top songs
 */
function start() {
  if(isFetching.value){
    return;
  }
  console.log("Starting the game...");
  isFetching.value = true;
  $("button.startButton").html("Loading...");

  const { chars } = splitText('.startButton', {
    chars: { wrap: 'clip' },
  });

  animate(chars, {
    y: [
      { to: ['100%', '0%'] },
      { to: '-100%', delay: 750, ease: 'in(3)' }
    ],
    duration: 600,
    ease: 'out(3)',
    delay: stagger(100),
    loop: true,
  });

  fetchSongs(30).then(songs => {
    startGame(songs);
  }).catch(error => {
    console.error("Error fetching songs:", error);
  });
}

// ============================================================================
// COMPONENT INITIALIZATION
// ============================================================================

onMounted(() => {
  console.log('Game component loaded')
  initializeAuth();
})
</script>
<template>
  <div class="greetings">
    <h1 class="green">{{ msg }}</h1>
    <div v-if="currentQuestionSong.question == undefined && score == undefined">
      <h3>
        Welcome to the Lyriquiz app!
        Test your knowledge of song lyrics.
        <br />
        It's using your Spotify top songs to create personal questions for you!
      </h3>
      <button class="startButton" v-if="hasAccessToken" :disabled="isFetching" @click="start">Start</button>
      <button v-else @click="login">Login with Spotify</button>
    </div>
    <div v-if="currentQuestionSong.question != undefined">
      <p>Which song are this lyrics from?</p>
      <h3>{{ currentQuestionSong.question }}</h3>
      <!-- <p>{{ currentQuestionSong.correctAnswer }}</p> -->
      <button id="answer0" class="answerButton" :disabled="areAnswersLocked" @click="checkAnswer">{{
        currentQuestionSong.wrongAnswers?.[0] }}</button>
      <button id="answer1" class="answerButton" :disabled="areAnswersLocked" @click="checkAnswer">{{
        currentQuestionSong.wrongAnswers?.[1] }}</button>
      <button id="answer2" class="answerButton" :disabled="areAnswersLocked" @click="checkAnswer">{{
        currentQuestionSong.wrongAnswers?.[2] }}</button>
      <button id="answer3" class="answerButton" :disabled="areAnswersLocked" @click="checkAnswer">{{
        currentQuestionSong.wrongAnswers?.[3] }}</button>
    </div>
    <div v-if="currentQuestionSong.question == undefined && score != undefined">
      <h3>You scored {{ score }} of {{ numberOfQuestions }}!</h3>
      <button @click="replay">Play Again</button>
    </div>
    <p id="debugText" style="position: absolute; bottom: 5%; color: #a52a2a8c;"></p>
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
  margin-top: 3%;
  font-size: 1.2rem;
  white-space: pre-wrap;
  word-wrap: break-word;
}

button {
  border: 2px solid rgb(0, 0, 0);
  background-color: var(--color-background);
  color: var(--color-text);
  display: block;
  font-size: 1.2rem;
  padding: 2% 5%;
  margin-top: 5%;
  margin-left: auto;
  margin-right: auto;
}

button:hover {
  background-color: hsla(0, 0%, 72%, 0.1);
  cursor: pointer;
}

.greetings p,
.greetings h1,
.greetings h3 {
  text-align: center;
}
</style>
