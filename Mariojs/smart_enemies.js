// smart_enemies.js

// Сохраняем оригинальные функции
var moveSimpleOriginal = window.moveSimple;
var moveSmartOriginal = window.moveSmart;

function offRestingOriginal(me) {
    if (!me.resting) return true;
    if (me.moveleft) return me.right - unitsize * 1.5 < me.resting.left;
    else return me.left + unitsize * 1.5 > me.resting.right;
}

function moveSmartEnemy(me) {
    if (!window.MOD_SMART_ENEMIES || !window.player || me.group !== "enemy" || !me.alive || me.nofall) {
        return moveSimpleOriginal(me);
    }
    
    var distX = player.left - me.left;
    var absDistX = Math.abs(distX);
    
    // 1. Ждать игрока (Если игрок слишком далеко - стоим на месте)
    if (absDistX > window.innerWidth * 0.7) {
        me.xvel = 0;
        return;
    }
    
    // 2. Идти к игроку (Поворачиваемся к игроку, если он сзади, а мы на земле)
    var intentMoveLeft = me.moveleft;
    if (me.yvel === 0) {
        if (distX > 0) intentMoveLeft = false;
        else if (distX < 0) intentMoveLeft = true;
    }

    // Проверяем, не уперлись ли мы в стену. Если движок сам поменял me.moveleft:
    if (me.lastMoveLeft !== undefined && me.lastMoveLeft !== me.moveleft) {
        if (me.yvel === 0) {
            me.moveleft = me.lastMoveLeft; // Возвращаем курс (игнорируем автоматический отскок от стены)
            me.yvel = unitsize * -2.4;     // Прыгаем (чуть выше, чтобы перепрыгнуть трубы)
            me.resting = false;
        }
    } else {
        me.moveleft = intentMoveLeft; // Задаем наш курс на игрока
    }
    
    // 3. Прыгать через ямы (Если сейчас упадем в пропасть) - но предметы из блоков (blockparent) падают
    if (me.yvel === 0 && (!me.resting || offRestingOriginal(me)) && !me.blockparent) {
        me.yvel = unitsize * -2.4; 
        me.resting = false;
    }
    
    me.lastMoveLeft = me.moveleft;
    
    // Двигаемся в нужную сторону
    if (me.direction != me.moveleft) {
        if (me.moveleft) {
            me.xvel = -me.speed;
            if (!me.noflip) unflipHoriz(me);
        } else {
            me.xvel = me.speed;
            if (!me.noflip) flipHoriz(me);
        }
        me.direction = me.moveleft;
    } else {
        // Убеждаемся, что скорость есть
        me.xvel = me.moveleft ? -me.speed : me.speed;
    }
}

// Перехватываем стандартное движение для врагов
window.moveSimple = function(me) {
    if (window.MOD_SMART_ENEMIES && me.group === "enemy") {
        moveSmartEnemy(me);
    } else {
        moveSimpleOriginal(me);
    }
};

window.moveSmart = function(me) {
    if (window.MOD_SMART_ENEMIES && me.group === "enemy") {
        moveSmartEnemy(me);
    } else {
        moveSmartOriginal(me);
    }
};