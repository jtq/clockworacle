var Lump = require('./lump');
var Clump = require('./clump');
var Port = require('./port');
var Area = require('./area');

var api;

function TileVariant(raw, parent) {
	this.straightCopy = [
		'Name',
		'HumanName',
		'Description',

		'MaxTilePopulation',
		'MinTilePopulation',
		
		'SeaColour',
		'MusicTrackName',
		'ChanceOfWeather',
		'FogRevealThreshold'
	];

/*
LabelData: Array[6]
PhenomenaData: Array[1]
SpawnPoints: Array[2]
TerrainData: Array[14]
Weather: Array[1]
*/

	raw.Id = raw.Name;
	Lump.apply(this, arguments);

	this.SettingId = raw.Setting.Id;
	this.setting = null;

	this.ports = new Clump(this.attribs.PortData || [], Port, this);

	this.areas = null;
}
Object.keys(Lump.prototype).forEach(function(member) { TileVariant.prototype[member] = Lump.prototype[member]; });

TileVariant.prototype.wireUp = function(theApi) {

	api = theApi;

	this.setting = api.getOrCreate(api.types.Setting, this.attribs.Setting, this);

	this.ports.forEach(function(p) { p.wireUp(api); });

	// Also create a list of all the areas of each of the ports in this object for convenience
	this.areas = new Clump(this.ports.map(function(p) { return p.area; }), api.types.Area, this);

	Lump.prototype.wireUp.call(this);
};

TileVariant.prototype.toString = function(long) {
	return this.constructor.name + " " + this.HumanName + " (#" + this.Name + ")";
};

TileVariant.prototype.toDom = function(size, tag) {

	size = size || "normal";
	tag = tag || "li";

	var html = "";

	var element =  document.createElement(tag);
	element.className = "item "+this.constructor.name.toLowerCase()+"-item "+size;

	html = "\n<h3 class='title'>"+this.HumanName+"</h3>";

	element.innerHTML = html;

	element.title = this.toString();

	return element;
};

module.exports = TileVariant;