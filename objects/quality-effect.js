function QualityEffect(raw, parent) {
	this.straightCopy = ["Level", "SetToExactly"];
	Lump.apply(this, arguments);

	this.changeByAdvanced = this.describeAdvancedExpression(raw.ChangeByAdvanced);
	this.setToExactlyAdvanced = this.describeAdvancedExpression(raw.SetToExactlyAdvanced);

	this.associatedQuality = null;
}
Object.keys(Lump.prototype).forEach(function(member) { QualityEffect.prototype[member] = Lump.prototype[member]; });

QualityEffect.prototype.wireUp = function() {

	this.associatedQuality = this.get(Quality, this.attribs.AssociatedQualityId, this);

	Lump.prototype.wireUp.call(this);
};

QualityEffect.prototype.getQuantity = function() {
	var condition = "";
	
	if(this.setToExactlyAdvanced !== null) {
		condition = "+(" + this.setToExactlyAdvanced + ")";
	}
	else if(this.SetToExactly !== null) {
		condition = "= " + this.SetToExactly;
	}
	else if(this.changeByAdvanced !== null) {
		condition = "+(" + this.changeByAdvanced + ")";
	}
	else if(this.Level !== null) {
		if(this.Level < 0) {
			condition = this.Level;
		}
		else if(this.Level > 0) {
			condition = "+" + this.Level;
		}
	}
	
	return condition;
};

QualityEffect.prototype.isAdditive = function() {
	return this.setToExactlyAdvanced || this.SetToExactly || this.changeByAdvanced || (this.Level > 0);
};

QualityEffect.prototype.isSubtractive = function() {
	return !this.setToExactlyAdvanced && !this.SetToExactly && !this.changeByAdvanced && (this.Level <= 0);
};

QualityEffect.prototype.toString = function() {
	var quality = this.associatedQuality;
	return this.constructor.name + " ("+this.Id+") on " + quality + this.getQuantity();
};

QualityEffect.prototype.toDom = function(size) {

	size = size || "small";

	var element = document.createElement("li");
	element.className = "item "+this.constructor.name.toLowerCase()+"-item "+size;

	var quality_element = this.associatedQuality;

	if(!quality_element) {
		quality_element = document.createElement("span");
		quality_element.innerHTML = "[INVALID]";
	}
	else {
		quality_element = this.associatedQuality.toDom(size, false, "span");
	}

	var quantity_element = document.createElement("span");
	quantity_element.className = "item quantity";
	quantity_element.innerHTML = this.getQuantity();
	quantity_element.title = this.toString();

	element.appendChild(quality_element);
	element.appendChild(quantity_element);

	return element;
};

exports = QualityEffect;