function Quality(raw, parent) {
	this.straightCopy = [
		'Name',
		'Description',
		'Image',

		'Category',
		'Nature',
		'Tag',

		"IsSlot",

		'AllowedOn',
		"AvailableAt",

		'Cap',
		'DifficultyScaler',
		'Enhancements'
	];
	Lump.apply(this, arguments);

	this.States = this.getStates(raw.ChangeDescriptionText);
	this.LevelDescriptionText = this.getStates(raw.LevelDescriptionText);
	this.LevelImageText = this.getStates(raw.LevelImageText);

	this.useEvent = null;
}
Object.keys(Lump.prototype).forEach(function(member) { Quality.prototype[member] = Lump.prototype[member]; });

Quality.prototype.wireUp = function() {

	this.useEvent = this.getOrCreate(Event, this.attribs.UseEvent, this);
	if(this.useEvent) {
		this.useEvent.tag = "use";
	}

	Lump.prototype.wireUp.call(this);
};

Quality.prototype.toString = function(long) {
	return this.constructor.name + " " + (long ? " [" + this.Nature + " > " + this.Category + " > " + this.Tag + "] " : "") + this.Name + " (#" + this.Id + ")";
};

Quality.prototype.toDom = function(size, includeChildren, tag) {

	size = size || "normal";
	includeChildren = includeChildren === false ? false : true;
	tag = tag || "li";

	var html = "";

	var element =  document.createElement(tag);
	element.className = "item "+this.constructor.name.toLowerCase()+"-item "+size;

	html = "\
	<img class='icon' src='file:///C:/Users/James/AppData/LocalLow/Failbetter Games/Sunless Sea/images/sn/icons/"+this.Image+"small.png' />\
	<h3 class='title'>"+this.Name+"</h3>\
	<p class='description'>"+this.Description+"</p>";

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
				if(self.useEvent) {

					var wrapperClump = new Clump([self.useEvent], Event);
					var child_events = wrapperClump.toDom(size, true);

					child_events.classList.add("child-list");
					element.appendChild(child_events);
				}
			}
		});
	}

	return element;
};

exports = Quality;