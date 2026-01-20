<script setup lang="ts">
// import { ref } from 'vue';

</script>

<template>
<div>
    <p>Your top song is: {{ "current.name" }} by {{ "topSong.artist" }}</p>
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
