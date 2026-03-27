var BOULDER_SPEED = 2.5; // pixels per frame
var BOULDER_RADIUS = 150;

var boulderImg = new Image();
boulderImg.src = "Theme/boulder.png";

var boulder = {
    active: false,
    worldX: 0,
    rotation: 0
};

var original_refillCanvas_boulder = window.refillCanvas;
window.refillCanvas = function() {
    if (original_refillCanvas_boulder) original_refillCanvas_boulder();
    if (window.MOD_BOULDER) {
        updateAndDrawBoulder(window.context);
    }
};

function updateAndDrawBoulder(ctx) {
    if (!window.player || !window.player.alive) return;
    
    // reset boulder on map load, reset condition
    if (window.gamescreen.left < 50) {
        boulder.active = false;
    }
    
    if (!boulder.active && window.player.right > 100) {
        boulder.active = true;
        boulder.worldX = window.gamescreen.left - BOULDER_RADIUS; 
    }
    
    if (boulder.active) {
        if (!window.paused) {
            // Move boulder forward in world coordinates
            boulder.worldX += BOULDER_SPEED;
            boulder.rotation += BOULDER_SPEED / BOULDER_RADIUS; // rotate it
        }
        
        var screenX = boulder.worldX - window.gamescreen.left;
        
        // Find ground level under the boulder itself (independent of player)
        var targetY = window.map && window.map.floor ? window.map.floor * window.unitsize : window.innerHeight - 32;
        
        // We removed the block climbing code so it just rolls on the floor and goes right through blocks!
        
        // Initialize floorY if it doesn't exist
        if (typeof boulder.floorY === 'undefined') {
            boulder.floorY = targetY;
        }
        
        // Smoothly adjust boulder's vertical position so it "climbs" terrain 
        if (!window.paused) {
            boulder.floorY += (targetY - boulder.floorY) * 0.15;
        }
        
        var boulderY = boulder.floorY - BOULDER_RADIUS + 30;

        // Death logic
        if (screenX + BOULDER_RADIUS - 20 > window.player.left + (window.player.width * window.unitsize / 2)) {
            // Smash player (passing 1 to force instant death even if Mario has a mushroom, but keeping death animation)
            if (!window.player.dead) {
                window.player.death(window.player, 1);
            }
        }
        
        // Draw the spiked boulder
        ctx.save();
        ctx.translate(screenX, boulderY);
        ctx.rotate(boulder.rotation);
        
        if (boulderImg.complete && boulderImg.naturalWidth !== 0) {
            // Рисуем спрайт по центру
            ctx.drawImage(boulderImg, -BOULDER_RADIUS, -BOULDER_RADIUS, BOULDER_RADIUS * 2, BOULDER_RADIUS * 2);
        } else {
            // Fallback если картинка еще не загрузилась или не найдена
            ctx.beginPath();
            ctx.arc(0, 0, BOULDER_RADIUS, 0, Math.PI * 2);
            ctx.fillStyle = "#3b3938";
            ctx.fill();
            ctx.lineWidth = 4;
            ctx.strokeStyle = "#1b1918";
            ctx.stroke();
        }
        
        ctx.restore();
        
        // Ensure Mario is drawn ON TOP of the boulder (so we can see him jump and fall when dying)
        // But do NOT draw him if he is inside a pipe (piping)
        if (window.player && !window.player.hidden && !window.player.piping) {
            window.drawThingOnCanvas(ctx, window.player);
        }
    }
}
