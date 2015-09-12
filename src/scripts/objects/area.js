var Lump = require('./lump');

var api;

function Area(raw) {
	this.straightCopy = ["Name", "Description", "ImageName", "MoveMessage"];
	Lump.call(this, raw);
}
Object.keys(Lump.prototype).forEach(function(member) { Area.prototype[member] = Lump.prototype[member]; });

Area.prototype.wireUp = function(theApi) {
	api = theApi;
	Lump.prototype.wireUp.call(this);
};

Area.prototype.toString = function() {
	return this.constructor.name + " " + this.Name + " (#" + this.Id + ")";
};

Area.prototype.toDom = function(size) {

	size = size || "normal";

	var element =  document.createElement("li");
	element.className = "item "+this.constructor.name.toLowerCase()+"-item "+size;

	if(this.ImageName !== null && this.Image !== "") {
		element.innerHTML = "<img class='icon' src='"+api.config.locations.imagesPath+"/"+this.ImageName+".png' />";
	}

	element.innerHTML += "\n<h3 class='title'>"+this.Name+"</h3>\n<p class='description'>"+this.Description+"</p>";

	element.title = this.toString();

	return element;
};

module.exports = Area;