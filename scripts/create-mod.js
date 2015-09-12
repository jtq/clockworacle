var config = require('../config.json');
var api = require('../src/scripts/api');
var File = require('File');
var fs = require('fs');

var io = require('../src/scripts/io');

var Handlebars = require('handlebars');

var templates = loadModTemplates();
loadGameData(function() {
	renderTemplates(generateJSON());
});

function loadGameData(onAllLoaded) {
	io.resetFilesToLoad();
	Object.keys(io.fileObjectMap).forEach(function(filename) {
			var typeName = io.fileObjectMap[filename];
			var Type = api.types[typeName];

			var filepath = 'game-data/json/'+filename;
			var file = new File(filepath);
			console.log('Reading game-data', filepath);

			io.incrementFilesToLoad();
	    api.readFromFile(Type, file, function(contents, type, clump) {
	      io.decrementFilesToLoad();

	      if(io.countFilesToLoad() === 0) {
	      	Object.keys(api.library).forEach(function(typeName) {
	      		console.log("Loaded", typeName, api.library[typeName].size()+' items');
	      	});
	      	console.log('Loading sub-objects and wiring up object references');
	        api.wireUpObjects();
	        Object.keys(api.library).forEach(function(typeName) {
	      		console.log("Discovered", typeName, api.library[typeName].size()+' items');
	      	});

	      	onAllLoaded();
	      }
	    });

	});
}

function loadModTemplates() {
	return {
		events: fs.readFileSync(config.paths.templates+'/events.json.handlebars', { encoding:'utf8' }),
		qualities: fs.readFileSync(config.paths.templates+'/qualities.json.handlebars', { encoding:'utf8' })
	};
}


function generateJSON() {
	var json = {
		buildDateTime: new Date().toISOString(),
		baseId: api.config.baseId
	};
	//console.log(json);
	return json;
}

function renderTemplates(data) {
	var qualitiesTemplate = Handlebars.compile(templates.qualities);
	var eventsTemplate = Handlebars.compile(templates.events);
	fs.writeFileSync(config.paths.builddir.mod+'/qualities.json', qualitiesTemplate(data), { encoding:'utf8' });
	fs.writeFileSync(config.paths.builddir.mod+'/events.json', eventsTemplate(data), { encoding:'utf8' });
}