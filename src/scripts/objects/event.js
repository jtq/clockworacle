var Lump = require('./lump');
var Clump = require('./clump');

var api;

function Event(raw, parent) {
	this.straightCopy = [
	'Name',
	'Description',
	'Teaser',
	'Image',
	'Category'
	];
	Lump.apply(this, arguments);

	this.tag = null;

	this.ExoticEffects = this.getExoticEffect(this.attribs.ExoticEffects);

	this.qualitiesRequired = null;
	this.qualitiesAffected = null;
	this.interactions = null;
	this.linkToEvent = null;

	this.limitedToArea = null;

	this.setting = null;
	
	//Deck
	//Stickiness
	//Transient
	//Urgency
}
Object.keys(Lump.prototype).forEach(function(member) { Event.prototype[member] = Lump.prototype[member]; });

Event.prototype.wireUp = function(theApi) {

	api = theApi;

	this.qualitiesRequired = new Clump(this.attribs.QualitiesRequired || [], api.types.QualityRequirement, this);
	this.qualitiesAffected = new Clump(this.attribs.QualitiesAffected || [], api.types.QualityEffect, this);
	this.interactions = new Clump(this.attribs.ChildBranches|| [], api.types.Interaction, this);

	this.linkToEvent = api.getOrCreate(api.types.Event, this.attribs.LinkToEvent, this);

	this.limitedToArea = api.getOrCreate(api.types.Area, this.attribs.LimitedToArea, this);

	this.setting = api.getOrCreate(api.types.Setting, this.attribs.Setting, this);
	
	Lump.prototype.wireUp.call(this, api);
};

Event.prototype.toString = function(long) {
	return this.constructor.name + " " + (long ? " [" + this.Category + "] " : "") + this.Name + " (#" + this.Id + ")";
};

Event.prototype.toDom = function(size, includeChildren) {

	size = size || "normal";
	includeChildren = includeChildren === false ? false : true;

	var html = "";

	var element =  document.createElement("li");
	element.className = "item "+this.constructor.name.toLowerCase()+"-item "+size;

	if(this.Image !== null && this.Image !== "") {
		html = "<img class='icon' src='"+api.config.locations.imagesPath+"/"+this.Image+"small.png' />";
	}

	html += "\n<h3 class='title'>"+this.Name+"\n"+(this.tag ? "<span class='tag "+this.tag+"'>"+this.tag+"</span>" : "")+"</h3>";

	if(size != "small" && (this.qualitiesRequired || this.qualitiesAffected)) {
		html += "<div class='sidebar'>";
		if(this.qualitiesRequired && this.qualitiesRequired.size()) {
			html += "<h4>Requirements</h4>\n";
			html += this.qualitiesRequired.toDom("small", false, "ul").outerHTML;
		}
		if(this.qualitiesAffected && this.qualitiesAffected.size()) {
			html += "<h4>Effects</h4>\n";
			html += this.qualitiesAffected.toDom("small", false, "ul").outerHTML;
		}
		html += "</div>";
	}
	
	html += "<p class='description'>"+this.Description+"</p>";

	element.innerHTML = html;

	element.title = this.toString(true);

	if(includeChildren) {
		var self = this;
		element.addEventListener("click", function(e) {
			e.stopPropagation();

			var childList = element.querySelector(".child-list");
			if(childList) {
				element.removeChild(childList);
			}
			else {
				var interactions = self.interactions;
				var linkToEvent = self.linkToEvent;
				if(linkToEvent) {
					var wrapperClump = new Clump([linkToEvent], api.types.Event);
					var linkToEvent_element = wrapperClump.toDom("normal", true);

					linkToEvent_element.classList.add("child-list");
					element.appendChild(linkToEvent_element);
				}
				else if(interactions && interactions.size() > 0) {
					var interactions_element = interactions.toDom("normal", true);

					interactions_element.classList.add("child-list");
					element.appendChild(interactions_element);
				}
			}
		});
	}

	return element;
};

module.exports = Event;