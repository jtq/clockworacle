var Lump = require('./lump');
var Clump = require('./clump');

var api;

function Exchange(raw, parent) {
	this.straightCopy = [
		'Id',
		'Name',
		'Description',
		'Image',
		'SettingIds'
	];
	Lump.apply(this, arguments);

	this.shops = null;
	this.settings = null;
}
Object.keys(Lump.prototype).forEach(function(member) { Exchange.prototype[member] = Lump.prototype[member]; });

Exchange.prototype.wireUp = function(theApi) {

	api = theApi;

	var self = this;

	this.shops = new Clump(this.attribs.Shops || [], api.types.Shop, this);
	
	this.settings = api.library.Setting.query("Id", function(id) {
		return self.SettingIds.indexOf(id) !== -1;
	});
	this.settings.forEach(function (s) {
		self.parents.push(s);
	});
	
	this.ports = api.library.Port.query("SettingId", function(id) {
		return self.SettingIds.indexOf(id) !== -1;
	});
	this.ports.forEach(function (p) {
		self.parents.push(p);
	});

	Lump.prototype.wireUp.call(this);
};

Exchange.prototype.toString = function() {
	return this.constructor.name + " " + this.Name + " (#" + this.Id + ")";
};

Exchange.prototype.toDom = function(size, includeChildren, tag) {

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
				if(self.shops) {

					var child_elements = self.shops.toDom("normal", true);

					child_elements.classList.add("child-list");
					element.appendChild(child_elements);
				}
			}
		});
	}

	return element;
};

module.exports = Exchange;