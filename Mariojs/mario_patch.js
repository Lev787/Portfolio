  window.addEventListener("message", function(e) { 
      if(e.data === "startGame") { 
          window.gameon = true; setMap(1,1); 
      } else if (e.data && e.data.action === "startGame") {
          window.gameon = true; setMap(e.data.part, e.data.lvl);
      } else if (e.data && e.data.action === "tryAgain") {
          if (typeof tryAgainGame === "function") tryAgainGame();
      }
  });
  log("It took " + (Date.now() - time_start) + " milliseconds to start.");
}

// To do: add in a real polyfill
function ensureLocalStorage() {
