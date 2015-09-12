var Lump = require('./lump');
var Clump = require('./clump');

var api;

function Shop(raw, parent) {
	this.straightCopy = [
		'Id',
		'Name',
		'Description',
		'Image',
		'Ordering'
	];
	Lump.apply(this, arguments);

	this.availabilities = null;
	this.unlockCost = null;
}
Object.keys(Lump.prototype).forEach(function(member) { Shop.prototype[member] = Lump.prototype[member]; });

Shop.prototype.wireUp = function(theApi) {

	api = theApi;

	this.availabilities = new Clump(this.attribs.Availabilities || [], api.types.Availability, this);

	Lump.prototype.wireUp.call(this);
};

Shop.prototype.toString = function() {
	return this.constructor.name + " " + this.Name + " (#" + this.Id + ")";
};

Shop.prototype.toDom = function(size, includeChildren, tag) {

	size = size || "normal";
	includeChildren = includeChildren === false ? false : true;
	tag = tag || "li";

	var self = this;
	var html = "";

	var element =  document.createElement(tag);
	element.className = "item "+this.constructor.name.toLowerCase()+"-item "+size;

	html = "\n<img class='icon' src='"+api.config.locations.imagesPath+"/"+this.Image+".png' />";
	html += "\n<h3 class='title'>"+this.Name+"</h3>";
	html += "\n<p class='description'>"+this.Description+"</p>";

	element.innerHTML = html;

	element.title = this.toString();

	if(includeChildren) {
		element.addEventListener("click", function(e) {
			e.stopPropagation();

			var childList = element.querySelector(".child-list");
			if(childList) {
				element.removeChild(childList);
			}
			else {
				if(self.availabilities) {

					var child_elements = self.availabilities.toDom("normal", true);

					child_elements.classList.add("child-list");
					element.appendChild(child_elements);
				}
			}
		});
	}

	return element;
};

module.exports = Shop;