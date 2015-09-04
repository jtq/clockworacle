function QualityRequirement(raw, parent) {
	this.straightCopy = ['MinLevel', 'MaxLevel'];
	Lump.apply(this, arguments);

	this.difficultyAdvanced = this.describeAdvancedExpression(raw.DifficultyAdvanced);
	this.minAdvanced = this.describeAdvancedExpression(raw.MinAdvanced);
	this.maxAdvanced = this.describeAdvancedExpression(raw.MaxAdvanced);

	this.associatedQuality = null;
	this.chanceQuality = null;
}
Object.keys(Lump.prototype).forEach(function(member) { QualityRequirement.prototype[member] = Lump.prototype[member]; });

QualityRequirement.prototype.wireUp = function() {

	this.associatedQuality = this.get(Quality, this.attribs.AssociatedQualityId, this);

	this.chanceQuality = this.getChanceCap();

	Lump.prototype.wireUp.call(this);
};

QualityRequirement.prototype.getChanceCap = function() {
	var quality = null;
	if(!this.attribs.DifficultyLevel) {
		return null;
	}
	quality = this.associatedQuality;
	if(!quality) {
		return null;
	}
	
	return Math.round(this.attribs.DifficultyLevel * ((100 + quality.DifficultyScaler + 7)/100));
}

QualityRequirement.prototype.getQuantity = function() {
	var condition = "";

  if(this.difficultyAdvanced !== null) {
  	condition = this.difficultyAdvanced;
  }
  else if(this.minAdvanced !== null) {
  	condition = this.minAdvanced;
  }
  else if(this.maxAdvanced !== null) {
  	condition = this.maxAdvanced;
  }
	else if(this.chanceQuality !== null) {
		condition = this.chanceQuality + " for 100%";
	}
	else if(this.MaxLevel !== null && this.MinLevel !== null) {
		if(this.MaxLevel === this.MinLevel) {
			condition = "= " + this.MinLevel;
		}
		else {
			condition = this.MinLevel + "-" + this.MaxLevel;
		}
	}
	else {
		if(this.MinLevel !== null) {
			condition = "&ge; " + this.MinLevel;
		}
		if(this.MaxLevel !== null) {
			condition = "&le; " + this.MaxLevel;
		}
	}
	return condition;
};

QualityRequirement.prototype.toString = function() {
	var quality = this.associatedQuality;
	return this.constructor.name + " ("+this.Id+") on " + quality + " " + this.getQuantity();
};

QualityRequirement.prototype.toDom = function(size) {

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

exports = QualityRequirement;