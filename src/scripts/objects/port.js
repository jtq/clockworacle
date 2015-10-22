var Lump = require('./lump');

var api;

function Port(raw, parent) {
	this.straightCopy = [
		'Name',
		'Rotation',
		'Position',
		'DiscoveryValue',
		'IsStartingPort'
	];


	raw.Id = parent.Name+"/"+raw.Name;
	Lump.apply(this, arguments);

	this.SettingId = raw.Setting.Id;
	this.setting = null;

	this.area = null;

	this.exchanges = null;
}
Object.keys(Lump.prototype).forEach(function(member) { Port.prototype[member] = Lump.prototype[member]; });

Port.prototype.wireUp = function(theApi) {
	
	api = theApi;
	var self = this;

	this.setting = api.getOrCreate(api.types.Setting, this.attribs.Setting, this);
	
	this.area = api.getOrCreate(api.types.Area, this.attribs.Area, this);

	this.exchanges = api.library.Exchange.query("SettingIds", function(ids) { return ids.indexOf(self.SettingId) !== -1; });

	Lump.prototype.wireUp.call(this, api);
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

	html = "\n<h3 class='title'>"+this.Name+"</h3>";

	element.innerHTML = html;

	element.title = this.toString();

	return element;
};

module.exports = Port;