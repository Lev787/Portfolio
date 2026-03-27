// weather_mod.js
var weatherParticles = [];
var weatherType = "none";
var weatherIntensity = 0;
var lastArea = null;
var lightningFlash = 0;

function setupWeather(canvasW, canvasH) {
    if (!window.MOD_WEATHER || !window.area || window.area.setting !== "Overworld") {
        weatherType = "none";
        weatherParticles = [];
        return;
    }
    
    // If Ice World mod is active, force snow weather
    if (window.MOD_ICE_WORLD) {
        weatherType = "snow";
    } else {
        // 0 = none, 1 = sun, 2 = rain, 3 = thunder
        var types = ["none", "sun", "rain", "thunder"];
        weatherType = types[Math.floor(Math.random() * types.length)];
    }
    
    weatherParticles = [];
    if (weatherType === "snow") {
        weatherIntensity = 200 + Math.random() * 150; 
        for (var i = 0; i < weatherIntensity; i++) {
            weatherParticles.push({
                x: Math.random() * canvasW,
                y: Math.random() * canvasH,
                speedY: 2 + Math.random() * 3, // Slow falling
                speedX: -1 + Math.random() * 2, // Slight sway
                size: 2 + Math.random() * 3,
                drift: Math.random() * Math.PI * 2, // For horizontal swaying
                driftSpeed: 0.02 + Math.random() * 0.05
            });
        }
    } else if (weatherType === "rain") {
        weatherIntensity = 150 + Math.random() * 200; 
        for (var i = 0; i < weatherIntensity; i++) {
            weatherParticles.push({
                x: Math.random() * canvasW,
                y: Math.random() * canvasH,
                speedY: 15 + Math.random() * 15,
                speedX: 2 + Math.random() * 4,
                length: 10 + Math.random() * 20,
                thickness: 1 + Math.random() * 2
            });
        }
    } else if (weatherType === "thunder") {
        for (var i = 0; i < 50; i++) {
             weatherParticles.push({
                 x: Math.random() * canvasW,
                 y: Math.random() * (canvasH / 3),
                 size: 30 + Math.random() * 80,
                 opacity: 0.5 + Math.random() * 0.5
             });
        }
    }
}

function drawWeather(context) {
    var cw = context.canvas.width;
    var ch = context.canvas.height;
    
    // Always force check for changes in area OR mod toggles
    if (window.area !== lastArea || window._lastWeatherToggle !== window.MOD_WEATHER || window._lastIceWorldToggle !== window.MOD_ICE_WORLD) {
        lastArea = window.area;
        window._lastWeatherToggle = window.MOD_WEATHER;
        window._lastIceWorldToggle = window.MOD_ICE_WORLD;
        setupWeather(cw, ch);
    }
    
    if (!window.MOD_WEATHER || weatherType === "none" || !window.area || window.area.setting !== "Overworld") return;
    
    if (weatherType === "sun") {
        context.save();
        context.fillStyle = "rgba(255, 255, 0, 0.4)";
        context.beginPath();
        context.arc(cw * 0.8, ch * 0.2, 80, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = "rgba(255, 255, 0, 0.6)";
        context.beginPath();
        context.arc(cw * 0.8, ch * 0.2, 50, 0, Math.PI * 2);
        context.fill();
        context.restore();
    } else if (weatherType === "rain") {
        context.save();
        context.fillStyle = "rgba(0, 0, 50, 0.2)";
        context.fillRect(0, 0, cw, ch); 
        
        context.strokeStyle = "rgba(150, 200, 255, 0.7)";
        context.lineCap = "round";
        for (var i = 0; i < weatherParticles.length; i++) {
            var p = weatherParticles[i];
            context.lineWidth = p.thickness;
            context.beginPath();
            context.moveTo(p.x, p.y);
            context.lineTo(p.x + p.speedX, p.y + p.length);
            context.stroke();
            
            p.y += p.speedY;
            p.x += p.speedX;
            if (p.y > ch) {
                p.y = -p.length;
                p.x = Math.random() * cw;
            }
        }
        context.restore();
    } else if (weatherType === "snow") {
        context.save();
        context.fillStyle = "rgba(200, 220, 255, 0.1)"; // Light blue frosty tint over the screen
        context.fillRect(0, 0, cw, ch); 
        
        context.fillStyle = "rgba(255, 255, 255, 0.8)";
        for (var i = 0; i < weatherParticles.length; i++) {
            var p = weatherParticles[i];
            context.beginPath();
            context.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            context.fill();
            
            p.y += p.speedY;
            p.x += p.speedX + Math.sin(p.drift) * 1.5;
            p.drift += p.driftSpeed;
            
            if (p.y > ch) {
                p.y = -p.size;
                p.x = Math.random() * cw;
            }
        }
        context.restore();
    } else if (weatherType === "thunder") {
        context.save();
        context.fillStyle = "rgba(30, 30, 40, 0.4)";
        context.fillRect(0, 0, cw, ch); 
        
        context.fillStyle = "rgba(100, 100, 120, 0.8)";
        for (var i = 0; i < weatherParticles.length; i++) {
            var p = weatherParticles[i];
            context.beginPath();
            context.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            context.fill();
            p.x -= 0.5;
            if (p.x < -p.size) p.x = cw + p.size;
        }
        
        if (Math.random() < 0.005) {
            lightningFlash = 15;
        }
        if (lightningFlash > 0) {
            context.fillStyle = "rgba(255, 255, 255, " + (lightningFlash / 30) + ")";
            context.fillRect(0, 0, cw, ch);
            lightningFlash--;
        }
        context.restore();
    }
}
