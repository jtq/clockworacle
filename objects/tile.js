function Tile(raw, parent) {
	this.straightCopy = [
		'Name'
	];
	raw.Id = raw.Name;
	Lump.apply(this, arguments);

	this.tileVariants = new Clump(this.attribs.Tiles || [], TileVariant, this);
}
Object.keys(Lump.prototype).forEach(function(member) { Tile.prototype[member] = Lump.prototype[member]; });

Tile.prototype.wireUp = function() {

	this.tileVariants.forEach(function(tv) { tv.wireUp() });

	// Also create a list of all the ports and areas of each of the tilevariants in this object for convenience
	var all_ports = {};
	var all_areas = {};
	this.tileVariants.forEach(function(tv) {
		tv.ports.forEach(function(p) {
			all_ports[p.Id] = p;
			all_areas[p.area.Id] = p.area;
		});
	});
	this.ports = new Clump(Object.keys(all_ports).map(function(p) { return all_ports[p] }), Port, this);
	this.areas = new Clump(Object.keys(all_areas).map(function(a) { return all_areas[a] }), Area, this);

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

	html = "\
	<h3 class='title'>"+this.Name+"</h3>\
	";

	element.innerHTML = html;

	element.title = this.toString();

	return element;
};









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

	this.ports = new Clump(this.attribs.PortData || [], Port, this);

	this.areas = null;
}
Object.keys(Lump.prototype).forEach(function(member) { TileVariant.prototype[member] = Lump.prototype[member]; });

TileVariant.prototype.wireUp = function() {

	this.ports.forEach(function(p) { p.wireUp() });

	// Also create a list of all the areas of each of the ports in this object for convenience
	this.areas = new Clump(this.ports.map(function(p) { return p.area }), Area, this);

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

	html = "\
	<h3 class='title'>"+this.HumanName+"</h3>\
	";

	element.innerHTML = html;

	element.title = this.toString();

	return element;
};










function Port(raw, parent) {
	this.straightCopy = [
		'Name',
		'Rotation',
		'Position',
		'DiscoveryValue',
		'IsStartingPort'
	];


	raw.Id = raw.Name;
	Lump.apply(this, arguments);

	this.SettingId = raw.Setting.Id;

	this.area = null;

}
Object.keys(Lump.prototype).forEach(function(member) { Port.prototype[member] = Lump.prototype[member]; });

Port.prototype.wireUp = function() {

	this.area = this.getOrCreate(Area, this.attribs.Area, this);

	var self = this;
	this.exchanges = all.Exchange.query("SettingIds", function(ids) { return ids.indexOf(self.SettingId) !== -1 });

	Lump.prototype.wireUp.call(this);
};

Port.prototype.toString = function(long) {
	return this.constructor.name + " " + this.Name + " (#" + this.Name + ")";
};

Port.prototype.toDom = function(size, tag) {

	size = size || "normal";
	tag = tag || "li";

	var html = "";

	var element =  document.createElement(tag);
	element.className = "item "+this.constructor.name.toLowerCase()+"-item "+size;

	html = "\
	<h3 class='title'>"+this.Name+"</h3>\
	";

	element.innerHTML = html;

	element.title = this.toString();

	return element;
};