var config = require('../config.json');
var api = require('../src/scripts/api');
var File = require('File');
var fs = require('fs');

var io = require('../src/scripts/io');
var query = require('../src/scripts/ui/query');

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

	var additionalEvents = [];

	var temp;

	temp = generateObjectListFromClump(api.config.baseGameIds.acquire, api.library.Quality.query('Tag', 'Goods'), json);
	json.eventAcquireChildren = temp.interactions;
	additionalEvents = additionalEvents.concat(temp.additionalEvents);

	temp = generateObjectListFromClump(api.config.baseGameIds.learn, api.library.Quality.query('Tag', 'Knowledge').query('Category', 'Curiosity'), json);
	json.eventLearnChildren = temp.interactions;
	additionalEvents = additionalEvents.concat(temp.additionalEvents);

	temp = generateObjectListFromClump(api.config.baseGameIds.suffer, api.library.Quality.query('Tag', 'Menace').query('Nature', 'Status').query('Category', 'Story'), json);
	json.eventSufferChildren = temp.interactions;
	additionalEvents = additionalEvents.concat(temp.additionalEvents);
	
	temp = generateObjectListFromClump(api.config.baseGameIds.become, api.library.Quality.query('Tag', 'Abilities').query('Category', 'SidebarAbility'), json);
	json.eventBecomeChildren = temp.interactions;
	additionalEvents = additionalEvents.concat(temp.additionalEvents);
		
	json.additionalEvents = additionalEvents;

	return json;
}

function generateObjectListFromClump(baseId, clump, data) {
	var Type = clump.type;
	var interactions = [];
	var additionalEvents = [];

	var newItemId = baseId;

	var interactionTemplate = Handlebars.compile(fs.readFileSync(config.paths.templates+'/objects/interaction.handlebars', { encoding:'utf8' }));
	var eventTemplate = Handlebars.compile(fs.readFileSync(config.paths.templates+'/objects/event.handlebars', { encoding:'utf8' }));

	var chosenQualityEvents = [];

	clump.forEach(function(quality, id, collection) {

		// Quality interaction object
		quality.Id = ++newItemId;	// Id of this new item, not the Id of the existing game-item it relates to
		var defaultEventId = ++newItemId;
		var linkToEventId = ++newItemId;


		var linkToEvent = eventTemplate({
			Id: linkToEventId,
			Name: '',
			Description: 'LinkTo event for '+quality.Name,
			Image: 'null',
			buildDateTime: data.buildDateTime,
			linkToEvent: "null",
			interactionChildren: ''
		});

		// Double-event (Interaction->DefaultEvent->LinktoEvent) for this interaction (to hang the various route interactions off)
		quality.defaultEvent = eventTemplate({
			Id: defaultEventId,
			Name: 'Default event for '+quality.Name,
			Description: prepareString(quality.Description),
			Image: '',
			buildDateTime: data.buildDateTime,
			interactionChildren: '',
			linkToEvent: linkToEvent
		});

		quality.Name = prepareString(quality.Name);
		quality.Description = '';
		quality.buildDateTime = data.buildDateTime;

		interactions.push(interactionTemplate(quality));


		// Generate interactions to affect this quality
		var interactionChildren = [];
		var routesToNode = query.filterPathsToNode(query.pathsToNode(quality, {}), 'additive');
		var hintsMap = {};
		getHints(routesToNode, [], hintsMap);

		Object.keys(hintsMap).forEach(function(text) {

			var interactionId = ++newItemId;
			var eventId = ++newItemId;

			var specificInteractionDefaultEvent = eventTemplate({
				Id: eventId,
				Name: 'Detailed directions for '+prepareString(quality.Name),
				Description: prepareString(text),
				Image: quality.Image || 'null',
				buildDateTime: data.buildDateTime,
				interactionChildren: '',
				linkToEvent: 'null'
			});

			interactionChildren.push(interactionTemplate({
				Id: interactionId,
				Name: prepareString(text),
				Description: '',
				buildDateTime: data.buildDateTime,
				defaultEvent: specificInteractionDefaultEvent
			}));
		});

		chosenQualityEvents.push(eventTemplate({
			Id: linkToEventId,
			Name: prepareString(quality.Name),
			Description: 'To acquire '+prepareString(quality.Name)+' you may...',
			Image: quality.Image || 'null',
			buildDateTime: data.buildDateTime,
			linkToEvent: 'null',
			interactionChildren: interactionChildren
		}));

	});

	additionalEvents = additionalEvents.concat(chosenQualityEvents);

	return {
		interactions: interactions,
		additionalEvents: additionalEvents
	};
}

function getHints(routeNode, ancestry, hintsMap) {
	var new_ancestry = ancestry.slice();
  new_ancestry.push(routeNode.node);
  routeNode.children.forEach(function(child_route, index, children) {
    getHints(child_route, new_ancestry, hintsMap);
  });

  if(!routeNode.children.length) {	// Leaf node
		var hint = query.describeRoute(new_ancestry);
		hintsMap[hint] = true;
  }

  return hintsMap
}

function prepareString(raw) {
	return Handlebars.Utils.escapeExpression(raw).replace(/\s*\[[^\]]*\]/g, '').replace(/&#x27;/g, '\'');
}

function renderTemplates(data) {

	var ids = JSON.parse(JSON.stringify(data.baseGameIds));

	Handlebars.registerHelper('id', function(name) {
		ids[name] = (typeof ids[name] === "undefined") ? 0 : ids[name];
		return ids[name];
	});

	Handlebars.registerHelper('increment', function(name, amount) {
		amount = (typeof amount === "undefined" || typeof amount === "object") ? 1 : amount;
		ids[name] += amount;
	  return ids[name];
	});

	Handlebars.registerHelper('bumpToNext', function(name, amount) {
		amount = (typeof amount === "undefined" || typeof amount === "object") ? 100 : amount;
		ids[name] = Math.ceil((ids[name]+1)/amount) * amount;
	  return ids[name];
	});

	var qualitiesTemplate = Handlebars.compile(templates.qualities);
	var eventsTemplate = Handlebars.compile(templates.events);
	fs.writeFileSync(config.paths.builddir.mod+'/qualities.json', qualitiesTemplate(data), { encoding:'utf8' });
	fs.writeFileSync(config.paths.builddir.mod+'/events.json', eventsTemplate(data), { encoding:'utf8' });
}