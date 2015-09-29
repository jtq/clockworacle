function Availability(raw, parent) {
	this.straightCopy = [
		'Cost',
		'SellPrice'
	];
	Lump.apply(this, arguments);

	this.quality = null;
	this.purchaseQuality = null;
}
Object.keys(Lump.prototype).forEach(function(member) { Availability.prototype[member] = Lump.prototype[member]; });

Availability.prototype.wireUp = function() {

	this.quality = this.getOrCreate(Quality, this.attribs.Quality, this);
	this.purchaseQuality = this.getOrCreate(Quality, this.attribs.PurchaseQuality, this);

	Lump.prototype.wireUp.call(this);
};

Availability.prototype.isAdditive = function() {
	return this.Cost > 0;
};

Availability.prototype.isSubtractive = function() {
	return this.SellPrice > 0;
};

Availability.prototype.toString = function() {
	return this.constructor.name + " " + this.quality + " (buy: " + this.Cost + "x" + this.purchaseQuality.Name + " / sell: " + this.SellPrice + "x" + this.purchaseQuality.Name + ")";
};

Availability.prototype.toDom = function(size) {

	size = size || "small";

	var element = document.createElement("li");
	element.className = "item "+this.constructor.name.toLowerCase()+"-item "+size;
	
	var purchase_quality_element;

	if(!this.quality) {
		purchase_quality_element = document.createElement("span");
		purchase_quality_element.innerHTML = "[INVALID]";
	}
	else {
		purchase_quality_element = this.quality.toDom("small", false, "span");
	}

	var currency_quality_element = this.purchaseQuality.toDom("small", false, "span");
	currency_quality_element.className = "quantity item small";
	var currency_quality_markup = currency_quality_element.outerHTML;

	var currency_buy_amount_element = document.createElement("span");
	currency_buy_amount_element.className = "item quantity";
	currency_buy_amount_element.innerHTML = "Buy: " + (this.Cost ? this.Cost+"x" : "&#10007;");
	currency_buy_amount_element.title = this.toString();

	var currency_sell_amount_element = document.createElement("span");
	currency_sell_amount_element.className = "item quantity";
	currency_sell_amount_element.innerHTML = "Sell: " + (this.SellPrice ? this.SellPrice+"x" : "&#10007;");
	currency_sell_amount_element.title = this.toString();


	element.appendChild(purchase_quality_element);
	element.appendChild(currency_buy_amount_element);
	if(this.Cost) {
		element.appendChild($(currency_quality_markup)[0]);
	}
	element.appendChild(currency_sell_amount_element);
	if(this.SellPrice) {
		element.appendChild($(currency_quality_markup)[0]);
	}

	return element;
};

exports = Availability;