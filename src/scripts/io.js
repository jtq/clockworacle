
if(typeof FileReader === 'undefined') { // Running in node rather than a browser
  FileReader = require('filereader');
}

var fileObjectMap = {
    'events.json' : 'Event',
    'qualities.json' : 'Quality',
    'areas.json' : 'Area',
    'spawnedentities.json' : 'SpawnedEntity',
    'combatattacks.json' : 'CombatAttack',
    'exchanges.json' : 'Exchange',
    'tiles.json': 'Tile'
  };

function readFile(file, callback) {
  var reader = new FileReader();
  reader.onload = callback;
  reader.readAsText(file);
}

module.exports = {
  readFile: readFile,
  fileObjectMap: fileObjectMap
};