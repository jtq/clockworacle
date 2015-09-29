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
}
Object.keys(Lump.prototype).forEach(function(member) { Exchange.prototype[member] = Lump.prototype[member]; });

Exchange.prototype.wireUp = function() {

	this.shops = new Clump(this.attribs.Shops || [], Shop, this);
	var self = this;
	this.ports = all.Port.query("SettingId", function(id) {
		return self.SettingIds.indexOf(id) !== -1
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

	html = "\
	<img class='icon' src='file:///C:/Users/James/AppData/LocalLow/Failbetter Games/Sunless Sea/images/sn/icons/"+this.Image+".png' />\
	<h3 class='title'>"+this.Name+"</h3>\
	<p class='description'>"+this.Description+"</p>";

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

exports = Exchange;