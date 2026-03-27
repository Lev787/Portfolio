var TRAP_CHANCE = 0.3; // 30% chance for a trap

var original_blockBump_trap = window.blockBump;
window.blockBump = function(me, character) {
    if (window.MOD_TRAP_WORLD && !me.used && character.type === "player") {
        if (me.contents && (me.contents[0] === window.Coin || me.contents[0] === window.Mushroom || me.contents[0] === window.FireFlower || me.contents[0] === window.Star || me.contents[0] === window.Mushroom1Up)) {
            if (Math.random() < TRAP_CHANCE) {
                var enemies = [window.Goomba, window.Koopa, window.Beetle];
                me.contents[0] = enemies[Math.floor(Math.random() * enemies.length)];
            }
        }
    }
    
    if (original_blockBump_trap) {
        original_blockBump_trap(me, character);
    }
};

var original_brickBump_trap = window.brickBump;
window.brickBump = function(me, character) {
    if (window.MOD_TRAP_WORLD && !me.used && character.type === "player" && me.contents) {
        if (me.contents[0] === window.Coin || me.contents[0] === window.Mushroom || me.contents[0] === window.FireFlower || me.contents[0] === window.Star || me.contents[0] === window.Mushroom1Up) {
            if (Math.random() < TRAP_CHANCE) {
                var enemies = [window.Goomba, window.Koopa, window.Beetle];
                me.contents[0] = enemies[Math.floor(Math.random() * enemies.length)];
            }
        }
    }
    
    if (original_brickBump_trap) {
        original_brickBump_trap(me, character);
    }
};

// Allow enemies spawned from blocks to fall off the block instead of turning around or jumping
var original_moveSimple_trap = window.moveSimple;
window.moveSimple = function(me) {
    if (window.MOD_TRAP_WORLD && me.group === "enemy" && me.blockparent) {
        if (me.resting && me.resting !== me.blockparent) {
            me.blockparent = false;
        } else {
            me.group = "item";
            if (original_moveSimple_trap) original_moveSimple_trap(me);
            me.group = "enemy";
            return;
        }
    }
    if (original_moveSimple_trap) {
        original_moveSimple_trap(me);
    }
};

var original_moveSmart_trap = window.moveSmart;
window.moveSmart = function(me) {
    if (window.MOD_TRAP_WORLD && me.group === "enemy" && me.blockparent) {
        if (me.resting && me.resting !== me.blockparent) {
            me.blockparent = false;
        } else {
            me.group = "item";
            if (original_moveSmart_trap) original_moveSmart_trap(me);
            me.group = "enemy";
            return;
        }
    }
    if (original_moveSmart_trap) {
        original_moveSmart_trap(me);
    }
};
