var api = require('../api');
var Clump = require('../objects/clump');
var io = require('../io');
var render = require('./render');

var files_to_load;

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
  files_to_load = 0;
  for (var i = 0; i < files.length; i++) {
    var f = files[i];
    var filename = escape(f.name).toLowerCase();
    var typeName = fileObjectMap[filename];
    if(typeName) {
      files_to_load++;
      var onFileLoaded = (function(typeOfObject) {
        return function (e) {
          var contents = e.target.result;
          
          var obj = JSON.parse(contents);
          console.log("Loaded "+typeOfObject);
          var type = api.types[typeOfObject];
          api.loaded[type] = new Clump(obj, type);

          files_to_load--;

          if(files_to_load === 0) {
            api.wireUpObjects();
            render.lists();
          }

        };
      })(typeName);

      io.readFile(f, onFileLoaded);
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