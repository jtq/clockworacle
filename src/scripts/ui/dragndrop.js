var api = require('../api');
var Clump = require('../objects/clump');

var render = require('./render');

function handleDragOver(evt) {
  evt.stopPropagation();
  evt.preventDefault();

  $("#drop-zone").addClass("drop-target");
}

function handleDragEnd(evt) {
  evt.stopPropagation();
  evt.preventDefault();

  $("#drop-zone").removeClass("drop-target");
}

function handleDragDrop(evt) {

  $("#drop-zone").removeClass("drop-target");

  var fileObjectMap = {
    'events.json' : 'Event',
    'qualities.json' : 'Quality',
    'areas.json' : 'Area',
    'spawnedentities.json' : 'SpawnedEntity',
    'combatattacks.json' : 'CombatAttack',
    'exchanges.json' : 'Exchange',
    'tiles.json': 'Tile'
  };

  evt.stopPropagation();
  evt.preventDefault();

  var files = evt.dataTransfer.files; // FileList object.

  // Files is a FileList of File objects. List some properties.
  var output = [];
  api.resetFilesToLoad();
  for (var i = 0; i < files.length; i++) {
    var f = files[i];
    var filename = escape(f.name).toLowerCase();
    var typeName = fileObjectMap[filename];
    var Type = api.types[typeName];
    if(Type) {
      api.incrementFilesToLoad();
      api.readFromFile(Type, f, function() {
        api.decrementFilesToLoad();

        if(api.countFilesToLoad() === 0) {
          api.wireUpObjects();
          render.lists();
        }
      });
      output.push('<li><strong>', escape(f.name), '</strong> (', f.type || 'n/a', ') - ',
                f.size, ' bytes, last modified: ',
                f.lastModifiedDate ? f.lastModifiedDate.toLocaleDateString() : 'n/a',
                '</li>');
    }
    else {
      output.push('<li>ERROR: No handler for file <strong>' , escape(f.name), '</strong></li>');
    }
  }
  document.getElementById('list').innerHTML = '<ul>' + output.join('') + '</ul>';
}

module.exports = {
	handlers: {
		dragOver: handleDragOver,
		dragEnd: handleDragEnd,
		dragDrop: handleDragDrop
	}
};