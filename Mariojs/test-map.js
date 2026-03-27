const fs = require('fs');

global.window = global;
global.mapfuncs = {};

let files = ['utility.js', 'things.js', 'maps.js'];
files.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');
  // run the code in global context
  try {
     eval(content);
  } catch(e) {}
});

let newmap = { areas: [] };
try {
  World14(newmap);
  console.log("World14 generated successfully!");
} catch (e) {
  console.log("Error running World14:", e);
}
