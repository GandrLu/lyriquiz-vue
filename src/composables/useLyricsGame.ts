import { ref } from 'vue';
import type { Ref } from 'vue';

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

export function useLyricsGame(numberOfQuestions: number = 5) {
  const songList = new Map<Song, string>();
  const score: Ref<number | undefined> = ref(undefined);
  const currentQuestionSong: Ref<Question> = ref({
    lyrics: '',
    question: undefined,
    correctAnswer: undefined,
    wrongAnswers: undefined,
    song: { album: { name: null }, name: '', artists: [{ name: '' }] }
  });
  const areAnswersLocked = ref(false);
  const isReplayPossible = ref(false);

  let sptfySongs: Song[] = [];
  let numberOfLyricsAvailable: number = 0;
  let currentQuestionIndex: number = 0;
  let currentGameRound: number = 1;

  /**
   * Randomizes array order
   */
  function randomizeArray<T>(array: T[]): T[] {
    return array.sort(() => Math.random() - 0.5);
  }

  /**
   * Fetches lyrics from lrclib API
   */
  function fetchLyrics(song: Song): Promise<string> {
    console.log("Fetching lyrics for song:", song.name, "by", song.artists[0].name);
    return fetch('https://lrclib.net/api/get?artist_name=' + song.artists[0].name + '&track_name=' + song.name)
      .then(response => response.json())
      .then((data) => {
        console.log("Fetched lyrics:", data.trackName);
        return data.plainLyrics as string;
      })
  }

  /**
   * Prepares a question from lyrics
   */
  function prepareQuestion(fetchedLyrics: string, song: Song): Question {
    const regex = /\n/gi;
    let result: RegExpExecArray | null;
    const indicies: number[] = [];
    while((result = regex.exec(fetchedLyrics))){
      indicies.push(result.index);
    }
    if (indicies.length < 1){
      indicies.push(0);
    }

    let questionSnippet = "";

    for(let i = 0; i < 5; i++){
      const randIndex = Math.floor(Math.random() * indicies.length);
      
      const start = indicies[randIndex - 3] !== undefined ? indicies[randIndex - 3] : -1 + 1;
      const end = indicies[randIndex] !== undefined ? indicies[randIndex] + 1 : fetchedLyrics.length;
      questionSnippet = fetchedLyrics.slice(start, end);
      if (questionSnippet.length > 20
        && !questionSnippet.toLowerCase().includes(song.name.toLowerCase())) {
        break;
      }
    }

    if (questionSnippet.includes('\n\n')) {
      questionSnippet = questionSnippet.replace(/\n\n+/g, '\n');
    }
    if(questionSnippet.startsWith("\n")){
      questionSnippet = questionSnippet.slice(1);
    }
    if(questionSnippet.endsWith("\n")){
      questionSnippet = questionSnippet.slice(0, questionSnippet.length - 1);
    }

    const newQuestion: Question = {
      lyrics: fetchedLyrics,
      question: questionSnippet,
      correctAnswer: song.name + " - " + song.artists[0].name,
      wrongAnswers: [],
      song: song
    };
    
    let wrongAnswerIndices: number[] = [];
    for (let i = 0; i < sptfySongs.length; i++) {
      wrongAnswerIndices.push(i);
    }
    wrongAnswerIndices = randomizeArray(wrongAnswerIndices);

    newQuestion.wrongAnswers?.push(song.name + " - " + song.artists[0].name);
    for (let i = 0; i < sptfySongs.length; i++) {
      const idx = wrongAnswerIndices.pop();
      if(idx !== undefined && sptfySongs[idx] !== undefined && sptfySongs[idx] !== song){
        newQuestion.wrongAnswers?.push(sptfySongs[idx].name + " - " + sptfySongs[idx].artists[0].name);
      }
      if(newQuestion.wrongAnswers === undefined || newQuestion.wrongAnswers.length >= 4){
        break;
      }
    }
    newQuestion.wrongAnswers = randomizeArray(newQuestion.wrongAnswers || []);

    console.log("Prepared question:", newQuestion.correctAnswer);

    return newQuestion;
  }

  /**
   * Sets the next question
   */
  function setNextQuestion() {
    areAnswersLocked.value = false;
    $("button.answerButton").css("background-color", "var(--color-background)");
    
    console.log("Setting next question, current index:", currentQuestionIndex);
    const song = sptfySongs[currentQuestionIndex + 1];
    if (song === undefined
      || currentQuestionIndex + 1 > numberOfQuestions * currentGameRound) {
      console.log("No more questions available. " + score.value);
      currentQuestionSong.value.question = undefined;
      isReplayPossible.value = (currentGameRound + 1) * numberOfQuestions <= numberOfLyricsAvailable;
      return
    }
    else {
      currentQuestionIndex++;
    }
    currentQuestionSong.value = prepareQuestion(songList.get(song) || '', song);
  }

  /**
   * Validates the user's answer selection
   */
  function checkAnswer(e: MouseEvent): void {
    const target = e.target as HTMLButtonElement;
    areAnswersLocked.value = true;
    console.log("Clicked answer:", e);
    if(score.value == undefined){
      score.value = 0;
    }
    if(target.innerText === currentQuestionSong.value.correctAnswer){
      console.log("Correct answer!");
      score.value++;
      target.style.backgroundColor = "#90ee9038";
    }
    else{
      console.log("Wrong answer!");
      target.style.backgroundColor = "#f0808045";
      currentQuestionSong.value.wrongAnswers?.forEach((answer, index) => {
        if(answer === currentQuestionSong.value.correctAnswer){
          const correctButton = document.getElementById("answer" + index);
          if(correctButton){
            correctButton.style.backgroundColor = "#40664038";
          }
        }
      });
    }

    setTimeout(() => {
      setNextQuestion();
    }, 800);
  }

  /**
   * Starts a new game round
   */
  function startGame(songs: Song[]): void {
    sptfySongs = randomizeArray(songs);
    let log: string = "Fetched songs:\n";
    sptfySongs.forEach(song => {
      log += song.artists[0].name + "-" + song.name + "\n";
    });
    console.log(log);

    sptfySongs.forEach(song => {
      fetchLyrics(song).then(lyrics => {
        if(lyrics == undefined || lyrics == null){
          sptfySongs.splice(sptfySongs.indexOf(song), 1);
          console.log("Deleted song from array due to missing lyrics:", song.name);
        }
        else{
          songList.set(song, lyrics);
          numberOfLyricsAvailable++;
        }
        
        if (currentQuestionSong.value.question == undefined) {
          const hasEnoughSongs = sptfySongs
            .slice(0, numberOfQuestions)
            .every(song => {
              const lyrics = songList.get(song);
              return lyrics !== undefined && lyrics.length > 0;
            });

          if (hasEnoughSongs) {
            console.log("Collected enough songs for questions.", currentQuestionSong);
            setNextQuestion();
          }
        }
      }).catch(error => {
        console.error("Error fetching lyrics for song", song.name, ":", error);
      });
    });
  }

  /**
   * Replays the game
   */
  function replay(): void {
    if(!isReplayPossible.value){
      location.reload();
      return;
    }
    score.value = undefined;
    currentGameRound++;
    setNextQuestion();
  }

  return {
    songList,
    score,
    currentQuestionSong,
    areAnswersLocked,
    isReplayPossible,
    checkAnswer,
    startGame,
    replay,
  };
}
