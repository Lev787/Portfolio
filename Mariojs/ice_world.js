// Ice World Mod
var iceFloorImg = new Image();
iceFloorImg.src = "Theme/frozenfloor.png";

var iceBrickImg = new Image();
iceBrickImg.src = "Theme/icebrick.png";

var iceBlockImg = new Image();
iceBlockImg.src = "Theme/iceblock.png";

var original_movePlayer_ice = window.movePlayer;
window.movePlayer = function(me) {
    var isIceWorld = window.MOD_ICE_WORLD && window.map && !window.map.underground && !window.map.underwater;
    
    // Store old velocity
    var oldXvel = me.xvel;
    
    // Call the original movement logic which normally applies high friction
    if (original_movePlayer_ice) {
        original_movePlayer_ice(me);
    }
    
    // If Ice World is active and player is resting on the ground
    if (isIceWorld && me.resting && !me.crouching) {
        if (me.keys.run === 0) {
            // Player is not pressing anything, they should slide
            if (Math.abs(oldXvel) > 0.14) {
                // Apply very low friction
                var slipXvel = oldXvel * 0.99;
                var slipDecel = 0.005; // compared to normal 0.035
                
                if (slipXvel > slipDecel) slipXvel -= slipDecel;
                else if (slipXvel < -slipDecel) slipXvel += slipDecel;
                else slipXvel = 0;
                
                me.xvel = slipXvel;
            }
        } else if (window.signBool && window.signBool(me.keys.run) == me.moveleft) {
            // Player is skidding (pressing opposite direction)
            // They shouldn't stop immediately, they should slide while skidding
            if (Math.abs(oldXvel) > 0.14) {
                var slipXvel = oldXvel * 0.995; // even less friction while skidding so it takes longer
                me.xvel = slipXvel;
            }
        }
    }
};

var original_drawThingOnCanvasSingle_ice = window.drawThingOnCanvasSingle;
window.drawThingOnCanvasSingle = function(context, canvas, me, leftc, topc) {
    if (!window.MOD_ICE_WORLD || !window.map || window.map.underground || window.map.underwater) {
        if (original_drawThingOnCanvasSingle_ice) {
            original_drawThingOnCanvasSingle_ice(context, canvas, me, leftc, topc);
        }
        return;
    }

    var handled = false;
    
    // Draw Floor with split textures: top row and everything else
    if ((me.title === "Floor" || me.title === "FloorReal") && 
        iceFloorImg.complete && iceFloorImg.naturalWidth !== 0 &&
        iceBrickImg.complete && iceBrickImg.naturalWidth !== 0) {
        
        var blockW = (me.spritewidth || 8) * (window.unitsize || 4); // Usually 32 pixels
        var blockH = (me.spriteheight || 8) * (window.unitsize || 4); // Usually 32 pixels
        var w = me.unitwidth || (me.width * (window.unitsize || 4));
        var h = me.unitheight || (me.height * (window.unitsize || 4));
        
        context.translate(leftc, topc);
        
        // Draw top row with frozenfloor.png, tiling block by block explicitly so the image doesn't stretch
        for (var x = 0; x < w; x += blockW) {
            // Only draw as much width as we have left to stay strictly within bounds
            var wDraw = Math.min(blockW, w - x);
            context.drawImage(iceFloorImg, 0, 0, wDraw * (iceFloorImg.width/blockW), iceFloorImg.height, x, 0, wDraw, Math.min(h, blockH));
        }
        
        // Draw the rest (underneath) with icebrick.png, tiling line by line
        if (h > blockH) {
            for (var y = blockH; y < h; y += blockH) {
                for (var x = 0; x < w; x += blockW) {
                    var wDraw = Math.min(blockW, w - x);
                    var hDraw = Math.min(blockH, h - y);
                    
                    // We map the source texture crop so it doesn't squish at the edges or bottoms of blocks
                    var srcW = wDraw * (iceBrickImg.width / blockW);
                    var srcH = hDraw * (iceBrickImg.height / blockH);
                    
                    context.drawImage(iceBrickImg, 0, 0, srcW, srcH, x, y, wDraw, hDraw);
                }
            }
        }
        
        context.translate(-leftc, -topc);
        handled = true;
    } 
    // Used ?, Brick, Stone, and other Blocks
    else if (me.title === "Brick" || me.title === "Stone" || me.title === "Block") {
        var blockW = (me.spritewidth || 8) * (window.unitsize || 4); // Usually 32 pixels
        var blockH = (me.spriteheight || 8) * (window.unitsize || 4); // Usually 32 pixels
        var w = me.unitwidth || (me.width * (window.unitsize || 4));
        var h = me.unitheight || (me.height * (window.unitsize || 4));

        if (me.title === "Block" && me.used) {
            if (iceBlockImg.complete && iceBlockImg.naturalWidth !== 0) {
                context.translate(leftc, topc);
                for (var y = 0; y < h; y += blockH) {
                    for (var x = 0; x < w; x += blockW) {
                        var wDraw = Math.min(blockW, w - x);
                        var hDraw = Math.min(blockH, h - y);
                        var srcW = wDraw * (iceBlockImg.width / blockW);
                        var srcH = hDraw * (iceBlockImg.height / blockH);
                        context.drawImage(iceBlockImg, 0, 0, srcW, srcH, x, y, wDraw, hDraw);
                    }
                }
                context.translate(-leftc, -topc);
                handled = true;
            }
        } 
        else if (me.title !== "Block" && iceBrickImg.complete && iceBrickImg.naturalWidth !== 0) {
            context.translate(leftc, topc);
            for (var y = 0; y < h; y += blockH) {
                for (var x = 0; x < w; x += blockW) {
                    var wDraw = Math.min(blockW, w - x);
                    var hDraw = Math.min(blockH, h - y);
                    var srcW = wDraw * (iceBrickImg.width / blockW);
                    var srcH = hDraw * (iceBrickImg.height / blockH);
                    context.drawImage(iceBrickImg, 0, 0, srcW, srcH, x, y, wDraw, hDraw);
                }
            }
            context.translate(-leftc, -topc);
            handled = true;
        }
    }
    
    if (!handled && original_drawThingOnCanvasSingle_ice) {
        original_drawThingOnCanvasSingle_ice(context, canvas, me, leftc, topc);
    }
};

