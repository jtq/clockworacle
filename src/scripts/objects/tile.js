var Lump = require('./lump');
var Clump = require('./clump');
var TileVariant = require('./tile-variant');
var Port = require('./port');
var Area = require('./area');

var api;

function Tile(raw, parent) {
	this.straightCopy = [
		'Name'
	];
	raw.Id = raw.Name;
	Lump.apply(this, arguments);

	this.tileVariants = new Clump(this.attribs.Tiles || [], TileVariant, this);
}
Object.keys(Lump.prototype).forEach(function(member) { Tile.prototype[member] = Lump.prototype[member]; });

Tile.prototype.wireUp = function(theApi) {

	api = theApi;

	this.tileVariants.forEach(function(tv) { tv.wireUp(api); });

	// Also create a list of all the ports and areas of each of the tilevariants in this object for convenience
	var all_ports = {};
	var all_areas = {};
	this.tileVariants.forEach(function(tv) {
		tv.ports.forEach(function(p) {
			all_ports[p.Id] = p;
			all_areas[p.area.Id] = p.area;
		});
	});
	this.ports = new Clump(Object.keys(all_ports).map(function(p) { return all_ports[p]; }), api.types.Port, this);
	this.areas = new Clump(Object.keys(all_areas).map(function(a) { return all_areas[a]; }), api.types.Area, this);

	Lump.prototype.wireUp.call(this);
};

Tile.prototype.toString = function(long) {
	return this.constructor.name + " " + this.Name + " (#" + this.Name + ")";
};

Tile.prototype.toDom = function(size, tag) {

	size = size || "normal";
	tag = tag || "li";

	var html = "";

	var element =  document.createElement(tag);
	element.className = "item "+this.constructor.name.toLowerCase()+"-item "+size;

	html = "\n<h3 class='title'>"+this.Name+"</h3>";

	element.innerHTML = html;

	element.title = this.toString();

	return element;
};

module.exports = Tile;