var api = require('../sunless-sea');
var Clump = require('../objects/clump');

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
    var objname = fileObjectMap[filename];
    if(objname) {
      files_to_load++;
      readSingleFile(f, objname);
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

function readSingleFile(file, typeName) {
  var reader = new FileReader();
  reader.onload = function(e) {
    var contents = e.target.result;
    
  	var obj = JSON.parse(contents);
    console.log("Loaded "+typeName);
    var type = api.types[typeName];
  	api.loaded[typeName] = new Clump(obj, type);

    files_to_load--;

    if(files_to_load === 0) {
      wireUpObjects();
      renderLists();
    }

  };
  reader.readAsText(file);
}

function wireUpObjects() {
  Object.keys(api.types).forEach(function(type) {
    console.log("Wired up "+type);
    api.library[type].forEach(function(lump) {
      if(lump.wireUp) {
        lump.wireUp(api);
      }
    });
  });
}

function renderLists() {
  Object.keys(api.loaded).forEach(function(type) {
    renderList(api.loaded[type]); // Only display directly loaded (root-level) Lumps, to prevent the list becoming unwieldy
  });
}

function renderList(clump) {
	var root = document.getElementById(clump.type.name.toLowerCase()+"-list");
  if(root) {
	 root.appendChild(clump.toDom());
  }
}

module.exports = {
	handlers: {
		dragOver: handleDragOver,
		dragEnd: handleDragEnd,
		dragDrop: handleDragDrop
	}
};