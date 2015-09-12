var config = require('../config.json');
var api = require('../src/scripts/api');
var FileReader = require('filereader');
var File = require('File');

var file = new File('./game-data/json/Tiles.json');

var callback = function(contents, type, clump) {
	console.log(arguments);
};

api.readFromFile(api.types.Tile, file, callback);