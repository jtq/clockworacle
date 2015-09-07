var Lump = require('./lump');
var Clump = require('./clump');

var api;

function CombatAttack(raw, parent) {
	this.straightCopy = [
		'Name',
		'Image',
		'RammingAttack',
		'OnlyWhenExposed',
		'Range',
		'Orientation',
		'Arc',
		'BaseHullDamage',
		'BaseLifeDamage',
		'ExposedQualityDamage',	// Value to add to the exposedQuality: positive increases quality level (eg Terror), negative decreases it (eg Crew)
		'StaggerAmount',
		'BaseWarmUp',
		'Animation',
		'AnimationNumber'
	];
	raw.Id = raw.Name;
	Lump.apply(this, arguments);

	this.qualityRequired = null;
	this.qualityCost = null;
	this.exposedQuality = null;
}

Object.keys(Lump.prototype).forEach(function(member) { CombatAttack.prototype[member] = Lump.prototype[member]; });

CombatAttack.prototype.wireUp = function(theApi) {

	api = theApi;

	this.qualityRequired = api.get(api.types.Quality, this.attribs.QualityRequiredId, this);
	this.qualityCost = api.get(api.types.Quality, this.attribs.QualityCostId, this);
	this.exposedQuality = api.get(api.types.Quality, this.attribs.ExposedQualityId, this);

	Lump.prototype.wireUp.call(this, api);
};

CombatAttack.prototype.toString = function() {
	return this.constructor.name + " " + this.Name + " (#" + this.Id + ")";
};

CombatAttack.prototype.toDom = function(size, includeChildren) {

	size = size || "normal";
	includeChildren = includeChildren === false ? false : true;

	var self = this;
	
	var html = "";

	var element =  document.createElement("li");
	element.className = "item "+this.constructor.name.toLowerCase()+"-item "+size;

	if(this.Image !== null && this.Image !== "") {
		html = "<img class='icon' src='file:///C:/Users/James/AppData/LocalLow/Failbetter Games/Sunless Sea/images/sn/icons/"+this.Image+".png' />";
	}

	html += "\n<h3 class='title'>"+this.Name+"</h3>";

	if(this.qualityRequired || this.qualityCost) {
		html += "<div class='sidebar'>";

		if(this.qualityRequired) {
			html += "<h4>Required</h4>";
			html += (new Clump([this.qualityRequired], api.types.Quality)).toDom("small", false, "ul").outerHTML;
		}
		if(this.qualityCost) {
			html += "<h4>Cost</h4>";
			html += (new Clump([this.qualityCost], api.types.Quality)).toDom("small", false, "ul").outerHTML;
		}
		html += "</div>";
	}

	html += "<dl class='clump-list small'>";
	['Range', 'Arc', 'BaseHullDamage', 'BaseLifeDamage', 'StaggerAmount', 'BaseWarmUp'].forEach(function(key) {
		html += "<dt class='item'>"+key+"</dt><dd class='quantity'>"+self[key]+"</dd>";
	});
	html += "</dl>";

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
					var child_events = wrapperClump.toDom(size, true);

					child_events.classList.add("child-list");
					element.appendChild(child_events);
				}
			}
		});
	}

	return element;
};

module.exports = CombatAttack;