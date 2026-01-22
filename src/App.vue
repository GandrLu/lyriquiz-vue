<script setup lang="ts">
import GameSection from './components/GameSection.vue'
</script>

<template>
  <header>
    <img alt="Vue logo" class="logo" src="./assets/lyriquiz_logo.png" width="125" height="125" />

    <div class="wrapper">
      <GameSection msg="Lyriquiz" />
    </div>
  </header>

  <main>
  </main>
</template>

<style scoped>
header {
  line-height: 1.5;
}

.logo {
  display: block;
  margin: 0 auto 2rem;
}
</style>
