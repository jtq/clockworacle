function Area(raw) {
	this.straightCopy = ["Name", "Description", "ImageName", "MoveMessage"];
	Lump.call(this, raw);
}
Object.keys(Lump.prototype).forEach(function(member) { Area.prototype[member] = Lump.prototype[member]; });

Area.prototype.toString = function() {
	return this.constructor.name + " " + this.Name + " (#" + this.Id + ")";
};

Area.prototype.toDom = function(size) {

	size = size || "normal";

	var element =  document.createElement("li");
	element.className = "item "+this.constructor.name.toLowerCase()+"-item "+size;

	if(this.ImageName !== null && this.Image !== "") {
		element.innerHTML = "<img class='icon' src='file:///C:/Users/James/AppData/LocalLow/Failbetter Games/Sunless Sea/images/sn/icons/"+this.ImageName+".png' />";
	}

	element.innerHTML += "\
	<h3 class='title'>"+this.Name+"</h3>\
	<p class='description'>"+this.Description+"</p>";

	element.title = this.toString();

	return element;
};

exports = Area;