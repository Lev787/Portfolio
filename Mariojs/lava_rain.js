var LAVA_RAIN_SPAWN_CHANCE = 0.05; // 5% chance per frame

function applyLavaRain() {
    if (!window.MOD_LAVA_RAIN || !window.player || !window.player.alive) return;
    
    // Spawn drops randomly slightly above the visible screen
    if (Math.random() < LAVA_RAIN_SPAWN_CHANCE) {
        // Random horizontal position across the screen
        var spawnX = window.gamescreen.left + Math.random() * (window.gamescreen.right - window.gamescreen.left);
        // Spawn slightly above the top of the visible area
        var spawnY = window.gamescreen.top - 16; 
        
        // Use a generic fire drop that looks like a fireball
        var drop = new Thing(window.Podoboo, spawnX, spawnY); // Castle Fireball
        drop.xvel = 0;
        drop.yvel = 2; // Initial fall speed
        drop.gravity = 0.5; // Custom gravity
        
        // Disable its upward jump behavior from original behavior
        drop.movement = function(me) {
            me.yvel += me.gravity;
            window.shiftVert(me, me.yvel);
            // Remove if it falls below the screen completely
            if (me.top > window.gamescreen.bottom) {
                window.killNormal(me);
            }
        };
        
        drop.nocollidesolid = true; // Falls straight down
        
        window.addThing(drop, spawnX, spawnY);
    }
}

// Hook into character maintenance cycle
var maintainCharactersOriginal_lava = window.maintainCharacters;
window.maintainCharacters = function(update) {
    if (maintainCharactersOriginal_lava) {
        maintainCharactersOriginal_lava(update);
    }
    applyLavaRain();
};
