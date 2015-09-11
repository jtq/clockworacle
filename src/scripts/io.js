
function readFile(file, callback) {
  var reader = new FileReader();
  reader.onload = callback;
  reader.readAsText(file);
}

module.exports = {
  readFile: readFile
};