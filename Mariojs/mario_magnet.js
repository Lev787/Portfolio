// mario_magnet.js
var MAGNET_RADIUS = 150; // pixels
var MAGNET_SPEED = 6;    // pixels per frame

function applyMarioMagnet() {
    if (!window.MOD_MAGNET || !window.player || !window.player.alive) return;
    
    var groups = [window.characters, window.solids, window.scenery];
    
    for (var g = 0; g < groups.length; g++) {
        var group = groups[g];
        if (!group) continue;
        
        for (var i = 0; i < group.length; i++) {
            var thing = group[i];
            
            // Проверяем, является ли объект монетой
            if (!thing.alive || thing.group !== "coin") continue;

            // Высчитываем расстояние до игрока (центрируем)
            var pMidX = player.left + player.width * unitsize / 2;
            var pMidY = player.top + player.height * unitsize / 2;
            
            var tMidX = thing.left + thing.width * unitsize / 2;
            var tMidY = thing.top + thing.height * unitsize / 2;
            
            var dx = pMidX - tMidX;
            var dy = pMidY - tMidY;
            var distSq = dx * dx + dy * dy;
            
            // Если монета в радиусе притяжения
            if (distSq < MAGNET_RADIUS * MAGNET_RADIUS) {
                var dist = Math.sqrt(distSq);
                
                // Если мы почти коснулись — собираем
                if (dist < 10 && thing.collide && !thing.collected) {
                    thing.collide(window.player, thing);
                    thing.collected = true; // чтобы не собрать дважды
                    continue;
                }
                
                // В противном случае тянет к игроку
                var moveX = (dx / dist) * MAGNET_SPEED;
                var moveY = (dy / dist) * MAGNET_SPEED;
                
                // Снимаем монету с места, если она была статичной "твердой" (например, монеты в замках/пещерах)
                if (thing.movement === window.coinBecomesSolid) {
                    thing.movement = false;
                }
                // Отключаем физику, чтобы летела сквозь блоки
                thing.nocollidechar = false; 
                thing.nocollidesolid = true;
                thing.nofall = true;
                
                shiftHoriz(thing, moveX);
                shiftVert(thing, moveY);
            }
        }
    }
}

// Зацепляемся за главный цикл поддержания игрока
var maintainPlayerOriginal = window.maintainPlayer;
window.maintainPlayer = function(update) {
    if (maintainPlayerOriginal) {
        maintainPlayerOriginal(update);
    }
    applyMarioMagnet();
};
