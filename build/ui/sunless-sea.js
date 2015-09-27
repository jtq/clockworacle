(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
module.exports={
	"title": "Sunless Sea",
	"paths": {
		"templates": "src/templates",
		"builddir": {
			"mod": "build/mod",
			"ui": "build/ui"
		}
	},
	"locations": {
		"imagesPath": "../../game-data/icons"
	},
	"baseGameIds": {
		"quality": 415000,
		"prelimEvent": 500000,
		"buyOracle": 5000010,
		"sellOracle": 500020,
		"event": 500025,
		"acquire": 600000,
		"learn": 700000,
		"suffer": 800000,
		"become": 900000
	}
}
},{}],2:[function(require,module,exports){

},{}],3:[function(require,module,exports){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * @license  MIT
 */

var base64 = require('base64-js')
var ieee754 = require('ieee754')
var isArray = require('is-array')

exports.Buffer = Buffer
exports.SlowBuffer = SlowBuffer
exports.INSPECT_MAX_BYTES = 50
Buffer.poolSize = 8192 // not used by this implementation

var rootParent = {}

/**
 * If `Buffer.TYPED_ARRAY_SUPPORT`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Use Object implementation (most compatible, even IE6)
 *
 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
 * Opera 11.6+, iOS 4.2+.
 *
 * Due to various browser bugs, sometimes the Object implementation will be used even
 * when the browser supports typed arrays.
 *
 * Note:
 *
 *   - Firefox 4-29 lacks support for adding new properties to `Uint8Array` instances,
 *     See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438.
 *
 *   - Safari 5-7 lacks support for changing the `Object.prototype.constructor` property
 *     on objects.
 *
 *   - Chrome 9-10 is missing the `TypedArray.prototype.subarray` function.
 *
 *   - IE10 has a broken `TypedArray.prototype.subarray` function which returns arrays of
 *     incorrect length in some situations.

 * We detect these buggy browsers and set `Buffer.TYPED_ARRAY_SUPPORT` to `false` so they
 * get the Object implementation, which is slower but behaves correctly.
 */
Buffer.TYPED_ARRAY_SUPPORT = (function () {
  function Bar () {}
  try {
    var arr = new Uint8Array(1)
    arr.foo = function () { return 42 }
    arr.constructor = Bar
    return arr.foo() === 42 && // typed array instances can be augmented
        arr.constructor === Bar && // constructor can be set
        typeof arr.subarray === 'function' && // chrome 9-10 lack `subarray`
        arr.subarray(1, 1).byteLength === 0 // ie10 has broken `subarray`
  } catch (e) {
    return false
  }
})()

function kMaxLength () {
  return Buffer.TYPED_ARRAY_SUPPORT
    ? 0x7fffffff
    : 0x3fffffff
}

/**
 * Class: Buffer
 * =============
 *
 * The Buffer constructor returns instances of `Uint8Array` that are augmented
 * with function properties for all the node `Buffer` API functions. We use
 * `Uint8Array` so that square bracket notation works as expected -- it returns
 * a single octet.
 *
 * By augmenting the instances, we can avoid modifying the `Uint8Array`
 * prototype.
 */
function Buffer (arg) {
  if (!(this instanceof Buffer)) {
    // Avoid going through an ArgumentsAdaptorTrampoline in the common case.
    if (arguments.length > 1) return new Buffer(arg, arguments[1])
    return new Buffer(arg)
  }

  this.length = 0
  this.parent = undefined

  // Common case.
  if (typeof arg === 'number') {
    return fromNumber(this, arg)
  }

  // Slightly less common case.
  if (typeof arg === 'string') {
    return fromString(this, arg, arguments.length > 1 ? arguments[1] : 'utf8')
  }

  // Unusual.
  return fromObject(this, arg)
}

function fromNumber (that, length) {
  that = allocate(that, length < 0 ? 0 : checked(length) | 0)
  if (!Buffer.TYPED_ARRAY_SUPPORT) {
    for (var i = 0; i < length; i++) {
      that[i] = 0
    }
  }
  return that
}

function fromString (that, string, encoding) {
  if (typeof encoding !== 'string' || encoding === '') encoding = 'utf8'

  // Assumption: byteLength() return value is always < kMaxLength.
  var length = byteLength(string, encoding) | 0
  that = allocate(that, length)

  that.write(string, encoding)
  return that
}

function fromObject (that, object) {
  if (Buffer.isBuffer(object)) return fromBuffer(that, object)

  if (isArray(object)) return fromArray(that, object)

  if (object == null) {
    throw new TypeError('must start with number, buffer, array or string')
  }

  if (typeof ArrayBuffer !== 'undefined') {
    if (object.buffer instanceof ArrayBuffer) {
      return fromTypedArray(that, object)
    }
    if (object instanceof ArrayBuffer) {
      return fromArrayBuffer(that, object)
    }
  }

  if (object.length) return fromArrayLike(that, object)

  return fromJsonObject(that, object)
}

function fromBuffer (that, buffer) {
  var length = checked(buffer.length) | 0
  that = allocate(that, length)
  buffer.copy(that, 0, 0, length)
  return that
}

function fromArray (that, array) {
  var length = checked(array.length) | 0
  that = allocate(that, length)
  for (var i = 0; i < length; i += 1) {
    that[i] = array[i] & 255
  }
  return that
}

// Duplicate of fromArray() to keep fromArray() monomorphic.
function fromTypedArray (that, array) {
  var length = checked(array.length) | 0
  that = allocate(that, length)
  // Truncating the elements is probably not what people expect from typed
  // arrays with BYTES_PER_ELEMENT > 1 but it's compatible with the behavior
  // of the old Buffer constructor.
  for (var i = 0; i < length; i += 1) {
    that[i] = array[i] & 255
  }
  return that
}

function fromArrayBuffer (that, array) {
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    // Return an augmented `Uint8Array` instance, for best performance
    array.byteLength
    that = Buffer._augment(new Uint8Array(array))
  } else {
    // Fallback: Return an object instance of the Buffer class
    that = fromTypedArray(that, new Uint8Array(array))
  }
  return that
}

function fromArrayLike (that, array) {
  var length = checked(array.length) | 0
  that = allocate(that, length)
  for (var i = 0; i < length; i += 1) {
    that[i] = array[i] & 255
  }
  return that
}

// Deserialize { type: 'Buffer', data: [1,2,3,...] } into a Buffer object.
// Returns a zero-length buffer for inputs that don't conform to the spec.
function fromJsonObject (that, object) {
  var array
  var length = 0

  if (object.type === 'Buffer' && isArray(object.data)) {
    array = object.data
    length = checked(array.length) | 0
  }
  that = allocate(that, length)

  for (var i = 0; i < length; i += 1) {
    that[i] = array[i] & 255
  }
  return that
}

function allocate (that, length) {
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    // Return an augmented `Uint8Array` instance, for best performance
    that = Buffer._augment(new Uint8Array(length))
  } else {
    // Fallback: Return an object instance of the Buffer class
    that.length = length
    that._isBuffer = true
  }

  var fromPool = length !== 0 && length <= Buffer.poolSize >>> 1
  if (fromPool) that.parent = rootParent

  return that
}

function checked (length) {
  // Note: cannot use `length < kMaxLength` here because that fails when
  // length is NaN (which is otherwise coerced to zero.)
  if (length >= kMaxLength()) {
    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
                         'size: 0x' + kMaxLength().toString(16) + ' bytes')
  }
  return length | 0
}

function SlowBuffer (subject, encoding) {
  if (!(this instanceof SlowBuffer)) return new SlowBuffer(subject, encoding)

  var buf = new Buffer(subject, encoding)
  delete buf.parent
  return buf
}

Buffer.isBuffer = function isBuffer (b) {
  return !!(b != null && b._isBuffer)
}

Buffer.compare = function compare (a, b) {
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
    throw new TypeError('Arguments must be Buffers')
  }

  if (a === b) return 0

  var x = a.length
  var y = b.length

  var i = 0
  var len = Math.min(x, y)
  while (i < len) {
    if (a[i] !== b[i]) break

    ++i
  }

  if (i !== len) {
    x = a[i]
    y = b[i]
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

Buffer.isEncoding = function isEncoding (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'binary':
    case 'base64':
    case 'raw':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.concat = function concat (list, length) {
  if (!isArray(list)) throw new TypeError('list argument must be an Array of Buffers.')

  if (list.length === 0) {
    return new Buffer(0)
  }

  var i
  if (length === undefined) {
    length = 0
    for (i = 0; i < list.length; i++) {
      length += list[i].length
    }
  }

  var buf = new Buffer(length)
  var pos = 0
  for (i = 0; i < list.length; i++) {
    var item = list[i]
    item.copy(buf, pos)
    pos += item.length
  }
  return buf
}

function byteLength (string, encoding) {
  if (typeof string !== 'string') string = '' + string

  var len = string.length
  if (len === 0) return 0

  // Use a for loop to avoid recursion
  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'ascii':
      case 'binary':
      // Deprecated
      case 'raw':
      case 'raws':
        return len
      case 'utf8':
      case 'utf-8':
        return utf8ToBytes(string).length
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return len * 2
      case 'hex':
        return len >>> 1
      case 'base64':
        return base64ToBytes(string).length
      default:
        if (loweredCase) return utf8ToBytes(string).length // assume utf8
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}
Buffer.byteLength = byteLength

// pre-set for values that may exist in the future
Buffer.prototype.length = undefined
Buffer.prototype.parent = undefined

function slowToString (encoding, start, end) {
  var loweredCase = false

  start = start | 0
  end = end === undefined || end === Infinity ? this.length : end | 0

  if (!encoding) encoding = 'utf8'
  if (start < 0) start = 0
  if (end > this.length) end = this.length
  if (end <= start) return ''

  while (true) {
    switch (encoding) {
      case 'hex':
        return hexSlice(this, start, end)

      case 'utf8':
      case 'utf-8':
        return utf8Slice(this, start, end)

      case 'ascii':
        return asciiSlice(this, start, end)

      case 'binary':
        return binarySlice(this, start, end)

      case 'base64':
        return base64Slice(this, start, end)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return utf16leSlice(this, start, end)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = (encoding + '').toLowerCase()
        loweredCase = true
    }
  }
}

Buffer.prototype.toString = function toString () {
  var length = this.length | 0
  if (length === 0) return ''
  if (arguments.length === 0) return utf8Slice(this, 0, length)
  return slowToString.apply(this, arguments)
}

Buffer.prototype.equals = function equals (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  if (this === b) return true
  return Buffer.compare(this, b) === 0
}

Buffer.prototype.inspect = function inspect () {
  var str = ''
  var max = exports.INSPECT_MAX_BYTES
  if (this.length > 0) {
    str = this.toString('hex', 0, max).match(/.{2}/g).join(' ')
    if (this.length > max) str += ' ... '
  }
  return '<Buffer ' + str + '>'
}

Buffer.prototype.compare = function compare (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  if (this === b) return 0
  return Buffer.compare(this, b)
}

Buffer.prototype.indexOf = function indexOf (val, byteOffset) {
  if (byteOffset > 0x7fffffff) byteOffset = 0x7fffffff
  else if (byteOffset < -0x80000000) byteOffset = -0x80000000
  byteOffset >>= 0

  if (this.length === 0) return -1
  if (byteOffset >= this.length) return -1

  // Negative offsets start from the end of the buffer
  if (byteOffset < 0) byteOffset = Math.max(this.length + byteOffset, 0)

  if (typeof val === 'string') {
    if (val.length === 0) return -1 // special case: looking for empty string always fails
    return String.prototype.indexOf.call(this, val, byteOffset)
  }
  if (Buffer.isBuffer(val)) {
    return arrayIndexOf(this, val, byteOffset)
  }
  if (typeof val === 'number') {
    if (Buffer.TYPED_ARRAY_SUPPORT && Uint8Array.prototype.indexOf === 'function') {
      return Uint8Array.prototype.indexOf.call(this, val, byteOffset)
    }
    return arrayIndexOf(this, [ val ], byteOffset)
  }

  function arrayIndexOf (arr, val, byteOffset) {
    var foundIndex = -1
    for (var i = 0; byteOffset + i < arr.length; i++) {
      if (arr[byteOffset + i] === val[foundIndex === -1 ? 0 : i - foundIndex]) {
        if (foundIndex === -1) foundIndex = i
        if (i - foundIndex + 1 === val.length) return byteOffset + foundIndex
      } else {
        foundIndex = -1
      }
    }
    return -1
  }

  throw new TypeError('val must be string, number or Buffer')
}

// `get` is deprecated
Buffer.prototype.get = function get (offset) {
  console.log('.get() is deprecated. Access using array indexes instead.')
  return this.readUInt8(offset)
}

// `set` is deprecated
Buffer.prototype.set = function set (v, offset) {
  console.log('.set() is deprecated. Access using array indexes instead.')
  return this.writeUInt8(v, offset)
}

function hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  // must be an even number of digits
  var strLen = string.length
  if (strLen % 2 !== 0) throw new Error('Invalid hex string')

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; i++) {
    var parsed = parseInt(string.substr(i * 2, 2), 16)
    if (isNaN(parsed)) throw new Error('Invalid hex string')
    buf[offset + i] = parsed
  }
  return i
}

function utf8Write (buf, string, offset, length) {
  return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
}

function asciiWrite (buf, string, offset, length) {
  return blitBuffer(asciiToBytes(string), buf, offset, length)
}

function binaryWrite (buf, string, offset, length) {
  return asciiWrite(buf, string, offset, length)
}

function base64Write (buf, string, offset, length) {
  return blitBuffer(base64ToBytes(string), buf, offset, length)
}

function ucs2Write (buf, string, offset, length) {
  return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
}

Buffer.prototype.write = function write (string, offset, length, encoding) {
  // Buffer#write(string)
  if (offset === undefined) {
    encoding = 'utf8'
    length = this.length
    offset = 0
  // Buffer#write(string, encoding)
  } else if (length === undefined && typeof offset === 'string') {
    encoding = offset
    length = this.length
    offset = 0
  // Buffer#write(string, offset[, length][, encoding])
  } else if (isFinite(offset)) {
    offset = offset | 0
    if (isFinite(length)) {
      length = length | 0
      if (encoding === undefined) encoding = 'utf8'
    } else {
      encoding = length
      length = undefined
    }
  // legacy write(string, encoding, offset, length) - remove in v0.13
  } else {
    var swap = encoding
    encoding = offset
    offset = length | 0
    length = swap
  }

  var remaining = this.length - offset
  if (length === undefined || length > remaining) length = remaining

  if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
    throw new RangeError('attempt to write outside buffer bounds')
  }

  if (!encoding) encoding = 'utf8'

  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'hex':
        return hexWrite(this, string, offset, length)

      case 'utf8':
      case 'utf-8':
        return utf8Write(this, string, offset, length)

      case 'ascii':
        return asciiWrite(this, string, offset, length)

      case 'binary':
        return binaryWrite(this, string, offset, length)

      case 'base64':
        // Warning: maxLength not taken into account in base64Write
        return base64Write(this, string, offset, length)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return ucs2Write(this, string, offset, length)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}

Buffer.prototype.toJSON = function toJSON () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

function base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice (buf, start, end) {
  end = Math.min(buf.length, end)
  var res = []

  var i = start
  while (i < end) {
    var firstByte = buf[i]
    var codePoint = null
    var bytesPerSequence = (firstByte > 0xEF) ? 4
      : (firstByte > 0xDF) ? 3
      : (firstByte > 0xBF) ? 2
      : 1

    if (i + bytesPerSequence <= end) {
      var secondByte, thirdByte, fourthByte, tempCodePoint

      switch (bytesPerSequence) {
        case 1:
          if (firstByte < 0x80) {
            codePoint = firstByte
          }
          break
        case 2:
          secondByte = buf[i + 1]
          if ((secondByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F)
            if (tempCodePoint > 0x7F) {
              codePoint = tempCodePoint
            }
          }
          break
        case 3:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F)
            if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
              codePoint = tempCodePoint
            }
          }
          break
        case 4:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          fourthByte = buf[i + 3]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F)
            if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
              codePoint = tempCodePoint
            }
          }
      }
    }

    if (codePoint === null) {
      // we did not generate a valid codePoint so insert a
      // replacement char (U+FFFD) and advance only 1 byte
      codePoint = 0xFFFD
      bytesPerSequence = 1
    } else if (codePoint > 0xFFFF) {
      // encode to utf16 (surrogate pair dance)
      codePoint -= 0x10000
      res.push(codePoint >>> 10 & 0x3FF | 0xD800)
      codePoint = 0xDC00 | codePoint & 0x3FF
    }

    res.push(codePoint)
    i += bytesPerSequence
  }

  return decodeCodePointsArray(res)
}

// Based on http://stackoverflow.com/a/22747272/680742, the browser with
// the lowest limit is Chrome, with 0x10000 args.
// We go 1 magnitude less, for safety
var MAX_ARGUMENTS_LENGTH = 0x1000

function decodeCodePointsArray (codePoints) {
  var len = codePoints.length
  if (len <= MAX_ARGUMENTS_LENGTH) {
    return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
  }

  // Decode in chunks to avoid "call stack size exceeded".
  var res = ''
  var i = 0
  while (i < len) {
    res += String.fromCharCode.apply(
      String,
      codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
    )
  }
  return res
}

function asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    ret += String.fromCharCode(buf[i] & 0x7F)
  }
  return ret
}

function binarySlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    ret += String.fromCharCode(buf[i])
  }
  return ret
}

function hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; i++) {
    out += toHex(buf[i])
  }
  return out
}

function utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256)
  }
  return res
}

Buffer.prototype.slice = function slice (start, end) {
  var len = this.length
  start = ~~start
  end = end === undefined ? len : ~~end

  if (start < 0) {
    start += len
    if (start < 0) start = 0
  } else if (start > len) {
    start = len
  }

  if (end < 0) {
    end += len
    if (end < 0) end = 0
  } else if (end > len) {
    end = len
  }

  if (end < start) end = start

  var newBuf
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    newBuf = Buffer._augment(this.subarray(start, end))
  } else {
    var sliceLen = end - start
    newBuf = new Buffer(sliceLen, undefined)
    for (var i = 0; i < sliceLen; i++) {
      newBuf[i] = this[i + start]
    }
  }

  if (newBuf.length) newBuf.parent = this.parent || this

  return newBuf
}

/*
 * Need to make sure that buffer isn't trying to write out of bounds.
 */
function checkOffset (offset, ext, length) {
  if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
  if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
}

Buffer.prototype.readUIntLE = function readUIntLE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }

  return val
}

Buffer.prototype.readUIntBE = function readUIntBE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) {
    checkOffset(offset, byteLength, this.length)
  }

  var val = this[offset + --byteLength]
  var mul = 1
  while (byteLength > 0 && (mul *= 0x100)) {
    val += this[offset + --byteLength] * mul
  }

  return val
}

Buffer.prototype.readUInt8 = function readUInt8 (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 1, this.length)
  return this[offset]
}

Buffer.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  return this[offset] | (this[offset + 1] << 8)
}

Buffer.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  return (this[offset] << 8) | this[offset + 1]
}

Buffer.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return ((this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16)) +
      (this[offset + 3] * 0x1000000)
}

Buffer.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] * 0x1000000) +
    ((this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    this[offset + 3])
}

Buffer.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readIntBE = function readIntBE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var i = byteLength
  var mul = 1
  var val = this[offset + --i]
  while (i > 0 && (mul *= 0x100)) {
    val += this[offset + --i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readInt8 = function readInt8 (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 1, this.length)
  if (!(this[offset] & 0x80)) return (this[offset])
  return ((0xff - this[offset] + 1) * -1)
}

Buffer.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset] | (this[offset + 1] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset + 1] | (this[offset] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset]) |
    (this[offset + 1] << 8) |
    (this[offset + 2] << 16) |
    (this[offset + 3] << 24)
}

Buffer.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] << 24) |
    (this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    (this[offset + 3])
}

Buffer.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, true, 23, 4)
}

Buffer.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, false, 23, 4)
}

Buffer.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, true, 52, 8)
}

Buffer.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, false, 52, 8)
}

function checkInt (buf, value, offset, ext, max, min) {
  if (!Buffer.isBuffer(buf)) throw new TypeError('buffer must be a Buffer instance')
  if (value > max || value < min) throw new RangeError('value is out of bounds')
  if (offset + ext > buf.length) throw new RangeError('index out of range')
}

Buffer.prototype.writeUIntLE = function writeUIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkInt(this, value, offset, byteLength, Math.pow(2, 8 * byteLength), 0)

  var mul = 1
  var i = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUIntBE = function writeUIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkInt(this, value, offset, byteLength, Math.pow(2, 8 * byteLength), 0)

  var i = byteLength - 1
  var mul = 1
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUInt8 = function writeUInt8 (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0)
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  this[offset] = value
  return offset + 1
}

function objectWriteUInt16 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 2); i < j; i++) {
    buf[offset + i] = (value & (0xff << (8 * (littleEndian ? i : 1 - i)))) >>>
      (littleEndian ? i : 1 - i) * 8
  }
}

Buffer.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = value
    this[offset + 1] = (value >>> 8)
  } else {
    objectWriteUInt16(this, value, offset, true)
  }
  return offset + 2
}

Buffer.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8)
    this[offset + 1] = value
  } else {
    objectWriteUInt16(this, value, offset, false)
  }
  return offset + 2
}

function objectWriteUInt32 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffffffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 4); i < j; i++) {
    buf[offset + i] = (value >>> (littleEndian ? i : 3 - i) * 8) & 0xff
  }
}

Buffer.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset + 3] = (value >>> 24)
    this[offset + 2] = (value >>> 16)
    this[offset + 1] = (value >>> 8)
    this[offset] = value
  } else {
    objectWriteUInt32(this, value, offset, true)
  }
  return offset + 4
}

Buffer.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = value
  } else {
    objectWriteUInt32(this, value, offset, false)
  }
  return offset + 4
}

Buffer.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) {
    var limit = Math.pow(2, 8 * byteLength - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = 0
  var mul = 1
  var sub = value < 0 ? 1 : 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeIntBE = function writeIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) {
    var limit = Math.pow(2, 8 * byteLength - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = byteLength - 1
  var mul = 1
  var sub = value < 0 ? 1 : 0
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeInt8 = function writeInt8 (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80)
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  if (value < 0) value = 0xff + value + 1
  this[offset] = value
  return offset + 1
}

Buffer.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = value
    this[offset + 1] = (value >>> 8)
  } else {
    objectWriteUInt16(this, value, offset, true)
  }
  return offset + 2
}

Buffer.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8)
    this[offset + 1] = value
  } else {
    objectWriteUInt16(this, value, offset, false)
  }
  return offset + 2
}

Buffer.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = value
    this[offset + 1] = (value >>> 8)
    this[offset + 2] = (value >>> 16)
    this[offset + 3] = (value >>> 24)
  } else {
    objectWriteUInt32(this, value, offset, true)
  }
  return offset + 4
}

Buffer.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (value < 0) value = 0xffffffff + value + 1
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = value
  } else {
    objectWriteUInt32(this, value, offset, false)
  }
  return offset + 4
}

function checkIEEE754 (buf, value, offset, ext, max, min) {
  if (value > max || value < min) throw new RangeError('value is out of bounds')
  if (offset + ext > buf.length) throw new RangeError('index out of range')
  if (offset < 0) throw new RangeError('index out of range')
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38)
  }
  ieee754.write(buf, value, offset, littleEndian, 23, 4)
  return offset + 4
}

Buffer.prototype.writeFloatLE = function writeFloatLE (value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function writeFloatBE (value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert)
}

function writeDouble (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308)
  }
  ieee754.write(buf, value, offset, littleEndian, 52, 8)
  return offset + 8
}

Buffer.prototype.writeDoubleLE = function writeDoubleLE (value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function writeDoubleBE (value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert)
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function copy (target, targetStart, start, end) {
  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (targetStart >= target.length) targetStart = target.length
  if (!targetStart) targetStart = 0
  if (end > 0 && end < start) end = start

  // Copy 0 bytes; we're done
  if (end === start) return 0
  if (target.length === 0 || this.length === 0) return 0

  // Fatal error conditions
  if (targetStart < 0) {
    throw new RangeError('targetStart out of bounds')
  }
  if (start < 0 || start >= this.length) throw new RangeError('sourceStart out of bounds')
  if (end < 0) throw new RangeError('sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length) end = this.length
  if (target.length - targetStart < end - start) {
    end = target.length - targetStart + start
  }

  var len = end - start
  var i

  if (this === target && start < targetStart && targetStart < end) {
    // descending copy from end
    for (i = len - 1; i >= 0; i--) {
      target[i + targetStart] = this[i + start]
    }
  } else if (len < 1000 || !Buffer.TYPED_ARRAY_SUPPORT) {
    // ascending copy from start
    for (i = 0; i < len; i++) {
      target[i + targetStart] = this[i + start]
    }
  } else {
    target._set(this.subarray(start, start + len), targetStart)
  }

  return len
}

// fill(value, start=0, end=buffer.length)
Buffer.prototype.fill = function fill (value, start, end) {
  if (!value) value = 0
  if (!start) start = 0
  if (!end) end = this.length

  if (end < start) throw new RangeError('end < start')

  // Fill 0 bytes; we're done
  if (end === start) return
  if (this.length === 0) return

  if (start < 0 || start >= this.length) throw new RangeError('start out of bounds')
  if (end < 0 || end > this.length) throw new RangeError('end out of bounds')

  var i
  if (typeof value === 'number') {
    for (i = start; i < end; i++) {
      this[i] = value
    }
  } else {
    var bytes = utf8ToBytes(value.toString())
    var len = bytes.length
    for (i = start; i < end; i++) {
      this[i] = bytes[i % len]
    }
  }

  return this
}

/**
 * Creates a new `ArrayBuffer` with the *copied* memory of the buffer instance.
 * Added in Node 0.12. Only available in browsers that support ArrayBuffer.
 */
Buffer.prototype.toArrayBuffer = function toArrayBuffer () {
  if (typeof Uint8Array !== 'undefined') {
    if (Buffer.TYPED_ARRAY_SUPPORT) {
      return (new Buffer(this)).buffer
    } else {
      var buf = new Uint8Array(this.length)
      for (var i = 0, len = buf.length; i < len; i += 1) {
        buf[i] = this[i]
      }
      return buf.buffer
    }
  } else {
    throw new TypeError('Buffer.toArrayBuffer not supported in this browser')
  }
}

// HELPER FUNCTIONS
// ================

var BP = Buffer.prototype

/**
 * Augment a Uint8Array *instance* (not the Uint8Array class!) with Buffer methods
 */
Buffer._augment = function _augment (arr) {
  arr.constructor = Buffer
  arr._isBuffer = true

  // save reference to original Uint8Array set method before overwriting
  arr._set = arr.set

  // deprecated
  arr.get = BP.get
  arr.set = BP.set

  arr.write = BP.write
  arr.toString = BP.toString
  arr.toLocaleString = BP.toString
  arr.toJSON = BP.toJSON
  arr.equals = BP.equals
  arr.compare = BP.compare
  arr.indexOf = BP.indexOf
  arr.copy = BP.copy
  arr.slice = BP.slice
  arr.readUIntLE = BP.readUIntLE
  arr.readUIntBE = BP.readUIntBE
  arr.readUInt8 = BP.readUInt8
  arr.readUInt16LE = BP.readUInt16LE
  arr.readUInt16BE = BP.readUInt16BE
  arr.readUInt32LE = BP.readUInt32LE
  arr.readUInt32BE = BP.readUInt32BE
  arr.readIntLE = BP.readIntLE
  arr.readIntBE = BP.readIntBE
  arr.readInt8 = BP.readInt8
  arr.readInt16LE = BP.readInt16LE
  arr.readInt16BE = BP.readInt16BE
  arr.readInt32LE = BP.readInt32LE
  arr.readInt32BE = BP.readInt32BE
  arr.readFloatLE = BP.readFloatLE
  arr.readFloatBE = BP.readFloatBE
  arr.readDoubleLE = BP.readDoubleLE
  arr.readDoubleBE = BP.readDoubleBE
  arr.writeUInt8 = BP.writeUInt8
  arr.writeUIntLE = BP.writeUIntLE
  arr.writeUIntBE = BP.writeUIntBE
  arr.writeUInt16LE = BP.writeUInt16LE
  arr.writeUInt16BE = BP.writeUInt16BE
  arr.writeUInt32LE = BP.writeUInt32LE
  arr.writeUInt32BE = BP.writeUInt32BE
  arr.writeIntLE = BP.writeIntLE
  arr.writeIntBE = BP.writeIntBE
  arr.writeInt8 = BP.writeInt8
  arr.writeInt16LE = BP.writeInt16LE
  arr.writeInt16BE = BP.writeInt16BE
  arr.writeInt32LE = BP.writeInt32LE
  arr.writeInt32BE = BP.writeInt32BE
  arr.writeFloatLE = BP.writeFloatLE
  arr.writeFloatBE = BP.writeFloatBE
  arr.writeDoubleLE = BP.writeDoubleLE
  arr.writeDoubleBE = BP.writeDoubleBE
  arr.fill = BP.fill
  arr.inspect = BP.inspect
  arr.toArrayBuffer = BP.toArrayBuffer

  return arr
}

var INVALID_BASE64_RE = /[^+\/0-9A-Za-z-_]/g

function base64clean (str) {
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = stringtrim(str).replace(INVALID_BASE64_RE, '')
  // Node converts strings with length < 2 to ''
  if (str.length < 2) return ''
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '='
  }
  return str
}

function stringtrim (str) {
  if (str.trim) return str.trim()
  return str.replace(/^\s+|\s+$/g, '')
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (string, units) {
  units = units || Infinity
  var codePoint
  var length = string.length
  var leadSurrogate = null
  var bytes = []

  for (var i = 0; i < length; i++) {
    codePoint = string.charCodeAt(i)

    // is surrogate component
    if (codePoint > 0xD7FF && codePoint < 0xE000) {
      // last char was a lead
      if (!leadSurrogate) {
        // no lead yet
        if (codePoint > 0xDBFF) {
          // unexpected trail
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        } else if (i + 1 === length) {
          // unpaired lead
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        }

        // valid lead
        leadSurrogate = codePoint

        continue
      }

      // 2 leads in a row
      if (codePoint < 0xDC00) {
        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
        leadSurrogate = codePoint
        continue
      }

      // valid surrogate pair
      codePoint = leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00 | 0x10000
    } else if (leadSurrogate) {
      // valid bmp char, but last char was a lead
      if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
    }

    leadSurrogate = null

    // encode utf8
    if (codePoint < 0x80) {
      if ((units -= 1) < 0) break
      bytes.push(codePoint)
    } else if (codePoint < 0x800) {
      if ((units -= 2) < 0) break
      bytes.push(
        codePoint >> 0x6 | 0xC0,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x10000) {
      if ((units -= 3) < 0) break
      bytes.push(
        codePoint >> 0xC | 0xE0,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x110000) {
      if ((units -= 4) < 0) break
      bytes.push(
        codePoint >> 0x12 | 0xF0,
        codePoint >> 0xC & 0x3F | 0x80,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else {
      throw new Error('Invalid code point')
    }
  }

  return bytes
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str, units) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    if ((units -= 2) < 0) break

    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(base64clean(str))
}

function blitBuffer (src, dst, offset, length) {
  for (var i = 0; i < length; i++) {
    if ((i + offset >= dst.length) || (i >= src.length)) break
    dst[i + offset] = src[i]
  }
  return i
}

},{"base64-js":4,"ieee754":5,"is-array":6}],4:[function(require,module,exports){
var lookup = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

;(function (exports) {
	'use strict';

  var Arr = (typeof Uint8Array !== 'undefined')
    ? Uint8Array
    : Array

	var PLUS   = '+'.charCodeAt(0)
	var SLASH  = '/'.charCodeAt(0)
	var NUMBER = '0'.charCodeAt(0)
	var LOWER  = 'a'.charCodeAt(0)
	var UPPER  = 'A'.charCodeAt(0)
	var PLUS_URL_SAFE = '-'.charCodeAt(0)
	var SLASH_URL_SAFE = '_'.charCodeAt(0)

	function decode (elt) {
		var code = elt.charCodeAt(0)
		if (code === PLUS ||
		    code === PLUS_URL_SAFE)
			return 62 // '+'
		if (code === SLASH ||
		    code === SLASH_URL_SAFE)
			return 63 // '/'
		if (code < NUMBER)
			return -1 //no match
		if (code < NUMBER + 10)
			return code - NUMBER + 26 + 26
		if (code < UPPER + 26)
			return code - UPPER
		if (code < LOWER + 26)
			return code - LOWER + 26
	}

	function b64ToByteArray (b64) {
		var i, j, l, tmp, placeHolders, arr

		if (b64.length % 4 > 0) {
			throw new Error('Invalid string. Length must be a multiple of 4')
		}

		// the number of equal signs (place holders)
		// if there are two placeholders, than the two characters before it
		// represent one byte
		// if there is only one, then the three characters before it represent 2 bytes
		// this is just a cheap hack to not do indexOf twice
		var len = b64.length
		placeHolders = '=' === b64.charAt(len - 2) ? 2 : '=' === b64.charAt(len - 1) ? 1 : 0

		// base64 is 4/3 + up to two characters of the original data
		arr = new Arr(b64.length * 3 / 4 - placeHolders)

		// if there are placeholders, only get up to the last complete 4 chars
		l = placeHolders > 0 ? b64.length - 4 : b64.length

		var L = 0

		function push (v) {
			arr[L++] = v
		}

		for (i = 0, j = 0; i < l; i += 4, j += 3) {
			tmp = (decode(b64.charAt(i)) << 18) | (decode(b64.charAt(i + 1)) << 12) | (decode(b64.charAt(i + 2)) << 6) | decode(b64.charAt(i + 3))
			push((tmp & 0xFF0000) >> 16)
			push((tmp & 0xFF00) >> 8)
			push(tmp & 0xFF)
		}

		if (placeHolders === 2) {
			tmp = (decode(b64.charAt(i)) << 2) | (decode(b64.charAt(i + 1)) >> 4)
			push(tmp & 0xFF)
		} else if (placeHolders === 1) {
			tmp = (decode(b64.charAt(i)) << 10) | (decode(b64.charAt(i + 1)) << 4) | (decode(b64.charAt(i + 2)) >> 2)
			push((tmp >> 8) & 0xFF)
			push(tmp & 0xFF)
		}

		return arr
	}

	function uint8ToBase64 (uint8) {
		var i,
			extraBytes = uint8.length % 3, // if we have 1 byte left, pad 2 bytes
			output = "",
			temp, length

		function encode (num) {
			return lookup.charAt(num)
		}

		function tripletToBase64 (num) {
			return encode(num >> 18 & 0x3F) + encode(num >> 12 & 0x3F) + encode(num >> 6 & 0x3F) + encode(num & 0x3F)
		}

		// go through the array every three bytes, we'll deal with trailing stuff later
		for (i = 0, length = uint8.length - extraBytes; i < length; i += 3) {
			temp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2])
			output += tripletToBase64(temp)
		}

		// pad the end with zeros, but make sure to not forget the extra bytes
		switch (extraBytes) {
			case 1:
				temp = uint8[uint8.length - 1]
				output += encode(temp >> 2)
				output += encode((temp << 4) & 0x3F)
				output += '=='
				break
			case 2:
				temp = (uint8[uint8.length - 2] << 8) + (uint8[uint8.length - 1])
				output += encode(temp >> 10)
				output += encode((temp >> 4) & 0x3F)
				output += encode((temp << 2) & 0x3F)
				output += '='
				break
		}

		return output
	}

	exports.toByteArray = b64ToByteArray
	exports.fromByteArray = uint8ToBase64
}(typeof exports === 'undefined' ? (this.base64js = {}) : exports))

},{}],5:[function(require,module,exports){
exports.read = function (buffer, offset, isLE, mLen, nBytes) {
  var e, m
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var nBits = -7
  var i = isLE ? (nBytes - 1) : 0
  var d = isLE ? -1 : 1
  var s = buffer[offset + i]

  i += d

  e = s & ((1 << (-nBits)) - 1)
  s >>= (-nBits)
  nBits += eLen
  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  m = e & ((1 << (-nBits)) - 1)
  e >>= (-nBits)
  nBits += mLen
  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  if (e === 0) {
    e = 1 - eBias
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity)
  } else {
    m = m + Math.pow(2, mLen)
    e = e - eBias
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
}

exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0)
  var i = isLE ? 0 : (nBytes - 1)
  var d = isLE ? 1 : -1
  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0

  value = Math.abs(value)

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0
    e = eMax
  } else {
    e = Math.floor(Math.log(value) / Math.LN2)
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--
      c *= 2
    }
    if (e + eBias >= 1) {
      value += rt / c
    } else {
      value += rt * Math.pow(2, 1 - eBias)
    }
    if (value * c >= 2) {
      e++
      c /= 2
    }

    if (e + eBias >= eMax) {
      m = 0
      e = eMax
    } else if (e + eBias >= 1) {
      m = (value * c - 1) * Math.pow(2, mLen)
      e = e + eBias
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen)
      e = 0
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

  e = (e << mLen) | m
  eLen += mLen
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

  buffer[offset + i - d] |= s * 128
}

},{}],6:[function(require,module,exports){

/**
 * isArray
 */

var isArray = Array.isArray;

/**
 * toString
 */

var str = Object.prototype.toString;

/**
 * Whether or not the given `val`
 * is an array.
 *
 * example:
 *
 *        isArray([]);
 *        // > true
 *        isArray(arguments);
 *        // > false
 *        isArray('');
 *        // > false
 *
 * @param {mixed} val
 * @return {bool}
 */

module.exports = isArray || function (val) {
  return !! val && '[object Array]' == str.call(val);
};

},{}],7:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      }
      throw TypeError('Uncaught, unspecified "error" event.');
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        len = arguments.length;
        args = new Array(len - 1);
        for (i = 1; i < len; i++)
          args[i - 1] = arguments[i];
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    len = arguments.length;
    args = new Array(len - 1);
    for (i = 1; i < len; i++)
      args[i - 1] = arguments[i];

    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    var m;
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.listenerCount = function(emitter, type) {
  var ret;
  if (!emitter._events || !emitter._events[type])
    ret = 0;
  else if (isFunction(emitter._events[type]))
    ret = 1;
  else
    ret = emitter._events[type].length;
  return ret;
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],8:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = setTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    clearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        setTimeout(drainQueue, 0);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],9:[function(require,module,exports){
(function (process,Buffer){
//
// FileReader
//
// http://www.w3.org/TR/FileAPI/#dfn-filereader
// https://developer.mozilla.org/en/DOM/FileReader
(function () {
  "use strict";

  var fs = require("fs")
    , EventEmitter = require("events").EventEmitter
    ;

  function doop(fn, args, context) {
    if ('function' === typeof fn) {
      fn.apply(context, args);
    }
  }

  function toDataUrl(data, type) {
    // var data = self.result;
    var dataUrl = 'data:';

    if (type) {
      dataUrl += type + ';';
    }

    if (/text/i.test(type)) {
      dataUrl += 'charset=utf-8,';
      dataUrl += data.toString('utf8');
    } else {
      dataUrl += 'base64,';
      dataUrl += data.toString('base64');
    }

    return dataUrl;
  }

  function mapDataToFormat(file, data, format, encoding) {
    // var data = self.result;

    switch(format) {
      case 'buffer':
        return data;
        break;
      case 'binary':
        return data.toString('binary');
        break;
      case 'dataUrl':
        return toDataUrl(data, file.type);
        break;
      case 'text':
        return data.toString(encoding || 'utf8');
        break;
    }
  }

  function FileReader() {
    var self = this,
      emitter = new EventEmitter,
      file;

    self.addEventListener = function (on, callback) {
      emitter.on(on, callback);
    };
    self.removeEventListener = function (callback) {
      emitter.removeListener(callback);
    }
    self.dispatchEvent = function (on) {
      emitter.emit(on);
    }

    self.EMPTY = 0;
    self.LOADING = 1;
    self.DONE = 2;

    self.error = undefined;         // Read only
    self.readyState = self.EMPTY;   // Read only
    self.result = undefined;        // Road only

    // non-standard
    self.on = function () {
      emitter.on.apply(emitter, arguments);
    }
    self.nodeChunkedEncoding = false;
    self.setNodeChunkedEncoding = function (val) {
      self.nodeChunkedEncoding = val;
    };
    // end non-standard



    // Whatever the file object is, turn it into a Node.JS File.Stream
    function createFileStream() {
      var stream = new EventEmitter(),
        chunked = self.nodeChunkedEncoding;

      // attempt to make the length computable
      if (!file.size && chunked && file.path) {
        fs.stat(file.path, function (err, stat) {
          file.size = stat.size;
          file.lastModifiedDate = stat.mtime;
        });
      }


      // The stream exists, do nothing more
      if (file.stream) {
        return;
      }


      // Create a read stream from a buffer
      if (file.buffer) {
        process.nextTick(function () {
          stream.emit('data', file.buffer);
          stream.emit('end');
        });
        file.stream = stream;
        return;
      }


      // Create a read stream from a file
      if (file.path) {
        // TODO url
        if (!chunked) {
          fs.readFile(file.path, function (err, data) {
            if (err) {
              stream.emit('error', err);
            }
            if (data) {
              stream.emit('data', data);
              stream.emit('end');
            }
          });

          file.stream = stream;
          return;
        }

        // TODO don't duplicate this code here,
        // expose a method in File instead
        file.stream = fs.createReadStream(file.path);
      }
    }



    // before any other listeners are added
    emitter.on('abort', function () {
      self.readyState = self.DONE;
    });



    // Map `error`, `progress`, `load`, and `loadend`
    function mapStreamToEmitter(format, encoding) {
      var stream = file.stream,
        buffers = [],
        chunked = self.nodeChunkedEncoding;

      buffers.dataLength = 0;

      stream.on('error', function (err) {
        if (self.DONE === self.readyState) {
          return;
        }

        self.readyState = self.DONE;
        self.error = err;
        emitter.emit('error', err);
      });

      stream.on('data', function (data) {
        if (self.DONE === self.readyState) {
          return;
        }

        buffers.dataLength += data.length;
        buffers.push(data);

        emitter.emit('progress', {
          // fs.stat will probably complete before this
          // but possibly it will not, hence the check
          lengthComputable: (!isNaN(file.size)) ? true : false,
          loaded: buffers.dataLength,
          total: file.size
        });

        emitter.emit('data', data);
      });

      stream.on('end', function () {
        if (self.DONE === self.readyState) {
          return;
        }

        var data;

        if (buffers.length > 1 ) {
          data = Buffer.concat(buffers);
        } else {
          data = buffers[0];
        }

        self.readyState = self.DONE;
        self.result = mapDataToFormat(file, data, format, encoding);
        emitter.emit('load', {
          target: {
            // non-standard
            nodeBufferResult: data,
            result: self.result
          }
        });

        emitter.emit('loadend');
      });
    }


    // Abort is overwritten by readAsXyz
    self.abort = function () {
      if (self.readState == self.DONE) {
        return;
      }
      self.readyState = self.DONE;
      emitter.emit('abort');
    };



    // 
    function mapUserEvents() {
      emitter.on('start', function () {
        doop(self.onloadstart, arguments);
      });
      emitter.on('progress', function () {
        doop(self.onprogress, arguments);
      });
      emitter.on('error', function (err) {
        // TODO translate to FileError
        if (self.onerror) {
          self.onerror(err);
        } else {
          if (!emitter.listeners.error || !emitter.listeners.error.length) {
            throw err;
          }
        }
      });
      emitter.on('load', function () {
        doop(self.onload, arguments);
      });
      emitter.on('end', function () {
        doop(self.onloadend, arguments);
      });
      emitter.on('abort', function () {
        doop(self.onabort, arguments);
      });
    }



    function readFile(_file, format, encoding) {
      file = _file;
      if (!file || !file.name || !(file.path || file.stream || file.buffer)) {
        throw new Error("cannot read as File: " + JSON.stringify(file));
      }
      if (0 !== self.readyState) {
        console.log("already loading, request to change format ignored");
        return;
      }

      // 'process.nextTick' does not ensure order, (i.e. an fs.stat queued later may return faster)
      // but `onloadstart` must come before the first `data` event and must be asynchronous.
      // Hence we waste a single tick waiting
      process.nextTick(function () {
        self.readyState = self.LOADING;
        emitter.emit('loadstart');
        createFileStream();
        mapStreamToEmitter(format, encoding);
        mapUserEvents();
      });
    }

    self.readAsArrayBuffer = function (file) {
      readFile(file, 'buffer');
    };
    self.readAsBinaryString = function (file) {
      readFile(file, 'binary');
    };
    self.readAsDataURL = function (file) {
      readFile(file, 'dataUrl');
    };
    self.readAsText = function (file, encoding) {
      readFile(file, 'text', encoding);
    };
  }

  module.exports = FileReader;
}());

}).call(this,require('_process'),require("buffer").Buffer)

},{"_process":8,"buffer":3,"events":7,"fs":2}],10:[function(require,module,exports){
var config = require('../../config.json');
var Clump = require('./objects/clump');
var Lump = require('./objects/lump');

var io = require('./io');

var library = require('./library');
var loaded = {};

var types = {
  Quality: require('./objects/quality'),
  Event: require('./objects/event'),
  Interaction: require('./objects/interaction'),
  QualityEffect: require('./objects/quality-effect'),
  QualityRequirement: require('./objects/quality-requirement'),
  Area: require('./objects/area'),
  SpawnedEntity: require('./objects/spawned-entity'),
  CombatAttack: require('./objects/combat-attack'),
  Exchange: require('./objects/exchange'),
  Shop: require('./objects/shop'),
  Availability: require('./objects/availability'),
  Tile: require('./objects/tile'),
  TileVariant: require('./objects/tile-variant'),
  Port: require('./objects/port'),
  Setting: require('./objects/setting')
};

// Prepopulate library with Clumps of each type we know about
Object.keys(types).forEach(function(typeName) {
	var Type = types[typeName];
	if(!library[typeName]) {
		library[typeName] = new Clump([], Type);
		loaded[typeName] = new Clump([], Type);
	}
});

function get(Type, id, parent) {
	var typename = Type.name;	// Event, Quality, Interaction, etc

	var existingThingWithThisId = library[typename].id(id);
	if(existingThingWithThisId) {
		//console.log("Attached existing " + existingThingWithThisId + " to " + this.toString())
		var newParent = true;
		existingThingWithThisId.parents.forEach(function(p) {
			if(p.Id === parent.Id && p.constructor.name === parent.constructor.name) {
				newParent = false;
			}
		});
		if(newParent){
			existingThingWithThisId.parents.push(parent);
		}

		if(!existingThingWithThisId.wired) {
			existingThingWithThisId.wireUp(this);	// Pass in the api so object can add itself to the master-library
		}
		return existingThingWithThisId;
	}
	else {
		return null;
	}
}

function getOrCreate(Type, possNewThing, parent) {	// If an object already exists with this ID, use that.  Otherwise create a new object from the supplied details hash
	var typename = Type.name;	// Event, Quality, Interaction, etc
	if(possNewThing) {
  	var existingThingWithThisId = this.get(Type, possNewThing.Id, parent);
  	if(existingThingWithThisId) {
  		return existingThingWithThisId;
  	}
  	else {
			var newThing = new Type(possNewThing, parent);
			newThing.wireUp(this);
			//console.log("Recursively created " + newThing + " for " + this.toString());
			return newThing;
		}
	}
	else {
		return null;
	}
}

function wireUpObjects() {
	var api = this;
  Object.keys(types).forEach(function(type) {
    library[type].forEach(function(lump) {
      if(lump.wireUp) {
        lump.wireUp(api);
      }
    });
  });
}

var whatIs = function(id) {
  var possibilities = [];
  Object.keys(library).forEach(function(key) {
    if(library[key] instanceof Clump && library[key].id(id)) {
      possibilities.push(key);
    }
  });
  return possibilities;
};

function describeAdvancedExpression(expr) {
	var self = this;
	if(expr) {
		expr = expr.replace(/\[d:(\d+)\]/gi, "RANDOM[1-$1]");	// [d:x] = random number from 1-x(?)
		expr = expr.replace(/\[q:(\d+)\]/gi, function(match, backref, pos, whole_str) {
			var quality = self.library.Quality.id(backref);
			return "["+(quality ? quality.Name : 'INVALID')+"]";
		});

		return expr;
	}
	return null;
}

function readFromFile(Type, file, callback) {
	io.readFile(file, function (e) {
    var contents = e.target.result;
    
    var obj = JSON.parse(contents);
    loaded[Type.prototype.constructor.name] = new Clump(obj, Type);

    callback(contents, Type, loaded[Type.prototype.constructor.name]);
  });
}


module.exports = {
	'Clump': Clump,
	'Lump': Lump,
	'config': config,
	'types': types,
	'library': library,
	'loaded': loaded,
	'get': get,
	'whatIs': whatIs,
	'wireUpObjects': wireUpObjects,
	'getOrCreate': getOrCreate,
	'describeAdvancedExpression': describeAdvancedExpression,
	'readFromFile': readFromFile
};
},{"../../config.json":1,"./io":11,"./library":12,"./objects/area":13,"./objects/availability":14,"./objects/clump":15,"./objects/combat-attack":16,"./objects/event":17,"./objects/exchange":18,"./objects/interaction":19,"./objects/lump":20,"./objects/port":21,"./objects/quality":24,"./objects/quality-effect":22,"./objects/quality-requirement":23,"./objects/setting":25,"./objects/shop":26,"./objects/spawned-entity":27,"./objects/tile":29,"./objects/tile-variant":28}],11:[function(require,module,exports){

if(typeof FileReader === 'undefined') { // Running in node rather than a browser
  FileReader = require('filereader');
}

var fileObjectMap = {
    'events.json' : 'Event',
    'qualities.json' : 'Quality',
    'areas.json' : 'Area',
    'SpawnedEntities.json' : 'SpawnedEntity',
    'CombatAttacks.json' : 'CombatAttack',
    'exchanges.json' : 'Exchange',
    'Tiles.json': 'Tile'
  };

function readFile(file, callback) {
  var reader = new FileReader();
  reader.onload = callback;
  reader.readAsText(file);
}

var files_to_load = 0;
function resetFilesToLoad() {
	files_to_load = 0;
}
function incrementFilesToLoad() {
	files_to_load++;
}
function decrementFilesToLoad() {
	files_to_load--;
}
function countFilesToLoad() {
	return files_to_load;
}


module.exports = {
  readFile: readFile,
  resetFilesToLoad: resetFilesToLoad,
	incrementFilesToLoad: incrementFilesToLoad,
	decrementFilesToLoad: decrementFilesToLoad,
	countFilesToLoad: countFilesToLoad,
  fileObjectMap: fileObjectMap
};
},{"filereader":9}],12:[function(require,module,exports){
module.exports = {};
},{}],13:[function(require,module,exports){
var Lump = require('./lump');

var api;

function Area(raw) {
	this.straightCopy = ["Name", "Description", "ImageName", "MoveMessage"];
	Lump.call(this, raw);
}
Object.keys(Lump.prototype).forEach(function(member) { Area.prototype[member] = Lump.prototype[member]; });

Area.prototype.wireUp = function(theApi) {
	api = theApi;
	Lump.prototype.wireUp.call(this);
};

Area.prototype.toString = function() {
	return this.constructor.name + " " + this.Name + " (#" + this.Id + ")";
};

Area.prototype.toDom = function(size) {

	size = size || "normal";

	var element =  document.createElement("li");
	element.className = "item "+this.constructor.name.toLowerCase()+"-item "+size;

	if(this.ImageName !== null && this.Image !== "") {
		element.innerHTML = "<img class='icon' src='"+api.config.locations.imagesPath+"/"+this.ImageName+".png' />";
	}

	element.innerHTML += "\n<h3 class='title'>"+this.Name+"</h3>\n<p class='description'>"+this.Description+"</p>";

	element.title = this.toString();

	return element;
};

module.exports = Area;
},{"./lump":20}],14:[function(require,module,exports){
var Lump = require('./lump');

var api;

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

Availability.prototype.wireUp = function(theApi) {

	api = theApi;

	this.quality = api.getOrCreate(api.types.Quality, this.attribs.Quality, this);
	this.purchaseQuality = api.getOrCreate(api.types.Quality, this.attribs.PurchaseQuality, this);

	Lump.prototype.wireUp.call(this, api);
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

module.exports = Availability;
},{"./lump":20}],15:[function(require,module,exports){

function Clump(raw, Type, parent) {
	this.type = Type;
	this.items = {};
	var self = this;
	raw.forEach(function(item, index, collection) {
		if(!(item instanceof Type)) {
			item = new Type(item, parent);
		}
		else if(parent) {
			var newParent = true;
			item.parents.forEach(function(p) {
				if(p.Id === parent.Id && p.constructor.name === parent.constructor.name) {
					newParent = false;
				}
			});
			if(newParent){
				item.parents.push(parent);
			}
		}
		self.items[item.Id] = item;
	});
}

Clump.prototype.empty = function() {
	return !!this.size();
};

Clump.prototype.size = function() {
	return Object.keys(this.items).length;
};

Clump.prototype.get = function(index) {
	for(var id in this.items) {
		if(index === 0) {
			return this.items[id];
		}
		index--;
	}
};

Clump.prototype.id = function(id) {
	return this.items[id];
};

Clump.prototype.each = function() {
	var args = Array.prototype.slice.call(arguments);
	return this.map(function(item) {

		if(args[0] instanceof Array) {	// Passed in array of fields, so return values concatenated with optional separator
			var separator = (typeof args[1] === "undefined") ? "-" : args[1];
			return args[0].map(function(f) { return item[f]; }).join(separator);
		}
		else if(args.length > 1) {	// Passed in separate fields, so return array of values
			return args.map(function(f) { return item[f]; });
		}
		else {
			return item[args[0]];
		}
	});
};

Clump.prototype.forEach = function(callback) {
	for(var id in this.items) {
		var item = this.items[id];
		callback(item, id, this.items);
	}
};

Clump.prototype.map = function(callback) {
	var self = this;
	var arrayOfItems = Object.keys(this.items).map(function(key) {
		return self.items[key];
	});
	return arrayOfItems.map.call(arrayOfItems, callback);
};

Clump.prototype.sortBy = function(field, reverse) {
	var self = this;
	var objs = Object.keys(this.items).map(function(key) {
		return self.items[key];
	}).sort(function(a, b) {
		if(a[field] < b[field]) {
			return -1;
		}
		if(a[field] === b[field]) {
			return 0;
		}
		if(a[field] > b[field]) {
			return 1;
		}
	});

	return reverse ? objs.reverse() : objs;
};

Clump.prototype.same = function() {
	var self = this;

	var clone = function(obj) {
    var target = {};
    for (var i in obj) {
    	if (obj.hasOwnProperty(i)) {
    		if(typeof obj[i] === "object") {
    			target[i] = clone(obj[i]);
    		}
    		else {
      		target[i] = obj[i];
      	}
      }
    }
    return target;
  };

	var template = clone(this.get(0).attribs);

	for(var id in this.items) {
		var otherObj = this.items[id].attribs;
		for(var key in template) {
			if(template[key] !== otherObj[key]) {
				delete(template[key]);
			}
		}
	}

	return template;
};

Clump.prototype.distinct = function(field) {
	var sampleValues = {};
	this.forEach(function(item) {
		var value = item[field];
		sampleValues[value] = value;	// Cheap de-duping with a hash
	});
	return Object.keys(sampleValues).map(function(key) { return sampleValues[key]; });
};

Clump.prototype.distinctRaw = function(field) {
	var sampleValues = {};
	this.forEach(function(item) {
		var value = item.attribs[field];
		sampleValues[value] = value;	// Cheap de-duping with a hash
	});
	return Object.keys(sampleValues).map(function(key) { return sampleValues[key]; });
};

Clump.prototype.query = function(field, value) {
	var matches = [];
	var test;

	// Work out what sort of comparison to do:

	if(typeof value === "function") {	// If value is a function, pass it the candidate and return the result
		test = function(candidate) {
			return !!value(candidate);
		};
	}
	else if(typeof value === "object") {
		if(value instanceof RegExp) {
			test = function(candidate) {
				return value.test(candidate);
			};
		}
		else if(value instanceof Array) {	// If value is an array, test for the presence of the candidate value in the array
			test = function(candidate) {
				return value.indexOf(candidate) !== -1;
			};
		}
		else {
			test = function(candidate) {
				return candidate === value;	// Handle null, undefined or object-reference comparison
			};
		}
	}
	else {	// Else if it's a simple type, try a strict equality comparison
		test = function(candidate) {
			return candidate === value;
		};
	}
	
	// Now iterate over the items, filtering using the test function we defined
	this.forEach(function(item) {
		if(
			(field !== null && test(item[field])) ||
			(field === null && test(item))
		) {
			matches.push(item);
		}
	});
	return new Clump(matches, this.type);	// And wrap the resulting array of objects in a new Clump object for sexy method chaining like x.query().forEach() or x.query().query()
};

Clump.prototype.queryRaw = function(field, value) {
	var matches = [];
	var test;

	// Work out what sort of comparison to do:

	if(typeof value === "function") {	// If value is a function, pass it the candidate and return the result
		test = function(candidate) {
			return !!value(candidate);
		};
	}
	else if(typeof value === "object") {
		if(value instanceof RegExp) {
			test = function(candidate) {
				return value.test(candidate);
			};
		}
		else if(value instanceof Array) {	// If value is an array, test for the presence of the candidate value in the array
			test = function(candidate) {
				return value.indexOf(candidate) !== -1;
			};
		}
		else {	// If value is a hash... what do we do?
			// Check the candidate for each field in the hash in turn, and include the candidate if any/all of them have the same value as the corresponding value-hash field?
			throw "No idea what to do with an object as the value";
		}
	}
	else {	// Else if it's a simple type, try a strict equality comparison
		test = function(candidate) {
			return candidate === value;
		};
	}
	
	// Now iterate over them all, filtering using the test function we defined
	this.forEach(function(item) {
		if(
			(field !== null && test(item.attribs[field])) ||
			(field === null && test(item.attribs))
		) {
			matches.push(item);
		}
	});
	return new Clump(matches, this.type);	// And wrap the resulting array of objects in a new Clump object for sexy method chaining like x.query().forEach() or x.query().query()
};

Clump.prototype.toString = function() {
	return this.type.name + " Clump (" + this.size() + " items)";
};

Clump.prototype.toDom = function(size, includeChildren, tag, firstChild) {

	size = size || "normal";
	tag = tag || "ul";

	var element = document.createElement(tag);
	element.className = this.constructor.name.toLowerCase()+"-list "+size;
	if(firstChild) {
		element.appendChild(firstChild);
	}
	this.sortBy("Name").forEach(function(i) {
		element.appendChild(i.toDom(size, includeChildren));
	});
	return element;
};

Clump.prototype.describe = function() {
	var self = this;
	return Object.keys(this.items).map(function(i) { return self.items[i].toString(); }).join(" and ");
};

module.exports = Clump;
},{}],16:[function(require,module,exports){
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
		html = "<img class='icon' src='"+api.config.locations.imagesPath+"/"+this.Image+".png' />";
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
},{"./clump":15,"./lump":20}],17:[function(require,module,exports){
var Lump = require('./lump');
var Clump = require('./clump');

var api;

function Event(raw, parent) {
	this.straightCopy = [
	'Name',
	'Description',
	'Teaser',
	'Image',
	'Category'
	];
	Lump.apply(this, arguments);

	this.tag = null;

	this.ExoticEffects = this.getExoticEffect(this.attribs.ExoticEffects);

	this.qualitiesRequired = null;
	this.qualitiesAffected = null;
	this.interactions = null;
	this.linkToEvent = null;

	this.limitedToArea = null;

	this.setting = null;
	
	//Deck
	//Stickiness
	//Transient
	//Urgency
}
Object.keys(Lump.prototype).forEach(function(member) { Event.prototype[member] = Lump.prototype[member]; });

Event.prototype.wireUp = function(theApi) {

	api = theApi;

	this.qualitiesRequired = new Clump(this.attribs.QualitiesRequired || [], api.types.QualityRequirement, this);
	this.qualitiesAffected = new Clump(this.attribs.QualitiesAffected || [], api.types.QualityEffect, this);
	this.interactions = new Clump(this.attribs.ChildBranches|| [], api.types.Interaction, this);

	this.linkToEvent = api.getOrCreate(api.types.Event, this.attribs.LinkToEvent, this);

	this.limitedToArea = api.getOrCreate(api.types.Area, this.attribs.LimitedToArea, this);

	this.setting = api.getOrCreate(api.types.Setting, this.attribs.Setting, this);
	
	Lump.prototype.wireUp.call(this, api);
};

Event.prototype.toString = function(long) {
	return this.constructor.name + " " + (long ? " [" + this.Category + "] " : "") + this.Name + " (#" + this.Id + ")";
};

Event.prototype.toDom = function(size, includeChildren) {

	size = size || "normal";
	includeChildren = includeChildren === false ? false : true;

	var html = "";

	var element =  document.createElement("li");
	element.className = "item "+this.constructor.name.toLowerCase()+"-item "+size;

	if(this.Image !== null && this.Image !== "") {
		html = "<img class='icon' src='"+api.config.locations.imagesPath+"/"+this.Image+"small.png' />";
	}

	html += "\n<h3 class='title'>"+this.Name+"\n"+(this.tag ? "<span class='tag "+this.tag+"'>"+this.tag+"</span>" : "")+"</h3>";

	if(size != "small" && (this.qualitiesRequired || this.qualitiesAffected)) {
		html += "<div class='sidebar'>";
		if(this.qualitiesRequired && this.qualitiesRequired.size()) {
			html += "<h4>Requirements</h4>\n";
			html += this.qualitiesRequired.toDom("small", false, "ul").outerHTML;
		}
		if(this.qualitiesAffected && this.qualitiesAffected.size()) {
			html += "<h4>Effects</h4>\n";
			html += this.qualitiesAffected.toDom("small", false, "ul").outerHTML;
		}
		html += "</div>";
	}
	
	html += "<p class='description'>"+this.Description+"</p>";

	element.innerHTML = html;

	element.title = this.toString(true);

	if(includeChildren) {
		var self = this;
		element.addEventListener("click", function(e) {
			e.stopPropagation();

			var childList = element.querySelector(".child-list");
			if(childList) {
				element.removeChild(childList);
			}
			else {
				var interactions = self.interactions;
				var linkToEvent = self.linkToEvent;
				if(linkToEvent) {
					var wrapperClump = new Clump([linkToEvent], api.types.Event);
					var linkToEvent_element = wrapperClump.toDom("normal", true);

					linkToEvent_element.classList.add("child-list");
					element.appendChild(linkToEvent_element);
				}
				else if(interactions && interactions.size() > 0) {
					var interactions_element = interactions.toDom("normal", true);

					interactions_element.classList.add("child-list");
					element.appendChild(interactions_element);
				}
			}
		});
	}

	return element;
};

module.exports = Event;
},{"./clump":15,"./lump":20}],18:[function(require,module,exports){
var Lump = require('./lump');
var Clump = require('./clump');

var api;

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
	this.settings = null;
}
Object.keys(Lump.prototype).forEach(function(member) { Exchange.prototype[member] = Lump.prototype[member]; });

Exchange.prototype.wireUp = function(theApi) {

	api = theApi;

	var self = this;

	this.shops = new Clump(this.attribs.Shops || [], api.types.Shop, this);
	
	this.settings = api.library.Setting.query("Id", function(id) {
		return self.SettingIds.indexOf(id) !== -1;
	});
	this.settings.forEach(function (s) {
		self.parents.push(s);
	});
	
	this.ports = api.library.Port.query("SettingId", function(id) {
		return self.SettingIds.indexOf(id) !== -1;
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

	html = "\n<img class='icon' src='"+api.config.locations.imagesPath+"/"+this.Image+".png' />";
	html += "\n<h3 class='title'>"+this.Name+"</h3>";
	html += "\n<p class='description'>"+this.Description+"</p>";

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

module.exports = Exchange;
},{"./clump":15,"./lump":20}],19:[function(require,module,exports){
var Lump = require('./lump');
var Clump = require('./clump');

var api;

function Interaction(raw, parent) {
	this.straightCopy = [
	'Name',
	'Description',
	'ButtonText',
	'Image',

	'Ordering'
	];
	Lump.apply(this, arguments);

	this.qualitiesRequired = null;
	this.successEvent = null;
	this.defaultEvent = null;

}
Object.keys(Lump.prototype).forEach(function(member) { Interaction.prototype[member] = Lump.prototype[member]; });

Interaction.prototype.wireUp = function(theApi) {

	api = theApi;

	this.qualitiesRequired = new Clump(this.attribs.QualitiesRequired || [], api.types.QualityRequirement, this);
	this.successEvent = api.getOrCreate(api.types.Event, this.attribs.SuccessEvent, this);
	if(this.successEvent) {
		this.successEvent.tag = "success";
	}
	this.defaultEvent = api.getOrCreate(api.types.Event, this.attribs.DefaultEvent, this);
	var qualitiesRequired =  this.qualitiesRequired;
	if(this.defaultEvent && this.successEvent && qualitiesRequired && qualitiesRequired.size()) {
		this.defaultEvent.tag = "failure";
	}

	Lump.prototype.wireUp.call(this, api);
};

Interaction.prototype.toString = function() {
	return this.constructor.name + " [" + this.Ordering + "] " + this.Name + " (#" + this.Id + ")";
};

Interaction.prototype.toDom = function(size, includeChildren) {

	size = size || "normal";
	includeChildren = includeChildren === false ? false : true;

	var html = "";

	var element =  document.createElement("li");
	element.className = "item "+this.constructor.name.toLowerCase()+"-item "+size;

	if(this.Image !== null && this.Image !== "") {
		html = "<img class='icon' src='"+api.config.locations.imagesPath+"/"+this.Image+"small.png' />";
	}

	html += "\n<h3 class='title'>"+this.Name+"</h3>";

	if(size != "small" && this.qualitiesRequired) {
		html += "<div class='sidebar'>";
		html += "<h4>Requirements</h4>";
		html += this.qualitiesRequired.toDom("small", false, "ul").outerHTML;
		html += "</div>";
	}

	html += "<p class='description'>"+this.Description+"</p>";

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
					var child_events = wrapperClump.toDom("normal", true);

					child_events.classList.add("child-list");
					element.appendChild(child_events);
				}
			}
		});
	}

	return element;
};

module.exports = Interaction;
},{"./clump":15,"./lump":20}],20:[function(require,module,exports){
var library = require('../library');
var Clump = require('./clump');

var api;

function Lump(raw, parent) {
	if(parent) {
		this.parents = parent instanceof Array ? parent : [parent];
	}
	else {
		this.parents = [];
	}

	if(!this.straightCopy) {
		this.straightCopy = [];
	}
	this.straightCopy.unshift('Id');

	this.attribs = raw;

	var self = this;
	this.straightCopy.forEach(function(attrib) {
		self[attrib] = raw[attrib];
		if(typeof self[attrib] === "undefined") {
			self[attrib] = null;
		}
	});
	delete(this.straightCopy);

	this.wired = false;

	if(!library[this.constructor.name]) {
		library[this.constructor.name] = new Clump([], this);
	}
	library[this.constructor.name].items[this.Id] = this;
}

Lump.prototype = {
	wireUp: function(theApi) {
		api = theApi;
		this.wired = true;
	},

	getStates: function(encoded) {
		if(typeof encoded === "string" && encoded !== "") {
			var map = {};
			encoded.split("~").forEach(function(state) {
				var pair = state.split("|");
				map[pair[0]] = pair[1];
			});
			return map;
		}
		else {
			return null;
		}
	},

	getExoticEffect: function(encoded) {
		if(typeof encoded === "string") {
			var effect={}, fields=["operation", "first", "second"];
			encoded.split(",").forEach(function(val, index) {
				effect[fields[index]] = val;
			});
			return effect;
		}
		else {
			return null;
		}
	},

	evalAdvancedExpression: function(expr) {
		expr = expr.replace(/\[d:(\d+)\]/gi, "Math.floor((Math.random()*$1)+1)");	// Replace [d:x] with JS to calculate random number on a Dx die
		/*jshint -W061 */
		return eval(expr);
		/*jshint +W061 */
	},

	isA: function(type) {
		return this instanceof type;
	},

	isOneOf: function(types) {
		var self = this;
		return types.map(function(type) {
			return self.isA(type);
		}).reduce(function(previousValue, currentValue, index, array){
			return previousValue || currentValue;
		}, false);
	},

	toString: function() {
		return this.constructor.name + " (#" + this.Id + ")";
	}
};

module.exports = Lump;
},{"../library":12,"./clump":15}],21:[function(require,module,exports){
var Lump = require('./lump');

var api;

function Port(raw, parent) {
	this.straightCopy = [
		'Name',
		'Rotation',
		'Position',
		'DiscoveryValue',
		'IsStartingPort'
	];


	raw.Id = raw.Name;
	Lump.apply(this, arguments);

	this.SettingId = raw.Setting.Id;
	this.setting = null;

	this.area = null;

	this.exchanges = null;
}
Object.keys(Lump.prototype).forEach(function(member) { Port.prototype[member] = Lump.prototype[member]; });

Port.prototype.wireUp = function(theApi) {
	
	api = theApi;
	var self = this;

	this.setting = api.getOrCreate(api.types.Setting, this.attribs.Setting, this);
	
	this.area = api.getOrCreate(api.types.Area, this.attribs.Area, this);

	this.exchanges = api.library.Exchange.query("SettingIds", function(ids) { return ids.indexOf(self.SettingId) !== -1; });

	Lump.prototype.wireUp.call(this, api);
};

Port.prototype.toString = function(long) {
	return this.constructor.name + " " + this.Name + " (#" + this.Name + ")";
};

Port.prototype.toDom = function(size, tag) {

	size = size || "normal";
	tag = tag || "li";

	var html = "";

	var element =  document.createElement(tag);
	element.className = "item "+this.constructor.name.toLowerCase()+"-item "+size;

	html = "\n<h3 class='title'>"+this.Name+"</h3>";

	element.innerHTML = html;

	element.title = this.toString();

	return element;
};

module.exports = Port;
},{"./lump":20}],22:[function(require,module,exports){
var Lump = require('./lump');

var api;

function QualityEffect(raw, parent) {
	this.straightCopy = ["Level", "SetToExactly"];
	Lump.apply(this, arguments);

	// May involve Quality object references, so can't resolve until after all objects are wired up
	this.setToExactlyAdvanced = null;
	this.changeByAdvanced = null;	

	this.associatedQuality = null;
	
}
Object.keys(Lump.prototype).forEach(function(member) { QualityEffect.prototype[member] = Lump.prototype[member]; });

QualityEffect.prototype.wireUp = function(theApi) {

	api = theApi;

	this.associatedQuality = api.get(api.types.Quality, this.attribs.AssociatedQualityId, this);
	this.setToExactlyAdvanced = api.describeAdvancedExpression(this.attribs.SetToExactlyAdvanced);
	this.changeByAdvanced = api.describeAdvancedExpression(this.attribs.ChangeByAdvanced);

	Lump.prototype.wireUp.call(this, api);
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

module.exports = QualityEffect;
},{"./lump":20}],23:[function(require,module,exports){
var Lump = require('./lump');

var api;

function QualityRequirement(raw, parent) {
	this.straightCopy = ['MinLevel', 'MaxLevel'];
	Lump.apply(this, arguments);

	this.difficultyAdvanced = null;
	this.minAdvanced = null;
	this.maxAdvanced = null;

	this.associatedQuality = null;
	this.chanceQuality = null;
}
Object.keys(Lump.prototype).forEach(function(member) { QualityRequirement.prototype[member] = Lump.prototype[member]; });

QualityRequirement.prototype.wireUp = function(theApi) {

	api = theApi;

	this.difficultyAdvanced = api.describeAdvancedExpression(this.attribs.DifficultyAdvanced);
	this.minAdvanced = api.describeAdvancedExpression(this.attribs.MinAdvanced);
	this.maxAdvanced = api.describeAdvancedExpression(this.attribs.MaxAdvanced);

	this.associatedQuality = api.get(api.types.Quality, this.attribs.AssociatedQualityId, this);

	this.chanceQuality = this.getChanceCap();

	Lump.prototype.wireUp.call(this, api);
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
};

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

module.exports = QualityRequirement;
},{"./lump":20}],24:[function(require,module,exports){
var Lump = require('./lump');
var Clump = require('./clump');

var api;

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

Quality.prototype.wireUp = function(theApi) {

	api = theApi;

	this.useEvent = api.getOrCreate(api.types.Event, this.attribs.UseEvent, this);
	if(this.useEvent) {
		this.useEvent.tag = "use";
	}

	Lump.prototype.wireUp.call(this, api);
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

	html = "\n<img class='icon' src='"+api.config.locations.imagesPath+"/"+this.Image+"small.png' />";
	html += "\n<h3 class='title'>"+this.Name+"</h3>";
	html += "\n<p class='description'>"+this.Description+"</p>";

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

					var wrapperClump = new Clump([self.useEvent], api.types.Event);
					var child_events = wrapperClump.toDom(size, true);

					child_events.classList.add("child-list");
					element.appendChild(child_events);
				}
			}
		});
	}

	return element;
};

module.exports = Quality;
},{"./clump":15,"./lump":20}],25:[function(require,module,exports){
var Lump = require('./lump');

var api;

function Setting(raw, parent) {
	this.straightCopy = [
		'Id'
	];
	Lump.apply(this, arguments);

	this.shops = null;
}
Object.keys(Lump.prototype).forEach(function(member) { Setting.prototype[member] = Lump.prototype[member]; });

Setting.prototype.wireUp = function(theApi) {

	api = theApi;

	Lump.prototype.wireUp.call(this);
};

Setting.prototype.toString = function() {
	return this.constructor.name + " #" + this.Id;
};

Setting.prototype.toDom = function(size, includeChildren, tag) {

	size = size || "normal";
	includeChildren = includeChildren === false ? false : true;
	tag = tag || "li";

	var self = this;
	var html = "";

	var element =  document.createElement(tag);
	element.className = "item "+this.constructor.name.toLowerCase()+"-item "+size;

	html = "\n<h3 class='title'>"+this.Id+"</h3>";

	element.innerHTML = html;

	element.title = this.toString();

	return element;
};

module.exports = Setting;
},{"./lump":20}],26:[function(require,module,exports){
var Lump = require('./lump');
var Clump = require('./clump');

var api;

function Shop(raw, parent) {
	this.straightCopy = [
		'Id',
		'Name',
		'Description',
		'Image',
		'Ordering'
	];
	Lump.apply(this, arguments);

	this.availabilities = null;
	this.unlockCost = null;
}
Object.keys(Lump.prototype).forEach(function(member) { Shop.prototype[member] = Lump.prototype[member]; });

Shop.prototype.wireUp = function(theApi) {

	api = theApi;

	this.availabilities = new Clump(this.attribs.Availabilities || [], api.types.Availability, this);

	Lump.prototype.wireUp.call(this);
};

Shop.prototype.toString = function() {
	return this.constructor.name + " " + this.Name + " (#" + this.Id + ")";
};

Shop.prototype.toDom = function(size, includeChildren, tag) {

	size = size || "normal";
	includeChildren = includeChildren === false ? false : true;
	tag = tag || "li";

	var self = this;
	var html = "";

	var element =  document.createElement(tag);
	element.className = "item "+this.constructor.name.toLowerCase()+"-item "+size;

	html = "\n<img class='icon' src='"+api.config.locations.imagesPath+"/"+this.Image+".png' />";
	html += "\n<h3 class='title'>"+this.Name+"</h3>";
	html += "\n<p class='description'>"+this.Description+"</p>";

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
				if(self.availabilities) {

					var child_elements = self.availabilities.toDom("normal", true);

					child_elements.classList.add("child-list");
					element.appendChild(child_elements);
				}
			}
		});
	}

	return element;
};

module.exports = Shop;
},{"./clump":15,"./lump":20}],27:[function(require,module,exports){
var Lump = require('./lump');
var Clump = require('./clump');

var api;

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

SpawnedEntity.prototype.wireUp = function(theApi) {

	api = theApi;

	var self = this;
	
	this.combatAttackNames = (this.attribs.CombatAttackNames || []).map(function(name) {
		return api.get(api.types.CombatAttack, name, self);
	}).filter(function(attack) {
		return typeof attack === "object";
	});

	this.pacifyEvent = api.get(api.types.Event, this.attribs.PacifyEventId, this);
	if(this.pacifyEvent) {
		this.pacifyEvent.tag = "pacified";
	}

	this.killQualityEvent = api.get(api.types.Event, this.attribs.KillQualityEventId, this);
	if(this.killQualityEvent) {
		this.killQualityEvent.tag = "killed";
	}

	this.image = ((this.killQualityEvent && this.killQualityEvent.Image) || (this.pacifyEvent && this.pacifyEvent.Image));

	Lump.prototype.wireUp.call(this, api);
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
		html = "<img class='icon' src='"+api.config.locations.imagesPath+"/"+this.image+"small.png' />";
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

module.exports = SpawnedEntity;
},{"./clump":15,"./lump":20}],28:[function(require,module,exports){
var Lump = require('./lump');
var Clump = require('./clump');
var Port = require('./port');
var Area = require('./area');

var api;

function TileVariant(raw, parent) {
	this.straightCopy = [
		'Name',
		'HumanName',
		'Description',

		'MaxTilePopulation',
		'MinTilePopulation',
		
		'SeaColour',
		'MusicTrackName',
		'ChanceOfWeather',
		'FogRevealThreshold'
	];

/*
LabelData: Array[6]
PhenomenaData: Array[1]
SpawnPoints: Array[2]
TerrainData: Array[14]
Weather: Array[1]
*/

	raw.Id = raw.Name;
	Lump.apply(this, arguments);

	this.SettingId = raw.Setting.Id;
	this.setting = null;

	this.ports = new Clump(this.attribs.PortData || [], Port, this);

	this.areas = null;
}
Object.keys(Lump.prototype).forEach(function(member) { TileVariant.prototype[member] = Lump.prototype[member]; });

TileVariant.prototype.wireUp = function(theApi) {

	api = theApi;

	this.setting = api.getOrCreate(api.types.Setting, this.attribs.Setting, this);

	this.ports.forEach(function(p) { p.wireUp(api); });

	// Also create a list of all the areas of each of the ports in this object for convenience
	this.areas = new Clump(this.ports.map(function(p) { return p.area; }), api.types.Area, this);

	Lump.prototype.wireUp.call(this);
};

TileVariant.prototype.toString = function(long) {
	return this.constructor.name + " " + this.HumanName + " (#" + this.Name + ")";
};

TileVariant.prototype.toDom = function(size, tag) {

	size = size || "normal";
	tag = tag || "li";

	var html = "";

	var element =  document.createElement(tag);
	element.className = "item "+this.constructor.name.toLowerCase()+"-item "+size;

	html = "\n<h3 class='title'>"+this.HumanName+"</h3>";

	element.innerHTML = html;

	element.title = this.toString();

	return element;
};

module.exports = TileVariant;
},{"./area":13,"./clump":15,"./lump":20,"./port":21}],29:[function(require,module,exports){
var Lump = require('./lump');
var Clump = require('./clump');
var TileVariant = require('./tile-variant');
var Port = require('./port');
var Area = require('./area');

var api;

function Tile(raw, parent) {
	this.straightCopy = [
		'Name'
	];
	raw.Id = raw.Name;
	Lump.apply(this, arguments);

	this.tileVariants = new Clump(this.attribs.Tiles || [], TileVariant, this);
}
Object.keys(Lump.prototype).forEach(function(member) { Tile.prototype[member] = Lump.prototype[member]; });

Tile.prototype.wireUp = function(theApi) {

	api = theApi;

	this.tileVariants.forEach(function(tv) { tv.wireUp(api); });

	// Also create a list of all the ports and areas of each of the tilevariants in this object for convenience
	var all_ports = {};
	var all_areas = {};
	this.tileVariants.forEach(function(tv) {
		tv.ports.forEach(function(p) {
			all_ports[p.Id] = p;
			all_areas[p.area.Id] = p.area;
		});
	});
	this.ports = new Clump(Object.keys(all_ports).map(function(p) { return all_ports[p]; }), api.types.Port, this);
	this.areas = new Clump(Object.keys(all_areas).map(function(a) { return all_areas[a]; }), api.types.Area, this);

	Lump.prototype.wireUp.call(this);
};

Tile.prototype.toString = function(long) {
	return this.constructor.name + " " + this.Name + " (#" + this.Name + ")";
};

Tile.prototype.toDom = function(size, tag) {

	size = size || "normal";
	tag = tag || "li";

	var html = "";

	var element =  document.createElement(tag);
	element.className = "item "+this.constructor.name.toLowerCase()+"-item "+size;

	html = "\n<h3 class='title'>"+this.Name+"</h3>";

	element.innerHTML = html;

	element.title = this.toString();

	return element;
};

module.exports = Tile;
},{"./area":13,"./clump":15,"./lump":20,"./port":21,"./tile-variant":28}],30:[function(require,module,exports){
var api = require('./api');
var dragndrop = require('./ui/dragndrop');
var query = require('./ui/query');


$("#tabs .buttons li").on("click", function(e) {

  var type = $(this).attr("data-type");

  $("#tabs .panes .pane").hide(); // Hide all panes
  $("#tabs .buttons li").removeClass("active"); // Deactivate all buttons

  $("#tabs .panes ."+type.toLowerCase()).show();
  $("#tabs .buttons [data-type="+type+"]").addClass("active");
});

// Setup the dnd listeners.
var dropZone = document.getElementById('drop-zone');

dropZone.addEventListener('dragenter', dragndrop.handlers.dragOver, false);
dropZone.addEventListener('dragleave', dragndrop.handlers.dragEnd, false);
dropZone.addEventListener('dragover', dragndrop.handlers.dragOver, false);

dropZone.addEventListener('drop', dragndrop.handlers.dragDrop, false);

document.getElementById('paths-to-node').addEventListener('click', query.pathsToNodeUI, false);

// For convenience
window.api = api;
window.api.query = query;
},{"./api":10,"./ui/dragndrop":31,"./ui/query":32}],31:[function(require,module,exports){
var api = require('../api');
var Clump = require('../objects/clump');
var io = require('../io');

var render = require('./render');

function handleDragOver(evt) {
  evt.stopPropagation();
  evt.preventDefault();

  $("#drop-zone").addClass("drop-target");
}

function handleDragEnd(evt) {
  evt.stopPropagation();
  evt.preventDefault();

  $("#drop-zone").removeClass("drop-target");
}

function handleDragDrop(evt) {

  $("#drop-zone").removeClass("drop-target");

  evt.stopPropagation();
  evt.preventDefault();

  var files = evt.dataTransfer.files; // FileList object.

  // Files is a FileList of File objects. List some properties.
  var output = [];
  io.resetFilesToLoad();
  for (var i = 0; i < files.length; i++) {
    var f = files[i];
    var filename = escape(f.name);
    var typeName = io.fileObjectMap[filename];
    var Type = api.types[typeName];
    if(Type) {
      io.incrementFilesToLoad();
      api.readFromFile(Type, f, function() {
        io.decrementFilesToLoad();

        if(io.countFilesToLoad() === 0) {
          api.wireUpObjects();
          render.lists();
        }
      });
      output.push('<li><strong>', escape(f.name), '</strong> (', f.type || 'n/a', ') - ',
                f.size, ' bytes, last modified: ',
                f.lastModifiedDate ? f.lastModifiedDate.toLocaleDateString() : 'n/a',
                '</li>');
    }
    else {
      output.push('<li>ERROR: No handler for file <strong>' , escape(f.name), '</strong></li>');
    }
  }
  document.getElementById('list').innerHTML = '<ul>' + output.join('') + '</ul>';
}

module.exports = {
	handlers: {
		dragOver: handleDragOver,
		dragEnd: handleDragEnd,
		dragDrop: handleDragDrop
	}
};
},{"../api":10,"../io":11,"../objects/clump":15,"./render":33}],32:[function(require,module,exports){
var api = require('../api');
var Clump = require('../objects/clump');

function RouteNode(node) {
  this.node = node;
  this.children = [];
}

function pathsToNodeUI() {

  var type = document.getElementById('type');
  type = type.options[type.selectedIndex].value;

  var operation = document.getElementById('operation');
  operation = operation.options[operation.selectedIndex].value;

  var id = prompt("Id of "+type);

  if(!id) {  // Cancelled dialogue
    return;
  }

  var item = api.library[type].id(id);

  if(!item) {
    alert("Could not find "+type+" "+id);
    return;
  }

  var root = document.getElementById("query-tree");
  root.innerHTML = "";

  var title = $('.pane.query .pane-title').text("Query: "+item.toString());

  var routes = pathsToNode(item, {});

  if(routes && routes.children.length) {

    routes = filterPathsToNode(routes, operation);

    var top_children = document.createElement("ul");
    top_children.className += "clump-list small";

    routes.children.forEach(function(child_route) {
      var tree = renderPathsToNode(child_route, []);
      top_children.appendChild(tree);
    });

    root.appendChild(top_children);
  }
  else {
    alert("This "+type+" is a root node with no parents that satisfy the conditions");
  }
  
}

function pathsToNode(node, seen, parent) {

  if(seen[node.Id]) {   // Don't recurse into nodes we've already seen
    return false;
  }

  var ancestry = JSON.parse(JSON.stringify(seen));
  ancestry[node.Id] = true;

  var this_node = new RouteNode(/*node.linkToEvent ? node.linkToEvent :*/ node); // If this node is just a link to another one, skip over the useless link

  if(node instanceof api.types.SpawnedEntity) {
    return this_node;   // Leaf node in tree
  }
  else if(node instanceof api.types.Event && node.tag === "use") {
    return this_node;   // Leaf node in tree
  }
  else if(node instanceof api.types.Event && parent instanceof api.types.Event && (parent.tag === "killed" || parent.tag === "pacified")) { // If this is an event that's reachable by killing a monster, don't recurse any other causes (as they're usually misleading/circular)
    return false;
  }
  else if(node instanceof api.types.Setting) {
    return false;
  }
  else if (node instanceof api.types.Port) {
    return new RouteNode(node.area);
  }
  else if(node.limitedToArea && node.limitedToArea.Id !== 101956) {
    var area_name = node.limitedToArea.Name.toLowerCase();
    var event_name = (node.Name && node.Name.toLowerCase()) || "";
    if(area_name.indexOf(event_name) !== -1 || event_name.indexOf(area_name) !== -1) {  // If Area has similar name to Event, ignore the event and just substitute the area
      return new RouteNode(node.limitedToArea);
    }
    else {
      this_node.children.push(new RouteNode(node.limitedToArea));   // Else include both the Area and the Event
      return this_node;
    }
    
  }
  else {
    for(var i=0; i<node.parents.length; i++) {
      var the_parent = node.parents[i];
      var subtree = pathsToNode(the_parent, ancestry, node);
      if(subtree) {
        this_node.children.push(subtree);
      }
    }
    if(!this_node.children.length) {
      return false;
    }
  }

  return this_node;
}

function filterPathsToNode(routes, operation) {
  // Filter routes by operation
  if(routes && routes.children && operation !== "any") {
    routes.children = routes.children.filter(function(route_node) {

      lump = route_node.node;

      if(operation === "additive") {
        return lump.isOneOf([api.types.QualityEffect, api.types.Availability]) && lump.isAdditive();
      }
      else if(operation === "subtractive") {
        return lump.isOneOf([api.types.QualityEffect, api.types.Availability]) && lump.isSubtractive();
      }
    });
  }

  return routes;
}

function renderPathsToNode(routeNode, ancestry) {
  
  if(!(routeNode instanceof RouteNode)) {
    return null;
  }

  var element = routeNode.node.toDom("small", false);
  
  var child_list = document.createElement("ul");
  child_list.className += "clump-list small child-list";

  var new_ancestry = ancestry.slice();
  new_ancestry.push(routeNode.node);
  routeNode.children.forEach(function(child_route, index, children) {
    var child_content = renderPathsToNode(child_route, new_ancestry);
    child_list.appendChild(child_content);
  });

  if(routeNode.children.length) {
    element.appendChild(child_list);
  }
  else {
    var description = document.createElement("li");
    description.innerHTML = '<span class="route-description">HINT: ' + describeRoute(new_ancestry) + '</span>';

    var reqsTitle = document.createElement('h5');
    reqsTitle.innerHTML = "Requirements";
    description.appendChild(reqsTitle);

    var total_requirements = getRouteRequirements(new_ancestry);
    
    description.appendChild(total_requirements.toDom("small", false));
    element.appendChild(description);
  }

  return element;
}

function lower(text) {
  return text.slice(0,1).toLowerCase()+text.slice(1);
}

function describeRoute(ancestry) {
  var a = ancestry.slice().reverse();

  var guide = "";
  if(a[0] instanceof api.types.Area) {
    if(a[1] instanceof api.types.Event) {
      guide = "Seek "+a[1].Name+" in "+a[0].Name;
      if(a[2] instanceof api.types.Interaction) {
        guide += " and ";
        if("\"'".indexOf(a[2].Name[0]) !== -1) {
          guide += "exclaim ";
        }
        guide += lower(a[2].Name);
      }
      guide += ".";
    }
    else {
      guide = "Travel to "+a[0].Name;

      if(a[1] instanceof api.types.Interaction) {
        guide += " and "+lower(a[1].Name);
      }
      else if(a[1] instanceof api.types.Exchange && a[2] instanceof api.types.Shop) {
        guide += " and look for the "+a[2].Name+" Emporium in "+a[1].Name;
      }

      guide += ".";
    }
  }
  else if(a[0] instanceof api.types.SpawnedEntity) {
    guide = "Find and best a "+a[0].HumanName;
    if(a[2] instanceof api.types.Interaction) {
      guide += ", then " + lower(a[2].Name);
    }
    guide += ".";
  }
  else if(a[0] instanceof api.types.Event && a[0].tag === "use" && !(a[1] instanceof api.types.QualityRequirement)) {
    if(a[0].Name.match(/^\s*Speak/i)) {
      guide = a[0].Name;
    }
    else if(a[0].Name.match(/^\s*A/i)) {
      guide = "Acquire "+lower(a[0].Name);
    }
    else {
      guide = "Find a "+lower(a[0].Name);
    }
    guide += " and " + lower(a[1].Name) + ".";
  }

  return guide;
}

function detailRoute(ancestry) {
  var a = ancestry.slice().reverse();

  var guide = "";
  if(a[0] instanceof api.types.Area) {
    if(a[1] instanceof api.types.Event) {
      guide = "You must travel to "+a[0].Name+" and look for "+a[1].Name+".";
      if(a[2] instanceof api.types.Interaction) {
        guide += "  When you find it you should ";
        if("\"'".indexOf(a[2].Name[0]) !== -1) {
          guide += "say ";
        }
        guide += lower(a[2].Name);
      }
      guide += ".";
    }
    else {
      guide = "Make for "+a[0].Name;

      if(a[1] instanceof api.types.Interaction) {
        guide += " and "+lower(a[1].Name);
      }
      else if(a[1] instanceof api.types.Exchange && a[2] instanceof api.types.Shop) {
        guide += ".  Upon arrival go to "+a[1].Name+", and look for the shop "+a[2].Names;
      }

      guide += ".";
    }
  }
  else if(a[0] instanceof api.types.SpawnedEntity) {
    guide = "You must hunt the mythical zee-peril known as the "+a[0].HumanName+", engage it in battle and defeat it.";
    if(a[2] instanceof api.types.Interaction) {
      guide += "  Once you have conquered it you must " + lower(a[2].Name) + " to help secure your prize.";
    }
  }
  else if(a[0] instanceof api.types.Event && a[0].tag === "use" && !(a[1] instanceof api.types.QualityRequirement)) {
    if(a[0].Name.match(/^\s*Speak/i)) {
      guide = "First you must "+lower(a[0].Name);
    }
    else if(a[0].Name.match(/^\s*A/i)) {
      guide = "Source "+lower(a[0].Name);
    }
    else {
      guide = "Try to locate a "+lower(a[0].Name);
    }
    guide += ", and then " + lower(a[1].Name) + ".";
  }

  return guide;
}

function getRouteRequirements(ancestry) {

  var reqs = {};

  // Ancestry is ordered from last->first, so iterate backwards from final effect -> initial cause
  ancestry.forEach(function(step) {
    /* Simplification: if an event modifies a quality then assume that later requirements
    on the same quality are probably satisfied by that modification (eg, when qualities
    are incremented/decremented to control story-quest progress). */
    if(step.qualitiesAffected) {
      step.qualitiesAffected.forEach(function(effect) {
        delete(reqs[effect.associatedQuality.Id]);
      });
    }
    // Now add any requirements for the current stage (earlier requirements overwrite later ones on the same quality)
    if(step.qualitiesRequired) {
      step.qualitiesRequired.forEach(function(req) {
        if(req.associatedQuality) { // Check this is a valid QualityRequirement, and not one of the half-finished debug elements referring to anon-existant Quality
          reqs[req.associatedQuality.Id] = req;
        }
      });
    }
  });

  var result = Object.keys(reqs).map(function(key) { return reqs[key]; });

  return new Clump(result, api.types.QualityRequirement);
}

module.exports = {
  RouteNode: RouteNode,
  pathsToNodeUI: pathsToNodeUI,
  pathsToNode: pathsToNode,
  filterPathsToNode: filterPathsToNode,
  renderPathsToNode: renderPathsToNode,
  describeRoute: describeRoute,
  detailRoute: detailRoute,
  getRouteRequirements: getRouteRequirements
};
},{"../api":10,"../objects/clump":15}],33:[function(require,module,exports){
var api = require('../api');

function renderLists() {
  Object.keys(api.loaded).forEach(function(type) {
    renderList(api.loaded[type]); // Only display directly loaded (root-level) Lumps, to prevent the list becoming unwieldy
  });
}

function renderList(clump) {
	var root = document.getElementById(clump.type.name.toLowerCase()+"-list");
  if(root) {
	 root.appendChild(clump.toDom());
  }
}

module.exports = {
	list: renderList,
	lists: renderLists
};
},{"../api":10}]},{},[10,11,12,30])
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJjb25maWcuanNvbiIsIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L2xpYi9fZW1wdHkuanMiLCJub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnVmZmVyL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2J1ZmZlci9ub2RlX21vZHVsZXMvYmFzZTY0LWpzL2xpYi9iNjQuanMiLCJub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnVmZmVyL25vZGVfbW9kdWxlcy9pZWVlNzU0L2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2J1ZmZlci9ub2RlX21vZHVsZXMvaXMtYXJyYXkvaW5kZXguanMiLCJub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvZXZlbnRzL2V2ZW50cy5qcyIsIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9wcm9jZXNzL2Jyb3dzZXIuanMiLCJub2RlX21vZHVsZXMvZmlsZXJlYWRlci9GaWxlUmVhZGVyLmpzIiwic3JjL3NjcmlwdHMvYXBpLmpzIiwic3JjL3NjcmlwdHMvaW8uanMiLCJzcmMvc2NyaXB0cy9saWJyYXJ5LmpzIiwic3JjL3NjcmlwdHMvb2JqZWN0cy9hcmVhLmpzIiwic3JjL3NjcmlwdHMvb2JqZWN0cy9hdmFpbGFiaWxpdHkuanMiLCJzcmMvc2NyaXB0cy9vYmplY3RzL2NsdW1wLmpzIiwic3JjL3NjcmlwdHMvb2JqZWN0cy9jb21iYXQtYXR0YWNrLmpzIiwic3JjL3NjcmlwdHMvb2JqZWN0cy9ldmVudC5qcyIsInNyYy9zY3JpcHRzL29iamVjdHMvZXhjaGFuZ2UuanMiLCJzcmMvc2NyaXB0cy9vYmplY3RzL2ludGVyYWN0aW9uLmpzIiwic3JjL3NjcmlwdHMvb2JqZWN0cy9sdW1wLmpzIiwic3JjL3NjcmlwdHMvb2JqZWN0cy9wb3J0LmpzIiwic3JjL3NjcmlwdHMvb2JqZWN0cy9xdWFsaXR5LWVmZmVjdC5qcyIsInNyYy9zY3JpcHRzL29iamVjdHMvcXVhbGl0eS1yZXF1aXJlbWVudC5qcyIsInNyYy9zY3JpcHRzL29iamVjdHMvcXVhbGl0eS5qcyIsInNyYy9zY3JpcHRzL29iamVjdHMvc2V0dGluZy5qcyIsInNyYy9zY3JpcHRzL29iamVjdHMvc2hvcC5qcyIsInNyYy9zY3JpcHRzL29iamVjdHMvc3Bhd25lZC1lbnRpdHkuanMiLCJzcmMvc2NyaXB0cy9vYmplY3RzL3RpbGUtdmFyaWFudC5qcyIsInNyYy9zY3JpcHRzL29iamVjdHMvdGlsZS5qcyIsInNyYy9zY3JpcHRzL3VpLmpzIiwic3JjL3NjcmlwdHMvdWkvZHJhZ25kcm9wLmpzIiwic3JjL3NjcmlwdHMvdWkvcXVlcnkuanMiLCJzcmMvc2NyaXB0cy91aS9yZW5kZXIuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkJBOztBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzcvQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1SEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdTQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUMzRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUM1U0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN0lBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0NBOztBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0UUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzSEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1R0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9GQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN0ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaEhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOUZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6SUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4VEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwibW9kdWxlLmV4cG9ydHM9e1xuXHRcInRpdGxlXCI6IFwiU3VubGVzcyBTZWFcIixcblx0XCJwYXRoc1wiOiB7XG5cdFx0XCJ0ZW1wbGF0ZXNcIjogXCJzcmMvdGVtcGxhdGVzXCIsXG5cdFx0XCJidWlsZGRpclwiOiB7XG5cdFx0XHRcIm1vZFwiOiBcImJ1aWxkL21vZFwiLFxuXHRcdFx0XCJ1aVwiOiBcImJ1aWxkL3VpXCJcblx0XHR9XG5cdH0sXG5cdFwibG9jYXRpb25zXCI6IHtcblx0XHRcImltYWdlc1BhdGhcIjogXCIuLi8uLi9nYW1lLWRhdGEvaWNvbnNcIlxuXHR9LFxuXHRcImJhc2VHYW1lSWRzXCI6IHtcblx0XHRcInF1YWxpdHlcIjogNDE1MDAwLFxuXHRcdFwicHJlbGltRXZlbnRcIjogNTAwMDAwLFxuXHRcdFwiYnV5T3JhY2xlXCI6IDUwMDAwMTAsXG5cdFx0XCJzZWxsT3JhY2xlXCI6IDUwMDAyMCxcblx0XHRcImV2ZW50XCI6IDUwMDAyNSxcblx0XHRcImFjcXVpcmVcIjogNjAwMDAwLFxuXHRcdFwibGVhcm5cIjogNzAwMDAwLFxuXHRcdFwic3VmZmVyXCI6IDgwMDAwMCxcblx0XHRcImJlY29tZVwiOiA5MDAwMDBcblx0fVxufSIsbnVsbCwiLyohXG4gKiBUaGUgYnVmZmVyIG1vZHVsZSBmcm9tIG5vZGUuanMsIGZvciB0aGUgYnJvd3Nlci5cbiAqXG4gKiBAYXV0aG9yICAgRmVyb3NzIEFib3VraGFkaWplaCA8ZmVyb3NzQGZlcm9zcy5vcmc+IDxodHRwOi8vZmVyb3NzLm9yZz5cbiAqIEBsaWNlbnNlICBNSVRcbiAqL1xuXG52YXIgYmFzZTY0ID0gcmVxdWlyZSgnYmFzZTY0LWpzJylcbnZhciBpZWVlNzU0ID0gcmVxdWlyZSgnaWVlZTc1NCcpXG52YXIgaXNBcnJheSA9IHJlcXVpcmUoJ2lzLWFycmF5JylcblxuZXhwb3J0cy5CdWZmZXIgPSBCdWZmZXJcbmV4cG9ydHMuU2xvd0J1ZmZlciA9IFNsb3dCdWZmZXJcbmV4cG9ydHMuSU5TUEVDVF9NQVhfQllURVMgPSA1MFxuQnVmZmVyLnBvb2xTaXplID0gODE5MiAvLyBub3QgdXNlZCBieSB0aGlzIGltcGxlbWVudGF0aW9uXG5cbnZhciByb290UGFyZW50ID0ge31cblxuLyoqXG4gKiBJZiBgQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlRgOlxuICogICA9PT0gdHJ1ZSAgICBVc2UgVWludDhBcnJheSBpbXBsZW1lbnRhdGlvbiAoZmFzdGVzdClcbiAqICAgPT09IGZhbHNlICAgVXNlIE9iamVjdCBpbXBsZW1lbnRhdGlvbiAobW9zdCBjb21wYXRpYmxlLCBldmVuIElFNilcbiAqXG4gKiBCcm93c2VycyB0aGF0IHN1cHBvcnQgdHlwZWQgYXJyYXlzIGFyZSBJRSAxMCssIEZpcmVmb3ggNCssIENocm9tZSA3KywgU2FmYXJpIDUuMSssXG4gKiBPcGVyYSAxMS42KywgaU9TIDQuMisuXG4gKlxuICogRHVlIHRvIHZhcmlvdXMgYnJvd3NlciBidWdzLCBzb21ldGltZXMgdGhlIE9iamVjdCBpbXBsZW1lbnRhdGlvbiB3aWxsIGJlIHVzZWQgZXZlblxuICogd2hlbiB0aGUgYnJvd3NlciBzdXBwb3J0cyB0eXBlZCBhcnJheXMuXG4gKlxuICogTm90ZTpcbiAqXG4gKiAgIC0gRmlyZWZveCA0LTI5IGxhY2tzIHN1cHBvcnQgZm9yIGFkZGluZyBuZXcgcHJvcGVydGllcyB0byBgVWludDhBcnJheWAgaW5zdGFuY2VzLFxuICogICAgIFNlZTogaHR0cHM6Ly9idWd6aWxsYS5tb3ppbGxhLm9yZy9zaG93X2J1Zy5jZ2k/aWQ9Njk1NDM4LlxuICpcbiAqICAgLSBTYWZhcmkgNS03IGxhY2tzIHN1cHBvcnQgZm9yIGNoYW5naW5nIHRoZSBgT2JqZWN0LnByb3RvdHlwZS5jb25zdHJ1Y3RvcmAgcHJvcGVydHlcbiAqICAgICBvbiBvYmplY3RzLlxuICpcbiAqICAgLSBDaHJvbWUgOS0xMCBpcyBtaXNzaW5nIHRoZSBgVHlwZWRBcnJheS5wcm90b3R5cGUuc3ViYXJyYXlgIGZ1bmN0aW9uLlxuICpcbiAqICAgLSBJRTEwIGhhcyBhIGJyb2tlbiBgVHlwZWRBcnJheS5wcm90b3R5cGUuc3ViYXJyYXlgIGZ1bmN0aW9uIHdoaWNoIHJldHVybnMgYXJyYXlzIG9mXG4gKiAgICAgaW5jb3JyZWN0IGxlbmd0aCBpbiBzb21lIHNpdHVhdGlvbnMuXG5cbiAqIFdlIGRldGVjdCB0aGVzZSBidWdneSBicm93c2VycyBhbmQgc2V0IGBCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVGAgdG8gYGZhbHNlYCBzbyB0aGV5XG4gKiBnZXQgdGhlIE9iamVjdCBpbXBsZW1lbnRhdGlvbiwgd2hpY2ggaXMgc2xvd2VyIGJ1dCBiZWhhdmVzIGNvcnJlY3RseS5cbiAqL1xuQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQgPSAoZnVuY3Rpb24gKCkge1xuICBmdW5jdGlvbiBCYXIgKCkge31cbiAgdHJ5IHtcbiAgICB2YXIgYXJyID0gbmV3IFVpbnQ4QXJyYXkoMSlcbiAgICBhcnIuZm9vID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gNDIgfVxuICAgIGFyci5jb25zdHJ1Y3RvciA9IEJhclxuICAgIHJldHVybiBhcnIuZm9vKCkgPT09IDQyICYmIC8vIHR5cGVkIGFycmF5IGluc3RhbmNlcyBjYW4gYmUgYXVnbWVudGVkXG4gICAgICAgIGFyci5jb25zdHJ1Y3RvciA9PT0gQmFyICYmIC8vIGNvbnN0cnVjdG9yIGNhbiBiZSBzZXRcbiAgICAgICAgdHlwZW9mIGFyci5zdWJhcnJheSA9PT0gJ2Z1bmN0aW9uJyAmJiAvLyBjaHJvbWUgOS0xMCBsYWNrIGBzdWJhcnJheWBcbiAgICAgICAgYXJyLnN1YmFycmF5KDEsIDEpLmJ5dGVMZW5ndGggPT09IDAgLy8gaWUxMCBoYXMgYnJva2VuIGBzdWJhcnJheWBcbiAgfSBjYXRjaCAoZSkge1xuICAgIHJldHVybiBmYWxzZVxuICB9XG59KSgpXG5cbmZ1bmN0aW9uIGtNYXhMZW5ndGggKCkge1xuICByZXR1cm4gQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlRcbiAgICA/IDB4N2ZmZmZmZmZcbiAgICA6IDB4M2ZmZmZmZmZcbn1cblxuLyoqXG4gKiBDbGFzczogQnVmZmVyXG4gKiA9PT09PT09PT09PT09XG4gKlxuICogVGhlIEJ1ZmZlciBjb25zdHJ1Y3RvciByZXR1cm5zIGluc3RhbmNlcyBvZiBgVWludDhBcnJheWAgdGhhdCBhcmUgYXVnbWVudGVkXG4gKiB3aXRoIGZ1bmN0aW9uIHByb3BlcnRpZXMgZm9yIGFsbCB0aGUgbm9kZSBgQnVmZmVyYCBBUEkgZnVuY3Rpb25zLiBXZSB1c2VcbiAqIGBVaW50OEFycmF5YCBzbyB0aGF0IHNxdWFyZSBicmFja2V0IG5vdGF0aW9uIHdvcmtzIGFzIGV4cGVjdGVkIC0tIGl0IHJldHVybnNcbiAqIGEgc2luZ2xlIG9jdGV0LlxuICpcbiAqIEJ5IGF1Z21lbnRpbmcgdGhlIGluc3RhbmNlcywgd2UgY2FuIGF2b2lkIG1vZGlmeWluZyB0aGUgYFVpbnQ4QXJyYXlgXG4gKiBwcm90b3R5cGUuXG4gKi9cbmZ1bmN0aW9uIEJ1ZmZlciAoYXJnKSB7XG4gIGlmICghKHRoaXMgaW5zdGFuY2VvZiBCdWZmZXIpKSB7XG4gICAgLy8gQXZvaWQgZ29pbmcgdGhyb3VnaCBhbiBBcmd1bWVudHNBZGFwdG9yVHJhbXBvbGluZSBpbiB0aGUgY29tbW9uIGNhc2UuXG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPiAxKSByZXR1cm4gbmV3IEJ1ZmZlcihhcmcsIGFyZ3VtZW50c1sxXSlcbiAgICByZXR1cm4gbmV3IEJ1ZmZlcihhcmcpXG4gIH1cblxuICB0aGlzLmxlbmd0aCA9IDBcbiAgdGhpcy5wYXJlbnQgPSB1bmRlZmluZWRcblxuICAvLyBDb21tb24gY2FzZS5cbiAgaWYgKHR5cGVvZiBhcmcgPT09ICdudW1iZXInKSB7XG4gICAgcmV0dXJuIGZyb21OdW1iZXIodGhpcywgYXJnKVxuICB9XG5cbiAgLy8gU2xpZ2h0bHkgbGVzcyBjb21tb24gY2FzZS5cbiAgaWYgKHR5cGVvZiBhcmcgPT09ICdzdHJpbmcnKSB7XG4gICAgcmV0dXJuIGZyb21TdHJpbmcodGhpcywgYXJnLCBhcmd1bWVudHMubGVuZ3RoID4gMSA/IGFyZ3VtZW50c1sxXSA6ICd1dGY4JylcbiAgfVxuXG4gIC8vIFVudXN1YWwuXG4gIHJldHVybiBmcm9tT2JqZWN0KHRoaXMsIGFyZylcbn1cblxuZnVuY3Rpb24gZnJvbU51bWJlciAodGhhdCwgbGVuZ3RoKSB7XG4gIHRoYXQgPSBhbGxvY2F0ZSh0aGF0LCBsZW5ndGggPCAwID8gMCA6IGNoZWNrZWQobGVuZ3RoKSB8IDApXG4gIGlmICghQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICB0aGF0W2ldID0gMFxuICAgIH1cbiAgfVxuICByZXR1cm4gdGhhdFxufVxuXG5mdW5jdGlvbiBmcm9tU3RyaW5nICh0aGF0LCBzdHJpbmcsIGVuY29kaW5nKSB7XG4gIGlmICh0eXBlb2YgZW5jb2RpbmcgIT09ICdzdHJpbmcnIHx8IGVuY29kaW5nID09PSAnJykgZW5jb2RpbmcgPSAndXRmOCdcblxuICAvLyBBc3N1bXB0aW9uOiBieXRlTGVuZ3RoKCkgcmV0dXJuIHZhbHVlIGlzIGFsd2F5cyA8IGtNYXhMZW5ndGguXG4gIHZhciBsZW5ndGggPSBieXRlTGVuZ3RoKHN0cmluZywgZW5jb2RpbmcpIHwgMFxuICB0aGF0ID0gYWxsb2NhdGUodGhhdCwgbGVuZ3RoKVxuXG4gIHRoYXQud3JpdGUoc3RyaW5nLCBlbmNvZGluZylcbiAgcmV0dXJuIHRoYXRcbn1cblxuZnVuY3Rpb24gZnJvbU9iamVjdCAodGhhdCwgb2JqZWN0KSB7XG4gIGlmIChCdWZmZXIuaXNCdWZmZXIob2JqZWN0KSkgcmV0dXJuIGZyb21CdWZmZXIodGhhdCwgb2JqZWN0KVxuXG4gIGlmIChpc0FycmF5KG9iamVjdCkpIHJldHVybiBmcm9tQXJyYXkodGhhdCwgb2JqZWN0KVxuXG4gIGlmIChvYmplY3QgPT0gbnVsbCkge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ211c3Qgc3RhcnQgd2l0aCBudW1iZXIsIGJ1ZmZlciwgYXJyYXkgb3Igc3RyaW5nJylcbiAgfVxuXG4gIGlmICh0eXBlb2YgQXJyYXlCdWZmZXIgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgaWYgKG9iamVjdC5idWZmZXIgaW5zdGFuY2VvZiBBcnJheUJ1ZmZlcikge1xuICAgICAgcmV0dXJuIGZyb21UeXBlZEFycmF5KHRoYXQsIG9iamVjdClcbiAgICB9XG4gICAgaWYgKG9iamVjdCBpbnN0YW5jZW9mIEFycmF5QnVmZmVyKSB7XG4gICAgICByZXR1cm4gZnJvbUFycmF5QnVmZmVyKHRoYXQsIG9iamVjdClcbiAgICB9XG4gIH1cblxuICBpZiAob2JqZWN0Lmxlbmd0aCkgcmV0dXJuIGZyb21BcnJheUxpa2UodGhhdCwgb2JqZWN0KVxuXG4gIHJldHVybiBmcm9tSnNvbk9iamVjdCh0aGF0LCBvYmplY3QpXG59XG5cbmZ1bmN0aW9uIGZyb21CdWZmZXIgKHRoYXQsIGJ1ZmZlcikge1xuICB2YXIgbGVuZ3RoID0gY2hlY2tlZChidWZmZXIubGVuZ3RoKSB8IDBcbiAgdGhhdCA9IGFsbG9jYXRlKHRoYXQsIGxlbmd0aClcbiAgYnVmZmVyLmNvcHkodGhhdCwgMCwgMCwgbGVuZ3RoKVxuICByZXR1cm4gdGhhdFxufVxuXG5mdW5jdGlvbiBmcm9tQXJyYXkgKHRoYXQsIGFycmF5KSB7XG4gIHZhciBsZW5ndGggPSBjaGVja2VkKGFycmF5Lmxlbmd0aCkgfCAwXG4gIHRoYXQgPSBhbGxvY2F0ZSh0aGF0LCBsZW5ndGgpXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpICs9IDEpIHtcbiAgICB0aGF0W2ldID0gYXJyYXlbaV0gJiAyNTVcbiAgfVxuICByZXR1cm4gdGhhdFxufVxuXG4vLyBEdXBsaWNhdGUgb2YgZnJvbUFycmF5KCkgdG8ga2VlcCBmcm9tQXJyYXkoKSBtb25vbW9ycGhpYy5cbmZ1bmN0aW9uIGZyb21UeXBlZEFycmF5ICh0aGF0LCBhcnJheSkge1xuICB2YXIgbGVuZ3RoID0gY2hlY2tlZChhcnJheS5sZW5ndGgpIHwgMFxuICB0aGF0ID0gYWxsb2NhdGUodGhhdCwgbGVuZ3RoKVxuICAvLyBUcnVuY2F0aW5nIHRoZSBlbGVtZW50cyBpcyBwcm9iYWJseSBub3Qgd2hhdCBwZW9wbGUgZXhwZWN0IGZyb20gdHlwZWRcbiAgLy8gYXJyYXlzIHdpdGggQllURVNfUEVSX0VMRU1FTlQgPiAxIGJ1dCBpdCdzIGNvbXBhdGlibGUgd2l0aCB0aGUgYmVoYXZpb3JcbiAgLy8gb2YgdGhlIG9sZCBCdWZmZXIgY29uc3RydWN0b3IuXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpICs9IDEpIHtcbiAgICB0aGF0W2ldID0gYXJyYXlbaV0gJiAyNTVcbiAgfVxuICByZXR1cm4gdGhhdFxufVxuXG5mdW5jdGlvbiBmcm9tQXJyYXlCdWZmZXIgKHRoYXQsIGFycmF5KSB7XG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIC8vIFJldHVybiBhbiBhdWdtZW50ZWQgYFVpbnQ4QXJyYXlgIGluc3RhbmNlLCBmb3IgYmVzdCBwZXJmb3JtYW5jZVxuICAgIGFycmF5LmJ5dGVMZW5ndGhcbiAgICB0aGF0ID0gQnVmZmVyLl9hdWdtZW50KG5ldyBVaW50OEFycmF5KGFycmF5KSlcbiAgfSBlbHNlIHtcbiAgICAvLyBGYWxsYmFjazogUmV0dXJuIGFuIG9iamVjdCBpbnN0YW5jZSBvZiB0aGUgQnVmZmVyIGNsYXNzXG4gICAgdGhhdCA9IGZyb21UeXBlZEFycmF5KHRoYXQsIG5ldyBVaW50OEFycmF5KGFycmF5KSlcbiAgfVxuICByZXR1cm4gdGhhdFxufVxuXG5mdW5jdGlvbiBmcm9tQXJyYXlMaWtlICh0aGF0LCBhcnJheSkge1xuICB2YXIgbGVuZ3RoID0gY2hlY2tlZChhcnJheS5sZW5ndGgpIHwgMFxuICB0aGF0ID0gYWxsb2NhdGUodGhhdCwgbGVuZ3RoKVxuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSArPSAxKSB7XG4gICAgdGhhdFtpXSA9IGFycmF5W2ldICYgMjU1XG4gIH1cbiAgcmV0dXJuIHRoYXRcbn1cblxuLy8gRGVzZXJpYWxpemUgeyB0eXBlOiAnQnVmZmVyJywgZGF0YTogWzEsMiwzLC4uLl0gfSBpbnRvIGEgQnVmZmVyIG9iamVjdC5cbi8vIFJldHVybnMgYSB6ZXJvLWxlbmd0aCBidWZmZXIgZm9yIGlucHV0cyB0aGF0IGRvbid0IGNvbmZvcm0gdG8gdGhlIHNwZWMuXG5mdW5jdGlvbiBmcm9tSnNvbk9iamVjdCAodGhhdCwgb2JqZWN0KSB7XG4gIHZhciBhcnJheVxuICB2YXIgbGVuZ3RoID0gMFxuXG4gIGlmIChvYmplY3QudHlwZSA9PT0gJ0J1ZmZlcicgJiYgaXNBcnJheShvYmplY3QuZGF0YSkpIHtcbiAgICBhcnJheSA9IG9iamVjdC5kYXRhXG4gICAgbGVuZ3RoID0gY2hlY2tlZChhcnJheS5sZW5ndGgpIHwgMFxuICB9XG4gIHRoYXQgPSBhbGxvY2F0ZSh0aGF0LCBsZW5ndGgpXG5cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkgKz0gMSkge1xuICAgIHRoYXRbaV0gPSBhcnJheVtpXSAmIDI1NVxuICB9XG4gIHJldHVybiB0aGF0XG59XG5cbmZ1bmN0aW9uIGFsbG9jYXRlICh0aGF0LCBsZW5ndGgpIHtcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgLy8gUmV0dXJuIGFuIGF1Z21lbnRlZCBgVWludDhBcnJheWAgaW5zdGFuY2UsIGZvciBiZXN0IHBlcmZvcm1hbmNlXG4gICAgdGhhdCA9IEJ1ZmZlci5fYXVnbWVudChuZXcgVWludDhBcnJheShsZW5ndGgpKVxuICB9IGVsc2Uge1xuICAgIC8vIEZhbGxiYWNrOiBSZXR1cm4gYW4gb2JqZWN0IGluc3RhbmNlIG9mIHRoZSBCdWZmZXIgY2xhc3NcbiAgICB0aGF0Lmxlbmd0aCA9IGxlbmd0aFxuICAgIHRoYXQuX2lzQnVmZmVyID0gdHJ1ZVxuICB9XG5cbiAgdmFyIGZyb21Qb29sID0gbGVuZ3RoICE9PSAwICYmIGxlbmd0aCA8PSBCdWZmZXIucG9vbFNpemUgPj4+IDFcbiAgaWYgKGZyb21Qb29sKSB0aGF0LnBhcmVudCA9IHJvb3RQYXJlbnRcblxuICByZXR1cm4gdGhhdFxufVxuXG5mdW5jdGlvbiBjaGVja2VkIChsZW5ndGgpIHtcbiAgLy8gTm90ZTogY2Fubm90IHVzZSBgbGVuZ3RoIDwga01heExlbmd0aGAgaGVyZSBiZWNhdXNlIHRoYXQgZmFpbHMgd2hlblxuICAvLyBsZW5ndGggaXMgTmFOICh3aGljaCBpcyBvdGhlcndpc2UgY29lcmNlZCB0byB6ZXJvLilcbiAgaWYgKGxlbmd0aCA+PSBrTWF4TGVuZ3RoKCkpIHtcbiAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcignQXR0ZW1wdCB0byBhbGxvY2F0ZSBCdWZmZXIgbGFyZ2VyIHRoYW4gbWF4aW11bSAnICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAnc2l6ZTogMHgnICsga01heExlbmd0aCgpLnRvU3RyaW5nKDE2KSArICcgYnl0ZXMnKVxuICB9XG4gIHJldHVybiBsZW5ndGggfCAwXG59XG5cbmZ1bmN0aW9uIFNsb3dCdWZmZXIgKHN1YmplY3QsIGVuY29kaW5nKSB7XG4gIGlmICghKHRoaXMgaW5zdGFuY2VvZiBTbG93QnVmZmVyKSkgcmV0dXJuIG5ldyBTbG93QnVmZmVyKHN1YmplY3QsIGVuY29kaW5nKVxuXG4gIHZhciBidWYgPSBuZXcgQnVmZmVyKHN1YmplY3QsIGVuY29kaW5nKVxuICBkZWxldGUgYnVmLnBhcmVudFxuICByZXR1cm4gYnVmXG59XG5cbkJ1ZmZlci5pc0J1ZmZlciA9IGZ1bmN0aW9uIGlzQnVmZmVyIChiKSB7XG4gIHJldHVybiAhIShiICE9IG51bGwgJiYgYi5faXNCdWZmZXIpXG59XG5cbkJ1ZmZlci5jb21wYXJlID0gZnVuY3Rpb24gY29tcGFyZSAoYSwgYikge1xuICBpZiAoIUJ1ZmZlci5pc0J1ZmZlcihhKSB8fCAhQnVmZmVyLmlzQnVmZmVyKGIpKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcignQXJndW1lbnRzIG11c3QgYmUgQnVmZmVycycpXG4gIH1cblxuICBpZiAoYSA9PT0gYikgcmV0dXJuIDBcblxuICB2YXIgeCA9IGEubGVuZ3RoXG4gIHZhciB5ID0gYi5sZW5ndGhcblxuICB2YXIgaSA9IDBcbiAgdmFyIGxlbiA9IE1hdGgubWluKHgsIHkpXG4gIHdoaWxlIChpIDwgbGVuKSB7XG4gICAgaWYgKGFbaV0gIT09IGJbaV0pIGJyZWFrXG5cbiAgICArK2lcbiAgfVxuXG4gIGlmIChpICE9PSBsZW4pIHtcbiAgICB4ID0gYVtpXVxuICAgIHkgPSBiW2ldXG4gIH1cblxuICBpZiAoeCA8IHkpIHJldHVybiAtMVxuICBpZiAoeSA8IHgpIHJldHVybiAxXG4gIHJldHVybiAwXG59XG5cbkJ1ZmZlci5pc0VuY29kaW5nID0gZnVuY3Rpb24gaXNFbmNvZGluZyAoZW5jb2RpbmcpIHtcbiAgc3dpdGNoIChTdHJpbmcoZW5jb2RpbmcpLnRvTG93ZXJDYXNlKCkpIHtcbiAgICBjYXNlICdoZXgnOlxuICAgIGNhc2UgJ3V0ZjgnOlxuICAgIGNhc2UgJ3V0Zi04JzpcbiAgICBjYXNlICdhc2NpaSc6XG4gICAgY2FzZSAnYmluYXJ5JzpcbiAgICBjYXNlICdiYXNlNjQnOlxuICAgIGNhc2UgJ3Jhdyc6XG4gICAgY2FzZSAndWNzMic6XG4gICAgY2FzZSAndWNzLTInOlxuICAgIGNhc2UgJ3V0ZjE2bGUnOlxuICAgIGNhc2UgJ3V0Zi0xNmxlJzpcbiAgICAgIHJldHVybiB0cnVlXG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiBmYWxzZVxuICB9XG59XG5cbkJ1ZmZlci5jb25jYXQgPSBmdW5jdGlvbiBjb25jYXQgKGxpc3QsIGxlbmd0aCkge1xuICBpZiAoIWlzQXJyYXkobGlzdCkpIHRocm93IG5ldyBUeXBlRXJyb3IoJ2xpc3QgYXJndW1lbnQgbXVzdCBiZSBhbiBBcnJheSBvZiBCdWZmZXJzLicpXG5cbiAgaWYgKGxpc3QubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIG5ldyBCdWZmZXIoMClcbiAgfVxuXG4gIHZhciBpXG4gIGlmIChsZW5ndGggPT09IHVuZGVmaW5lZCkge1xuICAgIGxlbmd0aCA9IDBcbiAgICBmb3IgKGkgPSAwOyBpIDwgbGlzdC5sZW5ndGg7IGkrKykge1xuICAgICAgbGVuZ3RoICs9IGxpc3RbaV0ubGVuZ3RoXG4gICAgfVxuICB9XG5cbiAgdmFyIGJ1ZiA9IG5ldyBCdWZmZXIobGVuZ3RoKVxuICB2YXIgcG9zID0gMFxuICBmb3IgKGkgPSAwOyBpIDwgbGlzdC5sZW5ndGg7IGkrKykge1xuICAgIHZhciBpdGVtID0gbGlzdFtpXVxuICAgIGl0ZW0uY29weShidWYsIHBvcylcbiAgICBwb3MgKz0gaXRlbS5sZW5ndGhcbiAgfVxuICByZXR1cm4gYnVmXG59XG5cbmZ1bmN0aW9uIGJ5dGVMZW5ndGggKHN0cmluZywgZW5jb2RpbmcpIHtcbiAgaWYgKHR5cGVvZiBzdHJpbmcgIT09ICdzdHJpbmcnKSBzdHJpbmcgPSAnJyArIHN0cmluZ1xuXG4gIHZhciBsZW4gPSBzdHJpbmcubGVuZ3RoXG4gIGlmIChsZW4gPT09IDApIHJldHVybiAwXG5cbiAgLy8gVXNlIGEgZm9yIGxvb3AgdG8gYXZvaWQgcmVjdXJzaW9uXG4gIHZhciBsb3dlcmVkQ2FzZSA9IGZhbHNlXG4gIGZvciAoOzspIHtcbiAgICBzd2l0Y2ggKGVuY29kaW5nKSB7XG4gICAgICBjYXNlICdhc2NpaSc6XG4gICAgICBjYXNlICdiaW5hcnknOlxuICAgICAgLy8gRGVwcmVjYXRlZFxuICAgICAgY2FzZSAncmF3JzpcbiAgICAgIGNhc2UgJ3Jhd3MnOlxuICAgICAgICByZXR1cm4gbGVuXG4gICAgICBjYXNlICd1dGY4JzpcbiAgICAgIGNhc2UgJ3V0Zi04JzpcbiAgICAgICAgcmV0dXJuIHV0ZjhUb0J5dGVzKHN0cmluZykubGVuZ3RoXG4gICAgICBjYXNlICd1Y3MyJzpcbiAgICAgIGNhc2UgJ3Vjcy0yJzpcbiAgICAgIGNhc2UgJ3V0ZjE2bGUnOlxuICAgICAgY2FzZSAndXRmLTE2bGUnOlxuICAgICAgICByZXR1cm4gbGVuICogMlxuICAgICAgY2FzZSAnaGV4JzpcbiAgICAgICAgcmV0dXJuIGxlbiA+Pj4gMVxuICAgICAgY2FzZSAnYmFzZTY0JzpcbiAgICAgICAgcmV0dXJuIGJhc2U2NFRvQnl0ZXMoc3RyaW5nKS5sZW5ndGhcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGlmIChsb3dlcmVkQ2FzZSkgcmV0dXJuIHV0ZjhUb0J5dGVzKHN0cmluZykubGVuZ3RoIC8vIGFzc3VtZSB1dGY4XG4gICAgICAgIGVuY29kaW5nID0gKCcnICsgZW5jb2RpbmcpLnRvTG93ZXJDYXNlKClcbiAgICAgICAgbG93ZXJlZENhc2UgPSB0cnVlXG4gICAgfVxuICB9XG59XG5CdWZmZXIuYnl0ZUxlbmd0aCA9IGJ5dGVMZW5ndGhcblxuLy8gcHJlLXNldCBmb3IgdmFsdWVzIHRoYXQgbWF5IGV4aXN0IGluIHRoZSBmdXR1cmVcbkJ1ZmZlci5wcm90b3R5cGUubGVuZ3RoID0gdW5kZWZpbmVkXG5CdWZmZXIucHJvdG90eXBlLnBhcmVudCA9IHVuZGVmaW5lZFxuXG5mdW5jdGlvbiBzbG93VG9TdHJpbmcgKGVuY29kaW5nLCBzdGFydCwgZW5kKSB7XG4gIHZhciBsb3dlcmVkQ2FzZSA9IGZhbHNlXG5cbiAgc3RhcnQgPSBzdGFydCB8IDBcbiAgZW5kID0gZW5kID09PSB1bmRlZmluZWQgfHwgZW5kID09PSBJbmZpbml0eSA/IHRoaXMubGVuZ3RoIDogZW5kIHwgMFxuXG4gIGlmICghZW5jb2RpbmcpIGVuY29kaW5nID0gJ3V0ZjgnXG4gIGlmIChzdGFydCA8IDApIHN0YXJ0ID0gMFxuICBpZiAoZW5kID4gdGhpcy5sZW5ndGgpIGVuZCA9IHRoaXMubGVuZ3RoXG4gIGlmIChlbmQgPD0gc3RhcnQpIHJldHVybiAnJ1xuXG4gIHdoaWxlICh0cnVlKSB7XG4gICAgc3dpdGNoIChlbmNvZGluZykge1xuICAgICAgY2FzZSAnaGV4JzpcbiAgICAgICAgcmV0dXJuIGhleFNsaWNlKHRoaXMsIHN0YXJ0LCBlbmQpXG5cbiAgICAgIGNhc2UgJ3V0ZjgnOlxuICAgICAgY2FzZSAndXRmLTgnOlxuICAgICAgICByZXR1cm4gdXRmOFNsaWNlKHRoaXMsIHN0YXJ0LCBlbmQpXG5cbiAgICAgIGNhc2UgJ2FzY2lpJzpcbiAgICAgICAgcmV0dXJuIGFzY2lpU2xpY2UodGhpcywgc3RhcnQsIGVuZClcblxuICAgICAgY2FzZSAnYmluYXJ5JzpcbiAgICAgICAgcmV0dXJuIGJpbmFyeVNsaWNlKHRoaXMsIHN0YXJ0LCBlbmQpXG5cbiAgICAgIGNhc2UgJ2Jhc2U2NCc6XG4gICAgICAgIHJldHVybiBiYXNlNjRTbGljZSh0aGlzLCBzdGFydCwgZW5kKVxuXG4gICAgICBjYXNlICd1Y3MyJzpcbiAgICAgIGNhc2UgJ3Vjcy0yJzpcbiAgICAgIGNhc2UgJ3V0ZjE2bGUnOlxuICAgICAgY2FzZSAndXRmLTE2bGUnOlxuICAgICAgICByZXR1cm4gdXRmMTZsZVNsaWNlKHRoaXMsIHN0YXJ0LCBlbmQpXG5cbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGlmIChsb3dlcmVkQ2FzZSkgdGhyb3cgbmV3IFR5cGVFcnJvcignVW5rbm93biBlbmNvZGluZzogJyArIGVuY29kaW5nKVxuICAgICAgICBlbmNvZGluZyA9IChlbmNvZGluZyArICcnKS50b0xvd2VyQ2FzZSgpXG4gICAgICAgIGxvd2VyZWRDYXNlID0gdHJ1ZVxuICAgIH1cbiAgfVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnRvU3RyaW5nID0gZnVuY3Rpb24gdG9TdHJpbmcgKCkge1xuICB2YXIgbGVuZ3RoID0gdGhpcy5sZW5ndGggfCAwXG4gIGlmIChsZW5ndGggPT09IDApIHJldHVybiAnJ1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMCkgcmV0dXJuIHV0ZjhTbGljZSh0aGlzLCAwLCBsZW5ndGgpXG4gIHJldHVybiBzbG93VG9TdHJpbmcuYXBwbHkodGhpcywgYXJndW1lbnRzKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLmVxdWFscyA9IGZ1bmN0aW9uIGVxdWFscyAoYikge1xuICBpZiAoIUJ1ZmZlci5pc0J1ZmZlcihiKSkgdGhyb3cgbmV3IFR5cGVFcnJvcignQXJndW1lbnQgbXVzdCBiZSBhIEJ1ZmZlcicpXG4gIGlmICh0aGlzID09PSBiKSByZXR1cm4gdHJ1ZVxuICByZXR1cm4gQnVmZmVyLmNvbXBhcmUodGhpcywgYikgPT09IDBcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5pbnNwZWN0ID0gZnVuY3Rpb24gaW5zcGVjdCAoKSB7XG4gIHZhciBzdHIgPSAnJ1xuICB2YXIgbWF4ID0gZXhwb3J0cy5JTlNQRUNUX01BWF9CWVRFU1xuICBpZiAodGhpcy5sZW5ndGggPiAwKSB7XG4gICAgc3RyID0gdGhpcy50b1N0cmluZygnaGV4JywgMCwgbWF4KS5tYXRjaCgvLnsyfS9nKS5qb2luKCcgJylcbiAgICBpZiAodGhpcy5sZW5ndGggPiBtYXgpIHN0ciArPSAnIC4uLiAnXG4gIH1cbiAgcmV0dXJuICc8QnVmZmVyICcgKyBzdHIgKyAnPidcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5jb21wYXJlID0gZnVuY3Rpb24gY29tcGFyZSAoYikge1xuICBpZiAoIUJ1ZmZlci5pc0J1ZmZlcihiKSkgdGhyb3cgbmV3IFR5cGVFcnJvcignQXJndW1lbnQgbXVzdCBiZSBhIEJ1ZmZlcicpXG4gIGlmICh0aGlzID09PSBiKSByZXR1cm4gMFxuICByZXR1cm4gQnVmZmVyLmNvbXBhcmUodGhpcywgYilcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5pbmRleE9mID0gZnVuY3Rpb24gaW5kZXhPZiAodmFsLCBieXRlT2Zmc2V0KSB7XG4gIGlmIChieXRlT2Zmc2V0ID4gMHg3ZmZmZmZmZikgYnl0ZU9mZnNldCA9IDB4N2ZmZmZmZmZcbiAgZWxzZSBpZiAoYnl0ZU9mZnNldCA8IC0weDgwMDAwMDAwKSBieXRlT2Zmc2V0ID0gLTB4ODAwMDAwMDBcbiAgYnl0ZU9mZnNldCA+Pj0gMFxuXG4gIGlmICh0aGlzLmxlbmd0aCA9PT0gMCkgcmV0dXJuIC0xXG4gIGlmIChieXRlT2Zmc2V0ID49IHRoaXMubGVuZ3RoKSByZXR1cm4gLTFcblxuICAvLyBOZWdhdGl2ZSBvZmZzZXRzIHN0YXJ0IGZyb20gdGhlIGVuZCBvZiB0aGUgYnVmZmVyXG4gIGlmIChieXRlT2Zmc2V0IDwgMCkgYnl0ZU9mZnNldCA9IE1hdGgubWF4KHRoaXMubGVuZ3RoICsgYnl0ZU9mZnNldCwgMClcblxuICBpZiAodHlwZW9mIHZhbCA9PT0gJ3N0cmluZycpIHtcbiAgICBpZiAodmFsLmxlbmd0aCA9PT0gMCkgcmV0dXJuIC0xIC8vIHNwZWNpYWwgY2FzZTogbG9va2luZyBmb3IgZW1wdHkgc3RyaW5nIGFsd2F5cyBmYWlsc1xuICAgIHJldHVybiBTdHJpbmcucHJvdG90eXBlLmluZGV4T2YuY2FsbCh0aGlzLCB2YWwsIGJ5dGVPZmZzZXQpXG4gIH1cbiAgaWYgKEJ1ZmZlci5pc0J1ZmZlcih2YWwpKSB7XG4gICAgcmV0dXJuIGFycmF5SW5kZXhPZih0aGlzLCB2YWwsIGJ5dGVPZmZzZXQpXG4gIH1cbiAgaWYgKHR5cGVvZiB2YWwgPT09ICdudW1iZXInKSB7XG4gICAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUICYmIFVpbnQ4QXJyYXkucHJvdG90eXBlLmluZGV4T2YgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIHJldHVybiBVaW50OEFycmF5LnByb3RvdHlwZS5pbmRleE9mLmNhbGwodGhpcywgdmFsLCBieXRlT2Zmc2V0KVxuICAgIH1cbiAgICByZXR1cm4gYXJyYXlJbmRleE9mKHRoaXMsIFsgdmFsIF0sIGJ5dGVPZmZzZXQpXG4gIH1cblxuICBmdW5jdGlvbiBhcnJheUluZGV4T2YgKGFyciwgdmFsLCBieXRlT2Zmc2V0KSB7XG4gICAgdmFyIGZvdW5kSW5kZXggPSAtMVxuICAgIGZvciAodmFyIGkgPSAwOyBieXRlT2Zmc2V0ICsgaSA8IGFyci5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKGFycltieXRlT2Zmc2V0ICsgaV0gPT09IHZhbFtmb3VuZEluZGV4ID09PSAtMSA/IDAgOiBpIC0gZm91bmRJbmRleF0pIHtcbiAgICAgICAgaWYgKGZvdW5kSW5kZXggPT09IC0xKSBmb3VuZEluZGV4ID0gaVxuICAgICAgICBpZiAoaSAtIGZvdW5kSW5kZXggKyAxID09PSB2YWwubGVuZ3RoKSByZXR1cm4gYnl0ZU9mZnNldCArIGZvdW5kSW5kZXhcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGZvdW5kSW5kZXggPSAtMVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gLTFcbiAgfVxuXG4gIHRocm93IG5ldyBUeXBlRXJyb3IoJ3ZhbCBtdXN0IGJlIHN0cmluZywgbnVtYmVyIG9yIEJ1ZmZlcicpXG59XG5cbi8vIGBnZXRgIGlzIGRlcHJlY2F0ZWRcbkJ1ZmZlci5wcm90b3R5cGUuZ2V0ID0gZnVuY3Rpb24gZ2V0IChvZmZzZXQpIHtcbiAgY29uc29sZS5sb2coJy5nZXQoKSBpcyBkZXByZWNhdGVkLiBBY2Nlc3MgdXNpbmcgYXJyYXkgaW5kZXhlcyBpbnN0ZWFkLicpXG4gIHJldHVybiB0aGlzLnJlYWRVSW50OChvZmZzZXQpXG59XG5cbi8vIGBzZXRgIGlzIGRlcHJlY2F0ZWRcbkJ1ZmZlci5wcm90b3R5cGUuc2V0ID0gZnVuY3Rpb24gc2V0ICh2LCBvZmZzZXQpIHtcbiAgY29uc29sZS5sb2coJy5zZXQoKSBpcyBkZXByZWNhdGVkLiBBY2Nlc3MgdXNpbmcgYXJyYXkgaW5kZXhlcyBpbnN0ZWFkLicpXG4gIHJldHVybiB0aGlzLndyaXRlVUludDgodiwgb2Zmc2V0KVxufVxuXG5mdW5jdGlvbiBoZXhXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIG9mZnNldCA9IE51bWJlcihvZmZzZXQpIHx8IDBcbiAgdmFyIHJlbWFpbmluZyA9IGJ1Zi5sZW5ndGggLSBvZmZzZXRcbiAgaWYgKCFsZW5ndGgpIHtcbiAgICBsZW5ndGggPSByZW1haW5pbmdcbiAgfSBlbHNlIHtcbiAgICBsZW5ndGggPSBOdW1iZXIobGVuZ3RoKVxuICAgIGlmIChsZW5ndGggPiByZW1haW5pbmcpIHtcbiAgICAgIGxlbmd0aCA9IHJlbWFpbmluZ1xuICAgIH1cbiAgfVxuXG4gIC8vIG11c3QgYmUgYW4gZXZlbiBudW1iZXIgb2YgZGlnaXRzXG4gIHZhciBzdHJMZW4gPSBzdHJpbmcubGVuZ3RoXG4gIGlmIChzdHJMZW4gJSAyICE9PSAwKSB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgaGV4IHN0cmluZycpXG5cbiAgaWYgKGxlbmd0aCA+IHN0ckxlbiAvIDIpIHtcbiAgICBsZW5ndGggPSBzdHJMZW4gLyAyXG4gIH1cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgIHZhciBwYXJzZWQgPSBwYXJzZUludChzdHJpbmcuc3Vic3RyKGkgKiAyLCAyKSwgMTYpXG4gICAgaWYgKGlzTmFOKHBhcnNlZCkpIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBoZXggc3RyaW5nJylcbiAgICBidWZbb2Zmc2V0ICsgaV0gPSBwYXJzZWRcbiAgfVxuICByZXR1cm4gaVxufVxuXG5mdW5jdGlvbiB1dGY4V3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICByZXR1cm4gYmxpdEJ1ZmZlcih1dGY4VG9CeXRlcyhzdHJpbmcsIGJ1Zi5sZW5ndGggLSBvZmZzZXQpLCBidWYsIG9mZnNldCwgbGVuZ3RoKVxufVxuXG5mdW5jdGlvbiBhc2NpaVdyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgcmV0dXJuIGJsaXRCdWZmZXIoYXNjaWlUb0J5dGVzKHN0cmluZyksIGJ1Ziwgb2Zmc2V0LCBsZW5ndGgpXG59XG5cbmZ1bmN0aW9uIGJpbmFyeVdyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgcmV0dXJuIGFzY2lpV3JpdGUoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxufVxuXG5mdW5jdGlvbiBiYXNlNjRXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIHJldHVybiBibGl0QnVmZmVyKGJhc2U2NFRvQnl0ZXMoc3RyaW5nKSwgYnVmLCBvZmZzZXQsIGxlbmd0aClcbn1cblxuZnVuY3Rpb24gdWNzMldyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgcmV0dXJuIGJsaXRCdWZmZXIodXRmMTZsZVRvQnl0ZXMoc3RyaW5nLCBidWYubGVuZ3RoIC0gb2Zmc2V0KSwgYnVmLCBvZmZzZXQsIGxlbmd0aClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZSA9IGZ1bmN0aW9uIHdyaXRlIChzdHJpbmcsIG9mZnNldCwgbGVuZ3RoLCBlbmNvZGluZykge1xuICAvLyBCdWZmZXIjd3JpdGUoc3RyaW5nKVxuICBpZiAob2Zmc2V0ID09PSB1bmRlZmluZWQpIHtcbiAgICBlbmNvZGluZyA9ICd1dGY4J1xuICAgIGxlbmd0aCA9IHRoaXMubGVuZ3RoXG4gICAgb2Zmc2V0ID0gMFxuICAvLyBCdWZmZXIjd3JpdGUoc3RyaW5nLCBlbmNvZGluZylcbiAgfSBlbHNlIGlmIChsZW5ndGggPT09IHVuZGVmaW5lZCAmJiB0eXBlb2Ygb2Zmc2V0ID09PSAnc3RyaW5nJykge1xuICAgIGVuY29kaW5nID0gb2Zmc2V0XG4gICAgbGVuZ3RoID0gdGhpcy5sZW5ndGhcbiAgICBvZmZzZXQgPSAwXG4gIC8vIEJ1ZmZlciN3cml0ZShzdHJpbmcsIG9mZnNldFssIGxlbmd0aF1bLCBlbmNvZGluZ10pXG4gIH0gZWxzZSBpZiAoaXNGaW5pdGUob2Zmc2V0KSkge1xuICAgIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgICBpZiAoaXNGaW5pdGUobGVuZ3RoKSkge1xuICAgICAgbGVuZ3RoID0gbGVuZ3RoIHwgMFxuICAgICAgaWYgKGVuY29kaW5nID09PSB1bmRlZmluZWQpIGVuY29kaW5nID0gJ3V0ZjgnXG4gICAgfSBlbHNlIHtcbiAgICAgIGVuY29kaW5nID0gbGVuZ3RoXG4gICAgICBsZW5ndGggPSB1bmRlZmluZWRcbiAgICB9XG4gIC8vIGxlZ2FjeSB3cml0ZShzdHJpbmcsIGVuY29kaW5nLCBvZmZzZXQsIGxlbmd0aCkgLSByZW1vdmUgaW4gdjAuMTNcbiAgfSBlbHNlIHtcbiAgICB2YXIgc3dhcCA9IGVuY29kaW5nXG4gICAgZW5jb2RpbmcgPSBvZmZzZXRcbiAgICBvZmZzZXQgPSBsZW5ndGggfCAwXG4gICAgbGVuZ3RoID0gc3dhcFxuICB9XG5cbiAgdmFyIHJlbWFpbmluZyA9IHRoaXMubGVuZ3RoIC0gb2Zmc2V0XG4gIGlmIChsZW5ndGggPT09IHVuZGVmaW5lZCB8fCBsZW5ndGggPiByZW1haW5pbmcpIGxlbmd0aCA9IHJlbWFpbmluZ1xuXG4gIGlmICgoc3RyaW5nLmxlbmd0aCA+IDAgJiYgKGxlbmd0aCA8IDAgfHwgb2Zmc2V0IDwgMCkpIHx8IG9mZnNldCA+IHRoaXMubGVuZ3RoKSB7XG4gICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ2F0dGVtcHQgdG8gd3JpdGUgb3V0c2lkZSBidWZmZXIgYm91bmRzJylcbiAgfVxuXG4gIGlmICghZW5jb2RpbmcpIGVuY29kaW5nID0gJ3V0ZjgnXG5cbiAgdmFyIGxvd2VyZWRDYXNlID0gZmFsc2VcbiAgZm9yICg7Oykge1xuICAgIHN3aXRjaCAoZW5jb2RpbmcpIHtcbiAgICAgIGNhc2UgJ2hleCc6XG4gICAgICAgIHJldHVybiBoZXhXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuXG4gICAgICBjYXNlICd1dGY4JzpcbiAgICAgIGNhc2UgJ3V0Zi04JzpcbiAgICAgICAgcmV0dXJuIHV0ZjhXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuXG4gICAgICBjYXNlICdhc2NpaSc6XG4gICAgICAgIHJldHVybiBhc2NpaVdyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG5cbiAgICAgIGNhc2UgJ2JpbmFyeSc6XG4gICAgICAgIHJldHVybiBiaW5hcnlXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuXG4gICAgICBjYXNlICdiYXNlNjQnOlxuICAgICAgICAvLyBXYXJuaW5nOiBtYXhMZW5ndGggbm90IHRha2VuIGludG8gYWNjb3VudCBpbiBiYXNlNjRXcml0ZVxuICAgICAgICByZXR1cm4gYmFzZTY0V3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcblxuICAgICAgY2FzZSAndWNzMic6XG4gICAgICBjYXNlICd1Y3MtMic6XG4gICAgICBjYXNlICd1dGYxNmxlJzpcbiAgICAgIGNhc2UgJ3V0Zi0xNmxlJzpcbiAgICAgICAgcmV0dXJuIHVjczJXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuXG4gICAgICBkZWZhdWx0OlxuICAgICAgICBpZiAobG93ZXJlZENhc2UpIHRocm93IG5ldyBUeXBlRXJyb3IoJ1Vua25vd24gZW5jb2Rpbmc6ICcgKyBlbmNvZGluZylcbiAgICAgICAgZW5jb2RpbmcgPSAoJycgKyBlbmNvZGluZykudG9Mb3dlckNhc2UoKVxuICAgICAgICBsb3dlcmVkQ2FzZSA9IHRydWVcbiAgICB9XG4gIH1cbn1cblxuQnVmZmVyLnByb3RvdHlwZS50b0pTT04gPSBmdW5jdGlvbiB0b0pTT04gKCkge1xuICByZXR1cm4ge1xuICAgIHR5cGU6ICdCdWZmZXInLFxuICAgIGRhdGE6IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKHRoaXMuX2FyciB8fCB0aGlzLCAwKVxuICB9XG59XG5cbmZ1bmN0aW9uIGJhc2U2NFNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgaWYgKHN0YXJ0ID09PSAwICYmIGVuZCA9PT0gYnVmLmxlbmd0aCkge1xuICAgIHJldHVybiBiYXNlNjQuZnJvbUJ5dGVBcnJheShidWYpXG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIGJhc2U2NC5mcm9tQnl0ZUFycmF5KGJ1Zi5zbGljZShzdGFydCwgZW5kKSlcbiAgfVxufVxuXG5mdW5jdGlvbiB1dGY4U2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICBlbmQgPSBNYXRoLm1pbihidWYubGVuZ3RoLCBlbmQpXG4gIHZhciByZXMgPSBbXVxuXG4gIHZhciBpID0gc3RhcnRcbiAgd2hpbGUgKGkgPCBlbmQpIHtcbiAgICB2YXIgZmlyc3RCeXRlID0gYnVmW2ldXG4gICAgdmFyIGNvZGVQb2ludCA9IG51bGxcbiAgICB2YXIgYnl0ZXNQZXJTZXF1ZW5jZSA9IChmaXJzdEJ5dGUgPiAweEVGKSA/IDRcbiAgICAgIDogKGZpcnN0Qnl0ZSA+IDB4REYpID8gM1xuICAgICAgOiAoZmlyc3RCeXRlID4gMHhCRikgPyAyXG4gICAgICA6IDFcblxuICAgIGlmIChpICsgYnl0ZXNQZXJTZXF1ZW5jZSA8PSBlbmQpIHtcbiAgICAgIHZhciBzZWNvbmRCeXRlLCB0aGlyZEJ5dGUsIGZvdXJ0aEJ5dGUsIHRlbXBDb2RlUG9pbnRcblxuICAgICAgc3dpdGNoIChieXRlc1BlclNlcXVlbmNlKSB7XG4gICAgICAgIGNhc2UgMTpcbiAgICAgICAgICBpZiAoZmlyc3RCeXRlIDwgMHg4MCkge1xuICAgICAgICAgICAgY29kZVBvaW50ID0gZmlyc3RCeXRlXG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrXG4gICAgICAgIGNhc2UgMjpcbiAgICAgICAgICBzZWNvbmRCeXRlID0gYnVmW2kgKyAxXVxuICAgICAgICAgIGlmICgoc2Vjb25kQnl0ZSAmIDB4QzApID09PSAweDgwKSB7XG4gICAgICAgICAgICB0ZW1wQ29kZVBvaW50ID0gKGZpcnN0Qnl0ZSAmIDB4MUYpIDw8IDB4NiB8IChzZWNvbmRCeXRlICYgMHgzRilcbiAgICAgICAgICAgIGlmICh0ZW1wQ29kZVBvaW50ID4gMHg3Rikge1xuICAgICAgICAgICAgICBjb2RlUG9pbnQgPSB0ZW1wQ29kZVBvaW50XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrXG4gICAgICAgIGNhc2UgMzpcbiAgICAgICAgICBzZWNvbmRCeXRlID0gYnVmW2kgKyAxXVxuICAgICAgICAgIHRoaXJkQnl0ZSA9IGJ1ZltpICsgMl1cbiAgICAgICAgICBpZiAoKHNlY29uZEJ5dGUgJiAweEMwKSA9PT0gMHg4MCAmJiAodGhpcmRCeXRlICYgMHhDMCkgPT09IDB4ODApIHtcbiAgICAgICAgICAgIHRlbXBDb2RlUG9pbnQgPSAoZmlyc3RCeXRlICYgMHhGKSA8PCAweEMgfCAoc2Vjb25kQnl0ZSAmIDB4M0YpIDw8IDB4NiB8ICh0aGlyZEJ5dGUgJiAweDNGKVxuICAgICAgICAgICAgaWYgKHRlbXBDb2RlUG9pbnQgPiAweDdGRiAmJiAodGVtcENvZGVQb2ludCA8IDB4RDgwMCB8fCB0ZW1wQ29kZVBvaW50ID4gMHhERkZGKSkge1xuICAgICAgICAgICAgICBjb2RlUG9pbnQgPSB0ZW1wQ29kZVBvaW50XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrXG4gICAgICAgIGNhc2UgNDpcbiAgICAgICAgICBzZWNvbmRCeXRlID0gYnVmW2kgKyAxXVxuICAgICAgICAgIHRoaXJkQnl0ZSA9IGJ1ZltpICsgMl1cbiAgICAgICAgICBmb3VydGhCeXRlID0gYnVmW2kgKyAzXVxuICAgICAgICAgIGlmICgoc2Vjb25kQnl0ZSAmIDB4QzApID09PSAweDgwICYmICh0aGlyZEJ5dGUgJiAweEMwKSA9PT0gMHg4MCAmJiAoZm91cnRoQnl0ZSAmIDB4QzApID09PSAweDgwKSB7XG4gICAgICAgICAgICB0ZW1wQ29kZVBvaW50ID0gKGZpcnN0Qnl0ZSAmIDB4RikgPDwgMHgxMiB8IChzZWNvbmRCeXRlICYgMHgzRikgPDwgMHhDIHwgKHRoaXJkQnl0ZSAmIDB4M0YpIDw8IDB4NiB8IChmb3VydGhCeXRlICYgMHgzRilcbiAgICAgICAgICAgIGlmICh0ZW1wQ29kZVBvaW50ID4gMHhGRkZGICYmIHRlbXBDb2RlUG9pbnQgPCAweDExMDAwMCkge1xuICAgICAgICAgICAgICBjb2RlUG9pbnQgPSB0ZW1wQ29kZVBvaW50XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChjb2RlUG9pbnQgPT09IG51bGwpIHtcbiAgICAgIC8vIHdlIGRpZCBub3QgZ2VuZXJhdGUgYSB2YWxpZCBjb2RlUG9pbnQgc28gaW5zZXJ0IGFcbiAgICAgIC8vIHJlcGxhY2VtZW50IGNoYXIgKFUrRkZGRCkgYW5kIGFkdmFuY2Ugb25seSAxIGJ5dGVcbiAgICAgIGNvZGVQb2ludCA9IDB4RkZGRFxuICAgICAgYnl0ZXNQZXJTZXF1ZW5jZSA9IDFcbiAgICB9IGVsc2UgaWYgKGNvZGVQb2ludCA+IDB4RkZGRikge1xuICAgICAgLy8gZW5jb2RlIHRvIHV0ZjE2IChzdXJyb2dhdGUgcGFpciBkYW5jZSlcbiAgICAgIGNvZGVQb2ludCAtPSAweDEwMDAwXG4gICAgICByZXMucHVzaChjb2RlUG9pbnQgPj4+IDEwICYgMHgzRkYgfCAweEQ4MDApXG4gICAgICBjb2RlUG9pbnQgPSAweERDMDAgfCBjb2RlUG9pbnQgJiAweDNGRlxuICAgIH1cblxuICAgIHJlcy5wdXNoKGNvZGVQb2ludClcbiAgICBpICs9IGJ5dGVzUGVyU2VxdWVuY2VcbiAgfVxuXG4gIHJldHVybiBkZWNvZGVDb2RlUG9pbnRzQXJyYXkocmVzKVxufVxuXG4vLyBCYXNlZCBvbiBodHRwOi8vc3RhY2tvdmVyZmxvdy5jb20vYS8yMjc0NzI3Mi82ODA3NDIsIHRoZSBicm93c2VyIHdpdGhcbi8vIHRoZSBsb3dlc3QgbGltaXQgaXMgQ2hyb21lLCB3aXRoIDB4MTAwMDAgYXJncy5cbi8vIFdlIGdvIDEgbWFnbml0dWRlIGxlc3MsIGZvciBzYWZldHlcbnZhciBNQVhfQVJHVU1FTlRTX0xFTkdUSCA9IDB4MTAwMFxuXG5mdW5jdGlvbiBkZWNvZGVDb2RlUG9pbnRzQXJyYXkgKGNvZGVQb2ludHMpIHtcbiAgdmFyIGxlbiA9IGNvZGVQb2ludHMubGVuZ3RoXG4gIGlmIChsZW4gPD0gTUFYX0FSR1VNRU5UU19MRU5HVEgpIHtcbiAgICByZXR1cm4gU3RyaW5nLmZyb21DaGFyQ29kZS5hcHBseShTdHJpbmcsIGNvZGVQb2ludHMpIC8vIGF2b2lkIGV4dHJhIHNsaWNlKClcbiAgfVxuXG4gIC8vIERlY29kZSBpbiBjaHVua3MgdG8gYXZvaWQgXCJjYWxsIHN0YWNrIHNpemUgZXhjZWVkZWRcIi5cbiAgdmFyIHJlcyA9ICcnXG4gIHZhciBpID0gMFxuICB3aGlsZSAoaSA8IGxlbikge1xuICAgIHJlcyArPSBTdHJpbmcuZnJvbUNoYXJDb2RlLmFwcGx5KFxuICAgICAgU3RyaW5nLFxuICAgICAgY29kZVBvaW50cy5zbGljZShpLCBpICs9IE1BWF9BUkdVTUVOVFNfTEVOR1RIKVxuICAgIClcbiAgfVxuICByZXR1cm4gcmVzXG59XG5cbmZ1bmN0aW9uIGFzY2lpU2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICB2YXIgcmV0ID0gJydcbiAgZW5kID0gTWF0aC5taW4oYnVmLmxlbmd0aCwgZW5kKVxuXG4gIGZvciAodmFyIGkgPSBzdGFydDsgaSA8IGVuZDsgaSsrKSB7XG4gICAgcmV0ICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoYnVmW2ldICYgMHg3RilcbiAgfVxuICByZXR1cm4gcmV0XG59XG5cbmZ1bmN0aW9uIGJpbmFyeVNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIHJldCA9ICcnXG4gIGVuZCA9IE1hdGgubWluKGJ1Zi5sZW5ndGgsIGVuZClcblxuICBmb3IgKHZhciBpID0gc3RhcnQ7IGkgPCBlbmQ7IGkrKykge1xuICAgIHJldCArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGJ1ZltpXSlcbiAgfVxuICByZXR1cm4gcmV0XG59XG5cbmZ1bmN0aW9uIGhleFNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIGxlbiA9IGJ1Zi5sZW5ndGhcblxuICBpZiAoIXN0YXJ0IHx8IHN0YXJ0IDwgMCkgc3RhcnQgPSAwXG4gIGlmICghZW5kIHx8IGVuZCA8IDAgfHwgZW5kID4gbGVuKSBlbmQgPSBsZW5cblxuICB2YXIgb3V0ID0gJydcbiAgZm9yICh2YXIgaSA9IHN0YXJ0OyBpIDwgZW5kOyBpKyspIHtcbiAgICBvdXQgKz0gdG9IZXgoYnVmW2ldKVxuICB9XG4gIHJldHVybiBvdXRcbn1cblxuZnVuY3Rpb24gdXRmMTZsZVNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIGJ5dGVzID0gYnVmLnNsaWNlKHN0YXJ0LCBlbmQpXG4gIHZhciByZXMgPSAnJ1xuICBmb3IgKHZhciBpID0gMDsgaSA8IGJ5dGVzLmxlbmd0aDsgaSArPSAyKSB7XG4gICAgcmVzICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoYnl0ZXNbaV0gKyBieXRlc1tpICsgMV0gKiAyNTYpXG4gIH1cbiAgcmV0dXJuIHJlc1xufVxuXG5CdWZmZXIucHJvdG90eXBlLnNsaWNlID0gZnVuY3Rpb24gc2xpY2UgKHN0YXJ0LCBlbmQpIHtcbiAgdmFyIGxlbiA9IHRoaXMubGVuZ3RoXG4gIHN0YXJ0ID0gfn5zdGFydFxuICBlbmQgPSBlbmQgPT09IHVuZGVmaW5lZCA/IGxlbiA6IH5+ZW5kXG5cbiAgaWYgKHN0YXJ0IDwgMCkge1xuICAgIHN0YXJ0ICs9IGxlblxuICAgIGlmIChzdGFydCA8IDApIHN0YXJ0ID0gMFxuICB9IGVsc2UgaWYgKHN0YXJ0ID4gbGVuKSB7XG4gICAgc3RhcnQgPSBsZW5cbiAgfVxuXG4gIGlmIChlbmQgPCAwKSB7XG4gICAgZW5kICs9IGxlblxuICAgIGlmIChlbmQgPCAwKSBlbmQgPSAwXG4gIH0gZWxzZSBpZiAoZW5kID4gbGVuKSB7XG4gICAgZW5kID0gbGVuXG4gIH1cblxuICBpZiAoZW5kIDwgc3RhcnQpIGVuZCA9IHN0YXJ0XG5cbiAgdmFyIG5ld0J1ZlxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICBuZXdCdWYgPSBCdWZmZXIuX2F1Z21lbnQodGhpcy5zdWJhcnJheShzdGFydCwgZW5kKSlcbiAgfSBlbHNlIHtcbiAgICB2YXIgc2xpY2VMZW4gPSBlbmQgLSBzdGFydFxuICAgIG5ld0J1ZiA9IG5ldyBCdWZmZXIoc2xpY2VMZW4sIHVuZGVmaW5lZClcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHNsaWNlTGVuOyBpKyspIHtcbiAgICAgIG5ld0J1ZltpXSA9IHRoaXNbaSArIHN0YXJ0XVxuICAgIH1cbiAgfVxuXG4gIGlmIChuZXdCdWYubGVuZ3RoKSBuZXdCdWYucGFyZW50ID0gdGhpcy5wYXJlbnQgfHwgdGhpc1xuXG4gIHJldHVybiBuZXdCdWZcbn1cblxuLypcbiAqIE5lZWQgdG8gbWFrZSBzdXJlIHRoYXQgYnVmZmVyIGlzbid0IHRyeWluZyB0byB3cml0ZSBvdXQgb2YgYm91bmRzLlxuICovXG5mdW5jdGlvbiBjaGVja09mZnNldCAob2Zmc2V0LCBleHQsIGxlbmd0aCkge1xuICBpZiAoKG9mZnNldCAlIDEpICE9PSAwIHx8IG9mZnNldCA8IDApIHRocm93IG5ldyBSYW5nZUVycm9yKCdvZmZzZXQgaXMgbm90IHVpbnQnKVxuICBpZiAob2Zmc2V0ICsgZXh0ID4gbGVuZ3RoKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignVHJ5aW5nIHRvIGFjY2VzcyBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnRMRSA9IGZ1bmN0aW9uIHJlYWRVSW50TEUgKG9mZnNldCwgYnl0ZUxlbmd0aCwgbm9Bc3NlcnQpIHtcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBieXRlTGVuZ3RoID0gYnl0ZUxlbmd0aCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCBieXRlTGVuZ3RoLCB0aGlzLmxlbmd0aClcblxuICB2YXIgdmFsID0gdGhpc1tvZmZzZXRdXG4gIHZhciBtdWwgPSAxXG4gIHZhciBpID0gMFxuICB3aGlsZSAoKytpIDwgYnl0ZUxlbmd0aCAmJiAobXVsICo9IDB4MTAwKSkge1xuICAgIHZhbCArPSB0aGlzW29mZnNldCArIGldICogbXVsXG4gIH1cblxuICByZXR1cm4gdmFsXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnRCRSA9IGZ1bmN0aW9uIHJlYWRVSW50QkUgKG9mZnNldCwgYnl0ZUxlbmd0aCwgbm9Bc3NlcnQpIHtcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBieXRlTGVuZ3RoID0gYnl0ZUxlbmd0aCB8IDBcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGNoZWNrT2Zmc2V0KG9mZnNldCwgYnl0ZUxlbmd0aCwgdGhpcy5sZW5ndGgpXG4gIH1cblxuICB2YXIgdmFsID0gdGhpc1tvZmZzZXQgKyAtLWJ5dGVMZW5ndGhdXG4gIHZhciBtdWwgPSAxXG4gIHdoaWxlIChieXRlTGVuZ3RoID4gMCAmJiAobXVsICo9IDB4MTAwKSkge1xuICAgIHZhbCArPSB0aGlzW29mZnNldCArIC0tYnl0ZUxlbmd0aF0gKiBtdWxcbiAgfVxuXG4gIHJldHVybiB2YWxcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDggPSBmdW5jdGlvbiByZWFkVUludDggKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCAxLCB0aGlzLmxlbmd0aClcbiAgcmV0dXJuIHRoaXNbb2Zmc2V0XVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50MTZMRSA9IGZ1bmN0aW9uIHJlYWRVSW50MTZMRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDIsIHRoaXMubGVuZ3RoKVxuICByZXR1cm4gdGhpc1tvZmZzZXRdIHwgKHRoaXNbb2Zmc2V0ICsgMV0gPDwgOClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDE2QkUgPSBmdW5jdGlvbiByZWFkVUludDE2QkUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCAyLCB0aGlzLmxlbmd0aClcbiAgcmV0dXJuICh0aGlzW29mZnNldF0gPDwgOCkgfCB0aGlzW29mZnNldCArIDFdXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnQzMkxFID0gZnVuY3Rpb24gcmVhZFVJbnQzMkxFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgNCwgdGhpcy5sZW5ndGgpXG5cbiAgcmV0dXJuICgodGhpc1tvZmZzZXRdKSB8XG4gICAgICAodGhpc1tvZmZzZXQgKyAxXSA8PCA4KSB8XG4gICAgICAodGhpc1tvZmZzZXQgKyAyXSA8PCAxNikpICtcbiAgICAgICh0aGlzW29mZnNldCArIDNdICogMHgxMDAwMDAwKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50MzJCRSA9IGZ1bmN0aW9uIHJlYWRVSW50MzJCRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDQsIHRoaXMubGVuZ3RoKVxuXG4gIHJldHVybiAodGhpc1tvZmZzZXRdICogMHgxMDAwMDAwKSArXG4gICAgKCh0aGlzW29mZnNldCArIDFdIDw8IDE2KSB8XG4gICAgKHRoaXNbb2Zmc2V0ICsgMl0gPDwgOCkgfFxuICAgIHRoaXNbb2Zmc2V0ICsgM10pXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludExFID0gZnVuY3Rpb24gcmVhZEludExFIChvZmZzZXQsIGJ5dGVMZW5ndGgsIG5vQXNzZXJ0KSB7XG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgYnl0ZUxlbmd0aCA9IGJ5dGVMZW5ndGggfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgYnl0ZUxlbmd0aCwgdGhpcy5sZW5ndGgpXG5cbiAgdmFyIHZhbCA9IHRoaXNbb2Zmc2V0XVxuICB2YXIgbXVsID0gMVxuICB2YXIgaSA9IDBcbiAgd2hpbGUgKCsraSA8IGJ5dGVMZW5ndGggJiYgKG11bCAqPSAweDEwMCkpIHtcbiAgICB2YWwgKz0gdGhpc1tvZmZzZXQgKyBpXSAqIG11bFxuICB9XG4gIG11bCAqPSAweDgwXG5cbiAgaWYgKHZhbCA+PSBtdWwpIHZhbCAtPSBNYXRoLnBvdygyLCA4ICogYnl0ZUxlbmd0aClcblxuICByZXR1cm4gdmFsXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludEJFID0gZnVuY3Rpb24gcmVhZEludEJFIChvZmZzZXQsIGJ5dGVMZW5ndGgsIG5vQXNzZXJ0KSB7XG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgYnl0ZUxlbmd0aCA9IGJ5dGVMZW5ndGggfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgYnl0ZUxlbmd0aCwgdGhpcy5sZW5ndGgpXG5cbiAgdmFyIGkgPSBieXRlTGVuZ3RoXG4gIHZhciBtdWwgPSAxXG4gIHZhciB2YWwgPSB0aGlzW29mZnNldCArIC0taV1cbiAgd2hpbGUgKGkgPiAwICYmIChtdWwgKj0gMHgxMDApKSB7XG4gICAgdmFsICs9IHRoaXNbb2Zmc2V0ICsgLS1pXSAqIG11bFxuICB9XG4gIG11bCAqPSAweDgwXG5cbiAgaWYgKHZhbCA+PSBtdWwpIHZhbCAtPSBNYXRoLnBvdygyLCA4ICogYnl0ZUxlbmd0aClcblxuICByZXR1cm4gdmFsXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDggPSBmdW5jdGlvbiByZWFkSW50OCAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDEsIHRoaXMubGVuZ3RoKVxuICBpZiAoISh0aGlzW29mZnNldF0gJiAweDgwKSkgcmV0dXJuICh0aGlzW29mZnNldF0pXG4gIHJldHVybiAoKDB4ZmYgLSB0aGlzW29mZnNldF0gKyAxKSAqIC0xKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnQxNkxFID0gZnVuY3Rpb24gcmVhZEludDE2TEUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCAyLCB0aGlzLmxlbmd0aClcbiAgdmFyIHZhbCA9IHRoaXNbb2Zmc2V0XSB8ICh0aGlzW29mZnNldCArIDFdIDw8IDgpXG4gIHJldHVybiAodmFsICYgMHg4MDAwKSA/IHZhbCB8IDB4RkZGRjAwMDAgOiB2YWxcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50MTZCRSA9IGZ1bmN0aW9uIHJlYWRJbnQxNkJFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgMiwgdGhpcy5sZW5ndGgpXG4gIHZhciB2YWwgPSB0aGlzW29mZnNldCArIDFdIHwgKHRoaXNbb2Zmc2V0XSA8PCA4KVxuICByZXR1cm4gKHZhbCAmIDB4ODAwMCkgPyB2YWwgfCAweEZGRkYwMDAwIDogdmFsXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDMyTEUgPSBmdW5jdGlvbiByZWFkSW50MzJMRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDQsIHRoaXMubGVuZ3RoKVxuXG4gIHJldHVybiAodGhpc1tvZmZzZXRdKSB8XG4gICAgKHRoaXNbb2Zmc2V0ICsgMV0gPDwgOCkgfFxuICAgICh0aGlzW29mZnNldCArIDJdIDw8IDE2KSB8XG4gICAgKHRoaXNbb2Zmc2V0ICsgM10gPDwgMjQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDMyQkUgPSBmdW5jdGlvbiByZWFkSW50MzJCRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDQsIHRoaXMubGVuZ3RoKVxuXG4gIHJldHVybiAodGhpc1tvZmZzZXRdIDw8IDI0KSB8XG4gICAgKHRoaXNbb2Zmc2V0ICsgMV0gPDwgMTYpIHxcbiAgICAodGhpc1tvZmZzZXQgKyAyXSA8PCA4KSB8XG4gICAgKHRoaXNbb2Zmc2V0ICsgM10pXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEZsb2F0TEUgPSBmdW5jdGlvbiByZWFkRmxvYXRMRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDQsIHRoaXMubGVuZ3RoKVxuICByZXR1cm4gaWVlZTc1NC5yZWFkKHRoaXMsIG9mZnNldCwgdHJ1ZSwgMjMsIDQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEZsb2F0QkUgPSBmdW5jdGlvbiByZWFkRmxvYXRCRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDQsIHRoaXMubGVuZ3RoKVxuICByZXR1cm4gaWVlZTc1NC5yZWFkKHRoaXMsIG9mZnNldCwgZmFsc2UsIDIzLCA0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWREb3VibGVMRSA9IGZ1bmN0aW9uIHJlYWREb3VibGVMRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDgsIHRoaXMubGVuZ3RoKVxuICByZXR1cm4gaWVlZTc1NC5yZWFkKHRoaXMsIG9mZnNldCwgdHJ1ZSwgNTIsIDgpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZERvdWJsZUJFID0gZnVuY3Rpb24gcmVhZERvdWJsZUJFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgOCwgdGhpcy5sZW5ndGgpXG4gIHJldHVybiBpZWVlNzU0LnJlYWQodGhpcywgb2Zmc2V0LCBmYWxzZSwgNTIsIDgpXG59XG5cbmZ1bmN0aW9uIGNoZWNrSW50IChidWYsIHZhbHVlLCBvZmZzZXQsIGV4dCwgbWF4LCBtaW4pIHtcbiAgaWYgKCFCdWZmZXIuaXNCdWZmZXIoYnVmKSkgdGhyb3cgbmV3IFR5cGVFcnJvcignYnVmZmVyIG11c3QgYmUgYSBCdWZmZXIgaW5zdGFuY2UnKVxuICBpZiAodmFsdWUgPiBtYXggfHwgdmFsdWUgPCBtaW4pIHRocm93IG5ldyBSYW5nZUVycm9yKCd2YWx1ZSBpcyBvdXQgb2YgYm91bmRzJylcbiAgaWYgKG9mZnNldCArIGV4dCA+IGJ1Zi5sZW5ndGgpIHRocm93IG5ldyBSYW5nZUVycm9yKCdpbmRleCBvdXQgb2YgcmFuZ2UnKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludExFID0gZnVuY3Rpb24gd3JpdGVVSW50TEUgKHZhbHVlLCBvZmZzZXQsIGJ5dGVMZW5ndGgsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgYnl0ZUxlbmd0aCA9IGJ5dGVMZW5ndGggfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIGJ5dGVMZW5ndGgsIE1hdGgucG93KDIsIDggKiBieXRlTGVuZ3RoKSwgMClcblxuICB2YXIgbXVsID0gMVxuICB2YXIgaSA9IDBcbiAgdGhpc1tvZmZzZXRdID0gdmFsdWUgJiAweEZGXG4gIHdoaWxlICgrK2kgPCBieXRlTGVuZ3RoICYmIChtdWwgKj0gMHgxMDApKSB7XG4gICAgdGhpc1tvZmZzZXQgKyBpXSA9ICh2YWx1ZSAvIG11bCkgJiAweEZGXG4gIH1cblxuICByZXR1cm4gb2Zmc2V0ICsgYnl0ZUxlbmd0aFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludEJFID0gZnVuY3Rpb24gd3JpdGVVSW50QkUgKHZhbHVlLCBvZmZzZXQsIGJ5dGVMZW5ndGgsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgYnl0ZUxlbmd0aCA9IGJ5dGVMZW5ndGggfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIGJ5dGVMZW5ndGgsIE1hdGgucG93KDIsIDggKiBieXRlTGVuZ3RoKSwgMClcblxuICB2YXIgaSA9IGJ5dGVMZW5ndGggLSAxXG4gIHZhciBtdWwgPSAxXG4gIHRoaXNbb2Zmc2V0ICsgaV0gPSB2YWx1ZSAmIDB4RkZcbiAgd2hpbGUgKC0taSA+PSAwICYmIChtdWwgKj0gMHgxMDApKSB7XG4gICAgdGhpc1tvZmZzZXQgKyBpXSA9ICh2YWx1ZSAvIG11bCkgJiAweEZGXG4gIH1cblxuICByZXR1cm4gb2Zmc2V0ICsgYnl0ZUxlbmd0aFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludDggPSBmdW5jdGlvbiB3cml0ZVVJbnQ4ICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDEsIDB4ZmYsIDApXG4gIGlmICghQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHZhbHVlID0gTWF0aC5mbG9vcih2YWx1ZSlcbiAgdGhpc1tvZmZzZXRdID0gdmFsdWVcbiAgcmV0dXJuIG9mZnNldCArIDFcbn1cblxuZnVuY3Rpb24gb2JqZWN0V3JpdGVVSW50MTYgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuKSB7XG4gIGlmICh2YWx1ZSA8IDApIHZhbHVlID0gMHhmZmZmICsgdmFsdWUgKyAxXG4gIGZvciAodmFyIGkgPSAwLCBqID0gTWF0aC5taW4oYnVmLmxlbmd0aCAtIG9mZnNldCwgMik7IGkgPCBqOyBpKyspIHtcbiAgICBidWZbb2Zmc2V0ICsgaV0gPSAodmFsdWUgJiAoMHhmZiA8PCAoOCAqIChsaXR0bGVFbmRpYW4gPyBpIDogMSAtIGkpKSkpID4+PlxuICAgICAgKGxpdHRsZUVuZGlhbiA/IGkgOiAxIC0gaSkgKiA4XG4gIH1cbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnQxNkxFID0gZnVuY3Rpb24gd3JpdGVVSW50MTZMRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCAyLCAweGZmZmYsIDApXG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIHRoaXNbb2Zmc2V0XSA9IHZhbHVlXG4gICAgdGhpc1tvZmZzZXQgKyAxXSA9ICh2YWx1ZSA+Pj4gOClcbiAgfSBlbHNlIHtcbiAgICBvYmplY3RXcml0ZVVJbnQxNih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCB0cnVlKVxuICB9XG4gIHJldHVybiBvZmZzZXQgKyAyXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50MTZCRSA9IGZ1bmN0aW9uIHdyaXRlVUludDE2QkUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgMiwgMHhmZmZmLCAwKVxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICB0aGlzW29mZnNldF0gPSAodmFsdWUgPj4+IDgpXG4gICAgdGhpc1tvZmZzZXQgKyAxXSA9IHZhbHVlXG4gIH0gZWxzZSB7XG4gICAgb2JqZWN0V3JpdGVVSW50MTYodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UpXG4gIH1cbiAgcmV0dXJuIG9mZnNldCArIDJcbn1cblxuZnVuY3Rpb24gb2JqZWN0V3JpdGVVSW50MzIgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuKSB7XG4gIGlmICh2YWx1ZSA8IDApIHZhbHVlID0gMHhmZmZmZmZmZiArIHZhbHVlICsgMVxuICBmb3IgKHZhciBpID0gMCwgaiA9IE1hdGgubWluKGJ1Zi5sZW5ndGggLSBvZmZzZXQsIDQpOyBpIDwgajsgaSsrKSB7XG4gICAgYnVmW29mZnNldCArIGldID0gKHZhbHVlID4+PiAobGl0dGxlRW5kaWFuID8gaSA6IDMgLSBpKSAqIDgpICYgMHhmZlxuICB9XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50MzJMRSA9IGZ1bmN0aW9uIHdyaXRlVUludDMyTEUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgNCwgMHhmZmZmZmZmZiwgMClcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgdGhpc1tvZmZzZXQgKyAzXSA9ICh2YWx1ZSA+Pj4gMjQpXG4gICAgdGhpc1tvZmZzZXQgKyAyXSA9ICh2YWx1ZSA+Pj4gMTYpXG4gICAgdGhpc1tvZmZzZXQgKyAxXSA9ICh2YWx1ZSA+Pj4gOClcbiAgICB0aGlzW29mZnNldF0gPSB2YWx1ZVxuICB9IGVsc2Uge1xuICAgIG9iamVjdFdyaXRlVUludDMyKHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUpXG4gIH1cbiAgcmV0dXJuIG9mZnNldCArIDRcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnQzMkJFID0gZnVuY3Rpb24gd3JpdGVVSW50MzJCRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCA0LCAweGZmZmZmZmZmLCAwKVxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICB0aGlzW29mZnNldF0gPSAodmFsdWUgPj4+IDI0KVxuICAgIHRoaXNbb2Zmc2V0ICsgMV0gPSAodmFsdWUgPj4+IDE2KVxuICAgIHRoaXNbb2Zmc2V0ICsgMl0gPSAodmFsdWUgPj4+IDgpXG4gICAgdGhpc1tvZmZzZXQgKyAzXSA9IHZhbHVlXG4gIH0gZWxzZSB7XG4gICAgb2JqZWN0V3JpdGVVSW50MzIodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UpXG4gIH1cbiAgcmV0dXJuIG9mZnNldCArIDRcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludExFID0gZnVuY3Rpb24gd3JpdGVJbnRMRSAodmFsdWUsIG9mZnNldCwgYnl0ZUxlbmd0aCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgdmFyIGxpbWl0ID0gTWF0aC5wb3coMiwgOCAqIGJ5dGVMZW5ndGggLSAxKVxuXG4gICAgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgYnl0ZUxlbmd0aCwgbGltaXQgLSAxLCAtbGltaXQpXG4gIH1cblxuICB2YXIgaSA9IDBcbiAgdmFyIG11bCA9IDFcbiAgdmFyIHN1YiA9IHZhbHVlIDwgMCA/IDEgOiAwXG4gIHRoaXNbb2Zmc2V0XSA9IHZhbHVlICYgMHhGRlxuICB3aGlsZSAoKytpIDwgYnl0ZUxlbmd0aCAmJiAobXVsICo9IDB4MTAwKSkge1xuICAgIHRoaXNbb2Zmc2V0ICsgaV0gPSAoKHZhbHVlIC8gbXVsKSA+PiAwKSAtIHN1YiAmIDB4RkZcbiAgfVxuXG4gIHJldHVybiBvZmZzZXQgKyBieXRlTGVuZ3RoXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnRCRSA9IGZ1bmN0aW9uIHdyaXRlSW50QkUgKHZhbHVlLCBvZmZzZXQsIGJ5dGVMZW5ndGgsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIHZhciBsaW1pdCA9IE1hdGgucG93KDIsIDggKiBieXRlTGVuZ3RoIC0gMSlcblxuICAgIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIGJ5dGVMZW5ndGgsIGxpbWl0IC0gMSwgLWxpbWl0KVxuICB9XG5cbiAgdmFyIGkgPSBieXRlTGVuZ3RoIC0gMVxuICB2YXIgbXVsID0gMVxuICB2YXIgc3ViID0gdmFsdWUgPCAwID8gMSA6IDBcbiAgdGhpc1tvZmZzZXQgKyBpXSA9IHZhbHVlICYgMHhGRlxuICB3aGlsZSAoLS1pID49IDAgJiYgKG11bCAqPSAweDEwMCkpIHtcbiAgICB0aGlzW29mZnNldCArIGldID0gKCh2YWx1ZSAvIG11bCkgPj4gMCkgLSBzdWIgJiAweEZGXG4gIH1cblxuICByZXR1cm4gb2Zmc2V0ICsgYnl0ZUxlbmd0aFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50OCA9IGZ1bmN0aW9uIHdyaXRlSW50OCAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCAxLCAweDdmLCAtMHg4MClcbiAgaWYgKCFCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkgdmFsdWUgPSBNYXRoLmZsb29yKHZhbHVlKVxuICBpZiAodmFsdWUgPCAwKSB2YWx1ZSA9IDB4ZmYgKyB2YWx1ZSArIDFcbiAgdGhpc1tvZmZzZXRdID0gdmFsdWVcbiAgcmV0dXJuIG9mZnNldCArIDFcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludDE2TEUgPSBmdW5jdGlvbiB3cml0ZUludDE2TEUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgMiwgMHg3ZmZmLCAtMHg4MDAwKVxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICB0aGlzW29mZnNldF0gPSB2YWx1ZVxuICAgIHRoaXNbb2Zmc2V0ICsgMV0gPSAodmFsdWUgPj4+IDgpXG4gIH0gZWxzZSB7XG4gICAgb2JqZWN0V3JpdGVVSW50MTYodGhpcywgdmFsdWUsIG9mZnNldCwgdHJ1ZSlcbiAgfVxuICByZXR1cm4gb2Zmc2V0ICsgMlxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50MTZCRSA9IGZ1bmN0aW9uIHdyaXRlSW50MTZCRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCAyLCAweDdmZmYsIC0weDgwMDApXG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIHRoaXNbb2Zmc2V0XSA9ICh2YWx1ZSA+Pj4gOClcbiAgICB0aGlzW29mZnNldCArIDFdID0gdmFsdWVcbiAgfSBlbHNlIHtcbiAgICBvYmplY3RXcml0ZVVJbnQxNih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBmYWxzZSlcbiAgfVxuICByZXR1cm4gb2Zmc2V0ICsgMlxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50MzJMRSA9IGZ1bmN0aW9uIHdyaXRlSW50MzJMRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCA0LCAweDdmZmZmZmZmLCAtMHg4MDAwMDAwMClcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgdGhpc1tvZmZzZXRdID0gdmFsdWVcbiAgICB0aGlzW29mZnNldCArIDFdID0gKHZhbHVlID4+PiA4KVxuICAgIHRoaXNbb2Zmc2V0ICsgMl0gPSAodmFsdWUgPj4+IDE2KVxuICAgIHRoaXNbb2Zmc2V0ICsgM10gPSAodmFsdWUgPj4+IDI0KVxuICB9IGVsc2Uge1xuICAgIG9iamVjdFdyaXRlVUludDMyKHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUpXG4gIH1cbiAgcmV0dXJuIG9mZnNldCArIDRcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludDMyQkUgPSBmdW5jdGlvbiB3cml0ZUludDMyQkUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgNCwgMHg3ZmZmZmZmZiwgLTB4ODAwMDAwMDApXG4gIGlmICh2YWx1ZSA8IDApIHZhbHVlID0gMHhmZmZmZmZmZiArIHZhbHVlICsgMVxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICB0aGlzW29mZnNldF0gPSAodmFsdWUgPj4+IDI0KVxuICAgIHRoaXNbb2Zmc2V0ICsgMV0gPSAodmFsdWUgPj4+IDE2KVxuICAgIHRoaXNbb2Zmc2V0ICsgMl0gPSAodmFsdWUgPj4+IDgpXG4gICAgdGhpc1tvZmZzZXQgKyAzXSA9IHZhbHVlXG4gIH0gZWxzZSB7XG4gICAgb2JqZWN0V3JpdGVVSW50MzIodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UpXG4gIH1cbiAgcmV0dXJuIG9mZnNldCArIDRcbn1cblxuZnVuY3Rpb24gY2hlY2tJRUVFNzU0IChidWYsIHZhbHVlLCBvZmZzZXQsIGV4dCwgbWF4LCBtaW4pIHtcbiAgaWYgKHZhbHVlID4gbWF4IHx8IHZhbHVlIDwgbWluKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcigndmFsdWUgaXMgb3V0IG9mIGJvdW5kcycpXG4gIGlmIChvZmZzZXQgKyBleHQgPiBidWYubGVuZ3RoKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignaW5kZXggb3V0IG9mIHJhbmdlJylcbiAgaWYgKG9mZnNldCA8IDApIHRocm93IG5ldyBSYW5nZUVycm9yKCdpbmRleCBvdXQgb2YgcmFuZ2UnKVxufVxuXG5mdW5jdGlvbiB3cml0ZUZsb2F0IChidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGNoZWNrSUVFRTc1NChidWYsIHZhbHVlLCBvZmZzZXQsIDQsIDMuNDAyODIzNDY2Mzg1Mjg4NmUrMzgsIC0zLjQwMjgyMzQ2NjM4NTI4ODZlKzM4KVxuICB9XG4gIGllZWU3NTQud3JpdGUoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIDIzLCA0KVxuICByZXR1cm4gb2Zmc2V0ICsgNFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlRmxvYXRMRSA9IGZ1bmN0aW9uIHdyaXRlRmxvYXRMRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIHdyaXRlRmxvYXQodGhpcywgdmFsdWUsIG9mZnNldCwgdHJ1ZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVGbG9hdEJFID0gZnVuY3Rpb24gd3JpdGVGbG9hdEJFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gd3JpdGVGbG9hdCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBmYWxzZSwgbm9Bc3NlcnQpXG59XG5cbmZ1bmN0aW9uIHdyaXRlRG91YmxlIChidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGNoZWNrSUVFRTc1NChidWYsIHZhbHVlLCBvZmZzZXQsIDgsIDEuNzk3NjkzMTM0ODYyMzE1N0UrMzA4LCAtMS43OTc2OTMxMzQ4NjIzMTU3RSszMDgpXG4gIH1cbiAgaWVlZTc1NC53cml0ZShidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgNTIsIDgpXG4gIHJldHVybiBvZmZzZXQgKyA4XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVEb3VibGVMRSA9IGZ1bmN0aW9uIHdyaXRlRG91YmxlTEUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiB3cml0ZURvdWJsZSh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCB0cnVlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZURvdWJsZUJFID0gZnVuY3Rpb24gd3JpdGVEb3VibGVCRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIHdyaXRlRG91YmxlKHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuLy8gY29weSh0YXJnZXRCdWZmZXIsIHRhcmdldFN0YXJ0PTAsIHNvdXJjZVN0YXJ0PTAsIHNvdXJjZUVuZD1idWZmZXIubGVuZ3RoKVxuQnVmZmVyLnByb3RvdHlwZS5jb3B5ID0gZnVuY3Rpb24gY29weSAodGFyZ2V0LCB0YXJnZXRTdGFydCwgc3RhcnQsIGVuZCkge1xuICBpZiAoIXN0YXJ0KSBzdGFydCA9IDBcbiAgaWYgKCFlbmQgJiYgZW5kICE9PSAwKSBlbmQgPSB0aGlzLmxlbmd0aFxuICBpZiAodGFyZ2V0U3RhcnQgPj0gdGFyZ2V0Lmxlbmd0aCkgdGFyZ2V0U3RhcnQgPSB0YXJnZXQubGVuZ3RoXG4gIGlmICghdGFyZ2V0U3RhcnQpIHRhcmdldFN0YXJ0ID0gMFxuICBpZiAoZW5kID4gMCAmJiBlbmQgPCBzdGFydCkgZW5kID0gc3RhcnRcblxuICAvLyBDb3B5IDAgYnl0ZXM7IHdlJ3JlIGRvbmVcbiAgaWYgKGVuZCA9PT0gc3RhcnQpIHJldHVybiAwXG4gIGlmICh0YXJnZXQubGVuZ3RoID09PSAwIHx8IHRoaXMubGVuZ3RoID09PSAwKSByZXR1cm4gMFxuXG4gIC8vIEZhdGFsIGVycm9yIGNvbmRpdGlvbnNcbiAgaWYgKHRhcmdldFN0YXJ0IDwgMCkge1xuICAgIHRocm93IG5ldyBSYW5nZUVycm9yKCd0YXJnZXRTdGFydCBvdXQgb2YgYm91bmRzJylcbiAgfVxuICBpZiAoc3RhcnQgPCAwIHx8IHN0YXJ0ID49IHRoaXMubGVuZ3RoKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignc291cmNlU3RhcnQgb3V0IG9mIGJvdW5kcycpXG4gIGlmIChlbmQgPCAwKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignc291cmNlRW5kIG91dCBvZiBib3VuZHMnKVxuXG4gIC8vIEFyZSB3ZSBvb2I/XG4gIGlmIChlbmQgPiB0aGlzLmxlbmd0aCkgZW5kID0gdGhpcy5sZW5ndGhcbiAgaWYgKHRhcmdldC5sZW5ndGggLSB0YXJnZXRTdGFydCA8IGVuZCAtIHN0YXJ0KSB7XG4gICAgZW5kID0gdGFyZ2V0Lmxlbmd0aCAtIHRhcmdldFN0YXJ0ICsgc3RhcnRcbiAgfVxuXG4gIHZhciBsZW4gPSBlbmQgLSBzdGFydFxuICB2YXIgaVxuXG4gIGlmICh0aGlzID09PSB0YXJnZXQgJiYgc3RhcnQgPCB0YXJnZXRTdGFydCAmJiB0YXJnZXRTdGFydCA8IGVuZCkge1xuICAgIC8vIGRlc2NlbmRpbmcgY29weSBmcm9tIGVuZFxuICAgIGZvciAoaSA9IGxlbiAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgICB0YXJnZXRbaSArIHRhcmdldFN0YXJ0XSA9IHRoaXNbaSArIHN0YXJ0XVxuICAgIH1cbiAgfSBlbHNlIGlmIChsZW4gPCAxMDAwIHx8ICFCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIC8vIGFzY2VuZGluZyBjb3B5IGZyb20gc3RhcnRcbiAgICBmb3IgKGkgPSAwOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgIHRhcmdldFtpICsgdGFyZ2V0U3RhcnRdID0gdGhpc1tpICsgc3RhcnRdXG4gICAgfVxuICB9IGVsc2Uge1xuICAgIHRhcmdldC5fc2V0KHRoaXMuc3ViYXJyYXkoc3RhcnQsIHN0YXJ0ICsgbGVuKSwgdGFyZ2V0U3RhcnQpXG4gIH1cblxuICByZXR1cm4gbGVuXG59XG5cbi8vIGZpbGwodmFsdWUsIHN0YXJ0PTAsIGVuZD1idWZmZXIubGVuZ3RoKVxuQnVmZmVyLnByb3RvdHlwZS5maWxsID0gZnVuY3Rpb24gZmlsbCAodmFsdWUsIHN0YXJ0LCBlbmQpIHtcbiAgaWYgKCF2YWx1ZSkgdmFsdWUgPSAwXG4gIGlmICghc3RhcnQpIHN0YXJ0ID0gMFxuICBpZiAoIWVuZCkgZW5kID0gdGhpcy5sZW5ndGhcblxuICBpZiAoZW5kIDwgc3RhcnQpIHRocm93IG5ldyBSYW5nZUVycm9yKCdlbmQgPCBzdGFydCcpXG5cbiAgLy8gRmlsbCAwIGJ5dGVzOyB3ZSdyZSBkb25lXG4gIGlmIChlbmQgPT09IHN0YXJ0KSByZXR1cm5cbiAgaWYgKHRoaXMubGVuZ3RoID09PSAwKSByZXR1cm5cblxuICBpZiAoc3RhcnQgPCAwIHx8IHN0YXJ0ID49IHRoaXMubGVuZ3RoKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignc3RhcnQgb3V0IG9mIGJvdW5kcycpXG4gIGlmIChlbmQgPCAwIHx8IGVuZCA+IHRoaXMubGVuZ3RoKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignZW5kIG91dCBvZiBib3VuZHMnKVxuXG4gIHZhciBpXG4gIGlmICh0eXBlb2YgdmFsdWUgPT09ICdudW1iZXInKSB7XG4gICAgZm9yIChpID0gc3RhcnQ7IGkgPCBlbmQ7IGkrKykge1xuICAgICAgdGhpc1tpXSA9IHZhbHVlXG4gICAgfVxuICB9IGVsc2Uge1xuICAgIHZhciBieXRlcyA9IHV0ZjhUb0J5dGVzKHZhbHVlLnRvU3RyaW5nKCkpXG4gICAgdmFyIGxlbiA9IGJ5dGVzLmxlbmd0aFxuICAgIGZvciAoaSA9IHN0YXJ0OyBpIDwgZW5kOyBpKyspIHtcbiAgICAgIHRoaXNbaV0gPSBieXRlc1tpICUgbGVuXVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiB0aGlzXG59XG5cbi8qKlxuICogQ3JlYXRlcyBhIG5ldyBgQXJyYXlCdWZmZXJgIHdpdGggdGhlICpjb3BpZWQqIG1lbW9yeSBvZiB0aGUgYnVmZmVyIGluc3RhbmNlLlxuICogQWRkZWQgaW4gTm9kZSAwLjEyLiBPbmx5IGF2YWlsYWJsZSBpbiBicm93c2VycyB0aGF0IHN1cHBvcnQgQXJyYXlCdWZmZXIuXG4gKi9cbkJ1ZmZlci5wcm90b3R5cGUudG9BcnJheUJ1ZmZlciA9IGZ1bmN0aW9uIHRvQXJyYXlCdWZmZXIgKCkge1xuICBpZiAodHlwZW9mIFVpbnQ4QXJyYXkgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgICByZXR1cm4gKG5ldyBCdWZmZXIodGhpcykpLmJ1ZmZlclxuICAgIH0gZWxzZSB7XG4gICAgICB2YXIgYnVmID0gbmV3IFVpbnQ4QXJyYXkodGhpcy5sZW5ndGgpXG4gICAgICBmb3IgKHZhciBpID0gMCwgbGVuID0gYnVmLmxlbmd0aDsgaSA8IGxlbjsgaSArPSAxKSB7XG4gICAgICAgIGJ1ZltpXSA9IHRoaXNbaV1cbiAgICAgIH1cbiAgICAgIHJldHVybiBidWYuYnVmZmVyXG4gICAgfVxuICB9IGVsc2Uge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ0J1ZmZlci50b0FycmF5QnVmZmVyIG5vdCBzdXBwb3J0ZWQgaW4gdGhpcyBicm93c2VyJylcbiAgfVxufVxuXG4vLyBIRUxQRVIgRlVOQ1RJT05TXG4vLyA9PT09PT09PT09PT09PT09XG5cbnZhciBCUCA9IEJ1ZmZlci5wcm90b3R5cGVcblxuLyoqXG4gKiBBdWdtZW50IGEgVWludDhBcnJheSAqaW5zdGFuY2UqIChub3QgdGhlIFVpbnQ4QXJyYXkgY2xhc3MhKSB3aXRoIEJ1ZmZlciBtZXRob2RzXG4gKi9cbkJ1ZmZlci5fYXVnbWVudCA9IGZ1bmN0aW9uIF9hdWdtZW50IChhcnIpIHtcbiAgYXJyLmNvbnN0cnVjdG9yID0gQnVmZmVyXG4gIGFyci5faXNCdWZmZXIgPSB0cnVlXG5cbiAgLy8gc2F2ZSByZWZlcmVuY2UgdG8gb3JpZ2luYWwgVWludDhBcnJheSBzZXQgbWV0aG9kIGJlZm9yZSBvdmVyd3JpdGluZ1xuICBhcnIuX3NldCA9IGFyci5zZXRcblxuICAvLyBkZXByZWNhdGVkXG4gIGFyci5nZXQgPSBCUC5nZXRcbiAgYXJyLnNldCA9IEJQLnNldFxuXG4gIGFyci53cml0ZSA9IEJQLndyaXRlXG4gIGFyci50b1N0cmluZyA9IEJQLnRvU3RyaW5nXG4gIGFyci50b0xvY2FsZVN0cmluZyA9IEJQLnRvU3RyaW5nXG4gIGFyci50b0pTT04gPSBCUC50b0pTT05cbiAgYXJyLmVxdWFscyA9IEJQLmVxdWFsc1xuICBhcnIuY29tcGFyZSA9IEJQLmNvbXBhcmVcbiAgYXJyLmluZGV4T2YgPSBCUC5pbmRleE9mXG4gIGFyci5jb3B5ID0gQlAuY29weVxuICBhcnIuc2xpY2UgPSBCUC5zbGljZVxuICBhcnIucmVhZFVJbnRMRSA9IEJQLnJlYWRVSW50TEVcbiAgYXJyLnJlYWRVSW50QkUgPSBCUC5yZWFkVUludEJFXG4gIGFyci5yZWFkVUludDggPSBCUC5yZWFkVUludDhcbiAgYXJyLnJlYWRVSW50MTZMRSA9IEJQLnJlYWRVSW50MTZMRVxuICBhcnIucmVhZFVJbnQxNkJFID0gQlAucmVhZFVJbnQxNkJFXG4gIGFyci5yZWFkVUludDMyTEUgPSBCUC5yZWFkVUludDMyTEVcbiAgYXJyLnJlYWRVSW50MzJCRSA9IEJQLnJlYWRVSW50MzJCRVxuICBhcnIucmVhZEludExFID0gQlAucmVhZEludExFXG4gIGFyci5yZWFkSW50QkUgPSBCUC5yZWFkSW50QkVcbiAgYXJyLnJlYWRJbnQ4ID0gQlAucmVhZEludDhcbiAgYXJyLnJlYWRJbnQxNkxFID0gQlAucmVhZEludDE2TEVcbiAgYXJyLnJlYWRJbnQxNkJFID0gQlAucmVhZEludDE2QkVcbiAgYXJyLnJlYWRJbnQzMkxFID0gQlAucmVhZEludDMyTEVcbiAgYXJyLnJlYWRJbnQzMkJFID0gQlAucmVhZEludDMyQkVcbiAgYXJyLnJlYWRGbG9hdExFID0gQlAucmVhZEZsb2F0TEVcbiAgYXJyLnJlYWRGbG9hdEJFID0gQlAucmVhZEZsb2F0QkVcbiAgYXJyLnJlYWREb3VibGVMRSA9IEJQLnJlYWREb3VibGVMRVxuICBhcnIucmVhZERvdWJsZUJFID0gQlAucmVhZERvdWJsZUJFXG4gIGFyci53cml0ZVVJbnQ4ID0gQlAud3JpdGVVSW50OFxuICBhcnIud3JpdGVVSW50TEUgPSBCUC53cml0ZVVJbnRMRVxuICBhcnIud3JpdGVVSW50QkUgPSBCUC53cml0ZVVJbnRCRVxuICBhcnIud3JpdGVVSW50MTZMRSA9IEJQLndyaXRlVUludDE2TEVcbiAgYXJyLndyaXRlVUludDE2QkUgPSBCUC53cml0ZVVJbnQxNkJFXG4gIGFyci53cml0ZVVJbnQzMkxFID0gQlAud3JpdGVVSW50MzJMRVxuICBhcnIud3JpdGVVSW50MzJCRSA9IEJQLndyaXRlVUludDMyQkVcbiAgYXJyLndyaXRlSW50TEUgPSBCUC53cml0ZUludExFXG4gIGFyci53cml0ZUludEJFID0gQlAud3JpdGVJbnRCRVxuICBhcnIud3JpdGVJbnQ4ID0gQlAud3JpdGVJbnQ4XG4gIGFyci53cml0ZUludDE2TEUgPSBCUC53cml0ZUludDE2TEVcbiAgYXJyLndyaXRlSW50MTZCRSA9IEJQLndyaXRlSW50MTZCRVxuICBhcnIud3JpdGVJbnQzMkxFID0gQlAud3JpdGVJbnQzMkxFXG4gIGFyci53cml0ZUludDMyQkUgPSBCUC53cml0ZUludDMyQkVcbiAgYXJyLndyaXRlRmxvYXRMRSA9IEJQLndyaXRlRmxvYXRMRVxuICBhcnIud3JpdGVGbG9hdEJFID0gQlAud3JpdGVGbG9hdEJFXG4gIGFyci53cml0ZURvdWJsZUxFID0gQlAud3JpdGVEb3VibGVMRVxuICBhcnIud3JpdGVEb3VibGVCRSA9IEJQLndyaXRlRG91YmxlQkVcbiAgYXJyLmZpbGwgPSBCUC5maWxsXG4gIGFyci5pbnNwZWN0ID0gQlAuaW5zcGVjdFxuICBhcnIudG9BcnJheUJ1ZmZlciA9IEJQLnRvQXJyYXlCdWZmZXJcblxuICByZXR1cm4gYXJyXG59XG5cbnZhciBJTlZBTElEX0JBU0U2NF9SRSA9IC9bXitcXC8wLTlBLVphLXotX10vZ1xuXG5mdW5jdGlvbiBiYXNlNjRjbGVhbiAoc3RyKSB7XG4gIC8vIE5vZGUgc3RyaXBzIG91dCBpbnZhbGlkIGNoYXJhY3RlcnMgbGlrZSBcXG4gYW5kIFxcdCBmcm9tIHRoZSBzdHJpbmcsIGJhc2U2NC1qcyBkb2VzIG5vdFxuICBzdHIgPSBzdHJpbmd0cmltKHN0cikucmVwbGFjZShJTlZBTElEX0JBU0U2NF9SRSwgJycpXG4gIC8vIE5vZGUgY29udmVydHMgc3RyaW5ncyB3aXRoIGxlbmd0aCA8IDIgdG8gJydcbiAgaWYgKHN0ci5sZW5ndGggPCAyKSByZXR1cm4gJydcbiAgLy8gTm9kZSBhbGxvd3MgZm9yIG5vbi1wYWRkZWQgYmFzZTY0IHN0cmluZ3MgKG1pc3NpbmcgdHJhaWxpbmcgPT09KSwgYmFzZTY0LWpzIGRvZXMgbm90XG4gIHdoaWxlIChzdHIubGVuZ3RoICUgNCAhPT0gMCkge1xuICAgIHN0ciA9IHN0ciArICc9J1xuICB9XG4gIHJldHVybiBzdHJcbn1cblxuZnVuY3Rpb24gc3RyaW5ndHJpbSAoc3RyKSB7XG4gIGlmIChzdHIudHJpbSkgcmV0dXJuIHN0ci50cmltKClcbiAgcmV0dXJuIHN0ci5yZXBsYWNlKC9eXFxzK3xcXHMrJC9nLCAnJylcbn1cblxuZnVuY3Rpb24gdG9IZXggKG4pIHtcbiAgaWYgKG4gPCAxNikgcmV0dXJuICcwJyArIG4udG9TdHJpbmcoMTYpXG4gIHJldHVybiBuLnRvU3RyaW5nKDE2KVxufVxuXG5mdW5jdGlvbiB1dGY4VG9CeXRlcyAoc3RyaW5nLCB1bml0cykge1xuICB1bml0cyA9IHVuaXRzIHx8IEluZmluaXR5XG4gIHZhciBjb2RlUG9pbnRcbiAgdmFyIGxlbmd0aCA9IHN0cmluZy5sZW5ndGhcbiAgdmFyIGxlYWRTdXJyb2dhdGUgPSBudWxsXG4gIHZhciBieXRlcyA9IFtdXG5cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgIGNvZGVQb2ludCA9IHN0cmluZy5jaGFyQ29kZUF0KGkpXG5cbiAgICAvLyBpcyBzdXJyb2dhdGUgY29tcG9uZW50XG4gICAgaWYgKGNvZGVQb2ludCA+IDB4RDdGRiAmJiBjb2RlUG9pbnQgPCAweEUwMDApIHtcbiAgICAgIC8vIGxhc3QgY2hhciB3YXMgYSBsZWFkXG4gICAgICBpZiAoIWxlYWRTdXJyb2dhdGUpIHtcbiAgICAgICAgLy8gbm8gbGVhZCB5ZXRcbiAgICAgICAgaWYgKGNvZGVQb2ludCA+IDB4REJGRikge1xuICAgICAgICAgIC8vIHVuZXhwZWN0ZWQgdHJhaWxcbiAgICAgICAgICBpZiAoKHVuaXRzIC09IDMpID4gLTEpIGJ5dGVzLnB1c2goMHhFRiwgMHhCRiwgMHhCRClcbiAgICAgICAgICBjb250aW51ZVxuICAgICAgICB9IGVsc2UgaWYgKGkgKyAxID09PSBsZW5ndGgpIHtcbiAgICAgICAgICAvLyB1bnBhaXJlZCBsZWFkXG4gICAgICAgICAgaWYgKCh1bml0cyAtPSAzKSA+IC0xKSBieXRlcy5wdXNoKDB4RUYsIDB4QkYsIDB4QkQpXG4gICAgICAgICAgY29udGludWVcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHZhbGlkIGxlYWRcbiAgICAgICAgbGVhZFN1cnJvZ2F0ZSA9IGNvZGVQb2ludFxuXG4gICAgICAgIGNvbnRpbnVlXG4gICAgICB9XG5cbiAgICAgIC8vIDIgbGVhZHMgaW4gYSByb3dcbiAgICAgIGlmIChjb2RlUG9pbnQgPCAweERDMDApIHtcbiAgICAgICAgaWYgKCh1bml0cyAtPSAzKSA+IC0xKSBieXRlcy5wdXNoKDB4RUYsIDB4QkYsIDB4QkQpXG4gICAgICAgIGxlYWRTdXJyb2dhdGUgPSBjb2RlUG9pbnRcbiAgICAgICAgY29udGludWVcbiAgICAgIH1cblxuICAgICAgLy8gdmFsaWQgc3Vycm9nYXRlIHBhaXJcbiAgICAgIGNvZGVQb2ludCA9IGxlYWRTdXJyb2dhdGUgLSAweEQ4MDAgPDwgMTAgfCBjb2RlUG9pbnQgLSAweERDMDAgfCAweDEwMDAwXG4gICAgfSBlbHNlIGlmIChsZWFkU3Vycm9nYXRlKSB7XG4gICAgICAvLyB2YWxpZCBibXAgY2hhciwgYnV0IGxhc3QgY2hhciB3YXMgYSBsZWFkXG4gICAgICBpZiAoKHVuaXRzIC09IDMpID4gLTEpIGJ5dGVzLnB1c2goMHhFRiwgMHhCRiwgMHhCRClcbiAgICB9XG5cbiAgICBsZWFkU3Vycm9nYXRlID0gbnVsbFxuXG4gICAgLy8gZW5jb2RlIHV0ZjhcbiAgICBpZiAoY29kZVBvaW50IDwgMHg4MCkge1xuICAgICAgaWYgKCh1bml0cyAtPSAxKSA8IDApIGJyZWFrXG4gICAgICBieXRlcy5wdXNoKGNvZGVQb2ludClcbiAgICB9IGVsc2UgaWYgKGNvZGVQb2ludCA8IDB4ODAwKSB7XG4gICAgICBpZiAoKHVuaXRzIC09IDIpIDwgMCkgYnJlYWtcbiAgICAgIGJ5dGVzLnB1c2goXG4gICAgICAgIGNvZGVQb2ludCA+PiAweDYgfCAweEMwLFxuICAgICAgICBjb2RlUG9pbnQgJiAweDNGIHwgMHg4MFxuICAgICAgKVxuICAgIH0gZWxzZSBpZiAoY29kZVBvaW50IDwgMHgxMDAwMCkge1xuICAgICAgaWYgKCh1bml0cyAtPSAzKSA8IDApIGJyZWFrXG4gICAgICBieXRlcy5wdXNoKFxuICAgICAgICBjb2RlUG9pbnQgPj4gMHhDIHwgMHhFMCxcbiAgICAgICAgY29kZVBvaW50ID4+IDB4NiAmIDB4M0YgfCAweDgwLFxuICAgICAgICBjb2RlUG9pbnQgJiAweDNGIHwgMHg4MFxuICAgICAgKVxuICAgIH0gZWxzZSBpZiAoY29kZVBvaW50IDwgMHgxMTAwMDApIHtcbiAgICAgIGlmICgodW5pdHMgLT0gNCkgPCAwKSBicmVha1xuICAgICAgYnl0ZXMucHVzaChcbiAgICAgICAgY29kZVBvaW50ID4+IDB4MTIgfCAweEYwLFxuICAgICAgICBjb2RlUG9pbnQgPj4gMHhDICYgMHgzRiB8IDB4ODAsXG4gICAgICAgIGNvZGVQb2ludCA+PiAweDYgJiAweDNGIHwgMHg4MCxcbiAgICAgICAgY29kZVBvaW50ICYgMHgzRiB8IDB4ODBcbiAgICAgIClcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGNvZGUgcG9pbnQnKVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiBieXRlc1xufVxuXG5mdW5jdGlvbiBhc2NpaVRvQnl0ZXMgKHN0cikge1xuICB2YXIgYnl0ZUFycmF5ID0gW11cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBzdHIubGVuZ3RoOyBpKyspIHtcbiAgICAvLyBOb2RlJ3MgY29kZSBzZWVtcyB0byBiZSBkb2luZyB0aGlzIGFuZCBub3QgJiAweDdGLi5cbiAgICBieXRlQXJyYXkucHVzaChzdHIuY2hhckNvZGVBdChpKSAmIDB4RkYpXG4gIH1cbiAgcmV0dXJuIGJ5dGVBcnJheVxufVxuXG5mdW5jdGlvbiB1dGYxNmxlVG9CeXRlcyAoc3RyLCB1bml0cykge1xuICB2YXIgYywgaGksIGxvXG4gIHZhciBieXRlQXJyYXkgPSBbXVxuICBmb3IgKHZhciBpID0gMDsgaSA8IHN0ci5sZW5ndGg7IGkrKykge1xuICAgIGlmICgodW5pdHMgLT0gMikgPCAwKSBicmVha1xuXG4gICAgYyA9IHN0ci5jaGFyQ29kZUF0KGkpXG4gICAgaGkgPSBjID4+IDhcbiAgICBsbyA9IGMgJSAyNTZcbiAgICBieXRlQXJyYXkucHVzaChsbylcbiAgICBieXRlQXJyYXkucHVzaChoaSlcbiAgfVxuXG4gIHJldHVybiBieXRlQXJyYXlcbn1cblxuZnVuY3Rpb24gYmFzZTY0VG9CeXRlcyAoc3RyKSB7XG4gIHJldHVybiBiYXNlNjQudG9CeXRlQXJyYXkoYmFzZTY0Y2xlYW4oc3RyKSlcbn1cblxuZnVuY3Rpb24gYmxpdEJ1ZmZlciAoc3JjLCBkc3QsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICBpZiAoKGkgKyBvZmZzZXQgPj0gZHN0Lmxlbmd0aCkgfHwgKGkgPj0gc3JjLmxlbmd0aCkpIGJyZWFrXG4gICAgZHN0W2kgKyBvZmZzZXRdID0gc3JjW2ldXG4gIH1cbiAgcmV0dXJuIGlcbn1cbiIsInZhciBsb29rdXAgPSAnQUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVphYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5ejAxMjM0NTY3ODkrLyc7XG5cbjsoZnVuY3Rpb24gKGV4cG9ydHMpIHtcblx0J3VzZSBzdHJpY3QnO1xuXG4gIHZhciBBcnIgPSAodHlwZW9mIFVpbnQ4QXJyYXkgIT09ICd1bmRlZmluZWQnKVxuICAgID8gVWludDhBcnJheVxuICAgIDogQXJyYXlcblxuXHR2YXIgUExVUyAgID0gJysnLmNoYXJDb2RlQXQoMClcblx0dmFyIFNMQVNIICA9ICcvJy5jaGFyQ29kZUF0KDApXG5cdHZhciBOVU1CRVIgPSAnMCcuY2hhckNvZGVBdCgwKVxuXHR2YXIgTE9XRVIgID0gJ2EnLmNoYXJDb2RlQXQoMClcblx0dmFyIFVQUEVSICA9ICdBJy5jaGFyQ29kZUF0KDApXG5cdHZhciBQTFVTX1VSTF9TQUZFID0gJy0nLmNoYXJDb2RlQXQoMClcblx0dmFyIFNMQVNIX1VSTF9TQUZFID0gJ18nLmNoYXJDb2RlQXQoMClcblxuXHRmdW5jdGlvbiBkZWNvZGUgKGVsdCkge1xuXHRcdHZhciBjb2RlID0gZWx0LmNoYXJDb2RlQXQoMClcblx0XHRpZiAoY29kZSA9PT0gUExVUyB8fFxuXHRcdCAgICBjb2RlID09PSBQTFVTX1VSTF9TQUZFKVxuXHRcdFx0cmV0dXJuIDYyIC8vICcrJ1xuXHRcdGlmIChjb2RlID09PSBTTEFTSCB8fFxuXHRcdCAgICBjb2RlID09PSBTTEFTSF9VUkxfU0FGRSlcblx0XHRcdHJldHVybiA2MyAvLyAnLydcblx0XHRpZiAoY29kZSA8IE5VTUJFUilcblx0XHRcdHJldHVybiAtMSAvL25vIG1hdGNoXG5cdFx0aWYgKGNvZGUgPCBOVU1CRVIgKyAxMClcblx0XHRcdHJldHVybiBjb2RlIC0gTlVNQkVSICsgMjYgKyAyNlxuXHRcdGlmIChjb2RlIDwgVVBQRVIgKyAyNilcblx0XHRcdHJldHVybiBjb2RlIC0gVVBQRVJcblx0XHRpZiAoY29kZSA8IExPV0VSICsgMjYpXG5cdFx0XHRyZXR1cm4gY29kZSAtIExPV0VSICsgMjZcblx0fVxuXG5cdGZ1bmN0aW9uIGI2NFRvQnl0ZUFycmF5IChiNjQpIHtcblx0XHR2YXIgaSwgaiwgbCwgdG1wLCBwbGFjZUhvbGRlcnMsIGFyclxuXG5cdFx0aWYgKGI2NC5sZW5ndGggJSA0ID4gMCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIHN0cmluZy4gTGVuZ3RoIG11c3QgYmUgYSBtdWx0aXBsZSBvZiA0Jylcblx0XHR9XG5cblx0XHQvLyB0aGUgbnVtYmVyIG9mIGVxdWFsIHNpZ25zIChwbGFjZSBob2xkZXJzKVxuXHRcdC8vIGlmIHRoZXJlIGFyZSB0d28gcGxhY2Vob2xkZXJzLCB0aGFuIHRoZSB0d28gY2hhcmFjdGVycyBiZWZvcmUgaXRcblx0XHQvLyByZXByZXNlbnQgb25lIGJ5dGVcblx0XHQvLyBpZiB0aGVyZSBpcyBvbmx5IG9uZSwgdGhlbiB0aGUgdGhyZWUgY2hhcmFjdGVycyBiZWZvcmUgaXQgcmVwcmVzZW50IDIgYnl0ZXNcblx0XHQvLyB0aGlzIGlzIGp1c3QgYSBjaGVhcCBoYWNrIHRvIG5vdCBkbyBpbmRleE9mIHR3aWNlXG5cdFx0dmFyIGxlbiA9IGI2NC5sZW5ndGhcblx0XHRwbGFjZUhvbGRlcnMgPSAnPScgPT09IGI2NC5jaGFyQXQobGVuIC0gMikgPyAyIDogJz0nID09PSBiNjQuY2hhckF0KGxlbiAtIDEpID8gMSA6IDBcblxuXHRcdC8vIGJhc2U2NCBpcyA0LzMgKyB1cCB0byB0d28gY2hhcmFjdGVycyBvZiB0aGUgb3JpZ2luYWwgZGF0YVxuXHRcdGFyciA9IG5ldyBBcnIoYjY0Lmxlbmd0aCAqIDMgLyA0IC0gcGxhY2VIb2xkZXJzKVxuXG5cdFx0Ly8gaWYgdGhlcmUgYXJlIHBsYWNlaG9sZGVycywgb25seSBnZXQgdXAgdG8gdGhlIGxhc3QgY29tcGxldGUgNCBjaGFyc1xuXHRcdGwgPSBwbGFjZUhvbGRlcnMgPiAwID8gYjY0Lmxlbmd0aCAtIDQgOiBiNjQubGVuZ3RoXG5cblx0XHR2YXIgTCA9IDBcblxuXHRcdGZ1bmN0aW9uIHB1c2ggKHYpIHtcblx0XHRcdGFycltMKytdID0gdlxuXHRcdH1cblxuXHRcdGZvciAoaSA9IDAsIGogPSAwOyBpIDwgbDsgaSArPSA0LCBqICs9IDMpIHtcblx0XHRcdHRtcCA9IChkZWNvZGUoYjY0LmNoYXJBdChpKSkgPDwgMTgpIHwgKGRlY29kZShiNjQuY2hhckF0KGkgKyAxKSkgPDwgMTIpIHwgKGRlY29kZShiNjQuY2hhckF0KGkgKyAyKSkgPDwgNikgfCBkZWNvZGUoYjY0LmNoYXJBdChpICsgMykpXG5cdFx0XHRwdXNoKCh0bXAgJiAweEZGMDAwMCkgPj4gMTYpXG5cdFx0XHRwdXNoKCh0bXAgJiAweEZGMDApID4+IDgpXG5cdFx0XHRwdXNoKHRtcCAmIDB4RkYpXG5cdFx0fVxuXG5cdFx0aWYgKHBsYWNlSG9sZGVycyA9PT0gMikge1xuXHRcdFx0dG1wID0gKGRlY29kZShiNjQuY2hhckF0KGkpKSA8PCAyKSB8IChkZWNvZGUoYjY0LmNoYXJBdChpICsgMSkpID4+IDQpXG5cdFx0XHRwdXNoKHRtcCAmIDB4RkYpXG5cdFx0fSBlbHNlIGlmIChwbGFjZUhvbGRlcnMgPT09IDEpIHtcblx0XHRcdHRtcCA9IChkZWNvZGUoYjY0LmNoYXJBdChpKSkgPDwgMTApIHwgKGRlY29kZShiNjQuY2hhckF0KGkgKyAxKSkgPDwgNCkgfCAoZGVjb2RlKGI2NC5jaGFyQXQoaSArIDIpKSA+PiAyKVxuXHRcdFx0cHVzaCgodG1wID4+IDgpICYgMHhGRilcblx0XHRcdHB1c2godG1wICYgMHhGRilcblx0XHR9XG5cblx0XHRyZXR1cm4gYXJyXG5cdH1cblxuXHRmdW5jdGlvbiB1aW50OFRvQmFzZTY0ICh1aW50OCkge1xuXHRcdHZhciBpLFxuXHRcdFx0ZXh0cmFCeXRlcyA9IHVpbnQ4Lmxlbmd0aCAlIDMsIC8vIGlmIHdlIGhhdmUgMSBieXRlIGxlZnQsIHBhZCAyIGJ5dGVzXG5cdFx0XHRvdXRwdXQgPSBcIlwiLFxuXHRcdFx0dGVtcCwgbGVuZ3RoXG5cblx0XHRmdW5jdGlvbiBlbmNvZGUgKG51bSkge1xuXHRcdFx0cmV0dXJuIGxvb2t1cC5jaGFyQXQobnVtKVxuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIHRyaXBsZXRUb0Jhc2U2NCAobnVtKSB7XG5cdFx0XHRyZXR1cm4gZW5jb2RlKG51bSA+PiAxOCAmIDB4M0YpICsgZW5jb2RlKG51bSA+PiAxMiAmIDB4M0YpICsgZW5jb2RlKG51bSA+PiA2ICYgMHgzRikgKyBlbmNvZGUobnVtICYgMHgzRilcblx0XHR9XG5cblx0XHQvLyBnbyB0aHJvdWdoIHRoZSBhcnJheSBldmVyeSB0aHJlZSBieXRlcywgd2UnbGwgZGVhbCB3aXRoIHRyYWlsaW5nIHN0dWZmIGxhdGVyXG5cdFx0Zm9yIChpID0gMCwgbGVuZ3RoID0gdWludDgubGVuZ3RoIC0gZXh0cmFCeXRlczsgaSA8IGxlbmd0aDsgaSArPSAzKSB7XG5cdFx0XHR0ZW1wID0gKHVpbnQ4W2ldIDw8IDE2KSArICh1aW50OFtpICsgMV0gPDwgOCkgKyAodWludDhbaSArIDJdKVxuXHRcdFx0b3V0cHV0ICs9IHRyaXBsZXRUb0Jhc2U2NCh0ZW1wKVxuXHRcdH1cblxuXHRcdC8vIHBhZCB0aGUgZW5kIHdpdGggemVyb3MsIGJ1dCBtYWtlIHN1cmUgdG8gbm90IGZvcmdldCB0aGUgZXh0cmEgYnl0ZXNcblx0XHRzd2l0Y2ggKGV4dHJhQnl0ZXMpIHtcblx0XHRcdGNhc2UgMTpcblx0XHRcdFx0dGVtcCA9IHVpbnQ4W3VpbnQ4Lmxlbmd0aCAtIDFdXG5cdFx0XHRcdG91dHB1dCArPSBlbmNvZGUodGVtcCA+PiAyKVxuXHRcdFx0XHRvdXRwdXQgKz0gZW5jb2RlKCh0ZW1wIDw8IDQpICYgMHgzRilcblx0XHRcdFx0b3V0cHV0ICs9ICc9PSdcblx0XHRcdFx0YnJlYWtcblx0XHRcdGNhc2UgMjpcblx0XHRcdFx0dGVtcCA9ICh1aW50OFt1aW50OC5sZW5ndGggLSAyXSA8PCA4KSArICh1aW50OFt1aW50OC5sZW5ndGggLSAxXSlcblx0XHRcdFx0b3V0cHV0ICs9IGVuY29kZSh0ZW1wID4+IDEwKVxuXHRcdFx0XHRvdXRwdXQgKz0gZW5jb2RlKCh0ZW1wID4+IDQpICYgMHgzRilcblx0XHRcdFx0b3V0cHV0ICs9IGVuY29kZSgodGVtcCA8PCAyKSAmIDB4M0YpXG5cdFx0XHRcdG91dHB1dCArPSAnPSdcblx0XHRcdFx0YnJlYWtcblx0XHR9XG5cblx0XHRyZXR1cm4gb3V0cHV0XG5cdH1cblxuXHRleHBvcnRzLnRvQnl0ZUFycmF5ID0gYjY0VG9CeXRlQXJyYXlcblx0ZXhwb3J0cy5mcm9tQnl0ZUFycmF5ID0gdWludDhUb0Jhc2U2NFxufSh0eXBlb2YgZXhwb3J0cyA9PT0gJ3VuZGVmaW5lZCcgPyAodGhpcy5iYXNlNjRqcyA9IHt9KSA6IGV4cG9ydHMpKVxuIiwiZXhwb3J0cy5yZWFkID0gZnVuY3Rpb24gKGJ1ZmZlciwgb2Zmc2V0LCBpc0xFLCBtTGVuLCBuQnl0ZXMpIHtcbiAgdmFyIGUsIG1cbiAgdmFyIGVMZW4gPSBuQnl0ZXMgKiA4IC0gbUxlbiAtIDFcbiAgdmFyIGVNYXggPSAoMSA8PCBlTGVuKSAtIDFcbiAgdmFyIGVCaWFzID0gZU1heCA+PiAxXG4gIHZhciBuQml0cyA9IC03XG4gIHZhciBpID0gaXNMRSA/IChuQnl0ZXMgLSAxKSA6IDBcbiAgdmFyIGQgPSBpc0xFID8gLTEgOiAxXG4gIHZhciBzID0gYnVmZmVyW29mZnNldCArIGldXG5cbiAgaSArPSBkXG5cbiAgZSA9IHMgJiAoKDEgPDwgKC1uQml0cykpIC0gMSlcbiAgcyA+Pj0gKC1uQml0cylcbiAgbkJpdHMgKz0gZUxlblxuICBmb3IgKDsgbkJpdHMgPiAwOyBlID0gZSAqIDI1NiArIGJ1ZmZlcltvZmZzZXQgKyBpXSwgaSArPSBkLCBuQml0cyAtPSA4KSB7fVxuXG4gIG0gPSBlICYgKCgxIDw8ICgtbkJpdHMpKSAtIDEpXG4gIGUgPj49ICgtbkJpdHMpXG4gIG5CaXRzICs9IG1MZW5cbiAgZm9yICg7IG5CaXRzID4gMDsgbSA9IG0gKiAyNTYgKyBidWZmZXJbb2Zmc2V0ICsgaV0sIGkgKz0gZCwgbkJpdHMgLT0gOCkge31cblxuICBpZiAoZSA9PT0gMCkge1xuICAgIGUgPSAxIC0gZUJpYXNcbiAgfSBlbHNlIGlmIChlID09PSBlTWF4KSB7XG4gICAgcmV0dXJuIG0gPyBOYU4gOiAoKHMgPyAtMSA6IDEpICogSW5maW5pdHkpXG4gIH0gZWxzZSB7XG4gICAgbSA9IG0gKyBNYXRoLnBvdygyLCBtTGVuKVxuICAgIGUgPSBlIC0gZUJpYXNcbiAgfVxuICByZXR1cm4gKHMgPyAtMSA6IDEpICogbSAqIE1hdGgucG93KDIsIGUgLSBtTGVuKVxufVxuXG5leHBvcnRzLndyaXRlID0gZnVuY3Rpb24gKGJ1ZmZlciwgdmFsdWUsIG9mZnNldCwgaXNMRSwgbUxlbiwgbkJ5dGVzKSB7XG4gIHZhciBlLCBtLCBjXG4gIHZhciBlTGVuID0gbkJ5dGVzICogOCAtIG1MZW4gLSAxXG4gIHZhciBlTWF4ID0gKDEgPDwgZUxlbikgLSAxXG4gIHZhciBlQmlhcyA9IGVNYXggPj4gMVxuICB2YXIgcnQgPSAobUxlbiA9PT0gMjMgPyBNYXRoLnBvdygyLCAtMjQpIC0gTWF0aC5wb3coMiwgLTc3KSA6IDApXG4gIHZhciBpID0gaXNMRSA/IDAgOiAobkJ5dGVzIC0gMSlcbiAgdmFyIGQgPSBpc0xFID8gMSA6IC0xXG4gIHZhciBzID0gdmFsdWUgPCAwIHx8ICh2YWx1ZSA9PT0gMCAmJiAxIC8gdmFsdWUgPCAwKSA/IDEgOiAwXG5cbiAgdmFsdWUgPSBNYXRoLmFicyh2YWx1ZSlcblxuICBpZiAoaXNOYU4odmFsdWUpIHx8IHZhbHVlID09PSBJbmZpbml0eSkge1xuICAgIG0gPSBpc05hTih2YWx1ZSkgPyAxIDogMFxuICAgIGUgPSBlTWF4XG4gIH0gZWxzZSB7XG4gICAgZSA9IE1hdGguZmxvb3IoTWF0aC5sb2codmFsdWUpIC8gTWF0aC5MTjIpXG4gICAgaWYgKHZhbHVlICogKGMgPSBNYXRoLnBvdygyLCAtZSkpIDwgMSkge1xuICAgICAgZS0tXG4gICAgICBjICo9IDJcbiAgICB9XG4gICAgaWYgKGUgKyBlQmlhcyA+PSAxKSB7XG4gICAgICB2YWx1ZSArPSBydCAvIGNcbiAgICB9IGVsc2Uge1xuICAgICAgdmFsdWUgKz0gcnQgKiBNYXRoLnBvdygyLCAxIC0gZUJpYXMpXG4gICAgfVxuICAgIGlmICh2YWx1ZSAqIGMgPj0gMikge1xuICAgICAgZSsrXG4gICAgICBjIC89IDJcbiAgICB9XG5cbiAgICBpZiAoZSArIGVCaWFzID49IGVNYXgpIHtcbiAgICAgIG0gPSAwXG4gICAgICBlID0gZU1heFxuICAgIH0gZWxzZSBpZiAoZSArIGVCaWFzID49IDEpIHtcbiAgICAgIG0gPSAodmFsdWUgKiBjIC0gMSkgKiBNYXRoLnBvdygyLCBtTGVuKVxuICAgICAgZSA9IGUgKyBlQmlhc1xuICAgIH0gZWxzZSB7XG4gICAgICBtID0gdmFsdWUgKiBNYXRoLnBvdygyLCBlQmlhcyAtIDEpICogTWF0aC5wb3coMiwgbUxlbilcbiAgICAgIGUgPSAwXG4gICAgfVxuICB9XG5cbiAgZm9yICg7IG1MZW4gPj0gODsgYnVmZmVyW29mZnNldCArIGldID0gbSAmIDB4ZmYsIGkgKz0gZCwgbSAvPSAyNTYsIG1MZW4gLT0gOCkge31cblxuICBlID0gKGUgPDwgbUxlbikgfCBtXG4gIGVMZW4gKz0gbUxlblxuICBmb3IgKDsgZUxlbiA+IDA7IGJ1ZmZlcltvZmZzZXQgKyBpXSA9IGUgJiAweGZmLCBpICs9IGQsIGUgLz0gMjU2LCBlTGVuIC09IDgpIHt9XG5cbiAgYnVmZmVyW29mZnNldCArIGkgLSBkXSB8PSBzICogMTI4XG59XG4iLCJcbi8qKlxuICogaXNBcnJheVxuICovXG5cbnZhciBpc0FycmF5ID0gQXJyYXkuaXNBcnJheTtcblxuLyoqXG4gKiB0b1N0cmluZ1xuICovXG5cbnZhciBzdHIgPSBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nO1xuXG4vKipcbiAqIFdoZXRoZXIgb3Igbm90IHRoZSBnaXZlbiBgdmFsYFxuICogaXMgYW4gYXJyYXkuXG4gKlxuICogZXhhbXBsZTpcbiAqXG4gKiAgICAgICAgaXNBcnJheShbXSk7XG4gKiAgICAgICAgLy8gPiB0cnVlXG4gKiAgICAgICAgaXNBcnJheShhcmd1bWVudHMpO1xuICogICAgICAgIC8vID4gZmFsc2VcbiAqICAgICAgICBpc0FycmF5KCcnKTtcbiAqICAgICAgICAvLyA+IGZhbHNlXG4gKlxuICogQHBhcmFtIHttaXhlZH0gdmFsXG4gKiBAcmV0dXJuIHtib29sfVxuICovXG5cbm1vZHVsZS5leHBvcnRzID0gaXNBcnJheSB8fCBmdW5jdGlvbiAodmFsKSB7XG4gIHJldHVybiAhISB2YWwgJiYgJ1tvYmplY3QgQXJyYXldJyA9PSBzdHIuY2FsbCh2YWwpO1xufTtcbiIsIi8vIENvcHlyaWdodCBKb3llbnQsIEluYy4gYW5kIG90aGVyIE5vZGUgY29udHJpYnV0b3JzLlxuLy9cbi8vIFBlcm1pc3Npb24gaXMgaGVyZWJ5IGdyYW50ZWQsIGZyZWUgb2YgY2hhcmdlLCB0byBhbnkgcGVyc29uIG9idGFpbmluZyBhXG4vLyBjb3B5IG9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvbiBmaWxlcyAodGhlXG4vLyBcIlNvZnR3YXJlXCIpLCB0byBkZWFsIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmdcbi8vIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBtZXJnZSwgcHVibGlzaCxcbi8vIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXRcbi8vIHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXMgZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZVxuLy8gZm9sbG93aW5nIGNvbmRpdGlvbnM6XG4vL1xuLy8gVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWRcbi8vIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuLy9cbi8vIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1Ncbi8vIE9SIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0Zcbi8vIE1FUkNIQU5UQUJJTElUWSwgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gSU5cbi8vIE5PIEVWRU5UIFNIQUxMIFRIRSBBVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLFxuLy8gREFNQUdFUyBPUiBPVEhFUiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SXG4vLyBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSwgT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFXG4vLyBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU4gVEhFIFNPRlRXQVJFLlxuXG5mdW5jdGlvbiBFdmVudEVtaXR0ZXIoKSB7XG4gIHRoaXMuX2V2ZW50cyA9IHRoaXMuX2V2ZW50cyB8fCB7fTtcbiAgdGhpcy5fbWF4TGlzdGVuZXJzID0gdGhpcy5fbWF4TGlzdGVuZXJzIHx8IHVuZGVmaW5lZDtcbn1cbm1vZHVsZS5leHBvcnRzID0gRXZlbnRFbWl0dGVyO1xuXG4vLyBCYWNrd2FyZHMtY29tcGF0IHdpdGggbm9kZSAwLjEwLnhcbkV2ZW50RW1pdHRlci5FdmVudEVtaXR0ZXIgPSBFdmVudEVtaXR0ZXI7XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuX2V2ZW50cyA9IHVuZGVmaW5lZDtcbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuX21heExpc3RlbmVycyA9IHVuZGVmaW5lZDtcblxuLy8gQnkgZGVmYXVsdCBFdmVudEVtaXR0ZXJzIHdpbGwgcHJpbnQgYSB3YXJuaW5nIGlmIG1vcmUgdGhhbiAxMCBsaXN0ZW5lcnMgYXJlXG4vLyBhZGRlZCB0byBpdC4gVGhpcyBpcyBhIHVzZWZ1bCBkZWZhdWx0IHdoaWNoIGhlbHBzIGZpbmRpbmcgbWVtb3J5IGxlYWtzLlxuRXZlbnRFbWl0dGVyLmRlZmF1bHRNYXhMaXN0ZW5lcnMgPSAxMDtcblxuLy8gT2J2aW91c2x5IG5vdCBhbGwgRW1pdHRlcnMgc2hvdWxkIGJlIGxpbWl0ZWQgdG8gMTAuIFRoaXMgZnVuY3Rpb24gYWxsb3dzXG4vLyB0aGF0IHRvIGJlIGluY3JlYXNlZC4gU2V0IHRvIHplcm8gZm9yIHVubGltaXRlZC5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuc2V0TWF4TGlzdGVuZXJzID0gZnVuY3Rpb24obikge1xuICBpZiAoIWlzTnVtYmVyKG4pIHx8IG4gPCAwIHx8IGlzTmFOKG4pKVxuICAgIHRocm93IFR5cGVFcnJvcignbiBtdXN0IGJlIGEgcG9zaXRpdmUgbnVtYmVyJyk7XG4gIHRoaXMuX21heExpc3RlbmVycyA9IG47XG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5lbWl0ID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIgZXIsIGhhbmRsZXIsIGxlbiwgYXJncywgaSwgbGlzdGVuZXJzO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuXG4gIC8vIElmIHRoZXJlIGlzIG5vICdlcnJvcicgZXZlbnQgbGlzdGVuZXIgdGhlbiB0aHJvdy5cbiAgaWYgKHR5cGUgPT09ICdlcnJvcicpIHtcbiAgICBpZiAoIXRoaXMuX2V2ZW50cy5lcnJvciB8fFxuICAgICAgICAoaXNPYmplY3QodGhpcy5fZXZlbnRzLmVycm9yKSAmJiAhdGhpcy5fZXZlbnRzLmVycm9yLmxlbmd0aCkpIHtcbiAgICAgIGVyID0gYXJndW1lbnRzWzFdO1xuICAgICAgaWYgKGVyIGluc3RhbmNlb2YgRXJyb3IpIHtcbiAgICAgICAgdGhyb3cgZXI7IC8vIFVuaGFuZGxlZCAnZXJyb3InIGV2ZW50XG4gICAgICB9XG4gICAgICB0aHJvdyBUeXBlRXJyb3IoJ1VuY2F1Z2h0LCB1bnNwZWNpZmllZCBcImVycm9yXCIgZXZlbnQuJyk7XG4gICAgfVxuICB9XG5cbiAgaGFuZGxlciA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICBpZiAoaXNVbmRlZmluZWQoaGFuZGxlcikpXG4gICAgcmV0dXJuIGZhbHNlO1xuXG4gIGlmIChpc0Z1bmN0aW9uKGhhbmRsZXIpKSB7XG4gICAgc3dpdGNoIChhcmd1bWVudHMubGVuZ3RoKSB7XG4gICAgICAvLyBmYXN0IGNhc2VzXG4gICAgICBjYXNlIDE6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDI6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzLCBhcmd1bWVudHNbMV0pO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgMzpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMsIGFyZ3VtZW50c1sxXSwgYXJndW1lbnRzWzJdKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICAvLyBzbG93ZXJcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGxlbiA9IGFyZ3VtZW50cy5sZW5ndGg7XG4gICAgICAgIGFyZ3MgPSBuZXcgQXJyYXkobGVuIC0gMSk7XG4gICAgICAgIGZvciAoaSA9IDE7IGkgPCBsZW47IGkrKylcbiAgICAgICAgICBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcbiAgICAgICAgaGFuZGxlci5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICB9XG4gIH0gZWxzZSBpZiAoaXNPYmplY3QoaGFuZGxlcikpIHtcbiAgICBsZW4gPSBhcmd1bWVudHMubGVuZ3RoO1xuICAgIGFyZ3MgPSBuZXcgQXJyYXkobGVuIC0gMSk7XG4gICAgZm9yIChpID0gMTsgaSA8IGxlbjsgaSsrKVxuICAgICAgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG5cbiAgICBsaXN0ZW5lcnMgPSBoYW5kbGVyLnNsaWNlKCk7XG4gICAgbGVuID0gbGlzdGVuZXJzLmxlbmd0aDtcbiAgICBmb3IgKGkgPSAwOyBpIDwgbGVuOyBpKyspXG4gICAgICBsaXN0ZW5lcnNbaV0uYXBwbHkodGhpcywgYXJncyk7XG4gIH1cblxuICByZXR1cm4gdHJ1ZTtcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuYWRkTGlzdGVuZXIgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICB2YXIgbTtcblxuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgdGhpcy5fZXZlbnRzID0ge307XG5cbiAgLy8gVG8gYXZvaWQgcmVjdXJzaW9uIGluIHRoZSBjYXNlIHRoYXQgdHlwZSA9PT0gXCJuZXdMaXN0ZW5lclwiISBCZWZvcmVcbiAgLy8gYWRkaW5nIGl0IHRvIHRoZSBsaXN0ZW5lcnMsIGZpcnN0IGVtaXQgXCJuZXdMaXN0ZW5lclwiLlxuICBpZiAodGhpcy5fZXZlbnRzLm5ld0xpc3RlbmVyKVxuICAgIHRoaXMuZW1pdCgnbmV3TGlzdGVuZXInLCB0eXBlLFxuICAgICAgICAgICAgICBpc0Z1bmN0aW9uKGxpc3RlbmVyLmxpc3RlbmVyKSA/XG4gICAgICAgICAgICAgIGxpc3RlbmVyLmxpc3RlbmVyIDogbGlzdGVuZXIpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIC8vIE9wdGltaXplIHRoZSBjYXNlIG9mIG9uZSBsaXN0ZW5lci4gRG9uJ3QgbmVlZCB0aGUgZXh0cmEgYXJyYXkgb2JqZWN0LlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXSA9IGxpc3RlbmVyO1xuICBlbHNlIGlmIChpc09iamVjdCh0aGlzLl9ldmVudHNbdHlwZV0pKVxuICAgIC8vIElmIHdlJ3ZlIGFscmVhZHkgZ290IGFuIGFycmF5LCBqdXN0IGFwcGVuZC5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0ucHVzaChsaXN0ZW5lcik7XG4gIGVsc2VcbiAgICAvLyBBZGRpbmcgdGhlIHNlY29uZCBlbGVtZW50LCBuZWVkIHRvIGNoYW5nZSB0byBhcnJheS5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBbdGhpcy5fZXZlbnRzW3R5cGVdLCBsaXN0ZW5lcl07XG5cbiAgLy8gQ2hlY2sgZm9yIGxpc3RlbmVyIGxlYWtcbiAgaWYgKGlzT2JqZWN0KHRoaXMuX2V2ZW50c1t0eXBlXSkgJiYgIXRoaXMuX2V2ZW50c1t0eXBlXS53YXJuZWQpIHtcbiAgICB2YXIgbTtcbiAgICBpZiAoIWlzVW5kZWZpbmVkKHRoaXMuX21heExpc3RlbmVycykpIHtcbiAgICAgIG0gPSB0aGlzLl9tYXhMaXN0ZW5lcnM7XG4gICAgfSBlbHNlIHtcbiAgICAgIG0gPSBFdmVudEVtaXR0ZXIuZGVmYXVsdE1heExpc3RlbmVycztcbiAgICB9XG5cbiAgICBpZiAobSAmJiBtID4gMCAmJiB0aGlzLl9ldmVudHNbdHlwZV0ubGVuZ3RoID4gbSkge1xuICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdLndhcm5lZCA9IHRydWU7XG4gICAgICBjb25zb2xlLmVycm9yKCcobm9kZSkgd2FybmluZzogcG9zc2libGUgRXZlbnRFbWl0dGVyIG1lbW9yeSAnICtcbiAgICAgICAgICAgICAgICAgICAgJ2xlYWsgZGV0ZWN0ZWQuICVkIGxpc3RlbmVycyBhZGRlZC4gJyArXG4gICAgICAgICAgICAgICAgICAgICdVc2UgZW1pdHRlci5zZXRNYXhMaXN0ZW5lcnMoKSB0byBpbmNyZWFzZSBsaW1pdC4nLFxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9ldmVudHNbdHlwZV0ubGVuZ3RoKTtcbiAgICAgIGlmICh0eXBlb2YgY29uc29sZS50cmFjZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAvLyBub3Qgc3VwcG9ydGVkIGluIElFIDEwXG4gICAgICAgIGNvbnNvbGUudHJhY2UoKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUub24gPSBFdmVudEVtaXR0ZXIucHJvdG90eXBlLmFkZExpc3RlbmVyO1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uY2UgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgdmFyIGZpcmVkID0gZmFsc2U7XG5cbiAgZnVuY3Rpb24gZygpIHtcbiAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGcpO1xuXG4gICAgaWYgKCFmaXJlZCkge1xuICAgICAgZmlyZWQgPSB0cnVlO1xuICAgICAgbGlzdGVuZXIuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB9XG4gIH1cblxuICBnLmxpc3RlbmVyID0gbGlzdGVuZXI7XG4gIHRoaXMub24odHlwZSwgZyk7XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG4vLyBlbWl0cyBhICdyZW1vdmVMaXN0ZW5lcicgZXZlbnQgaWZmIHRoZSBsaXN0ZW5lciB3YXMgcmVtb3ZlZFxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVMaXN0ZW5lciA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIHZhciBsaXN0LCBwb3NpdGlvbiwgbGVuZ3RoLCBpO1xuXG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50cyB8fCAhdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIHJldHVybiB0aGlzO1xuXG4gIGxpc3QgPSB0aGlzLl9ldmVudHNbdHlwZV07XG4gIGxlbmd0aCA9IGxpc3QubGVuZ3RoO1xuICBwb3NpdGlvbiA9IC0xO1xuXG4gIGlmIChsaXN0ID09PSBsaXN0ZW5lciB8fFxuICAgICAgKGlzRnVuY3Rpb24obGlzdC5saXN0ZW5lcikgJiYgbGlzdC5saXN0ZW5lciA9PT0gbGlzdGVuZXIpKSB7XG4gICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICBpZiAodGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKVxuICAgICAgdGhpcy5lbWl0KCdyZW1vdmVMaXN0ZW5lcicsIHR5cGUsIGxpc3RlbmVyKTtcblxuICB9IGVsc2UgaWYgKGlzT2JqZWN0KGxpc3QpKSB7XG4gICAgZm9yIChpID0gbGVuZ3RoOyBpLS0gPiAwOykge1xuICAgICAgaWYgKGxpc3RbaV0gPT09IGxpc3RlbmVyIHx8XG4gICAgICAgICAgKGxpc3RbaV0ubGlzdGVuZXIgJiYgbGlzdFtpXS5saXN0ZW5lciA9PT0gbGlzdGVuZXIpKSB7XG4gICAgICAgIHBvc2l0aW9uID0gaTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHBvc2l0aW9uIDwgMClcbiAgICAgIHJldHVybiB0aGlzO1xuXG4gICAgaWYgKGxpc3QubGVuZ3RoID09PSAxKSB7XG4gICAgICBsaXN0Lmxlbmd0aCA9IDA7XG4gICAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIH0gZWxzZSB7XG4gICAgICBsaXN0LnNwbGljZShwb3NpdGlvbiwgMSk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcilcbiAgICAgIHRoaXMuZW1pdCgncmVtb3ZlTGlzdGVuZXInLCB0eXBlLCBsaXN0ZW5lcik7XG4gIH1cblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlQWxsTGlzdGVuZXJzID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIga2V5LCBsaXN0ZW5lcnM7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgcmV0dXJuIHRoaXM7XG5cbiAgLy8gbm90IGxpc3RlbmluZyBmb3IgcmVtb3ZlTGlzdGVuZXIsIG5vIG5lZWQgdG8gZW1pdFxuICBpZiAoIXRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcikge1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKVxuICAgICAgdGhpcy5fZXZlbnRzID0ge307XG4gICAgZWxzZSBpZiAodGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8vIGVtaXQgcmVtb3ZlTGlzdGVuZXIgZm9yIGFsbCBsaXN0ZW5lcnMgb24gYWxsIGV2ZW50c1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMCkge1xuICAgIGZvciAoa2V5IGluIHRoaXMuX2V2ZW50cykge1xuICAgICAgaWYgKGtleSA9PT0gJ3JlbW92ZUxpc3RlbmVyJykgY29udGludWU7XG4gICAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycyhrZXkpO1xuICAgIH1cbiAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycygncmVtb3ZlTGlzdGVuZXInKTtcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIGxpc3RlbmVycyA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICBpZiAoaXNGdW5jdGlvbihsaXN0ZW5lcnMpKSB7XG4gICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBsaXN0ZW5lcnMpO1xuICB9IGVsc2Uge1xuICAgIC8vIExJRk8gb3JkZXJcbiAgICB3aGlsZSAobGlzdGVuZXJzLmxlbmd0aClcbiAgICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgbGlzdGVuZXJzW2xpc3RlbmVycy5sZW5ndGggLSAxXSk7XG4gIH1cbiAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUubGlzdGVuZXJzID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIgcmV0O1xuICBpZiAoIXRoaXMuX2V2ZW50cyB8fCAhdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIHJldCA9IFtdO1xuICBlbHNlIGlmIChpc0Z1bmN0aW9uKHRoaXMuX2V2ZW50c1t0eXBlXSkpXG4gICAgcmV0ID0gW3RoaXMuX2V2ZW50c1t0eXBlXV07XG4gIGVsc2VcbiAgICByZXQgPSB0aGlzLl9ldmVudHNbdHlwZV0uc2xpY2UoKTtcbiAgcmV0dXJuIHJldDtcbn07XG5cbkV2ZW50RW1pdHRlci5saXN0ZW5lckNvdW50ID0gZnVuY3Rpb24oZW1pdHRlciwgdHlwZSkge1xuICB2YXIgcmV0O1xuICBpZiAoIWVtaXR0ZXIuX2V2ZW50cyB8fCAhZW1pdHRlci5fZXZlbnRzW3R5cGVdKVxuICAgIHJldCA9IDA7XG4gIGVsc2UgaWYgKGlzRnVuY3Rpb24oZW1pdHRlci5fZXZlbnRzW3R5cGVdKSlcbiAgICByZXQgPSAxO1xuICBlbHNlXG4gICAgcmV0ID0gZW1pdHRlci5fZXZlbnRzW3R5cGVdLmxlbmd0aDtcbiAgcmV0dXJuIHJldDtcbn07XG5cbmZ1bmN0aW9uIGlzRnVuY3Rpb24oYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnZnVuY3Rpb24nO1xufVxuXG5mdW5jdGlvbiBpc051bWJlcihhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdudW1iZXInO1xufVxuXG5mdW5jdGlvbiBpc09iamVjdChhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdvYmplY3QnICYmIGFyZyAhPT0gbnVsbDtcbn1cblxuZnVuY3Rpb24gaXNVbmRlZmluZWQoYXJnKSB7XG4gIHJldHVybiBhcmcgPT09IHZvaWQgMDtcbn1cbiIsIi8vIHNoaW0gZm9yIHVzaW5nIHByb2Nlc3MgaW4gYnJvd3NlclxuXG52YXIgcHJvY2VzcyA9IG1vZHVsZS5leHBvcnRzID0ge307XG52YXIgcXVldWUgPSBbXTtcbnZhciBkcmFpbmluZyA9IGZhbHNlO1xudmFyIGN1cnJlbnRRdWV1ZTtcbnZhciBxdWV1ZUluZGV4ID0gLTE7XG5cbmZ1bmN0aW9uIGNsZWFuVXBOZXh0VGljaygpIHtcbiAgICBkcmFpbmluZyA9IGZhbHNlO1xuICAgIGlmIChjdXJyZW50UXVldWUubGVuZ3RoKSB7XG4gICAgICAgIHF1ZXVlID0gY3VycmVudFF1ZXVlLmNvbmNhdChxdWV1ZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcXVldWVJbmRleCA9IC0xO1xuICAgIH1cbiAgICBpZiAocXVldWUubGVuZ3RoKSB7XG4gICAgICAgIGRyYWluUXVldWUoKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGRyYWluUXVldWUoKSB7XG4gICAgaWYgKGRyYWluaW5nKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdmFyIHRpbWVvdXQgPSBzZXRUaW1lb3V0KGNsZWFuVXBOZXh0VGljayk7XG4gICAgZHJhaW5pbmcgPSB0cnVlO1xuXG4gICAgdmFyIGxlbiA9IHF1ZXVlLmxlbmd0aDtcbiAgICB3aGlsZShsZW4pIHtcbiAgICAgICAgY3VycmVudFF1ZXVlID0gcXVldWU7XG4gICAgICAgIHF1ZXVlID0gW107XG4gICAgICAgIHdoaWxlICgrK3F1ZXVlSW5kZXggPCBsZW4pIHtcbiAgICAgICAgICAgIGlmIChjdXJyZW50UXVldWUpIHtcbiAgICAgICAgICAgICAgICBjdXJyZW50UXVldWVbcXVldWVJbmRleF0ucnVuKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcXVldWVJbmRleCA9IC0xO1xuICAgICAgICBsZW4gPSBxdWV1ZS5sZW5ndGg7XG4gICAgfVxuICAgIGN1cnJlbnRRdWV1ZSA9IG51bGw7XG4gICAgZHJhaW5pbmcgPSBmYWxzZTtcbiAgICBjbGVhclRpbWVvdXQodGltZW91dCk7XG59XG5cbnByb2Nlc3MubmV4dFRpY2sgPSBmdW5jdGlvbiAoZnVuKSB7XG4gICAgdmFyIGFyZ3MgPSBuZXcgQXJyYXkoYXJndW1lbnRzLmxlbmd0aCAtIDEpO1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID4gMSkge1xuICAgICAgICBmb3IgKHZhciBpID0gMTsgaSA8IGFyZ3VtZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG4gICAgICAgIH1cbiAgICB9XG4gICAgcXVldWUucHVzaChuZXcgSXRlbShmdW4sIGFyZ3MpKTtcbiAgICBpZiAocXVldWUubGVuZ3RoID09PSAxICYmICFkcmFpbmluZykge1xuICAgICAgICBzZXRUaW1lb3V0KGRyYWluUXVldWUsIDApO1xuICAgIH1cbn07XG5cbi8vIHY4IGxpa2VzIHByZWRpY3RpYmxlIG9iamVjdHNcbmZ1bmN0aW9uIEl0ZW0oZnVuLCBhcnJheSkge1xuICAgIHRoaXMuZnVuID0gZnVuO1xuICAgIHRoaXMuYXJyYXkgPSBhcnJheTtcbn1cbkl0ZW0ucHJvdG90eXBlLnJ1biA9IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLmZ1bi5hcHBseShudWxsLCB0aGlzLmFycmF5KTtcbn07XG5wcm9jZXNzLnRpdGxlID0gJ2Jyb3dzZXInO1xucHJvY2Vzcy5icm93c2VyID0gdHJ1ZTtcbnByb2Nlc3MuZW52ID0ge307XG5wcm9jZXNzLmFyZ3YgPSBbXTtcbnByb2Nlc3MudmVyc2lvbiA9ICcnOyAvLyBlbXB0eSBzdHJpbmcgdG8gYXZvaWQgcmVnZXhwIGlzc3Vlc1xucHJvY2Vzcy52ZXJzaW9ucyA9IHt9O1xuXG5mdW5jdGlvbiBub29wKCkge31cblxucHJvY2Vzcy5vbiA9IG5vb3A7XG5wcm9jZXNzLmFkZExpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3Mub25jZSA9IG5vb3A7XG5wcm9jZXNzLm9mZiA9IG5vb3A7XG5wcm9jZXNzLnJlbW92ZUxpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3MucmVtb3ZlQWxsTGlzdGVuZXJzID0gbm9vcDtcbnByb2Nlc3MuZW1pdCA9IG5vb3A7XG5cbnByb2Nlc3MuYmluZGluZyA9IGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdwcm9jZXNzLmJpbmRpbmcgaXMgbm90IHN1cHBvcnRlZCcpO1xufTtcblxucHJvY2Vzcy5jd2QgPSBmdW5jdGlvbiAoKSB7IHJldHVybiAnLycgfTtcbnByb2Nlc3MuY2hkaXIgPSBmdW5jdGlvbiAoZGlyKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdwcm9jZXNzLmNoZGlyIGlzIG5vdCBzdXBwb3J0ZWQnKTtcbn07XG5wcm9jZXNzLnVtYXNrID0gZnVuY3Rpb24oKSB7IHJldHVybiAwOyB9O1xuIiwiLy9cbi8vIEZpbGVSZWFkZXJcbi8vXG4vLyBodHRwOi8vd3d3LnczLm9yZy9UUi9GaWxlQVBJLyNkZm4tZmlsZXJlYWRlclxuLy8gaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4vRE9NL0ZpbGVSZWFkZXJcbihmdW5jdGlvbiAoKSB7XG4gIFwidXNlIHN0cmljdFwiO1xuXG4gIHZhciBmcyA9IHJlcXVpcmUoXCJmc1wiKVxuICAgICwgRXZlbnRFbWl0dGVyID0gcmVxdWlyZShcImV2ZW50c1wiKS5FdmVudEVtaXR0ZXJcbiAgICA7XG5cbiAgZnVuY3Rpb24gZG9vcChmbiwgYXJncywgY29udGV4dCkge1xuICAgIGlmICgnZnVuY3Rpb24nID09PSB0eXBlb2YgZm4pIHtcbiAgICAgIGZuLmFwcGx5KGNvbnRleHQsIGFyZ3MpO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIHRvRGF0YVVybChkYXRhLCB0eXBlKSB7XG4gICAgLy8gdmFyIGRhdGEgPSBzZWxmLnJlc3VsdDtcbiAgICB2YXIgZGF0YVVybCA9ICdkYXRhOic7XG5cbiAgICBpZiAodHlwZSkge1xuICAgICAgZGF0YVVybCArPSB0eXBlICsgJzsnO1xuICAgIH1cblxuICAgIGlmICgvdGV4dC9pLnRlc3QodHlwZSkpIHtcbiAgICAgIGRhdGFVcmwgKz0gJ2NoYXJzZXQ9dXRmLTgsJztcbiAgICAgIGRhdGFVcmwgKz0gZGF0YS50b1N0cmluZygndXRmOCcpO1xuICAgIH0gZWxzZSB7XG4gICAgICBkYXRhVXJsICs9ICdiYXNlNjQsJztcbiAgICAgIGRhdGFVcmwgKz0gZGF0YS50b1N0cmluZygnYmFzZTY0Jyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGRhdGFVcmw7XG4gIH1cblxuICBmdW5jdGlvbiBtYXBEYXRhVG9Gb3JtYXQoZmlsZSwgZGF0YSwgZm9ybWF0LCBlbmNvZGluZykge1xuICAgIC8vIHZhciBkYXRhID0gc2VsZi5yZXN1bHQ7XG5cbiAgICBzd2l0Y2goZm9ybWF0KSB7XG4gICAgICBjYXNlICdidWZmZXInOlxuICAgICAgICByZXR1cm4gZGF0YTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICdiaW5hcnknOlxuICAgICAgICByZXR1cm4gZGF0YS50b1N0cmluZygnYmluYXJ5Jyk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnZGF0YVVybCc6XG4gICAgICAgIHJldHVybiB0b0RhdGFVcmwoZGF0YSwgZmlsZS50eXBlKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICd0ZXh0JzpcbiAgICAgICAgcmV0dXJuIGRhdGEudG9TdHJpbmcoZW5jb2RpbmcgfHwgJ3V0ZjgnKTtcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gRmlsZVJlYWRlcigpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXMsXG4gICAgICBlbWl0dGVyID0gbmV3IEV2ZW50RW1pdHRlcixcbiAgICAgIGZpbGU7XG5cbiAgICBzZWxmLmFkZEV2ZW50TGlzdGVuZXIgPSBmdW5jdGlvbiAob24sIGNhbGxiYWNrKSB7XG4gICAgICBlbWl0dGVyLm9uKG9uLCBjYWxsYmFjayk7XG4gICAgfTtcbiAgICBzZWxmLnJlbW92ZUV2ZW50TGlzdGVuZXIgPSBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgICAgIGVtaXR0ZXIucmVtb3ZlTGlzdGVuZXIoY2FsbGJhY2spO1xuICAgIH1cbiAgICBzZWxmLmRpc3BhdGNoRXZlbnQgPSBmdW5jdGlvbiAob24pIHtcbiAgICAgIGVtaXR0ZXIuZW1pdChvbik7XG4gICAgfVxuXG4gICAgc2VsZi5FTVBUWSA9IDA7XG4gICAgc2VsZi5MT0FESU5HID0gMTtcbiAgICBzZWxmLkRPTkUgPSAyO1xuXG4gICAgc2VsZi5lcnJvciA9IHVuZGVmaW5lZDsgICAgICAgICAvLyBSZWFkIG9ubHlcbiAgICBzZWxmLnJlYWR5U3RhdGUgPSBzZWxmLkVNUFRZOyAgIC8vIFJlYWQgb25seVxuICAgIHNlbGYucmVzdWx0ID0gdW5kZWZpbmVkOyAgICAgICAgLy8gUm9hZCBvbmx5XG5cbiAgICAvLyBub24tc3RhbmRhcmRcbiAgICBzZWxmLm9uID0gZnVuY3Rpb24gKCkge1xuICAgICAgZW1pdHRlci5vbi5hcHBseShlbWl0dGVyLCBhcmd1bWVudHMpO1xuICAgIH1cbiAgICBzZWxmLm5vZGVDaHVua2VkRW5jb2RpbmcgPSBmYWxzZTtcbiAgICBzZWxmLnNldE5vZGVDaHVua2VkRW5jb2RpbmcgPSBmdW5jdGlvbiAodmFsKSB7XG4gICAgICBzZWxmLm5vZGVDaHVua2VkRW5jb2RpbmcgPSB2YWw7XG4gICAgfTtcbiAgICAvLyBlbmQgbm9uLXN0YW5kYXJkXG5cblxuXG4gICAgLy8gV2hhdGV2ZXIgdGhlIGZpbGUgb2JqZWN0IGlzLCB0dXJuIGl0IGludG8gYSBOb2RlLkpTIEZpbGUuU3RyZWFtXG4gICAgZnVuY3Rpb24gY3JlYXRlRmlsZVN0cmVhbSgpIHtcbiAgICAgIHZhciBzdHJlYW0gPSBuZXcgRXZlbnRFbWl0dGVyKCksXG4gICAgICAgIGNodW5rZWQgPSBzZWxmLm5vZGVDaHVua2VkRW5jb2Rpbmc7XG5cbiAgICAgIC8vIGF0dGVtcHQgdG8gbWFrZSB0aGUgbGVuZ3RoIGNvbXB1dGFibGVcbiAgICAgIGlmICghZmlsZS5zaXplICYmIGNodW5rZWQgJiYgZmlsZS5wYXRoKSB7XG4gICAgICAgIGZzLnN0YXQoZmlsZS5wYXRoLCBmdW5jdGlvbiAoZXJyLCBzdGF0KSB7XG4gICAgICAgICAgZmlsZS5zaXplID0gc3RhdC5zaXplO1xuICAgICAgICAgIGZpbGUubGFzdE1vZGlmaWVkRGF0ZSA9IHN0YXQubXRpbWU7XG4gICAgICAgIH0pO1xuICAgICAgfVxuXG5cbiAgICAgIC8vIFRoZSBzdHJlYW0gZXhpc3RzLCBkbyBub3RoaW5nIG1vcmVcbiAgICAgIGlmIChmaWxlLnN0cmVhbSkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cblxuICAgICAgLy8gQ3JlYXRlIGEgcmVhZCBzdHJlYW0gZnJvbSBhIGJ1ZmZlclxuICAgICAgaWYgKGZpbGUuYnVmZmVyKSB7XG4gICAgICAgIHByb2Nlc3MubmV4dFRpY2soZnVuY3Rpb24gKCkge1xuICAgICAgICAgIHN0cmVhbS5lbWl0KCdkYXRhJywgZmlsZS5idWZmZXIpO1xuICAgICAgICAgIHN0cmVhbS5lbWl0KCdlbmQnKTtcbiAgICAgICAgfSk7XG4gICAgICAgIGZpbGUuc3RyZWFtID0gc3RyZWFtO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cblxuICAgICAgLy8gQ3JlYXRlIGEgcmVhZCBzdHJlYW0gZnJvbSBhIGZpbGVcbiAgICAgIGlmIChmaWxlLnBhdGgpIHtcbiAgICAgICAgLy8gVE9ETyB1cmxcbiAgICAgICAgaWYgKCFjaHVua2VkKSB7XG4gICAgICAgICAgZnMucmVhZEZpbGUoZmlsZS5wYXRoLCBmdW5jdGlvbiAoZXJyLCBkYXRhKSB7XG4gICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgIHN0cmVhbS5lbWl0KCdlcnJvcicsIGVycik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoZGF0YSkge1xuICAgICAgICAgICAgICBzdHJlYW0uZW1pdCgnZGF0YScsIGRhdGEpO1xuICAgICAgICAgICAgICBzdHJlYW0uZW1pdCgnZW5kJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG5cbiAgICAgICAgICBmaWxlLnN0cmVhbSA9IHN0cmVhbTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICAvLyBUT0RPIGRvbid0IGR1cGxpY2F0ZSB0aGlzIGNvZGUgaGVyZSxcbiAgICAgICAgLy8gZXhwb3NlIGEgbWV0aG9kIGluIEZpbGUgaW5zdGVhZFxuICAgICAgICBmaWxlLnN0cmVhbSA9IGZzLmNyZWF0ZVJlYWRTdHJlYW0oZmlsZS5wYXRoKTtcbiAgICAgIH1cbiAgICB9XG5cblxuXG4gICAgLy8gYmVmb3JlIGFueSBvdGhlciBsaXN0ZW5lcnMgYXJlIGFkZGVkXG4gICAgZW1pdHRlci5vbignYWJvcnQnLCBmdW5jdGlvbiAoKSB7XG4gICAgICBzZWxmLnJlYWR5U3RhdGUgPSBzZWxmLkRPTkU7XG4gICAgfSk7XG5cblxuXG4gICAgLy8gTWFwIGBlcnJvcmAsIGBwcm9ncmVzc2AsIGBsb2FkYCwgYW5kIGBsb2FkZW5kYFxuICAgIGZ1bmN0aW9uIG1hcFN0cmVhbVRvRW1pdHRlcihmb3JtYXQsIGVuY29kaW5nKSB7XG4gICAgICB2YXIgc3RyZWFtID0gZmlsZS5zdHJlYW0sXG4gICAgICAgIGJ1ZmZlcnMgPSBbXSxcbiAgICAgICAgY2h1bmtlZCA9IHNlbGYubm9kZUNodW5rZWRFbmNvZGluZztcblxuICAgICAgYnVmZmVycy5kYXRhTGVuZ3RoID0gMDtcblxuICAgICAgc3RyZWFtLm9uKCdlcnJvcicsIGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgaWYgKHNlbGYuRE9ORSA9PT0gc2VsZi5yZWFkeVN0YXRlKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgc2VsZi5yZWFkeVN0YXRlID0gc2VsZi5ET05FO1xuICAgICAgICBzZWxmLmVycm9yID0gZXJyO1xuICAgICAgICBlbWl0dGVyLmVtaXQoJ2Vycm9yJywgZXJyKTtcbiAgICAgIH0pO1xuXG4gICAgICBzdHJlYW0ub24oJ2RhdGEnLCBmdW5jdGlvbiAoZGF0YSkge1xuICAgICAgICBpZiAoc2VsZi5ET05FID09PSBzZWxmLnJlYWR5U3RhdGUpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBidWZmZXJzLmRhdGFMZW5ndGggKz0gZGF0YS5sZW5ndGg7XG4gICAgICAgIGJ1ZmZlcnMucHVzaChkYXRhKTtcblxuICAgICAgICBlbWl0dGVyLmVtaXQoJ3Byb2dyZXNzJywge1xuICAgICAgICAgIC8vIGZzLnN0YXQgd2lsbCBwcm9iYWJseSBjb21wbGV0ZSBiZWZvcmUgdGhpc1xuICAgICAgICAgIC8vIGJ1dCBwb3NzaWJseSBpdCB3aWxsIG5vdCwgaGVuY2UgdGhlIGNoZWNrXG4gICAgICAgICAgbGVuZ3RoQ29tcHV0YWJsZTogKCFpc05hTihmaWxlLnNpemUpKSA/IHRydWUgOiBmYWxzZSxcbiAgICAgICAgICBsb2FkZWQ6IGJ1ZmZlcnMuZGF0YUxlbmd0aCxcbiAgICAgICAgICB0b3RhbDogZmlsZS5zaXplXG4gICAgICAgIH0pO1xuXG4gICAgICAgIGVtaXR0ZXIuZW1pdCgnZGF0YScsIGRhdGEpO1xuICAgICAgfSk7XG5cbiAgICAgIHN0cmVhbS5vbignZW5kJywgZnVuY3Rpb24gKCkge1xuICAgICAgICBpZiAoc2VsZi5ET05FID09PSBzZWxmLnJlYWR5U3RhdGUpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgZGF0YTtcblxuICAgICAgICBpZiAoYnVmZmVycy5sZW5ndGggPiAxICkge1xuICAgICAgICAgIGRhdGEgPSBCdWZmZXIuY29uY2F0KGJ1ZmZlcnMpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGRhdGEgPSBidWZmZXJzWzBdO1xuICAgICAgICB9XG5cbiAgICAgICAgc2VsZi5yZWFkeVN0YXRlID0gc2VsZi5ET05FO1xuICAgICAgICBzZWxmLnJlc3VsdCA9IG1hcERhdGFUb0Zvcm1hdChmaWxlLCBkYXRhLCBmb3JtYXQsIGVuY29kaW5nKTtcbiAgICAgICAgZW1pdHRlci5lbWl0KCdsb2FkJywge1xuICAgICAgICAgIHRhcmdldDoge1xuICAgICAgICAgICAgLy8gbm9uLXN0YW5kYXJkXG4gICAgICAgICAgICBub2RlQnVmZmVyUmVzdWx0OiBkYXRhLFxuICAgICAgICAgICAgcmVzdWx0OiBzZWxmLnJlc3VsdFxuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgZW1pdHRlci5lbWl0KCdsb2FkZW5kJyk7XG4gICAgICB9KTtcbiAgICB9XG5cblxuICAgIC8vIEFib3J0IGlzIG92ZXJ3cml0dGVuIGJ5IHJlYWRBc1h5elxuICAgIHNlbGYuYWJvcnQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICBpZiAoc2VsZi5yZWFkU3RhdGUgPT0gc2VsZi5ET05FKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIHNlbGYucmVhZHlTdGF0ZSA9IHNlbGYuRE9ORTtcbiAgICAgIGVtaXR0ZXIuZW1pdCgnYWJvcnQnKTtcbiAgICB9O1xuXG5cblxuICAgIC8vIFxuICAgIGZ1bmN0aW9uIG1hcFVzZXJFdmVudHMoKSB7XG4gICAgICBlbWl0dGVyLm9uKCdzdGFydCcsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgZG9vcChzZWxmLm9ubG9hZHN0YXJ0LCBhcmd1bWVudHMpO1xuICAgICAgfSk7XG4gICAgICBlbWl0dGVyLm9uKCdwcm9ncmVzcycsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgZG9vcChzZWxmLm9ucHJvZ3Jlc3MsIGFyZ3VtZW50cyk7XG4gICAgICB9KTtcbiAgICAgIGVtaXR0ZXIub24oJ2Vycm9yJywgZnVuY3Rpb24gKGVycikge1xuICAgICAgICAvLyBUT0RPIHRyYW5zbGF0ZSB0byBGaWxlRXJyb3JcbiAgICAgICAgaWYgKHNlbGYub25lcnJvcikge1xuICAgICAgICAgIHNlbGYub25lcnJvcihlcnIpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGlmICghZW1pdHRlci5saXN0ZW5lcnMuZXJyb3IgfHwgIWVtaXR0ZXIubGlzdGVuZXJzLmVycm9yLmxlbmd0aCkge1xuICAgICAgICAgICAgdGhyb3cgZXJyO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgICBlbWl0dGVyLm9uKCdsb2FkJywgZnVuY3Rpb24gKCkge1xuICAgICAgICBkb29wKHNlbGYub25sb2FkLCBhcmd1bWVudHMpO1xuICAgICAgfSk7XG4gICAgICBlbWl0dGVyLm9uKCdlbmQnLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGRvb3Aoc2VsZi5vbmxvYWRlbmQsIGFyZ3VtZW50cyk7XG4gICAgICB9KTtcbiAgICAgIGVtaXR0ZXIub24oJ2Fib3J0JywgZnVuY3Rpb24gKCkge1xuICAgICAgICBkb29wKHNlbGYub25hYm9ydCwgYXJndW1lbnRzKTtcbiAgICAgIH0pO1xuICAgIH1cblxuXG5cbiAgICBmdW5jdGlvbiByZWFkRmlsZShfZmlsZSwgZm9ybWF0LCBlbmNvZGluZykge1xuICAgICAgZmlsZSA9IF9maWxlO1xuICAgICAgaWYgKCFmaWxlIHx8ICFmaWxlLm5hbWUgfHwgIShmaWxlLnBhdGggfHwgZmlsZS5zdHJlYW0gfHwgZmlsZS5idWZmZXIpKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcImNhbm5vdCByZWFkIGFzIEZpbGU6IFwiICsgSlNPTi5zdHJpbmdpZnkoZmlsZSkpO1xuICAgICAgfVxuICAgICAgaWYgKDAgIT09IHNlbGYucmVhZHlTdGF0ZSkge1xuICAgICAgICBjb25zb2xlLmxvZyhcImFscmVhZHkgbG9hZGluZywgcmVxdWVzdCB0byBjaGFuZ2UgZm9ybWF0IGlnbm9yZWRcIik7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgLy8gJ3Byb2Nlc3MubmV4dFRpY2snIGRvZXMgbm90IGVuc3VyZSBvcmRlciwgKGkuZS4gYW4gZnMuc3RhdCBxdWV1ZWQgbGF0ZXIgbWF5IHJldHVybiBmYXN0ZXIpXG4gICAgICAvLyBidXQgYG9ubG9hZHN0YXJ0YCBtdXN0IGNvbWUgYmVmb3JlIHRoZSBmaXJzdCBgZGF0YWAgZXZlbnQgYW5kIG11c3QgYmUgYXN5bmNocm9ub3VzLlxuICAgICAgLy8gSGVuY2Ugd2Ugd2FzdGUgYSBzaW5nbGUgdGljayB3YWl0aW5nXG4gICAgICBwcm9jZXNzLm5leHRUaWNrKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgc2VsZi5yZWFkeVN0YXRlID0gc2VsZi5MT0FESU5HO1xuICAgICAgICBlbWl0dGVyLmVtaXQoJ2xvYWRzdGFydCcpO1xuICAgICAgICBjcmVhdGVGaWxlU3RyZWFtKCk7XG4gICAgICAgIG1hcFN0cmVhbVRvRW1pdHRlcihmb3JtYXQsIGVuY29kaW5nKTtcbiAgICAgICAgbWFwVXNlckV2ZW50cygpO1xuICAgICAgfSk7XG4gICAgfVxuXG4gICAgc2VsZi5yZWFkQXNBcnJheUJ1ZmZlciA9IGZ1bmN0aW9uIChmaWxlKSB7XG4gICAgICByZWFkRmlsZShmaWxlLCAnYnVmZmVyJyk7XG4gICAgfTtcbiAgICBzZWxmLnJlYWRBc0JpbmFyeVN0cmluZyA9IGZ1bmN0aW9uIChmaWxlKSB7XG4gICAgICByZWFkRmlsZShmaWxlLCAnYmluYXJ5Jyk7XG4gICAgfTtcbiAgICBzZWxmLnJlYWRBc0RhdGFVUkwgPSBmdW5jdGlvbiAoZmlsZSkge1xuICAgICAgcmVhZEZpbGUoZmlsZSwgJ2RhdGFVcmwnKTtcbiAgICB9O1xuICAgIHNlbGYucmVhZEFzVGV4dCA9IGZ1bmN0aW9uIChmaWxlLCBlbmNvZGluZykge1xuICAgICAgcmVhZEZpbGUoZmlsZSwgJ3RleHQnLCBlbmNvZGluZyk7XG4gICAgfTtcbiAgfVxuXG4gIG1vZHVsZS5leHBvcnRzID0gRmlsZVJlYWRlcjtcbn0oKSk7XG4iLCJ2YXIgY29uZmlnID0gcmVxdWlyZSgnLi4vLi4vY29uZmlnLmpzb24nKTtcbnZhciBDbHVtcCA9IHJlcXVpcmUoJy4vb2JqZWN0cy9jbHVtcCcpO1xudmFyIEx1bXAgPSByZXF1aXJlKCcuL29iamVjdHMvbHVtcCcpO1xuXG52YXIgaW8gPSByZXF1aXJlKCcuL2lvJyk7XG5cbnZhciBsaWJyYXJ5ID0gcmVxdWlyZSgnLi9saWJyYXJ5Jyk7XG52YXIgbG9hZGVkID0ge307XG5cbnZhciB0eXBlcyA9IHtcbiAgUXVhbGl0eTogcmVxdWlyZSgnLi9vYmplY3RzL3F1YWxpdHknKSxcbiAgRXZlbnQ6IHJlcXVpcmUoJy4vb2JqZWN0cy9ldmVudCcpLFxuICBJbnRlcmFjdGlvbjogcmVxdWlyZSgnLi9vYmplY3RzL2ludGVyYWN0aW9uJyksXG4gIFF1YWxpdHlFZmZlY3Q6IHJlcXVpcmUoJy4vb2JqZWN0cy9xdWFsaXR5LWVmZmVjdCcpLFxuICBRdWFsaXR5UmVxdWlyZW1lbnQ6IHJlcXVpcmUoJy4vb2JqZWN0cy9xdWFsaXR5LXJlcXVpcmVtZW50JyksXG4gIEFyZWE6IHJlcXVpcmUoJy4vb2JqZWN0cy9hcmVhJyksXG4gIFNwYXduZWRFbnRpdHk6IHJlcXVpcmUoJy4vb2JqZWN0cy9zcGF3bmVkLWVudGl0eScpLFxuICBDb21iYXRBdHRhY2s6IHJlcXVpcmUoJy4vb2JqZWN0cy9jb21iYXQtYXR0YWNrJyksXG4gIEV4Y2hhbmdlOiByZXF1aXJlKCcuL29iamVjdHMvZXhjaGFuZ2UnKSxcbiAgU2hvcDogcmVxdWlyZSgnLi9vYmplY3RzL3Nob3AnKSxcbiAgQXZhaWxhYmlsaXR5OiByZXF1aXJlKCcuL29iamVjdHMvYXZhaWxhYmlsaXR5JyksXG4gIFRpbGU6IHJlcXVpcmUoJy4vb2JqZWN0cy90aWxlJyksXG4gIFRpbGVWYXJpYW50OiByZXF1aXJlKCcuL29iamVjdHMvdGlsZS12YXJpYW50JyksXG4gIFBvcnQ6IHJlcXVpcmUoJy4vb2JqZWN0cy9wb3J0JyksXG4gIFNldHRpbmc6IHJlcXVpcmUoJy4vb2JqZWN0cy9zZXR0aW5nJylcbn07XG5cbi8vIFByZXBvcHVsYXRlIGxpYnJhcnkgd2l0aCBDbHVtcHMgb2YgZWFjaCB0eXBlIHdlIGtub3cgYWJvdXRcbk9iamVjdC5rZXlzKHR5cGVzKS5mb3JFYWNoKGZ1bmN0aW9uKHR5cGVOYW1lKSB7XG5cdHZhciBUeXBlID0gdHlwZXNbdHlwZU5hbWVdO1xuXHRpZighbGlicmFyeVt0eXBlTmFtZV0pIHtcblx0XHRsaWJyYXJ5W3R5cGVOYW1lXSA9IG5ldyBDbHVtcChbXSwgVHlwZSk7XG5cdFx0bG9hZGVkW3R5cGVOYW1lXSA9IG5ldyBDbHVtcChbXSwgVHlwZSk7XG5cdH1cbn0pO1xuXG5mdW5jdGlvbiBnZXQoVHlwZSwgaWQsIHBhcmVudCkge1xuXHR2YXIgdHlwZW5hbWUgPSBUeXBlLm5hbWU7XHQvLyBFdmVudCwgUXVhbGl0eSwgSW50ZXJhY3Rpb24sIGV0Y1xuXG5cdHZhciBleGlzdGluZ1RoaW5nV2l0aFRoaXNJZCA9IGxpYnJhcnlbdHlwZW5hbWVdLmlkKGlkKTtcblx0aWYoZXhpc3RpbmdUaGluZ1dpdGhUaGlzSWQpIHtcblx0XHQvL2NvbnNvbGUubG9nKFwiQXR0YWNoZWQgZXhpc3RpbmcgXCIgKyBleGlzdGluZ1RoaW5nV2l0aFRoaXNJZCArIFwiIHRvIFwiICsgdGhpcy50b1N0cmluZygpKVxuXHRcdHZhciBuZXdQYXJlbnQgPSB0cnVlO1xuXHRcdGV4aXN0aW5nVGhpbmdXaXRoVGhpc0lkLnBhcmVudHMuZm9yRWFjaChmdW5jdGlvbihwKSB7XG5cdFx0XHRpZihwLklkID09PSBwYXJlbnQuSWQgJiYgcC5jb25zdHJ1Y3Rvci5uYW1lID09PSBwYXJlbnQuY29uc3RydWN0b3IubmFtZSkge1xuXHRcdFx0XHRuZXdQYXJlbnQgPSBmYWxzZTtcblx0XHRcdH1cblx0XHR9KTtcblx0XHRpZihuZXdQYXJlbnQpe1xuXHRcdFx0ZXhpc3RpbmdUaGluZ1dpdGhUaGlzSWQucGFyZW50cy5wdXNoKHBhcmVudCk7XG5cdFx0fVxuXG5cdFx0aWYoIWV4aXN0aW5nVGhpbmdXaXRoVGhpc0lkLndpcmVkKSB7XG5cdFx0XHRleGlzdGluZ1RoaW5nV2l0aFRoaXNJZC53aXJlVXAodGhpcyk7XHQvLyBQYXNzIGluIHRoZSBhcGkgc28gb2JqZWN0IGNhbiBhZGQgaXRzZWxmIHRvIHRoZSBtYXN0ZXItbGlicmFyeVxuXHRcdH1cblx0XHRyZXR1cm4gZXhpc3RpbmdUaGluZ1dpdGhUaGlzSWQ7XG5cdH1cblx0ZWxzZSB7XG5cdFx0cmV0dXJuIG51bGw7XG5cdH1cbn1cblxuZnVuY3Rpb24gZ2V0T3JDcmVhdGUoVHlwZSwgcG9zc05ld1RoaW5nLCBwYXJlbnQpIHtcdC8vIElmIGFuIG9iamVjdCBhbHJlYWR5IGV4aXN0cyB3aXRoIHRoaXMgSUQsIHVzZSB0aGF0LiAgT3RoZXJ3aXNlIGNyZWF0ZSBhIG5ldyBvYmplY3QgZnJvbSB0aGUgc3VwcGxpZWQgZGV0YWlscyBoYXNoXG5cdHZhciB0eXBlbmFtZSA9IFR5cGUubmFtZTtcdC8vIEV2ZW50LCBRdWFsaXR5LCBJbnRlcmFjdGlvbiwgZXRjXG5cdGlmKHBvc3NOZXdUaGluZykge1xuICBcdHZhciBleGlzdGluZ1RoaW5nV2l0aFRoaXNJZCA9IHRoaXMuZ2V0KFR5cGUsIHBvc3NOZXdUaGluZy5JZCwgcGFyZW50KTtcbiAgXHRpZihleGlzdGluZ1RoaW5nV2l0aFRoaXNJZCkge1xuICBcdFx0cmV0dXJuIGV4aXN0aW5nVGhpbmdXaXRoVGhpc0lkO1xuICBcdH1cbiAgXHRlbHNlIHtcblx0XHRcdHZhciBuZXdUaGluZyA9IG5ldyBUeXBlKHBvc3NOZXdUaGluZywgcGFyZW50KTtcblx0XHRcdG5ld1RoaW5nLndpcmVVcCh0aGlzKTtcblx0XHRcdC8vY29uc29sZS5sb2coXCJSZWN1cnNpdmVseSBjcmVhdGVkIFwiICsgbmV3VGhpbmcgKyBcIiBmb3IgXCIgKyB0aGlzLnRvU3RyaW5nKCkpO1xuXHRcdFx0cmV0dXJuIG5ld1RoaW5nO1xuXHRcdH1cblx0fVxuXHRlbHNlIHtcblx0XHRyZXR1cm4gbnVsbDtcblx0fVxufVxuXG5mdW5jdGlvbiB3aXJlVXBPYmplY3RzKCkge1xuXHR2YXIgYXBpID0gdGhpcztcbiAgT2JqZWN0LmtleXModHlwZXMpLmZvckVhY2goZnVuY3Rpb24odHlwZSkge1xuICAgIGxpYnJhcnlbdHlwZV0uZm9yRWFjaChmdW5jdGlvbihsdW1wKSB7XG4gICAgICBpZihsdW1wLndpcmVVcCkge1xuICAgICAgICBsdW1wLndpcmVVcChhcGkpO1xuICAgICAgfVxuICAgIH0pO1xuICB9KTtcbn1cblxudmFyIHdoYXRJcyA9IGZ1bmN0aW9uKGlkKSB7XG4gIHZhciBwb3NzaWJpbGl0aWVzID0gW107XG4gIE9iamVjdC5rZXlzKGxpYnJhcnkpLmZvckVhY2goZnVuY3Rpb24oa2V5KSB7XG4gICAgaWYobGlicmFyeVtrZXldIGluc3RhbmNlb2YgQ2x1bXAgJiYgbGlicmFyeVtrZXldLmlkKGlkKSkge1xuICAgICAgcG9zc2liaWxpdGllcy5wdXNoKGtleSk7XG4gICAgfVxuICB9KTtcbiAgcmV0dXJuIHBvc3NpYmlsaXRpZXM7XG59O1xuXG5mdW5jdGlvbiBkZXNjcmliZUFkdmFuY2VkRXhwcmVzc2lvbihleHByKSB7XG5cdHZhciBzZWxmID0gdGhpcztcblx0aWYoZXhwcikge1xuXHRcdGV4cHIgPSBleHByLnJlcGxhY2UoL1xcW2Q6KFxcZCspXFxdL2dpLCBcIlJBTkRPTVsxLSQxXVwiKTtcdC8vIFtkOnhdID0gcmFuZG9tIG51bWJlciBmcm9tIDEteCg/KVxuXHRcdGV4cHIgPSBleHByLnJlcGxhY2UoL1xcW3E6KFxcZCspXFxdL2dpLCBmdW5jdGlvbihtYXRjaCwgYmFja3JlZiwgcG9zLCB3aG9sZV9zdHIpIHtcblx0XHRcdHZhciBxdWFsaXR5ID0gc2VsZi5saWJyYXJ5LlF1YWxpdHkuaWQoYmFja3JlZik7XG5cdFx0XHRyZXR1cm4gXCJbXCIrKHF1YWxpdHkgPyBxdWFsaXR5Lk5hbWUgOiAnSU5WQUxJRCcpK1wiXVwiO1xuXHRcdH0pO1xuXG5cdFx0cmV0dXJuIGV4cHI7XG5cdH1cblx0cmV0dXJuIG51bGw7XG59XG5cbmZ1bmN0aW9uIHJlYWRGcm9tRmlsZShUeXBlLCBmaWxlLCBjYWxsYmFjaykge1xuXHRpby5yZWFkRmlsZShmaWxlLCBmdW5jdGlvbiAoZSkge1xuICAgIHZhciBjb250ZW50cyA9IGUudGFyZ2V0LnJlc3VsdDtcbiAgICBcbiAgICB2YXIgb2JqID0gSlNPTi5wYXJzZShjb250ZW50cyk7XG4gICAgbG9hZGVkW1R5cGUucHJvdG90eXBlLmNvbnN0cnVjdG9yLm5hbWVdID0gbmV3IENsdW1wKG9iaiwgVHlwZSk7XG5cbiAgICBjYWxsYmFjayhjb250ZW50cywgVHlwZSwgbG9hZGVkW1R5cGUucHJvdG90eXBlLmNvbnN0cnVjdG9yLm5hbWVdKTtcbiAgfSk7XG59XG5cblxubW9kdWxlLmV4cG9ydHMgPSB7XG5cdCdDbHVtcCc6IENsdW1wLFxuXHQnTHVtcCc6IEx1bXAsXG5cdCdjb25maWcnOiBjb25maWcsXG5cdCd0eXBlcyc6IHR5cGVzLFxuXHQnbGlicmFyeSc6IGxpYnJhcnksXG5cdCdsb2FkZWQnOiBsb2FkZWQsXG5cdCdnZXQnOiBnZXQsXG5cdCd3aGF0SXMnOiB3aGF0SXMsXG5cdCd3aXJlVXBPYmplY3RzJzogd2lyZVVwT2JqZWN0cyxcblx0J2dldE9yQ3JlYXRlJzogZ2V0T3JDcmVhdGUsXG5cdCdkZXNjcmliZUFkdmFuY2VkRXhwcmVzc2lvbic6IGRlc2NyaWJlQWR2YW5jZWRFeHByZXNzaW9uLFxuXHQncmVhZEZyb21GaWxlJzogcmVhZEZyb21GaWxlXG59OyIsIlxuaWYodHlwZW9mIEZpbGVSZWFkZXIgPT09ICd1bmRlZmluZWQnKSB7IC8vIFJ1bm5pbmcgaW4gbm9kZSByYXRoZXIgdGhhbiBhIGJyb3dzZXJcbiAgRmlsZVJlYWRlciA9IHJlcXVpcmUoJ2ZpbGVyZWFkZXInKTtcbn1cblxudmFyIGZpbGVPYmplY3RNYXAgPSB7XG4gICAgJ2V2ZW50cy5qc29uJyA6ICdFdmVudCcsXG4gICAgJ3F1YWxpdGllcy5qc29uJyA6ICdRdWFsaXR5JyxcbiAgICAnYXJlYXMuanNvbicgOiAnQXJlYScsXG4gICAgJ1NwYXduZWRFbnRpdGllcy5qc29uJyA6ICdTcGF3bmVkRW50aXR5JyxcbiAgICAnQ29tYmF0QXR0YWNrcy5qc29uJyA6ICdDb21iYXRBdHRhY2snLFxuICAgICdleGNoYW5nZXMuanNvbicgOiAnRXhjaGFuZ2UnLFxuICAgICdUaWxlcy5qc29uJzogJ1RpbGUnXG4gIH07XG5cbmZ1bmN0aW9uIHJlYWRGaWxlKGZpbGUsIGNhbGxiYWNrKSB7XG4gIHZhciByZWFkZXIgPSBuZXcgRmlsZVJlYWRlcigpO1xuICByZWFkZXIub25sb2FkID0gY2FsbGJhY2s7XG4gIHJlYWRlci5yZWFkQXNUZXh0KGZpbGUpO1xufVxuXG52YXIgZmlsZXNfdG9fbG9hZCA9IDA7XG5mdW5jdGlvbiByZXNldEZpbGVzVG9Mb2FkKCkge1xuXHRmaWxlc190b19sb2FkID0gMDtcbn1cbmZ1bmN0aW9uIGluY3JlbWVudEZpbGVzVG9Mb2FkKCkge1xuXHRmaWxlc190b19sb2FkKys7XG59XG5mdW5jdGlvbiBkZWNyZW1lbnRGaWxlc1RvTG9hZCgpIHtcblx0ZmlsZXNfdG9fbG9hZC0tO1xufVxuZnVuY3Rpb24gY291bnRGaWxlc1RvTG9hZCgpIHtcblx0cmV0dXJuIGZpbGVzX3RvX2xvYWQ7XG59XG5cblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIHJlYWRGaWxlOiByZWFkRmlsZSxcbiAgcmVzZXRGaWxlc1RvTG9hZDogcmVzZXRGaWxlc1RvTG9hZCxcblx0aW5jcmVtZW50RmlsZXNUb0xvYWQ6IGluY3JlbWVudEZpbGVzVG9Mb2FkLFxuXHRkZWNyZW1lbnRGaWxlc1RvTG9hZDogZGVjcmVtZW50RmlsZXNUb0xvYWQsXG5cdGNvdW50RmlsZXNUb0xvYWQ6IGNvdW50RmlsZXNUb0xvYWQsXG4gIGZpbGVPYmplY3RNYXA6IGZpbGVPYmplY3RNYXBcbn07IiwibW9kdWxlLmV4cG9ydHMgPSB7fTsiLCJ2YXIgTHVtcCA9IHJlcXVpcmUoJy4vbHVtcCcpO1xuXG52YXIgYXBpO1xuXG5mdW5jdGlvbiBBcmVhKHJhdykge1xuXHR0aGlzLnN0cmFpZ2h0Q29weSA9IFtcIk5hbWVcIiwgXCJEZXNjcmlwdGlvblwiLCBcIkltYWdlTmFtZVwiLCBcIk1vdmVNZXNzYWdlXCJdO1xuXHRMdW1wLmNhbGwodGhpcywgcmF3KTtcbn1cbk9iamVjdC5rZXlzKEx1bXAucHJvdG90eXBlKS5mb3JFYWNoKGZ1bmN0aW9uKG1lbWJlcikgeyBBcmVhLnByb3RvdHlwZVttZW1iZXJdID0gTHVtcC5wcm90b3R5cGVbbWVtYmVyXTsgfSk7XG5cbkFyZWEucHJvdG90eXBlLndpcmVVcCA9IGZ1bmN0aW9uKHRoZUFwaSkge1xuXHRhcGkgPSB0aGVBcGk7XG5cdEx1bXAucHJvdG90eXBlLndpcmVVcC5jYWxsKHRoaXMpO1xufTtcblxuQXJlYS5wcm90b3R5cGUudG9TdHJpbmcgPSBmdW5jdGlvbigpIHtcblx0cmV0dXJuIHRoaXMuY29uc3RydWN0b3IubmFtZSArIFwiIFwiICsgdGhpcy5OYW1lICsgXCIgKCNcIiArIHRoaXMuSWQgKyBcIilcIjtcbn07XG5cbkFyZWEucHJvdG90eXBlLnRvRG9tID0gZnVuY3Rpb24oc2l6ZSkge1xuXG5cdHNpemUgPSBzaXplIHx8IFwibm9ybWFsXCI7XG5cblx0dmFyIGVsZW1lbnQgPSAgZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImxpXCIpO1xuXHRlbGVtZW50LmNsYXNzTmFtZSA9IFwiaXRlbSBcIit0aGlzLmNvbnN0cnVjdG9yLm5hbWUudG9Mb3dlckNhc2UoKStcIi1pdGVtIFwiK3NpemU7XG5cblx0aWYodGhpcy5JbWFnZU5hbWUgIT09IG51bGwgJiYgdGhpcy5JbWFnZSAhPT0gXCJcIikge1xuXHRcdGVsZW1lbnQuaW5uZXJIVE1MID0gXCI8aW1nIGNsYXNzPSdpY29uJyBzcmM9J1wiK2FwaS5jb25maWcubG9jYXRpb25zLmltYWdlc1BhdGgrXCIvXCIrdGhpcy5JbWFnZU5hbWUrXCIucG5nJyAvPlwiO1xuXHR9XG5cblx0ZWxlbWVudC5pbm5lckhUTUwgKz0gXCJcXG48aDMgY2xhc3M9J3RpdGxlJz5cIit0aGlzLk5hbWUrXCI8L2gzPlxcbjxwIGNsYXNzPSdkZXNjcmlwdGlvbic+XCIrdGhpcy5EZXNjcmlwdGlvbitcIjwvcD5cIjtcblxuXHRlbGVtZW50LnRpdGxlID0gdGhpcy50b1N0cmluZygpO1xuXG5cdHJldHVybiBlbGVtZW50O1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBBcmVhOyIsInZhciBMdW1wID0gcmVxdWlyZSgnLi9sdW1wJyk7XG5cbnZhciBhcGk7XG5cbmZ1bmN0aW9uIEF2YWlsYWJpbGl0eShyYXcsIHBhcmVudCkge1xuXHR0aGlzLnN0cmFpZ2h0Q29weSA9IFtcblx0XHQnQ29zdCcsXG5cdFx0J1NlbGxQcmljZSdcblx0XTtcblx0THVtcC5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuXG5cdHRoaXMucXVhbGl0eSA9IG51bGw7XG5cdHRoaXMucHVyY2hhc2VRdWFsaXR5ID0gbnVsbDtcbn1cbk9iamVjdC5rZXlzKEx1bXAucHJvdG90eXBlKS5mb3JFYWNoKGZ1bmN0aW9uKG1lbWJlcikgeyBBdmFpbGFiaWxpdHkucHJvdG90eXBlW21lbWJlcl0gPSBMdW1wLnByb3RvdHlwZVttZW1iZXJdOyB9KTtcblxuQXZhaWxhYmlsaXR5LnByb3RvdHlwZS53aXJlVXAgPSBmdW5jdGlvbih0aGVBcGkpIHtcblxuXHRhcGkgPSB0aGVBcGk7XG5cblx0dGhpcy5xdWFsaXR5ID0gYXBpLmdldE9yQ3JlYXRlKGFwaS50eXBlcy5RdWFsaXR5LCB0aGlzLmF0dHJpYnMuUXVhbGl0eSwgdGhpcyk7XG5cdHRoaXMucHVyY2hhc2VRdWFsaXR5ID0gYXBpLmdldE9yQ3JlYXRlKGFwaS50eXBlcy5RdWFsaXR5LCB0aGlzLmF0dHJpYnMuUHVyY2hhc2VRdWFsaXR5LCB0aGlzKTtcblxuXHRMdW1wLnByb3RvdHlwZS53aXJlVXAuY2FsbCh0aGlzLCBhcGkpO1xufTtcblxuQXZhaWxhYmlsaXR5LnByb3RvdHlwZS5pc0FkZGl0aXZlID0gZnVuY3Rpb24oKSB7XG5cdHJldHVybiB0aGlzLkNvc3QgPiAwO1xufTtcblxuQXZhaWxhYmlsaXR5LnByb3RvdHlwZS5pc1N1YnRyYWN0aXZlID0gZnVuY3Rpb24oKSB7XG5cdHJldHVybiB0aGlzLlNlbGxQcmljZSA+IDA7XG59O1xuXG5BdmFpbGFiaWxpdHkucHJvdG90eXBlLnRvU3RyaW5nID0gZnVuY3Rpb24oKSB7XG5cdHJldHVybiB0aGlzLmNvbnN0cnVjdG9yLm5hbWUgKyBcIiBcIiArIHRoaXMucXVhbGl0eSArIFwiIChidXk6IFwiICsgdGhpcy5Db3N0ICsgXCJ4XCIgKyB0aGlzLnB1cmNoYXNlUXVhbGl0eS5OYW1lICsgXCIgLyBzZWxsOiBcIiArIHRoaXMuU2VsbFByaWNlICsgXCJ4XCIgKyB0aGlzLnB1cmNoYXNlUXVhbGl0eS5OYW1lICsgXCIpXCI7XG59O1xuXG5BdmFpbGFiaWxpdHkucHJvdG90eXBlLnRvRG9tID0gZnVuY3Rpb24oc2l6ZSkge1xuXG5cdHNpemUgPSBzaXplIHx8IFwic21hbGxcIjtcblxuXHR2YXIgZWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJsaVwiKTtcblx0ZWxlbWVudC5jbGFzc05hbWUgPSBcIml0ZW0gXCIrdGhpcy5jb25zdHJ1Y3Rvci5uYW1lLnRvTG93ZXJDYXNlKCkrXCItaXRlbSBcIitzaXplO1xuXHRcblx0dmFyIHB1cmNoYXNlX3F1YWxpdHlfZWxlbWVudDtcblxuXHRpZighdGhpcy5xdWFsaXR5KSB7XG5cdFx0cHVyY2hhc2VfcXVhbGl0eV9lbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInNwYW5cIik7XG5cdFx0cHVyY2hhc2VfcXVhbGl0eV9lbGVtZW50LmlubmVySFRNTCA9IFwiW0lOVkFMSURdXCI7XG5cdH1cblx0ZWxzZSB7XG5cdFx0cHVyY2hhc2VfcXVhbGl0eV9lbGVtZW50ID0gdGhpcy5xdWFsaXR5LnRvRG9tKFwic21hbGxcIiwgZmFsc2UsIFwic3BhblwiKTtcblx0fVxuXG5cdHZhciBjdXJyZW5jeV9xdWFsaXR5X2VsZW1lbnQgPSB0aGlzLnB1cmNoYXNlUXVhbGl0eS50b0RvbShcInNtYWxsXCIsIGZhbHNlLCBcInNwYW5cIik7XG5cdGN1cnJlbmN5X3F1YWxpdHlfZWxlbWVudC5jbGFzc05hbWUgPSBcInF1YW50aXR5IGl0ZW0gc21hbGxcIjtcblx0dmFyIGN1cnJlbmN5X3F1YWxpdHlfbWFya3VwID0gY3VycmVuY3lfcXVhbGl0eV9lbGVtZW50Lm91dGVySFRNTDtcblxuXHR2YXIgY3VycmVuY3lfYnV5X2Ftb3VudF9lbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInNwYW5cIik7XG5cdGN1cnJlbmN5X2J1eV9hbW91bnRfZWxlbWVudC5jbGFzc05hbWUgPSBcIml0ZW0gcXVhbnRpdHlcIjtcblx0Y3VycmVuY3lfYnV5X2Ftb3VudF9lbGVtZW50LmlubmVySFRNTCA9IFwiQnV5OiBcIiArICh0aGlzLkNvc3QgPyB0aGlzLkNvc3QrXCJ4XCIgOiBcIiYjMTAwMDc7XCIpO1xuXHRjdXJyZW5jeV9idXlfYW1vdW50X2VsZW1lbnQudGl0bGUgPSB0aGlzLnRvU3RyaW5nKCk7XG5cblx0dmFyIGN1cnJlbmN5X3NlbGxfYW1vdW50X2VsZW1lbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwic3BhblwiKTtcblx0Y3VycmVuY3lfc2VsbF9hbW91bnRfZWxlbWVudC5jbGFzc05hbWUgPSBcIml0ZW0gcXVhbnRpdHlcIjtcblx0Y3VycmVuY3lfc2VsbF9hbW91bnRfZWxlbWVudC5pbm5lckhUTUwgPSBcIlNlbGw6IFwiICsgKHRoaXMuU2VsbFByaWNlID8gdGhpcy5TZWxsUHJpY2UrXCJ4XCIgOiBcIiYjMTAwMDc7XCIpO1xuXHRjdXJyZW5jeV9zZWxsX2Ftb3VudF9lbGVtZW50LnRpdGxlID0gdGhpcy50b1N0cmluZygpO1xuXG5cblx0ZWxlbWVudC5hcHBlbmRDaGlsZChwdXJjaGFzZV9xdWFsaXR5X2VsZW1lbnQpO1xuXHRlbGVtZW50LmFwcGVuZENoaWxkKGN1cnJlbmN5X2J1eV9hbW91bnRfZWxlbWVudCk7XG5cdGlmKHRoaXMuQ29zdCkge1xuXHRcdGVsZW1lbnQuYXBwZW5kQ2hpbGQoJChjdXJyZW5jeV9xdWFsaXR5X21hcmt1cClbMF0pO1xuXHR9XG5cdGVsZW1lbnQuYXBwZW5kQ2hpbGQoY3VycmVuY3lfc2VsbF9hbW91bnRfZWxlbWVudCk7XG5cdGlmKHRoaXMuU2VsbFByaWNlKSB7XG5cdFx0ZWxlbWVudC5hcHBlbmRDaGlsZCgkKGN1cnJlbmN5X3F1YWxpdHlfbWFya3VwKVswXSk7XG5cdH1cblxuXHRyZXR1cm4gZWxlbWVudDtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gQXZhaWxhYmlsaXR5OyIsIlxuZnVuY3Rpb24gQ2x1bXAocmF3LCBUeXBlLCBwYXJlbnQpIHtcblx0dGhpcy50eXBlID0gVHlwZTtcblx0dGhpcy5pdGVtcyA9IHt9O1xuXHR2YXIgc2VsZiA9IHRoaXM7XG5cdHJhdy5mb3JFYWNoKGZ1bmN0aW9uKGl0ZW0sIGluZGV4LCBjb2xsZWN0aW9uKSB7XG5cdFx0aWYoIShpdGVtIGluc3RhbmNlb2YgVHlwZSkpIHtcblx0XHRcdGl0ZW0gPSBuZXcgVHlwZShpdGVtLCBwYXJlbnQpO1xuXHRcdH1cblx0XHRlbHNlIGlmKHBhcmVudCkge1xuXHRcdFx0dmFyIG5ld1BhcmVudCA9IHRydWU7XG5cdFx0XHRpdGVtLnBhcmVudHMuZm9yRWFjaChmdW5jdGlvbihwKSB7XG5cdFx0XHRcdGlmKHAuSWQgPT09IHBhcmVudC5JZCAmJiBwLmNvbnN0cnVjdG9yLm5hbWUgPT09IHBhcmVudC5jb25zdHJ1Y3Rvci5uYW1lKSB7XG5cdFx0XHRcdFx0bmV3UGFyZW50ID0gZmFsc2U7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdFx0aWYobmV3UGFyZW50KXtcblx0XHRcdFx0aXRlbS5wYXJlbnRzLnB1c2gocGFyZW50KTtcblx0XHRcdH1cblx0XHR9XG5cdFx0c2VsZi5pdGVtc1tpdGVtLklkXSA9IGl0ZW07XG5cdH0pO1xufVxuXG5DbHVtcC5wcm90b3R5cGUuZW1wdHkgPSBmdW5jdGlvbigpIHtcblx0cmV0dXJuICEhdGhpcy5zaXplKCk7XG59O1xuXG5DbHVtcC5wcm90b3R5cGUuc2l6ZSA9IGZ1bmN0aW9uKCkge1xuXHRyZXR1cm4gT2JqZWN0LmtleXModGhpcy5pdGVtcykubGVuZ3RoO1xufTtcblxuQ2x1bXAucHJvdG90eXBlLmdldCA9IGZ1bmN0aW9uKGluZGV4KSB7XG5cdGZvcih2YXIgaWQgaW4gdGhpcy5pdGVtcykge1xuXHRcdGlmKGluZGV4ID09PSAwKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5pdGVtc1tpZF07XG5cdFx0fVxuXHRcdGluZGV4LS07XG5cdH1cbn07XG5cbkNsdW1wLnByb3RvdHlwZS5pZCA9IGZ1bmN0aW9uKGlkKSB7XG5cdHJldHVybiB0aGlzLml0ZW1zW2lkXTtcbn07XG5cbkNsdW1wLnByb3RvdHlwZS5lYWNoID0gZnVuY3Rpb24oKSB7XG5cdHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzKTtcblx0cmV0dXJuIHRoaXMubWFwKGZ1bmN0aW9uKGl0ZW0pIHtcblxuXHRcdGlmKGFyZ3NbMF0gaW5zdGFuY2VvZiBBcnJheSkge1x0Ly8gUGFzc2VkIGluIGFycmF5IG9mIGZpZWxkcywgc28gcmV0dXJuIHZhbHVlcyBjb25jYXRlbmF0ZWQgd2l0aCBvcHRpb25hbCBzZXBhcmF0b3Jcblx0XHRcdHZhciBzZXBhcmF0b3IgPSAodHlwZW9mIGFyZ3NbMV0gPT09IFwidW5kZWZpbmVkXCIpID8gXCItXCIgOiBhcmdzWzFdO1xuXHRcdFx0cmV0dXJuIGFyZ3NbMF0ubWFwKGZ1bmN0aW9uKGYpIHsgcmV0dXJuIGl0ZW1bZl07IH0pLmpvaW4oc2VwYXJhdG9yKTtcblx0XHR9XG5cdFx0ZWxzZSBpZihhcmdzLmxlbmd0aCA+IDEpIHtcdC8vIFBhc3NlZCBpbiBzZXBhcmF0ZSBmaWVsZHMsIHNvIHJldHVybiBhcnJheSBvZiB2YWx1ZXNcblx0XHRcdHJldHVybiBhcmdzLm1hcChmdW5jdGlvbihmKSB7IHJldHVybiBpdGVtW2ZdOyB9KTtcblx0XHR9XG5cdFx0ZWxzZSB7XG5cdFx0XHRyZXR1cm4gaXRlbVthcmdzWzBdXTtcblx0XHR9XG5cdH0pO1xufTtcblxuQ2x1bXAucHJvdG90eXBlLmZvckVhY2ggPSBmdW5jdGlvbihjYWxsYmFjaykge1xuXHRmb3IodmFyIGlkIGluIHRoaXMuaXRlbXMpIHtcblx0XHR2YXIgaXRlbSA9IHRoaXMuaXRlbXNbaWRdO1xuXHRcdGNhbGxiYWNrKGl0ZW0sIGlkLCB0aGlzLml0ZW1zKTtcblx0fVxufTtcblxuQ2x1bXAucHJvdG90eXBlLm1hcCA9IGZ1bmN0aW9uKGNhbGxiYWNrKSB7XG5cdHZhciBzZWxmID0gdGhpcztcblx0dmFyIGFycmF5T2ZJdGVtcyA9IE9iamVjdC5rZXlzKHRoaXMuaXRlbXMpLm1hcChmdW5jdGlvbihrZXkpIHtcblx0XHRyZXR1cm4gc2VsZi5pdGVtc1trZXldO1xuXHR9KTtcblx0cmV0dXJuIGFycmF5T2ZJdGVtcy5tYXAuY2FsbChhcnJheU9mSXRlbXMsIGNhbGxiYWNrKTtcbn07XG5cbkNsdW1wLnByb3RvdHlwZS5zb3J0QnkgPSBmdW5jdGlvbihmaWVsZCwgcmV2ZXJzZSkge1xuXHR2YXIgc2VsZiA9IHRoaXM7XG5cdHZhciBvYmpzID0gT2JqZWN0LmtleXModGhpcy5pdGVtcykubWFwKGZ1bmN0aW9uKGtleSkge1xuXHRcdHJldHVybiBzZWxmLml0ZW1zW2tleV07XG5cdH0pLnNvcnQoZnVuY3Rpb24oYSwgYikge1xuXHRcdGlmKGFbZmllbGRdIDwgYltmaWVsZF0pIHtcblx0XHRcdHJldHVybiAtMTtcblx0XHR9XG5cdFx0aWYoYVtmaWVsZF0gPT09IGJbZmllbGRdKSB7XG5cdFx0XHRyZXR1cm4gMDtcblx0XHR9XG5cdFx0aWYoYVtmaWVsZF0gPiBiW2ZpZWxkXSkge1xuXHRcdFx0cmV0dXJuIDE7XG5cdFx0fVxuXHR9KTtcblxuXHRyZXR1cm4gcmV2ZXJzZSA/IG9ianMucmV2ZXJzZSgpIDogb2Jqcztcbn07XG5cbkNsdW1wLnByb3RvdHlwZS5zYW1lID0gZnVuY3Rpb24oKSB7XG5cdHZhciBzZWxmID0gdGhpcztcblxuXHR2YXIgY2xvbmUgPSBmdW5jdGlvbihvYmopIHtcbiAgICB2YXIgdGFyZ2V0ID0ge307XG4gICAgZm9yICh2YXIgaSBpbiBvYmopIHtcbiAgICBcdGlmIChvYmouaGFzT3duUHJvcGVydHkoaSkpIHtcbiAgICBcdFx0aWYodHlwZW9mIG9ialtpXSA9PT0gXCJvYmplY3RcIikge1xuICAgIFx0XHRcdHRhcmdldFtpXSA9IGNsb25lKG9ialtpXSk7XG4gICAgXHRcdH1cbiAgICBcdFx0ZWxzZSB7XG4gICAgICBcdFx0dGFyZ2V0W2ldID0gb2JqW2ldO1xuICAgICAgXHR9XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB0YXJnZXQ7XG4gIH07XG5cblx0dmFyIHRlbXBsYXRlID0gY2xvbmUodGhpcy5nZXQoMCkuYXR0cmlicyk7XG5cblx0Zm9yKHZhciBpZCBpbiB0aGlzLml0ZW1zKSB7XG5cdFx0dmFyIG90aGVyT2JqID0gdGhpcy5pdGVtc1tpZF0uYXR0cmlicztcblx0XHRmb3IodmFyIGtleSBpbiB0ZW1wbGF0ZSkge1xuXHRcdFx0aWYodGVtcGxhdGVba2V5XSAhPT0gb3RoZXJPYmpba2V5XSkge1xuXHRcdFx0XHRkZWxldGUodGVtcGxhdGVba2V5XSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cmV0dXJuIHRlbXBsYXRlO1xufTtcblxuQ2x1bXAucHJvdG90eXBlLmRpc3RpbmN0ID0gZnVuY3Rpb24oZmllbGQpIHtcblx0dmFyIHNhbXBsZVZhbHVlcyA9IHt9O1xuXHR0aGlzLmZvckVhY2goZnVuY3Rpb24oaXRlbSkge1xuXHRcdHZhciB2YWx1ZSA9IGl0ZW1bZmllbGRdO1xuXHRcdHNhbXBsZVZhbHVlc1t2YWx1ZV0gPSB2YWx1ZTtcdC8vIENoZWFwIGRlLWR1cGluZyB3aXRoIGEgaGFzaFxuXHR9KTtcblx0cmV0dXJuIE9iamVjdC5rZXlzKHNhbXBsZVZhbHVlcykubWFwKGZ1bmN0aW9uKGtleSkgeyByZXR1cm4gc2FtcGxlVmFsdWVzW2tleV07IH0pO1xufTtcblxuQ2x1bXAucHJvdG90eXBlLmRpc3RpbmN0UmF3ID0gZnVuY3Rpb24oZmllbGQpIHtcblx0dmFyIHNhbXBsZVZhbHVlcyA9IHt9O1xuXHR0aGlzLmZvckVhY2goZnVuY3Rpb24oaXRlbSkge1xuXHRcdHZhciB2YWx1ZSA9IGl0ZW0uYXR0cmlic1tmaWVsZF07XG5cdFx0c2FtcGxlVmFsdWVzW3ZhbHVlXSA9IHZhbHVlO1x0Ly8gQ2hlYXAgZGUtZHVwaW5nIHdpdGggYSBoYXNoXG5cdH0pO1xuXHRyZXR1cm4gT2JqZWN0LmtleXMoc2FtcGxlVmFsdWVzKS5tYXAoZnVuY3Rpb24oa2V5KSB7IHJldHVybiBzYW1wbGVWYWx1ZXNba2V5XTsgfSk7XG59O1xuXG5DbHVtcC5wcm90b3R5cGUucXVlcnkgPSBmdW5jdGlvbihmaWVsZCwgdmFsdWUpIHtcblx0dmFyIG1hdGNoZXMgPSBbXTtcblx0dmFyIHRlc3Q7XG5cblx0Ly8gV29yayBvdXQgd2hhdCBzb3J0IG9mIGNvbXBhcmlzb24gdG8gZG86XG5cblx0aWYodHlwZW9mIHZhbHVlID09PSBcImZ1bmN0aW9uXCIpIHtcdC8vIElmIHZhbHVlIGlzIGEgZnVuY3Rpb24sIHBhc3MgaXQgdGhlIGNhbmRpZGF0ZSBhbmQgcmV0dXJuIHRoZSByZXN1bHRcblx0XHR0ZXN0ID0gZnVuY3Rpb24oY2FuZGlkYXRlKSB7XG5cdFx0XHRyZXR1cm4gISF2YWx1ZShjYW5kaWRhdGUpO1xuXHRcdH07XG5cdH1cblx0ZWxzZSBpZih0eXBlb2YgdmFsdWUgPT09IFwib2JqZWN0XCIpIHtcblx0XHRpZih2YWx1ZSBpbnN0YW5jZW9mIFJlZ0V4cCkge1xuXHRcdFx0dGVzdCA9IGZ1bmN0aW9uKGNhbmRpZGF0ZSkge1xuXHRcdFx0XHRyZXR1cm4gdmFsdWUudGVzdChjYW5kaWRhdGUpO1xuXHRcdFx0fTtcblx0XHR9XG5cdFx0ZWxzZSBpZih2YWx1ZSBpbnN0YW5jZW9mIEFycmF5KSB7XHQvLyBJZiB2YWx1ZSBpcyBhbiBhcnJheSwgdGVzdCBmb3IgdGhlIHByZXNlbmNlIG9mIHRoZSBjYW5kaWRhdGUgdmFsdWUgaW4gdGhlIGFycmF5XG5cdFx0XHR0ZXN0ID0gZnVuY3Rpb24oY2FuZGlkYXRlKSB7XG5cdFx0XHRcdHJldHVybiB2YWx1ZS5pbmRleE9mKGNhbmRpZGF0ZSkgIT09IC0xO1xuXHRcdFx0fTtcblx0XHR9XG5cdFx0ZWxzZSB7XG5cdFx0XHR0ZXN0ID0gZnVuY3Rpb24oY2FuZGlkYXRlKSB7XG5cdFx0XHRcdHJldHVybiBjYW5kaWRhdGUgPT09IHZhbHVlO1x0Ly8gSGFuZGxlIG51bGwsIHVuZGVmaW5lZCBvciBvYmplY3QtcmVmZXJlbmNlIGNvbXBhcmlzb25cblx0XHRcdH07XG5cdFx0fVxuXHR9XG5cdGVsc2Uge1x0Ly8gRWxzZSBpZiBpdCdzIGEgc2ltcGxlIHR5cGUsIHRyeSBhIHN0cmljdCBlcXVhbGl0eSBjb21wYXJpc29uXG5cdFx0dGVzdCA9IGZ1bmN0aW9uKGNhbmRpZGF0ZSkge1xuXHRcdFx0cmV0dXJuIGNhbmRpZGF0ZSA9PT0gdmFsdWU7XG5cdFx0fTtcblx0fVxuXHRcblx0Ly8gTm93IGl0ZXJhdGUgb3ZlciB0aGUgaXRlbXMsIGZpbHRlcmluZyB1c2luZyB0aGUgdGVzdCBmdW5jdGlvbiB3ZSBkZWZpbmVkXG5cdHRoaXMuZm9yRWFjaChmdW5jdGlvbihpdGVtKSB7XG5cdFx0aWYoXG5cdFx0XHQoZmllbGQgIT09IG51bGwgJiYgdGVzdChpdGVtW2ZpZWxkXSkpIHx8XG5cdFx0XHQoZmllbGQgPT09IG51bGwgJiYgdGVzdChpdGVtKSlcblx0XHQpIHtcblx0XHRcdG1hdGNoZXMucHVzaChpdGVtKTtcblx0XHR9XG5cdH0pO1xuXHRyZXR1cm4gbmV3IENsdW1wKG1hdGNoZXMsIHRoaXMudHlwZSk7XHQvLyBBbmQgd3JhcCB0aGUgcmVzdWx0aW5nIGFycmF5IG9mIG9iamVjdHMgaW4gYSBuZXcgQ2x1bXAgb2JqZWN0IGZvciBzZXh5IG1ldGhvZCBjaGFpbmluZyBsaWtlIHgucXVlcnkoKS5mb3JFYWNoKCkgb3IgeC5xdWVyeSgpLnF1ZXJ5KClcbn07XG5cbkNsdW1wLnByb3RvdHlwZS5xdWVyeVJhdyA9IGZ1bmN0aW9uKGZpZWxkLCB2YWx1ZSkge1xuXHR2YXIgbWF0Y2hlcyA9IFtdO1xuXHR2YXIgdGVzdDtcblxuXHQvLyBXb3JrIG91dCB3aGF0IHNvcnQgb2YgY29tcGFyaXNvbiB0byBkbzpcblxuXHRpZih0eXBlb2YgdmFsdWUgPT09IFwiZnVuY3Rpb25cIikge1x0Ly8gSWYgdmFsdWUgaXMgYSBmdW5jdGlvbiwgcGFzcyBpdCB0aGUgY2FuZGlkYXRlIGFuZCByZXR1cm4gdGhlIHJlc3VsdFxuXHRcdHRlc3QgPSBmdW5jdGlvbihjYW5kaWRhdGUpIHtcblx0XHRcdHJldHVybiAhIXZhbHVlKGNhbmRpZGF0ZSk7XG5cdFx0fTtcblx0fVxuXHRlbHNlIGlmKHR5cGVvZiB2YWx1ZSA9PT0gXCJvYmplY3RcIikge1xuXHRcdGlmKHZhbHVlIGluc3RhbmNlb2YgUmVnRXhwKSB7XG5cdFx0XHR0ZXN0ID0gZnVuY3Rpb24oY2FuZGlkYXRlKSB7XG5cdFx0XHRcdHJldHVybiB2YWx1ZS50ZXN0KGNhbmRpZGF0ZSk7XG5cdFx0XHR9O1xuXHRcdH1cblx0XHRlbHNlIGlmKHZhbHVlIGluc3RhbmNlb2YgQXJyYXkpIHtcdC8vIElmIHZhbHVlIGlzIGFuIGFycmF5LCB0ZXN0IGZvciB0aGUgcHJlc2VuY2Ugb2YgdGhlIGNhbmRpZGF0ZSB2YWx1ZSBpbiB0aGUgYXJyYXlcblx0XHRcdHRlc3QgPSBmdW5jdGlvbihjYW5kaWRhdGUpIHtcblx0XHRcdFx0cmV0dXJuIHZhbHVlLmluZGV4T2YoY2FuZGlkYXRlKSAhPT0gLTE7XG5cdFx0XHR9O1xuXHRcdH1cblx0XHRlbHNlIHtcdC8vIElmIHZhbHVlIGlzIGEgaGFzaC4uLiB3aGF0IGRvIHdlIGRvP1xuXHRcdFx0Ly8gQ2hlY2sgdGhlIGNhbmRpZGF0ZSBmb3IgZWFjaCBmaWVsZCBpbiB0aGUgaGFzaCBpbiB0dXJuLCBhbmQgaW5jbHVkZSB0aGUgY2FuZGlkYXRlIGlmIGFueS9hbGwgb2YgdGhlbSBoYXZlIHRoZSBzYW1lIHZhbHVlIGFzIHRoZSBjb3JyZXNwb25kaW5nIHZhbHVlLWhhc2ggZmllbGQ/XG5cdFx0XHR0aHJvdyBcIk5vIGlkZWEgd2hhdCB0byBkbyB3aXRoIGFuIG9iamVjdCBhcyB0aGUgdmFsdWVcIjtcblx0XHR9XG5cdH1cblx0ZWxzZSB7XHQvLyBFbHNlIGlmIGl0J3MgYSBzaW1wbGUgdHlwZSwgdHJ5IGEgc3RyaWN0IGVxdWFsaXR5IGNvbXBhcmlzb25cblx0XHR0ZXN0ID0gZnVuY3Rpb24oY2FuZGlkYXRlKSB7XG5cdFx0XHRyZXR1cm4gY2FuZGlkYXRlID09PSB2YWx1ZTtcblx0XHR9O1xuXHR9XG5cdFxuXHQvLyBOb3cgaXRlcmF0ZSBvdmVyIHRoZW0gYWxsLCBmaWx0ZXJpbmcgdXNpbmcgdGhlIHRlc3QgZnVuY3Rpb24gd2UgZGVmaW5lZFxuXHR0aGlzLmZvckVhY2goZnVuY3Rpb24oaXRlbSkge1xuXHRcdGlmKFxuXHRcdFx0KGZpZWxkICE9PSBudWxsICYmIHRlc3QoaXRlbS5hdHRyaWJzW2ZpZWxkXSkpIHx8XG5cdFx0XHQoZmllbGQgPT09IG51bGwgJiYgdGVzdChpdGVtLmF0dHJpYnMpKVxuXHRcdCkge1xuXHRcdFx0bWF0Y2hlcy5wdXNoKGl0ZW0pO1xuXHRcdH1cblx0fSk7XG5cdHJldHVybiBuZXcgQ2x1bXAobWF0Y2hlcywgdGhpcy50eXBlKTtcdC8vIEFuZCB3cmFwIHRoZSByZXN1bHRpbmcgYXJyYXkgb2Ygb2JqZWN0cyBpbiBhIG5ldyBDbHVtcCBvYmplY3QgZm9yIHNleHkgbWV0aG9kIGNoYWluaW5nIGxpa2UgeC5xdWVyeSgpLmZvckVhY2goKSBvciB4LnF1ZXJ5KCkucXVlcnkoKVxufTtcblxuQ2x1bXAucHJvdG90eXBlLnRvU3RyaW5nID0gZnVuY3Rpb24oKSB7XG5cdHJldHVybiB0aGlzLnR5cGUubmFtZSArIFwiIENsdW1wIChcIiArIHRoaXMuc2l6ZSgpICsgXCIgaXRlbXMpXCI7XG59O1xuXG5DbHVtcC5wcm90b3R5cGUudG9Eb20gPSBmdW5jdGlvbihzaXplLCBpbmNsdWRlQ2hpbGRyZW4sIHRhZywgZmlyc3RDaGlsZCkge1xuXG5cdHNpemUgPSBzaXplIHx8IFwibm9ybWFsXCI7XG5cdHRhZyA9IHRhZyB8fCBcInVsXCI7XG5cblx0dmFyIGVsZW1lbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KHRhZyk7XG5cdGVsZW1lbnQuY2xhc3NOYW1lID0gdGhpcy5jb25zdHJ1Y3Rvci5uYW1lLnRvTG93ZXJDYXNlKCkrXCItbGlzdCBcIitzaXplO1xuXHRpZihmaXJzdENoaWxkKSB7XG5cdFx0ZWxlbWVudC5hcHBlbmRDaGlsZChmaXJzdENoaWxkKTtcblx0fVxuXHR0aGlzLnNvcnRCeShcIk5hbWVcIikuZm9yRWFjaChmdW5jdGlvbihpKSB7XG5cdFx0ZWxlbWVudC5hcHBlbmRDaGlsZChpLnRvRG9tKHNpemUsIGluY2x1ZGVDaGlsZHJlbikpO1xuXHR9KTtcblx0cmV0dXJuIGVsZW1lbnQ7XG59O1xuXG5DbHVtcC5wcm90b3R5cGUuZGVzY3JpYmUgPSBmdW5jdGlvbigpIHtcblx0dmFyIHNlbGYgPSB0aGlzO1xuXHRyZXR1cm4gT2JqZWN0LmtleXModGhpcy5pdGVtcykubWFwKGZ1bmN0aW9uKGkpIHsgcmV0dXJuIHNlbGYuaXRlbXNbaV0udG9TdHJpbmcoKTsgfSkuam9pbihcIiBhbmQgXCIpO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBDbHVtcDsiLCJ2YXIgTHVtcCA9IHJlcXVpcmUoJy4vbHVtcCcpO1xudmFyIENsdW1wID0gcmVxdWlyZSgnLi9jbHVtcCcpO1xuXG52YXIgYXBpO1xuXG5mdW5jdGlvbiBDb21iYXRBdHRhY2socmF3LCBwYXJlbnQpIHtcblx0dGhpcy5zdHJhaWdodENvcHkgPSBbXG5cdFx0J05hbWUnLFxuXHRcdCdJbWFnZScsXG5cdFx0J1JhbW1pbmdBdHRhY2snLFxuXHRcdCdPbmx5V2hlbkV4cG9zZWQnLFxuXHRcdCdSYW5nZScsXG5cdFx0J09yaWVudGF0aW9uJyxcblx0XHQnQXJjJyxcblx0XHQnQmFzZUh1bGxEYW1hZ2UnLFxuXHRcdCdCYXNlTGlmZURhbWFnZScsXG5cdFx0J0V4cG9zZWRRdWFsaXR5RGFtYWdlJyxcdC8vIFZhbHVlIHRvIGFkZCB0byB0aGUgZXhwb3NlZFF1YWxpdHk6IHBvc2l0aXZlIGluY3JlYXNlcyBxdWFsaXR5IGxldmVsIChlZyBUZXJyb3IpLCBuZWdhdGl2ZSBkZWNyZWFzZXMgaXQgKGVnIENyZXcpXG5cdFx0J1N0YWdnZXJBbW91bnQnLFxuXHRcdCdCYXNlV2FybVVwJyxcblx0XHQnQW5pbWF0aW9uJyxcblx0XHQnQW5pbWF0aW9uTnVtYmVyJ1xuXHRdO1xuXHRyYXcuSWQgPSByYXcuTmFtZTtcblx0THVtcC5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuXG5cdHRoaXMucXVhbGl0eVJlcXVpcmVkID0gbnVsbDtcblx0dGhpcy5xdWFsaXR5Q29zdCA9IG51bGw7XG5cdHRoaXMuZXhwb3NlZFF1YWxpdHkgPSBudWxsO1xufVxuXG5PYmplY3Qua2V5cyhMdW1wLnByb3RvdHlwZSkuZm9yRWFjaChmdW5jdGlvbihtZW1iZXIpIHsgQ29tYmF0QXR0YWNrLnByb3RvdHlwZVttZW1iZXJdID0gTHVtcC5wcm90b3R5cGVbbWVtYmVyXTsgfSk7XG5cbkNvbWJhdEF0dGFjay5wcm90b3R5cGUud2lyZVVwID0gZnVuY3Rpb24odGhlQXBpKSB7XG5cblx0YXBpID0gdGhlQXBpO1xuXG5cdHRoaXMucXVhbGl0eVJlcXVpcmVkID0gYXBpLmdldChhcGkudHlwZXMuUXVhbGl0eSwgdGhpcy5hdHRyaWJzLlF1YWxpdHlSZXF1aXJlZElkLCB0aGlzKTtcblx0dGhpcy5xdWFsaXR5Q29zdCA9IGFwaS5nZXQoYXBpLnR5cGVzLlF1YWxpdHksIHRoaXMuYXR0cmlicy5RdWFsaXR5Q29zdElkLCB0aGlzKTtcblx0dGhpcy5leHBvc2VkUXVhbGl0eSA9IGFwaS5nZXQoYXBpLnR5cGVzLlF1YWxpdHksIHRoaXMuYXR0cmlicy5FeHBvc2VkUXVhbGl0eUlkLCB0aGlzKTtcblxuXHRMdW1wLnByb3RvdHlwZS53aXJlVXAuY2FsbCh0aGlzLCBhcGkpO1xufTtcblxuQ29tYmF0QXR0YWNrLnByb3RvdHlwZS50b1N0cmluZyA9IGZ1bmN0aW9uKCkge1xuXHRyZXR1cm4gdGhpcy5jb25zdHJ1Y3Rvci5uYW1lICsgXCIgXCIgKyB0aGlzLk5hbWUgKyBcIiAoI1wiICsgdGhpcy5JZCArIFwiKVwiO1xufTtcblxuQ29tYmF0QXR0YWNrLnByb3RvdHlwZS50b0RvbSA9IGZ1bmN0aW9uKHNpemUsIGluY2x1ZGVDaGlsZHJlbikge1xuXG5cdHNpemUgPSBzaXplIHx8IFwibm9ybWFsXCI7XG5cdGluY2x1ZGVDaGlsZHJlbiA9IGluY2x1ZGVDaGlsZHJlbiA9PT0gZmFsc2UgPyBmYWxzZSA6IHRydWU7XG5cblx0dmFyIHNlbGYgPSB0aGlzO1xuXHRcblx0dmFyIGh0bWwgPSBcIlwiO1xuXG5cdHZhciBlbGVtZW50ID0gIGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJsaVwiKTtcblx0ZWxlbWVudC5jbGFzc05hbWUgPSBcIml0ZW0gXCIrdGhpcy5jb25zdHJ1Y3Rvci5uYW1lLnRvTG93ZXJDYXNlKCkrXCItaXRlbSBcIitzaXplO1xuXG5cdGlmKHRoaXMuSW1hZ2UgIT09IG51bGwgJiYgdGhpcy5JbWFnZSAhPT0gXCJcIikge1xuXHRcdGh0bWwgPSBcIjxpbWcgY2xhc3M9J2ljb24nIHNyYz0nXCIrYXBpLmNvbmZpZy5sb2NhdGlvbnMuaW1hZ2VzUGF0aCtcIi9cIit0aGlzLkltYWdlK1wiLnBuZycgLz5cIjtcblx0fVxuXG5cdGh0bWwgKz0gXCJcXG48aDMgY2xhc3M9J3RpdGxlJz5cIit0aGlzLk5hbWUrXCI8L2gzPlwiO1xuXG5cdGlmKHRoaXMucXVhbGl0eVJlcXVpcmVkIHx8IHRoaXMucXVhbGl0eUNvc3QpIHtcblx0XHRodG1sICs9IFwiPGRpdiBjbGFzcz0nc2lkZWJhcic+XCI7XG5cblx0XHRpZih0aGlzLnF1YWxpdHlSZXF1aXJlZCkge1xuXHRcdFx0aHRtbCArPSBcIjxoND5SZXF1aXJlZDwvaDQ+XCI7XG5cdFx0XHRodG1sICs9IChuZXcgQ2x1bXAoW3RoaXMucXVhbGl0eVJlcXVpcmVkXSwgYXBpLnR5cGVzLlF1YWxpdHkpKS50b0RvbShcInNtYWxsXCIsIGZhbHNlLCBcInVsXCIpLm91dGVySFRNTDtcblx0XHR9XG5cdFx0aWYodGhpcy5xdWFsaXR5Q29zdCkge1xuXHRcdFx0aHRtbCArPSBcIjxoND5Db3N0PC9oND5cIjtcblx0XHRcdGh0bWwgKz0gKG5ldyBDbHVtcChbdGhpcy5xdWFsaXR5Q29zdF0sIGFwaS50eXBlcy5RdWFsaXR5KSkudG9Eb20oXCJzbWFsbFwiLCBmYWxzZSwgXCJ1bFwiKS5vdXRlckhUTUw7XG5cdFx0fVxuXHRcdGh0bWwgKz0gXCI8L2Rpdj5cIjtcblx0fVxuXG5cdGh0bWwgKz0gXCI8ZGwgY2xhc3M9J2NsdW1wLWxpc3Qgc21hbGwnPlwiO1xuXHRbJ1JhbmdlJywgJ0FyYycsICdCYXNlSHVsbERhbWFnZScsICdCYXNlTGlmZURhbWFnZScsICdTdGFnZ2VyQW1vdW50JywgJ0Jhc2VXYXJtVXAnXS5mb3JFYWNoKGZ1bmN0aW9uKGtleSkge1xuXHRcdGh0bWwgKz0gXCI8ZHQgY2xhc3M9J2l0ZW0nPlwiK2tleStcIjwvZHQ+PGRkIGNsYXNzPSdxdWFudGl0eSc+XCIrc2VsZltrZXldK1wiPC9kZD5cIjtcblx0fSk7XG5cdGh0bWwgKz0gXCI8L2RsPlwiO1xuXG5cdGVsZW1lbnQuaW5uZXJIVE1MID0gaHRtbDtcblxuXHRlbGVtZW50LnRpdGxlID0gdGhpcy50b1N0cmluZygpO1xuXG5cdGlmKGluY2x1ZGVDaGlsZHJlbikge1xuXHRcdGVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIGZ1bmN0aW9uKGUpIHtcblx0XHRcdGUuc3RvcFByb3BhZ2F0aW9uKCk7XG5cblx0XHRcdHZhciBjaGlsZExpc3QgPSBlbGVtZW50LnF1ZXJ5U2VsZWN0b3IoXCIuY2hpbGQtbGlzdFwiKTtcblx0XHRcdGlmKGNoaWxkTGlzdCkge1xuXHRcdFx0XHRlbGVtZW50LnJlbW92ZUNoaWxkKGNoaWxkTGlzdCk7XG5cdFx0XHR9XG5cdFx0XHRlbHNlIHtcblx0XHRcdFx0dmFyIHN1Y2Nlc3NFdmVudCA9IHNlbGYuc3VjY2Vzc0V2ZW50O1xuXHRcdFx0XHR2YXIgZGVmYXVsdEV2ZW50ID0gc2VsZi5kZWZhdWx0RXZlbnQ7XG5cdFx0XHRcdHZhciBxdWFsaXRpZXNSZXF1aXJlZCA9ICBzZWxmLnF1YWxpdGllc1JlcXVpcmVkO1xuXHRcdFx0XHR2YXIgZXZlbnRzID0gW107XG5cdFx0XHRcdGlmKHN1Y2Nlc3NFdmVudCAmJiBxdWFsaXRpZXNSZXF1aXJlZCAmJiBxdWFsaXRpZXNSZXF1aXJlZC5zaXplKCkpIHtcblx0XHRcdFx0XHRldmVudHMucHVzaChzdWNjZXNzRXZlbnQpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmKGRlZmF1bHRFdmVudCkge1xuXHRcdFx0XHRcdGV2ZW50cy5wdXNoKGRlZmF1bHRFdmVudCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYoZXZlbnRzLmxlbmd0aCkge1xuXHRcdFx0XHRcdHZhciB3cmFwcGVyQ2x1bXAgPSBuZXcgQ2x1bXAoZXZlbnRzLCBhcGkudHlwZXMuRXZlbnQpO1xuXHRcdFx0XHRcdHZhciBjaGlsZF9ldmVudHMgPSB3cmFwcGVyQ2x1bXAudG9Eb20oc2l6ZSwgdHJ1ZSk7XG5cblx0XHRcdFx0XHRjaGlsZF9ldmVudHMuY2xhc3NMaXN0LmFkZChcImNoaWxkLWxpc3RcIik7XG5cdFx0XHRcdFx0ZWxlbWVudC5hcHBlbmRDaGlsZChjaGlsZF9ldmVudHMpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRyZXR1cm4gZWxlbWVudDtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gQ29tYmF0QXR0YWNrOyIsInZhciBMdW1wID0gcmVxdWlyZSgnLi9sdW1wJyk7XG52YXIgQ2x1bXAgPSByZXF1aXJlKCcuL2NsdW1wJyk7XG5cbnZhciBhcGk7XG5cbmZ1bmN0aW9uIEV2ZW50KHJhdywgcGFyZW50KSB7XG5cdHRoaXMuc3RyYWlnaHRDb3B5ID0gW1xuXHQnTmFtZScsXG5cdCdEZXNjcmlwdGlvbicsXG5cdCdUZWFzZXInLFxuXHQnSW1hZ2UnLFxuXHQnQ2F0ZWdvcnknXG5cdF07XG5cdEx1bXAuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcblxuXHR0aGlzLnRhZyA9IG51bGw7XG5cblx0dGhpcy5FeG90aWNFZmZlY3RzID0gdGhpcy5nZXRFeG90aWNFZmZlY3QodGhpcy5hdHRyaWJzLkV4b3RpY0VmZmVjdHMpO1xuXG5cdHRoaXMucXVhbGl0aWVzUmVxdWlyZWQgPSBudWxsO1xuXHR0aGlzLnF1YWxpdGllc0FmZmVjdGVkID0gbnVsbDtcblx0dGhpcy5pbnRlcmFjdGlvbnMgPSBudWxsO1xuXHR0aGlzLmxpbmtUb0V2ZW50ID0gbnVsbDtcblxuXHR0aGlzLmxpbWl0ZWRUb0FyZWEgPSBudWxsO1xuXG5cdHRoaXMuc2V0dGluZyA9IG51bGw7XG5cdFxuXHQvL0RlY2tcblx0Ly9TdGlja2luZXNzXG5cdC8vVHJhbnNpZW50XG5cdC8vVXJnZW5jeVxufVxuT2JqZWN0LmtleXMoTHVtcC5wcm90b3R5cGUpLmZvckVhY2goZnVuY3Rpb24obWVtYmVyKSB7IEV2ZW50LnByb3RvdHlwZVttZW1iZXJdID0gTHVtcC5wcm90b3R5cGVbbWVtYmVyXTsgfSk7XG5cbkV2ZW50LnByb3RvdHlwZS53aXJlVXAgPSBmdW5jdGlvbih0aGVBcGkpIHtcblxuXHRhcGkgPSB0aGVBcGk7XG5cblx0dGhpcy5xdWFsaXRpZXNSZXF1aXJlZCA9IG5ldyBDbHVtcCh0aGlzLmF0dHJpYnMuUXVhbGl0aWVzUmVxdWlyZWQgfHwgW10sIGFwaS50eXBlcy5RdWFsaXR5UmVxdWlyZW1lbnQsIHRoaXMpO1xuXHR0aGlzLnF1YWxpdGllc0FmZmVjdGVkID0gbmV3IENsdW1wKHRoaXMuYXR0cmlicy5RdWFsaXRpZXNBZmZlY3RlZCB8fCBbXSwgYXBpLnR5cGVzLlF1YWxpdHlFZmZlY3QsIHRoaXMpO1xuXHR0aGlzLmludGVyYWN0aW9ucyA9IG5ldyBDbHVtcCh0aGlzLmF0dHJpYnMuQ2hpbGRCcmFuY2hlc3x8IFtdLCBhcGkudHlwZXMuSW50ZXJhY3Rpb24sIHRoaXMpO1xuXG5cdHRoaXMubGlua1RvRXZlbnQgPSBhcGkuZ2V0T3JDcmVhdGUoYXBpLnR5cGVzLkV2ZW50LCB0aGlzLmF0dHJpYnMuTGlua1RvRXZlbnQsIHRoaXMpO1xuXG5cdHRoaXMubGltaXRlZFRvQXJlYSA9IGFwaS5nZXRPckNyZWF0ZShhcGkudHlwZXMuQXJlYSwgdGhpcy5hdHRyaWJzLkxpbWl0ZWRUb0FyZWEsIHRoaXMpO1xuXG5cdHRoaXMuc2V0dGluZyA9IGFwaS5nZXRPckNyZWF0ZShhcGkudHlwZXMuU2V0dGluZywgdGhpcy5hdHRyaWJzLlNldHRpbmcsIHRoaXMpO1xuXHRcblx0THVtcC5wcm90b3R5cGUud2lyZVVwLmNhbGwodGhpcywgYXBpKTtcbn07XG5cbkV2ZW50LnByb3RvdHlwZS50b1N0cmluZyA9IGZ1bmN0aW9uKGxvbmcpIHtcblx0cmV0dXJuIHRoaXMuY29uc3RydWN0b3IubmFtZSArIFwiIFwiICsgKGxvbmcgPyBcIiBbXCIgKyB0aGlzLkNhdGVnb3J5ICsgXCJdIFwiIDogXCJcIikgKyB0aGlzLk5hbWUgKyBcIiAoI1wiICsgdGhpcy5JZCArIFwiKVwiO1xufTtcblxuRXZlbnQucHJvdG90eXBlLnRvRG9tID0gZnVuY3Rpb24oc2l6ZSwgaW5jbHVkZUNoaWxkcmVuKSB7XG5cblx0c2l6ZSA9IHNpemUgfHwgXCJub3JtYWxcIjtcblx0aW5jbHVkZUNoaWxkcmVuID0gaW5jbHVkZUNoaWxkcmVuID09PSBmYWxzZSA/IGZhbHNlIDogdHJ1ZTtcblxuXHR2YXIgaHRtbCA9IFwiXCI7XG5cblx0dmFyIGVsZW1lbnQgPSAgZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImxpXCIpO1xuXHRlbGVtZW50LmNsYXNzTmFtZSA9IFwiaXRlbSBcIit0aGlzLmNvbnN0cnVjdG9yLm5hbWUudG9Mb3dlckNhc2UoKStcIi1pdGVtIFwiK3NpemU7XG5cblx0aWYodGhpcy5JbWFnZSAhPT0gbnVsbCAmJiB0aGlzLkltYWdlICE9PSBcIlwiKSB7XG5cdFx0aHRtbCA9IFwiPGltZyBjbGFzcz0naWNvbicgc3JjPSdcIithcGkuY29uZmlnLmxvY2F0aW9ucy5pbWFnZXNQYXRoK1wiL1wiK3RoaXMuSW1hZ2UrXCJzbWFsbC5wbmcnIC8+XCI7XG5cdH1cblxuXHRodG1sICs9IFwiXFxuPGgzIGNsYXNzPSd0aXRsZSc+XCIrdGhpcy5OYW1lK1wiXFxuXCIrKHRoaXMudGFnID8gXCI8c3BhbiBjbGFzcz0ndGFnIFwiK3RoaXMudGFnK1wiJz5cIit0aGlzLnRhZytcIjwvc3Bhbj5cIiA6IFwiXCIpK1wiPC9oMz5cIjtcblxuXHRpZihzaXplICE9IFwic21hbGxcIiAmJiAodGhpcy5xdWFsaXRpZXNSZXF1aXJlZCB8fCB0aGlzLnF1YWxpdGllc0FmZmVjdGVkKSkge1xuXHRcdGh0bWwgKz0gXCI8ZGl2IGNsYXNzPSdzaWRlYmFyJz5cIjtcblx0XHRpZih0aGlzLnF1YWxpdGllc1JlcXVpcmVkICYmIHRoaXMucXVhbGl0aWVzUmVxdWlyZWQuc2l6ZSgpKSB7XG5cdFx0XHRodG1sICs9IFwiPGg0PlJlcXVpcmVtZW50czwvaDQ+XFxuXCI7XG5cdFx0XHRodG1sICs9IHRoaXMucXVhbGl0aWVzUmVxdWlyZWQudG9Eb20oXCJzbWFsbFwiLCBmYWxzZSwgXCJ1bFwiKS5vdXRlckhUTUw7XG5cdFx0fVxuXHRcdGlmKHRoaXMucXVhbGl0aWVzQWZmZWN0ZWQgJiYgdGhpcy5xdWFsaXRpZXNBZmZlY3RlZC5zaXplKCkpIHtcblx0XHRcdGh0bWwgKz0gXCI8aDQ+RWZmZWN0czwvaDQ+XFxuXCI7XG5cdFx0XHRodG1sICs9IHRoaXMucXVhbGl0aWVzQWZmZWN0ZWQudG9Eb20oXCJzbWFsbFwiLCBmYWxzZSwgXCJ1bFwiKS5vdXRlckhUTUw7XG5cdFx0fVxuXHRcdGh0bWwgKz0gXCI8L2Rpdj5cIjtcblx0fVxuXHRcblx0aHRtbCArPSBcIjxwIGNsYXNzPSdkZXNjcmlwdGlvbic+XCIrdGhpcy5EZXNjcmlwdGlvbitcIjwvcD5cIjtcblxuXHRlbGVtZW50LmlubmVySFRNTCA9IGh0bWw7XG5cblx0ZWxlbWVudC50aXRsZSA9IHRoaXMudG9TdHJpbmcodHJ1ZSk7XG5cblx0aWYoaW5jbHVkZUNoaWxkcmVuKSB7XG5cdFx0dmFyIHNlbGYgPSB0aGlzO1xuXHRcdGVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIGZ1bmN0aW9uKGUpIHtcblx0XHRcdGUuc3RvcFByb3BhZ2F0aW9uKCk7XG5cblx0XHRcdHZhciBjaGlsZExpc3QgPSBlbGVtZW50LnF1ZXJ5U2VsZWN0b3IoXCIuY2hpbGQtbGlzdFwiKTtcblx0XHRcdGlmKGNoaWxkTGlzdCkge1xuXHRcdFx0XHRlbGVtZW50LnJlbW92ZUNoaWxkKGNoaWxkTGlzdCk7XG5cdFx0XHR9XG5cdFx0XHRlbHNlIHtcblx0XHRcdFx0dmFyIGludGVyYWN0aW9ucyA9IHNlbGYuaW50ZXJhY3Rpb25zO1xuXHRcdFx0XHR2YXIgbGlua1RvRXZlbnQgPSBzZWxmLmxpbmtUb0V2ZW50O1xuXHRcdFx0XHRpZihsaW5rVG9FdmVudCkge1xuXHRcdFx0XHRcdHZhciB3cmFwcGVyQ2x1bXAgPSBuZXcgQ2x1bXAoW2xpbmtUb0V2ZW50XSwgYXBpLnR5cGVzLkV2ZW50KTtcblx0XHRcdFx0XHR2YXIgbGlua1RvRXZlbnRfZWxlbWVudCA9IHdyYXBwZXJDbHVtcC50b0RvbShcIm5vcm1hbFwiLCB0cnVlKTtcblxuXHRcdFx0XHRcdGxpbmtUb0V2ZW50X2VsZW1lbnQuY2xhc3NMaXN0LmFkZChcImNoaWxkLWxpc3RcIik7XG5cdFx0XHRcdFx0ZWxlbWVudC5hcHBlbmRDaGlsZChsaW5rVG9FdmVudF9lbGVtZW50KTtcblx0XHRcdFx0fVxuXHRcdFx0XHRlbHNlIGlmKGludGVyYWN0aW9ucyAmJiBpbnRlcmFjdGlvbnMuc2l6ZSgpID4gMCkge1xuXHRcdFx0XHRcdHZhciBpbnRlcmFjdGlvbnNfZWxlbWVudCA9IGludGVyYWN0aW9ucy50b0RvbShcIm5vcm1hbFwiLCB0cnVlKTtcblxuXHRcdFx0XHRcdGludGVyYWN0aW9uc19lbGVtZW50LmNsYXNzTGlzdC5hZGQoXCJjaGlsZC1saXN0XCIpO1xuXHRcdFx0XHRcdGVsZW1lbnQuYXBwZW5kQ2hpbGQoaW50ZXJhY3Rpb25zX2VsZW1lbnQpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRyZXR1cm4gZWxlbWVudDtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gRXZlbnQ7IiwidmFyIEx1bXAgPSByZXF1aXJlKCcuL2x1bXAnKTtcbnZhciBDbHVtcCA9IHJlcXVpcmUoJy4vY2x1bXAnKTtcblxudmFyIGFwaTtcblxuZnVuY3Rpb24gRXhjaGFuZ2UocmF3LCBwYXJlbnQpIHtcblx0dGhpcy5zdHJhaWdodENvcHkgPSBbXG5cdFx0J0lkJyxcblx0XHQnTmFtZScsXG5cdFx0J0Rlc2NyaXB0aW9uJyxcblx0XHQnSW1hZ2UnLFxuXHRcdCdTZXR0aW5nSWRzJ1xuXHRdO1xuXHRMdW1wLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG5cblx0dGhpcy5zaG9wcyA9IG51bGw7XG5cdHRoaXMuc2V0dGluZ3MgPSBudWxsO1xufVxuT2JqZWN0LmtleXMoTHVtcC5wcm90b3R5cGUpLmZvckVhY2goZnVuY3Rpb24obWVtYmVyKSB7IEV4Y2hhbmdlLnByb3RvdHlwZVttZW1iZXJdID0gTHVtcC5wcm90b3R5cGVbbWVtYmVyXTsgfSk7XG5cbkV4Y2hhbmdlLnByb3RvdHlwZS53aXJlVXAgPSBmdW5jdGlvbih0aGVBcGkpIHtcblxuXHRhcGkgPSB0aGVBcGk7XG5cblx0dmFyIHNlbGYgPSB0aGlzO1xuXG5cdHRoaXMuc2hvcHMgPSBuZXcgQ2x1bXAodGhpcy5hdHRyaWJzLlNob3BzIHx8IFtdLCBhcGkudHlwZXMuU2hvcCwgdGhpcyk7XG5cdFxuXHR0aGlzLnNldHRpbmdzID0gYXBpLmxpYnJhcnkuU2V0dGluZy5xdWVyeShcIklkXCIsIGZ1bmN0aW9uKGlkKSB7XG5cdFx0cmV0dXJuIHNlbGYuU2V0dGluZ0lkcy5pbmRleE9mKGlkKSAhPT0gLTE7XG5cdH0pO1xuXHR0aGlzLnNldHRpbmdzLmZvckVhY2goZnVuY3Rpb24gKHMpIHtcblx0XHRzZWxmLnBhcmVudHMucHVzaChzKTtcblx0fSk7XG5cdFxuXHR0aGlzLnBvcnRzID0gYXBpLmxpYnJhcnkuUG9ydC5xdWVyeShcIlNldHRpbmdJZFwiLCBmdW5jdGlvbihpZCkge1xuXHRcdHJldHVybiBzZWxmLlNldHRpbmdJZHMuaW5kZXhPZihpZCkgIT09IC0xO1xuXHR9KTtcblx0dGhpcy5wb3J0cy5mb3JFYWNoKGZ1bmN0aW9uIChwKSB7XG5cdFx0c2VsZi5wYXJlbnRzLnB1c2gocCk7XG5cdH0pO1xuXG5cdEx1bXAucHJvdG90eXBlLndpcmVVcC5jYWxsKHRoaXMpO1xufTtcblxuRXhjaGFuZ2UucHJvdG90eXBlLnRvU3RyaW5nID0gZnVuY3Rpb24oKSB7XG5cdHJldHVybiB0aGlzLmNvbnN0cnVjdG9yLm5hbWUgKyBcIiBcIiArIHRoaXMuTmFtZSArIFwiICgjXCIgKyB0aGlzLklkICsgXCIpXCI7XG59O1xuXG5FeGNoYW5nZS5wcm90b3R5cGUudG9Eb20gPSBmdW5jdGlvbihzaXplLCBpbmNsdWRlQ2hpbGRyZW4sIHRhZykge1xuXG5cdHNpemUgPSBzaXplIHx8IFwibm9ybWFsXCI7XG5cdGluY2x1ZGVDaGlsZHJlbiA9IGluY2x1ZGVDaGlsZHJlbiA9PT0gZmFsc2UgPyBmYWxzZSA6IHRydWU7XG5cdHRhZyA9IHRhZyB8fCBcImxpXCI7XG5cblx0dmFyIHNlbGYgPSB0aGlzO1xuXHR2YXIgaHRtbCA9IFwiXCI7XG5cblx0dmFyIGVsZW1lbnQgPSAgZG9jdW1lbnQuY3JlYXRlRWxlbWVudCh0YWcpO1xuXHRlbGVtZW50LmNsYXNzTmFtZSA9IFwiaXRlbSBcIit0aGlzLmNvbnN0cnVjdG9yLm5hbWUudG9Mb3dlckNhc2UoKStcIi1pdGVtIFwiK3NpemU7XG5cblx0aHRtbCA9IFwiXFxuPGltZyBjbGFzcz0naWNvbicgc3JjPSdcIithcGkuY29uZmlnLmxvY2F0aW9ucy5pbWFnZXNQYXRoK1wiL1wiK3RoaXMuSW1hZ2UrXCIucG5nJyAvPlwiO1xuXHRodG1sICs9IFwiXFxuPGgzIGNsYXNzPSd0aXRsZSc+XCIrdGhpcy5OYW1lK1wiPC9oMz5cIjtcblx0aHRtbCArPSBcIlxcbjxwIGNsYXNzPSdkZXNjcmlwdGlvbic+XCIrdGhpcy5EZXNjcmlwdGlvbitcIjwvcD5cIjtcblxuXHRlbGVtZW50LmlubmVySFRNTCA9IGh0bWw7XG5cblx0ZWxlbWVudC50aXRsZSA9IHRoaXMudG9TdHJpbmcoKTtcblxuXHRpZihpbmNsdWRlQ2hpbGRyZW4pIHtcblx0XHRlbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCBmdW5jdGlvbihlKSB7XG5cdFx0XHRlLnN0b3BQcm9wYWdhdGlvbigpO1xuXG5cdFx0XHR2YXIgY2hpbGRMaXN0ID0gZWxlbWVudC5xdWVyeVNlbGVjdG9yKFwiLmNoaWxkLWxpc3RcIik7XG5cdFx0XHRpZihjaGlsZExpc3QpIHtcblx0XHRcdFx0ZWxlbWVudC5yZW1vdmVDaGlsZChjaGlsZExpc3QpO1xuXHRcdFx0fVxuXHRcdFx0ZWxzZSB7XG5cdFx0XHRcdGlmKHNlbGYuc2hvcHMpIHtcblxuXHRcdFx0XHRcdHZhciBjaGlsZF9lbGVtZW50cyA9IHNlbGYuc2hvcHMudG9Eb20oXCJub3JtYWxcIiwgdHJ1ZSk7XG5cblx0XHRcdFx0XHRjaGlsZF9lbGVtZW50cy5jbGFzc0xpc3QuYWRkKFwiY2hpbGQtbGlzdFwiKTtcblx0XHRcdFx0XHRlbGVtZW50LmFwcGVuZENoaWxkKGNoaWxkX2VsZW1lbnRzKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0cmV0dXJuIGVsZW1lbnQ7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEV4Y2hhbmdlOyIsInZhciBMdW1wID0gcmVxdWlyZSgnLi9sdW1wJyk7XG52YXIgQ2x1bXAgPSByZXF1aXJlKCcuL2NsdW1wJyk7XG5cbnZhciBhcGk7XG5cbmZ1bmN0aW9uIEludGVyYWN0aW9uKHJhdywgcGFyZW50KSB7XG5cdHRoaXMuc3RyYWlnaHRDb3B5ID0gW1xuXHQnTmFtZScsXG5cdCdEZXNjcmlwdGlvbicsXG5cdCdCdXR0b25UZXh0Jyxcblx0J0ltYWdlJyxcblxuXHQnT3JkZXJpbmcnXG5cdF07XG5cdEx1bXAuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcblxuXHR0aGlzLnF1YWxpdGllc1JlcXVpcmVkID0gbnVsbDtcblx0dGhpcy5zdWNjZXNzRXZlbnQgPSBudWxsO1xuXHR0aGlzLmRlZmF1bHRFdmVudCA9IG51bGw7XG5cbn1cbk9iamVjdC5rZXlzKEx1bXAucHJvdG90eXBlKS5mb3JFYWNoKGZ1bmN0aW9uKG1lbWJlcikgeyBJbnRlcmFjdGlvbi5wcm90b3R5cGVbbWVtYmVyXSA9IEx1bXAucHJvdG90eXBlW21lbWJlcl07IH0pO1xuXG5JbnRlcmFjdGlvbi5wcm90b3R5cGUud2lyZVVwID0gZnVuY3Rpb24odGhlQXBpKSB7XG5cblx0YXBpID0gdGhlQXBpO1xuXG5cdHRoaXMucXVhbGl0aWVzUmVxdWlyZWQgPSBuZXcgQ2x1bXAodGhpcy5hdHRyaWJzLlF1YWxpdGllc1JlcXVpcmVkIHx8IFtdLCBhcGkudHlwZXMuUXVhbGl0eVJlcXVpcmVtZW50LCB0aGlzKTtcblx0dGhpcy5zdWNjZXNzRXZlbnQgPSBhcGkuZ2V0T3JDcmVhdGUoYXBpLnR5cGVzLkV2ZW50LCB0aGlzLmF0dHJpYnMuU3VjY2Vzc0V2ZW50LCB0aGlzKTtcblx0aWYodGhpcy5zdWNjZXNzRXZlbnQpIHtcblx0XHR0aGlzLnN1Y2Nlc3NFdmVudC50YWcgPSBcInN1Y2Nlc3NcIjtcblx0fVxuXHR0aGlzLmRlZmF1bHRFdmVudCA9IGFwaS5nZXRPckNyZWF0ZShhcGkudHlwZXMuRXZlbnQsIHRoaXMuYXR0cmlicy5EZWZhdWx0RXZlbnQsIHRoaXMpO1xuXHR2YXIgcXVhbGl0aWVzUmVxdWlyZWQgPSAgdGhpcy5xdWFsaXRpZXNSZXF1aXJlZDtcblx0aWYodGhpcy5kZWZhdWx0RXZlbnQgJiYgdGhpcy5zdWNjZXNzRXZlbnQgJiYgcXVhbGl0aWVzUmVxdWlyZWQgJiYgcXVhbGl0aWVzUmVxdWlyZWQuc2l6ZSgpKSB7XG5cdFx0dGhpcy5kZWZhdWx0RXZlbnQudGFnID0gXCJmYWlsdXJlXCI7XG5cdH1cblxuXHRMdW1wLnByb3RvdHlwZS53aXJlVXAuY2FsbCh0aGlzLCBhcGkpO1xufTtcblxuSW50ZXJhY3Rpb24ucHJvdG90eXBlLnRvU3RyaW5nID0gZnVuY3Rpb24oKSB7XG5cdHJldHVybiB0aGlzLmNvbnN0cnVjdG9yLm5hbWUgKyBcIiBbXCIgKyB0aGlzLk9yZGVyaW5nICsgXCJdIFwiICsgdGhpcy5OYW1lICsgXCIgKCNcIiArIHRoaXMuSWQgKyBcIilcIjtcbn07XG5cbkludGVyYWN0aW9uLnByb3RvdHlwZS50b0RvbSA9IGZ1bmN0aW9uKHNpemUsIGluY2x1ZGVDaGlsZHJlbikge1xuXG5cdHNpemUgPSBzaXplIHx8IFwibm9ybWFsXCI7XG5cdGluY2x1ZGVDaGlsZHJlbiA9IGluY2x1ZGVDaGlsZHJlbiA9PT0gZmFsc2UgPyBmYWxzZSA6IHRydWU7XG5cblx0dmFyIGh0bWwgPSBcIlwiO1xuXG5cdHZhciBlbGVtZW50ID0gIGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJsaVwiKTtcblx0ZWxlbWVudC5jbGFzc05hbWUgPSBcIml0ZW0gXCIrdGhpcy5jb25zdHJ1Y3Rvci5uYW1lLnRvTG93ZXJDYXNlKCkrXCItaXRlbSBcIitzaXplO1xuXG5cdGlmKHRoaXMuSW1hZ2UgIT09IG51bGwgJiYgdGhpcy5JbWFnZSAhPT0gXCJcIikge1xuXHRcdGh0bWwgPSBcIjxpbWcgY2xhc3M9J2ljb24nIHNyYz0nXCIrYXBpLmNvbmZpZy5sb2NhdGlvbnMuaW1hZ2VzUGF0aCtcIi9cIit0aGlzLkltYWdlK1wic21hbGwucG5nJyAvPlwiO1xuXHR9XG5cblx0aHRtbCArPSBcIlxcbjxoMyBjbGFzcz0ndGl0bGUnPlwiK3RoaXMuTmFtZStcIjwvaDM+XCI7XG5cblx0aWYoc2l6ZSAhPSBcInNtYWxsXCIgJiYgdGhpcy5xdWFsaXRpZXNSZXF1aXJlZCkge1xuXHRcdGh0bWwgKz0gXCI8ZGl2IGNsYXNzPSdzaWRlYmFyJz5cIjtcblx0XHRodG1sICs9IFwiPGg0PlJlcXVpcmVtZW50czwvaDQ+XCI7XG5cdFx0aHRtbCArPSB0aGlzLnF1YWxpdGllc1JlcXVpcmVkLnRvRG9tKFwic21hbGxcIiwgZmFsc2UsIFwidWxcIikub3V0ZXJIVE1MO1xuXHRcdGh0bWwgKz0gXCI8L2Rpdj5cIjtcblx0fVxuXG5cdGh0bWwgKz0gXCI8cCBjbGFzcz0nZGVzY3JpcHRpb24nPlwiK3RoaXMuRGVzY3JpcHRpb24rXCI8L3A+XCI7XG5cblx0ZWxlbWVudC5pbm5lckhUTUwgPSBodG1sO1xuXG5cdGVsZW1lbnQudGl0bGUgPSB0aGlzLnRvU3RyaW5nKCk7XG5cblx0aWYoaW5jbHVkZUNoaWxkcmVuKSB7XG5cdFx0dmFyIHNlbGYgPSB0aGlzO1xuXHRcdGVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIGZ1bmN0aW9uKGUpIHtcblx0XHRcdGUuc3RvcFByb3BhZ2F0aW9uKCk7XG5cblx0XHRcdHZhciBjaGlsZExpc3QgPSBlbGVtZW50LnF1ZXJ5U2VsZWN0b3IoXCIuY2hpbGQtbGlzdFwiKTtcblx0XHRcdGlmKGNoaWxkTGlzdCkge1xuXHRcdFx0XHRlbGVtZW50LnJlbW92ZUNoaWxkKGNoaWxkTGlzdCk7XG5cdFx0XHR9XG5cdFx0XHRlbHNlIHtcblx0XHRcdFx0dmFyIHN1Y2Nlc3NFdmVudCA9IHNlbGYuc3VjY2Vzc0V2ZW50O1xuXHRcdFx0XHR2YXIgZGVmYXVsdEV2ZW50ID0gc2VsZi5kZWZhdWx0RXZlbnQ7XG5cdFx0XHRcdHZhciBxdWFsaXRpZXNSZXF1aXJlZCA9ICBzZWxmLnF1YWxpdGllc1JlcXVpcmVkO1xuXHRcdFx0XHR2YXIgZXZlbnRzID0gW107XG5cdFx0XHRcdGlmKHN1Y2Nlc3NFdmVudCAmJiBxdWFsaXRpZXNSZXF1aXJlZCAmJiBxdWFsaXRpZXNSZXF1aXJlZC5zaXplKCkpIHtcblx0XHRcdFx0XHRldmVudHMucHVzaChzdWNjZXNzRXZlbnQpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmKGRlZmF1bHRFdmVudCkge1xuXHRcdFx0XHRcdGV2ZW50cy5wdXNoKGRlZmF1bHRFdmVudCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYoZXZlbnRzLmxlbmd0aCkge1xuXHRcdFx0XHRcdHZhciB3cmFwcGVyQ2x1bXAgPSBuZXcgQ2x1bXAoZXZlbnRzLCBhcGkudHlwZXMuRXZlbnQpO1xuXHRcdFx0XHRcdHZhciBjaGlsZF9ldmVudHMgPSB3cmFwcGVyQ2x1bXAudG9Eb20oXCJub3JtYWxcIiwgdHJ1ZSk7XG5cblx0XHRcdFx0XHRjaGlsZF9ldmVudHMuY2xhc3NMaXN0LmFkZChcImNoaWxkLWxpc3RcIik7XG5cdFx0XHRcdFx0ZWxlbWVudC5hcHBlbmRDaGlsZChjaGlsZF9ldmVudHMpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRyZXR1cm4gZWxlbWVudDtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gSW50ZXJhY3Rpb247IiwidmFyIGxpYnJhcnkgPSByZXF1aXJlKCcuLi9saWJyYXJ5Jyk7XG52YXIgQ2x1bXAgPSByZXF1aXJlKCcuL2NsdW1wJyk7XG5cbnZhciBhcGk7XG5cbmZ1bmN0aW9uIEx1bXAocmF3LCBwYXJlbnQpIHtcblx0aWYocGFyZW50KSB7XG5cdFx0dGhpcy5wYXJlbnRzID0gcGFyZW50IGluc3RhbmNlb2YgQXJyYXkgPyBwYXJlbnQgOiBbcGFyZW50XTtcblx0fVxuXHRlbHNlIHtcblx0XHR0aGlzLnBhcmVudHMgPSBbXTtcblx0fVxuXG5cdGlmKCF0aGlzLnN0cmFpZ2h0Q29weSkge1xuXHRcdHRoaXMuc3RyYWlnaHRDb3B5ID0gW107XG5cdH1cblx0dGhpcy5zdHJhaWdodENvcHkudW5zaGlmdCgnSWQnKTtcblxuXHR0aGlzLmF0dHJpYnMgPSByYXc7XG5cblx0dmFyIHNlbGYgPSB0aGlzO1xuXHR0aGlzLnN0cmFpZ2h0Q29weS5mb3JFYWNoKGZ1bmN0aW9uKGF0dHJpYikge1xuXHRcdHNlbGZbYXR0cmliXSA9IHJhd1thdHRyaWJdO1xuXHRcdGlmKHR5cGVvZiBzZWxmW2F0dHJpYl0gPT09IFwidW5kZWZpbmVkXCIpIHtcblx0XHRcdHNlbGZbYXR0cmliXSA9IG51bGw7XG5cdFx0fVxuXHR9KTtcblx0ZGVsZXRlKHRoaXMuc3RyYWlnaHRDb3B5KTtcblxuXHR0aGlzLndpcmVkID0gZmFsc2U7XG5cblx0aWYoIWxpYnJhcnlbdGhpcy5jb25zdHJ1Y3Rvci5uYW1lXSkge1xuXHRcdGxpYnJhcnlbdGhpcy5jb25zdHJ1Y3Rvci5uYW1lXSA9IG5ldyBDbHVtcChbXSwgdGhpcyk7XG5cdH1cblx0bGlicmFyeVt0aGlzLmNvbnN0cnVjdG9yLm5hbWVdLml0ZW1zW3RoaXMuSWRdID0gdGhpcztcbn1cblxuTHVtcC5wcm90b3R5cGUgPSB7XG5cdHdpcmVVcDogZnVuY3Rpb24odGhlQXBpKSB7XG5cdFx0YXBpID0gdGhlQXBpO1xuXHRcdHRoaXMud2lyZWQgPSB0cnVlO1xuXHR9LFxuXG5cdGdldFN0YXRlczogZnVuY3Rpb24oZW5jb2RlZCkge1xuXHRcdGlmKHR5cGVvZiBlbmNvZGVkID09PSBcInN0cmluZ1wiICYmIGVuY29kZWQgIT09IFwiXCIpIHtcblx0XHRcdHZhciBtYXAgPSB7fTtcblx0XHRcdGVuY29kZWQuc3BsaXQoXCJ+XCIpLmZvckVhY2goZnVuY3Rpb24oc3RhdGUpIHtcblx0XHRcdFx0dmFyIHBhaXIgPSBzdGF0ZS5zcGxpdChcInxcIik7XG5cdFx0XHRcdG1hcFtwYWlyWzBdXSA9IHBhaXJbMV07XG5cdFx0XHR9KTtcblx0XHRcdHJldHVybiBtYXA7XG5cdFx0fVxuXHRcdGVsc2Uge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXHR9LFxuXG5cdGdldEV4b3RpY0VmZmVjdDogZnVuY3Rpb24oZW5jb2RlZCkge1xuXHRcdGlmKHR5cGVvZiBlbmNvZGVkID09PSBcInN0cmluZ1wiKSB7XG5cdFx0XHR2YXIgZWZmZWN0PXt9LCBmaWVsZHM9W1wib3BlcmF0aW9uXCIsIFwiZmlyc3RcIiwgXCJzZWNvbmRcIl07XG5cdFx0XHRlbmNvZGVkLnNwbGl0KFwiLFwiKS5mb3JFYWNoKGZ1bmN0aW9uKHZhbCwgaW5kZXgpIHtcblx0XHRcdFx0ZWZmZWN0W2ZpZWxkc1tpbmRleF1dID0gdmFsO1xuXHRcdFx0fSk7XG5cdFx0XHRyZXR1cm4gZWZmZWN0O1xuXHRcdH1cblx0XHRlbHNlIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblx0fSxcblxuXHRldmFsQWR2YW5jZWRFeHByZXNzaW9uOiBmdW5jdGlvbihleHByKSB7XG5cdFx0ZXhwciA9IGV4cHIucmVwbGFjZSgvXFxbZDooXFxkKylcXF0vZ2ksIFwiTWF0aC5mbG9vcigoTWF0aC5yYW5kb20oKSokMSkrMSlcIik7XHQvLyBSZXBsYWNlIFtkOnhdIHdpdGggSlMgdG8gY2FsY3VsYXRlIHJhbmRvbSBudW1iZXIgb24gYSBEeCBkaWVcblx0XHQvKmpzaGludCAtVzA2MSAqL1xuXHRcdHJldHVybiBldmFsKGV4cHIpO1xuXHRcdC8qanNoaW50ICtXMDYxICovXG5cdH0sXG5cblx0aXNBOiBmdW5jdGlvbih0eXBlKSB7XG5cdFx0cmV0dXJuIHRoaXMgaW5zdGFuY2VvZiB0eXBlO1xuXHR9LFxuXG5cdGlzT25lT2Y6IGZ1bmN0aW9uKHR5cGVzKSB7XG5cdFx0dmFyIHNlbGYgPSB0aGlzO1xuXHRcdHJldHVybiB0eXBlcy5tYXAoZnVuY3Rpb24odHlwZSkge1xuXHRcdFx0cmV0dXJuIHNlbGYuaXNBKHR5cGUpO1xuXHRcdH0pLnJlZHVjZShmdW5jdGlvbihwcmV2aW91c1ZhbHVlLCBjdXJyZW50VmFsdWUsIGluZGV4LCBhcnJheSl7XG5cdFx0XHRyZXR1cm4gcHJldmlvdXNWYWx1ZSB8fCBjdXJyZW50VmFsdWU7XG5cdFx0fSwgZmFsc2UpO1xuXHR9LFxuXG5cdHRvU3RyaW5nOiBmdW5jdGlvbigpIHtcblx0XHRyZXR1cm4gdGhpcy5jb25zdHJ1Y3Rvci5uYW1lICsgXCIgKCNcIiArIHRoaXMuSWQgKyBcIilcIjtcblx0fVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBMdW1wOyIsInZhciBMdW1wID0gcmVxdWlyZSgnLi9sdW1wJyk7XG5cbnZhciBhcGk7XG5cbmZ1bmN0aW9uIFBvcnQocmF3LCBwYXJlbnQpIHtcblx0dGhpcy5zdHJhaWdodENvcHkgPSBbXG5cdFx0J05hbWUnLFxuXHRcdCdSb3RhdGlvbicsXG5cdFx0J1Bvc2l0aW9uJyxcblx0XHQnRGlzY292ZXJ5VmFsdWUnLFxuXHRcdCdJc1N0YXJ0aW5nUG9ydCdcblx0XTtcblxuXG5cdHJhdy5JZCA9IHJhdy5OYW1lO1xuXHRMdW1wLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG5cblx0dGhpcy5TZXR0aW5nSWQgPSByYXcuU2V0dGluZy5JZDtcblx0dGhpcy5zZXR0aW5nID0gbnVsbDtcblxuXHR0aGlzLmFyZWEgPSBudWxsO1xuXG5cdHRoaXMuZXhjaGFuZ2VzID0gbnVsbDtcbn1cbk9iamVjdC5rZXlzKEx1bXAucHJvdG90eXBlKS5mb3JFYWNoKGZ1bmN0aW9uKG1lbWJlcikgeyBQb3J0LnByb3RvdHlwZVttZW1iZXJdID0gTHVtcC5wcm90b3R5cGVbbWVtYmVyXTsgfSk7XG5cblBvcnQucHJvdG90eXBlLndpcmVVcCA9IGZ1bmN0aW9uKHRoZUFwaSkge1xuXHRcblx0YXBpID0gdGhlQXBpO1xuXHR2YXIgc2VsZiA9IHRoaXM7XG5cblx0dGhpcy5zZXR0aW5nID0gYXBpLmdldE9yQ3JlYXRlKGFwaS50eXBlcy5TZXR0aW5nLCB0aGlzLmF0dHJpYnMuU2V0dGluZywgdGhpcyk7XG5cdFxuXHR0aGlzLmFyZWEgPSBhcGkuZ2V0T3JDcmVhdGUoYXBpLnR5cGVzLkFyZWEsIHRoaXMuYXR0cmlicy5BcmVhLCB0aGlzKTtcblxuXHR0aGlzLmV4Y2hhbmdlcyA9IGFwaS5saWJyYXJ5LkV4Y2hhbmdlLnF1ZXJ5KFwiU2V0dGluZ0lkc1wiLCBmdW5jdGlvbihpZHMpIHsgcmV0dXJuIGlkcy5pbmRleE9mKHNlbGYuU2V0dGluZ0lkKSAhPT0gLTE7IH0pO1xuXG5cdEx1bXAucHJvdG90eXBlLndpcmVVcC5jYWxsKHRoaXMsIGFwaSk7XG59O1xuXG5Qb3J0LnByb3RvdHlwZS50b1N0cmluZyA9IGZ1bmN0aW9uKGxvbmcpIHtcblx0cmV0dXJuIHRoaXMuY29uc3RydWN0b3IubmFtZSArIFwiIFwiICsgdGhpcy5OYW1lICsgXCIgKCNcIiArIHRoaXMuTmFtZSArIFwiKVwiO1xufTtcblxuUG9ydC5wcm90b3R5cGUudG9Eb20gPSBmdW5jdGlvbihzaXplLCB0YWcpIHtcblxuXHRzaXplID0gc2l6ZSB8fCBcIm5vcm1hbFwiO1xuXHR0YWcgPSB0YWcgfHwgXCJsaVwiO1xuXG5cdHZhciBodG1sID0gXCJcIjtcblxuXHR2YXIgZWxlbWVudCA9ICBkb2N1bWVudC5jcmVhdGVFbGVtZW50KHRhZyk7XG5cdGVsZW1lbnQuY2xhc3NOYW1lID0gXCJpdGVtIFwiK3RoaXMuY29uc3RydWN0b3IubmFtZS50b0xvd2VyQ2FzZSgpK1wiLWl0ZW0gXCIrc2l6ZTtcblxuXHRodG1sID0gXCJcXG48aDMgY2xhc3M9J3RpdGxlJz5cIit0aGlzLk5hbWUrXCI8L2gzPlwiO1xuXG5cdGVsZW1lbnQuaW5uZXJIVE1MID0gaHRtbDtcblxuXHRlbGVtZW50LnRpdGxlID0gdGhpcy50b1N0cmluZygpO1xuXG5cdHJldHVybiBlbGVtZW50O1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBQb3J0OyIsInZhciBMdW1wID0gcmVxdWlyZSgnLi9sdW1wJyk7XG5cbnZhciBhcGk7XG5cbmZ1bmN0aW9uIFF1YWxpdHlFZmZlY3QocmF3LCBwYXJlbnQpIHtcblx0dGhpcy5zdHJhaWdodENvcHkgPSBbXCJMZXZlbFwiLCBcIlNldFRvRXhhY3RseVwiXTtcblx0THVtcC5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuXG5cdC8vIE1heSBpbnZvbHZlIFF1YWxpdHkgb2JqZWN0IHJlZmVyZW5jZXMsIHNvIGNhbid0IHJlc29sdmUgdW50aWwgYWZ0ZXIgYWxsIG9iamVjdHMgYXJlIHdpcmVkIHVwXG5cdHRoaXMuc2V0VG9FeGFjdGx5QWR2YW5jZWQgPSBudWxsO1xuXHR0aGlzLmNoYW5nZUJ5QWR2YW5jZWQgPSBudWxsO1x0XG5cblx0dGhpcy5hc3NvY2lhdGVkUXVhbGl0eSA9IG51bGw7XG5cdFxufVxuT2JqZWN0LmtleXMoTHVtcC5wcm90b3R5cGUpLmZvckVhY2goZnVuY3Rpb24obWVtYmVyKSB7IFF1YWxpdHlFZmZlY3QucHJvdG90eXBlW21lbWJlcl0gPSBMdW1wLnByb3RvdHlwZVttZW1iZXJdOyB9KTtcblxuUXVhbGl0eUVmZmVjdC5wcm90b3R5cGUud2lyZVVwID0gZnVuY3Rpb24odGhlQXBpKSB7XG5cblx0YXBpID0gdGhlQXBpO1xuXG5cdHRoaXMuYXNzb2NpYXRlZFF1YWxpdHkgPSBhcGkuZ2V0KGFwaS50eXBlcy5RdWFsaXR5LCB0aGlzLmF0dHJpYnMuQXNzb2NpYXRlZFF1YWxpdHlJZCwgdGhpcyk7XG5cdHRoaXMuc2V0VG9FeGFjdGx5QWR2YW5jZWQgPSBhcGkuZGVzY3JpYmVBZHZhbmNlZEV4cHJlc3Npb24odGhpcy5hdHRyaWJzLlNldFRvRXhhY3RseUFkdmFuY2VkKTtcblx0dGhpcy5jaGFuZ2VCeUFkdmFuY2VkID0gYXBpLmRlc2NyaWJlQWR2YW5jZWRFeHByZXNzaW9uKHRoaXMuYXR0cmlicy5DaGFuZ2VCeUFkdmFuY2VkKTtcblxuXHRMdW1wLnByb3RvdHlwZS53aXJlVXAuY2FsbCh0aGlzLCBhcGkpO1xufTtcblxuUXVhbGl0eUVmZmVjdC5wcm90b3R5cGUuZ2V0UXVhbnRpdHkgPSBmdW5jdGlvbigpIHtcblx0dmFyIGNvbmRpdGlvbiA9IFwiXCI7XG5cdFxuXHRpZih0aGlzLnNldFRvRXhhY3RseUFkdmFuY2VkICE9PSBudWxsKSB7XG5cdFx0Y29uZGl0aW9uID0gXCIrKFwiICsgdGhpcy5zZXRUb0V4YWN0bHlBZHZhbmNlZCArIFwiKVwiO1xuXHR9XG5cdGVsc2UgaWYodGhpcy5TZXRUb0V4YWN0bHkgIT09IG51bGwpIHtcblx0XHRjb25kaXRpb24gPSBcIj0gXCIgKyB0aGlzLlNldFRvRXhhY3RseTtcblx0fVxuXHRlbHNlIGlmKHRoaXMuY2hhbmdlQnlBZHZhbmNlZCAhPT0gbnVsbCkge1xuXHRcdGNvbmRpdGlvbiA9IFwiKyhcIiArIHRoaXMuY2hhbmdlQnlBZHZhbmNlZCArIFwiKVwiO1xuXHR9XG5cdGVsc2UgaWYodGhpcy5MZXZlbCAhPT0gbnVsbCkge1xuXHRcdGlmKHRoaXMuTGV2ZWwgPCAwKSB7XG5cdFx0XHRjb25kaXRpb24gPSB0aGlzLkxldmVsO1xuXHRcdH1cblx0XHRlbHNlIGlmKHRoaXMuTGV2ZWwgPiAwKSB7XG5cdFx0XHRjb25kaXRpb24gPSBcIitcIiArIHRoaXMuTGV2ZWw7XG5cdFx0fVxuXHR9XG5cdFxuXHRyZXR1cm4gY29uZGl0aW9uO1xufTtcblxuUXVhbGl0eUVmZmVjdC5wcm90b3R5cGUuaXNBZGRpdGl2ZSA9IGZ1bmN0aW9uKCkge1xuXHRyZXR1cm4gdGhpcy5zZXRUb0V4YWN0bHlBZHZhbmNlZCB8fCB0aGlzLlNldFRvRXhhY3RseSB8fCB0aGlzLmNoYW5nZUJ5QWR2YW5jZWQgfHwgKHRoaXMuTGV2ZWwgPiAwKTtcbn07XG5cblF1YWxpdHlFZmZlY3QucHJvdG90eXBlLmlzU3VidHJhY3RpdmUgPSBmdW5jdGlvbigpIHtcblx0cmV0dXJuICF0aGlzLnNldFRvRXhhY3RseUFkdmFuY2VkICYmICF0aGlzLlNldFRvRXhhY3RseSAmJiAhdGhpcy5jaGFuZ2VCeUFkdmFuY2VkICYmICh0aGlzLkxldmVsIDw9IDApO1xufTtcblxuUXVhbGl0eUVmZmVjdC5wcm90b3R5cGUudG9TdHJpbmcgPSBmdW5jdGlvbigpIHtcblx0dmFyIHF1YWxpdHkgPSB0aGlzLmFzc29jaWF0ZWRRdWFsaXR5O1xuXHRyZXR1cm4gdGhpcy5jb25zdHJ1Y3Rvci5uYW1lICsgXCIgKFwiK3RoaXMuSWQrXCIpIG9uIFwiICsgcXVhbGl0eSArIHRoaXMuZ2V0UXVhbnRpdHkoKTtcbn07XG5cblF1YWxpdHlFZmZlY3QucHJvdG90eXBlLnRvRG9tID0gZnVuY3Rpb24oc2l6ZSkge1xuXG5cdHNpemUgPSBzaXplIHx8IFwic21hbGxcIjtcblxuXHR2YXIgZWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJsaVwiKTtcblx0ZWxlbWVudC5jbGFzc05hbWUgPSBcIml0ZW0gXCIrdGhpcy5jb25zdHJ1Y3Rvci5uYW1lLnRvTG93ZXJDYXNlKCkrXCItaXRlbSBcIitzaXplO1xuXG5cdHZhciBxdWFsaXR5X2VsZW1lbnQgPSB0aGlzLmFzc29jaWF0ZWRRdWFsaXR5O1xuXG5cdGlmKCFxdWFsaXR5X2VsZW1lbnQpIHtcblx0XHRxdWFsaXR5X2VsZW1lbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwic3BhblwiKTtcblx0XHRxdWFsaXR5X2VsZW1lbnQuaW5uZXJIVE1MID0gXCJbSU5WQUxJRF1cIjtcblx0fVxuXHRlbHNlIHtcblx0XHRxdWFsaXR5X2VsZW1lbnQgPSB0aGlzLmFzc29jaWF0ZWRRdWFsaXR5LnRvRG9tKHNpemUsIGZhbHNlLCBcInNwYW5cIik7XG5cdH1cblxuXHR2YXIgcXVhbnRpdHlfZWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJzcGFuXCIpO1xuXHRxdWFudGl0eV9lbGVtZW50LmNsYXNzTmFtZSA9IFwiaXRlbSBxdWFudGl0eVwiO1xuXHRxdWFudGl0eV9lbGVtZW50LmlubmVySFRNTCA9IHRoaXMuZ2V0UXVhbnRpdHkoKTtcblx0cXVhbnRpdHlfZWxlbWVudC50aXRsZSA9IHRoaXMudG9TdHJpbmcoKTtcblxuXHRlbGVtZW50LmFwcGVuZENoaWxkKHF1YWxpdHlfZWxlbWVudCk7XG5cdGVsZW1lbnQuYXBwZW5kQ2hpbGQocXVhbnRpdHlfZWxlbWVudCk7XG5cblx0cmV0dXJuIGVsZW1lbnQ7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFF1YWxpdHlFZmZlY3Q7IiwidmFyIEx1bXAgPSByZXF1aXJlKCcuL2x1bXAnKTtcblxudmFyIGFwaTtcblxuZnVuY3Rpb24gUXVhbGl0eVJlcXVpcmVtZW50KHJhdywgcGFyZW50KSB7XG5cdHRoaXMuc3RyYWlnaHRDb3B5ID0gWydNaW5MZXZlbCcsICdNYXhMZXZlbCddO1xuXHRMdW1wLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG5cblx0dGhpcy5kaWZmaWN1bHR5QWR2YW5jZWQgPSBudWxsO1xuXHR0aGlzLm1pbkFkdmFuY2VkID0gbnVsbDtcblx0dGhpcy5tYXhBZHZhbmNlZCA9IG51bGw7XG5cblx0dGhpcy5hc3NvY2lhdGVkUXVhbGl0eSA9IG51bGw7XG5cdHRoaXMuY2hhbmNlUXVhbGl0eSA9IG51bGw7XG59XG5PYmplY3Qua2V5cyhMdW1wLnByb3RvdHlwZSkuZm9yRWFjaChmdW5jdGlvbihtZW1iZXIpIHsgUXVhbGl0eVJlcXVpcmVtZW50LnByb3RvdHlwZVttZW1iZXJdID0gTHVtcC5wcm90b3R5cGVbbWVtYmVyXTsgfSk7XG5cblF1YWxpdHlSZXF1aXJlbWVudC5wcm90b3R5cGUud2lyZVVwID0gZnVuY3Rpb24odGhlQXBpKSB7XG5cblx0YXBpID0gdGhlQXBpO1xuXG5cdHRoaXMuZGlmZmljdWx0eUFkdmFuY2VkID0gYXBpLmRlc2NyaWJlQWR2YW5jZWRFeHByZXNzaW9uKHRoaXMuYXR0cmlicy5EaWZmaWN1bHR5QWR2YW5jZWQpO1xuXHR0aGlzLm1pbkFkdmFuY2VkID0gYXBpLmRlc2NyaWJlQWR2YW5jZWRFeHByZXNzaW9uKHRoaXMuYXR0cmlicy5NaW5BZHZhbmNlZCk7XG5cdHRoaXMubWF4QWR2YW5jZWQgPSBhcGkuZGVzY3JpYmVBZHZhbmNlZEV4cHJlc3Npb24odGhpcy5hdHRyaWJzLk1heEFkdmFuY2VkKTtcblxuXHR0aGlzLmFzc29jaWF0ZWRRdWFsaXR5ID0gYXBpLmdldChhcGkudHlwZXMuUXVhbGl0eSwgdGhpcy5hdHRyaWJzLkFzc29jaWF0ZWRRdWFsaXR5SWQsIHRoaXMpO1xuXG5cdHRoaXMuY2hhbmNlUXVhbGl0eSA9IHRoaXMuZ2V0Q2hhbmNlQ2FwKCk7XG5cblx0THVtcC5wcm90b3R5cGUud2lyZVVwLmNhbGwodGhpcywgYXBpKTtcbn07XG5cblF1YWxpdHlSZXF1aXJlbWVudC5wcm90b3R5cGUuZ2V0Q2hhbmNlQ2FwID0gZnVuY3Rpb24oKSB7XG5cdHZhciBxdWFsaXR5ID0gbnVsbDtcblx0aWYoIXRoaXMuYXR0cmlicy5EaWZmaWN1bHR5TGV2ZWwpIHtcblx0XHRyZXR1cm4gbnVsbDtcblx0fVxuXHRxdWFsaXR5ID0gdGhpcy5hc3NvY2lhdGVkUXVhbGl0eTtcblx0aWYoIXF1YWxpdHkpIHtcblx0XHRyZXR1cm4gbnVsbDtcblx0fVxuXHRcblx0cmV0dXJuIE1hdGgucm91bmQodGhpcy5hdHRyaWJzLkRpZmZpY3VsdHlMZXZlbCAqICgoMTAwICsgcXVhbGl0eS5EaWZmaWN1bHR5U2NhbGVyICsgNykvMTAwKSk7XG59O1xuXG5RdWFsaXR5UmVxdWlyZW1lbnQucHJvdG90eXBlLmdldFF1YW50aXR5ID0gZnVuY3Rpb24oKSB7XG5cdHZhciBjb25kaXRpb24gPSBcIlwiO1xuXG4gIGlmKHRoaXMuZGlmZmljdWx0eUFkdmFuY2VkICE9PSBudWxsKSB7XG4gIFx0Y29uZGl0aW9uID0gdGhpcy5kaWZmaWN1bHR5QWR2YW5jZWQ7XG4gIH1cbiAgZWxzZSBpZih0aGlzLm1pbkFkdmFuY2VkICE9PSBudWxsKSB7XG4gIFx0Y29uZGl0aW9uID0gdGhpcy5taW5BZHZhbmNlZDtcbiAgfVxuICBlbHNlIGlmKHRoaXMubWF4QWR2YW5jZWQgIT09IG51bGwpIHtcbiAgXHRjb25kaXRpb24gPSB0aGlzLm1heEFkdmFuY2VkO1xuICB9XG5cdGVsc2UgaWYodGhpcy5jaGFuY2VRdWFsaXR5ICE9PSBudWxsKSB7XG5cdFx0Y29uZGl0aW9uID0gdGhpcy5jaGFuY2VRdWFsaXR5ICsgXCIgZm9yIDEwMCVcIjtcblx0fVxuXHRlbHNlIGlmKHRoaXMuTWF4TGV2ZWwgIT09IG51bGwgJiYgdGhpcy5NaW5MZXZlbCAhPT0gbnVsbCkge1xuXHRcdGlmKHRoaXMuTWF4TGV2ZWwgPT09IHRoaXMuTWluTGV2ZWwpIHtcblx0XHRcdGNvbmRpdGlvbiA9IFwiPSBcIiArIHRoaXMuTWluTGV2ZWw7XG5cdFx0fVxuXHRcdGVsc2Uge1xuXHRcdFx0Y29uZGl0aW9uID0gdGhpcy5NaW5MZXZlbCArIFwiLVwiICsgdGhpcy5NYXhMZXZlbDtcblx0XHR9XG5cdH1cblx0ZWxzZSB7XG5cdFx0aWYodGhpcy5NaW5MZXZlbCAhPT0gbnVsbCkge1xuXHRcdFx0Y29uZGl0aW9uID0gXCImZ2U7IFwiICsgdGhpcy5NaW5MZXZlbDtcblx0XHR9XG5cdFx0aWYodGhpcy5NYXhMZXZlbCAhPT0gbnVsbCkge1xuXHRcdFx0Y29uZGl0aW9uID0gXCImbGU7IFwiICsgdGhpcy5NYXhMZXZlbDtcblx0XHR9XG5cdH1cblx0cmV0dXJuIGNvbmRpdGlvbjtcbn07XG5cblF1YWxpdHlSZXF1aXJlbWVudC5wcm90b3R5cGUudG9TdHJpbmcgPSBmdW5jdGlvbigpIHtcblx0dmFyIHF1YWxpdHkgPSB0aGlzLmFzc29jaWF0ZWRRdWFsaXR5O1xuXHRyZXR1cm4gdGhpcy5jb25zdHJ1Y3Rvci5uYW1lICsgXCIgKFwiK3RoaXMuSWQrXCIpIG9uIFwiICsgcXVhbGl0eSArIFwiIFwiICsgdGhpcy5nZXRRdWFudGl0eSgpO1xufTtcblxuUXVhbGl0eVJlcXVpcmVtZW50LnByb3RvdHlwZS50b0RvbSA9IGZ1bmN0aW9uKHNpemUpIHtcblxuXHRzaXplID0gc2l6ZSB8fCBcInNtYWxsXCI7XG5cblx0dmFyIGVsZW1lbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwibGlcIik7XG5cdGVsZW1lbnQuY2xhc3NOYW1lID0gXCJpdGVtIFwiK3RoaXMuY29uc3RydWN0b3IubmFtZS50b0xvd2VyQ2FzZSgpK1wiLWl0ZW0gXCIrc2l6ZTtcblxuXHR2YXIgcXVhbGl0eV9lbGVtZW50ID0gdGhpcy5hc3NvY2lhdGVkUXVhbGl0eTtcblxuXHRpZighcXVhbGl0eV9lbGVtZW50KSB7XG5cdFx0cXVhbGl0eV9lbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInNwYW5cIik7XG5cdFx0cXVhbGl0eV9lbGVtZW50LmlubmVySFRNTCA9IFwiW0lOVkFMSURdXCI7XG5cdH1cblx0ZWxzZSB7XG5cdFx0cXVhbGl0eV9lbGVtZW50ID0gdGhpcy5hc3NvY2lhdGVkUXVhbGl0eS50b0RvbShzaXplLCBmYWxzZSwgXCJzcGFuXCIpO1xuXHR9XG5cblx0dmFyIHF1YW50aXR5X2VsZW1lbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwic3BhblwiKTtcblx0cXVhbnRpdHlfZWxlbWVudC5jbGFzc05hbWUgPSBcIml0ZW0gcXVhbnRpdHlcIjtcblx0cXVhbnRpdHlfZWxlbWVudC5pbm5lckhUTUwgPSB0aGlzLmdldFF1YW50aXR5KCk7XG5cdHF1YW50aXR5X2VsZW1lbnQudGl0bGUgPSB0aGlzLnRvU3RyaW5nKCk7XG5cblx0ZWxlbWVudC5hcHBlbmRDaGlsZChxdWFsaXR5X2VsZW1lbnQpO1xuXHRlbGVtZW50LmFwcGVuZENoaWxkKHF1YW50aXR5X2VsZW1lbnQpO1xuXG5cdHJldHVybiBlbGVtZW50O1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBRdWFsaXR5UmVxdWlyZW1lbnQ7IiwidmFyIEx1bXAgPSByZXF1aXJlKCcuL2x1bXAnKTtcbnZhciBDbHVtcCA9IHJlcXVpcmUoJy4vY2x1bXAnKTtcblxudmFyIGFwaTtcblxuZnVuY3Rpb24gUXVhbGl0eShyYXcsIHBhcmVudCkge1xuXHR0aGlzLnN0cmFpZ2h0Q29weSA9IFtcblx0XHQnTmFtZScsXG5cdFx0J0Rlc2NyaXB0aW9uJyxcblx0XHQnSW1hZ2UnLFxuXG5cdFx0J0NhdGVnb3J5Jyxcblx0XHQnTmF0dXJlJyxcblx0XHQnVGFnJyxcblxuXHRcdFwiSXNTbG90XCIsXG5cblx0XHQnQWxsb3dlZE9uJyxcblx0XHRcIkF2YWlsYWJsZUF0XCIsXG5cblx0XHQnQ2FwJyxcblx0XHQnRGlmZmljdWx0eVNjYWxlcicsXG5cdFx0J0VuaGFuY2VtZW50cydcblx0XTtcblx0THVtcC5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuXG5cdHRoaXMuU3RhdGVzID0gdGhpcy5nZXRTdGF0ZXMocmF3LkNoYW5nZURlc2NyaXB0aW9uVGV4dCk7XG5cdHRoaXMuTGV2ZWxEZXNjcmlwdGlvblRleHQgPSB0aGlzLmdldFN0YXRlcyhyYXcuTGV2ZWxEZXNjcmlwdGlvblRleHQpO1xuXHR0aGlzLkxldmVsSW1hZ2VUZXh0ID0gdGhpcy5nZXRTdGF0ZXMocmF3LkxldmVsSW1hZ2VUZXh0KTtcblxuXHR0aGlzLnVzZUV2ZW50ID0gbnVsbDtcbn1cbk9iamVjdC5rZXlzKEx1bXAucHJvdG90eXBlKS5mb3JFYWNoKGZ1bmN0aW9uKG1lbWJlcikgeyBRdWFsaXR5LnByb3RvdHlwZVttZW1iZXJdID0gTHVtcC5wcm90b3R5cGVbbWVtYmVyXTsgfSk7XG5cblF1YWxpdHkucHJvdG90eXBlLndpcmVVcCA9IGZ1bmN0aW9uKHRoZUFwaSkge1xuXG5cdGFwaSA9IHRoZUFwaTtcblxuXHR0aGlzLnVzZUV2ZW50ID0gYXBpLmdldE9yQ3JlYXRlKGFwaS50eXBlcy5FdmVudCwgdGhpcy5hdHRyaWJzLlVzZUV2ZW50LCB0aGlzKTtcblx0aWYodGhpcy51c2VFdmVudCkge1xuXHRcdHRoaXMudXNlRXZlbnQudGFnID0gXCJ1c2VcIjtcblx0fVxuXG5cdEx1bXAucHJvdG90eXBlLndpcmVVcC5jYWxsKHRoaXMsIGFwaSk7XG59O1xuXG5RdWFsaXR5LnByb3RvdHlwZS50b1N0cmluZyA9IGZ1bmN0aW9uKGxvbmcpIHtcblx0cmV0dXJuIHRoaXMuY29uc3RydWN0b3IubmFtZSArIFwiIFwiICsgKGxvbmcgPyBcIiBbXCIgKyB0aGlzLk5hdHVyZSArIFwiID4gXCIgKyB0aGlzLkNhdGVnb3J5ICsgXCIgPiBcIiArIHRoaXMuVGFnICsgXCJdIFwiIDogXCJcIikgKyB0aGlzLk5hbWUgKyBcIiAoI1wiICsgdGhpcy5JZCArIFwiKVwiO1xufTtcblxuUXVhbGl0eS5wcm90b3R5cGUudG9Eb20gPSBmdW5jdGlvbihzaXplLCBpbmNsdWRlQ2hpbGRyZW4sIHRhZykge1xuXG5cdHNpemUgPSBzaXplIHx8IFwibm9ybWFsXCI7XG5cdGluY2x1ZGVDaGlsZHJlbiA9IGluY2x1ZGVDaGlsZHJlbiA9PT0gZmFsc2UgPyBmYWxzZSA6IHRydWU7XG5cdHRhZyA9IHRhZyB8fCBcImxpXCI7XG5cblx0dmFyIGh0bWwgPSBcIlwiO1xuXG5cdHZhciBlbGVtZW50ID0gIGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQodGFnKTtcblx0ZWxlbWVudC5jbGFzc05hbWUgPSBcIml0ZW0gXCIrdGhpcy5jb25zdHJ1Y3Rvci5uYW1lLnRvTG93ZXJDYXNlKCkrXCItaXRlbSBcIitzaXplO1xuXG5cdGh0bWwgPSBcIlxcbjxpbWcgY2xhc3M9J2ljb24nIHNyYz0nXCIrYXBpLmNvbmZpZy5sb2NhdGlvbnMuaW1hZ2VzUGF0aCtcIi9cIit0aGlzLkltYWdlK1wic21hbGwucG5nJyAvPlwiO1xuXHRodG1sICs9IFwiXFxuPGgzIGNsYXNzPSd0aXRsZSc+XCIrdGhpcy5OYW1lK1wiPC9oMz5cIjtcblx0aHRtbCArPSBcIlxcbjxwIGNsYXNzPSdkZXNjcmlwdGlvbic+XCIrdGhpcy5EZXNjcmlwdGlvbitcIjwvcD5cIjtcblxuXHRlbGVtZW50LmlubmVySFRNTCA9IGh0bWw7XG5cblx0ZWxlbWVudC50aXRsZSA9IHRoaXMudG9TdHJpbmcoKTtcblxuXHRpZihpbmNsdWRlQ2hpbGRyZW4pIHtcblx0XHR2YXIgc2VsZiA9IHRoaXM7XG5cdFx0ZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgZnVuY3Rpb24oZSkge1xuXHRcdFx0ZS5zdG9wUHJvcGFnYXRpb24oKTtcblxuXHRcdFx0dmFyIGNoaWxkTGlzdCA9IGVsZW1lbnQucXVlcnlTZWxlY3RvcihcIi5jaGlsZC1saXN0XCIpO1xuXHRcdFx0aWYoY2hpbGRMaXN0KSB7XG5cdFx0XHRcdGVsZW1lbnQucmVtb3ZlQ2hpbGQoY2hpbGRMaXN0KTtcblx0XHRcdH1cblx0XHRcdGVsc2Uge1xuXHRcdFx0XHRpZihzZWxmLnVzZUV2ZW50KSB7XG5cblx0XHRcdFx0XHR2YXIgd3JhcHBlckNsdW1wID0gbmV3IENsdW1wKFtzZWxmLnVzZUV2ZW50XSwgYXBpLnR5cGVzLkV2ZW50KTtcblx0XHRcdFx0XHR2YXIgY2hpbGRfZXZlbnRzID0gd3JhcHBlckNsdW1wLnRvRG9tKHNpemUsIHRydWUpO1xuXG5cdFx0XHRcdFx0Y2hpbGRfZXZlbnRzLmNsYXNzTGlzdC5hZGQoXCJjaGlsZC1saXN0XCIpO1xuXHRcdFx0XHRcdGVsZW1lbnQuYXBwZW5kQ2hpbGQoY2hpbGRfZXZlbnRzKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0cmV0dXJuIGVsZW1lbnQ7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFF1YWxpdHk7IiwidmFyIEx1bXAgPSByZXF1aXJlKCcuL2x1bXAnKTtcblxudmFyIGFwaTtcblxuZnVuY3Rpb24gU2V0dGluZyhyYXcsIHBhcmVudCkge1xuXHR0aGlzLnN0cmFpZ2h0Q29weSA9IFtcblx0XHQnSWQnXG5cdF07XG5cdEx1bXAuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcblxuXHR0aGlzLnNob3BzID0gbnVsbDtcbn1cbk9iamVjdC5rZXlzKEx1bXAucHJvdG90eXBlKS5mb3JFYWNoKGZ1bmN0aW9uKG1lbWJlcikgeyBTZXR0aW5nLnByb3RvdHlwZVttZW1iZXJdID0gTHVtcC5wcm90b3R5cGVbbWVtYmVyXTsgfSk7XG5cblNldHRpbmcucHJvdG90eXBlLndpcmVVcCA9IGZ1bmN0aW9uKHRoZUFwaSkge1xuXG5cdGFwaSA9IHRoZUFwaTtcblxuXHRMdW1wLnByb3RvdHlwZS53aXJlVXAuY2FsbCh0aGlzKTtcbn07XG5cblNldHRpbmcucHJvdG90eXBlLnRvU3RyaW5nID0gZnVuY3Rpb24oKSB7XG5cdHJldHVybiB0aGlzLmNvbnN0cnVjdG9yLm5hbWUgKyBcIiAjXCIgKyB0aGlzLklkO1xufTtcblxuU2V0dGluZy5wcm90b3R5cGUudG9Eb20gPSBmdW5jdGlvbihzaXplLCBpbmNsdWRlQ2hpbGRyZW4sIHRhZykge1xuXG5cdHNpemUgPSBzaXplIHx8IFwibm9ybWFsXCI7XG5cdGluY2x1ZGVDaGlsZHJlbiA9IGluY2x1ZGVDaGlsZHJlbiA9PT0gZmFsc2UgPyBmYWxzZSA6IHRydWU7XG5cdHRhZyA9IHRhZyB8fCBcImxpXCI7XG5cblx0dmFyIHNlbGYgPSB0aGlzO1xuXHR2YXIgaHRtbCA9IFwiXCI7XG5cblx0dmFyIGVsZW1lbnQgPSAgZG9jdW1lbnQuY3JlYXRlRWxlbWVudCh0YWcpO1xuXHRlbGVtZW50LmNsYXNzTmFtZSA9IFwiaXRlbSBcIit0aGlzLmNvbnN0cnVjdG9yLm5hbWUudG9Mb3dlckNhc2UoKStcIi1pdGVtIFwiK3NpemU7XG5cblx0aHRtbCA9IFwiXFxuPGgzIGNsYXNzPSd0aXRsZSc+XCIrdGhpcy5JZCtcIjwvaDM+XCI7XG5cblx0ZWxlbWVudC5pbm5lckhUTUwgPSBodG1sO1xuXG5cdGVsZW1lbnQudGl0bGUgPSB0aGlzLnRvU3RyaW5nKCk7XG5cblx0cmV0dXJuIGVsZW1lbnQ7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFNldHRpbmc7IiwidmFyIEx1bXAgPSByZXF1aXJlKCcuL2x1bXAnKTtcbnZhciBDbHVtcCA9IHJlcXVpcmUoJy4vY2x1bXAnKTtcblxudmFyIGFwaTtcblxuZnVuY3Rpb24gU2hvcChyYXcsIHBhcmVudCkge1xuXHR0aGlzLnN0cmFpZ2h0Q29weSA9IFtcblx0XHQnSWQnLFxuXHRcdCdOYW1lJyxcblx0XHQnRGVzY3JpcHRpb24nLFxuXHRcdCdJbWFnZScsXG5cdFx0J09yZGVyaW5nJ1xuXHRdO1xuXHRMdW1wLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG5cblx0dGhpcy5hdmFpbGFiaWxpdGllcyA9IG51bGw7XG5cdHRoaXMudW5sb2NrQ29zdCA9IG51bGw7XG59XG5PYmplY3Qua2V5cyhMdW1wLnByb3RvdHlwZSkuZm9yRWFjaChmdW5jdGlvbihtZW1iZXIpIHsgU2hvcC5wcm90b3R5cGVbbWVtYmVyXSA9IEx1bXAucHJvdG90eXBlW21lbWJlcl07IH0pO1xuXG5TaG9wLnByb3RvdHlwZS53aXJlVXAgPSBmdW5jdGlvbih0aGVBcGkpIHtcblxuXHRhcGkgPSB0aGVBcGk7XG5cblx0dGhpcy5hdmFpbGFiaWxpdGllcyA9IG5ldyBDbHVtcCh0aGlzLmF0dHJpYnMuQXZhaWxhYmlsaXRpZXMgfHwgW10sIGFwaS50eXBlcy5BdmFpbGFiaWxpdHksIHRoaXMpO1xuXG5cdEx1bXAucHJvdG90eXBlLndpcmVVcC5jYWxsKHRoaXMpO1xufTtcblxuU2hvcC5wcm90b3R5cGUudG9TdHJpbmcgPSBmdW5jdGlvbigpIHtcblx0cmV0dXJuIHRoaXMuY29uc3RydWN0b3IubmFtZSArIFwiIFwiICsgdGhpcy5OYW1lICsgXCIgKCNcIiArIHRoaXMuSWQgKyBcIilcIjtcbn07XG5cblNob3AucHJvdG90eXBlLnRvRG9tID0gZnVuY3Rpb24oc2l6ZSwgaW5jbHVkZUNoaWxkcmVuLCB0YWcpIHtcblxuXHRzaXplID0gc2l6ZSB8fCBcIm5vcm1hbFwiO1xuXHRpbmNsdWRlQ2hpbGRyZW4gPSBpbmNsdWRlQ2hpbGRyZW4gPT09IGZhbHNlID8gZmFsc2UgOiB0cnVlO1xuXHR0YWcgPSB0YWcgfHwgXCJsaVwiO1xuXG5cdHZhciBzZWxmID0gdGhpcztcblx0dmFyIGh0bWwgPSBcIlwiO1xuXG5cdHZhciBlbGVtZW50ID0gIGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQodGFnKTtcblx0ZWxlbWVudC5jbGFzc05hbWUgPSBcIml0ZW0gXCIrdGhpcy5jb25zdHJ1Y3Rvci5uYW1lLnRvTG93ZXJDYXNlKCkrXCItaXRlbSBcIitzaXplO1xuXG5cdGh0bWwgPSBcIlxcbjxpbWcgY2xhc3M9J2ljb24nIHNyYz0nXCIrYXBpLmNvbmZpZy5sb2NhdGlvbnMuaW1hZ2VzUGF0aCtcIi9cIit0aGlzLkltYWdlK1wiLnBuZycgLz5cIjtcblx0aHRtbCArPSBcIlxcbjxoMyBjbGFzcz0ndGl0bGUnPlwiK3RoaXMuTmFtZStcIjwvaDM+XCI7XG5cdGh0bWwgKz0gXCJcXG48cCBjbGFzcz0nZGVzY3JpcHRpb24nPlwiK3RoaXMuRGVzY3JpcHRpb24rXCI8L3A+XCI7XG5cblx0ZWxlbWVudC5pbm5lckhUTUwgPSBodG1sO1xuXG5cdGVsZW1lbnQudGl0bGUgPSB0aGlzLnRvU3RyaW5nKCk7XG5cblx0aWYoaW5jbHVkZUNoaWxkcmVuKSB7XG5cdFx0ZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgZnVuY3Rpb24oZSkge1xuXHRcdFx0ZS5zdG9wUHJvcGFnYXRpb24oKTtcblxuXHRcdFx0dmFyIGNoaWxkTGlzdCA9IGVsZW1lbnQucXVlcnlTZWxlY3RvcihcIi5jaGlsZC1saXN0XCIpO1xuXHRcdFx0aWYoY2hpbGRMaXN0KSB7XG5cdFx0XHRcdGVsZW1lbnQucmVtb3ZlQ2hpbGQoY2hpbGRMaXN0KTtcblx0XHRcdH1cblx0XHRcdGVsc2Uge1xuXHRcdFx0XHRpZihzZWxmLmF2YWlsYWJpbGl0aWVzKSB7XG5cblx0XHRcdFx0XHR2YXIgY2hpbGRfZWxlbWVudHMgPSBzZWxmLmF2YWlsYWJpbGl0aWVzLnRvRG9tKFwibm9ybWFsXCIsIHRydWUpO1xuXG5cdFx0XHRcdFx0Y2hpbGRfZWxlbWVudHMuY2xhc3NMaXN0LmFkZChcImNoaWxkLWxpc3RcIik7XG5cdFx0XHRcdFx0ZWxlbWVudC5hcHBlbmRDaGlsZChjaGlsZF9lbGVtZW50cyk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdHJldHVybiBlbGVtZW50O1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBTaG9wOyIsInZhciBMdW1wID0gcmVxdWlyZSgnLi9sdW1wJyk7XG52YXIgQ2x1bXAgPSByZXF1aXJlKCcuL2NsdW1wJyk7XG5cbnZhciBhcGk7XG5cbmZ1bmN0aW9uIFNwYXduZWRFbnRpdHkocmF3LCBwYXJlbnQpIHtcblx0dGhpcy5zdHJhaWdodENvcHkgPSBbXG5cdFx0J05hbWUnLFxuXHRcdCdIdW1hbk5hbWUnLFxuXG5cdFx0J05ldXRyYWwnLFxuXHRcdCdQcmVmYWJOYW1lJyxcblx0XHQnRG9ybWFudEJlaGF2aW91cicsXG5cdFx0J0F3YXJlQmVoYXZpb3VyJyxcblxuXHRcdCdIdWxsJyxcblx0XHQnQ3JldycsXG5cdFx0J0xpZmUnLFxuXHRcdCdNb3ZlbWVudFNwZWVkJyxcblx0XHQnUm90YXRpb25TcGVlZCcsXG5cdFx0J0JlYXN0aWVDaGFyYWN0ZXJpc3RpY3NOYW1lJyxcblx0XHQnQ29tYmF0SXRlbXMnLFxuXHRcdCdMb290UHJlZmFiTmFtZScsXG5cdFx0J0dsZWFtVmFsdWUnXG5cdF07XG5cdHJhdy5JZCA9IHJhdy5OYW1lO1xuXHRMdW1wLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG5cblx0dGhpcy5wYWNpZnlFdmVudCA9IG51bGw7XG5cdHRoaXMua2lsbFF1YWxpdHlFdmVudCA9IG51bGw7XG5cdHRoaXMuY29tYmF0QXR0YWNrTmFtZXMgPSBbXTtcblxuXHR0aGlzLmltYWdlID0gbnVsbDtcbn1cbk9iamVjdC5rZXlzKEx1bXAucHJvdG90eXBlKS5mb3JFYWNoKGZ1bmN0aW9uKG1lbWJlcikgeyBTcGF3bmVkRW50aXR5LnByb3RvdHlwZVttZW1iZXJdID0gTHVtcC5wcm90b3R5cGVbbWVtYmVyXTsgfSk7XG5cblNwYXduZWRFbnRpdHkucHJvdG90eXBlLndpcmVVcCA9IGZ1bmN0aW9uKHRoZUFwaSkge1xuXG5cdGFwaSA9IHRoZUFwaTtcblxuXHR2YXIgc2VsZiA9IHRoaXM7XG5cdFxuXHR0aGlzLmNvbWJhdEF0dGFja05hbWVzID0gKHRoaXMuYXR0cmlicy5Db21iYXRBdHRhY2tOYW1lcyB8fCBbXSkubWFwKGZ1bmN0aW9uKG5hbWUpIHtcblx0XHRyZXR1cm4gYXBpLmdldChhcGkudHlwZXMuQ29tYmF0QXR0YWNrLCBuYW1lLCBzZWxmKTtcblx0fSkuZmlsdGVyKGZ1bmN0aW9uKGF0dGFjaykge1xuXHRcdHJldHVybiB0eXBlb2YgYXR0YWNrID09PSBcIm9iamVjdFwiO1xuXHR9KTtcblxuXHR0aGlzLnBhY2lmeUV2ZW50ID0gYXBpLmdldChhcGkudHlwZXMuRXZlbnQsIHRoaXMuYXR0cmlicy5QYWNpZnlFdmVudElkLCB0aGlzKTtcblx0aWYodGhpcy5wYWNpZnlFdmVudCkge1xuXHRcdHRoaXMucGFjaWZ5RXZlbnQudGFnID0gXCJwYWNpZmllZFwiO1xuXHR9XG5cblx0dGhpcy5raWxsUXVhbGl0eUV2ZW50ID0gYXBpLmdldChhcGkudHlwZXMuRXZlbnQsIHRoaXMuYXR0cmlicy5LaWxsUXVhbGl0eUV2ZW50SWQsIHRoaXMpO1xuXHRpZih0aGlzLmtpbGxRdWFsaXR5RXZlbnQpIHtcblx0XHR0aGlzLmtpbGxRdWFsaXR5RXZlbnQudGFnID0gXCJraWxsZWRcIjtcblx0fVxuXG5cdHRoaXMuaW1hZ2UgPSAoKHRoaXMua2lsbFF1YWxpdHlFdmVudCAmJiB0aGlzLmtpbGxRdWFsaXR5RXZlbnQuSW1hZ2UpIHx8ICh0aGlzLnBhY2lmeUV2ZW50ICYmIHRoaXMucGFjaWZ5RXZlbnQuSW1hZ2UpKTtcblxuXHRMdW1wLnByb3RvdHlwZS53aXJlVXAuY2FsbCh0aGlzLCBhcGkpO1xufTtcblxuU3Bhd25lZEVudGl0eS5wcm90b3R5cGUudG9TdHJpbmcgPSBmdW5jdGlvbigpIHtcblx0cmV0dXJuIHRoaXMuY29uc3RydWN0b3IubmFtZSArIFwiIFwiICsgdGhpcy5IdW1hbk5hbWUgKyBcIiAoI1wiICsgdGhpcy5JZCArIFwiKVwiO1xufTtcblxuU3Bhd25lZEVudGl0eS5wcm90b3R5cGUudG9Eb20gPSBmdW5jdGlvbihzaXplLCBpbmNsdWRlQ2hpbGRyZW4pIHtcblxuXHRzaXplID0gc2l6ZSB8fCBcIm5vcm1hbFwiO1xuXHRpbmNsdWRlQ2hpbGRyZW4gPSBpbmNsdWRlQ2hpbGRyZW4gPT09IGZhbHNlID8gZmFsc2UgOiB0cnVlO1xuXG5cdHZhciBzZWxmID0gdGhpcztcblxuXHR2YXIgaHRtbCA9IFwiXCI7XG5cblx0dmFyIGVsZW1lbnQgPSAgZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImxpXCIpO1xuXHRlbGVtZW50LmNsYXNzTmFtZSA9IFwiaXRlbSBcIit0aGlzLmNvbnN0cnVjdG9yLm5hbWUudG9Mb3dlckNhc2UoKStcIi1pdGVtIFwiK3NpemU7XG5cblx0aWYodGhpcy5JbWFnZSAhPT0gbnVsbCAmJiB0aGlzLkltYWdlICE9PSBcIlwiKSB7XG5cdFx0aHRtbCA9IFwiPGltZyBjbGFzcz0naWNvbicgc3JjPSdcIithcGkuY29uZmlnLmxvY2F0aW9ucy5pbWFnZXNQYXRoK1wiL1wiK3RoaXMuaW1hZ2UrXCJzbWFsbC5wbmcnIC8+XCI7XG5cdH1cblxuXHRodG1sICs9IFwiXFxuPGgzIGNsYXNzPSd0aXRsZSc+XCIrdGhpcy5IdW1hbk5hbWUrXCI8L2gzPlwiO1xuXG5cdGlmKHNpemUgIT09IFwic21hbGxcIikge1xuXHRcdGlmKHRoaXMucXVhbGl0aWVzUmVxdWlyZWQpIHtcblx0XHRcdGh0bWwgKz0gXCI8ZGl2IGNsYXNzPSdzaWRlYmFyJz5cIjtcblx0XHRcdGh0bWwgKz0gdGhpcy5xdWFsaXRpZXNSZXF1aXJlZC50b0RvbShcInNtYWxsXCIsIGZhbHNlLCBcInVsXCIpLm91dGVySFRNTDtcblx0XHRcdGh0bWwgKz0gXCI8L2Rpdj5cIjtcblx0XHR9XG5cblx0XHRodG1sICs9IFwiPGRsIGNsYXNzPSdjbHVtcC1saXN0IHNtYWxsJz5cIjtcblxuXHRcdFsnSHVsbCcsICdDcmV3JywgJ0xpZmUnLCAnTW92ZW1lbnRTcGVlZCcsICdSb3RhdGlvblNwZWVkJ10uZm9yRWFjaChmdW5jdGlvbihrZXkpIHtcblx0XHRcdGh0bWwgKz0gXCI8ZHQgY2xhc3M9J2l0ZW0nPlwiK2tleStcIjwvZHQ+PGRkIGNsYXNzPSdxdWFudGl0eSc+XCIrc2VsZltrZXldK1wiPC9kZD5cIjtcblx0XHR9KTtcblx0XHRodG1sICs9IFwiPC9kbD5cIjtcblx0fVxuXG5cdGVsZW1lbnQuaW5uZXJIVE1MID0gaHRtbDtcblxuXHRlbGVtZW50LnRpdGxlID0gdGhpcy50b1N0cmluZygpO1xuXG5cdGlmKGluY2x1ZGVDaGlsZHJlbikge1xuXHRcdGVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIGZ1bmN0aW9uKGUpIHtcblx0XHRcdGUuc3RvcFByb3BhZ2F0aW9uKCk7XG5cblx0XHRcdHZhciBjaGlsZExpc3QgPSBlbGVtZW50LnF1ZXJ5U2VsZWN0b3IoXCIuY2hpbGQtbGlzdFwiKTtcblx0XHRcdGlmKGNoaWxkTGlzdCkge1xuXHRcdFx0XHRlbGVtZW50LnJlbW92ZUNoaWxkKGNoaWxkTGlzdCk7XG5cdFx0XHR9XG5cdFx0XHRlbHNlIHtcblx0XHRcdFx0dmFyIHN1Y2Nlc3NFdmVudCA9IHNlbGYuc3VjY2Vzc0V2ZW50O1xuXHRcdFx0XHR2YXIgZGVmYXVsdEV2ZW50ID0gc2VsZi5kZWZhdWx0RXZlbnQ7XG5cdFx0XHRcdHZhciBxdWFsaXRpZXNSZXF1aXJlZCA9ICBzZWxmLnF1YWxpdGllc1JlcXVpcmVkO1xuXHRcdFx0XHR2YXIgZXZlbnRzID0gW107XG5cdFx0XHRcdGlmKHN1Y2Nlc3NFdmVudCAmJiBxdWFsaXRpZXNSZXF1aXJlZCAmJiBxdWFsaXRpZXNSZXF1aXJlZC5zaXplKCkpIHtcblx0XHRcdFx0XHRldmVudHMucHVzaChzdWNjZXNzRXZlbnQpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmKGRlZmF1bHRFdmVudCkge1xuXHRcdFx0XHRcdGV2ZW50cy5wdXNoKGRlZmF1bHRFdmVudCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYoZXZlbnRzLmxlbmd0aCkge1xuXHRcdFx0XHRcdHZhciB3cmFwcGVyQ2x1bXAgPSBuZXcgQ2x1bXAoZXZlbnRzLCBhcGkudHlwZXMuRXZlbnQpO1xuXHRcdFx0XHRcdHZhciBjaGlsZF9ldmVudHMgPSB3cmFwcGVyQ2x1bXAudG9Eb20oc2l6ZSwgdHJ1ZSk7XG5cblx0XHRcdFx0XHRjaGlsZF9ldmVudHMuY2xhc3NMaXN0LmFkZChcImNoaWxkLWxpc3RcIik7XG5cdFx0XHRcdFx0ZWxlbWVudC5hcHBlbmRDaGlsZChjaGlsZF9ldmVudHMpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRyZXR1cm4gZWxlbWVudDtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gU3Bhd25lZEVudGl0eTsiLCJ2YXIgTHVtcCA9IHJlcXVpcmUoJy4vbHVtcCcpO1xudmFyIENsdW1wID0gcmVxdWlyZSgnLi9jbHVtcCcpO1xudmFyIFBvcnQgPSByZXF1aXJlKCcuL3BvcnQnKTtcbnZhciBBcmVhID0gcmVxdWlyZSgnLi9hcmVhJyk7XG5cbnZhciBhcGk7XG5cbmZ1bmN0aW9uIFRpbGVWYXJpYW50KHJhdywgcGFyZW50KSB7XG5cdHRoaXMuc3RyYWlnaHRDb3B5ID0gW1xuXHRcdCdOYW1lJyxcblx0XHQnSHVtYW5OYW1lJyxcblx0XHQnRGVzY3JpcHRpb24nLFxuXG5cdFx0J01heFRpbGVQb3B1bGF0aW9uJyxcblx0XHQnTWluVGlsZVBvcHVsYXRpb24nLFxuXHRcdFxuXHRcdCdTZWFDb2xvdXInLFxuXHRcdCdNdXNpY1RyYWNrTmFtZScsXG5cdFx0J0NoYW5jZU9mV2VhdGhlcicsXG5cdFx0J0ZvZ1JldmVhbFRocmVzaG9sZCdcblx0XTtcblxuLypcbkxhYmVsRGF0YTogQXJyYXlbNl1cblBoZW5vbWVuYURhdGE6IEFycmF5WzFdXG5TcGF3blBvaW50czogQXJyYXlbMl1cblRlcnJhaW5EYXRhOiBBcnJheVsxNF1cbldlYXRoZXI6IEFycmF5WzFdXG4qL1xuXG5cdHJhdy5JZCA9IHJhdy5OYW1lO1xuXHRMdW1wLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG5cblx0dGhpcy5TZXR0aW5nSWQgPSByYXcuU2V0dGluZy5JZDtcblx0dGhpcy5zZXR0aW5nID0gbnVsbDtcblxuXHR0aGlzLnBvcnRzID0gbmV3IENsdW1wKHRoaXMuYXR0cmlicy5Qb3J0RGF0YSB8fCBbXSwgUG9ydCwgdGhpcyk7XG5cblx0dGhpcy5hcmVhcyA9IG51bGw7XG59XG5PYmplY3Qua2V5cyhMdW1wLnByb3RvdHlwZSkuZm9yRWFjaChmdW5jdGlvbihtZW1iZXIpIHsgVGlsZVZhcmlhbnQucHJvdG90eXBlW21lbWJlcl0gPSBMdW1wLnByb3RvdHlwZVttZW1iZXJdOyB9KTtcblxuVGlsZVZhcmlhbnQucHJvdG90eXBlLndpcmVVcCA9IGZ1bmN0aW9uKHRoZUFwaSkge1xuXG5cdGFwaSA9IHRoZUFwaTtcblxuXHR0aGlzLnNldHRpbmcgPSBhcGkuZ2V0T3JDcmVhdGUoYXBpLnR5cGVzLlNldHRpbmcsIHRoaXMuYXR0cmlicy5TZXR0aW5nLCB0aGlzKTtcblxuXHR0aGlzLnBvcnRzLmZvckVhY2goZnVuY3Rpb24ocCkgeyBwLndpcmVVcChhcGkpOyB9KTtcblxuXHQvLyBBbHNvIGNyZWF0ZSBhIGxpc3Qgb2YgYWxsIHRoZSBhcmVhcyBvZiBlYWNoIG9mIHRoZSBwb3J0cyBpbiB0aGlzIG9iamVjdCBmb3IgY29udmVuaWVuY2Vcblx0dGhpcy5hcmVhcyA9IG5ldyBDbHVtcCh0aGlzLnBvcnRzLm1hcChmdW5jdGlvbihwKSB7IHJldHVybiBwLmFyZWE7IH0pLCBhcGkudHlwZXMuQXJlYSwgdGhpcyk7XG5cblx0THVtcC5wcm90b3R5cGUud2lyZVVwLmNhbGwodGhpcyk7XG59O1xuXG5UaWxlVmFyaWFudC5wcm90b3R5cGUudG9TdHJpbmcgPSBmdW5jdGlvbihsb25nKSB7XG5cdHJldHVybiB0aGlzLmNvbnN0cnVjdG9yLm5hbWUgKyBcIiBcIiArIHRoaXMuSHVtYW5OYW1lICsgXCIgKCNcIiArIHRoaXMuTmFtZSArIFwiKVwiO1xufTtcblxuVGlsZVZhcmlhbnQucHJvdG90eXBlLnRvRG9tID0gZnVuY3Rpb24oc2l6ZSwgdGFnKSB7XG5cblx0c2l6ZSA9IHNpemUgfHwgXCJub3JtYWxcIjtcblx0dGFnID0gdGFnIHx8IFwibGlcIjtcblxuXHR2YXIgaHRtbCA9IFwiXCI7XG5cblx0dmFyIGVsZW1lbnQgPSAgZG9jdW1lbnQuY3JlYXRlRWxlbWVudCh0YWcpO1xuXHRlbGVtZW50LmNsYXNzTmFtZSA9IFwiaXRlbSBcIit0aGlzLmNvbnN0cnVjdG9yLm5hbWUudG9Mb3dlckNhc2UoKStcIi1pdGVtIFwiK3NpemU7XG5cblx0aHRtbCA9IFwiXFxuPGgzIGNsYXNzPSd0aXRsZSc+XCIrdGhpcy5IdW1hbk5hbWUrXCI8L2gzPlwiO1xuXG5cdGVsZW1lbnQuaW5uZXJIVE1MID0gaHRtbDtcblxuXHRlbGVtZW50LnRpdGxlID0gdGhpcy50b1N0cmluZygpO1xuXG5cdHJldHVybiBlbGVtZW50O1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBUaWxlVmFyaWFudDsiLCJ2YXIgTHVtcCA9IHJlcXVpcmUoJy4vbHVtcCcpO1xudmFyIENsdW1wID0gcmVxdWlyZSgnLi9jbHVtcCcpO1xudmFyIFRpbGVWYXJpYW50ID0gcmVxdWlyZSgnLi90aWxlLXZhcmlhbnQnKTtcbnZhciBQb3J0ID0gcmVxdWlyZSgnLi9wb3J0Jyk7XG52YXIgQXJlYSA9IHJlcXVpcmUoJy4vYXJlYScpO1xuXG52YXIgYXBpO1xuXG5mdW5jdGlvbiBUaWxlKHJhdywgcGFyZW50KSB7XG5cdHRoaXMuc3RyYWlnaHRDb3B5ID0gW1xuXHRcdCdOYW1lJ1xuXHRdO1xuXHRyYXcuSWQgPSByYXcuTmFtZTtcblx0THVtcC5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuXG5cdHRoaXMudGlsZVZhcmlhbnRzID0gbmV3IENsdW1wKHRoaXMuYXR0cmlicy5UaWxlcyB8fCBbXSwgVGlsZVZhcmlhbnQsIHRoaXMpO1xufVxuT2JqZWN0LmtleXMoTHVtcC5wcm90b3R5cGUpLmZvckVhY2goZnVuY3Rpb24obWVtYmVyKSB7IFRpbGUucHJvdG90eXBlW21lbWJlcl0gPSBMdW1wLnByb3RvdHlwZVttZW1iZXJdOyB9KTtcblxuVGlsZS5wcm90b3R5cGUud2lyZVVwID0gZnVuY3Rpb24odGhlQXBpKSB7XG5cblx0YXBpID0gdGhlQXBpO1xuXG5cdHRoaXMudGlsZVZhcmlhbnRzLmZvckVhY2goZnVuY3Rpb24odHYpIHsgdHYud2lyZVVwKGFwaSk7IH0pO1xuXG5cdC8vIEFsc28gY3JlYXRlIGEgbGlzdCBvZiBhbGwgdGhlIHBvcnRzIGFuZCBhcmVhcyBvZiBlYWNoIG9mIHRoZSB0aWxldmFyaWFudHMgaW4gdGhpcyBvYmplY3QgZm9yIGNvbnZlbmllbmNlXG5cdHZhciBhbGxfcG9ydHMgPSB7fTtcblx0dmFyIGFsbF9hcmVhcyA9IHt9O1xuXHR0aGlzLnRpbGVWYXJpYW50cy5mb3JFYWNoKGZ1bmN0aW9uKHR2KSB7XG5cdFx0dHYucG9ydHMuZm9yRWFjaChmdW5jdGlvbihwKSB7XG5cdFx0XHRhbGxfcG9ydHNbcC5JZF0gPSBwO1xuXHRcdFx0YWxsX2FyZWFzW3AuYXJlYS5JZF0gPSBwLmFyZWE7XG5cdFx0fSk7XG5cdH0pO1xuXHR0aGlzLnBvcnRzID0gbmV3IENsdW1wKE9iamVjdC5rZXlzKGFsbF9wb3J0cykubWFwKGZ1bmN0aW9uKHApIHsgcmV0dXJuIGFsbF9wb3J0c1twXTsgfSksIGFwaS50eXBlcy5Qb3J0LCB0aGlzKTtcblx0dGhpcy5hcmVhcyA9IG5ldyBDbHVtcChPYmplY3Qua2V5cyhhbGxfYXJlYXMpLm1hcChmdW5jdGlvbihhKSB7IHJldHVybiBhbGxfYXJlYXNbYV07IH0pLCBhcGkudHlwZXMuQXJlYSwgdGhpcyk7XG5cblx0THVtcC5wcm90b3R5cGUud2lyZVVwLmNhbGwodGhpcyk7XG59O1xuXG5UaWxlLnByb3RvdHlwZS50b1N0cmluZyA9IGZ1bmN0aW9uKGxvbmcpIHtcblx0cmV0dXJuIHRoaXMuY29uc3RydWN0b3IubmFtZSArIFwiIFwiICsgdGhpcy5OYW1lICsgXCIgKCNcIiArIHRoaXMuTmFtZSArIFwiKVwiO1xufTtcblxuVGlsZS5wcm90b3R5cGUudG9Eb20gPSBmdW5jdGlvbihzaXplLCB0YWcpIHtcblxuXHRzaXplID0gc2l6ZSB8fCBcIm5vcm1hbFwiO1xuXHR0YWcgPSB0YWcgfHwgXCJsaVwiO1xuXG5cdHZhciBodG1sID0gXCJcIjtcblxuXHR2YXIgZWxlbWVudCA9ICBkb2N1bWVudC5jcmVhdGVFbGVtZW50KHRhZyk7XG5cdGVsZW1lbnQuY2xhc3NOYW1lID0gXCJpdGVtIFwiK3RoaXMuY29uc3RydWN0b3IubmFtZS50b0xvd2VyQ2FzZSgpK1wiLWl0ZW0gXCIrc2l6ZTtcblxuXHRodG1sID0gXCJcXG48aDMgY2xhc3M9J3RpdGxlJz5cIit0aGlzLk5hbWUrXCI8L2gzPlwiO1xuXG5cdGVsZW1lbnQuaW5uZXJIVE1MID0gaHRtbDtcblxuXHRlbGVtZW50LnRpdGxlID0gdGhpcy50b1N0cmluZygpO1xuXG5cdHJldHVybiBlbGVtZW50O1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBUaWxlOyIsInZhciBhcGkgPSByZXF1aXJlKCcuL2FwaScpO1xudmFyIGRyYWduZHJvcCA9IHJlcXVpcmUoJy4vdWkvZHJhZ25kcm9wJyk7XG52YXIgcXVlcnkgPSByZXF1aXJlKCcuL3VpL3F1ZXJ5Jyk7XG5cblxuJChcIiN0YWJzIC5idXR0b25zIGxpXCIpLm9uKFwiY2xpY2tcIiwgZnVuY3Rpb24oZSkge1xuXG4gIHZhciB0eXBlID0gJCh0aGlzKS5hdHRyKFwiZGF0YS10eXBlXCIpO1xuXG4gICQoXCIjdGFicyAucGFuZXMgLnBhbmVcIikuaGlkZSgpOyAvLyBIaWRlIGFsbCBwYW5lc1xuICAkKFwiI3RhYnMgLmJ1dHRvbnMgbGlcIikucmVtb3ZlQ2xhc3MoXCJhY3RpdmVcIik7IC8vIERlYWN0aXZhdGUgYWxsIGJ1dHRvbnNcblxuICAkKFwiI3RhYnMgLnBhbmVzIC5cIit0eXBlLnRvTG93ZXJDYXNlKCkpLnNob3coKTtcbiAgJChcIiN0YWJzIC5idXR0b25zIFtkYXRhLXR5cGU9XCIrdHlwZStcIl1cIikuYWRkQ2xhc3MoXCJhY3RpdmVcIik7XG59KTtcblxuLy8gU2V0dXAgdGhlIGRuZCBsaXN0ZW5lcnMuXG52YXIgZHJvcFpvbmUgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZHJvcC16b25lJyk7XG5cbmRyb3Bab25lLmFkZEV2ZW50TGlzdGVuZXIoJ2RyYWdlbnRlcicsIGRyYWduZHJvcC5oYW5kbGVycy5kcmFnT3ZlciwgZmFsc2UpO1xuZHJvcFpvbmUuYWRkRXZlbnRMaXN0ZW5lcignZHJhZ2xlYXZlJywgZHJhZ25kcm9wLmhhbmRsZXJzLmRyYWdFbmQsIGZhbHNlKTtcbmRyb3Bab25lLmFkZEV2ZW50TGlzdGVuZXIoJ2RyYWdvdmVyJywgZHJhZ25kcm9wLmhhbmRsZXJzLmRyYWdPdmVyLCBmYWxzZSk7XG5cbmRyb3Bab25lLmFkZEV2ZW50TGlzdGVuZXIoJ2Ryb3AnLCBkcmFnbmRyb3AuaGFuZGxlcnMuZHJhZ0Ryb3AsIGZhbHNlKTtcblxuZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3BhdGhzLXRvLW5vZGUnKS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIHF1ZXJ5LnBhdGhzVG9Ob2RlVUksIGZhbHNlKTtcblxuLy8gRm9yIGNvbnZlbmllbmNlXG53aW5kb3cuYXBpID0gYXBpO1xud2luZG93LmFwaS5xdWVyeSA9IHF1ZXJ5OyIsInZhciBhcGkgPSByZXF1aXJlKCcuLi9hcGknKTtcbnZhciBDbHVtcCA9IHJlcXVpcmUoJy4uL29iamVjdHMvY2x1bXAnKTtcbnZhciBpbyA9IHJlcXVpcmUoJy4uL2lvJyk7XG5cbnZhciByZW5kZXIgPSByZXF1aXJlKCcuL3JlbmRlcicpO1xuXG5mdW5jdGlvbiBoYW5kbGVEcmFnT3ZlcihldnQpIHtcbiAgZXZ0LnN0b3BQcm9wYWdhdGlvbigpO1xuICBldnQucHJldmVudERlZmF1bHQoKTtcblxuICAkKFwiI2Ryb3Atem9uZVwiKS5hZGRDbGFzcyhcImRyb3AtdGFyZ2V0XCIpO1xufVxuXG5mdW5jdGlvbiBoYW5kbGVEcmFnRW5kKGV2dCkge1xuICBldnQuc3RvcFByb3BhZ2F0aW9uKCk7XG4gIGV2dC5wcmV2ZW50RGVmYXVsdCgpO1xuXG4gICQoXCIjZHJvcC16b25lXCIpLnJlbW92ZUNsYXNzKFwiZHJvcC10YXJnZXRcIik7XG59XG5cbmZ1bmN0aW9uIGhhbmRsZURyYWdEcm9wKGV2dCkge1xuXG4gICQoXCIjZHJvcC16b25lXCIpLnJlbW92ZUNsYXNzKFwiZHJvcC10YXJnZXRcIik7XG5cbiAgZXZ0LnN0b3BQcm9wYWdhdGlvbigpO1xuICBldnQucHJldmVudERlZmF1bHQoKTtcblxuICB2YXIgZmlsZXMgPSBldnQuZGF0YVRyYW5zZmVyLmZpbGVzOyAvLyBGaWxlTGlzdCBvYmplY3QuXG5cbiAgLy8gRmlsZXMgaXMgYSBGaWxlTGlzdCBvZiBGaWxlIG9iamVjdHMuIExpc3Qgc29tZSBwcm9wZXJ0aWVzLlxuICB2YXIgb3V0cHV0ID0gW107XG4gIGlvLnJlc2V0RmlsZXNUb0xvYWQoKTtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBmaWxlcy5sZW5ndGg7IGkrKykge1xuICAgIHZhciBmID0gZmlsZXNbaV07XG4gICAgdmFyIGZpbGVuYW1lID0gZXNjYXBlKGYubmFtZSk7XG4gICAgdmFyIHR5cGVOYW1lID0gaW8uZmlsZU9iamVjdE1hcFtmaWxlbmFtZV07XG4gICAgdmFyIFR5cGUgPSBhcGkudHlwZXNbdHlwZU5hbWVdO1xuICAgIGlmKFR5cGUpIHtcbiAgICAgIGlvLmluY3JlbWVudEZpbGVzVG9Mb2FkKCk7XG4gICAgICBhcGkucmVhZEZyb21GaWxlKFR5cGUsIGYsIGZ1bmN0aW9uKCkge1xuICAgICAgICBpby5kZWNyZW1lbnRGaWxlc1RvTG9hZCgpO1xuXG4gICAgICAgIGlmKGlvLmNvdW50RmlsZXNUb0xvYWQoKSA9PT0gMCkge1xuICAgICAgICAgIGFwaS53aXJlVXBPYmplY3RzKCk7XG4gICAgICAgICAgcmVuZGVyLmxpc3RzKCk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgICAgb3V0cHV0LnB1c2goJzxsaT48c3Ryb25nPicsIGVzY2FwZShmLm5hbWUpLCAnPC9zdHJvbmc+ICgnLCBmLnR5cGUgfHwgJ24vYScsICcpIC0gJyxcbiAgICAgICAgICAgICAgICBmLnNpemUsICcgYnl0ZXMsIGxhc3QgbW9kaWZpZWQ6ICcsXG4gICAgICAgICAgICAgICAgZi5sYXN0TW9kaWZpZWREYXRlID8gZi5sYXN0TW9kaWZpZWREYXRlLnRvTG9jYWxlRGF0ZVN0cmluZygpIDogJ24vYScsXG4gICAgICAgICAgICAgICAgJzwvbGk+Jyk7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgb3V0cHV0LnB1c2goJzxsaT5FUlJPUjogTm8gaGFuZGxlciBmb3IgZmlsZSA8c3Ryb25nPicgLCBlc2NhcGUoZi5uYW1lKSwgJzwvc3Ryb25nPjwvbGk+Jyk7XG4gICAgfVxuICB9XG4gIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdsaXN0JykuaW5uZXJIVE1MID0gJzx1bD4nICsgb3V0cHV0LmpvaW4oJycpICsgJzwvdWw+Jztcbn1cblxubW9kdWxlLmV4cG9ydHMgPSB7XG5cdGhhbmRsZXJzOiB7XG5cdFx0ZHJhZ092ZXI6IGhhbmRsZURyYWdPdmVyLFxuXHRcdGRyYWdFbmQ6IGhhbmRsZURyYWdFbmQsXG5cdFx0ZHJhZ0Ryb3A6IGhhbmRsZURyYWdEcm9wXG5cdH1cbn07IiwidmFyIGFwaSA9IHJlcXVpcmUoJy4uL2FwaScpO1xudmFyIENsdW1wID0gcmVxdWlyZSgnLi4vb2JqZWN0cy9jbHVtcCcpO1xuXG5mdW5jdGlvbiBSb3V0ZU5vZGUobm9kZSkge1xuICB0aGlzLm5vZGUgPSBub2RlO1xuICB0aGlzLmNoaWxkcmVuID0gW107XG59XG5cbmZ1bmN0aW9uIHBhdGhzVG9Ob2RlVUkoKSB7XG5cbiAgdmFyIHR5cGUgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgndHlwZScpO1xuICB0eXBlID0gdHlwZS5vcHRpb25zW3R5cGUuc2VsZWN0ZWRJbmRleF0udmFsdWU7XG5cbiAgdmFyIG9wZXJhdGlvbiA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdvcGVyYXRpb24nKTtcbiAgb3BlcmF0aW9uID0gb3BlcmF0aW9uLm9wdGlvbnNbb3BlcmF0aW9uLnNlbGVjdGVkSW5kZXhdLnZhbHVlO1xuXG4gIHZhciBpZCA9IHByb21wdChcIklkIG9mIFwiK3R5cGUpO1xuXG4gIGlmKCFpZCkgeyAgLy8gQ2FuY2VsbGVkIGRpYWxvZ3VlXG4gICAgcmV0dXJuO1xuICB9XG5cbiAgdmFyIGl0ZW0gPSBhcGkubGlicmFyeVt0eXBlXS5pZChpZCk7XG5cbiAgaWYoIWl0ZW0pIHtcbiAgICBhbGVydChcIkNvdWxkIG5vdCBmaW5kIFwiK3R5cGUrXCIgXCIraWQpO1xuICAgIHJldHVybjtcbiAgfVxuXG4gIHZhciByb290ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJxdWVyeS10cmVlXCIpO1xuICByb290LmlubmVySFRNTCA9IFwiXCI7XG5cbiAgdmFyIHRpdGxlID0gJCgnLnBhbmUucXVlcnkgLnBhbmUtdGl0bGUnKS50ZXh0KFwiUXVlcnk6IFwiK2l0ZW0udG9TdHJpbmcoKSk7XG5cbiAgdmFyIHJvdXRlcyA9IHBhdGhzVG9Ob2RlKGl0ZW0sIHt9KTtcblxuICBpZihyb3V0ZXMgJiYgcm91dGVzLmNoaWxkcmVuLmxlbmd0aCkge1xuXG4gICAgcm91dGVzID0gZmlsdGVyUGF0aHNUb05vZGUocm91dGVzLCBvcGVyYXRpb24pO1xuXG4gICAgdmFyIHRvcF9jaGlsZHJlbiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJ1bFwiKTtcbiAgICB0b3BfY2hpbGRyZW4uY2xhc3NOYW1lICs9IFwiY2x1bXAtbGlzdCBzbWFsbFwiO1xuXG4gICAgcm91dGVzLmNoaWxkcmVuLmZvckVhY2goZnVuY3Rpb24oY2hpbGRfcm91dGUpIHtcbiAgICAgIHZhciB0cmVlID0gcmVuZGVyUGF0aHNUb05vZGUoY2hpbGRfcm91dGUsIFtdKTtcbiAgICAgIHRvcF9jaGlsZHJlbi5hcHBlbmRDaGlsZCh0cmVlKTtcbiAgICB9KTtcblxuICAgIHJvb3QuYXBwZW5kQ2hpbGQodG9wX2NoaWxkcmVuKTtcbiAgfVxuICBlbHNlIHtcbiAgICBhbGVydChcIlRoaXMgXCIrdHlwZStcIiBpcyBhIHJvb3Qgbm9kZSB3aXRoIG5vIHBhcmVudHMgdGhhdCBzYXRpc2Z5IHRoZSBjb25kaXRpb25zXCIpO1xuICB9XG4gIFxufVxuXG5mdW5jdGlvbiBwYXRoc1RvTm9kZShub2RlLCBzZWVuLCBwYXJlbnQpIHtcblxuICBpZihzZWVuW25vZGUuSWRdKSB7ICAgLy8gRG9uJ3QgcmVjdXJzZSBpbnRvIG5vZGVzIHdlJ3ZlIGFscmVhZHkgc2VlblxuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIHZhciBhbmNlc3RyeSA9IEpTT04ucGFyc2UoSlNPTi5zdHJpbmdpZnkoc2VlbikpO1xuICBhbmNlc3RyeVtub2RlLklkXSA9IHRydWU7XG5cbiAgdmFyIHRoaXNfbm9kZSA9IG5ldyBSb3V0ZU5vZGUoLypub2RlLmxpbmtUb0V2ZW50ID8gbm9kZS5saW5rVG9FdmVudCA6Ki8gbm9kZSk7IC8vIElmIHRoaXMgbm9kZSBpcyBqdXN0IGEgbGluayB0byBhbm90aGVyIG9uZSwgc2tpcCBvdmVyIHRoZSB1c2VsZXNzIGxpbmtcblxuICBpZihub2RlIGluc3RhbmNlb2YgYXBpLnR5cGVzLlNwYXduZWRFbnRpdHkpIHtcbiAgICByZXR1cm4gdGhpc19ub2RlOyAgIC8vIExlYWYgbm9kZSBpbiB0cmVlXG4gIH1cbiAgZWxzZSBpZihub2RlIGluc3RhbmNlb2YgYXBpLnR5cGVzLkV2ZW50ICYmIG5vZGUudGFnID09PSBcInVzZVwiKSB7XG4gICAgcmV0dXJuIHRoaXNfbm9kZTsgICAvLyBMZWFmIG5vZGUgaW4gdHJlZVxuICB9XG4gIGVsc2UgaWYobm9kZSBpbnN0YW5jZW9mIGFwaS50eXBlcy5FdmVudCAmJiBwYXJlbnQgaW5zdGFuY2VvZiBhcGkudHlwZXMuRXZlbnQgJiYgKHBhcmVudC50YWcgPT09IFwia2lsbGVkXCIgfHwgcGFyZW50LnRhZyA9PT0gXCJwYWNpZmllZFwiKSkgeyAvLyBJZiB0aGlzIGlzIGFuIGV2ZW50IHRoYXQncyByZWFjaGFibGUgYnkga2lsbGluZyBhIG1vbnN0ZXIsIGRvbid0IHJlY3Vyc2UgYW55IG90aGVyIGNhdXNlcyAoYXMgdGhleSdyZSB1c3VhbGx5IG1pc2xlYWRpbmcvY2lyY3VsYXIpXG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIGVsc2UgaWYobm9kZSBpbnN0YW5jZW9mIGFwaS50eXBlcy5TZXR0aW5nKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIGVsc2UgaWYgKG5vZGUgaW5zdGFuY2VvZiBhcGkudHlwZXMuUG9ydCkge1xuICAgIHJldHVybiBuZXcgUm91dGVOb2RlKG5vZGUuYXJlYSk7XG4gIH1cbiAgZWxzZSBpZihub2RlLmxpbWl0ZWRUb0FyZWEgJiYgbm9kZS5saW1pdGVkVG9BcmVhLklkICE9PSAxMDE5NTYpIHtcbiAgICB2YXIgYXJlYV9uYW1lID0gbm9kZS5saW1pdGVkVG9BcmVhLk5hbWUudG9Mb3dlckNhc2UoKTtcbiAgICB2YXIgZXZlbnRfbmFtZSA9IChub2RlLk5hbWUgJiYgbm9kZS5OYW1lLnRvTG93ZXJDYXNlKCkpIHx8IFwiXCI7XG4gICAgaWYoYXJlYV9uYW1lLmluZGV4T2YoZXZlbnRfbmFtZSkgIT09IC0xIHx8IGV2ZW50X25hbWUuaW5kZXhPZihhcmVhX25hbWUpICE9PSAtMSkgeyAgLy8gSWYgQXJlYSBoYXMgc2ltaWxhciBuYW1lIHRvIEV2ZW50LCBpZ25vcmUgdGhlIGV2ZW50IGFuZCBqdXN0IHN1YnN0aXR1dGUgdGhlIGFyZWFcbiAgICAgIHJldHVybiBuZXcgUm91dGVOb2RlKG5vZGUubGltaXRlZFRvQXJlYSk7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgdGhpc19ub2RlLmNoaWxkcmVuLnB1c2gobmV3IFJvdXRlTm9kZShub2RlLmxpbWl0ZWRUb0FyZWEpKTsgICAvLyBFbHNlIGluY2x1ZGUgYm90aCB0aGUgQXJlYSBhbmQgdGhlIEV2ZW50XG4gICAgICByZXR1cm4gdGhpc19ub2RlO1xuICAgIH1cbiAgICBcbiAgfVxuICBlbHNlIHtcbiAgICBmb3IodmFyIGk9MDsgaTxub2RlLnBhcmVudHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciB0aGVfcGFyZW50ID0gbm9kZS5wYXJlbnRzW2ldO1xuICAgICAgdmFyIHN1YnRyZWUgPSBwYXRoc1RvTm9kZSh0aGVfcGFyZW50LCBhbmNlc3RyeSwgbm9kZSk7XG4gICAgICBpZihzdWJ0cmVlKSB7XG4gICAgICAgIHRoaXNfbm9kZS5jaGlsZHJlbi5wdXNoKHN1YnRyZWUpO1xuICAgICAgfVxuICAgIH1cbiAgICBpZighdGhpc19ub2RlLmNoaWxkcmVuLmxlbmd0aCkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiB0aGlzX25vZGU7XG59XG5cbmZ1bmN0aW9uIGZpbHRlclBhdGhzVG9Ob2RlKHJvdXRlcywgb3BlcmF0aW9uKSB7XG4gIC8vIEZpbHRlciByb3V0ZXMgYnkgb3BlcmF0aW9uXG4gIGlmKHJvdXRlcyAmJiByb3V0ZXMuY2hpbGRyZW4gJiYgb3BlcmF0aW9uICE9PSBcImFueVwiKSB7XG4gICAgcm91dGVzLmNoaWxkcmVuID0gcm91dGVzLmNoaWxkcmVuLmZpbHRlcihmdW5jdGlvbihyb3V0ZV9ub2RlKSB7XG5cbiAgICAgIGx1bXAgPSByb3V0ZV9ub2RlLm5vZGU7XG5cbiAgICAgIGlmKG9wZXJhdGlvbiA9PT0gXCJhZGRpdGl2ZVwiKSB7XG4gICAgICAgIHJldHVybiBsdW1wLmlzT25lT2YoW2FwaS50eXBlcy5RdWFsaXR5RWZmZWN0LCBhcGkudHlwZXMuQXZhaWxhYmlsaXR5XSkgJiYgbHVtcC5pc0FkZGl0aXZlKCk7XG4gICAgICB9XG4gICAgICBlbHNlIGlmKG9wZXJhdGlvbiA9PT0gXCJzdWJ0cmFjdGl2ZVwiKSB7XG4gICAgICAgIHJldHVybiBsdW1wLmlzT25lT2YoW2FwaS50eXBlcy5RdWFsaXR5RWZmZWN0LCBhcGkudHlwZXMuQXZhaWxhYmlsaXR5XSkgJiYgbHVtcC5pc1N1YnRyYWN0aXZlKCk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICByZXR1cm4gcm91dGVzO1xufVxuXG5mdW5jdGlvbiByZW5kZXJQYXRoc1RvTm9kZShyb3V0ZU5vZGUsIGFuY2VzdHJ5KSB7XG4gIFxuICBpZighKHJvdXRlTm9kZSBpbnN0YW5jZW9mIFJvdXRlTm9kZSkpIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIHZhciBlbGVtZW50ID0gcm91dGVOb2RlLm5vZGUudG9Eb20oXCJzbWFsbFwiLCBmYWxzZSk7XG4gIFxuICB2YXIgY2hpbGRfbGlzdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJ1bFwiKTtcbiAgY2hpbGRfbGlzdC5jbGFzc05hbWUgKz0gXCJjbHVtcC1saXN0IHNtYWxsIGNoaWxkLWxpc3RcIjtcblxuICB2YXIgbmV3X2FuY2VzdHJ5ID0gYW5jZXN0cnkuc2xpY2UoKTtcbiAgbmV3X2FuY2VzdHJ5LnB1c2gocm91dGVOb2RlLm5vZGUpO1xuICByb3V0ZU5vZGUuY2hpbGRyZW4uZm9yRWFjaChmdW5jdGlvbihjaGlsZF9yb3V0ZSwgaW5kZXgsIGNoaWxkcmVuKSB7XG4gICAgdmFyIGNoaWxkX2NvbnRlbnQgPSByZW5kZXJQYXRoc1RvTm9kZShjaGlsZF9yb3V0ZSwgbmV3X2FuY2VzdHJ5KTtcbiAgICBjaGlsZF9saXN0LmFwcGVuZENoaWxkKGNoaWxkX2NvbnRlbnQpO1xuICB9KTtcblxuICBpZihyb3V0ZU5vZGUuY2hpbGRyZW4ubGVuZ3RoKSB7XG4gICAgZWxlbWVudC5hcHBlbmRDaGlsZChjaGlsZF9saXN0KTtcbiAgfVxuICBlbHNlIHtcbiAgICB2YXIgZGVzY3JpcHRpb24gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwibGlcIik7XG4gICAgZGVzY3JpcHRpb24uaW5uZXJIVE1MID0gJzxzcGFuIGNsYXNzPVwicm91dGUtZGVzY3JpcHRpb25cIj5ISU5UOiAnICsgZGVzY3JpYmVSb3V0ZShuZXdfYW5jZXN0cnkpICsgJzwvc3Bhbj4nO1xuXG4gICAgdmFyIHJlcXNUaXRsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2g1Jyk7XG4gICAgcmVxc1RpdGxlLmlubmVySFRNTCA9IFwiUmVxdWlyZW1lbnRzXCI7XG4gICAgZGVzY3JpcHRpb24uYXBwZW5kQ2hpbGQocmVxc1RpdGxlKTtcblxuICAgIHZhciB0b3RhbF9yZXF1aXJlbWVudHMgPSBnZXRSb3V0ZVJlcXVpcmVtZW50cyhuZXdfYW5jZXN0cnkpO1xuICAgIFxuICAgIGRlc2NyaXB0aW9uLmFwcGVuZENoaWxkKHRvdGFsX3JlcXVpcmVtZW50cy50b0RvbShcInNtYWxsXCIsIGZhbHNlKSk7XG4gICAgZWxlbWVudC5hcHBlbmRDaGlsZChkZXNjcmlwdGlvbik7XG4gIH1cblxuICByZXR1cm4gZWxlbWVudDtcbn1cblxuZnVuY3Rpb24gbG93ZXIodGV4dCkge1xuICByZXR1cm4gdGV4dC5zbGljZSgwLDEpLnRvTG93ZXJDYXNlKCkrdGV4dC5zbGljZSgxKTtcbn1cblxuZnVuY3Rpb24gZGVzY3JpYmVSb3V0ZShhbmNlc3RyeSkge1xuICB2YXIgYSA9IGFuY2VzdHJ5LnNsaWNlKCkucmV2ZXJzZSgpO1xuXG4gIHZhciBndWlkZSA9IFwiXCI7XG4gIGlmKGFbMF0gaW5zdGFuY2VvZiBhcGkudHlwZXMuQXJlYSkge1xuICAgIGlmKGFbMV0gaW5zdGFuY2VvZiBhcGkudHlwZXMuRXZlbnQpIHtcbiAgICAgIGd1aWRlID0gXCJTZWVrIFwiK2FbMV0uTmFtZStcIiBpbiBcIithWzBdLk5hbWU7XG4gICAgICBpZihhWzJdIGluc3RhbmNlb2YgYXBpLnR5cGVzLkludGVyYWN0aW9uKSB7XG4gICAgICAgIGd1aWRlICs9IFwiIGFuZCBcIjtcbiAgICAgICAgaWYoXCJcXFwiJ1wiLmluZGV4T2YoYVsyXS5OYW1lWzBdKSAhPT0gLTEpIHtcbiAgICAgICAgICBndWlkZSArPSBcImV4Y2xhaW0gXCI7XG4gICAgICAgIH1cbiAgICAgICAgZ3VpZGUgKz0gbG93ZXIoYVsyXS5OYW1lKTtcbiAgICAgIH1cbiAgICAgIGd1aWRlICs9IFwiLlwiO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIGd1aWRlID0gXCJUcmF2ZWwgdG8gXCIrYVswXS5OYW1lO1xuXG4gICAgICBpZihhWzFdIGluc3RhbmNlb2YgYXBpLnR5cGVzLkludGVyYWN0aW9uKSB7XG4gICAgICAgIGd1aWRlICs9IFwiIGFuZCBcIitsb3dlcihhWzFdLk5hbWUpO1xuICAgICAgfVxuICAgICAgZWxzZSBpZihhWzFdIGluc3RhbmNlb2YgYXBpLnR5cGVzLkV4Y2hhbmdlICYmIGFbMl0gaW5zdGFuY2VvZiBhcGkudHlwZXMuU2hvcCkge1xuICAgICAgICBndWlkZSArPSBcIiBhbmQgbG9vayBmb3IgdGhlIFwiK2FbMl0uTmFtZStcIiBFbXBvcml1bSBpbiBcIithWzFdLk5hbWU7XG4gICAgICB9XG5cbiAgICAgIGd1aWRlICs9IFwiLlwiO1xuICAgIH1cbiAgfVxuICBlbHNlIGlmKGFbMF0gaW5zdGFuY2VvZiBhcGkudHlwZXMuU3Bhd25lZEVudGl0eSkge1xuICAgIGd1aWRlID0gXCJGaW5kIGFuZCBiZXN0IGEgXCIrYVswXS5IdW1hbk5hbWU7XG4gICAgaWYoYVsyXSBpbnN0YW5jZW9mIGFwaS50eXBlcy5JbnRlcmFjdGlvbikge1xuICAgICAgZ3VpZGUgKz0gXCIsIHRoZW4gXCIgKyBsb3dlcihhWzJdLk5hbWUpO1xuICAgIH1cbiAgICBndWlkZSArPSBcIi5cIjtcbiAgfVxuICBlbHNlIGlmKGFbMF0gaW5zdGFuY2VvZiBhcGkudHlwZXMuRXZlbnQgJiYgYVswXS50YWcgPT09IFwidXNlXCIgJiYgIShhWzFdIGluc3RhbmNlb2YgYXBpLnR5cGVzLlF1YWxpdHlSZXF1aXJlbWVudCkpIHtcbiAgICBpZihhWzBdLk5hbWUubWF0Y2goL15cXHMqU3BlYWsvaSkpIHtcbiAgICAgIGd1aWRlID0gYVswXS5OYW1lO1xuICAgIH1cbiAgICBlbHNlIGlmKGFbMF0uTmFtZS5tYXRjaCgvXlxccypBL2kpKSB7XG4gICAgICBndWlkZSA9IFwiQWNxdWlyZSBcIitsb3dlcihhWzBdLk5hbWUpO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIGd1aWRlID0gXCJGaW5kIGEgXCIrbG93ZXIoYVswXS5OYW1lKTtcbiAgICB9XG4gICAgZ3VpZGUgKz0gXCIgYW5kIFwiICsgbG93ZXIoYVsxXS5OYW1lKSArIFwiLlwiO1xuICB9XG5cbiAgcmV0dXJuIGd1aWRlO1xufVxuXG5mdW5jdGlvbiBkZXRhaWxSb3V0ZShhbmNlc3RyeSkge1xuICB2YXIgYSA9IGFuY2VzdHJ5LnNsaWNlKCkucmV2ZXJzZSgpO1xuXG4gIHZhciBndWlkZSA9IFwiXCI7XG4gIGlmKGFbMF0gaW5zdGFuY2VvZiBhcGkudHlwZXMuQXJlYSkge1xuICAgIGlmKGFbMV0gaW5zdGFuY2VvZiBhcGkudHlwZXMuRXZlbnQpIHtcbiAgICAgIGd1aWRlID0gXCJZb3UgbXVzdCB0cmF2ZWwgdG8gXCIrYVswXS5OYW1lK1wiIGFuZCBsb29rIGZvciBcIithWzFdLk5hbWUrXCIuXCI7XG4gICAgICBpZihhWzJdIGluc3RhbmNlb2YgYXBpLnR5cGVzLkludGVyYWN0aW9uKSB7XG4gICAgICAgIGd1aWRlICs9IFwiICBXaGVuIHlvdSBmaW5kIGl0IHlvdSBzaG91bGQgXCI7XG4gICAgICAgIGlmKFwiXFxcIidcIi5pbmRleE9mKGFbMl0uTmFtZVswXSkgIT09IC0xKSB7XG4gICAgICAgICAgZ3VpZGUgKz0gXCJzYXkgXCI7XG4gICAgICAgIH1cbiAgICAgICAgZ3VpZGUgKz0gbG93ZXIoYVsyXS5OYW1lKTtcbiAgICAgIH1cbiAgICAgIGd1aWRlICs9IFwiLlwiO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIGd1aWRlID0gXCJNYWtlIGZvciBcIithWzBdLk5hbWU7XG5cbiAgICAgIGlmKGFbMV0gaW5zdGFuY2VvZiBhcGkudHlwZXMuSW50ZXJhY3Rpb24pIHtcbiAgICAgICAgZ3VpZGUgKz0gXCIgYW5kIFwiK2xvd2VyKGFbMV0uTmFtZSk7XG4gICAgICB9XG4gICAgICBlbHNlIGlmKGFbMV0gaW5zdGFuY2VvZiBhcGkudHlwZXMuRXhjaGFuZ2UgJiYgYVsyXSBpbnN0YW5jZW9mIGFwaS50eXBlcy5TaG9wKSB7XG4gICAgICAgIGd1aWRlICs9IFwiLiAgVXBvbiBhcnJpdmFsIGdvIHRvIFwiK2FbMV0uTmFtZStcIiwgYW5kIGxvb2sgZm9yIHRoZSBzaG9wIFwiK2FbMl0uTmFtZXM7XG4gICAgICB9XG5cbiAgICAgIGd1aWRlICs9IFwiLlwiO1xuICAgIH1cbiAgfVxuICBlbHNlIGlmKGFbMF0gaW5zdGFuY2VvZiBhcGkudHlwZXMuU3Bhd25lZEVudGl0eSkge1xuICAgIGd1aWRlID0gXCJZb3UgbXVzdCBodW50IHRoZSBteXRoaWNhbCB6ZWUtcGVyaWwga25vd24gYXMgdGhlIFwiK2FbMF0uSHVtYW5OYW1lK1wiLCBlbmdhZ2UgaXQgaW4gYmF0dGxlIGFuZCBkZWZlYXQgaXQuXCI7XG4gICAgaWYoYVsyXSBpbnN0YW5jZW9mIGFwaS50eXBlcy5JbnRlcmFjdGlvbikge1xuICAgICAgZ3VpZGUgKz0gXCIgIE9uY2UgeW91IGhhdmUgY29ucXVlcmVkIGl0IHlvdSBtdXN0IFwiICsgbG93ZXIoYVsyXS5OYW1lKSArIFwiIHRvIGhlbHAgc2VjdXJlIHlvdXIgcHJpemUuXCI7XG4gICAgfVxuICB9XG4gIGVsc2UgaWYoYVswXSBpbnN0YW5jZW9mIGFwaS50eXBlcy5FdmVudCAmJiBhWzBdLnRhZyA9PT0gXCJ1c2VcIiAmJiAhKGFbMV0gaW5zdGFuY2VvZiBhcGkudHlwZXMuUXVhbGl0eVJlcXVpcmVtZW50KSkge1xuICAgIGlmKGFbMF0uTmFtZS5tYXRjaCgvXlxccypTcGVhay9pKSkge1xuICAgICAgZ3VpZGUgPSBcIkZpcnN0IHlvdSBtdXN0IFwiK2xvd2VyKGFbMF0uTmFtZSk7XG4gICAgfVxuICAgIGVsc2UgaWYoYVswXS5OYW1lLm1hdGNoKC9eXFxzKkEvaSkpIHtcbiAgICAgIGd1aWRlID0gXCJTb3VyY2UgXCIrbG93ZXIoYVswXS5OYW1lKTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICBndWlkZSA9IFwiVHJ5IHRvIGxvY2F0ZSBhIFwiK2xvd2VyKGFbMF0uTmFtZSk7XG4gICAgfVxuICAgIGd1aWRlICs9IFwiLCBhbmQgdGhlbiBcIiArIGxvd2VyKGFbMV0uTmFtZSkgKyBcIi5cIjtcbiAgfVxuXG4gIHJldHVybiBndWlkZTtcbn1cblxuZnVuY3Rpb24gZ2V0Um91dGVSZXF1aXJlbWVudHMoYW5jZXN0cnkpIHtcblxuICB2YXIgcmVxcyA9IHt9O1xuXG4gIC8vIEFuY2VzdHJ5IGlzIG9yZGVyZWQgZnJvbSBsYXN0LT5maXJzdCwgc28gaXRlcmF0ZSBiYWNrd2FyZHMgZnJvbSBmaW5hbCBlZmZlY3QgLT4gaW5pdGlhbCBjYXVzZVxuICBhbmNlc3RyeS5mb3JFYWNoKGZ1bmN0aW9uKHN0ZXApIHtcbiAgICAvKiBTaW1wbGlmaWNhdGlvbjogaWYgYW4gZXZlbnQgbW9kaWZpZXMgYSBxdWFsaXR5IHRoZW4gYXNzdW1lIHRoYXQgbGF0ZXIgcmVxdWlyZW1lbnRzXG4gICAgb24gdGhlIHNhbWUgcXVhbGl0eSBhcmUgcHJvYmFibHkgc2F0aXNmaWVkIGJ5IHRoYXQgbW9kaWZpY2F0aW9uIChlZywgd2hlbiBxdWFsaXRpZXNcbiAgICBhcmUgaW5jcmVtZW50ZWQvZGVjcmVtZW50ZWQgdG8gY29udHJvbCBzdG9yeS1xdWVzdCBwcm9ncmVzcykuICovXG4gICAgaWYoc3RlcC5xdWFsaXRpZXNBZmZlY3RlZCkge1xuICAgICAgc3RlcC5xdWFsaXRpZXNBZmZlY3RlZC5mb3JFYWNoKGZ1bmN0aW9uKGVmZmVjdCkge1xuICAgICAgICBkZWxldGUocmVxc1tlZmZlY3QuYXNzb2NpYXRlZFF1YWxpdHkuSWRdKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgICAvLyBOb3cgYWRkIGFueSByZXF1aXJlbWVudHMgZm9yIHRoZSBjdXJyZW50IHN0YWdlIChlYXJsaWVyIHJlcXVpcmVtZW50cyBvdmVyd3JpdGUgbGF0ZXIgb25lcyBvbiB0aGUgc2FtZSBxdWFsaXR5KVxuICAgIGlmKHN0ZXAucXVhbGl0aWVzUmVxdWlyZWQpIHtcbiAgICAgIHN0ZXAucXVhbGl0aWVzUmVxdWlyZWQuZm9yRWFjaChmdW5jdGlvbihyZXEpIHtcbiAgICAgICAgaWYocmVxLmFzc29jaWF0ZWRRdWFsaXR5KSB7IC8vIENoZWNrIHRoaXMgaXMgYSB2YWxpZCBRdWFsaXR5UmVxdWlyZW1lbnQsIGFuZCBub3Qgb25lIG9mIHRoZSBoYWxmLWZpbmlzaGVkIGRlYnVnIGVsZW1lbnRzIHJlZmVycmluZyB0byBhbm9uLWV4aXN0YW50IFF1YWxpdHlcbiAgICAgICAgICByZXFzW3JlcS5hc3NvY2lhdGVkUXVhbGl0eS5JZF0gPSByZXE7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cbiAgfSk7XG5cbiAgdmFyIHJlc3VsdCA9IE9iamVjdC5rZXlzKHJlcXMpLm1hcChmdW5jdGlvbihrZXkpIHsgcmV0dXJuIHJlcXNba2V5XTsgfSk7XG5cbiAgcmV0dXJuIG5ldyBDbHVtcChyZXN1bHQsIGFwaS50eXBlcy5RdWFsaXR5UmVxdWlyZW1lbnQpO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgUm91dGVOb2RlOiBSb3V0ZU5vZGUsXG4gIHBhdGhzVG9Ob2RlVUk6IHBhdGhzVG9Ob2RlVUksXG4gIHBhdGhzVG9Ob2RlOiBwYXRoc1RvTm9kZSxcbiAgZmlsdGVyUGF0aHNUb05vZGU6IGZpbHRlclBhdGhzVG9Ob2RlLFxuICByZW5kZXJQYXRoc1RvTm9kZTogcmVuZGVyUGF0aHNUb05vZGUsXG4gIGRlc2NyaWJlUm91dGU6IGRlc2NyaWJlUm91dGUsXG4gIGRldGFpbFJvdXRlOiBkZXRhaWxSb3V0ZSxcbiAgZ2V0Um91dGVSZXF1aXJlbWVudHM6IGdldFJvdXRlUmVxdWlyZW1lbnRzXG59OyIsInZhciBhcGkgPSByZXF1aXJlKCcuLi9hcGknKTtcblxuZnVuY3Rpb24gcmVuZGVyTGlzdHMoKSB7XG4gIE9iamVjdC5rZXlzKGFwaS5sb2FkZWQpLmZvckVhY2goZnVuY3Rpb24odHlwZSkge1xuICAgIHJlbmRlckxpc3QoYXBpLmxvYWRlZFt0eXBlXSk7IC8vIE9ubHkgZGlzcGxheSBkaXJlY3RseSBsb2FkZWQgKHJvb3QtbGV2ZWwpIEx1bXBzLCB0byBwcmV2ZW50IHRoZSBsaXN0IGJlY29taW5nIHVud2llbGR5XG4gIH0pO1xufVxuXG5mdW5jdGlvbiByZW5kZXJMaXN0KGNsdW1wKSB7XG5cdHZhciByb290ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoY2x1bXAudHlwZS5uYW1lLnRvTG93ZXJDYXNlKCkrXCItbGlzdFwiKTtcbiAgaWYocm9vdCkge1xuXHQgcm9vdC5hcHBlbmRDaGlsZChjbHVtcC50b0RvbSgpKTtcbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcblx0bGlzdDogcmVuZGVyTGlzdCxcblx0bGlzdHM6IHJlbmRlckxpc3RzXG59OyJdfQ==
