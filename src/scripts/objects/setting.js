var Lump = require('./lump');

var api;

function Setting(raw, parent) {
	this.straightCopy = [
		'Id'
	];
	Lump.apply(this, arguments);

	this.shops = null;
}
Object.keys(Lump.prototype).forEach(function(member) { Setting.prototype[member] = Lump.prototype[member]; });

Setting.prototype.wireUp = function(theApi) {

	api = theApi;

	Lump.prototype.wireUp.call(this);
};

Setting.prototype.toString = function() {
	return this.constructor.name + " #" + this.Id;
};

Setting.prototype.toDom = function(size, includeChildren, tag) {

	size = size || "normal";
	includeChildren = includeChildren === false ? false : true;
	tag = tag || "li";

	var self = this;
	var html = "";

	var element =  document.createElement(tag);
	element.className = "item "+this.constructor.name.toLowerCase()+"-item "+size;

	html = "\n<h3 class='title'>"+this.Id+"</h3>";

	element.innerHTML = html;

	element.title = this.toString();

	return element;
};

module.exports = Setting;