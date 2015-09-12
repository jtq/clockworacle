
if(typeof FileReader === 'undefined') { // Running in node rather than a browser
  FileReader = require('filereader');
}

function readFile(file, callback) {
  var reader = new FileReader();
  reader.onload = callback;
  reader.readAsText(file);
}

module.exports = {
  readFile: readFile
};