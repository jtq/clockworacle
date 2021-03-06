var config = require('../../config.json');
var Clump = require('./objects/clump');
var Lump = require('./objects/lump');

var io = require('./io');

var library = require('./library');
var loaded = {};

var types = {
  Quality: require('./objects/quality'),
  Event: require('./objects/event'),
  Interaction: require('./objects/interaction'),
  QualityEffect: require('./objects/quality-effect'),
  QualityRequirement: require('./objects/quality-requirement'),
  Area: require('./objects/area'),
  SpawnedEntity: require('./objects/spawned-entity'),
  CombatAttack: require('./objects/combat-attack'),
  Exchange: require('./objects/exchange'),
  Shop: require('./objects/shop'),
  Availability: require('./objects/availability'),
  Tile: require('./objects/tile'),
  TileVariant: require('./objects/tile-variant'),
  Port: require('./objects/port'),
  Setting: require('./objects/setting')
};

// Prepopulate library with Clumps of each type we know about
Object.keys(types).forEach(function(typeName) {
	var Type = types[typeName];
	if(!library[typeName]) {
		library[typeName] = new Clump([], Type);
		loaded[typeName] = new Clump([], Type);
	}
});

function get(Type, id, parent) {
	var typename = Type.name;	// Event, Quality, Interaction, etc

	var existingThingWithThisId = library[typename].id(id);
	if(existingThingWithThisId) {
		//console.log("Attached existing " + existingThingWithThisId + " to " + this.toString())
		var newParent = true;
		existingThingWithThisId.parents.forEach(function(p) {
			if(p.Id === parent.Id && p.constructor.name === parent.constructor.name) {
				newParent = false;
			}
		});
		if(newParent){
			existingThingWithThisId.parents.push(parent);
		}

		if(!existingThingWithThisId.wired) {
			existingThingWithThisId.wireUp(this);	// Pass in the api so object can add itself to the master-library
		}
		return existingThingWithThisId;
	}
	else {
		return null;
	}
}

function getOrCreate(Type, possNewThing, parent) {	// If an object already exists with this ID, use that.  Otherwise create a new object from the supplied details hash
	var typename = Type.name;	// Event, Quality, Interaction, etc
	if(possNewThing) {
  	var existingThingWithThisId = this.get(Type, possNewThing.Id, parent);
  	if(existingThingWithThisId) {
  		return existingThingWithThisId;
  	}
  	else {
			var newThing = new Type(possNewThing, parent);
			newThing.wireUp(this);
			//console.log("Recursively created " + newThing + " for " + this.toString());
			return newThing;
		}
	}
	else {
		return null;
	}
}

function wireUpObjects() {
	var api = this;
  Object.keys(types).forEach(function(type) {
    library[type].forEach(function(lump) {
      if(lump.wireUp) {
        lump.wireUp(api);
      }
    });
  });
}

var whatIs = function(id) {
  var possibilities = [];
  Object.keys(library).forEach(function(key) {
    if(library[key] instanceof Clump && library[key].id(id)) {
      possibilities.push(key);
    }
  });
  return possibilities;
};

function describeAdvancedExpression(expr) {
	var self = this;
	if(expr) {
		expr = expr.replace(/\[d:(\d+)\]/gi, "RANDOM[1-$1]");	// [d:x] = random number from 1-x(?)
		expr = expr.replace(/\[q:(\d+)\]/gi, function(match, backref, pos, whole_str) {
			var quality = self.library.Quality.id(backref);
			return "["+(quality ? quality.Name : 'INVALID')+"]";
		});

		return expr;
	}
	return null;
}

function readFromFile(Type, file, callback) {
	io.readFile(file, function (e) {
    var contents = e.target.result;
    
    var obj = JSON.parse(contents);
    loaded[Type.prototype.constructor.name] = new Clump(obj, Type);

    callback(contents, Type, loaded[Type.prototype.constructor.name]);
  });
}


module.exports = {
	'Clump': Clump,
	'Lump': Lump,
	'config': config,
	'types': types,
	'library': library,
	'loaded': loaded,
	'get': get,
	'whatIs': whatIs,
	'wireUpObjects': wireUpObjects,
	'getOrCreate': getOrCreate,
	'describeAdvancedExpression': describeAdvancedExpression,
	'readFromFile': readFromFile
};