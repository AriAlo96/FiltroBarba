<template>
  <router-view/>
</template>

<style>
#app {
  font-family: "Room", "Poppins";
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2d2d2d;
}

@font-face {
  font-family: "Room";
  src: url("@/assets/Fonts/Room/Room-Thin.woff2") format("woff2");
  font-weight: 100;
  font-style: normal;
}

@font-face {
  font-family: "Room";
  src: url("@/assets/Fonts/Room/Room-Light.woff2") format("woff2");
  font-weight: 300;
  font-style: normal;
}

@font-face {
  font-family: "Room";
  src: url("@/assets/Fonts/Room/Room.woff2") format("woff2");
  font-weight: 400;
  font-style: normal;
}

@font-face {
  font-family: "Room";
  src: url("@/assets/Fonts/Room/Room-Medium.woff2") format("woff2");
  font-weight: 500;
  font-style: normal;
}

@font-face {
  font-family: "Room";
  src: url("@/assets/Fonts/Room/Room-Black.woff2") format("woff2");
  font-weight: 900;
  font-style: normal;
}

@font-face {
  font-family: "Poppins";
  src: url("@/assets/Fonts/Poppins/Poppins-Regular.ttf")  format("opentype");
  font-weight: 400;
  font-style: normal;
  display: flex;
  align-items: center;
}


nav {
  padding: 30px;
}

nav a {
  font-weight: bold;
  color: #2c3e50;
}

nav a.router-link-exact-active {
  color: #42b983;
}
</style>
