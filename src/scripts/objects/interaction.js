var Lump = require('./lump');
var Clump = require('./clump');

var api;

function Interaction(raw, parent) {
	this.straightCopy = [
	'Name',
	'Description',
	'ButtonText',
	'Image',

	'Ordering'
	];
	Lump.apply(this, arguments);

	this.qualitiesRequired = null;
	this.successEvent = null;
	this.defaultEvent = null;

}
Object.keys(Lump.prototype).forEach(function(member) { Interaction.prototype[member] = Lump.prototype[member]; });

Interaction.prototype.wireUp = function(theApi) {

	api = theApi;

	this.qualitiesRequired = new Clump(this.attribs.QualitiesRequired || [], api.types.QualityRequirement, this);
	this.successEvent = api.getOrCreate(api.types.Event, this.attribs.SuccessEvent, this);
	if(this.successEvent) {
		this.successEvent.tag = "success";
	}
	this.defaultEvent = api.getOrCreate(api.types.Event, this.attribs.DefaultEvent, this);
	var qualitiesRequired =  this.qualitiesRequired;
	if(this.defaultEvent && this.successEvent && qualitiesRequired && qualitiesRequired.size()) {
		this.defaultEvent.tag = "failure";
	}

	Lump.prototype.wireUp.call(this, api);
};

Interaction.prototype.toString = function() {
	return this.constructor.name + " [" + this.Ordering + "] " + this.Name + " (#" + this.Id + ")";
};

Interaction.prototype.toDom = function(size, includeChildren) {

	size = size || "normal";
	includeChildren = includeChildren === false ? false : true;

	var html = "";

	var element =  document.createElement("li");
	element.className = "item "+this.constructor.name.toLowerCase()+"-item "+size;

	if(this.Image !== null && this.Image !== "") {
		html = "<img class='icon' src='file:///C:/Users/James/AppData/LocalLow/Failbetter Games/Sunless Sea/images/sn/icons/"+this.Image+"small.png' />";
	}

	html += "\n<h3 class='title'>"+this.Name+"</h3>";

	if(size != "small" && this.qualitiesRequired) {
		html += "<div class='sidebar'>";
		html += "<h4>Requirements</h4>";
		html += this.qualitiesRequired.toDom("small", false, "ul").outerHTML;
		html += "</div>";
	}

	html += "<p class='description'>"+this.Description+"</p>";

	element.innerHTML = html;

	element.title = this.toString();

	if(includeChildren) {
		var self = this;
		element.addEventListener("click", function(e) {
			e.stopPropagation();

			var childList = element.querySelector(".child-list");
			if(childList) {
				element.removeChild(childList);
			}
			else {
				var successEvent = self.successEvent;
				var defaultEvent = self.defaultEvent;
				var qualitiesRequired =  self.qualitiesRequired;
				var events = [];
				if(successEvent && qualitiesRequired && qualitiesRequired.size()) {
					events.push(successEvent);
				}
				if(defaultEvent) {
					events.push(defaultEvent);
				}
				if(events.length) {
					var wrapperClump = new Clump(events, api.types.Event);
					var child_events = wrapperClump.toDom("normal", true);

					child_events.classList.add("child-list");
					element.appendChild(child_events);
				}
			}
		});
	}

	return element;
};

module.exports = Interaction;