function SpawnedEntity(raw, parent) {
	this.straightCopy = [
		'Name',
		'HumanName',

		'Neutral',
		'PrefabName',
		'DormantBehaviour',
		'AwareBehaviour',

		'Hull',
		'Crew',
		'Life',
		'MovementSpeed',
		'RotationSpeed',
		'BeastieCharacteristicsName',
		'CombatItems',
		'LootPrefabName',
		'GleamValue'
	];
	raw.Id = raw.Name;
	Lump.apply(this, arguments);

	this.pacifyEvent = null;
	this.killQualityEvent = null;
	this.combatAttackNames = [];

	this.image = null;
}
Object.keys(Lump.prototype).forEach(function(member) { SpawnedEntity.prototype[member] = Lump.prototype[member]; });

SpawnedEntity.prototype.wireUp = function() {

	var self = this;
	this.combatAttackNames = (this.attribs.CombatAttackNames || []).map(function(name) {
		return self.get(CombatAttack, name, self);
	}).filter(function(attack) {
		return typeof attack === "object";
	});

	this.pacifyEvent = this.get(Event, this.attribs.PacifyEventId, this);
	if(this.pacifyEvent) {
		this.pacifyEvent.tag = "pacified";
	}

	this.killQualityEvent = this.get(Event, this.attribs.KillQualityEventId, this);
	if(this.killQualityEvent) {
		this.killQualityEvent.tag = "killed";
	}

	this.image = ((this.killQualityEvent && this.killQualityEvent.Image) || (this.pacifyEvent && this.pacifyEvent.Image));

	Lump.prototype.wireUp.call(this);
};

SpawnedEntity.prototype.toString = function() {
	return this.constructor.name + " " + this.HumanName + " (#" + this.Id + ")";
};

SpawnedEntity.prototype.toDom = function(size, includeChildren) {

	size = size || "normal";
	includeChildren = includeChildren === false ? false : true;

	var self = this;

	var html = "";

	var element =  document.createElement("li");
	element.className = "item "+this.constructor.name.toLowerCase()+"-item "+size;

	if(this.Image !== null && this.Image !== "") {
		html = "<img class='icon' src='file:///C:/Users/James/AppData/LocalLow/Failbetter Games/Sunless Sea/images/sn/icons/"+this.image+"small.png' />";
	}

	html += "\n<h3 class='title'>"+this.HumanName+"</h3>";

	if(size !== "small") {
		if(this.qualitiesRequired) {
			html += "<div class='sidebar'>";
			html += this.qualitiesRequired.toDom("small", false, "ul").outerHTML;
			html += "</div>";
		}

		html += "<dl class='clump-list small'>";

		['Hull', 'Crew', 'Life', 'MovementSpeed', 'RotationSpeed'].forEach(function(key) {
			html += "<dt class='item'>"+key+"</dt><dd class='quantity'>"+self[key]+"</dd>";
		});
		html += "</dl>";
	}

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
					var wrapperClump = new Clump(events, Event);
					var child_events = wrapperClump.toDom(size, true);

					child_events.classList.add("child-list");
					element.appendChild(child_events);
				}
			}
		});
	}

	return element;
};

exports = SpawnedEntity;