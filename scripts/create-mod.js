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
		baseGameIds: api.config.baseGameIds
	};

	json.eventAcquireChildren = generateObjectListFromClump(api.config.baseGameIds.acquire, api.library.Quality.query('Tag', 'Goods'), json);
	json.eventLearnChildren = generateObjectListFromClump(api.config.baseGameIds.learn, api.library.Quality.query('Tag', 'Knowledge').query('Category', 'Curiosity'), json);
	json.eventSufferChildren = generateObjectListFromClump(api.config.baseGameIds.suffer, api.library.Quality.query('Tag', 'Menace').query('Nature', 'Status').query('Category', 'Story'), json);
	json.eventBecomeChildren = generateObjectListFromClump(api.config.baseGameIds.become, api.library.Quality.query('Tag', 'Abilities').query('Category', 'SidebarAbility'), json);

	return json;
}

function generateObjectListFromClump(baseId, clump, data) {
	var Type = clump.type;
	var rendered = [];

	var newItemId = baseId;

	var template = fs.readFileSync(config.paths.templates+'/objects/interaction.handlebars', { encoding:'utf8' });
	var childTemplate;

	clump.forEach(function(item, id, collection) {

		// Quality interaction object
		item.Id = ++newItemId;	// Id of this new item, not the Id of the existing game-item it relates to
		item.Name = prepareString(item.Name);
		item.Description = prepareString(item.Description);
		item.buildDateTime = data.buildDateTime;

		// Default event for this interaction
		childTemplate = fs.readFileSync(config.paths.templates+'/objects/event.handlebars', { encoding:'utf8' });
		item.defaultEvent =  Handlebars.compile(childTemplate)({
			Id: ++newItemId,
			Name: '',
			Description: '',
			buildDateTime: data.buildDateTime
		});

		// Optional interactions for this default event

		rendered.push(Handlebars.compile(template)(item));
	});

	return rendered.join(',\n');
}

function prepareString(raw) {
	//return raw.replace(/"/g, /\\"/g).replace(/\s*\[[^\]]*\]/g, '');
	return Handlebars.Utils.escapeExpression(raw).replace(/\s*\[[^\]]*\]/g, '').replace(/&#x27;/, '\'');
}

function renderTemplates(data) {


	var ids = JSON.parse(JSON.stringify(data.baseGameIds));

	Handlebars.registerHelper('id', function(name) {
		ids[name] = (typeof ids[name] === "undefined") ? 0 : ids[name];
		//console.log("id", name, "is", ids[name]);
		return ids[name];
	});

	Handlebars.registerHelper('increment', function(name, amount) {
		amount = (typeof amount === "undefined" || typeof amount === "object") ? 1 : amount;
		ids[name] += amount;
		//console.log("Increment", name, "to", ids[name]);
	  return ids[name];
	});

	Handlebars.registerHelper('bumpToNext', function(name, amount) {
		amount = (typeof amount === "undefined" || typeof amount === "object") ? 100 : amount;
		ids[name] = Math.ceil((ids[name]+1)/amount) * amount;
		//console.log("Bumping", name, "by", amount, "to", ids[name]);
	  return ids[name];
	});

	var qualitiesTemplate = Handlebars.compile(templates.qualities);
	var eventsTemplate = Handlebars.compile(templates.events);
	fs.writeFileSync(config.paths.builddir.mod+'/qualities.json', qualitiesTemplate(data), { encoding:'utf8' });
	fs.writeFileSync(config.paths.builddir.mod+'/events.json', eventsTemplate(data), { encoding:'utf8' });
}