// Catch multiple sprites (although usually Blocks/Floor don't use this mode, safety first)
var original_drawThingOnCanvasMultiple_ice = window.drawThingOnCanvasMultiple;
window.drawThingOnCanvasMultiple = function(context, canvases, canvas, me, leftc, topc) {
    if (window.MOD_ICE_WORLD && window.map && !window.map.underground && !window.map.underwater) {
        // Just forward to single so we enforce our textures
        if (me.title === "Floor" || me.title === "FloorReal" || me.title === "Brick" || me.title === "Stone" || (me.title === "Block" && me.used)) {
            window.drawThingOnCanvasSingle(context, canvas, me, leftc, topc);
            return;
        }
    }
    
    if (original_drawThingOnCanvasMultiple_ice) {
        original_drawThingOnCanvasMultiple_ice(context, canvases, canvas, me, leftc, topc);
    }
};

// --- ЛОГИКА ГЕНЕРАЦИИ БЕЛЫХ КУСТОВ И ХОЛМОВ (ICE WORLD) ---

// Функция для замены зеленых пикселей на белые (снежные)
function makeIceSpriteArray(original) {
    if (!original || !(original instanceof Uint8ClampedArray)) return original;
    var newSprite = new Uint8ClampedArray(original.length);
    for (var i = 0; i < original.length; i += 4) {
        var r = original[i];
        var g = original[i+1];
        var b = original[i+2];
        var a = original[i+3];
        
        // Значения зеленого цвета в палитре (r, g, b), используемые для холмов и кустов:
        // [128, 208, 16] - основной зеленый
        // [0, 168, 0]    - тень (темно-зеленый)
        // [168, 250, 188]- блик / светлый зеленый

        if (r === 128 && g === 208 && b === 16) {
            r = 255; g = 255; b = 255; // меняем основной зеленый на чисто белый
        } else if (r === 0 && g === 168 && b === 0) {
            r = 188; g = 188; b = 188; // меняем тень на светло-серый (чтобы объект не был плоским)
        } else if (r === 168 && g === 250 && b === 188) {
            r = 255; g = 255; b = 255; // светлый контур также делаем белым
        }
        
        newSprite[i] = r;
        newSprite[i+1] = g;
        newSprite[i+2] = b;
        newSprite[i+3] = a;
    }
    return newSprite;
}

// 1. Внедряем ледяные текстуры прямо в кэш-библиотеку движка
var initIceScenery = function() {
    if (!window.library || !window.library.sprites || !window.library.sprites.scenery) return;
    
    // Декорации, которые требуется "оснежить"
    var targets = ["Bush1", "Bush2", "Bush3", "HillSmall", "HillLarge", "PlantSmall", "PlantLarge"];
    var scenery = window.library.sprites.scenery;
    
    for (var i = 0; i < targets.length; i++) {
        var t = targets[i];
        if (scenery[t]) {
            var curr = scenery[t];
            // Движок может хранить спрайт как простой массив пикселей, или как объект с ключом "normal"
            if (curr instanceof Uint8ClampedArray) {
                // Превращаем массив в объект: по дефолту дай normal, а если спросят IceWorld — дай снежный вариант
                scenery[t] = {
                    normal: curr,
                    IceWorld: makeIceSpriteArray(curr)
                };
            } else if (curr.normal && curr.normal instanceof Uint8ClampedArray) {
                // Если там уже есть настройки (например, Alt/Underworld), просто добавляем IceWorld
                curr.IceWorld = makeIceSpriteArray(curr.normal);
            }
        }
    }
};

// Запускаем инъекцию через секунду, чтобы гарантировать, что библиотека успела распрарситься движком
setTimeout(initIceScenery, 1000);

// 2. Перехватываем назначение спрайта (вызывается из оригинального движка при генерации объекта)
var original_setThingSprite_ice = window.setThingSprite;
window.setThingSprite = function(thing) {
    // В самом начале защищаемся от пустых вызовов
    if (!thing || !thing.title) {
        if (original_setThingSprite_ice) return original_setThingSprite_ice(thing);
        return;
    }
    
    var isIceWorld = window.MOD_ICE_WORLD && window.map && !window.map.underground && !window.map.underwater;
    
    // Проверяем, является ли объект декорацией из списка кустов, холмов или травы на заднем фоне (Clouds игнорируются)
    var isGreenScenery = thing.libtype === "scenery" && 
                         (thing.title.indexOf("Bush") !== -1 || 
                          thing.title.indexOf("Hill") !== -1 || 
                          thing.title.indexOf("Plant") !== -1);
    
    if (isGreenScenery) {
        var hasIceClass = thing.className.indexOf(" IceWorld") !== -1;
        
        // Если ледяной мир включен, накидываем класс IceWorld
        if (isIceWorld && !hasIceClass) {
            thing.className += " IceWorld";
        } 
        // Если выключен, убираем этот класс
        else if (!isIceWorld && hasIceClass) {
            thing.className = thing.className.replace(" IceWorld", "");
        }
    }
    
    // Движок уходит в библиотеку и, благодаря нашему классу IceWorld, найдет и вытащит отрисованный с нуля белый спрайт!
    if (original_setThingSprite_ice) {
        return original_setThingSprite_ice(thing);
    }
};
