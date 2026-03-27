// horror_mod.js
var HORROR_CHANCE = 0.20; // 20% chance

var horrorImg = new Image();
horrorImg.src = "Theme/horrorpic.png";

var spookyBgImg = new Image();
spookyBgImg.src = "Theme/SpookyBackground.png";

var jumpscares = [];
var _last_horror_state = false;
var original_playTheme;

function _ensureHorrorAudioMod() {
    if (window.AudioPlayer && window.AudioPlayer.playTheme && !original_playTheme) {
        original_playTheme = window.AudioPlayer.playTheme;
        window.AudioPlayer.playTheme = function(name_raw, resume, loop) {
            var active_theme = name_raw || (window.area ? window.area.theme : null);
            if (active_theme === "Overworld" && window.MOD_HORROR) {
                return original_playTheme.call(this, "spooky_sound", resume, loop);
            }
            if (active_theme === "spooky_sound" && !window.MOD_HORROR) {
                return original_playTheme.call(this, "Overworld", resume, loop);
            }
            return original_playTheme.apply(this, arguments);
        };
    }
}

var original_setMap_horror = window.setMap;
window.setMap = function() {
    _ensureHorrorAudioMod();
    if (original_setMap_horror) {
        original_setMap_horror.apply(this, arguments);
    }
};

var original_blockBump_horror = window.blockBump;
window.blockBump = function(me, character) {
    if (window.MOD_HORROR && character && character.type === "player" && !me.used) {
        if (me.contents && (me.contents[0] === window.Coin || me.contents[0] === window.Mushroom || me.contents[0] === window.FireFlower || me.contents[0] === window.Star || me.contents[0] === window.Mushroom1Up)) {
            if (Math.random() < HORROR_CHANCE) {
                // Trigger horror!
                me.isHorror = true;
                
                var cx = me.left + (me.width * (window.unitsize || 4)) / 2;
                var cy = me.top;
                
                var jsSound = new Audio("Sounds/Sounds/mp3/HorrorNoise.mp3");
                jsSound.play().catch(function(e){ console.log("Audio play failed: ", e); });
                
                jumpscares.push({
                    x: cx,
                    y: cy,
                    size: 32, // start small
                    alpha: 1.0,
                    phase: "growing",
                    sound: jsSound
                });
            }
        }
    }
    
    if (original_blockBump_horror) {
        original_blockBump_horror(me, character);
    }
};

var original_blockContentsEmerge_horror = window.blockContentsEmerge;
window.blockContentsEmerge = function(me) {
    if (window.MOD_HORROR && me.isHorror) {
        // Do not spawn the normal item.
        return;
    }
    if (original_blockContentsEmerge_horror) {
        original_blockContentsEmerge_horror(me);
    }
};

var original_refillCanvas_horror = window.refillCanvas;
window.refillCanvas = function() {
    _ensureHorrorAudioMod();

    if (window.AudioPlayer && original_playTheme && window.MOD_HORROR !== _last_horror_state) {
        _last_horror_state = window.MOD_HORROR;
        if (window.area && window.area.theme === "Overworld" && window.gameon) {
            window.AudioPlayer.playTheme(window.MOD_HORROR ? "spooky_sound" : "Overworld"); 
        }
    }

    var ctx = window.context;
    var old_fillRect;
    if (ctx) {
        old_fillRect = ctx.fillRect;
        ctx.fillRect = function(x, y, w, h) {
            // Заменяем только если это заливка во весь экран (background)
            if (x === 0 && y === 0 && w === ctx.canvas.width && h === ctx.canvas.height && 
                window.MOD_HORROR && window.area && window.area.theme === "Overworld" && 
                spookyBgImg.complete && spookyBgImg.naturalWidth) {
                ctx.drawImage(spookyBgImg, x, y, w, h);
            } else {
                old_fillRect.call(ctx, x, y, w, h);
            }
        };
    }

    var original_drawThingOnCanvas_horror = window.drawThingOnCanvas;
    if (window.MOD_HORROR && window.area && window.area.theme === "Overworld") {
        window.drawThingOnCanvas = function(context, me) {
            if (me && me.title && (me.title.indexOf("Hill") !== -1 || me.title.indexOf("Cloud") !== -1 || me.title.indexOf("Bush") !== -1)) {
                return;
            }
            if (original_drawThingOnCanvas_horror) {
                return original_drawThingOnCanvas_horror(context, me);
            }
        };
    }

    if (original_refillCanvas_horror) {
        original_refillCanvas_horror();
    }
    
    if (window.MOD_HORROR && window.area && window.area.theme === "Overworld") {
        window.drawThingOnCanvas = original_drawThingOnCanvas_horror;
    }
    
    if (ctx && old_fillRect) {
        ctx.fillRect = old_fillRect;
    }
    
    if (window.MOD_HORROR && jumpscares.length > 0 && horrorImg.complete && horrorImg.naturalWidth !== 0) {
        var ctx = window.context;
        var cw = ctx.canvas.width;
        var ch = ctx.canvas.height;
        var targetX = cw / 2;
        var targetY = ch / 2;
        var maxSize = Math.max(cw, ch) * 1.5;
        
        for (var i = jumpscares.length - 1; i >= 0; i--) {
            var js = jumpscares[i];
            
            if (js.phase === "growing") {
                // move towards screen center quickly
                js.x += (targetX - js.x) * 0.15;
                js.y += (targetY - js.y) * 0.15;
                
                // grow exponentially fast
                js.size *= 1.25;
                if (js.size > maxSize) {
                    js.phase = "fading";
                }
            } else if (js.phase === "fading") {
                js.alpha -= 0.05;
                if (js.alpha <= 0) {
                    if (js.sound) {
                        js.sound.pause();
                        js.sound.currentTime = 0;
                    }
                    jumpscares.splice(i, 1);
                    continue;
                }
            }
            
            ctx.save();
            ctx.globalAlpha = js.alpha;
            // Draw image centered
            var aspect = horrorImg.naturalHeight / horrorImg.naturalWidth;
            var w = js.size;
            var h = js.size * aspect;
            
            ctx.drawImage(horrorImg, js.x - w/2, js.y - h/2, w, h);
            ctx.restore();
        }
    }
};
