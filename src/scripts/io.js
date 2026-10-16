var fileObjectMap = {
    'events.json' : 'Event',
    'qualities.json' : 'Quality',
    'areas.json' : 'Area',
    'SpawnedEntities.json' : 'SpawnedEntity',
    'CombatAttacks.json' : 'CombatAttack',
    'exchanges.json' : 'Exchange',
    'Tiles.json': 'Tile'
  };

function readFile(file, callback) {
  file.text()
    .then(function(contents) {
      callback({ target: { result: contents } });
    })
    .catch(function(err) {
      setTimeout(function() { throw err; }, 0);
    });
}

var files_to_load = 0;
function resetFilesToLoad() {
	files_to_load = 0;
}
function incrementFilesToLoad() {
	files_to_load++;
}
function decrementFilesToLoad() {
	files_to_load--;
}
function countFilesToLoad() {
	return files_to_load;
}


module.exports = {
  readFile: readFile,
  resetFilesToLoad: resetFilesToLoad,
	incrementFilesToLoad: incrementFilesToLoad,
	decrementFilesToLoad: decrementFilesToLoad,
	countFilesToLoad: countFilesToLoad,
  fileObjectMap: fileObjectMap
};