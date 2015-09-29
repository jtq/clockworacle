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
		"event": 500000,
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
},{"../../config.json":1,"./io":11,"./library":12,"./objects/area":13,"./objects/availability":14,"./objects/clump":15,"./objects/combat-attack":16,"./objects/event":17,"./objects/exchange":18,"./objects/interaction":19,"./objects/lump":20,"./objects/port":21,"./objects/quality":24,"./objects/quality-effect":22,"./objects/quality-requirement":23,"./objects/shop":25,"./objects/spawned-entity":26,"./objects/tile":28,"./objects/tile-variant":27}],11:[function(require,module,exports){

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
	
	//Deck
	//Setting
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
}
Object.keys(Lump.prototype).forEach(function(member) { Exchange.prototype[member] = Lump.prototype[member]; });

Exchange.prototype.wireUp = function(theApi) {

	api = theApi;

	this.shops = new Clump(this.attribs.Shops || [], api.types.Shop, this);
	var self = this;
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

	this.area = null;

}
Object.keys(Lump.prototype).forEach(function(member) { Port.prototype[member] = Lump.prototype[member]; });

Port.prototype.wireUp = function(theApi) {
	
	api = theApi;

	this.area = api.getOrCreate(api.types.Area, this.attribs.Area, this);

	var self = this;
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
},{"./clump":15,"./lump":20}],26:[function(require,module,exports){
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
},{"./clump":15,"./lump":20}],27:[function(require,module,exports){
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

	this.ports = new Clump(this.attribs.PortData || [], Port, this);

	this.areas = null;
}
Object.keys(Lump.prototype).forEach(function(member) { TileVariant.prototype[member] = Lump.prototype[member]; });

TileVariant.prototype.wireUp = function(theApi) {

	api = theApi;

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
},{"./area":13,"./clump":15,"./lump":20,"./port":21}],28:[function(require,module,exports){
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
},{"./area":13,"./clump":15,"./lump":20,"./port":21,"./tile-variant":27}],29:[function(require,module,exports){
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
},{"./api":10,"./ui/dragndrop":30,"./ui/query":31}],30:[function(require,module,exports){
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
},{"../api":10,"../io":11,"../objects/clump":15,"./render":32}],31:[function(require,module,exports){
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
  else if (node instanceof api.types.Port) {
    return new RouteNode(node.area);
  }
  else if(node.limitedToArea && node.limitedToArea.Id !== 101956) {
    var area_name = node.limitedToArea.Name.toLowerCase();
    var event_name = node.Name.toLowerCase();
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
},{"../api":10,"../objects/clump":15}],32:[function(require,module,exports){
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
},{"../api":10}]},{},[10,11,12,29])
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJjb25maWcuanNvbiIsIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L2xpYi9fZW1wdHkuanMiLCJub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnVmZmVyL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2J1ZmZlci9ub2RlX21vZHVsZXMvYmFzZTY0LWpzL2xpYi9iNjQuanMiLCJub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnVmZmVyL25vZGVfbW9kdWxlcy9pZWVlNzU0L2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2J1ZmZlci9ub2RlX21vZHVsZXMvaXMtYXJyYXkvaW5kZXguanMiLCJub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvZXZlbnRzL2V2ZW50cy5qcyIsIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9wcm9jZXNzL2Jyb3dzZXIuanMiLCJub2RlX21vZHVsZXMvZmlsZXJlYWRlci9GaWxlUmVhZGVyLmpzIiwic3JjL3NjcmlwdHMvYXBpLmpzIiwic3JjL3NjcmlwdHMvaW8uanMiLCJzcmMvc2NyaXB0cy9saWJyYXJ5LmpzIiwic3JjL3NjcmlwdHMvb2JqZWN0cy9hcmVhLmpzIiwic3JjL3NjcmlwdHMvb2JqZWN0cy9hdmFpbGFiaWxpdHkuanMiLCJzcmMvc2NyaXB0cy9vYmplY3RzL2NsdW1wLmpzIiwic3JjL3NjcmlwdHMvb2JqZWN0cy9jb21iYXQtYXR0YWNrLmpzIiwic3JjL3NjcmlwdHMvb2JqZWN0cy9ldmVudC5qcyIsInNyYy9zY3JpcHRzL29iamVjdHMvZXhjaGFuZ2UuanMiLCJzcmMvc2NyaXB0cy9vYmplY3RzL2ludGVyYWN0aW9uLmpzIiwic3JjL3NjcmlwdHMvb2JqZWN0cy9sdW1wLmpzIiwic3JjL3NjcmlwdHMvb2JqZWN0cy9wb3J0LmpzIiwic3JjL3NjcmlwdHMvb2JqZWN0cy9xdWFsaXR5LWVmZmVjdC5qcyIsInNyYy9zY3JpcHRzL29iamVjdHMvcXVhbGl0eS1yZXF1aXJlbWVudC5qcyIsInNyYy9zY3JpcHRzL29iamVjdHMvcXVhbGl0eS5qcyIsInNyYy9zY3JpcHRzL29iamVjdHMvc2hvcC5qcyIsInNyYy9zY3JpcHRzL29iamVjdHMvc3Bhd25lZC1lbnRpdHkuanMiLCJzcmMvc2NyaXB0cy9vYmplY3RzL3RpbGUtdmFyaWFudC5qcyIsInNyYy9zY3JpcHRzL29iamVjdHMvdGlsZS5qcyIsInNyYy9zY3JpcHRzL3VpLmpzIiwic3JjL3NjcmlwdHMvdWkvZHJhZ25kcm9wLmpzIiwic3JjL3NjcmlwdHMvdWkvcXVlcnkuanMiLCJzcmMvc2NyaXB0cy91aS9yZW5kZXIuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEJBOztBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzcvQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1SEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdTQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUMzRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUM1U0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNDQTs7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdFFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxSEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6SEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNUdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3RkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoSEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5RkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JUQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJtb2R1bGUuZXhwb3J0cz17XG5cdFwidGl0bGVcIjogXCJTdW5sZXNzIFNlYVwiLFxuXHRcInBhdGhzXCI6IHtcblx0XHRcInRlbXBsYXRlc1wiOiBcInNyYy90ZW1wbGF0ZXNcIixcblx0XHRcImJ1aWxkZGlyXCI6IHtcblx0XHRcdFwibW9kXCI6IFwiYnVpbGQvbW9kXCIsXG5cdFx0XHRcInVpXCI6IFwiYnVpbGQvdWlcIlxuXHRcdH1cblx0fSxcblx0XCJsb2NhdGlvbnNcIjoge1xuXHRcdFwiaW1hZ2VzUGF0aFwiOiBcIi4uLy4uL2dhbWUtZGF0YS9pY29uc1wiXG5cdH0sXG5cdFwiYmFzZUdhbWVJZHNcIjoge1xuXHRcdFwicXVhbGl0eVwiOiA0MTUwMDAsXG5cdFx0XCJldmVudFwiOiA1MDAwMDAsXG5cdFx0XCJhY3F1aXJlXCI6IDYwMDAwMCxcblx0XHRcImxlYXJuXCI6IDcwMDAwMCxcblx0XHRcInN1ZmZlclwiOiA4MDAwMDAsXG5cdFx0XCJiZWNvbWVcIjogOTAwMDAwXG5cdH1cbn0iLG51bGwsIi8qIVxuICogVGhlIGJ1ZmZlciBtb2R1bGUgZnJvbSBub2RlLmpzLCBmb3IgdGhlIGJyb3dzZXIuXG4gKlxuICogQGF1dGhvciAgIEZlcm9zcyBBYm91a2hhZGlqZWggPGZlcm9zc0BmZXJvc3Mub3JnPiA8aHR0cDovL2Zlcm9zcy5vcmc+XG4gKiBAbGljZW5zZSAgTUlUXG4gKi9cblxudmFyIGJhc2U2NCA9IHJlcXVpcmUoJ2Jhc2U2NC1qcycpXG52YXIgaWVlZTc1NCA9IHJlcXVpcmUoJ2llZWU3NTQnKVxudmFyIGlzQXJyYXkgPSByZXF1aXJlKCdpcy1hcnJheScpXG5cbmV4cG9ydHMuQnVmZmVyID0gQnVmZmVyXG5leHBvcnRzLlNsb3dCdWZmZXIgPSBTbG93QnVmZmVyXG5leHBvcnRzLklOU1BFQ1RfTUFYX0JZVEVTID0gNTBcbkJ1ZmZlci5wb29sU2l6ZSA9IDgxOTIgLy8gbm90IHVzZWQgYnkgdGhpcyBpbXBsZW1lbnRhdGlvblxuXG52YXIgcm9vdFBhcmVudCA9IHt9XG5cbi8qKlxuICogSWYgYEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUYDpcbiAqICAgPT09IHRydWUgICAgVXNlIFVpbnQ4QXJyYXkgaW1wbGVtZW50YXRpb24gKGZhc3Rlc3QpXG4gKiAgID09PSBmYWxzZSAgIFVzZSBPYmplY3QgaW1wbGVtZW50YXRpb24gKG1vc3QgY29tcGF0aWJsZSwgZXZlbiBJRTYpXG4gKlxuICogQnJvd3NlcnMgdGhhdCBzdXBwb3J0IHR5cGVkIGFycmF5cyBhcmUgSUUgMTArLCBGaXJlZm94IDQrLCBDaHJvbWUgNyssIFNhZmFyaSA1LjErLFxuICogT3BlcmEgMTEuNissIGlPUyA0LjIrLlxuICpcbiAqIER1ZSB0byB2YXJpb3VzIGJyb3dzZXIgYnVncywgc29tZXRpbWVzIHRoZSBPYmplY3QgaW1wbGVtZW50YXRpb24gd2lsbCBiZSB1c2VkIGV2ZW5cbiAqIHdoZW4gdGhlIGJyb3dzZXIgc3VwcG9ydHMgdHlwZWQgYXJyYXlzLlxuICpcbiAqIE5vdGU6XG4gKlxuICogICAtIEZpcmVmb3ggNC0yOSBsYWNrcyBzdXBwb3J0IGZvciBhZGRpbmcgbmV3IHByb3BlcnRpZXMgdG8gYFVpbnQ4QXJyYXlgIGluc3RhbmNlcyxcbiAqICAgICBTZWU6IGh0dHBzOi8vYnVnemlsbGEubW96aWxsYS5vcmcvc2hvd19idWcuY2dpP2lkPTY5NTQzOC5cbiAqXG4gKiAgIC0gU2FmYXJpIDUtNyBsYWNrcyBzdXBwb3J0IGZvciBjaGFuZ2luZyB0aGUgYE9iamVjdC5wcm90b3R5cGUuY29uc3RydWN0b3JgIHByb3BlcnR5XG4gKiAgICAgb24gb2JqZWN0cy5cbiAqXG4gKiAgIC0gQ2hyb21lIDktMTAgaXMgbWlzc2luZyB0aGUgYFR5cGVkQXJyYXkucHJvdG90eXBlLnN1YmFycmF5YCBmdW5jdGlvbi5cbiAqXG4gKiAgIC0gSUUxMCBoYXMgYSBicm9rZW4gYFR5cGVkQXJyYXkucHJvdG90eXBlLnN1YmFycmF5YCBmdW5jdGlvbiB3aGljaCByZXR1cm5zIGFycmF5cyBvZlxuICogICAgIGluY29ycmVjdCBsZW5ndGggaW4gc29tZSBzaXR1YXRpb25zLlxuXG4gKiBXZSBkZXRlY3QgdGhlc2UgYnVnZ3kgYnJvd3NlcnMgYW5kIHNldCBgQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlRgIHRvIGBmYWxzZWAgc28gdGhleVxuICogZ2V0IHRoZSBPYmplY3QgaW1wbGVtZW50YXRpb24sIHdoaWNoIGlzIHNsb3dlciBidXQgYmVoYXZlcyBjb3JyZWN0bHkuXG4gKi9cbkJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUID0gKGZ1bmN0aW9uICgpIHtcbiAgZnVuY3Rpb24gQmFyICgpIHt9XG4gIHRyeSB7XG4gICAgdmFyIGFyciA9IG5ldyBVaW50OEFycmF5KDEpXG4gICAgYXJyLmZvbyA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuIDQyIH1cbiAgICBhcnIuY29uc3RydWN0b3IgPSBCYXJcbiAgICByZXR1cm4gYXJyLmZvbygpID09PSA0MiAmJiAvLyB0eXBlZCBhcnJheSBpbnN0YW5jZXMgY2FuIGJlIGF1Z21lbnRlZFxuICAgICAgICBhcnIuY29uc3RydWN0b3IgPT09IEJhciAmJiAvLyBjb25zdHJ1Y3RvciBjYW4gYmUgc2V0XG4gICAgICAgIHR5cGVvZiBhcnIuc3ViYXJyYXkgPT09ICdmdW5jdGlvbicgJiYgLy8gY2hyb21lIDktMTAgbGFjayBgc3ViYXJyYXlgXG4gICAgICAgIGFyci5zdWJhcnJheSgxLCAxKS5ieXRlTGVuZ3RoID09PSAwIC8vIGllMTAgaGFzIGJyb2tlbiBgc3ViYXJyYXlgXG4gIH0gY2F0Y2ggKGUpIHtcbiAgICByZXR1cm4gZmFsc2VcbiAgfVxufSkoKVxuXG5mdW5jdGlvbiBrTWF4TGVuZ3RoICgpIHtcbiAgcmV0dXJuIEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUXG4gICAgPyAweDdmZmZmZmZmXG4gICAgOiAweDNmZmZmZmZmXG59XG5cbi8qKlxuICogQ2xhc3M6IEJ1ZmZlclxuICogPT09PT09PT09PT09PVxuICpcbiAqIFRoZSBCdWZmZXIgY29uc3RydWN0b3IgcmV0dXJucyBpbnN0YW5jZXMgb2YgYFVpbnQ4QXJyYXlgIHRoYXQgYXJlIGF1Z21lbnRlZFxuICogd2l0aCBmdW5jdGlvbiBwcm9wZXJ0aWVzIGZvciBhbGwgdGhlIG5vZGUgYEJ1ZmZlcmAgQVBJIGZ1bmN0aW9ucy4gV2UgdXNlXG4gKiBgVWludDhBcnJheWAgc28gdGhhdCBzcXVhcmUgYnJhY2tldCBub3RhdGlvbiB3b3JrcyBhcyBleHBlY3RlZCAtLSBpdCByZXR1cm5zXG4gKiBhIHNpbmdsZSBvY3RldC5cbiAqXG4gKiBCeSBhdWdtZW50aW5nIHRoZSBpbnN0YW5jZXMsIHdlIGNhbiBhdm9pZCBtb2RpZnlpbmcgdGhlIGBVaW50OEFycmF5YFxuICogcHJvdG90eXBlLlxuICovXG5mdW5jdGlvbiBCdWZmZXIgKGFyZykge1xuICBpZiAoISh0aGlzIGluc3RhbmNlb2YgQnVmZmVyKSkge1xuICAgIC8vIEF2b2lkIGdvaW5nIHRocm91Z2ggYW4gQXJndW1lbnRzQWRhcHRvclRyYW1wb2xpbmUgaW4gdGhlIGNvbW1vbiBjYXNlLlxuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID4gMSkgcmV0dXJuIG5ldyBCdWZmZXIoYXJnLCBhcmd1bWVudHNbMV0pXG4gICAgcmV0dXJuIG5ldyBCdWZmZXIoYXJnKVxuICB9XG5cbiAgdGhpcy5sZW5ndGggPSAwXG4gIHRoaXMucGFyZW50ID0gdW5kZWZpbmVkXG5cbiAgLy8gQ29tbW9uIGNhc2UuXG4gIGlmICh0eXBlb2YgYXJnID09PSAnbnVtYmVyJykge1xuICAgIHJldHVybiBmcm9tTnVtYmVyKHRoaXMsIGFyZylcbiAgfVxuXG4gIC8vIFNsaWdodGx5IGxlc3MgY29tbW9uIGNhc2UuXG4gIGlmICh0eXBlb2YgYXJnID09PSAnc3RyaW5nJykge1xuICAgIHJldHVybiBmcm9tU3RyaW5nKHRoaXMsIGFyZywgYXJndW1lbnRzLmxlbmd0aCA+IDEgPyBhcmd1bWVudHNbMV0gOiAndXRmOCcpXG4gIH1cblxuICAvLyBVbnVzdWFsLlxuICByZXR1cm4gZnJvbU9iamVjdCh0aGlzLCBhcmcpXG59XG5cbmZ1bmN0aW9uIGZyb21OdW1iZXIgKHRoYXQsIGxlbmd0aCkge1xuICB0aGF0ID0gYWxsb2NhdGUodGhhdCwgbGVuZ3RoIDwgMCA/IDAgOiBjaGVja2VkKGxlbmd0aCkgfCAwKVxuICBpZiAoIUJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgdGhhdFtpXSA9IDBcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHRoYXRcbn1cblxuZnVuY3Rpb24gZnJvbVN0cmluZyAodGhhdCwgc3RyaW5nLCBlbmNvZGluZykge1xuICBpZiAodHlwZW9mIGVuY29kaW5nICE9PSAnc3RyaW5nJyB8fCBlbmNvZGluZyA9PT0gJycpIGVuY29kaW5nID0gJ3V0ZjgnXG5cbiAgLy8gQXNzdW1wdGlvbjogYnl0ZUxlbmd0aCgpIHJldHVybiB2YWx1ZSBpcyBhbHdheXMgPCBrTWF4TGVuZ3RoLlxuICB2YXIgbGVuZ3RoID0gYnl0ZUxlbmd0aChzdHJpbmcsIGVuY29kaW5nKSB8IDBcbiAgdGhhdCA9IGFsbG9jYXRlKHRoYXQsIGxlbmd0aClcblxuICB0aGF0LndyaXRlKHN0cmluZywgZW5jb2RpbmcpXG4gIHJldHVybiB0aGF0XG59XG5cbmZ1bmN0aW9uIGZyb21PYmplY3QgKHRoYXQsIG9iamVjdCkge1xuICBpZiAoQnVmZmVyLmlzQnVmZmVyKG9iamVjdCkpIHJldHVybiBmcm9tQnVmZmVyKHRoYXQsIG9iamVjdClcblxuICBpZiAoaXNBcnJheShvYmplY3QpKSByZXR1cm4gZnJvbUFycmF5KHRoYXQsIG9iamVjdClcblxuICBpZiAob2JqZWN0ID09IG51bGwpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdtdXN0IHN0YXJ0IHdpdGggbnVtYmVyLCBidWZmZXIsIGFycmF5IG9yIHN0cmluZycpXG4gIH1cblxuICBpZiAodHlwZW9mIEFycmF5QnVmZmVyICE9PSAndW5kZWZpbmVkJykge1xuICAgIGlmIChvYmplY3QuYnVmZmVyIGluc3RhbmNlb2YgQXJyYXlCdWZmZXIpIHtcbiAgICAgIHJldHVybiBmcm9tVHlwZWRBcnJheSh0aGF0LCBvYmplY3QpXG4gICAgfVxuICAgIGlmIChvYmplY3QgaW5zdGFuY2VvZiBBcnJheUJ1ZmZlcikge1xuICAgICAgcmV0dXJuIGZyb21BcnJheUJ1ZmZlcih0aGF0LCBvYmplY3QpXG4gICAgfVxuICB9XG5cbiAgaWYgKG9iamVjdC5sZW5ndGgpIHJldHVybiBmcm9tQXJyYXlMaWtlKHRoYXQsIG9iamVjdClcblxuICByZXR1cm4gZnJvbUpzb25PYmplY3QodGhhdCwgb2JqZWN0KVxufVxuXG5mdW5jdGlvbiBmcm9tQnVmZmVyICh0aGF0LCBidWZmZXIpIHtcbiAgdmFyIGxlbmd0aCA9IGNoZWNrZWQoYnVmZmVyLmxlbmd0aCkgfCAwXG4gIHRoYXQgPSBhbGxvY2F0ZSh0aGF0LCBsZW5ndGgpXG4gIGJ1ZmZlci5jb3B5KHRoYXQsIDAsIDAsIGxlbmd0aClcbiAgcmV0dXJuIHRoYXRcbn1cblxuZnVuY3Rpb24gZnJvbUFycmF5ICh0aGF0LCBhcnJheSkge1xuICB2YXIgbGVuZ3RoID0gY2hlY2tlZChhcnJheS5sZW5ndGgpIHwgMFxuICB0aGF0ID0gYWxsb2NhdGUodGhhdCwgbGVuZ3RoKVxuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSArPSAxKSB7XG4gICAgdGhhdFtpXSA9IGFycmF5W2ldICYgMjU1XG4gIH1cbiAgcmV0dXJuIHRoYXRcbn1cblxuLy8gRHVwbGljYXRlIG9mIGZyb21BcnJheSgpIHRvIGtlZXAgZnJvbUFycmF5KCkgbW9ub21vcnBoaWMuXG5mdW5jdGlvbiBmcm9tVHlwZWRBcnJheSAodGhhdCwgYXJyYXkpIHtcbiAgdmFyIGxlbmd0aCA9IGNoZWNrZWQoYXJyYXkubGVuZ3RoKSB8IDBcbiAgdGhhdCA9IGFsbG9jYXRlKHRoYXQsIGxlbmd0aClcbiAgLy8gVHJ1bmNhdGluZyB0aGUgZWxlbWVudHMgaXMgcHJvYmFibHkgbm90IHdoYXQgcGVvcGxlIGV4cGVjdCBmcm9tIHR5cGVkXG4gIC8vIGFycmF5cyB3aXRoIEJZVEVTX1BFUl9FTEVNRU5UID4gMSBidXQgaXQncyBjb21wYXRpYmxlIHdpdGggdGhlIGJlaGF2aW9yXG4gIC8vIG9mIHRoZSBvbGQgQnVmZmVyIGNvbnN0cnVjdG9yLlxuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSArPSAxKSB7XG4gICAgdGhhdFtpXSA9IGFycmF5W2ldICYgMjU1XG4gIH1cbiAgcmV0dXJuIHRoYXRcbn1cblxuZnVuY3Rpb24gZnJvbUFycmF5QnVmZmVyICh0aGF0LCBhcnJheSkge1xuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICAvLyBSZXR1cm4gYW4gYXVnbWVudGVkIGBVaW50OEFycmF5YCBpbnN0YW5jZSwgZm9yIGJlc3QgcGVyZm9ybWFuY2VcbiAgICBhcnJheS5ieXRlTGVuZ3RoXG4gICAgdGhhdCA9IEJ1ZmZlci5fYXVnbWVudChuZXcgVWludDhBcnJheShhcnJheSkpXG4gIH0gZWxzZSB7XG4gICAgLy8gRmFsbGJhY2s6IFJldHVybiBhbiBvYmplY3QgaW5zdGFuY2Ugb2YgdGhlIEJ1ZmZlciBjbGFzc1xuICAgIHRoYXQgPSBmcm9tVHlwZWRBcnJheSh0aGF0LCBuZXcgVWludDhBcnJheShhcnJheSkpXG4gIH1cbiAgcmV0dXJuIHRoYXRcbn1cblxuZnVuY3Rpb24gZnJvbUFycmF5TGlrZSAodGhhdCwgYXJyYXkpIHtcbiAgdmFyIGxlbmd0aCA9IGNoZWNrZWQoYXJyYXkubGVuZ3RoKSB8IDBcbiAgdGhhdCA9IGFsbG9jYXRlKHRoYXQsIGxlbmd0aClcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkgKz0gMSkge1xuICAgIHRoYXRbaV0gPSBhcnJheVtpXSAmIDI1NVxuICB9XG4gIHJldHVybiB0aGF0XG59XG5cbi8vIERlc2VyaWFsaXplIHsgdHlwZTogJ0J1ZmZlcicsIGRhdGE6IFsxLDIsMywuLi5dIH0gaW50byBhIEJ1ZmZlciBvYmplY3QuXG4vLyBSZXR1cm5zIGEgemVyby1sZW5ndGggYnVmZmVyIGZvciBpbnB1dHMgdGhhdCBkb24ndCBjb25mb3JtIHRvIHRoZSBzcGVjLlxuZnVuY3Rpb24gZnJvbUpzb25PYmplY3QgKHRoYXQsIG9iamVjdCkge1xuICB2YXIgYXJyYXlcbiAgdmFyIGxlbmd0aCA9IDBcblxuICBpZiAob2JqZWN0LnR5cGUgPT09ICdCdWZmZXInICYmIGlzQXJyYXkob2JqZWN0LmRhdGEpKSB7XG4gICAgYXJyYXkgPSBvYmplY3QuZGF0YVxuICAgIGxlbmd0aCA9IGNoZWNrZWQoYXJyYXkubGVuZ3RoKSB8IDBcbiAgfVxuICB0aGF0ID0gYWxsb2NhdGUodGhhdCwgbGVuZ3RoKVxuXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpICs9IDEpIHtcbiAgICB0aGF0W2ldID0gYXJyYXlbaV0gJiAyNTVcbiAgfVxuICByZXR1cm4gdGhhdFxufVxuXG5mdW5jdGlvbiBhbGxvY2F0ZSAodGhhdCwgbGVuZ3RoKSB7XG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIC8vIFJldHVybiBhbiBhdWdtZW50ZWQgYFVpbnQ4QXJyYXlgIGluc3RhbmNlLCBmb3IgYmVzdCBwZXJmb3JtYW5jZVxuICAgIHRoYXQgPSBCdWZmZXIuX2F1Z21lbnQobmV3IFVpbnQ4QXJyYXkobGVuZ3RoKSlcbiAgfSBlbHNlIHtcbiAgICAvLyBGYWxsYmFjazogUmV0dXJuIGFuIG9iamVjdCBpbnN0YW5jZSBvZiB0aGUgQnVmZmVyIGNsYXNzXG4gICAgdGhhdC5sZW5ndGggPSBsZW5ndGhcbiAgICB0aGF0Ll9pc0J1ZmZlciA9IHRydWVcbiAgfVxuXG4gIHZhciBmcm9tUG9vbCA9IGxlbmd0aCAhPT0gMCAmJiBsZW5ndGggPD0gQnVmZmVyLnBvb2xTaXplID4+PiAxXG4gIGlmIChmcm9tUG9vbCkgdGhhdC5wYXJlbnQgPSByb290UGFyZW50XG5cbiAgcmV0dXJuIHRoYXRcbn1cblxuZnVuY3Rpb24gY2hlY2tlZCAobGVuZ3RoKSB7XG4gIC8vIE5vdGU6IGNhbm5vdCB1c2UgYGxlbmd0aCA8IGtNYXhMZW5ndGhgIGhlcmUgYmVjYXVzZSB0aGF0IGZhaWxzIHdoZW5cbiAgLy8gbGVuZ3RoIGlzIE5hTiAod2hpY2ggaXMgb3RoZXJ3aXNlIGNvZXJjZWQgdG8gemVyby4pXG4gIGlmIChsZW5ndGggPj0ga01heExlbmd0aCgpKSB7XG4gICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ0F0dGVtcHQgdG8gYWxsb2NhdGUgQnVmZmVyIGxhcmdlciB0aGFuIG1heGltdW0gJyArXG4gICAgICAgICAgICAgICAgICAgICAgICAgJ3NpemU6IDB4JyArIGtNYXhMZW5ndGgoKS50b1N0cmluZygxNikgKyAnIGJ5dGVzJylcbiAgfVxuICByZXR1cm4gbGVuZ3RoIHwgMFxufVxuXG5mdW5jdGlvbiBTbG93QnVmZmVyIChzdWJqZWN0LCBlbmNvZGluZykge1xuICBpZiAoISh0aGlzIGluc3RhbmNlb2YgU2xvd0J1ZmZlcikpIHJldHVybiBuZXcgU2xvd0J1ZmZlcihzdWJqZWN0LCBlbmNvZGluZylcblxuICB2YXIgYnVmID0gbmV3IEJ1ZmZlcihzdWJqZWN0LCBlbmNvZGluZylcbiAgZGVsZXRlIGJ1Zi5wYXJlbnRcbiAgcmV0dXJuIGJ1ZlxufVxuXG5CdWZmZXIuaXNCdWZmZXIgPSBmdW5jdGlvbiBpc0J1ZmZlciAoYikge1xuICByZXR1cm4gISEoYiAhPSBudWxsICYmIGIuX2lzQnVmZmVyKVxufVxuXG5CdWZmZXIuY29tcGFyZSA9IGZ1bmN0aW9uIGNvbXBhcmUgKGEsIGIpIHtcbiAgaWYgKCFCdWZmZXIuaXNCdWZmZXIoYSkgfHwgIUJ1ZmZlci5pc0J1ZmZlcihiKSkge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ0FyZ3VtZW50cyBtdXN0IGJlIEJ1ZmZlcnMnKVxuICB9XG5cbiAgaWYgKGEgPT09IGIpIHJldHVybiAwXG5cbiAgdmFyIHggPSBhLmxlbmd0aFxuICB2YXIgeSA9IGIubGVuZ3RoXG5cbiAgdmFyIGkgPSAwXG4gIHZhciBsZW4gPSBNYXRoLm1pbih4LCB5KVxuICB3aGlsZSAoaSA8IGxlbikge1xuICAgIGlmIChhW2ldICE9PSBiW2ldKSBicmVha1xuXG4gICAgKytpXG4gIH1cblxuICBpZiAoaSAhPT0gbGVuKSB7XG4gICAgeCA9IGFbaV1cbiAgICB5ID0gYltpXVxuICB9XG5cbiAgaWYgKHggPCB5KSByZXR1cm4gLTFcbiAgaWYgKHkgPCB4KSByZXR1cm4gMVxuICByZXR1cm4gMFxufVxuXG5CdWZmZXIuaXNFbmNvZGluZyA9IGZ1bmN0aW9uIGlzRW5jb2RpbmcgKGVuY29kaW5nKSB7XG4gIHN3aXRjaCAoU3RyaW5nKGVuY29kaW5nKS50b0xvd2VyQ2FzZSgpKSB7XG4gICAgY2FzZSAnaGV4JzpcbiAgICBjYXNlICd1dGY4JzpcbiAgICBjYXNlICd1dGYtOCc6XG4gICAgY2FzZSAnYXNjaWknOlxuICAgIGNhc2UgJ2JpbmFyeSc6XG4gICAgY2FzZSAnYmFzZTY0JzpcbiAgICBjYXNlICdyYXcnOlxuICAgIGNhc2UgJ3VjczInOlxuICAgIGNhc2UgJ3Vjcy0yJzpcbiAgICBjYXNlICd1dGYxNmxlJzpcbiAgICBjYXNlICd1dGYtMTZsZSc6XG4gICAgICByZXR1cm4gdHJ1ZVxuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4gZmFsc2VcbiAgfVxufVxuXG5CdWZmZXIuY29uY2F0ID0gZnVuY3Rpb24gY29uY2F0IChsaXN0LCBsZW5ndGgpIHtcbiAgaWYgKCFpc0FycmF5KGxpc3QpKSB0aHJvdyBuZXcgVHlwZUVycm9yKCdsaXN0IGFyZ3VtZW50IG11c3QgYmUgYW4gQXJyYXkgb2YgQnVmZmVycy4nKVxuXG4gIGlmIChsaXN0Lmxlbmd0aCA9PT0gMCkge1xuICAgIHJldHVybiBuZXcgQnVmZmVyKDApXG4gIH1cblxuICB2YXIgaVxuICBpZiAobGVuZ3RoID09PSB1bmRlZmluZWQpIHtcbiAgICBsZW5ndGggPSAwXG4gICAgZm9yIChpID0gMDsgaSA8IGxpc3QubGVuZ3RoOyBpKyspIHtcbiAgICAgIGxlbmd0aCArPSBsaXN0W2ldLmxlbmd0aFxuICAgIH1cbiAgfVxuXG4gIHZhciBidWYgPSBuZXcgQnVmZmVyKGxlbmd0aClcbiAgdmFyIHBvcyA9IDBcbiAgZm9yIChpID0gMDsgaSA8IGxpc3QubGVuZ3RoOyBpKyspIHtcbiAgICB2YXIgaXRlbSA9IGxpc3RbaV1cbiAgICBpdGVtLmNvcHkoYnVmLCBwb3MpXG4gICAgcG9zICs9IGl0ZW0ubGVuZ3RoXG4gIH1cbiAgcmV0dXJuIGJ1ZlxufVxuXG5mdW5jdGlvbiBieXRlTGVuZ3RoIChzdHJpbmcsIGVuY29kaW5nKSB7XG4gIGlmICh0eXBlb2Ygc3RyaW5nICE9PSAnc3RyaW5nJykgc3RyaW5nID0gJycgKyBzdHJpbmdcblxuICB2YXIgbGVuID0gc3RyaW5nLmxlbmd0aFxuICBpZiAobGVuID09PSAwKSByZXR1cm4gMFxuXG4gIC8vIFVzZSBhIGZvciBsb29wIHRvIGF2b2lkIHJlY3Vyc2lvblxuICB2YXIgbG93ZXJlZENhc2UgPSBmYWxzZVxuICBmb3IgKDs7KSB7XG4gICAgc3dpdGNoIChlbmNvZGluZykge1xuICAgICAgY2FzZSAnYXNjaWknOlxuICAgICAgY2FzZSAnYmluYXJ5JzpcbiAgICAgIC8vIERlcHJlY2F0ZWRcbiAgICAgIGNhc2UgJ3Jhdyc6XG4gICAgICBjYXNlICdyYXdzJzpcbiAgICAgICAgcmV0dXJuIGxlblxuICAgICAgY2FzZSAndXRmOCc6XG4gICAgICBjYXNlICd1dGYtOCc6XG4gICAgICAgIHJldHVybiB1dGY4VG9CeXRlcyhzdHJpbmcpLmxlbmd0aFxuICAgICAgY2FzZSAndWNzMic6XG4gICAgICBjYXNlICd1Y3MtMic6XG4gICAgICBjYXNlICd1dGYxNmxlJzpcbiAgICAgIGNhc2UgJ3V0Zi0xNmxlJzpcbiAgICAgICAgcmV0dXJuIGxlbiAqIDJcbiAgICAgIGNhc2UgJ2hleCc6XG4gICAgICAgIHJldHVybiBsZW4gPj4+IDFcbiAgICAgIGNhc2UgJ2Jhc2U2NCc6XG4gICAgICAgIHJldHVybiBiYXNlNjRUb0J5dGVzKHN0cmluZykubGVuZ3RoXG4gICAgICBkZWZhdWx0OlxuICAgICAgICBpZiAobG93ZXJlZENhc2UpIHJldHVybiB1dGY4VG9CeXRlcyhzdHJpbmcpLmxlbmd0aCAvLyBhc3N1bWUgdXRmOFxuICAgICAgICBlbmNvZGluZyA9ICgnJyArIGVuY29kaW5nKS50b0xvd2VyQ2FzZSgpXG4gICAgICAgIGxvd2VyZWRDYXNlID0gdHJ1ZVxuICAgIH1cbiAgfVxufVxuQnVmZmVyLmJ5dGVMZW5ndGggPSBieXRlTGVuZ3RoXG5cbi8vIHByZS1zZXQgZm9yIHZhbHVlcyB0aGF0IG1heSBleGlzdCBpbiB0aGUgZnV0dXJlXG5CdWZmZXIucHJvdG90eXBlLmxlbmd0aCA9IHVuZGVmaW5lZFxuQnVmZmVyLnByb3RvdHlwZS5wYXJlbnQgPSB1bmRlZmluZWRcblxuZnVuY3Rpb24gc2xvd1RvU3RyaW5nIChlbmNvZGluZywgc3RhcnQsIGVuZCkge1xuICB2YXIgbG93ZXJlZENhc2UgPSBmYWxzZVxuXG4gIHN0YXJ0ID0gc3RhcnQgfCAwXG4gIGVuZCA9IGVuZCA9PT0gdW5kZWZpbmVkIHx8IGVuZCA9PT0gSW5maW5pdHkgPyB0aGlzLmxlbmd0aCA6IGVuZCB8IDBcblxuICBpZiAoIWVuY29kaW5nKSBlbmNvZGluZyA9ICd1dGY4J1xuICBpZiAoc3RhcnQgPCAwKSBzdGFydCA9IDBcbiAgaWYgKGVuZCA+IHRoaXMubGVuZ3RoKSBlbmQgPSB0aGlzLmxlbmd0aFxuICBpZiAoZW5kIDw9IHN0YXJ0KSByZXR1cm4gJydcblxuICB3aGlsZSAodHJ1ZSkge1xuICAgIHN3aXRjaCAoZW5jb2RpbmcpIHtcbiAgICAgIGNhc2UgJ2hleCc6XG4gICAgICAgIHJldHVybiBoZXhTbGljZSh0aGlzLCBzdGFydCwgZW5kKVxuXG4gICAgICBjYXNlICd1dGY4JzpcbiAgICAgIGNhc2UgJ3V0Zi04JzpcbiAgICAgICAgcmV0dXJuIHV0ZjhTbGljZSh0aGlzLCBzdGFydCwgZW5kKVxuXG4gICAgICBjYXNlICdhc2NpaSc6XG4gICAgICAgIHJldHVybiBhc2NpaVNsaWNlKHRoaXMsIHN0YXJ0LCBlbmQpXG5cbiAgICAgIGNhc2UgJ2JpbmFyeSc6XG4gICAgICAgIHJldHVybiBiaW5hcnlTbGljZSh0aGlzLCBzdGFydCwgZW5kKVxuXG4gICAgICBjYXNlICdiYXNlNjQnOlxuICAgICAgICByZXR1cm4gYmFzZTY0U2xpY2UodGhpcywgc3RhcnQsIGVuZClcblxuICAgICAgY2FzZSAndWNzMic6XG4gICAgICBjYXNlICd1Y3MtMic6XG4gICAgICBjYXNlICd1dGYxNmxlJzpcbiAgICAgIGNhc2UgJ3V0Zi0xNmxlJzpcbiAgICAgICAgcmV0dXJuIHV0ZjE2bGVTbGljZSh0aGlzLCBzdGFydCwgZW5kKVxuXG4gICAgICBkZWZhdWx0OlxuICAgICAgICBpZiAobG93ZXJlZENhc2UpIHRocm93IG5ldyBUeXBlRXJyb3IoJ1Vua25vd24gZW5jb2Rpbmc6ICcgKyBlbmNvZGluZylcbiAgICAgICAgZW5jb2RpbmcgPSAoZW5jb2RpbmcgKyAnJykudG9Mb3dlckNhc2UoKVxuICAgICAgICBsb3dlcmVkQ2FzZSA9IHRydWVcbiAgICB9XG4gIH1cbn1cblxuQnVmZmVyLnByb3RvdHlwZS50b1N0cmluZyA9IGZ1bmN0aW9uIHRvU3RyaW5nICgpIHtcbiAgdmFyIGxlbmd0aCA9IHRoaXMubGVuZ3RoIHwgMFxuICBpZiAobGVuZ3RoID09PSAwKSByZXR1cm4gJydcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApIHJldHVybiB1dGY4U2xpY2UodGhpcywgMCwgbGVuZ3RoKVxuICByZXR1cm4gc2xvd1RvU3RyaW5nLmFwcGx5KHRoaXMsIGFyZ3VtZW50cylcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5lcXVhbHMgPSBmdW5jdGlvbiBlcXVhbHMgKGIpIHtcbiAgaWYgKCFCdWZmZXIuaXNCdWZmZXIoYikpIHRocm93IG5ldyBUeXBlRXJyb3IoJ0FyZ3VtZW50IG11c3QgYmUgYSBCdWZmZXInKVxuICBpZiAodGhpcyA9PT0gYikgcmV0dXJuIHRydWVcbiAgcmV0dXJuIEJ1ZmZlci5jb21wYXJlKHRoaXMsIGIpID09PSAwXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUuaW5zcGVjdCA9IGZ1bmN0aW9uIGluc3BlY3QgKCkge1xuICB2YXIgc3RyID0gJydcbiAgdmFyIG1heCA9IGV4cG9ydHMuSU5TUEVDVF9NQVhfQllURVNcbiAgaWYgKHRoaXMubGVuZ3RoID4gMCkge1xuICAgIHN0ciA9IHRoaXMudG9TdHJpbmcoJ2hleCcsIDAsIG1heCkubWF0Y2goLy57Mn0vZykuam9pbignICcpXG4gICAgaWYgKHRoaXMubGVuZ3RoID4gbWF4KSBzdHIgKz0gJyAuLi4gJ1xuICB9XG4gIHJldHVybiAnPEJ1ZmZlciAnICsgc3RyICsgJz4nXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUuY29tcGFyZSA9IGZ1bmN0aW9uIGNvbXBhcmUgKGIpIHtcbiAgaWYgKCFCdWZmZXIuaXNCdWZmZXIoYikpIHRocm93IG5ldyBUeXBlRXJyb3IoJ0FyZ3VtZW50IG11c3QgYmUgYSBCdWZmZXInKVxuICBpZiAodGhpcyA9PT0gYikgcmV0dXJuIDBcbiAgcmV0dXJuIEJ1ZmZlci5jb21wYXJlKHRoaXMsIGIpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUuaW5kZXhPZiA9IGZ1bmN0aW9uIGluZGV4T2YgKHZhbCwgYnl0ZU9mZnNldCkge1xuICBpZiAoYnl0ZU9mZnNldCA+IDB4N2ZmZmZmZmYpIGJ5dGVPZmZzZXQgPSAweDdmZmZmZmZmXG4gIGVsc2UgaWYgKGJ5dGVPZmZzZXQgPCAtMHg4MDAwMDAwMCkgYnl0ZU9mZnNldCA9IC0weDgwMDAwMDAwXG4gIGJ5dGVPZmZzZXQgPj49IDBcblxuICBpZiAodGhpcy5sZW5ndGggPT09IDApIHJldHVybiAtMVxuICBpZiAoYnl0ZU9mZnNldCA+PSB0aGlzLmxlbmd0aCkgcmV0dXJuIC0xXG5cbiAgLy8gTmVnYXRpdmUgb2Zmc2V0cyBzdGFydCBmcm9tIHRoZSBlbmQgb2YgdGhlIGJ1ZmZlclxuICBpZiAoYnl0ZU9mZnNldCA8IDApIGJ5dGVPZmZzZXQgPSBNYXRoLm1heCh0aGlzLmxlbmd0aCArIGJ5dGVPZmZzZXQsIDApXG5cbiAgaWYgKHR5cGVvZiB2YWwgPT09ICdzdHJpbmcnKSB7XG4gICAgaWYgKHZhbC5sZW5ndGggPT09IDApIHJldHVybiAtMSAvLyBzcGVjaWFsIGNhc2U6IGxvb2tpbmcgZm9yIGVtcHR5IHN0cmluZyBhbHdheXMgZmFpbHNcbiAgICByZXR1cm4gU3RyaW5nLnByb3RvdHlwZS5pbmRleE9mLmNhbGwodGhpcywgdmFsLCBieXRlT2Zmc2V0KVxuICB9XG4gIGlmIChCdWZmZXIuaXNCdWZmZXIodmFsKSkge1xuICAgIHJldHVybiBhcnJheUluZGV4T2YodGhpcywgdmFsLCBieXRlT2Zmc2V0KVxuICB9XG4gIGlmICh0eXBlb2YgdmFsID09PSAnbnVtYmVyJykge1xuICAgIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCAmJiBVaW50OEFycmF5LnByb3RvdHlwZS5pbmRleE9mID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICByZXR1cm4gVWludDhBcnJheS5wcm90b3R5cGUuaW5kZXhPZi5jYWxsKHRoaXMsIHZhbCwgYnl0ZU9mZnNldClcbiAgICB9XG4gICAgcmV0dXJuIGFycmF5SW5kZXhPZih0aGlzLCBbIHZhbCBdLCBieXRlT2Zmc2V0KVxuICB9XG5cbiAgZnVuY3Rpb24gYXJyYXlJbmRleE9mIChhcnIsIHZhbCwgYnl0ZU9mZnNldCkge1xuICAgIHZhciBmb3VuZEluZGV4ID0gLTFcbiAgICBmb3IgKHZhciBpID0gMDsgYnl0ZU9mZnNldCArIGkgPCBhcnIubGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmIChhcnJbYnl0ZU9mZnNldCArIGldID09PSB2YWxbZm91bmRJbmRleCA9PT0gLTEgPyAwIDogaSAtIGZvdW5kSW5kZXhdKSB7XG4gICAgICAgIGlmIChmb3VuZEluZGV4ID09PSAtMSkgZm91bmRJbmRleCA9IGlcbiAgICAgICAgaWYgKGkgLSBmb3VuZEluZGV4ICsgMSA9PT0gdmFsLmxlbmd0aCkgcmV0dXJuIGJ5dGVPZmZzZXQgKyBmb3VuZEluZGV4XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBmb3VuZEluZGV4ID0gLTFcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIC0xXG4gIH1cblxuICB0aHJvdyBuZXcgVHlwZUVycm9yKCd2YWwgbXVzdCBiZSBzdHJpbmcsIG51bWJlciBvciBCdWZmZXInKVxufVxuXG4vLyBgZ2V0YCBpcyBkZXByZWNhdGVkXG5CdWZmZXIucHJvdG90eXBlLmdldCA9IGZ1bmN0aW9uIGdldCAob2Zmc2V0KSB7XG4gIGNvbnNvbGUubG9nKCcuZ2V0KCkgaXMgZGVwcmVjYXRlZC4gQWNjZXNzIHVzaW5nIGFycmF5IGluZGV4ZXMgaW5zdGVhZC4nKVxuICByZXR1cm4gdGhpcy5yZWFkVUludDgob2Zmc2V0KVxufVxuXG4vLyBgc2V0YCBpcyBkZXByZWNhdGVkXG5CdWZmZXIucHJvdG90eXBlLnNldCA9IGZ1bmN0aW9uIHNldCAodiwgb2Zmc2V0KSB7XG4gIGNvbnNvbGUubG9nKCcuc2V0KCkgaXMgZGVwcmVjYXRlZC4gQWNjZXNzIHVzaW5nIGFycmF5IGluZGV4ZXMgaW5zdGVhZC4nKVxuICByZXR1cm4gdGhpcy53cml0ZVVJbnQ4KHYsIG9mZnNldClcbn1cblxuZnVuY3Rpb24gaGV4V3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICBvZmZzZXQgPSBOdW1iZXIob2Zmc2V0KSB8fCAwXG4gIHZhciByZW1haW5pbmcgPSBidWYubGVuZ3RoIC0gb2Zmc2V0XG4gIGlmICghbGVuZ3RoKSB7XG4gICAgbGVuZ3RoID0gcmVtYWluaW5nXG4gIH0gZWxzZSB7XG4gICAgbGVuZ3RoID0gTnVtYmVyKGxlbmd0aClcbiAgICBpZiAobGVuZ3RoID4gcmVtYWluaW5nKSB7XG4gICAgICBsZW5ndGggPSByZW1haW5pbmdcbiAgICB9XG4gIH1cblxuICAvLyBtdXN0IGJlIGFuIGV2ZW4gbnVtYmVyIG9mIGRpZ2l0c1xuICB2YXIgc3RyTGVuID0gc3RyaW5nLmxlbmd0aFxuICBpZiAoc3RyTGVuICUgMiAhPT0gMCkgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGhleCBzdHJpbmcnKVxuXG4gIGlmIChsZW5ndGggPiBzdHJMZW4gLyAyKSB7XG4gICAgbGVuZ3RoID0gc3RyTGVuIC8gMlxuICB9XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICB2YXIgcGFyc2VkID0gcGFyc2VJbnQoc3RyaW5nLnN1YnN0cihpICogMiwgMiksIDE2KVxuICAgIGlmIChpc05hTihwYXJzZWQpKSB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgaGV4IHN0cmluZycpXG4gICAgYnVmW29mZnNldCArIGldID0gcGFyc2VkXG4gIH1cbiAgcmV0dXJuIGlcbn1cblxuZnVuY3Rpb24gdXRmOFdyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgcmV0dXJuIGJsaXRCdWZmZXIodXRmOFRvQnl0ZXMoc3RyaW5nLCBidWYubGVuZ3RoIC0gb2Zmc2V0KSwgYnVmLCBvZmZzZXQsIGxlbmd0aClcbn1cblxuZnVuY3Rpb24gYXNjaWlXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIHJldHVybiBibGl0QnVmZmVyKGFzY2lpVG9CeXRlcyhzdHJpbmcpLCBidWYsIG9mZnNldCwgbGVuZ3RoKVxufVxuXG5mdW5jdGlvbiBiaW5hcnlXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIHJldHVybiBhc2NpaVdyaXRlKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcbn1cblxuZnVuY3Rpb24gYmFzZTY0V3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICByZXR1cm4gYmxpdEJ1ZmZlcihiYXNlNjRUb0J5dGVzKHN0cmluZyksIGJ1Ziwgb2Zmc2V0LCBsZW5ndGgpXG59XG5cbmZ1bmN0aW9uIHVjczJXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIHJldHVybiBibGl0QnVmZmVyKHV0ZjE2bGVUb0J5dGVzKHN0cmluZywgYnVmLmxlbmd0aCAtIG9mZnNldCksIGJ1Ziwgb2Zmc2V0LCBsZW5ndGgpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGUgPSBmdW5jdGlvbiB3cml0ZSAoc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCwgZW5jb2RpbmcpIHtcbiAgLy8gQnVmZmVyI3dyaXRlKHN0cmluZylcbiAgaWYgKG9mZnNldCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgZW5jb2RpbmcgPSAndXRmOCdcbiAgICBsZW5ndGggPSB0aGlzLmxlbmd0aFxuICAgIG9mZnNldCA9IDBcbiAgLy8gQnVmZmVyI3dyaXRlKHN0cmluZywgZW5jb2RpbmcpXG4gIH0gZWxzZSBpZiAobGVuZ3RoID09PSB1bmRlZmluZWQgJiYgdHlwZW9mIG9mZnNldCA9PT0gJ3N0cmluZycpIHtcbiAgICBlbmNvZGluZyA9IG9mZnNldFxuICAgIGxlbmd0aCA9IHRoaXMubGVuZ3RoXG4gICAgb2Zmc2V0ID0gMFxuICAvLyBCdWZmZXIjd3JpdGUoc3RyaW5nLCBvZmZzZXRbLCBsZW5ndGhdWywgZW5jb2RpbmddKVxuICB9IGVsc2UgaWYgKGlzRmluaXRlKG9mZnNldCkpIHtcbiAgICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gICAgaWYgKGlzRmluaXRlKGxlbmd0aCkpIHtcbiAgICAgIGxlbmd0aCA9IGxlbmd0aCB8IDBcbiAgICAgIGlmIChlbmNvZGluZyA9PT0gdW5kZWZpbmVkKSBlbmNvZGluZyA9ICd1dGY4J1xuICAgIH0gZWxzZSB7XG4gICAgICBlbmNvZGluZyA9IGxlbmd0aFxuICAgICAgbGVuZ3RoID0gdW5kZWZpbmVkXG4gICAgfVxuICAvLyBsZWdhY3kgd3JpdGUoc3RyaW5nLCBlbmNvZGluZywgb2Zmc2V0LCBsZW5ndGgpIC0gcmVtb3ZlIGluIHYwLjEzXG4gIH0gZWxzZSB7XG4gICAgdmFyIHN3YXAgPSBlbmNvZGluZ1xuICAgIGVuY29kaW5nID0gb2Zmc2V0XG4gICAgb2Zmc2V0ID0gbGVuZ3RoIHwgMFxuICAgIGxlbmd0aCA9IHN3YXBcbiAgfVxuXG4gIHZhciByZW1haW5pbmcgPSB0aGlzLmxlbmd0aCAtIG9mZnNldFxuICBpZiAobGVuZ3RoID09PSB1bmRlZmluZWQgfHwgbGVuZ3RoID4gcmVtYWluaW5nKSBsZW5ndGggPSByZW1haW5pbmdcblxuICBpZiAoKHN0cmluZy5sZW5ndGggPiAwICYmIChsZW5ndGggPCAwIHx8IG9mZnNldCA8IDApKSB8fCBvZmZzZXQgPiB0aGlzLmxlbmd0aCkge1xuICAgIHRocm93IG5ldyBSYW5nZUVycm9yKCdhdHRlbXB0IHRvIHdyaXRlIG91dHNpZGUgYnVmZmVyIGJvdW5kcycpXG4gIH1cblxuICBpZiAoIWVuY29kaW5nKSBlbmNvZGluZyA9ICd1dGY4J1xuXG4gIHZhciBsb3dlcmVkQ2FzZSA9IGZhbHNlXG4gIGZvciAoOzspIHtcbiAgICBzd2l0Y2ggKGVuY29kaW5nKSB7XG4gICAgICBjYXNlICdoZXgnOlxuICAgICAgICByZXR1cm4gaGV4V3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcblxuICAgICAgY2FzZSAndXRmOCc6XG4gICAgICBjYXNlICd1dGYtOCc6XG4gICAgICAgIHJldHVybiB1dGY4V3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcblxuICAgICAgY2FzZSAnYXNjaWknOlxuICAgICAgICByZXR1cm4gYXNjaWlXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuXG4gICAgICBjYXNlICdiaW5hcnknOlxuICAgICAgICByZXR1cm4gYmluYXJ5V3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcblxuICAgICAgY2FzZSAnYmFzZTY0JzpcbiAgICAgICAgLy8gV2FybmluZzogbWF4TGVuZ3RoIG5vdCB0YWtlbiBpbnRvIGFjY291bnQgaW4gYmFzZTY0V3JpdGVcbiAgICAgICAgcmV0dXJuIGJhc2U2NFdyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG5cbiAgICAgIGNhc2UgJ3VjczInOlxuICAgICAgY2FzZSAndWNzLTInOlxuICAgICAgY2FzZSAndXRmMTZsZSc6XG4gICAgICBjYXNlICd1dGYtMTZsZSc6XG4gICAgICAgIHJldHVybiB1Y3MyV3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcblxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgaWYgKGxvd2VyZWRDYXNlKSB0aHJvdyBuZXcgVHlwZUVycm9yKCdVbmtub3duIGVuY29kaW5nOiAnICsgZW5jb2RpbmcpXG4gICAgICAgIGVuY29kaW5nID0gKCcnICsgZW5jb2RpbmcpLnRvTG93ZXJDYXNlKClcbiAgICAgICAgbG93ZXJlZENhc2UgPSB0cnVlXG4gICAgfVxuICB9XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUudG9KU09OID0gZnVuY3Rpb24gdG9KU09OICgpIHtcbiAgcmV0dXJuIHtcbiAgICB0eXBlOiAnQnVmZmVyJyxcbiAgICBkYXRhOiBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbCh0aGlzLl9hcnIgfHwgdGhpcywgMClcbiAgfVxufVxuXG5mdW5jdGlvbiBiYXNlNjRTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIGlmIChzdGFydCA9PT0gMCAmJiBlbmQgPT09IGJ1Zi5sZW5ndGgpIHtcbiAgICByZXR1cm4gYmFzZTY0LmZyb21CeXRlQXJyYXkoYnVmKVxuICB9IGVsc2Uge1xuICAgIHJldHVybiBiYXNlNjQuZnJvbUJ5dGVBcnJheShidWYuc2xpY2Uoc3RhcnQsIGVuZCkpXG4gIH1cbn1cblxuZnVuY3Rpb24gdXRmOFNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgZW5kID0gTWF0aC5taW4oYnVmLmxlbmd0aCwgZW5kKVxuICB2YXIgcmVzID0gW11cblxuICB2YXIgaSA9IHN0YXJ0XG4gIHdoaWxlIChpIDwgZW5kKSB7XG4gICAgdmFyIGZpcnN0Qnl0ZSA9IGJ1ZltpXVxuICAgIHZhciBjb2RlUG9pbnQgPSBudWxsXG4gICAgdmFyIGJ5dGVzUGVyU2VxdWVuY2UgPSAoZmlyc3RCeXRlID4gMHhFRikgPyA0XG4gICAgICA6IChmaXJzdEJ5dGUgPiAweERGKSA/IDNcbiAgICAgIDogKGZpcnN0Qnl0ZSA+IDB4QkYpID8gMlxuICAgICAgOiAxXG5cbiAgICBpZiAoaSArIGJ5dGVzUGVyU2VxdWVuY2UgPD0gZW5kKSB7XG4gICAgICB2YXIgc2Vjb25kQnl0ZSwgdGhpcmRCeXRlLCBmb3VydGhCeXRlLCB0ZW1wQ29kZVBvaW50XG5cbiAgICAgIHN3aXRjaCAoYnl0ZXNQZXJTZXF1ZW5jZSkge1xuICAgICAgICBjYXNlIDE6XG4gICAgICAgICAgaWYgKGZpcnN0Qnl0ZSA8IDB4ODApIHtcbiAgICAgICAgICAgIGNvZGVQb2ludCA9IGZpcnN0Qnl0ZVxuICAgICAgICAgIH1cbiAgICAgICAgICBicmVha1xuICAgICAgICBjYXNlIDI6XG4gICAgICAgICAgc2Vjb25kQnl0ZSA9IGJ1ZltpICsgMV1cbiAgICAgICAgICBpZiAoKHNlY29uZEJ5dGUgJiAweEMwKSA9PT0gMHg4MCkge1xuICAgICAgICAgICAgdGVtcENvZGVQb2ludCA9IChmaXJzdEJ5dGUgJiAweDFGKSA8PCAweDYgfCAoc2Vjb25kQnl0ZSAmIDB4M0YpXG4gICAgICAgICAgICBpZiAodGVtcENvZGVQb2ludCA+IDB4N0YpIHtcbiAgICAgICAgICAgICAgY29kZVBvaW50ID0gdGVtcENvZGVQb2ludFxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBicmVha1xuICAgICAgICBjYXNlIDM6XG4gICAgICAgICAgc2Vjb25kQnl0ZSA9IGJ1ZltpICsgMV1cbiAgICAgICAgICB0aGlyZEJ5dGUgPSBidWZbaSArIDJdXG4gICAgICAgICAgaWYgKChzZWNvbmRCeXRlICYgMHhDMCkgPT09IDB4ODAgJiYgKHRoaXJkQnl0ZSAmIDB4QzApID09PSAweDgwKSB7XG4gICAgICAgICAgICB0ZW1wQ29kZVBvaW50ID0gKGZpcnN0Qnl0ZSAmIDB4RikgPDwgMHhDIHwgKHNlY29uZEJ5dGUgJiAweDNGKSA8PCAweDYgfCAodGhpcmRCeXRlICYgMHgzRilcbiAgICAgICAgICAgIGlmICh0ZW1wQ29kZVBvaW50ID4gMHg3RkYgJiYgKHRlbXBDb2RlUG9pbnQgPCAweEQ4MDAgfHwgdGVtcENvZGVQb2ludCA+IDB4REZGRikpIHtcbiAgICAgICAgICAgICAgY29kZVBvaW50ID0gdGVtcENvZGVQb2ludFxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBicmVha1xuICAgICAgICBjYXNlIDQ6XG4gICAgICAgICAgc2Vjb25kQnl0ZSA9IGJ1ZltpICsgMV1cbiAgICAgICAgICB0aGlyZEJ5dGUgPSBidWZbaSArIDJdXG4gICAgICAgICAgZm91cnRoQnl0ZSA9IGJ1ZltpICsgM11cbiAgICAgICAgICBpZiAoKHNlY29uZEJ5dGUgJiAweEMwKSA9PT0gMHg4MCAmJiAodGhpcmRCeXRlICYgMHhDMCkgPT09IDB4ODAgJiYgKGZvdXJ0aEJ5dGUgJiAweEMwKSA9PT0gMHg4MCkge1xuICAgICAgICAgICAgdGVtcENvZGVQb2ludCA9IChmaXJzdEJ5dGUgJiAweEYpIDw8IDB4MTIgfCAoc2Vjb25kQnl0ZSAmIDB4M0YpIDw8IDB4QyB8ICh0aGlyZEJ5dGUgJiAweDNGKSA8PCAweDYgfCAoZm91cnRoQnl0ZSAmIDB4M0YpXG4gICAgICAgICAgICBpZiAodGVtcENvZGVQb2ludCA+IDB4RkZGRiAmJiB0ZW1wQ29kZVBvaW50IDwgMHgxMTAwMDApIHtcbiAgICAgICAgICAgICAgY29kZVBvaW50ID0gdGVtcENvZGVQb2ludFxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoY29kZVBvaW50ID09PSBudWxsKSB7XG4gICAgICAvLyB3ZSBkaWQgbm90IGdlbmVyYXRlIGEgdmFsaWQgY29kZVBvaW50IHNvIGluc2VydCBhXG4gICAgICAvLyByZXBsYWNlbWVudCBjaGFyIChVK0ZGRkQpIGFuZCBhZHZhbmNlIG9ubHkgMSBieXRlXG4gICAgICBjb2RlUG9pbnQgPSAweEZGRkRcbiAgICAgIGJ5dGVzUGVyU2VxdWVuY2UgPSAxXG4gICAgfSBlbHNlIGlmIChjb2RlUG9pbnQgPiAweEZGRkYpIHtcbiAgICAgIC8vIGVuY29kZSB0byB1dGYxNiAoc3Vycm9nYXRlIHBhaXIgZGFuY2UpXG4gICAgICBjb2RlUG9pbnQgLT0gMHgxMDAwMFxuICAgICAgcmVzLnB1c2goY29kZVBvaW50ID4+PiAxMCAmIDB4M0ZGIHwgMHhEODAwKVxuICAgICAgY29kZVBvaW50ID0gMHhEQzAwIHwgY29kZVBvaW50ICYgMHgzRkZcbiAgICB9XG5cbiAgICByZXMucHVzaChjb2RlUG9pbnQpXG4gICAgaSArPSBieXRlc1BlclNlcXVlbmNlXG4gIH1cblxuICByZXR1cm4gZGVjb2RlQ29kZVBvaW50c0FycmF5KHJlcylcbn1cblxuLy8gQmFzZWQgb24gaHR0cDovL3N0YWNrb3ZlcmZsb3cuY29tL2EvMjI3NDcyNzIvNjgwNzQyLCB0aGUgYnJvd3NlciB3aXRoXG4vLyB0aGUgbG93ZXN0IGxpbWl0IGlzIENocm9tZSwgd2l0aCAweDEwMDAwIGFyZ3MuXG4vLyBXZSBnbyAxIG1hZ25pdHVkZSBsZXNzLCBmb3Igc2FmZXR5XG52YXIgTUFYX0FSR1VNRU5UU19MRU5HVEggPSAweDEwMDBcblxuZnVuY3Rpb24gZGVjb2RlQ29kZVBvaW50c0FycmF5IChjb2RlUG9pbnRzKSB7XG4gIHZhciBsZW4gPSBjb2RlUG9pbnRzLmxlbmd0aFxuICBpZiAobGVuIDw9IE1BWF9BUkdVTUVOVFNfTEVOR1RIKSB7XG4gICAgcmV0dXJuIFN0cmluZy5mcm9tQ2hhckNvZGUuYXBwbHkoU3RyaW5nLCBjb2RlUG9pbnRzKSAvLyBhdm9pZCBleHRyYSBzbGljZSgpXG4gIH1cblxuICAvLyBEZWNvZGUgaW4gY2h1bmtzIHRvIGF2b2lkIFwiY2FsbCBzdGFjayBzaXplIGV4Y2VlZGVkXCIuXG4gIHZhciByZXMgPSAnJ1xuICB2YXIgaSA9IDBcbiAgd2hpbGUgKGkgPCBsZW4pIHtcbiAgICByZXMgKz0gU3RyaW5nLmZyb21DaGFyQ29kZS5hcHBseShcbiAgICAgIFN0cmluZyxcbiAgICAgIGNvZGVQb2ludHMuc2xpY2UoaSwgaSArPSBNQVhfQVJHVU1FTlRTX0xFTkdUSClcbiAgICApXG4gIH1cbiAgcmV0dXJuIHJlc1xufVxuXG5mdW5jdGlvbiBhc2NpaVNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIHJldCA9ICcnXG4gIGVuZCA9IE1hdGgubWluKGJ1Zi5sZW5ndGgsIGVuZClcblxuICBmb3IgKHZhciBpID0gc3RhcnQ7IGkgPCBlbmQ7IGkrKykge1xuICAgIHJldCArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGJ1ZltpXSAmIDB4N0YpXG4gIH1cbiAgcmV0dXJuIHJldFxufVxuXG5mdW5jdGlvbiBiaW5hcnlTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIHZhciByZXQgPSAnJ1xuICBlbmQgPSBNYXRoLm1pbihidWYubGVuZ3RoLCBlbmQpXG5cbiAgZm9yICh2YXIgaSA9IHN0YXJ0OyBpIDwgZW5kOyBpKyspIHtcbiAgICByZXQgKz0gU3RyaW5nLmZyb21DaGFyQ29kZShidWZbaV0pXG4gIH1cbiAgcmV0dXJuIHJldFxufVxuXG5mdW5jdGlvbiBoZXhTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIHZhciBsZW4gPSBidWYubGVuZ3RoXG5cbiAgaWYgKCFzdGFydCB8fCBzdGFydCA8IDApIHN0YXJ0ID0gMFxuICBpZiAoIWVuZCB8fCBlbmQgPCAwIHx8IGVuZCA+IGxlbikgZW5kID0gbGVuXG5cbiAgdmFyIG91dCA9ICcnXG4gIGZvciAodmFyIGkgPSBzdGFydDsgaSA8IGVuZDsgaSsrKSB7XG4gICAgb3V0ICs9IHRvSGV4KGJ1ZltpXSlcbiAgfVxuICByZXR1cm4gb3V0XG59XG5cbmZ1bmN0aW9uIHV0ZjE2bGVTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIHZhciBieXRlcyA9IGJ1Zi5zbGljZShzdGFydCwgZW5kKVxuICB2YXIgcmVzID0gJydcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBieXRlcy5sZW5ndGg7IGkgKz0gMikge1xuICAgIHJlcyArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGJ5dGVzW2ldICsgYnl0ZXNbaSArIDFdICogMjU2KVxuICB9XG4gIHJldHVybiByZXNcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5zbGljZSA9IGZ1bmN0aW9uIHNsaWNlIChzdGFydCwgZW5kKSB7XG4gIHZhciBsZW4gPSB0aGlzLmxlbmd0aFxuICBzdGFydCA9IH5+c3RhcnRcbiAgZW5kID0gZW5kID09PSB1bmRlZmluZWQgPyBsZW4gOiB+fmVuZFxuXG4gIGlmIChzdGFydCA8IDApIHtcbiAgICBzdGFydCArPSBsZW5cbiAgICBpZiAoc3RhcnQgPCAwKSBzdGFydCA9IDBcbiAgfSBlbHNlIGlmIChzdGFydCA+IGxlbikge1xuICAgIHN0YXJ0ID0gbGVuXG4gIH1cblxuICBpZiAoZW5kIDwgMCkge1xuICAgIGVuZCArPSBsZW5cbiAgICBpZiAoZW5kIDwgMCkgZW5kID0gMFxuICB9IGVsc2UgaWYgKGVuZCA+IGxlbikge1xuICAgIGVuZCA9IGxlblxuICB9XG5cbiAgaWYgKGVuZCA8IHN0YXJ0KSBlbmQgPSBzdGFydFxuXG4gIHZhciBuZXdCdWZcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgbmV3QnVmID0gQnVmZmVyLl9hdWdtZW50KHRoaXMuc3ViYXJyYXkoc3RhcnQsIGVuZCkpXG4gIH0gZWxzZSB7XG4gICAgdmFyIHNsaWNlTGVuID0gZW5kIC0gc3RhcnRcbiAgICBuZXdCdWYgPSBuZXcgQnVmZmVyKHNsaWNlTGVuLCB1bmRlZmluZWQpXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBzbGljZUxlbjsgaSsrKSB7XG4gICAgICBuZXdCdWZbaV0gPSB0aGlzW2kgKyBzdGFydF1cbiAgICB9XG4gIH1cblxuICBpZiAobmV3QnVmLmxlbmd0aCkgbmV3QnVmLnBhcmVudCA9IHRoaXMucGFyZW50IHx8IHRoaXNcblxuICByZXR1cm4gbmV3QnVmXG59XG5cbi8qXG4gKiBOZWVkIHRvIG1ha2Ugc3VyZSB0aGF0IGJ1ZmZlciBpc24ndCB0cnlpbmcgdG8gd3JpdGUgb3V0IG9mIGJvdW5kcy5cbiAqL1xuZnVuY3Rpb24gY2hlY2tPZmZzZXQgKG9mZnNldCwgZXh0LCBsZW5ndGgpIHtcbiAgaWYgKChvZmZzZXQgJSAxKSAhPT0gMCB8fCBvZmZzZXQgPCAwKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignb2Zmc2V0IGlzIG5vdCB1aW50JylcbiAgaWYgKG9mZnNldCArIGV4dCA+IGxlbmd0aCkgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ1RyeWluZyB0byBhY2Nlc3MgYmV5b25kIGJ1ZmZlciBsZW5ndGgnKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50TEUgPSBmdW5jdGlvbiByZWFkVUludExFIChvZmZzZXQsIGJ5dGVMZW5ndGgsIG5vQXNzZXJ0KSB7XG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgYnl0ZUxlbmd0aCA9IGJ5dGVMZW5ndGggfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgYnl0ZUxlbmd0aCwgdGhpcy5sZW5ndGgpXG5cbiAgdmFyIHZhbCA9IHRoaXNbb2Zmc2V0XVxuICB2YXIgbXVsID0gMVxuICB2YXIgaSA9IDBcbiAgd2hpbGUgKCsraSA8IGJ5dGVMZW5ndGggJiYgKG11bCAqPSAweDEwMCkpIHtcbiAgICB2YWwgKz0gdGhpc1tvZmZzZXQgKyBpXSAqIG11bFxuICB9XG5cbiAgcmV0dXJuIHZhbFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50QkUgPSBmdW5jdGlvbiByZWFkVUludEJFIChvZmZzZXQsIGJ5dGVMZW5ndGgsIG5vQXNzZXJ0KSB7XG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgYnl0ZUxlbmd0aCA9IGJ5dGVMZW5ndGggfCAwXG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBjaGVja09mZnNldChvZmZzZXQsIGJ5dGVMZW5ndGgsIHRoaXMubGVuZ3RoKVxuICB9XG5cbiAgdmFyIHZhbCA9IHRoaXNbb2Zmc2V0ICsgLS1ieXRlTGVuZ3RoXVxuICB2YXIgbXVsID0gMVxuICB3aGlsZSAoYnl0ZUxlbmd0aCA+IDAgJiYgKG11bCAqPSAweDEwMCkpIHtcbiAgICB2YWwgKz0gdGhpc1tvZmZzZXQgKyAtLWJ5dGVMZW5ndGhdICogbXVsXG4gIH1cblxuICByZXR1cm4gdmFsXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnQ4ID0gZnVuY3Rpb24gcmVhZFVJbnQ4IChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgMSwgdGhpcy5sZW5ndGgpXG4gIHJldHVybiB0aGlzW29mZnNldF1cbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDE2TEUgPSBmdW5jdGlvbiByZWFkVUludDE2TEUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCAyLCB0aGlzLmxlbmd0aClcbiAgcmV0dXJuIHRoaXNbb2Zmc2V0XSB8ICh0aGlzW29mZnNldCArIDFdIDw8IDgpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnQxNkJFID0gZnVuY3Rpb24gcmVhZFVJbnQxNkJFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgMiwgdGhpcy5sZW5ndGgpXG4gIHJldHVybiAodGhpc1tvZmZzZXRdIDw8IDgpIHwgdGhpc1tvZmZzZXQgKyAxXVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50MzJMRSA9IGZ1bmN0aW9uIHJlYWRVSW50MzJMRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDQsIHRoaXMubGVuZ3RoKVxuXG4gIHJldHVybiAoKHRoaXNbb2Zmc2V0XSkgfFxuICAgICAgKHRoaXNbb2Zmc2V0ICsgMV0gPDwgOCkgfFxuICAgICAgKHRoaXNbb2Zmc2V0ICsgMl0gPDwgMTYpKSArXG4gICAgICAodGhpc1tvZmZzZXQgKyAzXSAqIDB4MTAwMDAwMClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDMyQkUgPSBmdW5jdGlvbiByZWFkVUludDMyQkUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCA0LCB0aGlzLmxlbmd0aClcblxuICByZXR1cm4gKHRoaXNbb2Zmc2V0XSAqIDB4MTAwMDAwMCkgK1xuICAgICgodGhpc1tvZmZzZXQgKyAxXSA8PCAxNikgfFxuICAgICh0aGlzW29mZnNldCArIDJdIDw8IDgpIHxcbiAgICB0aGlzW29mZnNldCArIDNdKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnRMRSA9IGZ1bmN0aW9uIHJlYWRJbnRMRSAob2Zmc2V0LCBieXRlTGVuZ3RoLCBub0Fzc2VydCkge1xuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGJ5dGVMZW5ndGggPSBieXRlTGVuZ3RoIHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIGJ5dGVMZW5ndGgsIHRoaXMubGVuZ3RoKVxuXG4gIHZhciB2YWwgPSB0aGlzW29mZnNldF1cbiAgdmFyIG11bCA9IDFcbiAgdmFyIGkgPSAwXG4gIHdoaWxlICgrK2kgPCBieXRlTGVuZ3RoICYmIChtdWwgKj0gMHgxMDApKSB7XG4gICAgdmFsICs9IHRoaXNbb2Zmc2V0ICsgaV0gKiBtdWxcbiAgfVxuICBtdWwgKj0gMHg4MFxuXG4gIGlmICh2YWwgPj0gbXVsKSB2YWwgLT0gTWF0aC5wb3coMiwgOCAqIGJ5dGVMZW5ndGgpXG5cbiAgcmV0dXJuIHZhbFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnRCRSA9IGZ1bmN0aW9uIHJlYWRJbnRCRSAob2Zmc2V0LCBieXRlTGVuZ3RoLCBub0Fzc2VydCkge1xuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGJ5dGVMZW5ndGggPSBieXRlTGVuZ3RoIHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIGJ5dGVMZW5ndGgsIHRoaXMubGVuZ3RoKVxuXG4gIHZhciBpID0gYnl0ZUxlbmd0aFxuICB2YXIgbXVsID0gMVxuICB2YXIgdmFsID0gdGhpc1tvZmZzZXQgKyAtLWldXG4gIHdoaWxlIChpID4gMCAmJiAobXVsICo9IDB4MTAwKSkge1xuICAgIHZhbCArPSB0aGlzW29mZnNldCArIC0taV0gKiBtdWxcbiAgfVxuICBtdWwgKj0gMHg4MFxuXG4gIGlmICh2YWwgPj0gbXVsKSB2YWwgLT0gTWF0aC5wb3coMiwgOCAqIGJ5dGVMZW5ndGgpXG5cbiAgcmV0dXJuIHZhbFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnQ4ID0gZnVuY3Rpb24gcmVhZEludDggKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCAxLCB0aGlzLmxlbmd0aClcbiAgaWYgKCEodGhpc1tvZmZzZXRdICYgMHg4MCkpIHJldHVybiAodGhpc1tvZmZzZXRdKVxuICByZXR1cm4gKCgweGZmIC0gdGhpc1tvZmZzZXRdICsgMSkgKiAtMSlcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50MTZMRSA9IGZ1bmN0aW9uIHJlYWRJbnQxNkxFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgMiwgdGhpcy5sZW5ndGgpXG4gIHZhciB2YWwgPSB0aGlzW29mZnNldF0gfCAodGhpc1tvZmZzZXQgKyAxXSA8PCA4KVxuICByZXR1cm4gKHZhbCAmIDB4ODAwMCkgPyB2YWwgfCAweEZGRkYwMDAwIDogdmFsXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDE2QkUgPSBmdW5jdGlvbiByZWFkSW50MTZCRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDIsIHRoaXMubGVuZ3RoKVxuICB2YXIgdmFsID0gdGhpc1tvZmZzZXQgKyAxXSB8ICh0aGlzW29mZnNldF0gPDwgOClcbiAgcmV0dXJuICh2YWwgJiAweDgwMDApID8gdmFsIHwgMHhGRkZGMDAwMCA6IHZhbFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnQzMkxFID0gZnVuY3Rpb24gcmVhZEludDMyTEUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCA0LCB0aGlzLmxlbmd0aClcblxuICByZXR1cm4gKHRoaXNbb2Zmc2V0XSkgfFxuICAgICh0aGlzW29mZnNldCArIDFdIDw8IDgpIHxcbiAgICAodGhpc1tvZmZzZXQgKyAyXSA8PCAxNikgfFxuICAgICh0aGlzW29mZnNldCArIDNdIDw8IDI0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnQzMkJFID0gZnVuY3Rpb24gcmVhZEludDMyQkUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCA0LCB0aGlzLmxlbmd0aClcblxuICByZXR1cm4gKHRoaXNbb2Zmc2V0XSA8PCAyNCkgfFxuICAgICh0aGlzW29mZnNldCArIDFdIDw8IDE2KSB8XG4gICAgKHRoaXNbb2Zmc2V0ICsgMl0gPDwgOCkgfFxuICAgICh0aGlzW29mZnNldCArIDNdKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRGbG9hdExFID0gZnVuY3Rpb24gcmVhZEZsb2F0TEUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCA0LCB0aGlzLmxlbmd0aClcbiAgcmV0dXJuIGllZWU3NTQucmVhZCh0aGlzLCBvZmZzZXQsIHRydWUsIDIzLCA0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRGbG9hdEJFID0gZnVuY3Rpb24gcmVhZEZsb2F0QkUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCA0LCB0aGlzLmxlbmd0aClcbiAgcmV0dXJuIGllZWU3NTQucmVhZCh0aGlzLCBvZmZzZXQsIGZhbHNlLCAyMywgNClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkRG91YmxlTEUgPSBmdW5jdGlvbiByZWFkRG91YmxlTEUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCA4LCB0aGlzLmxlbmd0aClcbiAgcmV0dXJuIGllZWU3NTQucmVhZCh0aGlzLCBvZmZzZXQsIHRydWUsIDUyLCA4KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWREb3VibGVCRSA9IGZ1bmN0aW9uIHJlYWREb3VibGVCRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDgsIHRoaXMubGVuZ3RoKVxuICByZXR1cm4gaWVlZTc1NC5yZWFkKHRoaXMsIG9mZnNldCwgZmFsc2UsIDUyLCA4KVxufVxuXG5mdW5jdGlvbiBjaGVja0ludCAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBleHQsIG1heCwgbWluKSB7XG4gIGlmICghQnVmZmVyLmlzQnVmZmVyKGJ1ZikpIHRocm93IG5ldyBUeXBlRXJyb3IoJ2J1ZmZlciBtdXN0IGJlIGEgQnVmZmVyIGluc3RhbmNlJylcbiAgaWYgKHZhbHVlID4gbWF4IHx8IHZhbHVlIDwgbWluKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcigndmFsdWUgaXMgb3V0IG9mIGJvdW5kcycpXG4gIGlmIChvZmZzZXQgKyBleHQgPiBidWYubGVuZ3RoKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignaW5kZXggb3V0IG9mIHJhbmdlJylcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnRMRSA9IGZ1bmN0aW9uIHdyaXRlVUludExFICh2YWx1ZSwgb2Zmc2V0LCBieXRlTGVuZ3RoLCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGJ5dGVMZW5ndGggPSBieXRlTGVuZ3RoIHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBieXRlTGVuZ3RoLCBNYXRoLnBvdygyLCA4ICogYnl0ZUxlbmd0aCksIDApXG5cbiAgdmFyIG11bCA9IDFcbiAgdmFyIGkgPSAwXG4gIHRoaXNbb2Zmc2V0XSA9IHZhbHVlICYgMHhGRlxuICB3aGlsZSAoKytpIDwgYnl0ZUxlbmd0aCAmJiAobXVsICo9IDB4MTAwKSkge1xuICAgIHRoaXNbb2Zmc2V0ICsgaV0gPSAodmFsdWUgLyBtdWwpICYgMHhGRlxuICB9XG5cbiAgcmV0dXJuIG9mZnNldCArIGJ5dGVMZW5ndGhcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnRCRSA9IGZ1bmN0aW9uIHdyaXRlVUludEJFICh2YWx1ZSwgb2Zmc2V0LCBieXRlTGVuZ3RoLCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGJ5dGVMZW5ndGggPSBieXRlTGVuZ3RoIHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBieXRlTGVuZ3RoLCBNYXRoLnBvdygyLCA4ICogYnl0ZUxlbmd0aCksIDApXG5cbiAgdmFyIGkgPSBieXRlTGVuZ3RoIC0gMVxuICB2YXIgbXVsID0gMVxuICB0aGlzW29mZnNldCArIGldID0gdmFsdWUgJiAweEZGXG4gIHdoaWxlICgtLWkgPj0gMCAmJiAobXVsICo9IDB4MTAwKSkge1xuICAgIHRoaXNbb2Zmc2V0ICsgaV0gPSAodmFsdWUgLyBtdWwpICYgMHhGRlxuICB9XG5cbiAgcmV0dXJuIG9mZnNldCArIGJ5dGVMZW5ndGhcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnQ4ID0gZnVuY3Rpb24gd3JpdGVVSW50OCAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCAxLCAweGZmLCAwKVxuICBpZiAoIUJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB2YWx1ZSA9IE1hdGguZmxvb3IodmFsdWUpXG4gIHRoaXNbb2Zmc2V0XSA9IHZhbHVlXG4gIHJldHVybiBvZmZzZXQgKyAxXG59XG5cbmZ1bmN0aW9uIG9iamVjdFdyaXRlVUludDE2IChidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbikge1xuICBpZiAodmFsdWUgPCAwKSB2YWx1ZSA9IDB4ZmZmZiArIHZhbHVlICsgMVxuICBmb3IgKHZhciBpID0gMCwgaiA9IE1hdGgubWluKGJ1Zi5sZW5ndGggLSBvZmZzZXQsIDIpOyBpIDwgajsgaSsrKSB7XG4gICAgYnVmW29mZnNldCArIGldID0gKHZhbHVlICYgKDB4ZmYgPDwgKDggKiAobGl0dGxlRW5kaWFuID8gaSA6IDEgLSBpKSkpKSA+Pj5cbiAgICAgIChsaXR0bGVFbmRpYW4gPyBpIDogMSAtIGkpICogOFxuICB9XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50MTZMRSA9IGZ1bmN0aW9uIHdyaXRlVUludDE2TEUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgMiwgMHhmZmZmLCAwKVxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICB0aGlzW29mZnNldF0gPSB2YWx1ZVxuICAgIHRoaXNbb2Zmc2V0ICsgMV0gPSAodmFsdWUgPj4+IDgpXG4gIH0gZWxzZSB7XG4gICAgb2JqZWN0V3JpdGVVSW50MTYodGhpcywgdmFsdWUsIG9mZnNldCwgdHJ1ZSlcbiAgfVxuICByZXR1cm4gb2Zmc2V0ICsgMlxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludDE2QkUgPSBmdW5jdGlvbiB3cml0ZVVJbnQxNkJFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDIsIDB4ZmZmZiwgMClcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgdGhpc1tvZmZzZXRdID0gKHZhbHVlID4+PiA4KVxuICAgIHRoaXNbb2Zmc2V0ICsgMV0gPSB2YWx1ZVxuICB9IGVsc2Uge1xuICAgIG9iamVjdFdyaXRlVUludDE2KHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlKVxuICB9XG4gIHJldHVybiBvZmZzZXQgKyAyXG59XG5cbmZ1bmN0aW9uIG9iamVjdFdyaXRlVUludDMyIChidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbikge1xuICBpZiAodmFsdWUgPCAwKSB2YWx1ZSA9IDB4ZmZmZmZmZmYgKyB2YWx1ZSArIDFcbiAgZm9yICh2YXIgaSA9IDAsIGogPSBNYXRoLm1pbihidWYubGVuZ3RoIC0gb2Zmc2V0LCA0KTsgaSA8IGo7IGkrKykge1xuICAgIGJ1ZltvZmZzZXQgKyBpXSA9ICh2YWx1ZSA+Pj4gKGxpdHRsZUVuZGlhbiA/IGkgOiAzIC0gaSkgKiA4KSAmIDB4ZmZcbiAgfVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludDMyTEUgPSBmdW5jdGlvbiB3cml0ZVVJbnQzMkxFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDQsIDB4ZmZmZmZmZmYsIDApXG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIHRoaXNbb2Zmc2V0ICsgM10gPSAodmFsdWUgPj4+IDI0KVxuICAgIHRoaXNbb2Zmc2V0ICsgMl0gPSAodmFsdWUgPj4+IDE2KVxuICAgIHRoaXNbb2Zmc2V0ICsgMV0gPSAodmFsdWUgPj4+IDgpXG4gICAgdGhpc1tvZmZzZXRdID0gdmFsdWVcbiAgfSBlbHNlIHtcbiAgICBvYmplY3RXcml0ZVVJbnQzMih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCB0cnVlKVxuICB9XG4gIHJldHVybiBvZmZzZXQgKyA0XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50MzJCRSA9IGZ1bmN0aW9uIHdyaXRlVUludDMyQkUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgNCwgMHhmZmZmZmZmZiwgMClcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgdGhpc1tvZmZzZXRdID0gKHZhbHVlID4+PiAyNClcbiAgICB0aGlzW29mZnNldCArIDFdID0gKHZhbHVlID4+PiAxNilcbiAgICB0aGlzW29mZnNldCArIDJdID0gKHZhbHVlID4+PiA4KVxuICAgIHRoaXNbb2Zmc2V0ICsgM10gPSB2YWx1ZVxuICB9IGVsc2Uge1xuICAgIG9iamVjdFdyaXRlVUludDMyKHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlKVxuICB9XG4gIHJldHVybiBvZmZzZXQgKyA0XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnRMRSA9IGZ1bmN0aW9uIHdyaXRlSW50TEUgKHZhbHVlLCBvZmZzZXQsIGJ5dGVMZW5ndGgsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIHZhciBsaW1pdCA9IE1hdGgucG93KDIsIDggKiBieXRlTGVuZ3RoIC0gMSlcblxuICAgIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIGJ5dGVMZW5ndGgsIGxpbWl0IC0gMSwgLWxpbWl0KVxuICB9XG5cbiAgdmFyIGkgPSAwXG4gIHZhciBtdWwgPSAxXG4gIHZhciBzdWIgPSB2YWx1ZSA8IDAgPyAxIDogMFxuICB0aGlzW29mZnNldF0gPSB2YWx1ZSAmIDB4RkZcbiAgd2hpbGUgKCsraSA8IGJ5dGVMZW5ndGggJiYgKG11bCAqPSAweDEwMCkpIHtcbiAgICB0aGlzW29mZnNldCArIGldID0gKCh2YWx1ZSAvIG11bCkgPj4gMCkgLSBzdWIgJiAweEZGXG4gIH1cblxuICByZXR1cm4gb2Zmc2V0ICsgYnl0ZUxlbmd0aFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50QkUgPSBmdW5jdGlvbiB3cml0ZUludEJFICh2YWx1ZSwgb2Zmc2V0LCBieXRlTGVuZ3RoLCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICB2YXIgbGltaXQgPSBNYXRoLnBvdygyLCA4ICogYnl0ZUxlbmd0aCAtIDEpXG5cbiAgICBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBieXRlTGVuZ3RoLCBsaW1pdCAtIDEsIC1saW1pdClcbiAgfVxuXG4gIHZhciBpID0gYnl0ZUxlbmd0aCAtIDFcbiAgdmFyIG11bCA9IDFcbiAgdmFyIHN1YiA9IHZhbHVlIDwgMCA/IDEgOiAwXG4gIHRoaXNbb2Zmc2V0ICsgaV0gPSB2YWx1ZSAmIDB4RkZcbiAgd2hpbGUgKC0taSA+PSAwICYmIChtdWwgKj0gMHgxMDApKSB7XG4gICAgdGhpc1tvZmZzZXQgKyBpXSA9ICgodmFsdWUgLyBtdWwpID4+IDApIC0gc3ViICYgMHhGRlxuICB9XG5cbiAgcmV0dXJuIG9mZnNldCArIGJ5dGVMZW5ndGhcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludDggPSBmdW5jdGlvbiB3cml0ZUludDggKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgMSwgMHg3ZiwgLTB4ODApXG4gIGlmICghQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHZhbHVlID0gTWF0aC5mbG9vcih2YWx1ZSlcbiAgaWYgKHZhbHVlIDwgMCkgdmFsdWUgPSAweGZmICsgdmFsdWUgKyAxXG4gIHRoaXNbb2Zmc2V0XSA9IHZhbHVlXG4gIHJldHVybiBvZmZzZXQgKyAxXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnQxNkxFID0gZnVuY3Rpb24gd3JpdGVJbnQxNkxFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDIsIDB4N2ZmZiwgLTB4ODAwMClcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgdGhpc1tvZmZzZXRdID0gdmFsdWVcbiAgICB0aGlzW29mZnNldCArIDFdID0gKHZhbHVlID4+PiA4KVxuICB9IGVsc2Uge1xuICAgIG9iamVjdFdyaXRlVUludDE2KHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUpXG4gIH1cbiAgcmV0dXJuIG9mZnNldCArIDJcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludDE2QkUgPSBmdW5jdGlvbiB3cml0ZUludDE2QkUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgMiwgMHg3ZmZmLCAtMHg4MDAwKVxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICB0aGlzW29mZnNldF0gPSAodmFsdWUgPj4+IDgpXG4gICAgdGhpc1tvZmZzZXQgKyAxXSA9IHZhbHVlXG4gIH0gZWxzZSB7XG4gICAgb2JqZWN0V3JpdGVVSW50MTYodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UpXG4gIH1cbiAgcmV0dXJuIG9mZnNldCArIDJcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludDMyTEUgPSBmdW5jdGlvbiB3cml0ZUludDMyTEUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgNCwgMHg3ZmZmZmZmZiwgLTB4ODAwMDAwMDApXG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIHRoaXNbb2Zmc2V0XSA9IHZhbHVlXG4gICAgdGhpc1tvZmZzZXQgKyAxXSA9ICh2YWx1ZSA+Pj4gOClcbiAgICB0aGlzW29mZnNldCArIDJdID0gKHZhbHVlID4+PiAxNilcbiAgICB0aGlzW29mZnNldCArIDNdID0gKHZhbHVlID4+PiAyNClcbiAgfSBlbHNlIHtcbiAgICBvYmplY3RXcml0ZVVJbnQzMih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCB0cnVlKVxuICB9XG4gIHJldHVybiBvZmZzZXQgKyA0XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnQzMkJFID0gZnVuY3Rpb24gd3JpdGVJbnQzMkJFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDQsIDB4N2ZmZmZmZmYsIC0weDgwMDAwMDAwKVxuICBpZiAodmFsdWUgPCAwKSB2YWx1ZSA9IDB4ZmZmZmZmZmYgKyB2YWx1ZSArIDFcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgdGhpc1tvZmZzZXRdID0gKHZhbHVlID4+PiAyNClcbiAgICB0aGlzW29mZnNldCArIDFdID0gKHZhbHVlID4+PiAxNilcbiAgICB0aGlzW29mZnNldCArIDJdID0gKHZhbHVlID4+PiA4KVxuICAgIHRoaXNbb2Zmc2V0ICsgM10gPSB2YWx1ZVxuICB9IGVsc2Uge1xuICAgIG9iamVjdFdyaXRlVUludDMyKHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlKVxuICB9XG4gIHJldHVybiBvZmZzZXQgKyA0XG59XG5cbmZ1bmN0aW9uIGNoZWNrSUVFRTc1NCAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBleHQsIG1heCwgbWluKSB7XG4gIGlmICh2YWx1ZSA+IG1heCB8fCB2YWx1ZSA8IG1pbikgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ3ZhbHVlIGlzIG91dCBvZiBib3VuZHMnKVxuICBpZiAob2Zmc2V0ICsgZXh0ID4gYnVmLmxlbmd0aCkgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ2luZGV4IG91dCBvZiByYW5nZScpXG4gIGlmIChvZmZzZXQgPCAwKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignaW5kZXggb3V0IG9mIHJhbmdlJylcbn1cblxuZnVuY3Rpb24gd3JpdGVGbG9hdCAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBjaGVja0lFRUU3NTQoYnVmLCB2YWx1ZSwgb2Zmc2V0LCA0LCAzLjQwMjgyMzQ2NjM4NTI4ODZlKzM4LCAtMy40MDI4MjM0NjYzODUyODg2ZSszOClcbiAgfVxuICBpZWVlNzU0LndyaXRlKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCAyMywgNClcbiAgcmV0dXJuIG9mZnNldCArIDRcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUZsb2F0TEUgPSBmdW5jdGlvbiB3cml0ZUZsb2F0TEUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiB3cml0ZUZsb2F0KHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlRmxvYXRCRSA9IGZ1bmN0aW9uIHdyaXRlRmxvYXRCRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIHdyaXRlRmxvYXQodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UsIG5vQXNzZXJ0KVxufVxuXG5mdW5jdGlvbiB3cml0ZURvdWJsZSAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBjaGVja0lFRUU3NTQoYnVmLCB2YWx1ZSwgb2Zmc2V0LCA4LCAxLjc5NzY5MzEzNDg2MjMxNTdFKzMwOCwgLTEuNzk3NjkzMTM0ODYyMzE1N0UrMzA4KVxuICB9XG4gIGllZWU3NTQud3JpdGUoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIDUyLCA4KVxuICByZXR1cm4gb2Zmc2V0ICsgOFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlRG91YmxlTEUgPSBmdW5jdGlvbiB3cml0ZURvdWJsZUxFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gd3JpdGVEb3VibGUodGhpcywgdmFsdWUsIG9mZnNldCwgdHJ1ZSwgbm9Bc3NlcnQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVEb3VibGVCRSA9IGZ1bmN0aW9uIHdyaXRlRG91YmxlQkUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiB3cml0ZURvdWJsZSh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBmYWxzZSwgbm9Bc3NlcnQpXG59XG5cbi8vIGNvcHkodGFyZ2V0QnVmZmVyLCB0YXJnZXRTdGFydD0wLCBzb3VyY2VTdGFydD0wLCBzb3VyY2VFbmQ9YnVmZmVyLmxlbmd0aClcbkJ1ZmZlci5wcm90b3R5cGUuY29weSA9IGZ1bmN0aW9uIGNvcHkgKHRhcmdldCwgdGFyZ2V0U3RhcnQsIHN0YXJ0LCBlbmQpIHtcbiAgaWYgKCFzdGFydCkgc3RhcnQgPSAwXG4gIGlmICghZW5kICYmIGVuZCAhPT0gMCkgZW5kID0gdGhpcy5sZW5ndGhcbiAgaWYgKHRhcmdldFN0YXJ0ID49IHRhcmdldC5sZW5ndGgpIHRhcmdldFN0YXJ0ID0gdGFyZ2V0Lmxlbmd0aFxuICBpZiAoIXRhcmdldFN0YXJ0KSB0YXJnZXRTdGFydCA9IDBcbiAgaWYgKGVuZCA+IDAgJiYgZW5kIDwgc3RhcnQpIGVuZCA9IHN0YXJ0XG5cbiAgLy8gQ29weSAwIGJ5dGVzOyB3ZSdyZSBkb25lXG4gIGlmIChlbmQgPT09IHN0YXJ0KSByZXR1cm4gMFxuICBpZiAodGFyZ2V0Lmxlbmd0aCA9PT0gMCB8fCB0aGlzLmxlbmd0aCA9PT0gMCkgcmV0dXJuIDBcblxuICAvLyBGYXRhbCBlcnJvciBjb25kaXRpb25zXG4gIGlmICh0YXJnZXRTdGFydCA8IDApIHtcbiAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcigndGFyZ2V0U3RhcnQgb3V0IG9mIGJvdW5kcycpXG4gIH1cbiAgaWYgKHN0YXJ0IDwgMCB8fCBzdGFydCA+PSB0aGlzLmxlbmd0aCkgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ3NvdXJjZVN0YXJ0IG91dCBvZiBib3VuZHMnKVxuICBpZiAoZW5kIDwgMCkgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ3NvdXJjZUVuZCBvdXQgb2YgYm91bmRzJylcblxuICAvLyBBcmUgd2Ugb29iP1xuICBpZiAoZW5kID4gdGhpcy5sZW5ndGgpIGVuZCA9IHRoaXMubGVuZ3RoXG4gIGlmICh0YXJnZXQubGVuZ3RoIC0gdGFyZ2V0U3RhcnQgPCBlbmQgLSBzdGFydCkge1xuICAgIGVuZCA9IHRhcmdldC5sZW5ndGggLSB0YXJnZXRTdGFydCArIHN0YXJ0XG4gIH1cblxuICB2YXIgbGVuID0gZW5kIC0gc3RhcnRcbiAgdmFyIGlcblxuICBpZiAodGhpcyA9PT0gdGFyZ2V0ICYmIHN0YXJ0IDwgdGFyZ2V0U3RhcnQgJiYgdGFyZ2V0U3RhcnQgPCBlbmQpIHtcbiAgICAvLyBkZXNjZW5kaW5nIGNvcHkgZnJvbSBlbmRcbiAgICBmb3IgKGkgPSBsZW4gLSAxOyBpID49IDA7IGktLSkge1xuICAgICAgdGFyZ2V0W2kgKyB0YXJnZXRTdGFydF0gPSB0aGlzW2kgKyBzdGFydF1cbiAgICB9XG4gIH0gZWxzZSBpZiAobGVuIDwgMTAwMCB8fCAhQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICAvLyBhc2NlbmRpbmcgY29weSBmcm9tIHN0YXJ0XG4gICAgZm9yIChpID0gMDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICB0YXJnZXRbaSArIHRhcmdldFN0YXJ0XSA9IHRoaXNbaSArIHN0YXJ0XVxuICAgIH1cbiAgfSBlbHNlIHtcbiAgICB0YXJnZXQuX3NldCh0aGlzLnN1YmFycmF5KHN0YXJ0LCBzdGFydCArIGxlbiksIHRhcmdldFN0YXJ0KVxuICB9XG5cbiAgcmV0dXJuIGxlblxufVxuXG4vLyBmaWxsKHZhbHVlLCBzdGFydD0wLCBlbmQ9YnVmZmVyLmxlbmd0aClcbkJ1ZmZlci5wcm90b3R5cGUuZmlsbCA9IGZ1bmN0aW9uIGZpbGwgKHZhbHVlLCBzdGFydCwgZW5kKSB7XG4gIGlmICghdmFsdWUpIHZhbHVlID0gMFxuICBpZiAoIXN0YXJ0KSBzdGFydCA9IDBcbiAgaWYgKCFlbmQpIGVuZCA9IHRoaXMubGVuZ3RoXG5cbiAgaWYgKGVuZCA8IHN0YXJ0KSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignZW5kIDwgc3RhcnQnKVxuXG4gIC8vIEZpbGwgMCBieXRlczsgd2UncmUgZG9uZVxuICBpZiAoZW5kID09PSBzdGFydCkgcmV0dXJuXG4gIGlmICh0aGlzLmxlbmd0aCA9PT0gMCkgcmV0dXJuXG5cbiAgaWYgKHN0YXJ0IDwgMCB8fCBzdGFydCA+PSB0aGlzLmxlbmd0aCkgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ3N0YXJ0IG91dCBvZiBib3VuZHMnKVxuICBpZiAoZW5kIDwgMCB8fCBlbmQgPiB0aGlzLmxlbmd0aCkgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ2VuZCBvdXQgb2YgYm91bmRzJylcblxuICB2YXIgaVxuICBpZiAodHlwZW9mIHZhbHVlID09PSAnbnVtYmVyJykge1xuICAgIGZvciAoaSA9IHN0YXJ0OyBpIDwgZW5kOyBpKyspIHtcbiAgICAgIHRoaXNbaV0gPSB2YWx1ZVxuICAgIH1cbiAgfSBlbHNlIHtcbiAgICB2YXIgYnl0ZXMgPSB1dGY4VG9CeXRlcyh2YWx1ZS50b1N0cmluZygpKVxuICAgIHZhciBsZW4gPSBieXRlcy5sZW5ndGhcbiAgICBmb3IgKGkgPSBzdGFydDsgaSA8IGVuZDsgaSsrKSB7XG4gICAgICB0aGlzW2ldID0gYnl0ZXNbaSAlIGxlbl1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gdGhpc1xufVxuXG4vKipcbiAqIENyZWF0ZXMgYSBuZXcgYEFycmF5QnVmZmVyYCB3aXRoIHRoZSAqY29waWVkKiBtZW1vcnkgb2YgdGhlIGJ1ZmZlciBpbnN0YW5jZS5cbiAqIEFkZGVkIGluIE5vZGUgMC4xMi4gT25seSBhdmFpbGFibGUgaW4gYnJvd3NlcnMgdGhhdCBzdXBwb3J0IEFycmF5QnVmZmVyLlxuICovXG5CdWZmZXIucHJvdG90eXBlLnRvQXJyYXlCdWZmZXIgPSBmdW5jdGlvbiB0b0FycmF5QnVmZmVyICgpIHtcbiAgaWYgKHR5cGVvZiBVaW50OEFycmF5ICE9PSAndW5kZWZpbmVkJykge1xuICAgIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgICAgcmV0dXJuIChuZXcgQnVmZmVyKHRoaXMpKS5idWZmZXJcbiAgICB9IGVsc2Uge1xuICAgICAgdmFyIGJ1ZiA9IG5ldyBVaW50OEFycmF5KHRoaXMubGVuZ3RoKVxuICAgICAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IGJ1Zi5sZW5ndGg7IGkgPCBsZW47IGkgKz0gMSkge1xuICAgICAgICBidWZbaV0gPSB0aGlzW2ldXG4gICAgICB9XG4gICAgICByZXR1cm4gYnVmLmJ1ZmZlclxuICAgIH1cbiAgfSBlbHNlIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdCdWZmZXIudG9BcnJheUJ1ZmZlciBub3Qgc3VwcG9ydGVkIGluIHRoaXMgYnJvd3NlcicpXG4gIH1cbn1cblxuLy8gSEVMUEVSIEZVTkNUSU9OU1xuLy8gPT09PT09PT09PT09PT09PVxuXG52YXIgQlAgPSBCdWZmZXIucHJvdG90eXBlXG5cbi8qKlxuICogQXVnbWVudCBhIFVpbnQ4QXJyYXkgKmluc3RhbmNlKiAobm90IHRoZSBVaW50OEFycmF5IGNsYXNzISkgd2l0aCBCdWZmZXIgbWV0aG9kc1xuICovXG5CdWZmZXIuX2F1Z21lbnQgPSBmdW5jdGlvbiBfYXVnbWVudCAoYXJyKSB7XG4gIGFyci5jb25zdHJ1Y3RvciA9IEJ1ZmZlclxuICBhcnIuX2lzQnVmZmVyID0gdHJ1ZVxuXG4gIC8vIHNhdmUgcmVmZXJlbmNlIHRvIG9yaWdpbmFsIFVpbnQ4QXJyYXkgc2V0IG1ldGhvZCBiZWZvcmUgb3ZlcndyaXRpbmdcbiAgYXJyLl9zZXQgPSBhcnIuc2V0XG5cbiAgLy8gZGVwcmVjYXRlZFxuICBhcnIuZ2V0ID0gQlAuZ2V0XG4gIGFyci5zZXQgPSBCUC5zZXRcblxuICBhcnIud3JpdGUgPSBCUC53cml0ZVxuICBhcnIudG9TdHJpbmcgPSBCUC50b1N0cmluZ1xuICBhcnIudG9Mb2NhbGVTdHJpbmcgPSBCUC50b1N0cmluZ1xuICBhcnIudG9KU09OID0gQlAudG9KU09OXG4gIGFyci5lcXVhbHMgPSBCUC5lcXVhbHNcbiAgYXJyLmNvbXBhcmUgPSBCUC5jb21wYXJlXG4gIGFyci5pbmRleE9mID0gQlAuaW5kZXhPZlxuICBhcnIuY29weSA9IEJQLmNvcHlcbiAgYXJyLnNsaWNlID0gQlAuc2xpY2VcbiAgYXJyLnJlYWRVSW50TEUgPSBCUC5yZWFkVUludExFXG4gIGFyci5yZWFkVUludEJFID0gQlAucmVhZFVJbnRCRVxuICBhcnIucmVhZFVJbnQ4ID0gQlAucmVhZFVJbnQ4XG4gIGFyci5yZWFkVUludDE2TEUgPSBCUC5yZWFkVUludDE2TEVcbiAgYXJyLnJlYWRVSW50MTZCRSA9IEJQLnJlYWRVSW50MTZCRVxuICBhcnIucmVhZFVJbnQzMkxFID0gQlAucmVhZFVJbnQzMkxFXG4gIGFyci5yZWFkVUludDMyQkUgPSBCUC5yZWFkVUludDMyQkVcbiAgYXJyLnJlYWRJbnRMRSA9IEJQLnJlYWRJbnRMRVxuICBhcnIucmVhZEludEJFID0gQlAucmVhZEludEJFXG4gIGFyci5yZWFkSW50OCA9IEJQLnJlYWRJbnQ4XG4gIGFyci5yZWFkSW50MTZMRSA9IEJQLnJlYWRJbnQxNkxFXG4gIGFyci5yZWFkSW50MTZCRSA9IEJQLnJlYWRJbnQxNkJFXG4gIGFyci5yZWFkSW50MzJMRSA9IEJQLnJlYWRJbnQzMkxFXG4gIGFyci5yZWFkSW50MzJCRSA9IEJQLnJlYWRJbnQzMkJFXG4gIGFyci5yZWFkRmxvYXRMRSA9IEJQLnJlYWRGbG9hdExFXG4gIGFyci5yZWFkRmxvYXRCRSA9IEJQLnJlYWRGbG9hdEJFXG4gIGFyci5yZWFkRG91YmxlTEUgPSBCUC5yZWFkRG91YmxlTEVcbiAgYXJyLnJlYWREb3VibGVCRSA9IEJQLnJlYWREb3VibGVCRVxuICBhcnIud3JpdGVVSW50OCA9IEJQLndyaXRlVUludDhcbiAgYXJyLndyaXRlVUludExFID0gQlAud3JpdGVVSW50TEVcbiAgYXJyLndyaXRlVUludEJFID0gQlAud3JpdGVVSW50QkVcbiAgYXJyLndyaXRlVUludDE2TEUgPSBCUC53cml0ZVVJbnQxNkxFXG4gIGFyci53cml0ZVVJbnQxNkJFID0gQlAud3JpdGVVSW50MTZCRVxuICBhcnIud3JpdGVVSW50MzJMRSA9IEJQLndyaXRlVUludDMyTEVcbiAgYXJyLndyaXRlVUludDMyQkUgPSBCUC53cml0ZVVJbnQzMkJFXG4gIGFyci53cml0ZUludExFID0gQlAud3JpdGVJbnRMRVxuICBhcnIud3JpdGVJbnRCRSA9IEJQLndyaXRlSW50QkVcbiAgYXJyLndyaXRlSW50OCA9IEJQLndyaXRlSW50OFxuICBhcnIud3JpdGVJbnQxNkxFID0gQlAud3JpdGVJbnQxNkxFXG4gIGFyci53cml0ZUludDE2QkUgPSBCUC53cml0ZUludDE2QkVcbiAgYXJyLndyaXRlSW50MzJMRSA9IEJQLndyaXRlSW50MzJMRVxuICBhcnIud3JpdGVJbnQzMkJFID0gQlAud3JpdGVJbnQzMkJFXG4gIGFyci53cml0ZUZsb2F0TEUgPSBCUC53cml0ZUZsb2F0TEVcbiAgYXJyLndyaXRlRmxvYXRCRSA9IEJQLndyaXRlRmxvYXRCRVxuICBhcnIud3JpdGVEb3VibGVMRSA9IEJQLndyaXRlRG91YmxlTEVcbiAgYXJyLndyaXRlRG91YmxlQkUgPSBCUC53cml0ZURvdWJsZUJFXG4gIGFyci5maWxsID0gQlAuZmlsbFxuICBhcnIuaW5zcGVjdCA9IEJQLmluc3BlY3RcbiAgYXJyLnRvQXJyYXlCdWZmZXIgPSBCUC50b0FycmF5QnVmZmVyXG5cbiAgcmV0dXJuIGFyclxufVxuXG52YXIgSU5WQUxJRF9CQVNFNjRfUkUgPSAvW14rXFwvMC05QS1aYS16LV9dL2dcblxuZnVuY3Rpb24gYmFzZTY0Y2xlYW4gKHN0cikge1xuICAvLyBOb2RlIHN0cmlwcyBvdXQgaW52YWxpZCBjaGFyYWN0ZXJzIGxpa2UgXFxuIGFuZCBcXHQgZnJvbSB0aGUgc3RyaW5nLCBiYXNlNjQtanMgZG9lcyBub3RcbiAgc3RyID0gc3RyaW5ndHJpbShzdHIpLnJlcGxhY2UoSU5WQUxJRF9CQVNFNjRfUkUsICcnKVxuICAvLyBOb2RlIGNvbnZlcnRzIHN0cmluZ3Mgd2l0aCBsZW5ndGggPCAyIHRvICcnXG4gIGlmIChzdHIubGVuZ3RoIDwgMikgcmV0dXJuICcnXG4gIC8vIE5vZGUgYWxsb3dzIGZvciBub24tcGFkZGVkIGJhc2U2NCBzdHJpbmdzIChtaXNzaW5nIHRyYWlsaW5nID09PSksIGJhc2U2NC1qcyBkb2VzIG5vdFxuICB3aGlsZSAoc3RyLmxlbmd0aCAlIDQgIT09IDApIHtcbiAgICBzdHIgPSBzdHIgKyAnPSdcbiAgfVxuICByZXR1cm4gc3RyXG59XG5cbmZ1bmN0aW9uIHN0cmluZ3RyaW0gKHN0cikge1xuICBpZiAoc3RyLnRyaW0pIHJldHVybiBzdHIudHJpbSgpXG4gIHJldHVybiBzdHIucmVwbGFjZSgvXlxccyt8XFxzKyQvZywgJycpXG59XG5cbmZ1bmN0aW9uIHRvSGV4IChuKSB7XG4gIGlmIChuIDwgMTYpIHJldHVybiAnMCcgKyBuLnRvU3RyaW5nKDE2KVxuICByZXR1cm4gbi50b1N0cmluZygxNilcbn1cblxuZnVuY3Rpb24gdXRmOFRvQnl0ZXMgKHN0cmluZywgdW5pdHMpIHtcbiAgdW5pdHMgPSB1bml0cyB8fCBJbmZpbml0eVxuICB2YXIgY29kZVBvaW50XG4gIHZhciBsZW5ndGggPSBzdHJpbmcubGVuZ3RoXG4gIHZhciBsZWFkU3Vycm9nYXRlID0gbnVsbFxuICB2YXIgYnl0ZXMgPSBbXVxuXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICBjb2RlUG9pbnQgPSBzdHJpbmcuY2hhckNvZGVBdChpKVxuXG4gICAgLy8gaXMgc3Vycm9nYXRlIGNvbXBvbmVudFxuICAgIGlmIChjb2RlUG9pbnQgPiAweEQ3RkYgJiYgY29kZVBvaW50IDwgMHhFMDAwKSB7XG4gICAgICAvLyBsYXN0IGNoYXIgd2FzIGEgbGVhZFxuICAgICAgaWYgKCFsZWFkU3Vycm9nYXRlKSB7XG4gICAgICAgIC8vIG5vIGxlYWQgeWV0XG4gICAgICAgIGlmIChjb2RlUG9pbnQgPiAweERCRkYpIHtcbiAgICAgICAgICAvLyB1bmV4cGVjdGVkIHRyYWlsXG4gICAgICAgICAgaWYgKCh1bml0cyAtPSAzKSA+IC0xKSBieXRlcy5wdXNoKDB4RUYsIDB4QkYsIDB4QkQpXG4gICAgICAgICAgY29udGludWVcbiAgICAgICAgfSBlbHNlIGlmIChpICsgMSA9PT0gbGVuZ3RoKSB7XG4gICAgICAgICAgLy8gdW5wYWlyZWQgbGVhZFxuICAgICAgICAgIGlmICgodW5pdHMgLT0gMykgPiAtMSkgYnl0ZXMucHVzaCgweEVGLCAweEJGLCAweEJEKVxuICAgICAgICAgIGNvbnRpbnVlXG4gICAgICAgIH1cblxuICAgICAgICAvLyB2YWxpZCBsZWFkXG4gICAgICAgIGxlYWRTdXJyb2dhdGUgPSBjb2RlUG9pbnRcblxuICAgICAgICBjb250aW51ZVxuICAgICAgfVxuXG4gICAgICAvLyAyIGxlYWRzIGluIGEgcm93XG4gICAgICBpZiAoY29kZVBvaW50IDwgMHhEQzAwKSB7XG4gICAgICAgIGlmICgodW5pdHMgLT0gMykgPiAtMSkgYnl0ZXMucHVzaCgweEVGLCAweEJGLCAweEJEKVxuICAgICAgICBsZWFkU3Vycm9nYXRlID0gY29kZVBvaW50XG4gICAgICAgIGNvbnRpbnVlXG4gICAgICB9XG5cbiAgICAgIC8vIHZhbGlkIHN1cnJvZ2F0ZSBwYWlyXG4gICAgICBjb2RlUG9pbnQgPSBsZWFkU3Vycm9nYXRlIC0gMHhEODAwIDw8IDEwIHwgY29kZVBvaW50IC0gMHhEQzAwIHwgMHgxMDAwMFxuICAgIH0gZWxzZSBpZiAobGVhZFN1cnJvZ2F0ZSkge1xuICAgICAgLy8gdmFsaWQgYm1wIGNoYXIsIGJ1dCBsYXN0IGNoYXIgd2FzIGEgbGVhZFxuICAgICAgaWYgKCh1bml0cyAtPSAzKSA+IC0xKSBieXRlcy5wdXNoKDB4RUYsIDB4QkYsIDB4QkQpXG4gICAgfVxuXG4gICAgbGVhZFN1cnJvZ2F0ZSA9IG51bGxcblxuICAgIC8vIGVuY29kZSB1dGY4XG4gICAgaWYgKGNvZGVQb2ludCA8IDB4ODApIHtcbiAgICAgIGlmICgodW5pdHMgLT0gMSkgPCAwKSBicmVha1xuICAgICAgYnl0ZXMucHVzaChjb2RlUG9pbnQpXG4gICAgfSBlbHNlIGlmIChjb2RlUG9pbnQgPCAweDgwMCkge1xuICAgICAgaWYgKCh1bml0cyAtPSAyKSA8IDApIGJyZWFrXG4gICAgICBieXRlcy5wdXNoKFxuICAgICAgICBjb2RlUG9pbnQgPj4gMHg2IHwgMHhDMCxcbiAgICAgICAgY29kZVBvaW50ICYgMHgzRiB8IDB4ODBcbiAgICAgIClcbiAgICB9IGVsc2UgaWYgKGNvZGVQb2ludCA8IDB4MTAwMDApIHtcbiAgICAgIGlmICgodW5pdHMgLT0gMykgPCAwKSBicmVha1xuICAgICAgYnl0ZXMucHVzaChcbiAgICAgICAgY29kZVBvaW50ID4+IDB4QyB8IDB4RTAsXG4gICAgICAgIGNvZGVQb2ludCA+PiAweDYgJiAweDNGIHwgMHg4MCxcbiAgICAgICAgY29kZVBvaW50ICYgMHgzRiB8IDB4ODBcbiAgICAgIClcbiAgICB9IGVsc2UgaWYgKGNvZGVQb2ludCA8IDB4MTEwMDAwKSB7XG4gICAgICBpZiAoKHVuaXRzIC09IDQpIDwgMCkgYnJlYWtcbiAgICAgIGJ5dGVzLnB1c2goXG4gICAgICAgIGNvZGVQb2ludCA+PiAweDEyIHwgMHhGMCxcbiAgICAgICAgY29kZVBvaW50ID4+IDB4QyAmIDB4M0YgfCAweDgwLFxuICAgICAgICBjb2RlUG9pbnQgPj4gMHg2ICYgMHgzRiB8IDB4ODAsXG4gICAgICAgIGNvZGVQb2ludCAmIDB4M0YgfCAweDgwXG4gICAgICApXG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBjb2RlIHBvaW50JylcbiAgICB9XG4gIH1cblxuICByZXR1cm4gYnl0ZXNcbn1cblxuZnVuY3Rpb24gYXNjaWlUb0J5dGVzIChzdHIpIHtcbiAgdmFyIGJ5dGVBcnJheSA9IFtdXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgc3RyLmxlbmd0aDsgaSsrKSB7XG4gICAgLy8gTm9kZSdzIGNvZGUgc2VlbXMgdG8gYmUgZG9pbmcgdGhpcyBhbmQgbm90ICYgMHg3Ri4uXG4gICAgYnl0ZUFycmF5LnB1c2goc3RyLmNoYXJDb2RlQXQoaSkgJiAweEZGKVxuICB9XG4gIHJldHVybiBieXRlQXJyYXlcbn1cblxuZnVuY3Rpb24gdXRmMTZsZVRvQnl0ZXMgKHN0ciwgdW5pdHMpIHtcbiAgdmFyIGMsIGhpLCBsb1xuICB2YXIgYnl0ZUFycmF5ID0gW11cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBzdHIubGVuZ3RoOyBpKyspIHtcbiAgICBpZiAoKHVuaXRzIC09IDIpIDwgMCkgYnJlYWtcblxuICAgIGMgPSBzdHIuY2hhckNvZGVBdChpKVxuICAgIGhpID0gYyA+PiA4XG4gICAgbG8gPSBjICUgMjU2XG4gICAgYnl0ZUFycmF5LnB1c2gobG8pXG4gICAgYnl0ZUFycmF5LnB1c2goaGkpXG4gIH1cblxuICByZXR1cm4gYnl0ZUFycmF5XG59XG5cbmZ1bmN0aW9uIGJhc2U2NFRvQnl0ZXMgKHN0cikge1xuICByZXR1cm4gYmFzZTY0LnRvQnl0ZUFycmF5KGJhc2U2NGNsZWFuKHN0cikpXG59XG5cbmZ1bmN0aW9uIGJsaXRCdWZmZXIgKHNyYywgZHN0LCBvZmZzZXQsIGxlbmd0aCkge1xuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgaWYgKChpICsgb2Zmc2V0ID49IGRzdC5sZW5ndGgpIHx8IChpID49IHNyYy5sZW5ndGgpKSBicmVha1xuICAgIGRzdFtpICsgb2Zmc2V0XSA9IHNyY1tpXVxuICB9XG4gIHJldHVybiBpXG59XG4iLCJ2YXIgbG9va3VwID0gJ0FCQ0RFRkdISUpLTE1OT1BRUlNUVVZXWFlaYWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXowMTIzNDU2Nzg5Ky8nO1xuXG47KGZ1bmN0aW9uIChleHBvcnRzKSB7XG5cdCd1c2Ugc3RyaWN0JztcblxuICB2YXIgQXJyID0gKHR5cGVvZiBVaW50OEFycmF5ICE9PSAndW5kZWZpbmVkJylcbiAgICA/IFVpbnQ4QXJyYXlcbiAgICA6IEFycmF5XG5cblx0dmFyIFBMVVMgICA9ICcrJy5jaGFyQ29kZUF0KDApXG5cdHZhciBTTEFTSCAgPSAnLycuY2hhckNvZGVBdCgwKVxuXHR2YXIgTlVNQkVSID0gJzAnLmNoYXJDb2RlQXQoMClcblx0dmFyIExPV0VSICA9ICdhJy5jaGFyQ29kZUF0KDApXG5cdHZhciBVUFBFUiAgPSAnQScuY2hhckNvZGVBdCgwKVxuXHR2YXIgUExVU19VUkxfU0FGRSA9ICctJy5jaGFyQ29kZUF0KDApXG5cdHZhciBTTEFTSF9VUkxfU0FGRSA9ICdfJy5jaGFyQ29kZUF0KDApXG5cblx0ZnVuY3Rpb24gZGVjb2RlIChlbHQpIHtcblx0XHR2YXIgY29kZSA9IGVsdC5jaGFyQ29kZUF0KDApXG5cdFx0aWYgKGNvZGUgPT09IFBMVVMgfHxcblx0XHQgICAgY29kZSA9PT0gUExVU19VUkxfU0FGRSlcblx0XHRcdHJldHVybiA2MiAvLyAnKydcblx0XHRpZiAoY29kZSA9PT0gU0xBU0ggfHxcblx0XHQgICAgY29kZSA9PT0gU0xBU0hfVVJMX1NBRkUpXG5cdFx0XHRyZXR1cm4gNjMgLy8gJy8nXG5cdFx0aWYgKGNvZGUgPCBOVU1CRVIpXG5cdFx0XHRyZXR1cm4gLTEgLy9ubyBtYXRjaFxuXHRcdGlmIChjb2RlIDwgTlVNQkVSICsgMTApXG5cdFx0XHRyZXR1cm4gY29kZSAtIE5VTUJFUiArIDI2ICsgMjZcblx0XHRpZiAoY29kZSA8IFVQUEVSICsgMjYpXG5cdFx0XHRyZXR1cm4gY29kZSAtIFVQUEVSXG5cdFx0aWYgKGNvZGUgPCBMT1dFUiArIDI2KVxuXHRcdFx0cmV0dXJuIGNvZGUgLSBMT1dFUiArIDI2XG5cdH1cblxuXHRmdW5jdGlvbiBiNjRUb0J5dGVBcnJheSAoYjY0KSB7XG5cdFx0dmFyIGksIGosIGwsIHRtcCwgcGxhY2VIb2xkZXJzLCBhcnJcblxuXHRcdGlmIChiNjQubGVuZ3RoICUgNCA+IDApIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignSW52YWxpZCBzdHJpbmcuIExlbmd0aCBtdXN0IGJlIGEgbXVsdGlwbGUgb2YgNCcpXG5cdFx0fVxuXG5cdFx0Ly8gdGhlIG51bWJlciBvZiBlcXVhbCBzaWducyAocGxhY2UgaG9sZGVycylcblx0XHQvLyBpZiB0aGVyZSBhcmUgdHdvIHBsYWNlaG9sZGVycywgdGhhbiB0aGUgdHdvIGNoYXJhY3RlcnMgYmVmb3JlIGl0XG5cdFx0Ly8gcmVwcmVzZW50IG9uZSBieXRlXG5cdFx0Ly8gaWYgdGhlcmUgaXMgb25seSBvbmUsIHRoZW4gdGhlIHRocmVlIGNoYXJhY3RlcnMgYmVmb3JlIGl0IHJlcHJlc2VudCAyIGJ5dGVzXG5cdFx0Ly8gdGhpcyBpcyBqdXN0IGEgY2hlYXAgaGFjayB0byBub3QgZG8gaW5kZXhPZiB0d2ljZVxuXHRcdHZhciBsZW4gPSBiNjQubGVuZ3RoXG5cdFx0cGxhY2VIb2xkZXJzID0gJz0nID09PSBiNjQuY2hhckF0KGxlbiAtIDIpID8gMiA6ICc9JyA9PT0gYjY0LmNoYXJBdChsZW4gLSAxKSA/IDEgOiAwXG5cblx0XHQvLyBiYXNlNjQgaXMgNC8zICsgdXAgdG8gdHdvIGNoYXJhY3RlcnMgb2YgdGhlIG9yaWdpbmFsIGRhdGFcblx0XHRhcnIgPSBuZXcgQXJyKGI2NC5sZW5ndGggKiAzIC8gNCAtIHBsYWNlSG9sZGVycylcblxuXHRcdC8vIGlmIHRoZXJlIGFyZSBwbGFjZWhvbGRlcnMsIG9ubHkgZ2V0IHVwIHRvIHRoZSBsYXN0IGNvbXBsZXRlIDQgY2hhcnNcblx0XHRsID0gcGxhY2VIb2xkZXJzID4gMCA/IGI2NC5sZW5ndGggLSA0IDogYjY0Lmxlbmd0aFxuXG5cdFx0dmFyIEwgPSAwXG5cblx0XHRmdW5jdGlvbiBwdXNoICh2KSB7XG5cdFx0XHRhcnJbTCsrXSA9IHZcblx0XHR9XG5cblx0XHRmb3IgKGkgPSAwLCBqID0gMDsgaSA8IGw7IGkgKz0gNCwgaiArPSAzKSB7XG5cdFx0XHR0bXAgPSAoZGVjb2RlKGI2NC5jaGFyQXQoaSkpIDw8IDE4KSB8IChkZWNvZGUoYjY0LmNoYXJBdChpICsgMSkpIDw8IDEyKSB8IChkZWNvZGUoYjY0LmNoYXJBdChpICsgMikpIDw8IDYpIHwgZGVjb2RlKGI2NC5jaGFyQXQoaSArIDMpKVxuXHRcdFx0cHVzaCgodG1wICYgMHhGRjAwMDApID4+IDE2KVxuXHRcdFx0cHVzaCgodG1wICYgMHhGRjAwKSA+PiA4KVxuXHRcdFx0cHVzaCh0bXAgJiAweEZGKVxuXHRcdH1cblxuXHRcdGlmIChwbGFjZUhvbGRlcnMgPT09IDIpIHtcblx0XHRcdHRtcCA9IChkZWNvZGUoYjY0LmNoYXJBdChpKSkgPDwgMikgfCAoZGVjb2RlKGI2NC5jaGFyQXQoaSArIDEpKSA+PiA0KVxuXHRcdFx0cHVzaCh0bXAgJiAweEZGKVxuXHRcdH0gZWxzZSBpZiAocGxhY2VIb2xkZXJzID09PSAxKSB7XG5cdFx0XHR0bXAgPSAoZGVjb2RlKGI2NC5jaGFyQXQoaSkpIDw8IDEwKSB8IChkZWNvZGUoYjY0LmNoYXJBdChpICsgMSkpIDw8IDQpIHwgKGRlY29kZShiNjQuY2hhckF0KGkgKyAyKSkgPj4gMilcblx0XHRcdHB1c2goKHRtcCA+PiA4KSAmIDB4RkYpXG5cdFx0XHRwdXNoKHRtcCAmIDB4RkYpXG5cdFx0fVxuXG5cdFx0cmV0dXJuIGFyclxuXHR9XG5cblx0ZnVuY3Rpb24gdWludDhUb0Jhc2U2NCAodWludDgpIHtcblx0XHR2YXIgaSxcblx0XHRcdGV4dHJhQnl0ZXMgPSB1aW50OC5sZW5ndGggJSAzLCAvLyBpZiB3ZSBoYXZlIDEgYnl0ZSBsZWZ0LCBwYWQgMiBieXRlc1xuXHRcdFx0b3V0cHV0ID0gXCJcIixcblx0XHRcdHRlbXAsIGxlbmd0aFxuXG5cdFx0ZnVuY3Rpb24gZW5jb2RlIChudW0pIHtcblx0XHRcdHJldHVybiBsb29rdXAuY2hhckF0KG51bSlcblx0XHR9XG5cblx0XHRmdW5jdGlvbiB0cmlwbGV0VG9CYXNlNjQgKG51bSkge1xuXHRcdFx0cmV0dXJuIGVuY29kZShudW0gPj4gMTggJiAweDNGKSArIGVuY29kZShudW0gPj4gMTIgJiAweDNGKSArIGVuY29kZShudW0gPj4gNiAmIDB4M0YpICsgZW5jb2RlKG51bSAmIDB4M0YpXG5cdFx0fVxuXG5cdFx0Ly8gZ28gdGhyb3VnaCB0aGUgYXJyYXkgZXZlcnkgdGhyZWUgYnl0ZXMsIHdlJ2xsIGRlYWwgd2l0aCB0cmFpbGluZyBzdHVmZiBsYXRlclxuXHRcdGZvciAoaSA9IDAsIGxlbmd0aCA9IHVpbnQ4Lmxlbmd0aCAtIGV4dHJhQnl0ZXM7IGkgPCBsZW5ndGg7IGkgKz0gMykge1xuXHRcdFx0dGVtcCA9ICh1aW50OFtpXSA8PCAxNikgKyAodWludDhbaSArIDFdIDw8IDgpICsgKHVpbnQ4W2kgKyAyXSlcblx0XHRcdG91dHB1dCArPSB0cmlwbGV0VG9CYXNlNjQodGVtcClcblx0XHR9XG5cblx0XHQvLyBwYWQgdGhlIGVuZCB3aXRoIHplcm9zLCBidXQgbWFrZSBzdXJlIHRvIG5vdCBmb3JnZXQgdGhlIGV4dHJhIGJ5dGVzXG5cdFx0c3dpdGNoIChleHRyYUJ5dGVzKSB7XG5cdFx0XHRjYXNlIDE6XG5cdFx0XHRcdHRlbXAgPSB1aW50OFt1aW50OC5sZW5ndGggLSAxXVxuXHRcdFx0XHRvdXRwdXQgKz0gZW5jb2RlKHRlbXAgPj4gMilcblx0XHRcdFx0b3V0cHV0ICs9IGVuY29kZSgodGVtcCA8PCA0KSAmIDB4M0YpXG5cdFx0XHRcdG91dHB1dCArPSAnPT0nXG5cdFx0XHRcdGJyZWFrXG5cdFx0XHRjYXNlIDI6XG5cdFx0XHRcdHRlbXAgPSAodWludDhbdWludDgubGVuZ3RoIC0gMl0gPDwgOCkgKyAodWludDhbdWludDgubGVuZ3RoIC0gMV0pXG5cdFx0XHRcdG91dHB1dCArPSBlbmNvZGUodGVtcCA+PiAxMClcblx0XHRcdFx0b3V0cHV0ICs9IGVuY29kZSgodGVtcCA+PiA0KSAmIDB4M0YpXG5cdFx0XHRcdG91dHB1dCArPSBlbmNvZGUoKHRlbXAgPDwgMikgJiAweDNGKVxuXHRcdFx0XHRvdXRwdXQgKz0gJz0nXG5cdFx0XHRcdGJyZWFrXG5cdFx0fVxuXG5cdFx0cmV0dXJuIG91dHB1dFxuXHR9XG5cblx0ZXhwb3J0cy50b0J5dGVBcnJheSA9IGI2NFRvQnl0ZUFycmF5XG5cdGV4cG9ydHMuZnJvbUJ5dGVBcnJheSA9IHVpbnQ4VG9CYXNlNjRcbn0odHlwZW9mIGV4cG9ydHMgPT09ICd1bmRlZmluZWQnID8gKHRoaXMuYmFzZTY0anMgPSB7fSkgOiBleHBvcnRzKSlcbiIsImV4cG9ydHMucmVhZCA9IGZ1bmN0aW9uIChidWZmZXIsIG9mZnNldCwgaXNMRSwgbUxlbiwgbkJ5dGVzKSB7XG4gIHZhciBlLCBtXG4gIHZhciBlTGVuID0gbkJ5dGVzICogOCAtIG1MZW4gLSAxXG4gIHZhciBlTWF4ID0gKDEgPDwgZUxlbikgLSAxXG4gIHZhciBlQmlhcyA9IGVNYXggPj4gMVxuICB2YXIgbkJpdHMgPSAtN1xuICB2YXIgaSA9IGlzTEUgPyAobkJ5dGVzIC0gMSkgOiAwXG4gIHZhciBkID0gaXNMRSA/IC0xIDogMVxuICB2YXIgcyA9IGJ1ZmZlcltvZmZzZXQgKyBpXVxuXG4gIGkgKz0gZFxuXG4gIGUgPSBzICYgKCgxIDw8ICgtbkJpdHMpKSAtIDEpXG4gIHMgPj49ICgtbkJpdHMpXG4gIG5CaXRzICs9IGVMZW5cbiAgZm9yICg7IG5CaXRzID4gMDsgZSA9IGUgKiAyNTYgKyBidWZmZXJbb2Zmc2V0ICsgaV0sIGkgKz0gZCwgbkJpdHMgLT0gOCkge31cblxuICBtID0gZSAmICgoMSA8PCAoLW5CaXRzKSkgLSAxKVxuICBlID4+PSAoLW5CaXRzKVxuICBuQml0cyArPSBtTGVuXG4gIGZvciAoOyBuQml0cyA+IDA7IG0gPSBtICogMjU2ICsgYnVmZmVyW29mZnNldCArIGldLCBpICs9IGQsIG5CaXRzIC09IDgpIHt9XG5cbiAgaWYgKGUgPT09IDApIHtcbiAgICBlID0gMSAtIGVCaWFzXG4gIH0gZWxzZSBpZiAoZSA9PT0gZU1heCkge1xuICAgIHJldHVybiBtID8gTmFOIDogKChzID8gLTEgOiAxKSAqIEluZmluaXR5KVxuICB9IGVsc2Uge1xuICAgIG0gPSBtICsgTWF0aC5wb3coMiwgbUxlbilcbiAgICBlID0gZSAtIGVCaWFzXG4gIH1cbiAgcmV0dXJuIChzID8gLTEgOiAxKSAqIG0gKiBNYXRoLnBvdygyLCBlIC0gbUxlbilcbn1cblxuZXhwb3J0cy53cml0ZSA9IGZ1bmN0aW9uIChidWZmZXIsIHZhbHVlLCBvZmZzZXQsIGlzTEUsIG1MZW4sIG5CeXRlcykge1xuICB2YXIgZSwgbSwgY1xuICB2YXIgZUxlbiA9IG5CeXRlcyAqIDggLSBtTGVuIC0gMVxuICB2YXIgZU1heCA9ICgxIDw8IGVMZW4pIC0gMVxuICB2YXIgZUJpYXMgPSBlTWF4ID4+IDFcbiAgdmFyIHJ0ID0gKG1MZW4gPT09IDIzID8gTWF0aC5wb3coMiwgLTI0KSAtIE1hdGgucG93KDIsIC03NykgOiAwKVxuICB2YXIgaSA9IGlzTEUgPyAwIDogKG5CeXRlcyAtIDEpXG4gIHZhciBkID0gaXNMRSA/IDEgOiAtMVxuICB2YXIgcyA9IHZhbHVlIDwgMCB8fCAodmFsdWUgPT09IDAgJiYgMSAvIHZhbHVlIDwgMCkgPyAxIDogMFxuXG4gIHZhbHVlID0gTWF0aC5hYnModmFsdWUpXG5cbiAgaWYgKGlzTmFOKHZhbHVlKSB8fCB2YWx1ZSA9PT0gSW5maW5pdHkpIHtcbiAgICBtID0gaXNOYU4odmFsdWUpID8gMSA6IDBcbiAgICBlID0gZU1heFxuICB9IGVsc2Uge1xuICAgIGUgPSBNYXRoLmZsb29yKE1hdGgubG9nKHZhbHVlKSAvIE1hdGguTE4yKVxuICAgIGlmICh2YWx1ZSAqIChjID0gTWF0aC5wb3coMiwgLWUpKSA8IDEpIHtcbiAgICAgIGUtLVxuICAgICAgYyAqPSAyXG4gICAgfVxuICAgIGlmIChlICsgZUJpYXMgPj0gMSkge1xuICAgICAgdmFsdWUgKz0gcnQgLyBjXG4gICAgfSBlbHNlIHtcbiAgICAgIHZhbHVlICs9IHJ0ICogTWF0aC5wb3coMiwgMSAtIGVCaWFzKVxuICAgIH1cbiAgICBpZiAodmFsdWUgKiBjID49IDIpIHtcbiAgICAgIGUrK1xuICAgICAgYyAvPSAyXG4gICAgfVxuXG4gICAgaWYgKGUgKyBlQmlhcyA+PSBlTWF4KSB7XG4gICAgICBtID0gMFxuICAgICAgZSA9IGVNYXhcbiAgICB9IGVsc2UgaWYgKGUgKyBlQmlhcyA+PSAxKSB7XG4gICAgICBtID0gKHZhbHVlICogYyAtIDEpICogTWF0aC5wb3coMiwgbUxlbilcbiAgICAgIGUgPSBlICsgZUJpYXNcbiAgICB9IGVsc2Uge1xuICAgICAgbSA9IHZhbHVlICogTWF0aC5wb3coMiwgZUJpYXMgLSAxKSAqIE1hdGgucG93KDIsIG1MZW4pXG4gICAgICBlID0gMFxuICAgIH1cbiAgfVxuXG4gIGZvciAoOyBtTGVuID49IDg7IGJ1ZmZlcltvZmZzZXQgKyBpXSA9IG0gJiAweGZmLCBpICs9IGQsIG0gLz0gMjU2LCBtTGVuIC09IDgpIHt9XG5cbiAgZSA9IChlIDw8IG1MZW4pIHwgbVxuICBlTGVuICs9IG1MZW5cbiAgZm9yICg7IGVMZW4gPiAwOyBidWZmZXJbb2Zmc2V0ICsgaV0gPSBlICYgMHhmZiwgaSArPSBkLCBlIC89IDI1NiwgZUxlbiAtPSA4KSB7fVxuXG4gIGJ1ZmZlcltvZmZzZXQgKyBpIC0gZF0gfD0gcyAqIDEyOFxufVxuIiwiXG4vKipcbiAqIGlzQXJyYXlcbiAqL1xuXG52YXIgaXNBcnJheSA9IEFycmF5LmlzQXJyYXk7XG5cbi8qKlxuICogdG9TdHJpbmdcbiAqL1xuXG52YXIgc3RyID0gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZztcblxuLyoqXG4gKiBXaGV0aGVyIG9yIG5vdCB0aGUgZ2l2ZW4gYHZhbGBcbiAqIGlzIGFuIGFycmF5LlxuICpcbiAqIGV4YW1wbGU6XG4gKlxuICogICAgICAgIGlzQXJyYXkoW10pO1xuICogICAgICAgIC8vID4gdHJ1ZVxuICogICAgICAgIGlzQXJyYXkoYXJndW1lbnRzKTtcbiAqICAgICAgICAvLyA+IGZhbHNlXG4gKiAgICAgICAgaXNBcnJheSgnJyk7XG4gKiAgICAgICAgLy8gPiBmYWxzZVxuICpcbiAqIEBwYXJhbSB7bWl4ZWR9IHZhbFxuICogQHJldHVybiB7Ym9vbH1cbiAqL1xuXG5tb2R1bGUuZXhwb3J0cyA9IGlzQXJyYXkgfHwgZnVuY3Rpb24gKHZhbCkge1xuICByZXR1cm4gISEgdmFsICYmICdbb2JqZWN0IEFycmF5XScgPT0gc3RyLmNhbGwodmFsKTtcbn07XG4iLCIvLyBDb3B5cmlnaHQgSm95ZW50LCBJbmMuIGFuZCBvdGhlciBOb2RlIGNvbnRyaWJ1dG9ycy5cbi8vXG4vLyBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYVxuLy8gY29weSBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZVxuLy8gXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbCBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nXG4vLyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0cyB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsXG4vLyBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbCBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0XG4vLyBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGVcbi8vIGZvbGxvd2luZyBjb25kaXRpb25zOlxuLy9cbi8vIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkXG4vLyBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbi8vXG4vLyBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTXG4vLyBPUiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GXG4vLyBNRVJDSEFOVEFCSUxJVFksIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOXG4vLyBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSxcbi8vIERBTUFHRVMgT1IgT1RIRVIgTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUlxuLy8gT1RIRVJXSVNFLCBBUklTSU5HIEZST00sIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRVxuLy8gVVNFIE9SIE9USEVSIERFQUxJTkdTIElOIFRIRSBTT0ZUV0FSRS5cblxuZnVuY3Rpb24gRXZlbnRFbWl0dGVyKCkge1xuICB0aGlzLl9ldmVudHMgPSB0aGlzLl9ldmVudHMgfHwge307XG4gIHRoaXMuX21heExpc3RlbmVycyA9IHRoaXMuX21heExpc3RlbmVycyB8fCB1bmRlZmluZWQ7XG59XG5tb2R1bGUuZXhwb3J0cyA9IEV2ZW50RW1pdHRlcjtcblxuLy8gQmFja3dhcmRzLWNvbXBhdCB3aXRoIG5vZGUgMC4xMC54XG5FdmVudEVtaXR0ZXIuRXZlbnRFbWl0dGVyID0gRXZlbnRFbWl0dGVyO1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLl9ldmVudHMgPSB1bmRlZmluZWQ7XG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLl9tYXhMaXN0ZW5lcnMgPSB1bmRlZmluZWQ7XG5cbi8vIEJ5IGRlZmF1bHQgRXZlbnRFbWl0dGVycyB3aWxsIHByaW50IGEgd2FybmluZyBpZiBtb3JlIHRoYW4gMTAgbGlzdGVuZXJzIGFyZVxuLy8gYWRkZWQgdG8gaXQuIFRoaXMgaXMgYSB1c2VmdWwgZGVmYXVsdCB3aGljaCBoZWxwcyBmaW5kaW5nIG1lbW9yeSBsZWFrcy5cbkV2ZW50RW1pdHRlci5kZWZhdWx0TWF4TGlzdGVuZXJzID0gMTA7XG5cbi8vIE9idmlvdXNseSBub3QgYWxsIEVtaXR0ZXJzIHNob3VsZCBiZSBsaW1pdGVkIHRvIDEwLiBUaGlzIGZ1bmN0aW9uIGFsbG93c1xuLy8gdGhhdCB0byBiZSBpbmNyZWFzZWQuIFNldCB0byB6ZXJvIGZvciB1bmxpbWl0ZWQuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnNldE1heExpc3RlbmVycyA9IGZ1bmN0aW9uKG4pIHtcbiAgaWYgKCFpc051bWJlcihuKSB8fCBuIDwgMCB8fCBpc05hTihuKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ24gbXVzdCBiZSBhIHBvc2l0aXZlIG51bWJlcicpO1xuICB0aGlzLl9tYXhMaXN0ZW5lcnMgPSBuO1xuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuZW1pdCA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIGVyLCBoYW5kbGVyLCBsZW4sIGFyZ3MsIGksIGxpc3RlbmVycztcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcblxuICAvLyBJZiB0aGVyZSBpcyBubyAnZXJyb3InIGV2ZW50IGxpc3RlbmVyIHRoZW4gdGhyb3cuXG4gIGlmICh0eXBlID09PSAnZXJyb3InKSB7XG4gICAgaWYgKCF0aGlzLl9ldmVudHMuZXJyb3IgfHxcbiAgICAgICAgKGlzT2JqZWN0KHRoaXMuX2V2ZW50cy5lcnJvcikgJiYgIXRoaXMuX2V2ZW50cy5lcnJvci5sZW5ndGgpKSB7XG4gICAgICBlciA9IGFyZ3VtZW50c1sxXTtcbiAgICAgIGlmIChlciBpbnN0YW5jZW9mIEVycm9yKSB7XG4gICAgICAgIHRocm93IGVyOyAvLyBVbmhhbmRsZWQgJ2Vycm9yJyBldmVudFxuICAgICAgfVxuICAgICAgdGhyb3cgVHlwZUVycm9yKCdVbmNhdWdodCwgdW5zcGVjaWZpZWQgXCJlcnJvclwiIGV2ZW50LicpO1xuICAgIH1cbiAgfVxuXG4gIGhhbmRsZXIgPSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgaWYgKGlzVW5kZWZpbmVkKGhhbmRsZXIpKVxuICAgIHJldHVybiBmYWxzZTtcblxuICBpZiAoaXNGdW5jdGlvbihoYW5kbGVyKSkge1xuICAgIHN3aXRjaCAoYXJndW1lbnRzLmxlbmd0aCkge1xuICAgICAgLy8gZmFzdCBjYXNlc1xuICAgICAgY2FzZSAxOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcyk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAyOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcywgYXJndW1lbnRzWzFdKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDM6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzLCBhcmd1bWVudHNbMV0sIGFyZ3VtZW50c1syXSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgLy8gc2xvd2VyXG4gICAgICBkZWZhdWx0OlxuICAgICAgICBsZW4gPSBhcmd1bWVudHMubGVuZ3RoO1xuICAgICAgICBhcmdzID0gbmV3IEFycmF5KGxlbiAtIDEpO1xuICAgICAgICBmb3IgKGkgPSAxOyBpIDwgbGVuOyBpKyspXG4gICAgICAgICAgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG4gICAgICAgIGhhbmRsZXIuYXBwbHkodGhpcywgYXJncyk7XG4gICAgfVxuICB9IGVsc2UgaWYgKGlzT2JqZWN0KGhhbmRsZXIpKSB7XG4gICAgbGVuID0gYXJndW1lbnRzLmxlbmd0aDtcbiAgICBhcmdzID0gbmV3IEFycmF5KGxlbiAtIDEpO1xuICAgIGZvciAoaSA9IDE7IGkgPCBsZW47IGkrKylcbiAgICAgIGFyZ3NbaSAtIDFdID0gYXJndW1lbnRzW2ldO1xuXG4gICAgbGlzdGVuZXJzID0gaGFuZGxlci5zbGljZSgpO1xuICAgIGxlbiA9IGxpc3RlbmVycy5sZW5ndGg7XG4gICAgZm9yIChpID0gMDsgaSA8IGxlbjsgaSsrKVxuICAgICAgbGlzdGVuZXJzW2ldLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICB9XG5cbiAgcmV0dXJuIHRydWU7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmFkZExpc3RlbmVyID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgdmFyIG07XG5cbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuXG4gIC8vIFRvIGF2b2lkIHJlY3Vyc2lvbiBpbiB0aGUgY2FzZSB0aGF0IHR5cGUgPT09IFwibmV3TGlzdGVuZXJcIiEgQmVmb3JlXG4gIC8vIGFkZGluZyBpdCB0byB0aGUgbGlzdGVuZXJzLCBmaXJzdCBlbWl0IFwibmV3TGlzdGVuZXJcIi5cbiAgaWYgKHRoaXMuX2V2ZW50cy5uZXdMaXN0ZW5lcilcbiAgICB0aGlzLmVtaXQoJ25ld0xpc3RlbmVyJywgdHlwZSxcbiAgICAgICAgICAgICAgaXNGdW5jdGlvbihsaXN0ZW5lci5saXN0ZW5lcikgP1xuICAgICAgICAgICAgICBsaXN0ZW5lci5saXN0ZW5lciA6IGxpc3RlbmVyKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICAvLyBPcHRpbWl6ZSB0aGUgY2FzZSBvZiBvbmUgbGlzdGVuZXIuIERvbid0IG5lZWQgdGhlIGV4dHJhIGFycmF5IG9iamVjdC5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBsaXN0ZW5lcjtcbiAgZWxzZSBpZiAoaXNPYmplY3QodGhpcy5fZXZlbnRzW3R5cGVdKSlcbiAgICAvLyBJZiB3ZSd2ZSBhbHJlYWR5IGdvdCBhbiBhcnJheSwganVzdCBhcHBlbmQuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdLnB1c2gobGlzdGVuZXIpO1xuICBlbHNlXG4gICAgLy8gQWRkaW5nIHRoZSBzZWNvbmQgZWxlbWVudCwgbmVlZCB0byBjaGFuZ2UgdG8gYXJyYXkuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdID0gW3RoaXMuX2V2ZW50c1t0eXBlXSwgbGlzdGVuZXJdO1xuXG4gIC8vIENoZWNrIGZvciBsaXN0ZW5lciBsZWFrXG4gIGlmIChpc09iamVjdCh0aGlzLl9ldmVudHNbdHlwZV0pICYmICF0aGlzLl9ldmVudHNbdHlwZV0ud2FybmVkKSB7XG4gICAgdmFyIG07XG4gICAgaWYgKCFpc1VuZGVmaW5lZCh0aGlzLl9tYXhMaXN0ZW5lcnMpKSB7XG4gICAgICBtID0gdGhpcy5fbWF4TGlzdGVuZXJzO1xuICAgIH0gZWxzZSB7XG4gICAgICBtID0gRXZlbnRFbWl0dGVyLmRlZmF1bHRNYXhMaXN0ZW5lcnM7XG4gICAgfVxuXG4gICAgaWYgKG0gJiYgbSA+IDAgJiYgdGhpcy5fZXZlbnRzW3R5cGVdLmxlbmd0aCA+IG0pIHtcbiAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXS53YXJuZWQgPSB0cnVlO1xuICAgICAgY29uc29sZS5lcnJvcignKG5vZGUpIHdhcm5pbmc6IHBvc3NpYmxlIEV2ZW50RW1pdHRlciBtZW1vcnkgJyArXG4gICAgICAgICAgICAgICAgICAgICdsZWFrIGRldGVjdGVkLiAlZCBsaXN0ZW5lcnMgYWRkZWQuICcgK1xuICAgICAgICAgICAgICAgICAgICAnVXNlIGVtaXR0ZXIuc2V0TWF4TGlzdGVuZXJzKCkgdG8gaW5jcmVhc2UgbGltaXQuJyxcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdLmxlbmd0aCk7XG4gICAgICBpZiAodHlwZW9mIGNvbnNvbGUudHJhY2UgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgLy8gbm90IHN1cHBvcnRlZCBpbiBJRSAxMFxuICAgICAgICBjb25zb2xlLnRyYWNlKCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uID0gRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5hZGRMaXN0ZW5lcjtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbmNlID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIHZhciBmaXJlZCA9IGZhbHNlO1xuXG4gIGZ1bmN0aW9uIGcoKSB7XG4gICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBnKTtcblxuICAgIGlmICghZmlyZWQpIHtcbiAgICAgIGZpcmVkID0gdHJ1ZTtcbiAgICAgIGxpc3RlbmVyLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgfVxuICB9XG5cbiAgZy5saXN0ZW5lciA9IGxpc3RlbmVyO1xuICB0aGlzLm9uKHR5cGUsIGcpO1xuXG4gIHJldHVybiB0aGlzO1xufTtcblxuLy8gZW1pdHMgYSAncmVtb3ZlTGlzdGVuZXInIGV2ZW50IGlmZiB0aGUgbGlzdGVuZXIgd2FzIHJlbW92ZWRcbkV2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlTGlzdGVuZXIgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICB2YXIgbGlzdCwgcG9zaXRpb24sIGxlbmd0aCwgaTtcblxuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMgfHwgIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICByZXR1cm4gdGhpcztcblxuICBsaXN0ID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuICBsZW5ndGggPSBsaXN0Lmxlbmd0aDtcbiAgcG9zaXRpb24gPSAtMTtcblxuICBpZiAobGlzdCA9PT0gbGlzdGVuZXIgfHxcbiAgICAgIChpc0Z1bmN0aW9uKGxpc3QubGlzdGVuZXIpICYmIGxpc3QubGlzdGVuZXIgPT09IGxpc3RlbmVyKSkge1xuICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgaWYgKHRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcilcbiAgICAgIHRoaXMuZW1pdCgncmVtb3ZlTGlzdGVuZXInLCB0eXBlLCBsaXN0ZW5lcik7XG5cbiAgfSBlbHNlIGlmIChpc09iamVjdChsaXN0KSkge1xuICAgIGZvciAoaSA9IGxlbmd0aDsgaS0tID4gMDspIHtcbiAgICAgIGlmIChsaXN0W2ldID09PSBsaXN0ZW5lciB8fFxuICAgICAgICAgIChsaXN0W2ldLmxpc3RlbmVyICYmIGxpc3RbaV0ubGlzdGVuZXIgPT09IGxpc3RlbmVyKSkge1xuICAgICAgICBwb3NpdGlvbiA9IGk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChwb3NpdGlvbiA8IDApXG4gICAgICByZXR1cm4gdGhpcztcblxuICAgIGlmIChsaXN0Lmxlbmd0aCA9PT0gMSkge1xuICAgICAgbGlzdC5sZW5ndGggPSAwO1xuICAgICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICB9IGVsc2Uge1xuICAgICAgbGlzdC5zcGxpY2UocG9zaXRpb24sIDEpO1xuICAgIH1cblxuICAgIGlmICh0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpXG4gICAgICB0aGlzLmVtaXQoJ3JlbW92ZUxpc3RlbmVyJywgdHlwZSwgbGlzdGVuZXIpO1xuICB9XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUFsbExpc3RlbmVycyA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIGtleSwgbGlzdGVuZXJzO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHJldHVybiB0aGlzO1xuXG4gIC8vIG5vdCBsaXN0ZW5pbmcgZm9yIHJlbW92ZUxpc3RlbmVyLCBubyBuZWVkIHRvIGVtaXRcbiAgaWYgKCF0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpIHtcbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMClcbiAgICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuICAgIGVsc2UgaWYgKHRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvLyBlbWl0IHJlbW92ZUxpc3RlbmVyIGZvciBhbGwgbGlzdGVuZXJzIG9uIGFsbCBldmVudHNcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApIHtcbiAgICBmb3IgKGtleSBpbiB0aGlzLl9ldmVudHMpIHtcbiAgICAgIGlmIChrZXkgPT09ICdyZW1vdmVMaXN0ZW5lcicpIGNvbnRpbnVlO1xuICAgICAgdGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoa2V5KTtcbiAgICB9XG4gICAgdGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoJ3JlbW92ZUxpc3RlbmVyJyk7XG4gICAgdGhpcy5fZXZlbnRzID0ge307XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICBsaXN0ZW5lcnMgPSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgaWYgKGlzRnVuY3Rpb24obGlzdGVuZXJzKSkge1xuICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgbGlzdGVuZXJzKTtcbiAgfSBlbHNlIHtcbiAgICAvLyBMSUZPIG9yZGVyXG4gICAgd2hpbGUgKGxpc3RlbmVycy5sZW5ndGgpXG4gICAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGxpc3RlbmVyc1tsaXN0ZW5lcnMubGVuZ3RoIC0gMV0pO1xuICB9XG4gIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmxpc3RlbmVycyA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIHJldDtcbiAgaWYgKCF0aGlzLl9ldmVudHMgfHwgIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICByZXQgPSBbXTtcbiAgZWxzZSBpZiAoaXNGdW5jdGlvbih0aGlzLl9ldmVudHNbdHlwZV0pKVxuICAgIHJldCA9IFt0aGlzLl9ldmVudHNbdHlwZV1dO1xuICBlbHNlXG4gICAgcmV0ID0gdGhpcy5fZXZlbnRzW3R5cGVdLnNsaWNlKCk7XG4gIHJldHVybiByZXQ7XG59O1xuXG5FdmVudEVtaXR0ZXIubGlzdGVuZXJDb3VudCA9IGZ1bmN0aW9uKGVtaXR0ZXIsIHR5cGUpIHtcbiAgdmFyIHJldDtcbiAgaWYgKCFlbWl0dGVyLl9ldmVudHMgfHwgIWVtaXR0ZXIuX2V2ZW50c1t0eXBlXSlcbiAgICByZXQgPSAwO1xuICBlbHNlIGlmIChpc0Z1bmN0aW9uKGVtaXR0ZXIuX2V2ZW50c1t0eXBlXSkpXG4gICAgcmV0ID0gMTtcbiAgZWxzZVxuICAgIHJldCA9IGVtaXR0ZXIuX2V2ZW50c1t0eXBlXS5sZW5ndGg7XG4gIHJldHVybiByZXQ7XG59O1xuXG5mdW5jdGlvbiBpc0Z1bmN0aW9uKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ2Z1bmN0aW9uJztcbn1cblxuZnVuY3Rpb24gaXNOdW1iZXIoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnbnVtYmVyJztcbn1cblxuZnVuY3Rpb24gaXNPYmplY3QoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnb2JqZWN0JyAmJiBhcmcgIT09IG51bGw7XG59XG5cbmZ1bmN0aW9uIGlzVW5kZWZpbmVkKGFyZykge1xuICByZXR1cm4gYXJnID09PSB2b2lkIDA7XG59XG4iLCIvLyBzaGltIGZvciB1c2luZyBwcm9jZXNzIGluIGJyb3dzZXJcblxudmFyIHByb2Nlc3MgPSBtb2R1bGUuZXhwb3J0cyA9IHt9O1xudmFyIHF1ZXVlID0gW107XG52YXIgZHJhaW5pbmcgPSBmYWxzZTtcbnZhciBjdXJyZW50UXVldWU7XG52YXIgcXVldWVJbmRleCA9IC0xO1xuXG5mdW5jdGlvbiBjbGVhblVwTmV4dFRpY2soKSB7XG4gICAgZHJhaW5pbmcgPSBmYWxzZTtcbiAgICBpZiAoY3VycmVudFF1ZXVlLmxlbmd0aCkge1xuICAgICAgICBxdWV1ZSA9IGN1cnJlbnRRdWV1ZS5jb25jYXQocXVldWUpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHF1ZXVlSW5kZXggPSAtMTtcbiAgICB9XG4gICAgaWYgKHF1ZXVlLmxlbmd0aCkge1xuICAgICAgICBkcmFpblF1ZXVlKCk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBkcmFpblF1ZXVlKCkge1xuICAgIGlmIChkcmFpbmluZykge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIHZhciB0aW1lb3V0ID0gc2V0VGltZW91dChjbGVhblVwTmV4dFRpY2spO1xuICAgIGRyYWluaW5nID0gdHJ1ZTtcblxuICAgIHZhciBsZW4gPSBxdWV1ZS5sZW5ndGg7XG4gICAgd2hpbGUobGVuKSB7XG4gICAgICAgIGN1cnJlbnRRdWV1ZSA9IHF1ZXVlO1xuICAgICAgICBxdWV1ZSA9IFtdO1xuICAgICAgICB3aGlsZSAoKytxdWV1ZUluZGV4IDwgbGVuKSB7XG4gICAgICAgICAgICBpZiAoY3VycmVudFF1ZXVlKSB7XG4gICAgICAgICAgICAgICAgY3VycmVudFF1ZXVlW3F1ZXVlSW5kZXhdLnJ1bigpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHF1ZXVlSW5kZXggPSAtMTtcbiAgICAgICAgbGVuID0gcXVldWUubGVuZ3RoO1xuICAgIH1cbiAgICBjdXJyZW50UXVldWUgPSBudWxsO1xuICAgIGRyYWluaW5nID0gZmFsc2U7XG4gICAgY2xlYXJUaW1lb3V0KHRpbWVvdXQpO1xufVxuXG5wcm9jZXNzLm5leHRUaWNrID0gZnVuY3Rpb24gKGZ1bikge1xuICAgIHZhciBhcmdzID0gbmV3IEFycmF5KGFyZ3VtZW50cy5sZW5ndGggLSAxKTtcbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgZm9yICh2YXIgaSA9IDE7IGkgPCBhcmd1bWVudHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGFyZ3NbaSAtIDFdID0gYXJndW1lbnRzW2ldO1xuICAgICAgICB9XG4gICAgfVxuICAgIHF1ZXVlLnB1c2gobmV3IEl0ZW0oZnVuLCBhcmdzKSk7XG4gICAgaWYgKHF1ZXVlLmxlbmd0aCA9PT0gMSAmJiAhZHJhaW5pbmcpIHtcbiAgICAgICAgc2V0VGltZW91dChkcmFpblF1ZXVlLCAwKTtcbiAgICB9XG59O1xuXG4vLyB2OCBsaWtlcyBwcmVkaWN0aWJsZSBvYmplY3RzXG5mdW5jdGlvbiBJdGVtKGZ1biwgYXJyYXkpIHtcbiAgICB0aGlzLmZ1biA9IGZ1bjtcbiAgICB0aGlzLmFycmF5ID0gYXJyYXk7XG59XG5JdGVtLnByb3RvdHlwZS5ydW4gPSBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5mdW4uYXBwbHkobnVsbCwgdGhpcy5hcnJheSk7XG59O1xucHJvY2Vzcy50aXRsZSA9ICdicm93c2VyJztcbnByb2Nlc3MuYnJvd3NlciA9IHRydWU7XG5wcm9jZXNzLmVudiA9IHt9O1xucHJvY2Vzcy5hcmd2ID0gW107XG5wcm9jZXNzLnZlcnNpb24gPSAnJzsgLy8gZW1wdHkgc3RyaW5nIHRvIGF2b2lkIHJlZ2V4cCBpc3N1ZXNcbnByb2Nlc3MudmVyc2lvbnMgPSB7fTtcblxuZnVuY3Rpb24gbm9vcCgpIHt9XG5cbnByb2Nlc3Mub24gPSBub29wO1xucHJvY2Vzcy5hZGRMaXN0ZW5lciA9IG5vb3A7XG5wcm9jZXNzLm9uY2UgPSBub29wO1xucHJvY2Vzcy5vZmYgPSBub29wO1xucHJvY2Vzcy5yZW1vdmVMaXN0ZW5lciA9IG5vb3A7XG5wcm9jZXNzLnJlbW92ZUFsbExpc3RlbmVycyA9IG5vb3A7XG5wcm9jZXNzLmVtaXQgPSBub29wO1xuXG5wcm9jZXNzLmJpbmRpbmcgPSBmdW5jdGlvbiAobmFtZSkge1xuICAgIHRocm93IG5ldyBFcnJvcigncHJvY2Vzcy5iaW5kaW5nIGlzIG5vdCBzdXBwb3J0ZWQnKTtcbn07XG5cbnByb2Nlc3MuY3dkID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gJy8nIH07XG5wcm9jZXNzLmNoZGlyID0gZnVuY3Rpb24gKGRpcikge1xuICAgIHRocm93IG5ldyBFcnJvcigncHJvY2Vzcy5jaGRpciBpcyBub3Qgc3VwcG9ydGVkJyk7XG59O1xucHJvY2Vzcy51bWFzayA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gMDsgfTtcbiIsIi8vXG4vLyBGaWxlUmVhZGVyXG4vL1xuLy8gaHR0cDovL3d3dy53My5vcmcvVFIvRmlsZUFQSS8jZGZuLWZpbGVyZWFkZXJcbi8vIGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuL0RPTS9GaWxlUmVhZGVyXG4oZnVuY3Rpb24gKCkge1xuICBcInVzZSBzdHJpY3RcIjtcblxuICB2YXIgZnMgPSByZXF1aXJlKFwiZnNcIilcbiAgICAsIEV2ZW50RW1pdHRlciA9IHJlcXVpcmUoXCJldmVudHNcIikuRXZlbnRFbWl0dGVyXG4gICAgO1xuXG4gIGZ1bmN0aW9uIGRvb3AoZm4sIGFyZ3MsIGNvbnRleHQpIHtcbiAgICBpZiAoJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIGZuKSB7XG4gICAgICBmbi5hcHBseShjb250ZXh0LCBhcmdzKTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiB0b0RhdGFVcmwoZGF0YSwgdHlwZSkge1xuICAgIC8vIHZhciBkYXRhID0gc2VsZi5yZXN1bHQ7XG4gICAgdmFyIGRhdGFVcmwgPSAnZGF0YTonO1xuXG4gICAgaWYgKHR5cGUpIHtcbiAgICAgIGRhdGFVcmwgKz0gdHlwZSArICc7JztcbiAgICB9XG5cbiAgICBpZiAoL3RleHQvaS50ZXN0KHR5cGUpKSB7XG4gICAgICBkYXRhVXJsICs9ICdjaGFyc2V0PXV0Zi04LCc7XG4gICAgICBkYXRhVXJsICs9IGRhdGEudG9TdHJpbmcoJ3V0ZjgnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgZGF0YVVybCArPSAnYmFzZTY0LCc7XG4gICAgICBkYXRhVXJsICs9IGRhdGEudG9TdHJpbmcoJ2Jhc2U2NCcpO1xuICAgIH1cblxuICAgIHJldHVybiBkYXRhVXJsO1xuICB9XG5cbiAgZnVuY3Rpb24gbWFwRGF0YVRvRm9ybWF0KGZpbGUsIGRhdGEsIGZvcm1hdCwgZW5jb2RpbmcpIHtcbiAgICAvLyB2YXIgZGF0YSA9IHNlbGYucmVzdWx0O1xuXG4gICAgc3dpdGNoKGZvcm1hdCkge1xuICAgICAgY2FzZSAnYnVmZmVyJzpcbiAgICAgICAgcmV0dXJuIGRhdGE7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnYmluYXJ5JzpcbiAgICAgICAgcmV0dXJuIGRhdGEudG9TdHJpbmcoJ2JpbmFyeScpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJ2RhdGFVcmwnOlxuICAgICAgICByZXR1cm4gdG9EYXRhVXJsKGRhdGEsIGZpbGUudHlwZSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAndGV4dCc6XG4gICAgICAgIHJldHVybiBkYXRhLnRvU3RyaW5nKGVuY29kaW5nIHx8ICd1dGY4Jyk7XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIEZpbGVSZWFkZXIoKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzLFxuICAgICAgZW1pdHRlciA9IG5ldyBFdmVudEVtaXR0ZXIsXG4gICAgICBmaWxlO1xuXG4gICAgc2VsZi5hZGRFdmVudExpc3RlbmVyID0gZnVuY3Rpb24gKG9uLCBjYWxsYmFjaykge1xuICAgICAgZW1pdHRlci5vbihvbiwgY2FsbGJhY2spO1xuICAgIH07XG4gICAgc2VsZi5yZW1vdmVFdmVudExpc3RlbmVyID0gZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gICAgICBlbWl0dGVyLnJlbW92ZUxpc3RlbmVyKGNhbGxiYWNrKTtcbiAgICB9XG4gICAgc2VsZi5kaXNwYXRjaEV2ZW50ID0gZnVuY3Rpb24gKG9uKSB7XG4gICAgICBlbWl0dGVyLmVtaXQob24pO1xuICAgIH1cblxuICAgIHNlbGYuRU1QVFkgPSAwO1xuICAgIHNlbGYuTE9BRElORyA9IDE7XG4gICAgc2VsZi5ET05FID0gMjtcblxuICAgIHNlbGYuZXJyb3IgPSB1bmRlZmluZWQ7ICAgICAgICAgLy8gUmVhZCBvbmx5XG4gICAgc2VsZi5yZWFkeVN0YXRlID0gc2VsZi5FTVBUWTsgICAvLyBSZWFkIG9ubHlcbiAgICBzZWxmLnJlc3VsdCA9IHVuZGVmaW5lZDsgICAgICAgIC8vIFJvYWQgb25seVxuXG4gICAgLy8gbm9uLXN0YW5kYXJkXG4gICAgc2VsZi5vbiA9IGZ1bmN0aW9uICgpIHtcbiAgICAgIGVtaXR0ZXIub24uYXBwbHkoZW1pdHRlciwgYXJndW1lbnRzKTtcbiAgICB9XG4gICAgc2VsZi5ub2RlQ2h1bmtlZEVuY29kaW5nID0gZmFsc2U7XG4gICAgc2VsZi5zZXROb2RlQ2h1bmtlZEVuY29kaW5nID0gZnVuY3Rpb24gKHZhbCkge1xuICAgICAgc2VsZi5ub2RlQ2h1bmtlZEVuY29kaW5nID0gdmFsO1xuICAgIH07XG4gICAgLy8gZW5kIG5vbi1zdGFuZGFyZFxuXG5cblxuICAgIC8vIFdoYXRldmVyIHRoZSBmaWxlIG9iamVjdCBpcywgdHVybiBpdCBpbnRvIGEgTm9kZS5KUyBGaWxlLlN0cmVhbVxuICAgIGZ1bmN0aW9uIGNyZWF0ZUZpbGVTdHJlYW0oKSB7XG4gICAgICB2YXIgc3RyZWFtID0gbmV3IEV2ZW50RW1pdHRlcigpLFxuICAgICAgICBjaHVua2VkID0gc2VsZi5ub2RlQ2h1bmtlZEVuY29kaW5nO1xuXG4gICAgICAvLyBhdHRlbXB0IHRvIG1ha2UgdGhlIGxlbmd0aCBjb21wdXRhYmxlXG4gICAgICBpZiAoIWZpbGUuc2l6ZSAmJiBjaHVua2VkICYmIGZpbGUucGF0aCkge1xuICAgICAgICBmcy5zdGF0KGZpbGUucGF0aCwgZnVuY3Rpb24gKGVyciwgc3RhdCkge1xuICAgICAgICAgIGZpbGUuc2l6ZSA9IHN0YXQuc2l6ZTtcbiAgICAgICAgICBmaWxlLmxhc3RNb2RpZmllZERhdGUgPSBzdGF0Lm10aW1lO1xuICAgICAgICB9KTtcbiAgICAgIH1cblxuXG4gICAgICAvLyBUaGUgc3RyZWFtIGV4aXN0cywgZG8gbm90aGluZyBtb3JlXG4gICAgICBpZiAoZmlsZS5zdHJlYW0pIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG5cbiAgICAgIC8vIENyZWF0ZSBhIHJlYWQgc3RyZWFtIGZyb20gYSBidWZmZXJcbiAgICAgIGlmIChmaWxlLmJ1ZmZlcikge1xuICAgICAgICBwcm9jZXNzLm5leHRUaWNrKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICBzdHJlYW0uZW1pdCgnZGF0YScsIGZpbGUuYnVmZmVyKTtcbiAgICAgICAgICBzdHJlYW0uZW1pdCgnZW5kJyk7XG4gICAgICAgIH0pO1xuICAgICAgICBmaWxlLnN0cmVhbSA9IHN0cmVhbTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG5cbiAgICAgIC8vIENyZWF0ZSBhIHJlYWQgc3RyZWFtIGZyb20gYSBmaWxlXG4gICAgICBpZiAoZmlsZS5wYXRoKSB7XG4gICAgICAgIC8vIFRPRE8gdXJsXG4gICAgICAgIGlmICghY2h1bmtlZCkge1xuICAgICAgICAgIGZzLnJlYWRGaWxlKGZpbGUucGF0aCwgZnVuY3Rpb24gKGVyciwgZGF0YSkge1xuICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICBzdHJlYW0uZW1pdCgnZXJyb3InLCBlcnIpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGRhdGEpIHtcbiAgICAgICAgICAgICAgc3RyZWFtLmVtaXQoJ2RhdGEnLCBkYXRhKTtcbiAgICAgICAgICAgICAgc3RyZWFtLmVtaXQoJ2VuZCcpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgZmlsZS5zdHJlYW0gPSBzdHJlYW07XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gVE9ETyBkb24ndCBkdXBsaWNhdGUgdGhpcyBjb2RlIGhlcmUsXG4gICAgICAgIC8vIGV4cG9zZSBhIG1ldGhvZCBpbiBGaWxlIGluc3RlYWRcbiAgICAgICAgZmlsZS5zdHJlYW0gPSBmcy5jcmVhdGVSZWFkU3RyZWFtKGZpbGUucGF0aCk7XG4gICAgICB9XG4gICAgfVxuXG5cblxuICAgIC8vIGJlZm9yZSBhbnkgb3RoZXIgbGlzdGVuZXJzIGFyZSBhZGRlZFxuICAgIGVtaXR0ZXIub24oJ2Fib3J0JywgZnVuY3Rpb24gKCkge1xuICAgICAgc2VsZi5yZWFkeVN0YXRlID0gc2VsZi5ET05FO1xuICAgIH0pO1xuXG5cblxuICAgIC8vIE1hcCBgZXJyb3JgLCBgcHJvZ3Jlc3NgLCBgbG9hZGAsIGFuZCBgbG9hZGVuZGBcbiAgICBmdW5jdGlvbiBtYXBTdHJlYW1Ub0VtaXR0ZXIoZm9ybWF0LCBlbmNvZGluZykge1xuICAgICAgdmFyIHN0cmVhbSA9IGZpbGUuc3RyZWFtLFxuICAgICAgICBidWZmZXJzID0gW10sXG4gICAgICAgIGNodW5rZWQgPSBzZWxmLm5vZGVDaHVua2VkRW5jb2Rpbmc7XG5cbiAgICAgIGJ1ZmZlcnMuZGF0YUxlbmd0aCA9IDA7XG5cbiAgICAgIHN0cmVhbS5vbignZXJyb3InLCBmdW5jdGlvbiAoZXJyKSB7XG4gICAgICAgIGlmIChzZWxmLkRPTkUgPT09IHNlbGYucmVhZHlTdGF0ZSkge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHNlbGYucmVhZHlTdGF0ZSA9IHNlbGYuRE9ORTtcbiAgICAgICAgc2VsZi5lcnJvciA9IGVycjtcbiAgICAgICAgZW1pdHRlci5lbWl0KCdlcnJvcicsIGVycik7XG4gICAgICB9KTtcblxuICAgICAgc3RyZWFtLm9uKCdkYXRhJywgZnVuY3Rpb24gKGRhdGEpIHtcbiAgICAgICAgaWYgKHNlbGYuRE9ORSA9PT0gc2VsZi5yZWFkeVN0YXRlKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgYnVmZmVycy5kYXRhTGVuZ3RoICs9IGRhdGEubGVuZ3RoO1xuICAgICAgICBidWZmZXJzLnB1c2goZGF0YSk7XG5cbiAgICAgICAgZW1pdHRlci5lbWl0KCdwcm9ncmVzcycsIHtcbiAgICAgICAgICAvLyBmcy5zdGF0IHdpbGwgcHJvYmFibHkgY29tcGxldGUgYmVmb3JlIHRoaXNcbiAgICAgICAgICAvLyBidXQgcG9zc2libHkgaXQgd2lsbCBub3QsIGhlbmNlIHRoZSBjaGVja1xuICAgICAgICAgIGxlbmd0aENvbXB1dGFibGU6ICghaXNOYU4oZmlsZS5zaXplKSkgPyB0cnVlIDogZmFsc2UsXG4gICAgICAgICAgbG9hZGVkOiBidWZmZXJzLmRhdGFMZW5ndGgsXG4gICAgICAgICAgdG90YWw6IGZpbGUuc2l6ZVxuICAgICAgICB9KTtcblxuICAgICAgICBlbWl0dGVyLmVtaXQoJ2RhdGEnLCBkYXRhKTtcbiAgICAgIH0pO1xuXG4gICAgICBzdHJlYW0ub24oJ2VuZCcsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgaWYgKHNlbGYuRE9ORSA9PT0gc2VsZi5yZWFkeVN0YXRlKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIGRhdGE7XG5cbiAgICAgICAgaWYgKGJ1ZmZlcnMubGVuZ3RoID4gMSApIHtcbiAgICAgICAgICBkYXRhID0gQnVmZmVyLmNvbmNhdChidWZmZXJzKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBkYXRhID0gYnVmZmVyc1swXTtcbiAgICAgICAgfVxuXG4gICAgICAgIHNlbGYucmVhZHlTdGF0ZSA9IHNlbGYuRE9ORTtcbiAgICAgICAgc2VsZi5yZXN1bHQgPSBtYXBEYXRhVG9Gb3JtYXQoZmlsZSwgZGF0YSwgZm9ybWF0LCBlbmNvZGluZyk7XG4gICAgICAgIGVtaXR0ZXIuZW1pdCgnbG9hZCcsIHtcbiAgICAgICAgICB0YXJnZXQ6IHtcbiAgICAgICAgICAgIC8vIG5vbi1zdGFuZGFyZFxuICAgICAgICAgICAgbm9kZUJ1ZmZlclJlc3VsdDogZGF0YSxcbiAgICAgICAgICAgIHJlc3VsdDogc2VsZi5yZXN1bHRcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGVtaXR0ZXIuZW1pdCgnbG9hZGVuZCcpO1xuICAgICAgfSk7XG4gICAgfVxuXG5cbiAgICAvLyBBYm9ydCBpcyBvdmVyd3JpdHRlbiBieSByZWFkQXNYeXpcbiAgICBzZWxmLmFib3J0ID0gZnVuY3Rpb24gKCkge1xuICAgICAgaWYgKHNlbGYucmVhZFN0YXRlID09IHNlbGYuRE9ORSkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBzZWxmLnJlYWR5U3RhdGUgPSBzZWxmLkRPTkU7XG4gICAgICBlbWl0dGVyLmVtaXQoJ2Fib3J0Jyk7XG4gICAgfTtcblxuXG5cbiAgICAvLyBcbiAgICBmdW5jdGlvbiBtYXBVc2VyRXZlbnRzKCkge1xuICAgICAgZW1pdHRlci5vbignc3RhcnQnLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGRvb3Aoc2VsZi5vbmxvYWRzdGFydCwgYXJndW1lbnRzKTtcbiAgICAgIH0pO1xuICAgICAgZW1pdHRlci5vbigncHJvZ3Jlc3MnLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGRvb3Aoc2VsZi5vbnByb2dyZXNzLCBhcmd1bWVudHMpO1xuICAgICAgfSk7XG4gICAgICBlbWl0dGVyLm9uKCdlcnJvcicsIGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgICAgLy8gVE9ETyB0cmFuc2xhdGUgdG8gRmlsZUVycm9yXG4gICAgICAgIGlmIChzZWxmLm9uZXJyb3IpIHtcbiAgICAgICAgICBzZWxmLm9uZXJyb3IoZXJyKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBpZiAoIWVtaXR0ZXIubGlzdGVuZXJzLmVycm9yIHx8ICFlbWl0dGVyLmxpc3RlbmVycy5lcnJvci5sZW5ndGgpIHtcbiAgICAgICAgICAgIHRocm93IGVycjtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgICAgZW1pdHRlci5vbignbG9hZCcsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgZG9vcChzZWxmLm9ubG9hZCwgYXJndW1lbnRzKTtcbiAgICAgIH0pO1xuICAgICAgZW1pdHRlci5vbignZW5kJywgZnVuY3Rpb24gKCkge1xuICAgICAgICBkb29wKHNlbGYub25sb2FkZW5kLCBhcmd1bWVudHMpO1xuICAgICAgfSk7XG4gICAgICBlbWl0dGVyLm9uKCdhYm9ydCcsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgZG9vcChzZWxmLm9uYWJvcnQsIGFyZ3VtZW50cyk7XG4gICAgICB9KTtcbiAgICB9XG5cblxuXG4gICAgZnVuY3Rpb24gcmVhZEZpbGUoX2ZpbGUsIGZvcm1hdCwgZW5jb2RpbmcpIHtcbiAgICAgIGZpbGUgPSBfZmlsZTtcbiAgICAgIGlmICghZmlsZSB8fCAhZmlsZS5uYW1lIHx8ICEoZmlsZS5wYXRoIHx8IGZpbGUuc3RyZWFtIHx8IGZpbGUuYnVmZmVyKSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJjYW5ub3QgcmVhZCBhcyBGaWxlOiBcIiArIEpTT04uc3RyaW5naWZ5KGZpbGUpKTtcbiAgICAgIH1cbiAgICAgIGlmICgwICE9PSBzZWxmLnJlYWR5U3RhdGUpIHtcbiAgICAgICAgY29uc29sZS5sb2coXCJhbHJlYWR5IGxvYWRpbmcsIHJlcXVlc3QgdG8gY2hhbmdlIGZvcm1hdCBpZ25vcmVkXCIpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIC8vICdwcm9jZXNzLm5leHRUaWNrJyBkb2VzIG5vdCBlbnN1cmUgb3JkZXIsIChpLmUuIGFuIGZzLnN0YXQgcXVldWVkIGxhdGVyIG1heSByZXR1cm4gZmFzdGVyKVxuICAgICAgLy8gYnV0IGBvbmxvYWRzdGFydGAgbXVzdCBjb21lIGJlZm9yZSB0aGUgZmlyc3QgYGRhdGFgIGV2ZW50IGFuZCBtdXN0IGJlIGFzeW5jaHJvbm91cy5cbiAgICAgIC8vIEhlbmNlIHdlIHdhc3RlIGEgc2luZ2xlIHRpY2sgd2FpdGluZ1xuICAgICAgcHJvY2Vzcy5uZXh0VGljayhmdW5jdGlvbiAoKSB7XG4gICAgICAgIHNlbGYucmVhZHlTdGF0ZSA9IHNlbGYuTE9BRElORztcbiAgICAgICAgZW1pdHRlci5lbWl0KCdsb2Fkc3RhcnQnKTtcbiAgICAgICAgY3JlYXRlRmlsZVN0cmVhbSgpO1xuICAgICAgICBtYXBTdHJlYW1Ub0VtaXR0ZXIoZm9ybWF0LCBlbmNvZGluZyk7XG4gICAgICAgIG1hcFVzZXJFdmVudHMoKTtcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHNlbGYucmVhZEFzQXJyYXlCdWZmZXIgPSBmdW5jdGlvbiAoZmlsZSkge1xuICAgICAgcmVhZEZpbGUoZmlsZSwgJ2J1ZmZlcicpO1xuICAgIH07XG4gICAgc2VsZi5yZWFkQXNCaW5hcnlTdHJpbmcgPSBmdW5jdGlvbiAoZmlsZSkge1xuICAgICAgcmVhZEZpbGUoZmlsZSwgJ2JpbmFyeScpO1xuICAgIH07XG4gICAgc2VsZi5yZWFkQXNEYXRhVVJMID0gZnVuY3Rpb24gKGZpbGUpIHtcbiAgICAgIHJlYWRGaWxlKGZpbGUsICdkYXRhVXJsJyk7XG4gICAgfTtcbiAgICBzZWxmLnJlYWRBc1RleHQgPSBmdW5jdGlvbiAoZmlsZSwgZW5jb2RpbmcpIHtcbiAgICAgIHJlYWRGaWxlKGZpbGUsICd0ZXh0JywgZW5jb2RpbmcpO1xuICAgIH07XG4gIH1cblxuICBtb2R1bGUuZXhwb3J0cyA9IEZpbGVSZWFkZXI7XG59KCkpO1xuIiwidmFyIGNvbmZpZyA9IHJlcXVpcmUoJy4uLy4uL2NvbmZpZy5qc29uJyk7XG52YXIgQ2x1bXAgPSByZXF1aXJlKCcuL29iamVjdHMvY2x1bXAnKTtcbnZhciBMdW1wID0gcmVxdWlyZSgnLi9vYmplY3RzL2x1bXAnKTtcblxudmFyIGlvID0gcmVxdWlyZSgnLi9pbycpO1xuXG52YXIgbGlicmFyeSA9IHJlcXVpcmUoJy4vbGlicmFyeScpO1xudmFyIGxvYWRlZCA9IHt9O1xuXG52YXIgdHlwZXMgPSB7XG4gIFF1YWxpdHk6IHJlcXVpcmUoJy4vb2JqZWN0cy9xdWFsaXR5JyksXG4gIEV2ZW50OiByZXF1aXJlKCcuL29iamVjdHMvZXZlbnQnKSxcbiAgSW50ZXJhY3Rpb246IHJlcXVpcmUoJy4vb2JqZWN0cy9pbnRlcmFjdGlvbicpLFxuICBRdWFsaXR5RWZmZWN0OiByZXF1aXJlKCcuL29iamVjdHMvcXVhbGl0eS1lZmZlY3QnKSxcbiAgUXVhbGl0eVJlcXVpcmVtZW50OiByZXF1aXJlKCcuL29iamVjdHMvcXVhbGl0eS1yZXF1aXJlbWVudCcpLFxuICBBcmVhOiByZXF1aXJlKCcuL29iamVjdHMvYXJlYScpLFxuICBTcGF3bmVkRW50aXR5OiByZXF1aXJlKCcuL29iamVjdHMvc3Bhd25lZC1lbnRpdHknKSxcbiAgQ29tYmF0QXR0YWNrOiByZXF1aXJlKCcuL29iamVjdHMvY29tYmF0LWF0dGFjaycpLFxuICBFeGNoYW5nZTogcmVxdWlyZSgnLi9vYmplY3RzL2V4Y2hhbmdlJyksXG4gIFNob3A6IHJlcXVpcmUoJy4vb2JqZWN0cy9zaG9wJyksXG4gIEF2YWlsYWJpbGl0eTogcmVxdWlyZSgnLi9vYmplY3RzL2F2YWlsYWJpbGl0eScpLFxuICBUaWxlOiByZXF1aXJlKCcuL29iamVjdHMvdGlsZScpLFxuICBUaWxlVmFyaWFudDogcmVxdWlyZSgnLi9vYmplY3RzL3RpbGUtdmFyaWFudCcpLFxuICBQb3J0OiByZXF1aXJlKCcuL29iamVjdHMvcG9ydCcpLFxufTtcblxuLy8gUHJlcG9wdWxhdGUgbGlicmFyeSB3aXRoIENsdW1wcyBvZiBlYWNoIHR5cGUgd2Uga25vdyBhYm91dFxuT2JqZWN0LmtleXModHlwZXMpLmZvckVhY2goZnVuY3Rpb24odHlwZU5hbWUpIHtcblx0dmFyIFR5cGUgPSB0eXBlc1t0eXBlTmFtZV07XG5cdGlmKCFsaWJyYXJ5W3R5cGVOYW1lXSkge1xuXHRcdGxpYnJhcnlbdHlwZU5hbWVdID0gbmV3IENsdW1wKFtdLCBUeXBlKTtcblx0XHRsb2FkZWRbdHlwZU5hbWVdID0gbmV3IENsdW1wKFtdLCBUeXBlKTtcblx0fVxufSk7XG5cbmZ1bmN0aW9uIGdldChUeXBlLCBpZCwgcGFyZW50KSB7XG5cdHZhciB0eXBlbmFtZSA9IFR5cGUubmFtZTtcdC8vIEV2ZW50LCBRdWFsaXR5LCBJbnRlcmFjdGlvbiwgZXRjXG5cblx0dmFyIGV4aXN0aW5nVGhpbmdXaXRoVGhpc0lkID0gbGlicmFyeVt0eXBlbmFtZV0uaWQoaWQpO1xuXHRpZihleGlzdGluZ1RoaW5nV2l0aFRoaXNJZCkge1xuXHRcdC8vY29uc29sZS5sb2coXCJBdHRhY2hlZCBleGlzdGluZyBcIiArIGV4aXN0aW5nVGhpbmdXaXRoVGhpc0lkICsgXCIgdG8gXCIgKyB0aGlzLnRvU3RyaW5nKCkpXG5cdFx0dmFyIG5ld1BhcmVudCA9IHRydWU7XG5cdFx0ZXhpc3RpbmdUaGluZ1dpdGhUaGlzSWQucGFyZW50cy5mb3JFYWNoKGZ1bmN0aW9uKHApIHtcblx0XHRcdGlmKHAuSWQgPT09IHBhcmVudC5JZCAmJiBwLmNvbnN0cnVjdG9yLm5hbWUgPT09IHBhcmVudC5jb25zdHJ1Y3Rvci5uYW1lKSB7XG5cdFx0XHRcdG5ld1BhcmVudCA9IGZhbHNlO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHRcdGlmKG5ld1BhcmVudCl7XG5cdFx0XHRleGlzdGluZ1RoaW5nV2l0aFRoaXNJZC5wYXJlbnRzLnB1c2gocGFyZW50KTtcblx0XHR9XG5cblx0XHRpZighZXhpc3RpbmdUaGluZ1dpdGhUaGlzSWQud2lyZWQpIHtcblx0XHRcdGV4aXN0aW5nVGhpbmdXaXRoVGhpc0lkLndpcmVVcCh0aGlzKTtcdC8vIFBhc3MgaW4gdGhlIGFwaSBzbyBvYmplY3QgY2FuIGFkZCBpdHNlbGYgdG8gdGhlIG1hc3Rlci1saWJyYXJ5XG5cdFx0fVxuXHRcdHJldHVybiBleGlzdGluZ1RoaW5nV2l0aFRoaXNJZDtcblx0fVxuXHRlbHNlIHtcblx0XHRyZXR1cm4gbnVsbDtcblx0fVxufVxuXG5mdW5jdGlvbiBnZXRPckNyZWF0ZShUeXBlLCBwb3NzTmV3VGhpbmcsIHBhcmVudCkge1x0Ly8gSWYgYW4gb2JqZWN0IGFscmVhZHkgZXhpc3RzIHdpdGggdGhpcyBJRCwgdXNlIHRoYXQuICBPdGhlcndpc2UgY3JlYXRlIGEgbmV3IG9iamVjdCBmcm9tIHRoZSBzdXBwbGllZCBkZXRhaWxzIGhhc2hcblx0dmFyIHR5cGVuYW1lID0gVHlwZS5uYW1lO1x0Ly8gRXZlbnQsIFF1YWxpdHksIEludGVyYWN0aW9uLCBldGNcblx0aWYocG9zc05ld1RoaW5nKSB7XG4gIFx0dmFyIGV4aXN0aW5nVGhpbmdXaXRoVGhpc0lkID0gdGhpcy5nZXQoVHlwZSwgcG9zc05ld1RoaW5nLklkLCBwYXJlbnQpO1xuICBcdGlmKGV4aXN0aW5nVGhpbmdXaXRoVGhpc0lkKSB7XG4gIFx0XHRyZXR1cm4gZXhpc3RpbmdUaGluZ1dpdGhUaGlzSWQ7XG4gIFx0fVxuICBcdGVsc2Uge1xuXHRcdFx0dmFyIG5ld1RoaW5nID0gbmV3IFR5cGUocG9zc05ld1RoaW5nLCBwYXJlbnQpO1xuXHRcdFx0bmV3VGhpbmcud2lyZVVwKHRoaXMpO1xuXHRcdFx0Ly9jb25zb2xlLmxvZyhcIlJlY3Vyc2l2ZWx5IGNyZWF0ZWQgXCIgKyBuZXdUaGluZyArIFwiIGZvciBcIiArIHRoaXMudG9TdHJpbmcoKSk7XG5cdFx0XHRyZXR1cm4gbmV3VGhpbmc7XG5cdFx0fVxuXHR9XG5cdGVsc2Uge1xuXHRcdHJldHVybiBudWxsO1xuXHR9XG59XG5cbmZ1bmN0aW9uIHdpcmVVcE9iamVjdHMoKSB7XG5cdHZhciBhcGkgPSB0aGlzO1xuICBPYmplY3Qua2V5cyh0eXBlcykuZm9yRWFjaChmdW5jdGlvbih0eXBlKSB7XG4gICAgbGlicmFyeVt0eXBlXS5mb3JFYWNoKGZ1bmN0aW9uKGx1bXApIHtcbiAgICAgIGlmKGx1bXAud2lyZVVwKSB7XG4gICAgICAgIGx1bXAud2lyZVVwKGFwaSk7XG4gICAgICB9XG4gICAgfSk7XG4gIH0pO1xufVxuXG52YXIgd2hhdElzID0gZnVuY3Rpb24oaWQpIHtcbiAgdmFyIHBvc3NpYmlsaXRpZXMgPSBbXTtcbiAgT2JqZWN0LmtleXMobGlicmFyeSkuZm9yRWFjaChmdW5jdGlvbihrZXkpIHtcbiAgICBpZihsaWJyYXJ5W2tleV0gaW5zdGFuY2VvZiBDbHVtcCAmJiBsaWJyYXJ5W2tleV0uaWQoaWQpKSB7XG4gICAgICBwb3NzaWJpbGl0aWVzLnB1c2goa2V5KTtcbiAgICB9XG4gIH0pO1xuICByZXR1cm4gcG9zc2liaWxpdGllcztcbn07XG5cbmZ1bmN0aW9uIGRlc2NyaWJlQWR2YW5jZWRFeHByZXNzaW9uKGV4cHIpIHtcblx0dmFyIHNlbGYgPSB0aGlzO1xuXHRpZihleHByKSB7XG5cdFx0ZXhwciA9IGV4cHIucmVwbGFjZSgvXFxbZDooXFxkKylcXF0vZ2ksIFwiUkFORE9NWzEtJDFdXCIpO1x0Ly8gW2Q6eF0gPSByYW5kb20gbnVtYmVyIGZyb20gMS14KD8pXG5cdFx0ZXhwciA9IGV4cHIucmVwbGFjZSgvXFxbcTooXFxkKylcXF0vZ2ksIGZ1bmN0aW9uKG1hdGNoLCBiYWNrcmVmLCBwb3MsIHdob2xlX3N0cikge1xuXHRcdFx0dmFyIHF1YWxpdHkgPSBzZWxmLmxpYnJhcnkuUXVhbGl0eS5pZChiYWNrcmVmKTtcblx0XHRcdHJldHVybiBcIltcIisocXVhbGl0eSA/IHF1YWxpdHkuTmFtZSA6ICdJTlZBTElEJykrXCJdXCI7XG5cdFx0fSk7XG5cblx0XHRyZXR1cm4gZXhwcjtcblx0fVxuXHRyZXR1cm4gbnVsbDtcbn1cblxuZnVuY3Rpb24gcmVhZEZyb21GaWxlKFR5cGUsIGZpbGUsIGNhbGxiYWNrKSB7XG5cdGlvLnJlYWRGaWxlKGZpbGUsIGZ1bmN0aW9uIChlKSB7XG4gICAgdmFyIGNvbnRlbnRzID0gZS50YXJnZXQucmVzdWx0O1xuICAgIFxuICAgIHZhciBvYmogPSBKU09OLnBhcnNlKGNvbnRlbnRzKTtcbiAgICBsb2FkZWRbVHlwZS5wcm90b3R5cGUuY29uc3RydWN0b3IubmFtZV0gPSBuZXcgQ2x1bXAob2JqLCBUeXBlKTtcblxuICAgIGNhbGxiYWNrKGNvbnRlbnRzLCBUeXBlLCBsb2FkZWRbVHlwZS5wcm90b3R5cGUuY29uc3RydWN0b3IubmFtZV0pO1xuICB9KTtcbn1cblxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcblx0J0NsdW1wJzogQ2x1bXAsXG5cdCdMdW1wJzogTHVtcCxcblx0J2NvbmZpZyc6IGNvbmZpZyxcblx0J3R5cGVzJzogdHlwZXMsXG5cdCdsaWJyYXJ5JzogbGlicmFyeSxcblx0J2xvYWRlZCc6IGxvYWRlZCxcblx0J2dldCc6IGdldCxcblx0J3doYXRJcyc6IHdoYXRJcyxcblx0J3dpcmVVcE9iamVjdHMnOiB3aXJlVXBPYmplY3RzLFxuXHQnZ2V0T3JDcmVhdGUnOiBnZXRPckNyZWF0ZSxcblx0J2Rlc2NyaWJlQWR2YW5jZWRFeHByZXNzaW9uJzogZGVzY3JpYmVBZHZhbmNlZEV4cHJlc3Npb24sXG5cdCdyZWFkRnJvbUZpbGUnOiByZWFkRnJvbUZpbGVcbn07IiwiXG5pZih0eXBlb2YgRmlsZVJlYWRlciA9PT0gJ3VuZGVmaW5lZCcpIHsgLy8gUnVubmluZyBpbiBub2RlIHJhdGhlciB0aGFuIGEgYnJvd3NlclxuICBGaWxlUmVhZGVyID0gcmVxdWlyZSgnZmlsZXJlYWRlcicpO1xufVxuXG52YXIgZmlsZU9iamVjdE1hcCA9IHtcbiAgICAnZXZlbnRzLmpzb24nIDogJ0V2ZW50JyxcbiAgICAncXVhbGl0aWVzLmpzb24nIDogJ1F1YWxpdHknLFxuICAgICdhcmVhcy5qc29uJyA6ICdBcmVhJyxcbiAgICAnU3Bhd25lZEVudGl0aWVzLmpzb24nIDogJ1NwYXduZWRFbnRpdHknLFxuICAgICdDb21iYXRBdHRhY2tzLmpzb24nIDogJ0NvbWJhdEF0dGFjaycsXG4gICAgJ2V4Y2hhbmdlcy5qc29uJyA6ICdFeGNoYW5nZScsXG4gICAgJ1RpbGVzLmpzb24nOiAnVGlsZSdcbiAgfTtcblxuZnVuY3Rpb24gcmVhZEZpbGUoZmlsZSwgY2FsbGJhY2spIHtcbiAgdmFyIHJlYWRlciA9IG5ldyBGaWxlUmVhZGVyKCk7XG4gIHJlYWRlci5vbmxvYWQgPSBjYWxsYmFjaztcbiAgcmVhZGVyLnJlYWRBc1RleHQoZmlsZSk7XG59XG5cbnZhciBmaWxlc190b19sb2FkID0gMDtcbmZ1bmN0aW9uIHJlc2V0RmlsZXNUb0xvYWQoKSB7XG5cdGZpbGVzX3RvX2xvYWQgPSAwO1xufVxuZnVuY3Rpb24gaW5jcmVtZW50RmlsZXNUb0xvYWQoKSB7XG5cdGZpbGVzX3RvX2xvYWQrKztcbn1cbmZ1bmN0aW9uIGRlY3JlbWVudEZpbGVzVG9Mb2FkKCkge1xuXHRmaWxlc190b19sb2FkLS07XG59XG5mdW5jdGlvbiBjb3VudEZpbGVzVG9Mb2FkKCkge1xuXHRyZXR1cm4gZmlsZXNfdG9fbG9hZDtcbn1cblxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgcmVhZEZpbGU6IHJlYWRGaWxlLFxuICByZXNldEZpbGVzVG9Mb2FkOiByZXNldEZpbGVzVG9Mb2FkLFxuXHRpbmNyZW1lbnRGaWxlc1RvTG9hZDogaW5jcmVtZW50RmlsZXNUb0xvYWQsXG5cdGRlY3JlbWVudEZpbGVzVG9Mb2FkOiBkZWNyZW1lbnRGaWxlc1RvTG9hZCxcblx0Y291bnRGaWxlc1RvTG9hZDogY291bnRGaWxlc1RvTG9hZCxcbiAgZmlsZU9iamVjdE1hcDogZmlsZU9iamVjdE1hcFxufTsiLCJtb2R1bGUuZXhwb3J0cyA9IHt9OyIsInZhciBMdW1wID0gcmVxdWlyZSgnLi9sdW1wJyk7XG5cbnZhciBhcGk7XG5cbmZ1bmN0aW9uIEFyZWEocmF3KSB7XG5cdHRoaXMuc3RyYWlnaHRDb3B5ID0gW1wiTmFtZVwiLCBcIkRlc2NyaXB0aW9uXCIsIFwiSW1hZ2VOYW1lXCIsIFwiTW92ZU1lc3NhZ2VcIl07XG5cdEx1bXAuY2FsbCh0aGlzLCByYXcpO1xufVxuT2JqZWN0LmtleXMoTHVtcC5wcm90b3R5cGUpLmZvckVhY2goZnVuY3Rpb24obWVtYmVyKSB7IEFyZWEucHJvdG90eXBlW21lbWJlcl0gPSBMdW1wLnByb3RvdHlwZVttZW1iZXJdOyB9KTtcblxuQXJlYS5wcm90b3R5cGUud2lyZVVwID0gZnVuY3Rpb24odGhlQXBpKSB7XG5cdGFwaSA9IHRoZUFwaTtcblx0THVtcC5wcm90b3R5cGUud2lyZVVwLmNhbGwodGhpcyk7XG59O1xuXG5BcmVhLnByb3RvdHlwZS50b1N0cmluZyA9IGZ1bmN0aW9uKCkge1xuXHRyZXR1cm4gdGhpcy5jb25zdHJ1Y3Rvci5uYW1lICsgXCIgXCIgKyB0aGlzLk5hbWUgKyBcIiAoI1wiICsgdGhpcy5JZCArIFwiKVwiO1xufTtcblxuQXJlYS5wcm90b3R5cGUudG9Eb20gPSBmdW5jdGlvbihzaXplKSB7XG5cblx0c2l6ZSA9IHNpemUgfHwgXCJub3JtYWxcIjtcblxuXHR2YXIgZWxlbWVudCA9ICBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwibGlcIik7XG5cdGVsZW1lbnQuY2xhc3NOYW1lID0gXCJpdGVtIFwiK3RoaXMuY29uc3RydWN0b3IubmFtZS50b0xvd2VyQ2FzZSgpK1wiLWl0ZW0gXCIrc2l6ZTtcblxuXHRpZih0aGlzLkltYWdlTmFtZSAhPT0gbnVsbCAmJiB0aGlzLkltYWdlICE9PSBcIlwiKSB7XG5cdFx0ZWxlbWVudC5pbm5lckhUTUwgPSBcIjxpbWcgY2xhc3M9J2ljb24nIHNyYz0nXCIrYXBpLmNvbmZpZy5sb2NhdGlvbnMuaW1hZ2VzUGF0aCtcIi9cIit0aGlzLkltYWdlTmFtZStcIi5wbmcnIC8+XCI7XG5cdH1cblxuXHRlbGVtZW50LmlubmVySFRNTCArPSBcIlxcbjxoMyBjbGFzcz0ndGl0bGUnPlwiK3RoaXMuTmFtZStcIjwvaDM+XFxuPHAgY2xhc3M9J2Rlc2NyaXB0aW9uJz5cIit0aGlzLkRlc2NyaXB0aW9uK1wiPC9wPlwiO1xuXG5cdGVsZW1lbnQudGl0bGUgPSB0aGlzLnRvU3RyaW5nKCk7XG5cblx0cmV0dXJuIGVsZW1lbnQ7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEFyZWE7IiwidmFyIEx1bXAgPSByZXF1aXJlKCcuL2x1bXAnKTtcblxudmFyIGFwaTtcblxuZnVuY3Rpb24gQXZhaWxhYmlsaXR5KHJhdywgcGFyZW50KSB7XG5cdHRoaXMuc3RyYWlnaHRDb3B5ID0gW1xuXHRcdCdDb3N0Jyxcblx0XHQnU2VsbFByaWNlJ1xuXHRdO1xuXHRMdW1wLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG5cblx0dGhpcy5xdWFsaXR5ID0gbnVsbDtcblx0dGhpcy5wdXJjaGFzZVF1YWxpdHkgPSBudWxsO1xufVxuT2JqZWN0LmtleXMoTHVtcC5wcm90b3R5cGUpLmZvckVhY2goZnVuY3Rpb24obWVtYmVyKSB7IEF2YWlsYWJpbGl0eS5wcm90b3R5cGVbbWVtYmVyXSA9IEx1bXAucHJvdG90eXBlW21lbWJlcl07IH0pO1xuXG5BdmFpbGFiaWxpdHkucHJvdG90eXBlLndpcmVVcCA9IGZ1bmN0aW9uKHRoZUFwaSkge1xuXG5cdGFwaSA9IHRoZUFwaTtcblxuXHR0aGlzLnF1YWxpdHkgPSBhcGkuZ2V0T3JDcmVhdGUoYXBpLnR5cGVzLlF1YWxpdHksIHRoaXMuYXR0cmlicy5RdWFsaXR5LCB0aGlzKTtcblx0dGhpcy5wdXJjaGFzZVF1YWxpdHkgPSBhcGkuZ2V0T3JDcmVhdGUoYXBpLnR5cGVzLlF1YWxpdHksIHRoaXMuYXR0cmlicy5QdXJjaGFzZVF1YWxpdHksIHRoaXMpO1xuXG5cdEx1bXAucHJvdG90eXBlLndpcmVVcC5jYWxsKHRoaXMsIGFwaSk7XG59O1xuXG5BdmFpbGFiaWxpdHkucHJvdG90eXBlLmlzQWRkaXRpdmUgPSBmdW5jdGlvbigpIHtcblx0cmV0dXJuIHRoaXMuQ29zdCA+IDA7XG59O1xuXG5BdmFpbGFiaWxpdHkucHJvdG90eXBlLmlzU3VidHJhY3RpdmUgPSBmdW5jdGlvbigpIHtcblx0cmV0dXJuIHRoaXMuU2VsbFByaWNlID4gMDtcbn07XG5cbkF2YWlsYWJpbGl0eS5wcm90b3R5cGUudG9TdHJpbmcgPSBmdW5jdGlvbigpIHtcblx0cmV0dXJuIHRoaXMuY29uc3RydWN0b3IubmFtZSArIFwiIFwiICsgdGhpcy5xdWFsaXR5ICsgXCIgKGJ1eTogXCIgKyB0aGlzLkNvc3QgKyBcInhcIiArIHRoaXMucHVyY2hhc2VRdWFsaXR5Lk5hbWUgKyBcIiAvIHNlbGw6IFwiICsgdGhpcy5TZWxsUHJpY2UgKyBcInhcIiArIHRoaXMucHVyY2hhc2VRdWFsaXR5Lk5hbWUgKyBcIilcIjtcbn07XG5cbkF2YWlsYWJpbGl0eS5wcm90b3R5cGUudG9Eb20gPSBmdW5jdGlvbihzaXplKSB7XG5cblx0c2l6ZSA9IHNpemUgfHwgXCJzbWFsbFwiO1xuXG5cdHZhciBlbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImxpXCIpO1xuXHRlbGVtZW50LmNsYXNzTmFtZSA9IFwiaXRlbSBcIit0aGlzLmNvbnN0cnVjdG9yLm5hbWUudG9Mb3dlckNhc2UoKStcIi1pdGVtIFwiK3NpemU7XG5cdFxuXHR2YXIgcHVyY2hhc2VfcXVhbGl0eV9lbGVtZW50O1xuXG5cdGlmKCF0aGlzLnF1YWxpdHkpIHtcblx0XHRwdXJjaGFzZV9xdWFsaXR5X2VsZW1lbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwic3BhblwiKTtcblx0XHRwdXJjaGFzZV9xdWFsaXR5X2VsZW1lbnQuaW5uZXJIVE1MID0gXCJbSU5WQUxJRF1cIjtcblx0fVxuXHRlbHNlIHtcblx0XHRwdXJjaGFzZV9xdWFsaXR5X2VsZW1lbnQgPSB0aGlzLnF1YWxpdHkudG9Eb20oXCJzbWFsbFwiLCBmYWxzZSwgXCJzcGFuXCIpO1xuXHR9XG5cblx0dmFyIGN1cnJlbmN5X3F1YWxpdHlfZWxlbWVudCA9IHRoaXMucHVyY2hhc2VRdWFsaXR5LnRvRG9tKFwic21hbGxcIiwgZmFsc2UsIFwic3BhblwiKTtcblx0Y3VycmVuY3lfcXVhbGl0eV9lbGVtZW50LmNsYXNzTmFtZSA9IFwicXVhbnRpdHkgaXRlbSBzbWFsbFwiO1xuXHR2YXIgY3VycmVuY3lfcXVhbGl0eV9tYXJrdXAgPSBjdXJyZW5jeV9xdWFsaXR5X2VsZW1lbnQub3V0ZXJIVE1MO1xuXG5cdHZhciBjdXJyZW5jeV9idXlfYW1vdW50X2VsZW1lbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwic3BhblwiKTtcblx0Y3VycmVuY3lfYnV5X2Ftb3VudF9lbGVtZW50LmNsYXNzTmFtZSA9IFwiaXRlbSBxdWFudGl0eVwiO1xuXHRjdXJyZW5jeV9idXlfYW1vdW50X2VsZW1lbnQuaW5uZXJIVE1MID0gXCJCdXk6IFwiICsgKHRoaXMuQ29zdCA/IHRoaXMuQ29zdCtcInhcIiA6IFwiJiMxMDAwNztcIik7XG5cdGN1cnJlbmN5X2J1eV9hbW91bnRfZWxlbWVudC50aXRsZSA9IHRoaXMudG9TdHJpbmcoKTtcblxuXHR2YXIgY3VycmVuY3lfc2VsbF9hbW91bnRfZWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJzcGFuXCIpO1xuXHRjdXJyZW5jeV9zZWxsX2Ftb3VudF9lbGVtZW50LmNsYXNzTmFtZSA9IFwiaXRlbSBxdWFudGl0eVwiO1xuXHRjdXJyZW5jeV9zZWxsX2Ftb3VudF9lbGVtZW50LmlubmVySFRNTCA9IFwiU2VsbDogXCIgKyAodGhpcy5TZWxsUHJpY2UgPyB0aGlzLlNlbGxQcmljZStcInhcIiA6IFwiJiMxMDAwNztcIik7XG5cdGN1cnJlbmN5X3NlbGxfYW1vdW50X2VsZW1lbnQudGl0bGUgPSB0aGlzLnRvU3RyaW5nKCk7XG5cblxuXHRlbGVtZW50LmFwcGVuZENoaWxkKHB1cmNoYXNlX3F1YWxpdHlfZWxlbWVudCk7XG5cdGVsZW1lbnQuYXBwZW5kQ2hpbGQoY3VycmVuY3lfYnV5X2Ftb3VudF9lbGVtZW50KTtcblx0aWYodGhpcy5Db3N0KSB7XG5cdFx0ZWxlbWVudC5hcHBlbmRDaGlsZCgkKGN1cnJlbmN5X3F1YWxpdHlfbWFya3VwKVswXSk7XG5cdH1cblx0ZWxlbWVudC5hcHBlbmRDaGlsZChjdXJyZW5jeV9zZWxsX2Ftb3VudF9lbGVtZW50KTtcblx0aWYodGhpcy5TZWxsUHJpY2UpIHtcblx0XHRlbGVtZW50LmFwcGVuZENoaWxkKCQoY3VycmVuY3lfcXVhbGl0eV9tYXJrdXApWzBdKTtcblx0fVxuXG5cdHJldHVybiBlbGVtZW50O1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBBdmFpbGFiaWxpdHk7IiwiXG5mdW5jdGlvbiBDbHVtcChyYXcsIFR5cGUsIHBhcmVudCkge1xuXHR0aGlzLnR5cGUgPSBUeXBlO1xuXHR0aGlzLml0ZW1zID0ge307XG5cdHZhciBzZWxmID0gdGhpcztcblx0cmF3LmZvckVhY2goZnVuY3Rpb24oaXRlbSwgaW5kZXgsIGNvbGxlY3Rpb24pIHtcblx0XHRpZighKGl0ZW0gaW5zdGFuY2VvZiBUeXBlKSkge1xuXHRcdFx0aXRlbSA9IG5ldyBUeXBlKGl0ZW0sIHBhcmVudCk7XG5cdFx0fVxuXHRcdGVsc2UgaWYocGFyZW50KSB7XG5cdFx0XHR2YXIgbmV3UGFyZW50ID0gdHJ1ZTtcblx0XHRcdGl0ZW0ucGFyZW50cy5mb3JFYWNoKGZ1bmN0aW9uKHApIHtcblx0XHRcdFx0aWYocC5JZCA9PT0gcGFyZW50LklkICYmIHAuY29uc3RydWN0b3IubmFtZSA9PT0gcGFyZW50LmNvbnN0cnVjdG9yLm5hbWUpIHtcblx0XHRcdFx0XHRuZXdQYXJlbnQgPSBmYWxzZTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0XHRpZihuZXdQYXJlbnQpe1xuXHRcdFx0XHRpdGVtLnBhcmVudHMucHVzaChwYXJlbnQpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRzZWxmLml0ZW1zW2l0ZW0uSWRdID0gaXRlbTtcblx0fSk7XG59XG5cbkNsdW1wLnByb3RvdHlwZS5lbXB0eSA9IGZ1bmN0aW9uKCkge1xuXHRyZXR1cm4gISF0aGlzLnNpemUoKTtcbn07XG5cbkNsdW1wLnByb3RvdHlwZS5zaXplID0gZnVuY3Rpb24oKSB7XG5cdHJldHVybiBPYmplY3Qua2V5cyh0aGlzLml0ZW1zKS5sZW5ndGg7XG59O1xuXG5DbHVtcC5wcm90b3R5cGUuZ2V0ID0gZnVuY3Rpb24oaW5kZXgpIHtcblx0Zm9yKHZhciBpZCBpbiB0aGlzLml0ZW1zKSB7XG5cdFx0aWYoaW5kZXggPT09IDApIHtcblx0XHRcdHJldHVybiB0aGlzLml0ZW1zW2lkXTtcblx0XHR9XG5cdFx0aW5kZXgtLTtcblx0fVxufTtcblxuQ2x1bXAucHJvdG90eXBlLmlkID0gZnVuY3Rpb24oaWQpIHtcblx0cmV0dXJuIHRoaXMuaXRlbXNbaWRdO1xufTtcblxuQ2x1bXAucHJvdG90eXBlLmVhY2ggPSBmdW5jdGlvbigpIHtcblx0dmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpO1xuXHRyZXR1cm4gdGhpcy5tYXAoZnVuY3Rpb24oaXRlbSkge1xuXG5cdFx0aWYoYXJnc1swXSBpbnN0YW5jZW9mIEFycmF5KSB7XHQvLyBQYXNzZWQgaW4gYXJyYXkgb2YgZmllbGRzLCBzbyByZXR1cm4gdmFsdWVzIGNvbmNhdGVuYXRlZCB3aXRoIG9wdGlvbmFsIHNlcGFyYXRvclxuXHRcdFx0dmFyIHNlcGFyYXRvciA9ICh0eXBlb2YgYXJnc1sxXSA9PT0gXCJ1bmRlZmluZWRcIikgPyBcIi1cIiA6IGFyZ3NbMV07XG5cdFx0XHRyZXR1cm4gYXJnc1swXS5tYXAoZnVuY3Rpb24oZikgeyByZXR1cm4gaXRlbVtmXTsgfSkuam9pbihzZXBhcmF0b3IpO1xuXHRcdH1cblx0XHRlbHNlIGlmKGFyZ3MubGVuZ3RoID4gMSkge1x0Ly8gUGFzc2VkIGluIHNlcGFyYXRlIGZpZWxkcywgc28gcmV0dXJuIGFycmF5IG9mIHZhbHVlc1xuXHRcdFx0cmV0dXJuIGFyZ3MubWFwKGZ1bmN0aW9uKGYpIHsgcmV0dXJuIGl0ZW1bZl07IH0pO1xuXHRcdH1cblx0XHRlbHNlIHtcblx0XHRcdHJldHVybiBpdGVtW2FyZ3NbMF1dO1xuXHRcdH1cblx0fSk7XG59O1xuXG5DbHVtcC5wcm90b3R5cGUuZm9yRWFjaCA9IGZ1bmN0aW9uKGNhbGxiYWNrKSB7XG5cdGZvcih2YXIgaWQgaW4gdGhpcy5pdGVtcykge1xuXHRcdHZhciBpdGVtID0gdGhpcy5pdGVtc1tpZF07XG5cdFx0Y2FsbGJhY2soaXRlbSwgaWQsIHRoaXMuaXRlbXMpO1xuXHR9XG59O1xuXG5DbHVtcC5wcm90b3R5cGUubWFwID0gZnVuY3Rpb24oY2FsbGJhY2spIHtcblx0dmFyIHNlbGYgPSB0aGlzO1xuXHR2YXIgYXJyYXlPZkl0ZW1zID0gT2JqZWN0LmtleXModGhpcy5pdGVtcykubWFwKGZ1bmN0aW9uKGtleSkge1xuXHRcdHJldHVybiBzZWxmLml0ZW1zW2tleV07XG5cdH0pO1xuXHRyZXR1cm4gYXJyYXlPZkl0ZW1zLm1hcC5jYWxsKGFycmF5T2ZJdGVtcywgY2FsbGJhY2spO1xufTtcblxuQ2x1bXAucHJvdG90eXBlLnNvcnRCeSA9IGZ1bmN0aW9uKGZpZWxkLCByZXZlcnNlKSB7XG5cdHZhciBzZWxmID0gdGhpcztcblx0dmFyIG9ianMgPSBPYmplY3Qua2V5cyh0aGlzLml0ZW1zKS5tYXAoZnVuY3Rpb24oa2V5KSB7XG5cdFx0cmV0dXJuIHNlbGYuaXRlbXNba2V5XTtcblx0fSkuc29ydChmdW5jdGlvbihhLCBiKSB7XG5cdFx0aWYoYVtmaWVsZF0gPCBiW2ZpZWxkXSkge1xuXHRcdFx0cmV0dXJuIC0xO1xuXHRcdH1cblx0XHRpZihhW2ZpZWxkXSA9PT0gYltmaWVsZF0pIHtcblx0XHRcdHJldHVybiAwO1xuXHRcdH1cblx0XHRpZihhW2ZpZWxkXSA+IGJbZmllbGRdKSB7XG5cdFx0XHRyZXR1cm4gMTtcblx0XHR9XG5cdH0pO1xuXG5cdHJldHVybiByZXZlcnNlID8gb2Jqcy5yZXZlcnNlKCkgOiBvYmpzO1xufTtcblxuQ2x1bXAucHJvdG90eXBlLnNhbWUgPSBmdW5jdGlvbigpIHtcblx0dmFyIHNlbGYgPSB0aGlzO1xuXG5cdHZhciBjbG9uZSA9IGZ1bmN0aW9uKG9iaikge1xuICAgIHZhciB0YXJnZXQgPSB7fTtcbiAgICBmb3IgKHZhciBpIGluIG9iaikge1xuICAgIFx0aWYgKG9iai5oYXNPd25Qcm9wZXJ0eShpKSkge1xuICAgIFx0XHRpZih0eXBlb2Ygb2JqW2ldID09PSBcIm9iamVjdFwiKSB7XG4gICAgXHRcdFx0dGFyZ2V0W2ldID0gY2xvbmUob2JqW2ldKTtcbiAgICBcdFx0fVxuICAgIFx0XHRlbHNlIHtcbiAgICAgIFx0XHR0YXJnZXRbaV0gPSBvYmpbaV07XG4gICAgICBcdH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHRhcmdldDtcbiAgfTtcblxuXHR2YXIgdGVtcGxhdGUgPSBjbG9uZSh0aGlzLmdldCgwKS5hdHRyaWJzKTtcblxuXHRmb3IodmFyIGlkIGluIHRoaXMuaXRlbXMpIHtcblx0XHR2YXIgb3RoZXJPYmogPSB0aGlzLml0ZW1zW2lkXS5hdHRyaWJzO1xuXHRcdGZvcih2YXIga2V5IGluIHRlbXBsYXRlKSB7XG5cdFx0XHRpZih0ZW1wbGF0ZVtrZXldICE9PSBvdGhlck9ialtrZXldKSB7XG5cdFx0XHRcdGRlbGV0ZSh0ZW1wbGF0ZVtrZXldKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRyZXR1cm4gdGVtcGxhdGU7XG59O1xuXG5DbHVtcC5wcm90b3R5cGUuZGlzdGluY3QgPSBmdW5jdGlvbihmaWVsZCkge1xuXHR2YXIgc2FtcGxlVmFsdWVzID0ge307XG5cdHRoaXMuZm9yRWFjaChmdW5jdGlvbihpdGVtKSB7XG5cdFx0dmFyIHZhbHVlID0gaXRlbVtmaWVsZF07XG5cdFx0c2FtcGxlVmFsdWVzW3ZhbHVlXSA9IHZhbHVlO1x0Ly8gQ2hlYXAgZGUtZHVwaW5nIHdpdGggYSBoYXNoXG5cdH0pO1xuXHRyZXR1cm4gT2JqZWN0LmtleXMoc2FtcGxlVmFsdWVzKS5tYXAoZnVuY3Rpb24oa2V5KSB7IHJldHVybiBzYW1wbGVWYWx1ZXNba2V5XTsgfSk7XG59O1xuXG5DbHVtcC5wcm90b3R5cGUuZGlzdGluY3RSYXcgPSBmdW5jdGlvbihmaWVsZCkge1xuXHR2YXIgc2FtcGxlVmFsdWVzID0ge307XG5cdHRoaXMuZm9yRWFjaChmdW5jdGlvbihpdGVtKSB7XG5cdFx0dmFyIHZhbHVlID0gaXRlbS5hdHRyaWJzW2ZpZWxkXTtcblx0XHRzYW1wbGVWYWx1ZXNbdmFsdWVdID0gdmFsdWU7XHQvLyBDaGVhcCBkZS1kdXBpbmcgd2l0aCBhIGhhc2hcblx0fSk7XG5cdHJldHVybiBPYmplY3Qua2V5cyhzYW1wbGVWYWx1ZXMpLm1hcChmdW5jdGlvbihrZXkpIHsgcmV0dXJuIHNhbXBsZVZhbHVlc1trZXldOyB9KTtcbn07XG5cbkNsdW1wLnByb3RvdHlwZS5xdWVyeSA9IGZ1bmN0aW9uKGZpZWxkLCB2YWx1ZSkge1xuXHR2YXIgbWF0Y2hlcyA9IFtdO1xuXHR2YXIgdGVzdDtcblxuXHQvLyBXb3JrIG91dCB3aGF0IHNvcnQgb2YgY29tcGFyaXNvbiB0byBkbzpcblxuXHRpZih0eXBlb2YgdmFsdWUgPT09IFwiZnVuY3Rpb25cIikge1x0Ly8gSWYgdmFsdWUgaXMgYSBmdW5jdGlvbiwgcGFzcyBpdCB0aGUgY2FuZGlkYXRlIGFuZCByZXR1cm4gdGhlIHJlc3VsdFxuXHRcdHRlc3QgPSBmdW5jdGlvbihjYW5kaWRhdGUpIHtcblx0XHRcdHJldHVybiAhIXZhbHVlKGNhbmRpZGF0ZSk7XG5cdFx0fTtcblx0fVxuXHRlbHNlIGlmKHR5cGVvZiB2YWx1ZSA9PT0gXCJvYmplY3RcIikge1xuXHRcdGlmKHZhbHVlIGluc3RhbmNlb2YgUmVnRXhwKSB7XG5cdFx0XHR0ZXN0ID0gZnVuY3Rpb24oY2FuZGlkYXRlKSB7XG5cdFx0XHRcdHJldHVybiB2YWx1ZS50ZXN0KGNhbmRpZGF0ZSk7XG5cdFx0XHR9O1xuXHRcdH1cblx0XHRlbHNlIGlmKHZhbHVlIGluc3RhbmNlb2YgQXJyYXkpIHtcdC8vIElmIHZhbHVlIGlzIGFuIGFycmF5LCB0ZXN0IGZvciB0aGUgcHJlc2VuY2Ugb2YgdGhlIGNhbmRpZGF0ZSB2YWx1ZSBpbiB0aGUgYXJyYXlcblx0XHRcdHRlc3QgPSBmdW5jdGlvbihjYW5kaWRhdGUpIHtcblx0XHRcdFx0cmV0dXJuIHZhbHVlLmluZGV4T2YoY2FuZGlkYXRlKSAhPT0gLTE7XG5cdFx0XHR9O1xuXHRcdH1cblx0XHRlbHNlIHtcblx0XHRcdHRlc3QgPSBmdW5jdGlvbihjYW5kaWRhdGUpIHtcblx0XHRcdFx0cmV0dXJuIGNhbmRpZGF0ZSA9PT0gdmFsdWU7XHQvLyBIYW5kbGUgbnVsbCwgdW5kZWZpbmVkIG9yIG9iamVjdC1yZWZlcmVuY2UgY29tcGFyaXNvblxuXHRcdFx0fTtcblx0XHR9XG5cdH1cblx0ZWxzZSB7XHQvLyBFbHNlIGlmIGl0J3MgYSBzaW1wbGUgdHlwZSwgdHJ5IGEgc3RyaWN0IGVxdWFsaXR5IGNvbXBhcmlzb25cblx0XHR0ZXN0ID0gZnVuY3Rpb24oY2FuZGlkYXRlKSB7XG5cdFx0XHRyZXR1cm4gY2FuZGlkYXRlID09PSB2YWx1ZTtcblx0XHR9O1xuXHR9XG5cdFxuXHQvLyBOb3cgaXRlcmF0ZSBvdmVyIHRoZSBpdGVtcywgZmlsdGVyaW5nIHVzaW5nIHRoZSB0ZXN0IGZ1bmN0aW9uIHdlIGRlZmluZWRcblx0dGhpcy5mb3JFYWNoKGZ1bmN0aW9uKGl0ZW0pIHtcblx0XHRpZihcblx0XHRcdChmaWVsZCAhPT0gbnVsbCAmJiB0ZXN0KGl0ZW1bZmllbGRdKSkgfHxcblx0XHRcdChmaWVsZCA9PT0gbnVsbCAmJiB0ZXN0KGl0ZW0pKVxuXHRcdCkge1xuXHRcdFx0bWF0Y2hlcy5wdXNoKGl0ZW0pO1xuXHRcdH1cblx0fSk7XG5cdHJldHVybiBuZXcgQ2x1bXAobWF0Y2hlcywgdGhpcy50eXBlKTtcdC8vIEFuZCB3cmFwIHRoZSByZXN1bHRpbmcgYXJyYXkgb2Ygb2JqZWN0cyBpbiBhIG5ldyBDbHVtcCBvYmplY3QgZm9yIHNleHkgbWV0aG9kIGNoYWluaW5nIGxpa2UgeC5xdWVyeSgpLmZvckVhY2goKSBvciB4LnF1ZXJ5KCkucXVlcnkoKVxufTtcblxuQ2x1bXAucHJvdG90eXBlLnF1ZXJ5UmF3ID0gZnVuY3Rpb24oZmllbGQsIHZhbHVlKSB7XG5cdHZhciBtYXRjaGVzID0gW107XG5cdHZhciB0ZXN0O1xuXG5cdC8vIFdvcmsgb3V0IHdoYXQgc29ydCBvZiBjb21wYXJpc29uIHRvIGRvOlxuXG5cdGlmKHR5cGVvZiB2YWx1ZSA9PT0gXCJmdW5jdGlvblwiKSB7XHQvLyBJZiB2YWx1ZSBpcyBhIGZ1bmN0aW9uLCBwYXNzIGl0IHRoZSBjYW5kaWRhdGUgYW5kIHJldHVybiB0aGUgcmVzdWx0XG5cdFx0dGVzdCA9IGZ1bmN0aW9uKGNhbmRpZGF0ZSkge1xuXHRcdFx0cmV0dXJuICEhdmFsdWUoY2FuZGlkYXRlKTtcblx0XHR9O1xuXHR9XG5cdGVsc2UgaWYodHlwZW9mIHZhbHVlID09PSBcIm9iamVjdFwiKSB7XG5cdFx0aWYodmFsdWUgaW5zdGFuY2VvZiBSZWdFeHApIHtcblx0XHRcdHRlc3QgPSBmdW5jdGlvbihjYW5kaWRhdGUpIHtcblx0XHRcdFx0cmV0dXJuIHZhbHVlLnRlc3QoY2FuZGlkYXRlKTtcblx0XHRcdH07XG5cdFx0fVxuXHRcdGVsc2UgaWYodmFsdWUgaW5zdGFuY2VvZiBBcnJheSkge1x0Ly8gSWYgdmFsdWUgaXMgYW4gYXJyYXksIHRlc3QgZm9yIHRoZSBwcmVzZW5jZSBvZiB0aGUgY2FuZGlkYXRlIHZhbHVlIGluIHRoZSBhcnJheVxuXHRcdFx0dGVzdCA9IGZ1bmN0aW9uKGNhbmRpZGF0ZSkge1xuXHRcdFx0XHRyZXR1cm4gdmFsdWUuaW5kZXhPZihjYW5kaWRhdGUpICE9PSAtMTtcblx0XHRcdH07XG5cdFx0fVxuXHRcdGVsc2Uge1x0Ly8gSWYgdmFsdWUgaXMgYSBoYXNoLi4uIHdoYXQgZG8gd2UgZG8/XG5cdFx0XHQvLyBDaGVjayB0aGUgY2FuZGlkYXRlIGZvciBlYWNoIGZpZWxkIGluIHRoZSBoYXNoIGluIHR1cm4sIGFuZCBpbmNsdWRlIHRoZSBjYW5kaWRhdGUgaWYgYW55L2FsbCBvZiB0aGVtIGhhdmUgdGhlIHNhbWUgdmFsdWUgYXMgdGhlIGNvcnJlc3BvbmRpbmcgdmFsdWUtaGFzaCBmaWVsZD9cblx0XHRcdHRocm93IFwiTm8gaWRlYSB3aGF0IHRvIGRvIHdpdGggYW4gb2JqZWN0IGFzIHRoZSB2YWx1ZVwiO1xuXHRcdH1cblx0fVxuXHRlbHNlIHtcdC8vIEVsc2UgaWYgaXQncyBhIHNpbXBsZSB0eXBlLCB0cnkgYSBzdHJpY3QgZXF1YWxpdHkgY29tcGFyaXNvblxuXHRcdHRlc3QgPSBmdW5jdGlvbihjYW5kaWRhdGUpIHtcblx0XHRcdHJldHVybiBjYW5kaWRhdGUgPT09IHZhbHVlO1xuXHRcdH07XG5cdH1cblx0XG5cdC8vIE5vdyBpdGVyYXRlIG92ZXIgdGhlbSBhbGwsIGZpbHRlcmluZyB1c2luZyB0aGUgdGVzdCBmdW5jdGlvbiB3ZSBkZWZpbmVkXG5cdHRoaXMuZm9yRWFjaChmdW5jdGlvbihpdGVtKSB7XG5cdFx0aWYoXG5cdFx0XHQoZmllbGQgIT09IG51bGwgJiYgdGVzdChpdGVtLmF0dHJpYnNbZmllbGRdKSkgfHxcblx0XHRcdChmaWVsZCA9PT0gbnVsbCAmJiB0ZXN0KGl0ZW0uYXR0cmlicykpXG5cdFx0KSB7XG5cdFx0XHRtYXRjaGVzLnB1c2goaXRlbSk7XG5cdFx0fVxuXHR9KTtcblx0cmV0dXJuIG5ldyBDbHVtcChtYXRjaGVzLCB0aGlzLnR5cGUpO1x0Ly8gQW5kIHdyYXAgdGhlIHJlc3VsdGluZyBhcnJheSBvZiBvYmplY3RzIGluIGEgbmV3IENsdW1wIG9iamVjdCBmb3Igc2V4eSBtZXRob2QgY2hhaW5pbmcgbGlrZSB4LnF1ZXJ5KCkuZm9yRWFjaCgpIG9yIHgucXVlcnkoKS5xdWVyeSgpXG59O1xuXG5DbHVtcC5wcm90b3R5cGUudG9TdHJpbmcgPSBmdW5jdGlvbigpIHtcblx0cmV0dXJuIHRoaXMudHlwZS5uYW1lICsgXCIgQ2x1bXAgKFwiICsgdGhpcy5zaXplKCkgKyBcIiBpdGVtcylcIjtcbn07XG5cbkNsdW1wLnByb3RvdHlwZS50b0RvbSA9IGZ1bmN0aW9uKHNpemUsIGluY2x1ZGVDaGlsZHJlbiwgdGFnLCBmaXJzdENoaWxkKSB7XG5cblx0c2l6ZSA9IHNpemUgfHwgXCJub3JtYWxcIjtcblx0dGFnID0gdGFnIHx8IFwidWxcIjtcblxuXHR2YXIgZWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQodGFnKTtcblx0ZWxlbWVudC5jbGFzc05hbWUgPSB0aGlzLmNvbnN0cnVjdG9yLm5hbWUudG9Mb3dlckNhc2UoKStcIi1saXN0IFwiK3NpemU7XG5cdGlmKGZpcnN0Q2hpbGQpIHtcblx0XHRlbGVtZW50LmFwcGVuZENoaWxkKGZpcnN0Q2hpbGQpO1xuXHR9XG5cdHRoaXMuc29ydEJ5KFwiTmFtZVwiKS5mb3JFYWNoKGZ1bmN0aW9uKGkpIHtcblx0XHRlbGVtZW50LmFwcGVuZENoaWxkKGkudG9Eb20oc2l6ZSwgaW5jbHVkZUNoaWxkcmVuKSk7XG5cdH0pO1xuXHRyZXR1cm4gZWxlbWVudDtcbn07XG5cbkNsdW1wLnByb3RvdHlwZS5kZXNjcmliZSA9IGZ1bmN0aW9uKCkge1xuXHR2YXIgc2VsZiA9IHRoaXM7XG5cdHJldHVybiBPYmplY3Qua2V5cyh0aGlzLml0ZW1zKS5tYXAoZnVuY3Rpb24oaSkgeyByZXR1cm4gc2VsZi5pdGVtc1tpXS50b1N0cmluZygpOyB9KS5qb2luKFwiIGFuZCBcIik7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IENsdW1wOyIsInZhciBMdW1wID0gcmVxdWlyZSgnLi9sdW1wJyk7XG52YXIgQ2x1bXAgPSByZXF1aXJlKCcuL2NsdW1wJyk7XG5cbnZhciBhcGk7XG5cbmZ1bmN0aW9uIENvbWJhdEF0dGFjayhyYXcsIHBhcmVudCkge1xuXHR0aGlzLnN0cmFpZ2h0Q29weSA9IFtcblx0XHQnTmFtZScsXG5cdFx0J0ltYWdlJyxcblx0XHQnUmFtbWluZ0F0dGFjaycsXG5cdFx0J09ubHlXaGVuRXhwb3NlZCcsXG5cdFx0J1JhbmdlJyxcblx0XHQnT3JpZW50YXRpb24nLFxuXHRcdCdBcmMnLFxuXHRcdCdCYXNlSHVsbERhbWFnZScsXG5cdFx0J0Jhc2VMaWZlRGFtYWdlJyxcblx0XHQnRXhwb3NlZFF1YWxpdHlEYW1hZ2UnLFx0Ly8gVmFsdWUgdG8gYWRkIHRvIHRoZSBleHBvc2VkUXVhbGl0eTogcG9zaXRpdmUgaW5jcmVhc2VzIHF1YWxpdHkgbGV2ZWwgKGVnIFRlcnJvciksIG5lZ2F0aXZlIGRlY3JlYXNlcyBpdCAoZWcgQ3Jldylcblx0XHQnU3RhZ2dlckFtb3VudCcsXG5cdFx0J0Jhc2VXYXJtVXAnLFxuXHRcdCdBbmltYXRpb24nLFxuXHRcdCdBbmltYXRpb25OdW1iZXInXG5cdF07XG5cdHJhdy5JZCA9IHJhdy5OYW1lO1xuXHRMdW1wLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG5cblx0dGhpcy5xdWFsaXR5UmVxdWlyZWQgPSBudWxsO1xuXHR0aGlzLnF1YWxpdHlDb3N0ID0gbnVsbDtcblx0dGhpcy5leHBvc2VkUXVhbGl0eSA9IG51bGw7XG59XG5cbk9iamVjdC5rZXlzKEx1bXAucHJvdG90eXBlKS5mb3JFYWNoKGZ1bmN0aW9uKG1lbWJlcikgeyBDb21iYXRBdHRhY2sucHJvdG90eXBlW21lbWJlcl0gPSBMdW1wLnByb3RvdHlwZVttZW1iZXJdOyB9KTtcblxuQ29tYmF0QXR0YWNrLnByb3RvdHlwZS53aXJlVXAgPSBmdW5jdGlvbih0aGVBcGkpIHtcblxuXHRhcGkgPSB0aGVBcGk7XG5cblx0dGhpcy5xdWFsaXR5UmVxdWlyZWQgPSBhcGkuZ2V0KGFwaS50eXBlcy5RdWFsaXR5LCB0aGlzLmF0dHJpYnMuUXVhbGl0eVJlcXVpcmVkSWQsIHRoaXMpO1xuXHR0aGlzLnF1YWxpdHlDb3N0ID0gYXBpLmdldChhcGkudHlwZXMuUXVhbGl0eSwgdGhpcy5hdHRyaWJzLlF1YWxpdHlDb3N0SWQsIHRoaXMpO1xuXHR0aGlzLmV4cG9zZWRRdWFsaXR5ID0gYXBpLmdldChhcGkudHlwZXMuUXVhbGl0eSwgdGhpcy5hdHRyaWJzLkV4cG9zZWRRdWFsaXR5SWQsIHRoaXMpO1xuXG5cdEx1bXAucHJvdG90eXBlLndpcmVVcC5jYWxsKHRoaXMsIGFwaSk7XG59O1xuXG5Db21iYXRBdHRhY2sucHJvdG90eXBlLnRvU3RyaW5nID0gZnVuY3Rpb24oKSB7XG5cdHJldHVybiB0aGlzLmNvbnN0cnVjdG9yLm5hbWUgKyBcIiBcIiArIHRoaXMuTmFtZSArIFwiICgjXCIgKyB0aGlzLklkICsgXCIpXCI7XG59O1xuXG5Db21iYXRBdHRhY2sucHJvdG90eXBlLnRvRG9tID0gZnVuY3Rpb24oc2l6ZSwgaW5jbHVkZUNoaWxkcmVuKSB7XG5cblx0c2l6ZSA9IHNpemUgfHwgXCJub3JtYWxcIjtcblx0aW5jbHVkZUNoaWxkcmVuID0gaW5jbHVkZUNoaWxkcmVuID09PSBmYWxzZSA/IGZhbHNlIDogdHJ1ZTtcblxuXHR2YXIgc2VsZiA9IHRoaXM7XG5cdFxuXHR2YXIgaHRtbCA9IFwiXCI7XG5cblx0dmFyIGVsZW1lbnQgPSAgZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImxpXCIpO1xuXHRlbGVtZW50LmNsYXNzTmFtZSA9IFwiaXRlbSBcIit0aGlzLmNvbnN0cnVjdG9yLm5hbWUudG9Mb3dlckNhc2UoKStcIi1pdGVtIFwiK3NpemU7XG5cblx0aWYodGhpcy5JbWFnZSAhPT0gbnVsbCAmJiB0aGlzLkltYWdlICE9PSBcIlwiKSB7XG5cdFx0aHRtbCA9IFwiPGltZyBjbGFzcz0naWNvbicgc3JjPSdcIithcGkuY29uZmlnLmxvY2F0aW9ucy5pbWFnZXNQYXRoK1wiL1wiK3RoaXMuSW1hZ2UrXCIucG5nJyAvPlwiO1xuXHR9XG5cblx0aHRtbCArPSBcIlxcbjxoMyBjbGFzcz0ndGl0bGUnPlwiK3RoaXMuTmFtZStcIjwvaDM+XCI7XG5cblx0aWYodGhpcy5xdWFsaXR5UmVxdWlyZWQgfHwgdGhpcy5xdWFsaXR5Q29zdCkge1xuXHRcdGh0bWwgKz0gXCI8ZGl2IGNsYXNzPSdzaWRlYmFyJz5cIjtcblxuXHRcdGlmKHRoaXMucXVhbGl0eVJlcXVpcmVkKSB7XG5cdFx0XHRodG1sICs9IFwiPGg0PlJlcXVpcmVkPC9oND5cIjtcblx0XHRcdGh0bWwgKz0gKG5ldyBDbHVtcChbdGhpcy5xdWFsaXR5UmVxdWlyZWRdLCBhcGkudHlwZXMuUXVhbGl0eSkpLnRvRG9tKFwic21hbGxcIiwgZmFsc2UsIFwidWxcIikub3V0ZXJIVE1MO1xuXHRcdH1cblx0XHRpZih0aGlzLnF1YWxpdHlDb3N0KSB7XG5cdFx0XHRodG1sICs9IFwiPGg0PkNvc3Q8L2g0PlwiO1xuXHRcdFx0aHRtbCArPSAobmV3IENsdW1wKFt0aGlzLnF1YWxpdHlDb3N0XSwgYXBpLnR5cGVzLlF1YWxpdHkpKS50b0RvbShcInNtYWxsXCIsIGZhbHNlLCBcInVsXCIpLm91dGVySFRNTDtcblx0XHR9XG5cdFx0aHRtbCArPSBcIjwvZGl2PlwiO1xuXHR9XG5cblx0aHRtbCArPSBcIjxkbCBjbGFzcz0nY2x1bXAtbGlzdCBzbWFsbCc+XCI7XG5cdFsnUmFuZ2UnLCAnQXJjJywgJ0Jhc2VIdWxsRGFtYWdlJywgJ0Jhc2VMaWZlRGFtYWdlJywgJ1N0YWdnZXJBbW91bnQnLCAnQmFzZVdhcm1VcCddLmZvckVhY2goZnVuY3Rpb24oa2V5KSB7XG5cdFx0aHRtbCArPSBcIjxkdCBjbGFzcz0naXRlbSc+XCIra2V5K1wiPC9kdD48ZGQgY2xhc3M9J3F1YW50aXR5Jz5cIitzZWxmW2tleV0rXCI8L2RkPlwiO1xuXHR9KTtcblx0aHRtbCArPSBcIjwvZGw+XCI7XG5cblx0ZWxlbWVudC5pbm5lckhUTUwgPSBodG1sO1xuXG5cdGVsZW1lbnQudGl0bGUgPSB0aGlzLnRvU3RyaW5nKCk7XG5cblx0aWYoaW5jbHVkZUNoaWxkcmVuKSB7XG5cdFx0ZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgZnVuY3Rpb24oZSkge1xuXHRcdFx0ZS5zdG9wUHJvcGFnYXRpb24oKTtcblxuXHRcdFx0dmFyIGNoaWxkTGlzdCA9IGVsZW1lbnQucXVlcnlTZWxlY3RvcihcIi5jaGlsZC1saXN0XCIpO1xuXHRcdFx0aWYoY2hpbGRMaXN0KSB7XG5cdFx0XHRcdGVsZW1lbnQucmVtb3ZlQ2hpbGQoY2hpbGRMaXN0KTtcblx0XHRcdH1cblx0XHRcdGVsc2Uge1xuXHRcdFx0XHR2YXIgc3VjY2Vzc0V2ZW50ID0gc2VsZi5zdWNjZXNzRXZlbnQ7XG5cdFx0XHRcdHZhciBkZWZhdWx0RXZlbnQgPSBzZWxmLmRlZmF1bHRFdmVudDtcblx0XHRcdFx0dmFyIHF1YWxpdGllc1JlcXVpcmVkID0gIHNlbGYucXVhbGl0aWVzUmVxdWlyZWQ7XG5cdFx0XHRcdHZhciBldmVudHMgPSBbXTtcblx0XHRcdFx0aWYoc3VjY2Vzc0V2ZW50ICYmIHF1YWxpdGllc1JlcXVpcmVkICYmIHF1YWxpdGllc1JlcXVpcmVkLnNpemUoKSkge1xuXHRcdFx0XHRcdGV2ZW50cy5wdXNoKHN1Y2Nlc3NFdmVudCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYoZGVmYXVsdEV2ZW50KSB7XG5cdFx0XHRcdFx0ZXZlbnRzLnB1c2goZGVmYXVsdEV2ZW50KTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZihldmVudHMubGVuZ3RoKSB7XG5cdFx0XHRcdFx0dmFyIHdyYXBwZXJDbHVtcCA9IG5ldyBDbHVtcChldmVudHMsIGFwaS50eXBlcy5FdmVudCk7XG5cdFx0XHRcdFx0dmFyIGNoaWxkX2V2ZW50cyA9IHdyYXBwZXJDbHVtcC50b0RvbShzaXplLCB0cnVlKTtcblxuXHRcdFx0XHRcdGNoaWxkX2V2ZW50cy5jbGFzc0xpc3QuYWRkKFwiY2hpbGQtbGlzdFwiKTtcblx0XHRcdFx0XHRlbGVtZW50LmFwcGVuZENoaWxkKGNoaWxkX2V2ZW50cyk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdHJldHVybiBlbGVtZW50O1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBDb21iYXRBdHRhY2s7IiwidmFyIEx1bXAgPSByZXF1aXJlKCcuL2x1bXAnKTtcbnZhciBDbHVtcCA9IHJlcXVpcmUoJy4vY2x1bXAnKTtcblxudmFyIGFwaTtcblxuZnVuY3Rpb24gRXZlbnQocmF3LCBwYXJlbnQpIHtcblx0dGhpcy5zdHJhaWdodENvcHkgPSBbXG5cdCdOYW1lJyxcblx0J0Rlc2NyaXB0aW9uJyxcblx0J1RlYXNlcicsXG5cdCdJbWFnZScsXG5cblx0J0NhdGVnb3J5J1xuXHRdO1xuXHRMdW1wLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG5cblx0dGhpcy50YWcgPSBudWxsO1xuXG5cdHRoaXMuRXhvdGljRWZmZWN0cyA9IHRoaXMuZ2V0RXhvdGljRWZmZWN0KHRoaXMuYXR0cmlicy5FeG90aWNFZmZlY3RzKTtcblxuXHR0aGlzLnF1YWxpdGllc1JlcXVpcmVkID0gbnVsbDtcblx0dGhpcy5xdWFsaXRpZXNBZmZlY3RlZCA9IG51bGw7XG5cdHRoaXMuaW50ZXJhY3Rpb25zID0gbnVsbDtcblx0dGhpcy5saW5rVG9FdmVudCA9IG51bGw7XG5cblx0dGhpcy5saW1pdGVkVG9BcmVhID0gbnVsbDtcblx0XG5cdC8vRGVja1xuXHQvL1NldHRpbmdcblx0Ly9TdGlja2luZXNzXG5cdC8vVHJhbnNpZW50XG5cdC8vVXJnZW5jeVxufVxuT2JqZWN0LmtleXMoTHVtcC5wcm90b3R5cGUpLmZvckVhY2goZnVuY3Rpb24obWVtYmVyKSB7IEV2ZW50LnByb3RvdHlwZVttZW1iZXJdID0gTHVtcC5wcm90b3R5cGVbbWVtYmVyXTsgfSk7XG5cbkV2ZW50LnByb3RvdHlwZS53aXJlVXAgPSBmdW5jdGlvbih0aGVBcGkpIHtcblxuXHRhcGkgPSB0aGVBcGk7XG5cblx0dGhpcy5xdWFsaXRpZXNSZXF1aXJlZCA9IG5ldyBDbHVtcCh0aGlzLmF0dHJpYnMuUXVhbGl0aWVzUmVxdWlyZWQgfHwgW10sIGFwaS50eXBlcy5RdWFsaXR5UmVxdWlyZW1lbnQsIHRoaXMpO1xuXHR0aGlzLnF1YWxpdGllc0FmZmVjdGVkID0gbmV3IENsdW1wKHRoaXMuYXR0cmlicy5RdWFsaXRpZXNBZmZlY3RlZCB8fCBbXSwgYXBpLnR5cGVzLlF1YWxpdHlFZmZlY3QsIHRoaXMpO1xuXHR0aGlzLmludGVyYWN0aW9ucyA9IG5ldyBDbHVtcCh0aGlzLmF0dHJpYnMuQ2hpbGRCcmFuY2hlc3x8IFtdLCBhcGkudHlwZXMuSW50ZXJhY3Rpb24sIHRoaXMpO1xuXG5cdHRoaXMubGlua1RvRXZlbnQgPSBhcGkuZ2V0T3JDcmVhdGUoYXBpLnR5cGVzLkV2ZW50LCB0aGlzLmF0dHJpYnMuTGlua1RvRXZlbnQsIHRoaXMpO1xuXG5cdHRoaXMubGltaXRlZFRvQXJlYSA9IGFwaS5nZXRPckNyZWF0ZShhcGkudHlwZXMuQXJlYSwgdGhpcy5hdHRyaWJzLkxpbWl0ZWRUb0FyZWEsIHRoaXMpO1xuXG5cdEx1bXAucHJvdG90eXBlLndpcmVVcC5jYWxsKHRoaXMsIGFwaSk7XG59O1xuXG5FdmVudC5wcm90b3R5cGUudG9TdHJpbmcgPSBmdW5jdGlvbihsb25nKSB7XG5cdHJldHVybiB0aGlzLmNvbnN0cnVjdG9yLm5hbWUgKyBcIiBcIiArIChsb25nID8gXCIgW1wiICsgdGhpcy5DYXRlZ29yeSArIFwiXSBcIiA6IFwiXCIpICsgdGhpcy5OYW1lICsgXCIgKCNcIiArIHRoaXMuSWQgKyBcIilcIjtcbn07XG5cbkV2ZW50LnByb3RvdHlwZS50b0RvbSA9IGZ1bmN0aW9uKHNpemUsIGluY2x1ZGVDaGlsZHJlbikge1xuXG5cdHNpemUgPSBzaXplIHx8IFwibm9ybWFsXCI7XG5cdGluY2x1ZGVDaGlsZHJlbiA9IGluY2x1ZGVDaGlsZHJlbiA9PT0gZmFsc2UgPyBmYWxzZSA6IHRydWU7XG5cblx0dmFyIGh0bWwgPSBcIlwiO1xuXG5cdHZhciBlbGVtZW50ID0gIGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJsaVwiKTtcblx0ZWxlbWVudC5jbGFzc05hbWUgPSBcIml0ZW0gXCIrdGhpcy5jb25zdHJ1Y3Rvci5uYW1lLnRvTG93ZXJDYXNlKCkrXCItaXRlbSBcIitzaXplO1xuXG5cdGlmKHRoaXMuSW1hZ2UgIT09IG51bGwgJiYgdGhpcy5JbWFnZSAhPT0gXCJcIikge1xuXHRcdGh0bWwgPSBcIjxpbWcgY2xhc3M9J2ljb24nIHNyYz0nXCIrYXBpLmNvbmZpZy5sb2NhdGlvbnMuaW1hZ2VzUGF0aCtcIi9cIit0aGlzLkltYWdlK1wic21hbGwucG5nJyAvPlwiO1xuXHR9XG5cblx0aHRtbCArPSBcIlxcbjxoMyBjbGFzcz0ndGl0bGUnPlwiK3RoaXMuTmFtZStcIlxcblwiKyh0aGlzLnRhZyA/IFwiPHNwYW4gY2xhc3M9J3RhZyBcIit0aGlzLnRhZytcIic+XCIrdGhpcy50YWcrXCI8L3NwYW4+XCIgOiBcIlwiKStcIjwvaDM+XCI7XG5cblx0aWYoc2l6ZSAhPSBcInNtYWxsXCIgJiYgKHRoaXMucXVhbGl0aWVzUmVxdWlyZWQgfHwgdGhpcy5xdWFsaXRpZXNBZmZlY3RlZCkpIHtcblx0XHRodG1sICs9IFwiPGRpdiBjbGFzcz0nc2lkZWJhcic+XCI7XG5cdFx0aWYodGhpcy5xdWFsaXRpZXNSZXF1aXJlZCAmJiB0aGlzLnF1YWxpdGllc1JlcXVpcmVkLnNpemUoKSkge1xuXHRcdFx0aHRtbCArPSBcIjxoND5SZXF1aXJlbWVudHM8L2g0PlxcblwiO1xuXHRcdFx0aHRtbCArPSB0aGlzLnF1YWxpdGllc1JlcXVpcmVkLnRvRG9tKFwic21hbGxcIiwgZmFsc2UsIFwidWxcIikub3V0ZXJIVE1MO1xuXHRcdH1cblx0XHRpZih0aGlzLnF1YWxpdGllc0FmZmVjdGVkICYmIHRoaXMucXVhbGl0aWVzQWZmZWN0ZWQuc2l6ZSgpKSB7XG5cdFx0XHRodG1sICs9IFwiPGg0PkVmZmVjdHM8L2g0PlxcblwiO1xuXHRcdFx0aHRtbCArPSB0aGlzLnF1YWxpdGllc0FmZmVjdGVkLnRvRG9tKFwic21hbGxcIiwgZmFsc2UsIFwidWxcIikub3V0ZXJIVE1MO1xuXHRcdH1cblx0XHRodG1sICs9IFwiPC9kaXY+XCI7XG5cdH1cblx0XG5cdGh0bWwgKz0gXCI8cCBjbGFzcz0nZGVzY3JpcHRpb24nPlwiK3RoaXMuRGVzY3JpcHRpb24rXCI8L3A+XCI7XG5cblx0ZWxlbWVudC5pbm5lckhUTUwgPSBodG1sO1xuXG5cdGVsZW1lbnQudGl0bGUgPSB0aGlzLnRvU3RyaW5nKHRydWUpO1xuXG5cdGlmKGluY2x1ZGVDaGlsZHJlbikge1xuXHRcdHZhciBzZWxmID0gdGhpcztcblx0XHRlbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCBmdW5jdGlvbihlKSB7XG5cdFx0XHRlLnN0b3BQcm9wYWdhdGlvbigpO1xuXG5cdFx0XHR2YXIgY2hpbGRMaXN0ID0gZWxlbWVudC5xdWVyeVNlbGVjdG9yKFwiLmNoaWxkLWxpc3RcIik7XG5cdFx0XHRpZihjaGlsZExpc3QpIHtcblx0XHRcdFx0ZWxlbWVudC5yZW1vdmVDaGlsZChjaGlsZExpc3QpO1xuXHRcdFx0fVxuXHRcdFx0ZWxzZSB7XG5cdFx0XHRcdHZhciBpbnRlcmFjdGlvbnMgPSBzZWxmLmludGVyYWN0aW9ucztcblx0XHRcdFx0dmFyIGxpbmtUb0V2ZW50ID0gc2VsZi5saW5rVG9FdmVudDtcblx0XHRcdFx0aWYobGlua1RvRXZlbnQpIHtcblx0XHRcdFx0XHR2YXIgd3JhcHBlckNsdW1wID0gbmV3IENsdW1wKFtsaW5rVG9FdmVudF0sIGFwaS50eXBlcy5FdmVudCk7XG5cdFx0XHRcdFx0dmFyIGxpbmtUb0V2ZW50X2VsZW1lbnQgPSB3cmFwcGVyQ2x1bXAudG9Eb20oXCJub3JtYWxcIiwgdHJ1ZSk7XG5cblx0XHRcdFx0XHRsaW5rVG9FdmVudF9lbGVtZW50LmNsYXNzTGlzdC5hZGQoXCJjaGlsZC1saXN0XCIpO1xuXHRcdFx0XHRcdGVsZW1lbnQuYXBwZW5kQ2hpbGQobGlua1RvRXZlbnRfZWxlbWVudCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0ZWxzZSBpZihpbnRlcmFjdGlvbnMgJiYgaW50ZXJhY3Rpb25zLnNpemUoKSA+IDApIHtcblx0XHRcdFx0XHR2YXIgaW50ZXJhY3Rpb25zX2VsZW1lbnQgPSBpbnRlcmFjdGlvbnMudG9Eb20oXCJub3JtYWxcIiwgdHJ1ZSk7XG5cblx0XHRcdFx0XHRpbnRlcmFjdGlvbnNfZWxlbWVudC5jbGFzc0xpc3QuYWRkKFwiY2hpbGQtbGlzdFwiKTtcblx0XHRcdFx0XHRlbGVtZW50LmFwcGVuZENoaWxkKGludGVyYWN0aW9uc19lbGVtZW50KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0cmV0dXJuIGVsZW1lbnQ7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEV2ZW50OyIsInZhciBMdW1wID0gcmVxdWlyZSgnLi9sdW1wJyk7XG52YXIgQ2x1bXAgPSByZXF1aXJlKCcuL2NsdW1wJyk7XG5cbnZhciBhcGk7XG5cbmZ1bmN0aW9uIEV4Y2hhbmdlKHJhdywgcGFyZW50KSB7XG5cdHRoaXMuc3RyYWlnaHRDb3B5ID0gW1xuXHRcdCdJZCcsXG5cdFx0J05hbWUnLFxuXHRcdCdEZXNjcmlwdGlvbicsXG5cdFx0J0ltYWdlJyxcblx0XHQnU2V0dGluZ0lkcydcblx0XTtcblx0THVtcC5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuXG5cdHRoaXMuc2hvcHMgPSBudWxsO1xufVxuT2JqZWN0LmtleXMoTHVtcC5wcm90b3R5cGUpLmZvckVhY2goZnVuY3Rpb24obWVtYmVyKSB7IEV4Y2hhbmdlLnByb3RvdHlwZVttZW1iZXJdID0gTHVtcC5wcm90b3R5cGVbbWVtYmVyXTsgfSk7XG5cbkV4Y2hhbmdlLnByb3RvdHlwZS53aXJlVXAgPSBmdW5jdGlvbih0aGVBcGkpIHtcblxuXHRhcGkgPSB0aGVBcGk7XG5cblx0dGhpcy5zaG9wcyA9IG5ldyBDbHVtcCh0aGlzLmF0dHJpYnMuU2hvcHMgfHwgW10sIGFwaS50eXBlcy5TaG9wLCB0aGlzKTtcblx0dmFyIHNlbGYgPSB0aGlzO1xuXHR0aGlzLnBvcnRzID0gYXBpLmxpYnJhcnkuUG9ydC5xdWVyeShcIlNldHRpbmdJZFwiLCBmdW5jdGlvbihpZCkge1xuXHRcdHJldHVybiBzZWxmLlNldHRpbmdJZHMuaW5kZXhPZihpZCkgIT09IC0xO1xuXHR9KTtcblx0dGhpcy5wb3J0cy5mb3JFYWNoKGZ1bmN0aW9uIChwKSB7XG5cdFx0c2VsZi5wYXJlbnRzLnB1c2gocCk7XG5cdH0pO1xuXG5cdEx1bXAucHJvdG90eXBlLndpcmVVcC5jYWxsKHRoaXMpO1xufTtcblxuRXhjaGFuZ2UucHJvdG90eXBlLnRvU3RyaW5nID0gZnVuY3Rpb24oKSB7XG5cdHJldHVybiB0aGlzLmNvbnN0cnVjdG9yLm5hbWUgKyBcIiBcIiArIHRoaXMuTmFtZSArIFwiICgjXCIgKyB0aGlzLklkICsgXCIpXCI7XG59O1xuXG5FeGNoYW5nZS5wcm90b3R5cGUudG9Eb20gPSBmdW5jdGlvbihzaXplLCBpbmNsdWRlQ2hpbGRyZW4sIHRhZykge1xuXG5cdHNpemUgPSBzaXplIHx8IFwibm9ybWFsXCI7XG5cdGluY2x1ZGVDaGlsZHJlbiA9IGluY2x1ZGVDaGlsZHJlbiA9PT0gZmFsc2UgPyBmYWxzZSA6IHRydWU7XG5cdHRhZyA9IHRhZyB8fCBcImxpXCI7XG5cblx0dmFyIHNlbGYgPSB0aGlzO1xuXHR2YXIgaHRtbCA9IFwiXCI7XG5cblx0dmFyIGVsZW1lbnQgPSAgZG9jdW1lbnQuY3JlYXRlRWxlbWVudCh0YWcpO1xuXHRlbGVtZW50LmNsYXNzTmFtZSA9IFwiaXRlbSBcIit0aGlzLmNvbnN0cnVjdG9yLm5hbWUudG9Mb3dlckNhc2UoKStcIi1pdGVtIFwiK3NpemU7XG5cblx0aHRtbCA9IFwiXFxuPGltZyBjbGFzcz0naWNvbicgc3JjPSdcIithcGkuY29uZmlnLmxvY2F0aW9ucy5pbWFnZXNQYXRoK1wiL1wiK3RoaXMuSW1hZ2UrXCIucG5nJyAvPlwiO1xuXHRodG1sICs9IFwiXFxuPGgzIGNsYXNzPSd0aXRsZSc+XCIrdGhpcy5OYW1lK1wiPC9oMz5cIjtcblx0aHRtbCArPSBcIlxcbjxwIGNsYXNzPSdkZXNjcmlwdGlvbic+XCIrdGhpcy5EZXNjcmlwdGlvbitcIjwvcD5cIjtcblxuXHRlbGVtZW50LmlubmVySFRNTCA9IGh0bWw7XG5cblx0ZWxlbWVudC50aXRsZSA9IHRoaXMudG9TdHJpbmcoKTtcblxuXHRpZihpbmNsdWRlQ2hpbGRyZW4pIHtcblx0XHRlbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCBmdW5jdGlvbihlKSB7XG5cdFx0XHRlLnN0b3BQcm9wYWdhdGlvbigpO1xuXG5cdFx0XHR2YXIgY2hpbGRMaXN0ID0gZWxlbWVudC5xdWVyeVNlbGVjdG9yKFwiLmNoaWxkLWxpc3RcIik7XG5cdFx0XHRpZihjaGlsZExpc3QpIHtcblx0XHRcdFx0ZWxlbWVudC5yZW1vdmVDaGlsZChjaGlsZExpc3QpO1xuXHRcdFx0fVxuXHRcdFx0ZWxzZSB7XG5cdFx0XHRcdGlmKHNlbGYuc2hvcHMpIHtcblxuXHRcdFx0XHRcdHZhciBjaGlsZF9lbGVtZW50cyA9IHNlbGYuc2hvcHMudG9Eb20oXCJub3JtYWxcIiwgdHJ1ZSk7XG5cblx0XHRcdFx0XHRjaGlsZF9lbGVtZW50cy5jbGFzc0xpc3QuYWRkKFwiY2hpbGQtbGlzdFwiKTtcblx0XHRcdFx0XHRlbGVtZW50LmFwcGVuZENoaWxkKGNoaWxkX2VsZW1lbnRzKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0cmV0dXJuIGVsZW1lbnQ7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEV4Y2hhbmdlOyIsInZhciBMdW1wID0gcmVxdWlyZSgnLi9sdW1wJyk7XG52YXIgQ2x1bXAgPSByZXF1aXJlKCcuL2NsdW1wJyk7XG5cbnZhciBhcGk7XG5cbmZ1bmN0aW9uIEludGVyYWN0aW9uKHJhdywgcGFyZW50KSB7XG5cdHRoaXMuc3RyYWlnaHRDb3B5ID0gW1xuXHQnTmFtZScsXG5cdCdEZXNjcmlwdGlvbicsXG5cdCdCdXR0b25UZXh0Jyxcblx0J0ltYWdlJyxcblxuXHQnT3JkZXJpbmcnXG5cdF07XG5cdEx1bXAuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcblxuXHR0aGlzLnF1YWxpdGllc1JlcXVpcmVkID0gbnVsbDtcblx0dGhpcy5zdWNjZXNzRXZlbnQgPSBudWxsO1xuXHR0aGlzLmRlZmF1bHRFdmVudCA9IG51bGw7XG5cbn1cbk9iamVjdC5rZXlzKEx1bXAucHJvdG90eXBlKS5mb3JFYWNoKGZ1bmN0aW9uKG1lbWJlcikgeyBJbnRlcmFjdGlvbi5wcm90b3R5cGVbbWVtYmVyXSA9IEx1bXAucHJvdG90eXBlW21lbWJlcl07IH0pO1xuXG5JbnRlcmFjdGlvbi5wcm90b3R5cGUud2lyZVVwID0gZnVuY3Rpb24odGhlQXBpKSB7XG5cblx0YXBpID0gdGhlQXBpO1xuXG5cdHRoaXMucXVhbGl0aWVzUmVxdWlyZWQgPSBuZXcgQ2x1bXAodGhpcy5hdHRyaWJzLlF1YWxpdGllc1JlcXVpcmVkIHx8IFtdLCBhcGkudHlwZXMuUXVhbGl0eVJlcXVpcmVtZW50LCB0aGlzKTtcblx0dGhpcy5zdWNjZXNzRXZlbnQgPSBhcGkuZ2V0T3JDcmVhdGUoYXBpLnR5cGVzLkV2ZW50LCB0aGlzLmF0dHJpYnMuU3VjY2Vzc0V2ZW50LCB0aGlzKTtcblx0aWYodGhpcy5zdWNjZXNzRXZlbnQpIHtcblx0XHR0aGlzLnN1Y2Nlc3NFdmVudC50YWcgPSBcInN1Y2Nlc3NcIjtcblx0fVxuXHR0aGlzLmRlZmF1bHRFdmVudCA9IGFwaS5nZXRPckNyZWF0ZShhcGkudHlwZXMuRXZlbnQsIHRoaXMuYXR0cmlicy5EZWZhdWx0RXZlbnQsIHRoaXMpO1xuXHR2YXIgcXVhbGl0aWVzUmVxdWlyZWQgPSAgdGhpcy5xdWFsaXRpZXNSZXF1aXJlZDtcblx0aWYodGhpcy5kZWZhdWx0RXZlbnQgJiYgdGhpcy5zdWNjZXNzRXZlbnQgJiYgcXVhbGl0aWVzUmVxdWlyZWQgJiYgcXVhbGl0aWVzUmVxdWlyZWQuc2l6ZSgpKSB7XG5cdFx0dGhpcy5kZWZhdWx0RXZlbnQudGFnID0gXCJmYWlsdXJlXCI7XG5cdH1cblxuXHRMdW1wLnByb3RvdHlwZS53aXJlVXAuY2FsbCh0aGlzLCBhcGkpO1xufTtcblxuSW50ZXJhY3Rpb24ucHJvdG90eXBlLnRvU3RyaW5nID0gZnVuY3Rpb24oKSB7XG5cdHJldHVybiB0aGlzLmNvbnN0cnVjdG9yLm5hbWUgKyBcIiBbXCIgKyB0aGlzLk9yZGVyaW5nICsgXCJdIFwiICsgdGhpcy5OYW1lICsgXCIgKCNcIiArIHRoaXMuSWQgKyBcIilcIjtcbn07XG5cbkludGVyYWN0aW9uLnByb3RvdHlwZS50b0RvbSA9IGZ1bmN0aW9uKHNpemUsIGluY2x1ZGVDaGlsZHJlbikge1xuXG5cdHNpemUgPSBzaXplIHx8IFwibm9ybWFsXCI7XG5cdGluY2x1ZGVDaGlsZHJlbiA9IGluY2x1ZGVDaGlsZHJlbiA9PT0gZmFsc2UgPyBmYWxzZSA6IHRydWU7XG5cblx0dmFyIGh0bWwgPSBcIlwiO1xuXG5cdHZhciBlbGVtZW50ID0gIGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJsaVwiKTtcblx0ZWxlbWVudC5jbGFzc05hbWUgPSBcIml0ZW0gXCIrdGhpcy5jb25zdHJ1Y3Rvci5uYW1lLnRvTG93ZXJDYXNlKCkrXCItaXRlbSBcIitzaXplO1xuXG5cdGlmKHRoaXMuSW1hZ2UgIT09IG51bGwgJiYgdGhpcy5JbWFnZSAhPT0gXCJcIikge1xuXHRcdGh0bWwgPSBcIjxpbWcgY2xhc3M9J2ljb24nIHNyYz0nXCIrYXBpLmNvbmZpZy5sb2NhdGlvbnMuaW1hZ2VzUGF0aCtcIi9cIit0aGlzLkltYWdlK1wic21hbGwucG5nJyAvPlwiO1xuXHR9XG5cblx0aHRtbCArPSBcIlxcbjxoMyBjbGFzcz0ndGl0bGUnPlwiK3RoaXMuTmFtZStcIjwvaDM+XCI7XG5cblx0aWYoc2l6ZSAhPSBcInNtYWxsXCIgJiYgdGhpcy5xdWFsaXRpZXNSZXF1aXJlZCkge1xuXHRcdGh0bWwgKz0gXCI8ZGl2IGNsYXNzPSdzaWRlYmFyJz5cIjtcblx0XHRodG1sICs9IFwiPGg0PlJlcXVpcmVtZW50czwvaDQ+XCI7XG5cdFx0aHRtbCArPSB0aGlzLnF1YWxpdGllc1JlcXVpcmVkLnRvRG9tKFwic21hbGxcIiwgZmFsc2UsIFwidWxcIikub3V0ZXJIVE1MO1xuXHRcdGh0bWwgKz0gXCI8L2Rpdj5cIjtcblx0fVxuXG5cdGh0bWwgKz0gXCI8cCBjbGFzcz0nZGVzY3JpcHRpb24nPlwiK3RoaXMuRGVzY3JpcHRpb24rXCI8L3A+XCI7XG5cblx0ZWxlbWVudC5pbm5lckhUTUwgPSBodG1sO1xuXG5cdGVsZW1lbnQudGl0bGUgPSB0aGlzLnRvU3RyaW5nKCk7XG5cblx0aWYoaW5jbHVkZUNoaWxkcmVuKSB7XG5cdFx0dmFyIHNlbGYgPSB0aGlzO1xuXHRcdGVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIGZ1bmN0aW9uKGUpIHtcblx0XHRcdGUuc3RvcFByb3BhZ2F0aW9uKCk7XG5cblx0XHRcdHZhciBjaGlsZExpc3QgPSBlbGVtZW50LnF1ZXJ5U2VsZWN0b3IoXCIuY2hpbGQtbGlzdFwiKTtcblx0XHRcdGlmKGNoaWxkTGlzdCkge1xuXHRcdFx0XHRlbGVtZW50LnJlbW92ZUNoaWxkKGNoaWxkTGlzdCk7XG5cdFx0XHR9XG5cdFx0XHRlbHNlIHtcblx0XHRcdFx0dmFyIHN1Y2Nlc3NFdmVudCA9IHNlbGYuc3VjY2Vzc0V2ZW50O1xuXHRcdFx0XHR2YXIgZGVmYXVsdEV2ZW50ID0gc2VsZi5kZWZhdWx0RXZlbnQ7XG5cdFx0XHRcdHZhciBxdWFsaXRpZXNSZXF1aXJlZCA9ICBzZWxmLnF1YWxpdGllc1JlcXVpcmVkO1xuXHRcdFx0XHR2YXIgZXZlbnRzID0gW107XG5cdFx0XHRcdGlmKHN1Y2Nlc3NFdmVudCAmJiBxdWFsaXRpZXNSZXF1aXJlZCAmJiBxdWFsaXRpZXNSZXF1aXJlZC5zaXplKCkpIHtcblx0XHRcdFx0XHRldmVudHMucHVzaChzdWNjZXNzRXZlbnQpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmKGRlZmF1bHRFdmVudCkge1xuXHRcdFx0XHRcdGV2ZW50cy5wdXNoKGRlZmF1bHRFdmVudCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYoZXZlbnRzLmxlbmd0aCkge1xuXHRcdFx0XHRcdHZhciB3cmFwcGVyQ2x1bXAgPSBuZXcgQ2x1bXAoZXZlbnRzLCBhcGkudHlwZXMuRXZlbnQpO1xuXHRcdFx0XHRcdHZhciBjaGlsZF9ldmVudHMgPSB3cmFwcGVyQ2x1bXAudG9Eb20oXCJub3JtYWxcIiwgdHJ1ZSk7XG5cblx0XHRcdFx0XHRjaGlsZF9ldmVudHMuY2xhc3NMaXN0LmFkZChcImNoaWxkLWxpc3RcIik7XG5cdFx0XHRcdFx0ZWxlbWVudC5hcHBlbmRDaGlsZChjaGlsZF9ldmVudHMpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRyZXR1cm4gZWxlbWVudDtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gSW50ZXJhY3Rpb247IiwidmFyIGxpYnJhcnkgPSByZXF1aXJlKCcuLi9saWJyYXJ5Jyk7XG52YXIgQ2x1bXAgPSByZXF1aXJlKCcuL2NsdW1wJyk7XG5cbnZhciBhcGk7XG5cbmZ1bmN0aW9uIEx1bXAocmF3LCBwYXJlbnQpIHtcblx0aWYocGFyZW50KSB7XG5cdFx0dGhpcy5wYXJlbnRzID0gcGFyZW50IGluc3RhbmNlb2YgQXJyYXkgPyBwYXJlbnQgOiBbcGFyZW50XTtcblx0fVxuXHRlbHNlIHtcblx0XHR0aGlzLnBhcmVudHMgPSBbXTtcblx0fVxuXG5cdGlmKCF0aGlzLnN0cmFpZ2h0Q29weSkge1xuXHRcdHRoaXMuc3RyYWlnaHRDb3B5ID0gW107XG5cdH1cblx0dGhpcy5zdHJhaWdodENvcHkudW5zaGlmdCgnSWQnKTtcblxuXHR0aGlzLmF0dHJpYnMgPSByYXc7XG5cblx0dmFyIHNlbGYgPSB0aGlzO1xuXHR0aGlzLnN0cmFpZ2h0Q29weS5mb3JFYWNoKGZ1bmN0aW9uKGF0dHJpYikge1xuXHRcdHNlbGZbYXR0cmliXSA9IHJhd1thdHRyaWJdO1xuXHRcdGlmKHR5cGVvZiBzZWxmW2F0dHJpYl0gPT09IFwidW5kZWZpbmVkXCIpIHtcblx0XHRcdHNlbGZbYXR0cmliXSA9IG51bGw7XG5cdFx0fVxuXHR9KTtcblx0ZGVsZXRlKHRoaXMuc3RyYWlnaHRDb3B5KTtcblxuXHR0aGlzLndpcmVkID0gZmFsc2U7XG5cblx0aWYoIWxpYnJhcnlbdGhpcy5jb25zdHJ1Y3Rvci5uYW1lXSkge1xuXHRcdGxpYnJhcnlbdGhpcy5jb25zdHJ1Y3Rvci5uYW1lXSA9IG5ldyBDbHVtcChbXSwgdGhpcyk7XG5cdH1cblx0bGlicmFyeVt0aGlzLmNvbnN0cnVjdG9yLm5hbWVdLml0ZW1zW3RoaXMuSWRdID0gdGhpcztcbn1cblxuTHVtcC5wcm90b3R5cGUgPSB7XG5cdHdpcmVVcDogZnVuY3Rpb24odGhlQXBpKSB7XG5cdFx0YXBpID0gdGhlQXBpO1xuXHRcdHRoaXMud2lyZWQgPSB0cnVlO1xuXHR9LFxuXG5cdGdldFN0YXRlczogZnVuY3Rpb24oZW5jb2RlZCkge1xuXHRcdGlmKHR5cGVvZiBlbmNvZGVkID09PSBcInN0cmluZ1wiICYmIGVuY29kZWQgIT09IFwiXCIpIHtcblx0XHRcdHZhciBtYXAgPSB7fTtcblx0XHRcdGVuY29kZWQuc3BsaXQoXCJ+XCIpLmZvckVhY2goZnVuY3Rpb24oc3RhdGUpIHtcblx0XHRcdFx0dmFyIHBhaXIgPSBzdGF0ZS5zcGxpdChcInxcIik7XG5cdFx0XHRcdG1hcFtwYWlyWzBdXSA9IHBhaXJbMV07XG5cdFx0XHR9KTtcblx0XHRcdHJldHVybiBtYXA7XG5cdFx0fVxuXHRcdGVsc2Uge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXHR9LFxuXG5cdGdldEV4b3RpY0VmZmVjdDogZnVuY3Rpb24oZW5jb2RlZCkge1xuXHRcdGlmKHR5cGVvZiBlbmNvZGVkID09PSBcInN0cmluZ1wiKSB7XG5cdFx0XHR2YXIgZWZmZWN0PXt9LCBmaWVsZHM9W1wib3BlcmF0aW9uXCIsIFwiZmlyc3RcIiwgXCJzZWNvbmRcIl07XG5cdFx0XHRlbmNvZGVkLnNwbGl0KFwiLFwiKS5mb3JFYWNoKGZ1bmN0aW9uKHZhbCwgaW5kZXgpIHtcblx0XHRcdFx0ZWZmZWN0W2ZpZWxkc1tpbmRleF1dID0gdmFsO1xuXHRcdFx0fSk7XG5cdFx0XHRyZXR1cm4gZWZmZWN0O1xuXHRcdH1cblx0XHRlbHNlIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblx0fSxcblxuXHRldmFsQWR2YW5jZWRFeHByZXNzaW9uOiBmdW5jdGlvbihleHByKSB7XG5cdFx0ZXhwciA9IGV4cHIucmVwbGFjZSgvXFxbZDooXFxkKylcXF0vZ2ksIFwiTWF0aC5mbG9vcigoTWF0aC5yYW5kb20oKSokMSkrMSlcIik7XHQvLyBSZXBsYWNlIFtkOnhdIHdpdGggSlMgdG8gY2FsY3VsYXRlIHJhbmRvbSBudW1iZXIgb24gYSBEeCBkaWVcblx0XHQvKmpzaGludCAtVzA2MSAqL1xuXHRcdHJldHVybiBldmFsKGV4cHIpO1xuXHRcdC8qanNoaW50ICtXMDYxICovXG5cdH0sXG5cblx0aXNBOiBmdW5jdGlvbih0eXBlKSB7XG5cdFx0cmV0dXJuIHRoaXMgaW5zdGFuY2VvZiB0eXBlO1xuXHR9LFxuXG5cdGlzT25lT2Y6IGZ1bmN0aW9uKHR5cGVzKSB7XG5cdFx0dmFyIHNlbGYgPSB0aGlzO1xuXHRcdHJldHVybiB0eXBlcy5tYXAoZnVuY3Rpb24odHlwZSkge1xuXHRcdFx0cmV0dXJuIHNlbGYuaXNBKHR5cGUpO1xuXHRcdH0pLnJlZHVjZShmdW5jdGlvbihwcmV2aW91c1ZhbHVlLCBjdXJyZW50VmFsdWUsIGluZGV4LCBhcnJheSl7XG5cdFx0XHRyZXR1cm4gcHJldmlvdXNWYWx1ZSB8fCBjdXJyZW50VmFsdWU7XG5cdFx0fSwgZmFsc2UpO1xuXHR9LFxuXG5cdHRvU3RyaW5nOiBmdW5jdGlvbigpIHtcblx0XHRyZXR1cm4gdGhpcy5jb25zdHJ1Y3Rvci5uYW1lICsgXCIgKCNcIiArIHRoaXMuSWQgKyBcIilcIjtcblx0fVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBMdW1wOyIsInZhciBMdW1wID0gcmVxdWlyZSgnLi9sdW1wJyk7XG5cbnZhciBhcGk7XG5cbmZ1bmN0aW9uIFBvcnQocmF3LCBwYXJlbnQpIHtcblx0dGhpcy5zdHJhaWdodENvcHkgPSBbXG5cdFx0J05hbWUnLFxuXHRcdCdSb3RhdGlvbicsXG5cdFx0J1Bvc2l0aW9uJyxcblx0XHQnRGlzY292ZXJ5VmFsdWUnLFxuXHRcdCdJc1N0YXJ0aW5nUG9ydCdcblx0XTtcblxuXG5cdHJhdy5JZCA9IHJhdy5OYW1lO1xuXHRMdW1wLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG5cblx0dGhpcy5TZXR0aW5nSWQgPSByYXcuU2V0dGluZy5JZDtcblxuXHR0aGlzLmFyZWEgPSBudWxsO1xuXG59XG5PYmplY3Qua2V5cyhMdW1wLnByb3RvdHlwZSkuZm9yRWFjaChmdW5jdGlvbihtZW1iZXIpIHsgUG9ydC5wcm90b3R5cGVbbWVtYmVyXSA9IEx1bXAucHJvdG90eXBlW21lbWJlcl07IH0pO1xuXG5Qb3J0LnByb3RvdHlwZS53aXJlVXAgPSBmdW5jdGlvbih0aGVBcGkpIHtcblx0XG5cdGFwaSA9IHRoZUFwaTtcblxuXHR0aGlzLmFyZWEgPSBhcGkuZ2V0T3JDcmVhdGUoYXBpLnR5cGVzLkFyZWEsIHRoaXMuYXR0cmlicy5BcmVhLCB0aGlzKTtcblxuXHR2YXIgc2VsZiA9IHRoaXM7XG5cdHRoaXMuZXhjaGFuZ2VzID0gYXBpLmxpYnJhcnkuRXhjaGFuZ2UucXVlcnkoXCJTZXR0aW5nSWRzXCIsIGZ1bmN0aW9uKGlkcykgeyByZXR1cm4gaWRzLmluZGV4T2Yoc2VsZi5TZXR0aW5nSWQpICE9PSAtMTsgfSk7XG5cblx0THVtcC5wcm90b3R5cGUud2lyZVVwLmNhbGwodGhpcywgYXBpKTtcbn07XG5cblBvcnQucHJvdG90eXBlLnRvU3RyaW5nID0gZnVuY3Rpb24obG9uZykge1xuXHRyZXR1cm4gdGhpcy5jb25zdHJ1Y3Rvci5uYW1lICsgXCIgXCIgKyB0aGlzLk5hbWUgKyBcIiAoI1wiICsgdGhpcy5OYW1lICsgXCIpXCI7XG59O1xuXG5Qb3J0LnByb3RvdHlwZS50b0RvbSA9IGZ1bmN0aW9uKHNpemUsIHRhZykge1xuXG5cdHNpemUgPSBzaXplIHx8IFwibm9ybWFsXCI7XG5cdHRhZyA9IHRhZyB8fCBcImxpXCI7XG5cblx0dmFyIGh0bWwgPSBcIlwiO1xuXG5cdHZhciBlbGVtZW50ID0gIGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQodGFnKTtcblx0ZWxlbWVudC5jbGFzc05hbWUgPSBcIml0ZW0gXCIrdGhpcy5jb25zdHJ1Y3Rvci5uYW1lLnRvTG93ZXJDYXNlKCkrXCItaXRlbSBcIitzaXplO1xuXG5cdGh0bWwgPSBcIlxcbjxoMyBjbGFzcz0ndGl0bGUnPlwiK3RoaXMuTmFtZStcIjwvaDM+XCI7XG5cblx0ZWxlbWVudC5pbm5lckhUTUwgPSBodG1sO1xuXG5cdGVsZW1lbnQudGl0bGUgPSB0aGlzLnRvU3RyaW5nKCk7XG5cblx0cmV0dXJuIGVsZW1lbnQ7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFBvcnQ7IiwidmFyIEx1bXAgPSByZXF1aXJlKCcuL2x1bXAnKTtcblxudmFyIGFwaTtcblxuZnVuY3Rpb24gUXVhbGl0eUVmZmVjdChyYXcsIHBhcmVudCkge1xuXHR0aGlzLnN0cmFpZ2h0Q29weSA9IFtcIkxldmVsXCIsIFwiU2V0VG9FeGFjdGx5XCJdO1xuXHRMdW1wLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG5cblx0Ly8gTWF5IGludm9sdmUgUXVhbGl0eSBvYmplY3QgcmVmZXJlbmNlcywgc28gY2FuJ3QgcmVzb2x2ZSB1bnRpbCBhZnRlciBhbGwgb2JqZWN0cyBhcmUgd2lyZWQgdXBcblx0dGhpcy5zZXRUb0V4YWN0bHlBZHZhbmNlZCA9IG51bGw7XG5cdHRoaXMuY2hhbmdlQnlBZHZhbmNlZCA9IG51bGw7XHRcblxuXHR0aGlzLmFzc29jaWF0ZWRRdWFsaXR5ID0gbnVsbDtcblx0XG59XG5PYmplY3Qua2V5cyhMdW1wLnByb3RvdHlwZSkuZm9yRWFjaChmdW5jdGlvbihtZW1iZXIpIHsgUXVhbGl0eUVmZmVjdC5wcm90b3R5cGVbbWVtYmVyXSA9IEx1bXAucHJvdG90eXBlW21lbWJlcl07IH0pO1xuXG5RdWFsaXR5RWZmZWN0LnByb3RvdHlwZS53aXJlVXAgPSBmdW5jdGlvbih0aGVBcGkpIHtcblxuXHRhcGkgPSB0aGVBcGk7XG5cblx0dGhpcy5hc3NvY2lhdGVkUXVhbGl0eSA9IGFwaS5nZXQoYXBpLnR5cGVzLlF1YWxpdHksIHRoaXMuYXR0cmlicy5Bc3NvY2lhdGVkUXVhbGl0eUlkLCB0aGlzKTtcblx0dGhpcy5zZXRUb0V4YWN0bHlBZHZhbmNlZCA9IGFwaS5kZXNjcmliZUFkdmFuY2VkRXhwcmVzc2lvbih0aGlzLmF0dHJpYnMuU2V0VG9FeGFjdGx5QWR2YW5jZWQpO1xuXHR0aGlzLmNoYW5nZUJ5QWR2YW5jZWQgPSBhcGkuZGVzY3JpYmVBZHZhbmNlZEV4cHJlc3Npb24odGhpcy5hdHRyaWJzLkNoYW5nZUJ5QWR2YW5jZWQpO1xuXG5cdEx1bXAucHJvdG90eXBlLndpcmVVcC5jYWxsKHRoaXMsIGFwaSk7XG59O1xuXG5RdWFsaXR5RWZmZWN0LnByb3RvdHlwZS5nZXRRdWFudGl0eSA9IGZ1bmN0aW9uKCkge1xuXHR2YXIgY29uZGl0aW9uID0gXCJcIjtcblx0XG5cdGlmKHRoaXMuc2V0VG9FeGFjdGx5QWR2YW5jZWQgIT09IG51bGwpIHtcblx0XHRjb25kaXRpb24gPSBcIisoXCIgKyB0aGlzLnNldFRvRXhhY3RseUFkdmFuY2VkICsgXCIpXCI7XG5cdH1cblx0ZWxzZSBpZih0aGlzLlNldFRvRXhhY3RseSAhPT0gbnVsbCkge1xuXHRcdGNvbmRpdGlvbiA9IFwiPSBcIiArIHRoaXMuU2V0VG9FeGFjdGx5O1xuXHR9XG5cdGVsc2UgaWYodGhpcy5jaGFuZ2VCeUFkdmFuY2VkICE9PSBudWxsKSB7XG5cdFx0Y29uZGl0aW9uID0gXCIrKFwiICsgdGhpcy5jaGFuZ2VCeUFkdmFuY2VkICsgXCIpXCI7XG5cdH1cblx0ZWxzZSBpZih0aGlzLkxldmVsICE9PSBudWxsKSB7XG5cdFx0aWYodGhpcy5MZXZlbCA8IDApIHtcblx0XHRcdGNvbmRpdGlvbiA9IHRoaXMuTGV2ZWw7XG5cdFx0fVxuXHRcdGVsc2UgaWYodGhpcy5MZXZlbCA+IDApIHtcblx0XHRcdGNvbmRpdGlvbiA9IFwiK1wiICsgdGhpcy5MZXZlbDtcblx0XHR9XG5cdH1cblx0XG5cdHJldHVybiBjb25kaXRpb247XG59O1xuXG5RdWFsaXR5RWZmZWN0LnByb3RvdHlwZS5pc0FkZGl0aXZlID0gZnVuY3Rpb24oKSB7XG5cdHJldHVybiB0aGlzLnNldFRvRXhhY3RseUFkdmFuY2VkIHx8IHRoaXMuU2V0VG9FeGFjdGx5IHx8IHRoaXMuY2hhbmdlQnlBZHZhbmNlZCB8fCAodGhpcy5MZXZlbCA+IDApO1xufTtcblxuUXVhbGl0eUVmZmVjdC5wcm90b3R5cGUuaXNTdWJ0cmFjdGl2ZSA9IGZ1bmN0aW9uKCkge1xuXHRyZXR1cm4gIXRoaXMuc2V0VG9FeGFjdGx5QWR2YW5jZWQgJiYgIXRoaXMuU2V0VG9FeGFjdGx5ICYmICF0aGlzLmNoYW5nZUJ5QWR2YW5jZWQgJiYgKHRoaXMuTGV2ZWwgPD0gMCk7XG59O1xuXG5RdWFsaXR5RWZmZWN0LnByb3RvdHlwZS50b1N0cmluZyA9IGZ1bmN0aW9uKCkge1xuXHR2YXIgcXVhbGl0eSA9IHRoaXMuYXNzb2NpYXRlZFF1YWxpdHk7XG5cdHJldHVybiB0aGlzLmNvbnN0cnVjdG9yLm5hbWUgKyBcIiAoXCIrdGhpcy5JZCtcIikgb24gXCIgKyBxdWFsaXR5ICsgdGhpcy5nZXRRdWFudGl0eSgpO1xufTtcblxuUXVhbGl0eUVmZmVjdC5wcm90b3R5cGUudG9Eb20gPSBmdW5jdGlvbihzaXplKSB7XG5cblx0c2l6ZSA9IHNpemUgfHwgXCJzbWFsbFwiO1xuXG5cdHZhciBlbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImxpXCIpO1xuXHRlbGVtZW50LmNsYXNzTmFtZSA9IFwiaXRlbSBcIit0aGlzLmNvbnN0cnVjdG9yLm5hbWUudG9Mb3dlckNhc2UoKStcIi1pdGVtIFwiK3NpemU7XG5cblx0dmFyIHF1YWxpdHlfZWxlbWVudCA9IHRoaXMuYXNzb2NpYXRlZFF1YWxpdHk7XG5cblx0aWYoIXF1YWxpdHlfZWxlbWVudCkge1xuXHRcdHF1YWxpdHlfZWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJzcGFuXCIpO1xuXHRcdHF1YWxpdHlfZWxlbWVudC5pbm5lckhUTUwgPSBcIltJTlZBTElEXVwiO1xuXHR9XG5cdGVsc2Uge1xuXHRcdHF1YWxpdHlfZWxlbWVudCA9IHRoaXMuYXNzb2NpYXRlZFF1YWxpdHkudG9Eb20oc2l6ZSwgZmFsc2UsIFwic3BhblwiKTtcblx0fVxuXG5cdHZhciBxdWFudGl0eV9lbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInNwYW5cIik7XG5cdHF1YW50aXR5X2VsZW1lbnQuY2xhc3NOYW1lID0gXCJpdGVtIHF1YW50aXR5XCI7XG5cdHF1YW50aXR5X2VsZW1lbnQuaW5uZXJIVE1MID0gdGhpcy5nZXRRdWFudGl0eSgpO1xuXHRxdWFudGl0eV9lbGVtZW50LnRpdGxlID0gdGhpcy50b1N0cmluZygpO1xuXG5cdGVsZW1lbnQuYXBwZW5kQ2hpbGQocXVhbGl0eV9lbGVtZW50KTtcblx0ZWxlbWVudC5hcHBlbmRDaGlsZChxdWFudGl0eV9lbGVtZW50KTtcblxuXHRyZXR1cm4gZWxlbWVudDtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gUXVhbGl0eUVmZmVjdDsiLCJ2YXIgTHVtcCA9IHJlcXVpcmUoJy4vbHVtcCcpO1xuXG52YXIgYXBpO1xuXG5mdW5jdGlvbiBRdWFsaXR5UmVxdWlyZW1lbnQocmF3LCBwYXJlbnQpIHtcblx0dGhpcy5zdHJhaWdodENvcHkgPSBbJ01pbkxldmVsJywgJ01heExldmVsJ107XG5cdEx1bXAuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcblxuXHR0aGlzLmRpZmZpY3VsdHlBZHZhbmNlZCA9IG51bGw7XG5cdHRoaXMubWluQWR2YW5jZWQgPSBudWxsO1xuXHR0aGlzLm1heEFkdmFuY2VkID0gbnVsbDtcblxuXHR0aGlzLmFzc29jaWF0ZWRRdWFsaXR5ID0gbnVsbDtcblx0dGhpcy5jaGFuY2VRdWFsaXR5ID0gbnVsbDtcbn1cbk9iamVjdC5rZXlzKEx1bXAucHJvdG90eXBlKS5mb3JFYWNoKGZ1bmN0aW9uKG1lbWJlcikgeyBRdWFsaXR5UmVxdWlyZW1lbnQucHJvdG90eXBlW21lbWJlcl0gPSBMdW1wLnByb3RvdHlwZVttZW1iZXJdOyB9KTtcblxuUXVhbGl0eVJlcXVpcmVtZW50LnByb3RvdHlwZS53aXJlVXAgPSBmdW5jdGlvbih0aGVBcGkpIHtcblxuXHRhcGkgPSB0aGVBcGk7XG5cblx0dGhpcy5kaWZmaWN1bHR5QWR2YW5jZWQgPSBhcGkuZGVzY3JpYmVBZHZhbmNlZEV4cHJlc3Npb24odGhpcy5hdHRyaWJzLkRpZmZpY3VsdHlBZHZhbmNlZCk7XG5cdHRoaXMubWluQWR2YW5jZWQgPSBhcGkuZGVzY3JpYmVBZHZhbmNlZEV4cHJlc3Npb24odGhpcy5hdHRyaWJzLk1pbkFkdmFuY2VkKTtcblx0dGhpcy5tYXhBZHZhbmNlZCA9IGFwaS5kZXNjcmliZUFkdmFuY2VkRXhwcmVzc2lvbih0aGlzLmF0dHJpYnMuTWF4QWR2YW5jZWQpO1xuXG5cdHRoaXMuYXNzb2NpYXRlZFF1YWxpdHkgPSBhcGkuZ2V0KGFwaS50eXBlcy5RdWFsaXR5LCB0aGlzLmF0dHJpYnMuQXNzb2NpYXRlZFF1YWxpdHlJZCwgdGhpcyk7XG5cblx0dGhpcy5jaGFuY2VRdWFsaXR5ID0gdGhpcy5nZXRDaGFuY2VDYXAoKTtcblxuXHRMdW1wLnByb3RvdHlwZS53aXJlVXAuY2FsbCh0aGlzLCBhcGkpO1xufTtcblxuUXVhbGl0eVJlcXVpcmVtZW50LnByb3RvdHlwZS5nZXRDaGFuY2VDYXAgPSBmdW5jdGlvbigpIHtcblx0dmFyIHF1YWxpdHkgPSBudWxsO1xuXHRpZighdGhpcy5hdHRyaWJzLkRpZmZpY3VsdHlMZXZlbCkge1xuXHRcdHJldHVybiBudWxsO1xuXHR9XG5cdHF1YWxpdHkgPSB0aGlzLmFzc29jaWF0ZWRRdWFsaXR5O1xuXHRpZighcXVhbGl0eSkge1xuXHRcdHJldHVybiBudWxsO1xuXHR9XG5cdFxuXHRyZXR1cm4gTWF0aC5yb3VuZCh0aGlzLmF0dHJpYnMuRGlmZmljdWx0eUxldmVsICogKCgxMDAgKyBxdWFsaXR5LkRpZmZpY3VsdHlTY2FsZXIgKyA3KS8xMDApKTtcbn07XG5cblF1YWxpdHlSZXF1aXJlbWVudC5wcm90b3R5cGUuZ2V0UXVhbnRpdHkgPSBmdW5jdGlvbigpIHtcblx0dmFyIGNvbmRpdGlvbiA9IFwiXCI7XG5cbiAgaWYodGhpcy5kaWZmaWN1bHR5QWR2YW5jZWQgIT09IG51bGwpIHtcbiAgXHRjb25kaXRpb24gPSB0aGlzLmRpZmZpY3VsdHlBZHZhbmNlZDtcbiAgfVxuICBlbHNlIGlmKHRoaXMubWluQWR2YW5jZWQgIT09IG51bGwpIHtcbiAgXHRjb25kaXRpb24gPSB0aGlzLm1pbkFkdmFuY2VkO1xuICB9XG4gIGVsc2UgaWYodGhpcy5tYXhBZHZhbmNlZCAhPT0gbnVsbCkge1xuICBcdGNvbmRpdGlvbiA9IHRoaXMubWF4QWR2YW5jZWQ7XG4gIH1cblx0ZWxzZSBpZih0aGlzLmNoYW5jZVF1YWxpdHkgIT09IG51bGwpIHtcblx0XHRjb25kaXRpb24gPSB0aGlzLmNoYW5jZVF1YWxpdHkgKyBcIiBmb3IgMTAwJVwiO1xuXHR9XG5cdGVsc2UgaWYodGhpcy5NYXhMZXZlbCAhPT0gbnVsbCAmJiB0aGlzLk1pbkxldmVsICE9PSBudWxsKSB7XG5cdFx0aWYodGhpcy5NYXhMZXZlbCA9PT0gdGhpcy5NaW5MZXZlbCkge1xuXHRcdFx0Y29uZGl0aW9uID0gXCI9IFwiICsgdGhpcy5NaW5MZXZlbDtcblx0XHR9XG5cdFx0ZWxzZSB7XG5cdFx0XHRjb25kaXRpb24gPSB0aGlzLk1pbkxldmVsICsgXCItXCIgKyB0aGlzLk1heExldmVsO1xuXHRcdH1cblx0fVxuXHRlbHNlIHtcblx0XHRpZih0aGlzLk1pbkxldmVsICE9PSBudWxsKSB7XG5cdFx0XHRjb25kaXRpb24gPSBcIiZnZTsgXCIgKyB0aGlzLk1pbkxldmVsO1xuXHRcdH1cblx0XHRpZih0aGlzLk1heExldmVsICE9PSBudWxsKSB7XG5cdFx0XHRjb25kaXRpb24gPSBcIiZsZTsgXCIgKyB0aGlzLk1heExldmVsO1xuXHRcdH1cblx0fVxuXHRyZXR1cm4gY29uZGl0aW9uO1xufTtcblxuUXVhbGl0eVJlcXVpcmVtZW50LnByb3RvdHlwZS50b1N0cmluZyA9IGZ1bmN0aW9uKCkge1xuXHR2YXIgcXVhbGl0eSA9IHRoaXMuYXNzb2NpYXRlZFF1YWxpdHk7XG5cdHJldHVybiB0aGlzLmNvbnN0cnVjdG9yLm5hbWUgKyBcIiAoXCIrdGhpcy5JZCtcIikgb24gXCIgKyBxdWFsaXR5ICsgXCIgXCIgKyB0aGlzLmdldFF1YW50aXR5KCk7XG59O1xuXG5RdWFsaXR5UmVxdWlyZW1lbnQucHJvdG90eXBlLnRvRG9tID0gZnVuY3Rpb24oc2l6ZSkge1xuXG5cdHNpemUgPSBzaXplIHx8IFwic21hbGxcIjtcblxuXHR2YXIgZWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJsaVwiKTtcblx0ZWxlbWVudC5jbGFzc05hbWUgPSBcIml0ZW0gXCIrdGhpcy5jb25zdHJ1Y3Rvci5uYW1lLnRvTG93ZXJDYXNlKCkrXCItaXRlbSBcIitzaXplO1xuXG5cdHZhciBxdWFsaXR5X2VsZW1lbnQgPSB0aGlzLmFzc29jaWF0ZWRRdWFsaXR5O1xuXG5cdGlmKCFxdWFsaXR5X2VsZW1lbnQpIHtcblx0XHRxdWFsaXR5X2VsZW1lbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwic3BhblwiKTtcblx0XHRxdWFsaXR5X2VsZW1lbnQuaW5uZXJIVE1MID0gXCJbSU5WQUxJRF1cIjtcblx0fVxuXHRlbHNlIHtcblx0XHRxdWFsaXR5X2VsZW1lbnQgPSB0aGlzLmFzc29jaWF0ZWRRdWFsaXR5LnRvRG9tKHNpemUsIGZhbHNlLCBcInNwYW5cIik7XG5cdH1cblxuXHR2YXIgcXVhbnRpdHlfZWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJzcGFuXCIpO1xuXHRxdWFudGl0eV9lbGVtZW50LmNsYXNzTmFtZSA9IFwiaXRlbSBxdWFudGl0eVwiO1xuXHRxdWFudGl0eV9lbGVtZW50LmlubmVySFRNTCA9IHRoaXMuZ2V0UXVhbnRpdHkoKTtcblx0cXVhbnRpdHlfZWxlbWVudC50aXRsZSA9IHRoaXMudG9TdHJpbmcoKTtcblxuXHRlbGVtZW50LmFwcGVuZENoaWxkKHF1YWxpdHlfZWxlbWVudCk7XG5cdGVsZW1lbnQuYXBwZW5kQ2hpbGQocXVhbnRpdHlfZWxlbWVudCk7XG5cblx0cmV0dXJuIGVsZW1lbnQ7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFF1YWxpdHlSZXF1aXJlbWVudDsiLCJ2YXIgTHVtcCA9IHJlcXVpcmUoJy4vbHVtcCcpO1xudmFyIENsdW1wID0gcmVxdWlyZSgnLi9jbHVtcCcpO1xuXG52YXIgYXBpO1xuXG5mdW5jdGlvbiBRdWFsaXR5KHJhdywgcGFyZW50KSB7XG5cdHRoaXMuc3RyYWlnaHRDb3B5ID0gW1xuXHRcdCdOYW1lJyxcblx0XHQnRGVzY3JpcHRpb24nLFxuXHRcdCdJbWFnZScsXG5cblx0XHQnQ2F0ZWdvcnknLFxuXHRcdCdOYXR1cmUnLFxuXHRcdCdUYWcnLFxuXG5cdFx0XCJJc1Nsb3RcIixcblxuXHRcdCdBbGxvd2VkT24nLFxuXHRcdFwiQXZhaWxhYmxlQXRcIixcblxuXHRcdCdDYXAnLFxuXHRcdCdEaWZmaWN1bHR5U2NhbGVyJyxcblx0XHQnRW5oYW5jZW1lbnRzJ1xuXHRdO1xuXHRMdW1wLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG5cblx0dGhpcy5TdGF0ZXMgPSB0aGlzLmdldFN0YXRlcyhyYXcuQ2hhbmdlRGVzY3JpcHRpb25UZXh0KTtcblx0dGhpcy5MZXZlbERlc2NyaXB0aW9uVGV4dCA9IHRoaXMuZ2V0U3RhdGVzKHJhdy5MZXZlbERlc2NyaXB0aW9uVGV4dCk7XG5cdHRoaXMuTGV2ZWxJbWFnZVRleHQgPSB0aGlzLmdldFN0YXRlcyhyYXcuTGV2ZWxJbWFnZVRleHQpO1xuXG5cdHRoaXMudXNlRXZlbnQgPSBudWxsO1xufVxuT2JqZWN0LmtleXMoTHVtcC5wcm90b3R5cGUpLmZvckVhY2goZnVuY3Rpb24obWVtYmVyKSB7IFF1YWxpdHkucHJvdG90eXBlW21lbWJlcl0gPSBMdW1wLnByb3RvdHlwZVttZW1iZXJdOyB9KTtcblxuUXVhbGl0eS5wcm90b3R5cGUud2lyZVVwID0gZnVuY3Rpb24odGhlQXBpKSB7XG5cblx0YXBpID0gdGhlQXBpO1xuXG5cdHRoaXMudXNlRXZlbnQgPSBhcGkuZ2V0T3JDcmVhdGUoYXBpLnR5cGVzLkV2ZW50LCB0aGlzLmF0dHJpYnMuVXNlRXZlbnQsIHRoaXMpO1xuXHRpZih0aGlzLnVzZUV2ZW50KSB7XG5cdFx0dGhpcy51c2VFdmVudC50YWcgPSBcInVzZVwiO1xuXHR9XG5cblx0THVtcC5wcm90b3R5cGUud2lyZVVwLmNhbGwodGhpcywgYXBpKTtcbn07XG5cblF1YWxpdHkucHJvdG90eXBlLnRvU3RyaW5nID0gZnVuY3Rpb24obG9uZykge1xuXHRyZXR1cm4gdGhpcy5jb25zdHJ1Y3Rvci5uYW1lICsgXCIgXCIgKyAobG9uZyA/IFwiIFtcIiArIHRoaXMuTmF0dXJlICsgXCIgPiBcIiArIHRoaXMuQ2F0ZWdvcnkgKyBcIiA+IFwiICsgdGhpcy5UYWcgKyBcIl0gXCIgOiBcIlwiKSArIHRoaXMuTmFtZSArIFwiICgjXCIgKyB0aGlzLklkICsgXCIpXCI7XG59O1xuXG5RdWFsaXR5LnByb3RvdHlwZS50b0RvbSA9IGZ1bmN0aW9uKHNpemUsIGluY2x1ZGVDaGlsZHJlbiwgdGFnKSB7XG5cblx0c2l6ZSA9IHNpemUgfHwgXCJub3JtYWxcIjtcblx0aW5jbHVkZUNoaWxkcmVuID0gaW5jbHVkZUNoaWxkcmVuID09PSBmYWxzZSA/IGZhbHNlIDogdHJ1ZTtcblx0dGFnID0gdGFnIHx8IFwibGlcIjtcblxuXHR2YXIgaHRtbCA9IFwiXCI7XG5cblx0dmFyIGVsZW1lbnQgPSAgZG9jdW1lbnQuY3JlYXRlRWxlbWVudCh0YWcpO1xuXHRlbGVtZW50LmNsYXNzTmFtZSA9IFwiaXRlbSBcIit0aGlzLmNvbnN0cnVjdG9yLm5hbWUudG9Mb3dlckNhc2UoKStcIi1pdGVtIFwiK3NpemU7XG5cblx0aHRtbCA9IFwiXFxuPGltZyBjbGFzcz0naWNvbicgc3JjPSdcIithcGkuY29uZmlnLmxvY2F0aW9ucy5pbWFnZXNQYXRoK1wiL1wiK3RoaXMuSW1hZ2UrXCJzbWFsbC5wbmcnIC8+XCI7XG5cdGh0bWwgKz0gXCJcXG48aDMgY2xhc3M9J3RpdGxlJz5cIit0aGlzLk5hbWUrXCI8L2gzPlwiO1xuXHRodG1sICs9IFwiXFxuPHAgY2xhc3M9J2Rlc2NyaXB0aW9uJz5cIit0aGlzLkRlc2NyaXB0aW9uK1wiPC9wPlwiO1xuXG5cdGVsZW1lbnQuaW5uZXJIVE1MID0gaHRtbDtcblxuXHRlbGVtZW50LnRpdGxlID0gdGhpcy50b1N0cmluZygpO1xuXG5cdGlmKGluY2x1ZGVDaGlsZHJlbikge1xuXHRcdHZhciBzZWxmID0gdGhpcztcblx0XHRlbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCBmdW5jdGlvbihlKSB7XG5cdFx0XHRlLnN0b3BQcm9wYWdhdGlvbigpO1xuXG5cdFx0XHR2YXIgY2hpbGRMaXN0ID0gZWxlbWVudC5xdWVyeVNlbGVjdG9yKFwiLmNoaWxkLWxpc3RcIik7XG5cdFx0XHRpZihjaGlsZExpc3QpIHtcblx0XHRcdFx0ZWxlbWVudC5yZW1vdmVDaGlsZChjaGlsZExpc3QpO1xuXHRcdFx0fVxuXHRcdFx0ZWxzZSB7XG5cdFx0XHRcdGlmKHNlbGYudXNlRXZlbnQpIHtcblxuXHRcdFx0XHRcdHZhciB3cmFwcGVyQ2x1bXAgPSBuZXcgQ2x1bXAoW3NlbGYudXNlRXZlbnRdLCBhcGkudHlwZXMuRXZlbnQpO1xuXHRcdFx0XHRcdHZhciBjaGlsZF9ldmVudHMgPSB3cmFwcGVyQ2x1bXAudG9Eb20oc2l6ZSwgdHJ1ZSk7XG5cblx0XHRcdFx0XHRjaGlsZF9ldmVudHMuY2xhc3NMaXN0LmFkZChcImNoaWxkLWxpc3RcIik7XG5cdFx0XHRcdFx0ZWxlbWVudC5hcHBlbmRDaGlsZChjaGlsZF9ldmVudHMpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRyZXR1cm4gZWxlbWVudDtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gUXVhbGl0eTsiLCJ2YXIgTHVtcCA9IHJlcXVpcmUoJy4vbHVtcCcpO1xudmFyIENsdW1wID0gcmVxdWlyZSgnLi9jbHVtcCcpO1xuXG52YXIgYXBpO1xuXG5mdW5jdGlvbiBTaG9wKHJhdywgcGFyZW50KSB7XG5cdHRoaXMuc3RyYWlnaHRDb3B5ID0gW1xuXHRcdCdJZCcsXG5cdFx0J05hbWUnLFxuXHRcdCdEZXNjcmlwdGlvbicsXG5cdFx0J0ltYWdlJyxcblx0XHQnT3JkZXJpbmcnXG5cdF07XG5cdEx1bXAuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcblxuXHR0aGlzLmF2YWlsYWJpbGl0aWVzID0gbnVsbDtcblx0dGhpcy51bmxvY2tDb3N0ID0gbnVsbDtcbn1cbk9iamVjdC5rZXlzKEx1bXAucHJvdG90eXBlKS5mb3JFYWNoKGZ1bmN0aW9uKG1lbWJlcikgeyBTaG9wLnByb3RvdHlwZVttZW1iZXJdID0gTHVtcC5wcm90b3R5cGVbbWVtYmVyXTsgfSk7XG5cblNob3AucHJvdG90eXBlLndpcmVVcCA9IGZ1bmN0aW9uKHRoZUFwaSkge1xuXG5cdGFwaSA9IHRoZUFwaTtcblxuXHR0aGlzLmF2YWlsYWJpbGl0aWVzID0gbmV3IENsdW1wKHRoaXMuYXR0cmlicy5BdmFpbGFiaWxpdGllcyB8fCBbXSwgYXBpLnR5cGVzLkF2YWlsYWJpbGl0eSwgdGhpcyk7XG5cblx0THVtcC5wcm90b3R5cGUud2lyZVVwLmNhbGwodGhpcyk7XG59O1xuXG5TaG9wLnByb3RvdHlwZS50b1N0cmluZyA9IGZ1bmN0aW9uKCkge1xuXHRyZXR1cm4gdGhpcy5jb25zdHJ1Y3Rvci5uYW1lICsgXCIgXCIgKyB0aGlzLk5hbWUgKyBcIiAoI1wiICsgdGhpcy5JZCArIFwiKVwiO1xufTtcblxuU2hvcC5wcm90b3R5cGUudG9Eb20gPSBmdW5jdGlvbihzaXplLCBpbmNsdWRlQ2hpbGRyZW4sIHRhZykge1xuXG5cdHNpemUgPSBzaXplIHx8IFwibm9ybWFsXCI7XG5cdGluY2x1ZGVDaGlsZHJlbiA9IGluY2x1ZGVDaGlsZHJlbiA9PT0gZmFsc2UgPyBmYWxzZSA6IHRydWU7XG5cdHRhZyA9IHRhZyB8fCBcImxpXCI7XG5cblx0dmFyIHNlbGYgPSB0aGlzO1xuXHR2YXIgaHRtbCA9IFwiXCI7XG5cblx0dmFyIGVsZW1lbnQgPSAgZG9jdW1lbnQuY3JlYXRlRWxlbWVudCh0YWcpO1xuXHRlbGVtZW50LmNsYXNzTmFtZSA9IFwiaXRlbSBcIit0aGlzLmNvbnN0cnVjdG9yLm5hbWUudG9Mb3dlckNhc2UoKStcIi1pdGVtIFwiK3NpemU7XG5cblx0aHRtbCA9IFwiXFxuPGltZyBjbGFzcz0naWNvbicgc3JjPSdcIithcGkuY29uZmlnLmxvY2F0aW9ucy5pbWFnZXNQYXRoK1wiL1wiK3RoaXMuSW1hZ2UrXCIucG5nJyAvPlwiO1xuXHRodG1sICs9IFwiXFxuPGgzIGNsYXNzPSd0aXRsZSc+XCIrdGhpcy5OYW1lK1wiPC9oMz5cIjtcblx0aHRtbCArPSBcIlxcbjxwIGNsYXNzPSdkZXNjcmlwdGlvbic+XCIrdGhpcy5EZXNjcmlwdGlvbitcIjwvcD5cIjtcblxuXHRlbGVtZW50LmlubmVySFRNTCA9IGh0bWw7XG5cblx0ZWxlbWVudC50aXRsZSA9IHRoaXMudG9TdHJpbmcoKTtcblxuXHRpZihpbmNsdWRlQ2hpbGRyZW4pIHtcblx0XHRlbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCBmdW5jdGlvbihlKSB7XG5cdFx0XHRlLnN0b3BQcm9wYWdhdGlvbigpO1xuXG5cdFx0XHR2YXIgY2hpbGRMaXN0ID0gZWxlbWVudC5xdWVyeVNlbGVjdG9yKFwiLmNoaWxkLWxpc3RcIik7XG5cdFx0XHRpZihjaGlsZExpc3QpIHtcblx0XHRcdFx0ZWxlbWVudC5yZW1vdmVDaGlsZChjaGlsZExpc3QpO1xuXHRcdFx0fVxuXHRcdFx0ZWxzZSB7XG5cdFx0XHRcdGlmKHNlbGYuYXZhaWxhYmlsaXRpZXMpIHtcblxuXHRcdFx0XHRcdHZhciBjaGlsZF9lbGVtZW50cyA9IHNlbGYuYXZhaWxhYmlsaXRpZXMudG9Eb20oXCJub3JtYWxcIiwgdHJ1ZSk7XG5cblx0XHRcdFx0XHRjaGlsZF9lbGVtZW50cy5jbGFzc0xpc3QuYWRkKFwiY2hpbGQtbGlzdFwiKTtcblx0XHRcdFx0XHRlbGVtZW50LmFwcGVuZENoaWxkKGNoaWxkX2VsZW1lbnRzKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0cmV0dXJuIGVsZW1lbnQ7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFNob3A7IiwidmFyIEx1bXAgPSByZXF1aXJlKCcuL2x1bXAnKTtcbnZhciBDbHVtcCA9IHJlcXVpcmUoJy4vY2x1bXAnKTtcblxudmFyIGFwaTtcblxuZnVuY3Rpb24gU3Bhd25lZEVudGl0eShyYXcsIHBhcmVudCkge1xuXHR0aGlzLnN0cmFpZ2h0Q29weSA9IFtcblx0XHQnTmFtZScsXG5cdFx0J0h1bWFuTmFtZScsXG5cblx0XHQnTmV1dHJhbCcsXG5cdFx0J1ByZWZhYk5hbWUnLFxuXHRcdCdEb3JtYW50QmVoYXZpb3VyJyxcblx0XHQnQXdhcmVCZWhhdmlvdXInLFxuXG5cdFx0J0h1bGwnLFxuXHRcdCdDcmV3Jyxcblx0XHQnTGlmZScsXG5cdFx0J01vdmVtZW50U3BlZWQnLFxuXHRcdCdSb3RhdGlvblNwZWVkJyxcblx0XHQnQmVhc3RpZUNoYXJhY3RlcmlzdGljc05hbWUnLFxuXHRcdCdDb21iYXRJdGVtcycsXG5cdFx0J0xvb3RQcmVmYWJOYW1lJyxcblx0XHQnR2xlYW1WYWx1ZSdcblx0XTtcblx0cmF3LklkID0gcmF3Lk5hbWU7XG5cdEx1bXAuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcblxuXHR0aGlzLnBhY2lmeUV2ZW50ID0gbnVsbDtcblx0dGhpcy5raWxsUXVhbGl0eUV2ZW50ID0gbnVsbDtcblx0dGhpcy5jb21iYXRBdHRhY2tOYW1lcyA9IFtdO1xuXG5cdHRoaXMuaW1hZ2UgPSBudWxsO1xufVxuT2JqZWN0LmtleXMoTHVtcC5wcm90b3R5cGUpLmZvckVhY2goZnVuY3Rpb24obWVtYmVyKSB7IFNwYXduZWRFbnRpdHkucHJvdG90eXBlW21lbWJlcl0gPSBMdW1wLnByb3RvdHlwZVttZW1iZXJdOyB9KTtcblxuU3Bhd25lZEVudGl0eS5wcm90b3R5cGUud2lyZVVwID0gZnVuY3Rpb24odGhlQXBpKSB7XG5cblx0YXBpID0gdGhlQXBpO1xuXG5cdHZhciBzZWxmID0gdGhpcztcblx0XG5cdHRoaXMuY29tYmF0QXR0YWNrTmFtZXMgPSAodGhpcy5hdHRyaWJzLkNvbWJhdEF0dGFja05hbWVzIHx8IFtdKS5tYXAoZnVuY3Rpb24obmFtZSkge1xuXHRcdHJldHVybiBhcGkuZ2V0KGFwaS50eXBlcy5Db21iYXRBdHRhY2ssIG5hbWUsIHNlbGYpO1xuXHR9KS5maWx0ZXIoZnVuY3Rpb24oYXR0YWNrKSB7XG5cdFx0cmV0dXJuIHR5cGVvZiBhdHRhY2sgPT09IFwib2JqZWN0XCI7XG5cdH0pO1xuXG5cdHRoaXMucGFjaWZ5RXZlbnQgPSBhcGkuZ2V0KGFwaS50eXBlcy5FdmVudCwgdGhpcy5hdHRyaWJzLlBhY2lmeUV2ZW50SWQsIHRoaXMpO1xuXHRpZih0aGlzLnBhY2lmeUV2ZW50KSB7XG5cdFx0dGhpcy5wYWNpZnlFdmVudC50YWcgPSBcInBhY2lmaWVkXCI7XG5cdH1cblxuXHR0aGlzLmtpbGxRdWFsaXR5RXZlbnQgPSBhcGkuZ2V0KGFwaS50eXBlcy5FdmVudCwgdGhpcy5hdHRyaWJzLktpbGxRdWFsaXR5RXZlbnRJZCwgdGhpcyk7XG5cdGlmKHRoaXMua2lsbFF1YWxpdHlFdmVudCkge1xuXHRcdHRoaXMua2lsbFF1YWxpdHlFdmVudC50YWcgPSBcImtpbGxlZFwiO1xuXHR9XG5cblx0dGhpcy5pbWFnZSA9ICgodGhpcy5raWxsUXVhbGl0eUV2ZW50ICYmIHRoaXMua2lsbFF1YWxpdHlFdmVudC5JbWFnZSkgfHwgKHRoaXMucGFjaWZ5RXZlbnQgJiYgdGhpcy5wYWNpZnlFdmVudC5JbWFnZSkpO1xuXG5cdEx1bXAucHJvdG90eXBlLndpcmVVcC5jYWxsKHRoaXMsIGFwaSk7XG59O1xuXG5TcGF3bmVkRW50aXR5LnByb3RvdHlwZS50b1N0cmluZyA9IGZ1bmN0aW9uKCkge1xuXHRyZXR1cm4gdGhpcy5jb25zdHJ1Y3Rvci5uYW1lICsgXCIgXCIgKyB0aGlzLkh1bWFuTmFtZSArIFwiICgjXCIgKyB0aGlzLklkICsgXCIpXCI7XG59O1xuXG5TcGF3bmVkRW50aXR5LnByb3RvdHlwZS50b0RvbSA9IGZ1bmN0aW9uKHNpemUsIGluY2x1ZGVDaGlsZHJlbikge1xuXG5cdHNpemUgPSBzaXplIHx8IFwibm9ybWFsXCI7XG5cdGluY2x1ZGVDaGlsZHJlbiA9IGluY2x1ZGVDaGlsZHJlbiA9PT0gZmFsc2UgPyBmYWxzZSA6IHRydWU7XG5cblx0dmFyIHNlbGYgPSB0aGlzO1xuXG5cdHZhciBodG1sID0gXCJcIjtcblxuXHR2YXIgZWxlbWVudCA9ICBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwibGlcIik7XG5cdGVsZW1lbnQuY2xhc3NOYW1lID0gXCJpdGVtIFwiK3RoaXMuY29uc3RydWN0b3IubmFtZS50b0xvd2VyQ2FzZSgpK1wiLWl0ZW0gXCIrc2l6ZTtcblxuXHRpZih0aGlzLkltYWdlICE9PSBudWxsICYmIHRoaXMuSW1hZ2UgIT09IFwiXCIpIHtcblx0XHRodG1sID0gXCI8aW1nIGNsYXNzPSdpY29uJyBzcmM9J1wiK2FwaS5jb25maWcubG9jYXRpb25zLmltYWdlc1BhdGgrXCIvXCIrdGhpcy5pbWFnZStcInNtYWxsLnBuZycgLz5cIjtcblx0fVxuXG5cdGh0bWwgKz0gXCJcXG48aDMgY2xhc3M9J3RpdGxlJz5cIit0aGlzLkh1bWFuTmFtZStcIjwvaDM+XCI7XG5cblx0aWYoc2l6ZSAhPT0gXCJzbWFsbFwiKSB7XG5cdFx0aWYodGhpcy5xdWFsaXRpZXNSZXF1aXJlZCkge1xuXHRcdFx0aHRtbCArPSBcIjxkaXYgY2xhc3M9J3NpZGViYXInPlwiO1xuXHRcdFx0aHRtbCArPSB0aGlzLnF1YWxpdGllc1JlcXVpcmVkLnRvRG9tKFwic21hbGxcIiwgZmFsc2UsIFwidWxcIikub3V0ZXJIVE1MO1xuXHRcdFx0aHRtbCArPSBcIjwvZGl2PlwiO1xuXHRcdH1cblxuXHRcdGh0bWwgKz0gXCI8ZGwgY2xhc3M9J2NsdW1wLWxpc3Qgc21hbGwnPlwiO1xuXG5cdFx0WydIdWxsJywgJ0NyZXcnLCAnTGlmZScsICdNb3ZlbWVudFNwZWVkJywgJ1JvdGF0aW9uU3BlZWQnXS5mb3JFYWNoKGZ1bmN0aW9uKGtleSkge1xuXHRcdFx0aHRtbCArPSBcIjxkdCBjbGFzcz0naXRlbSc+XCIra2V5K1wiPC9kdD48ZGQgY2xhc3M9J3F1YW50aXR5Jz5cIitzZWxmW2tleV0rXCI8L2RkPlwiO1xuXHRcdH0pO1xuXHRcdGh0bWwgKz0gXCI8L2RsPlwiO1xuXHR9XG5cblx0ZWxlbWVudC5pbm5lckhUTUwgPSBodG1sO1xuXG5cdGVsZW1lbnQudGl0bGUgPSB0aGlzLnRvU3RyaW5nKCk7XG5cblx0aWYoaW5jbHVkZUNoaWxkcmVuKSB7XG5cdFx0ZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgZnVuY3Rpb24oZSkge1xuXHRcdFx0ZS5zdG9wUHJvcGFnYXRpb24oKTtcblxuXHRcdFx0dmFyIGNoaWxkTGlzdCA9IGVsZW1lbnQucXVlcnlTZWxlY3RvcihcIi5jaGlsZC1saXN0XCIpO1xuXHRcdFx0aWYoY2hpbGRMaXN0KSB7XG5cdFx0XHRcdGVsZW1lbnQucmVtb3ZlQ2hpbGQoY2hpbGRMaXN0KTtcblx0XHRcdH1cblx0XHRcdGVsc2Uge1xuXHRcdFx0XHR2YXIgc3VjY2Vzc0V2ZW50ID0gc2VsZi5zdWNjZXNzRXZlbnQ7XG5cdFx0XHRcdHZhciBkZWZhdWx0RXZlbnQgPSBzZWxmLmRlZmF1bHRFdmVudDtcblx0XHRcdFx0dmFyIHF1YWxpdGllc1JlcXVpcmVkID0gIHNlbGYucXVhbGl0aWVzUmVxdWlyZWQ7XG5cdFx0XHRcdHZhciBldmVudHMgPSBbXTtcblx0XHRcdFx0aWYoc3VjY2Vzc0V2ZW50ICYmIHF1YWxpdGllc1JlcXVpcmVkICYmIHF1YWxpdGllc1JlcXVpcmVkLnNpemUoKSkge1xuXHRcdFx0XHRcdGV2ZW50cy5wdXNoKHN1Y2Nlc3NFdmVudCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYoZGVmYXVsdEV2ZW50KSB7XG5cdFx0XHRcdFx0ZXZlbnRzLnB1c2goZGVmYXVsdEV2ZW50KTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZihldmVudHMubGVuZ3RoKSB7XG5cdFx0XHRcdFx0dmFyIHdyYXBwZXJDbHVtcCA9IG5ldyBDbHVtcChldmVudHMsIGFwaS50eXBlcy5FdmVudCk7XG5cdFx0XHRcdFx0dmFyIGNoaWxkX2V2ZW50cyA9IHdyYXBwZXJDbHVtcC50b0RvbShzaXplLCB0cnVlKTtcblxuXHRcdFx0XHRcdGNoaWxkX2V2ZW50cy5jbGFzc0xpc3QuYWRkKFwiY2hpbGQtbGlzdFwiKTtcblx0XHRcdFx0XHRlbGVtZW50LmFwcGVuZENoaWxkKGNoaWxkX2V2ZW50cyk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdHJldHVybiBlbGVtZW50O1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBTcGF3bmVkRW50aXR5OyIsInZhciBMdW1wID0gcmVxdWlyZSgnLi9sdW1wJyk7XG52YXIgQ2x1bXAgPSByZXF1aXJlKCcuL2NsdW1wJyk7XG52YXIgUG9ydCA9IHJlcXVpcmUoJy4vcG9ydCcpO1xudmFyIEFyZWEgPSByZXF1aXJlKCcuL2FyZWEnKTtcblxudmFyIGFwaTtcblxuZnVuY3Rpb24gVGlsZVZhcmlhbnQocmF3LCBwYXJlbnQpIHtcblx0dGhpcy5zdHJhaWdodENvcHkgPSBbXG5cdFx0J05hbWUnLFxuXHRcdCdIdW1hbk5hbWUnLFxuXHRcdCdEZXNjcmlwdGlvbicsXG5cblx0XHQnTWF4VGlsZVBvcHVsYXRpb24nLFxuXHRcdCdNaW5UaWxlUG9wdWxhdGlvbicsXG5cdFx0XG5cdFx0J1NlYUNvbG91cicsXG5cdFx0J011c2ljVHJhY2tOYW1lJyxcblx0XHQnQ2hhbmNlT2ZXZWF0aGVyJyxcblx0XHQnRm9nUmV2ZWFsVGhyZXNob2xkJ1xuXHRdO1xuXG4vKlxuTGFiZWxEYXRhOiBBcnJheVs2XVxuUGhlbm9tZW5hRGF0YTogQXJyYXlbMV1cblNwYXduUG9pbnRzOiBBcnJheVsyXVxuVGVycmFpbkRhdGE6IEFycmF5WzE0XVxuV2VhdGhlcjogQXJyYXlbMV1cbiovXG5cblx0cmF3LklkID0gcmF3Lk5hbWU7XG5cdEx1bXAuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcblxuXHR0aGlzLlNldHRpbmdJZCA9IHJhdy5TZXR0aW5nLklkO1xuXG5cdHRoaXMucG9ydHMgPSBuZXcgQ2x1bXAodGhpcy5hdHRyaWJzLlBvcnREYXRhIHx8IFtdLCBQb3J0LCB0aGlzKTtcblxuXHR0aGlzLmFyZWFzID0gbnVsbDtcbn1cbk9iamVjdC5rZXlzKEx1bXAucHJvdG90eXBlKS5mb3JFYWNoKGZ1bmN0aW9uKG1lbWJlcikgeyBUaWxlVmFyaWFudC5wcm90b3R5cGVbbWVtYmVyXSA9IEx1bXAucHJvdG90eXBlW21lbWJlcl07IH0pO1xuXG5UaWxlVmFyaWFudC5wcm90b3R5cGUud2lyZVVwID0gZnVuY3Rpb24odGhlQXBpKSB7XG5cblx0YXBpID0gdGhlQXBpO1xuXG5cdHRoaXMucG9ydHMuZm9yRWFjaChmdW5jdGlvbihwKSB7IHAud2lyZVVwKGFwaSk7IH0pO1xuXG5cdC8vIEFsc28gY3JlYXRlIGEgbGlzdCBvZiBhbGwgdGhlIGFyZWFzIG9mIGVhY2ggb2YgdGhlIHBvcnRzIGluIHRoaXMgb2JqZWN0IGZvciBjb252ZW5pZW5jZVxuXHR0aGlzLmFyZWFzID0gbmV3IENsdW1wKHRoaXMucG9ydHMubWFwKGZ1bmN0aW9uKHApIHsgcmV0dXJuIHAuYXJlYTsgfSksIGFwaS50eXBlcy5BcmVhLCB0aGlzKTtcblxuXHRMdW1wLnByb3RvdHlwZS53aXJlVXAuY2FsbCh0aGlzKTtcbn07XG5cblRpbGVWYXJpYW50LnByb3RvdHlwZS50b1N0cmluZyA9IGZ1bmN0aW9uKGxvbmcpIHtcblx0cmV0dXJuIHRoaXMuY29uc3RydWN0b3IubmFtZSArIFwiIFwiICsgdGhpcy5IdW1hbk5hbWUgKyBcIiAoI1wiICsgdGhpcy5OYW1lICsgXCIpXCI7XG59O1xuXG5UaWxlVmFyaWFudC5wcm90b3R5cGUudG9Eb20gPSBmdW5jdGlvbihzaXplLCB0YWcpIHtcblxuXHRzaXplID0gc2l6ZSB8fCBcIm5vcm1hbFwiO1xuXHR0YWcgPSB0YWcgfHwgXCJsaVwiO1xuXG5cdHZhciBodG1sID0gXCJcIjtcblxuXHR2YXIgZWxlbWVudCA9ICBkb2N1bWVudC5jcmVhdGVFbGVtZW50KHRhZyk7XG5cdGVsZW1lbnQuY2xhc3NOYW1lID0gXCJpdGVtIFwiK3RoaXMuY29uc3RydWN0b3IubmFtZS50b0xvd2VyQ2FzZSgpK1wiLWl0ZW0gXCIrc2l6ZTtcblxuXHRodG1sID0gXCJcXG48aDMgY2xhc3M9J3RpdGxlJz5cIit0aGlzLkh1bWFuTmFtZStcIjwvaDM+XCI7XG5cblx0ZWxlbWVudC5pbm5lckhUTUwgPSBodG1sO1xuXG5cdGVsZW1lbnQudGl0bGUgPSB0aGlzLnRvU3RyaW5nKCk7XG5cblx0cmV0dXJuIGVsZW1lbnQ7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFRpbGVWYXJpYW50OyIsInZhciBMdW1wID0gcmVxdWlyZSgnLi9sdW1wJyk7XG52YXIgQ2x1bXAgPSByZXF1aXJlKCcuL2NsdW1wJyk7XG52YXIgVGlsZVZhcmlhbnQgPSByZXF1aXJlKCcuL3RpbGUtdmFyaWFudCcpO1xudmFyIFBvcnQgPSByZXF1aXJlKCcuL3BvcnQnKTtcbnZhciBBcmVhID0gcmVxdWlyZSgnLi9hcmVhJyk7XG5cbnZhciBhcGk7XG5cbmZ1bmN0aW9uIFRpbGUocmF3LCBwYXJlbnQpIHtcblx0dGhpcy5zdHJhaWdodENvcHkgPSBbXG5cdFx0J05hbWUnXG5cdF07XG5cdHJhdy5JZCA9IHJhdy5OYW1lO1xuXHRMdW1wLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG5cblx0dGhpcy50aWxlVmFyaWFudHMgPSBuZXcgQ2x1bXAodGhpcy5hdHRyaWJzLlRpbGVzIHx8IFtdLCBUaWxlVmFyaWFudCwgdGhpcyk7XG59XG5PYmplY3Qua2V5cyhMdW1wLnByb3RvdHlwZSkuZm9yRWFjaChmdW5jdGlvbihtZW1iZXIpIHsgVGlsZS5wcm90b3R5cGVbbWVtYmVyXSA9IEx1bXAucHJvdG90eXBlW21lbWJlcl07IH0pO1xuXG5UaWxlLnByb3RvdHlwZS53aXJlVXAgPSBmdW5jdGlvbih0aGVBcGkpIHtcblxuXHRhcGkgPSB0aGVBcGk7XG5cblx0dGhpcy50aWxlVmFyaWFudHMuZm9yRWFjaChmdW5jdGlvbih0dikgeyB0di53aXJlVXAoYXBpKTsgfSk7XG5cblx0Ly8gQWxzbyBjcmVhdGUgYSBsaXN0IG9mIGFsbCB0aGUgcG9ydHMgYW5kIGFyZWFzIG9mIGVhY2ggb2YgdGhlIHRpbGV2YXJpYW50cyBpbiB0aGlzIG9iamVjdCBmb3IgY29udmVuaWVuY2Vcblx0dmFyIGFsbF9wb3J0cyA9IHt9O1xuXHR2YXIgYWxsX2FyZWFzID0ge307XG5cdHRoaXMudGlsZVZhcmlhbnRzLmZvckVhY2goZnVuY3Rpb24odHYpIHtcblx0XHR0di5wb3J0cy5mb3JFYWNoKGZ1bmN0aW9uKHApIHtcblx0XHRcdGFsbF9wb3J0c1twLklkXSA9IHA7XG5cdFx0XHRhbGxfYXJlYXNbcC5hcmVhLklkXSA9IHAuYXJlYTtcblx0XHR9KTtcblx0fSk7XG5cdHRoaXMucG9ydHMgPSBuZXcgQ2x1bXAoT2JqZWN0LmtleXMoYWxsX3BvcnRzKS5tYXAoZnVuY3Rpb24ocCkgeyByZXR1cm4gYWxsX3BvcnRzW3BdOyB9KSwgYXBpLnR5cGVzLlBvcnQsIHRoaXMpO1xuXHR0aGlzLmFyZWFzID0gbmV3IENsdW1wKE9iamVjdC5rZXlzKGFsbF9hcmVhcykubWFwKGZ1bmN0aW9uKGEpIHsgcmV0dXJuIGFsbF9hcmVhc1thXTsgfSksIGFwaS50eXBlcy5BcmVhLCB0aGlzKTtcblxuXHRMdW1wLnByb3RvdHlwZS53aXJlVXAuY2FsbCh0aGlzKTtcbn07XG5cblRpbGUucHJvdG90eXBlLnRvU3RyaW5nID0gZnVuY3Rpb24obG9uZykge1xuXHRyZXR1cm4gdGhpcy5jb25zdHJ1Y3Rvci5uYW1lICsgXCIgXCIgKyB0aGlzLk5hbWUgKyBcIiAoI1wiICsgdGhpcy5OYW1lICsgXCIpXCI7XG59O1xuXG5UaWxlLnByb3RvdHlwZS50b0RvbSA9IGZ1bmN0aW9uKHNpemUsIHRhZykge1xuXG5cdHNpemUgPSBzaXplIHx8IFwibm9ybWFsXCI7XG5cdHRhZyA9IHRhZyB8fCBcImxpXCI7XG5cblx0dmFyIGh0bWwgPSBcIlwiO1xuXG5cdHZhciBlbGVtZW50ID0gIGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQodGFnKTtcblx0ZWxlbWVudC5jbGFzc05hbWUgPSBcIml0ZW0gXCIrdGhpcy5jb25zdHJ1Y3Rvci5uYW1lLnRvTG93ZXJDYXNlKCkrXCItaXRlbSBcIitzaXplO1xuXG5cdGh0bWwgPSBcIlxcbjxoMyBjbGFzcz0ndGl0bGUnPlwiK3RoaXMuTmFtZStcIjwvaDM+XCI7XG5cblx0ZWxlbWVudC5pbm5lckhUTUwgPSBodG1sO1xuXG5cdGVsZW1lbnQudGl0bGUgPSB0aGlzLnRvU3RyaW5nKCk7XG5cblx0cmV0dXJuIGVsZW1lbnQ7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFRpbGU7IiwidmFyIGFwaSA9IHJlcXVpcmUoJy4vYXBpJyk7XG52YXIgZHJhZ25kcm9wID0gcmVxdWlyZSgnLi91aS9kcmFnbmRyb3AnKTtcbnZhciBxdWVyeSA9IHJlcXVpcmUoJy4vdWkvcXVlcnknKTtcblxuXG4kKFwiI3RhYnMgLmJ1dHRvbnMgbGlcIikub24oXCJjbGlja1wiLCBmdW5jdGlvbihlKSB7XG5cbiAgdmFyIHR5cGUgPSAkKHRoaXMpLmF0dHIoXCJkYXRhLXR5cGVcIik7XG5cbiAgJChcIiN0YWJzIC5wYW5lcyAucGFuZVwiKS5oaWRlKCk7IC8vIEhpZGUgYWxsIHBhbmVzXG4gICQoXCIjdGFicyAuYnV0dG9ucyBsaVwiKS5yZW1vdmVDbGFzcyhcImFjdGl2ZVwiKTsgLy8gRGVhY3RpdmF0ZSBhbGwgYnV0dG9uc1xuXG4gICQoXCIjdGFicyAucGFuZXMgLlwiK3R5cGUudG9Mb3dlckNhc2UoKSkuc2hvdygpO1xuICAkKFwiI3RhYnMgLmJ1dHRvbnMgW2RhdGEtdHlwZT1cIit0eXBlK1wiXVwiKS5hZGRDbGFzcyhcImFjdGl2ZVwiKTtcbn0pO1xuXG4vLyBTZXR1cCB0aGUgZG5kIGxpc3RlbmVycy5cbnZhciBkcm9wWm9uZSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdkcm9wLXpvbmUnKTtcblxuZHJvcFpvbmUuYWRkRXZlbnRMaXN0ZW5lcignZHJhZ2VudGVyJywgZHJhZ25kcm9wLmhhbmRsZXJzLmRyYWdPdmVyLCBmYWxzZSk7XG5kcm9wWm9uZS5hZGRFdmVudExpc3RlbmVyKCdkcmFnbGVhdmUnLCBkcmFnbmRyb3AuaGFuZGxlcnMuZHJhZ0VuZCwgZmFsc2UpO1xuZHJvcFpvbmUuYWRkRXZlbnRMaXN0ZW5lcignZHJhZ292ZXInLCBkcmFnbmRyb3AuaGFuZGxlcnMuZHJhZ092ZXIsIGZhbHNlKTtcblxuZHJvcFpvbmUuYWRkRXZlbnRMaXN0ZW5lcignZHJvcCcsIGRyYWduZHJvcC5oYW5kbGVycy5kcmFnRHJvcCwgZmFsc2UpO1xuXG5kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncGF0aHMtdG8tbm9kZScpLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgcXVlcnkucGF0aHNUb05vZGVVSSwgZmFsc2UpO1xuXG4vLyBGb3IgY29udmVuaWVuY2VcbndpbmRvdy5hcGkgPSBhcGk7XG53aW5kb3cuYXBpLnF1ZXJ5ID0gcXVlcnk7IiwidmFyIGFwaSA9IHJlcXVpcmUoJy4uL2FwaScpO1xudmFyIENsdW1wID0gcmVxdWlyZSgnLi4vb2JqZWN0cy9jbHVtcCcpO1xudmFyIGlvID0gcmVxdWlyZSgnLi4vaW8nKTtcblxudmFyIHJlbmRlciA9IHJlcXVpcmUoJy4vcmVuZGVyJyk7XG5cbmZ1bmN0aW9uIGhhbmRsZURyYWdPdmVyKGV2dCkge1xuICBldnQuc3RvcFByb3BhZ2F0aW9uKCk7XG4gIGV2dC5wcmV2ZW50RGVmYXVsdCgpO1xuXG4gICQoXCIjZHJvcC16b25lXCIpLmFkZENsYXNzKFwiZHJvcC10YXJnZXRcIik7XG59XG5cbmZ1bmN0aW9uIGhhbmRsZURyYWdFbmQoZXZ0KSB7XG4gIGV2dC5zdG9wUHJvcGFnYXRpb24oKTtcbiAgZXZ0LnByZXZlbnREZWZhdWx0KCk7XG5cbiAgJChcIiNkcm9wLXpvbmVcIikucmVtb3ZlQ2xhc3MoXCJkcm9wLXRhcmdldFwiKTtcbn1cblxuZnVuY3Rpb24gaGFuZGxlRHJhZ0Ryb3AoZXZ0KSB7XG5cbiAgJChcIiNkcm9wLXpvbmVcIikucmVtb3ZlQ2xhc3MoXCJkcm9wLXRhcmdldFwiKTtcblxuICBldnQuc3RvcFByb3BhZ2F0aW9uKCk7XG4gIGV2dC5wcmV2ZW50RGVmYXVsdCgpO1xuXG4gIHZhciBmaWxlcyA9IGV2dC5kYXRhVHJhbnNmZXIuZmlsZXM7IC8vIEZpbGVMaXN0IG9iamVjdC5cblxuICAvLyBGaWxlcyBpcyBhIEZpbGVMaXN0IG9mIEZpbGUgb2JqZWN0cy4gTGlzdCBzb21lIHByb3BlcnRpZXMuXG4gIHZhciBvdXRwdXQgPSBbXTtcbiAgaW8ucmVzZXRGaWxlc1RvTG9hZCgpO1xuICBmb3IgKHZhciBpID0gMDsgaSA8IGZpbGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgdmFyIGYgPSBmaWxlc1tpXTtcbiAgICB2YXIgZmlsZW5hbWUgPSBlc2NhcGUoZi5uYW1lKTtcbiAgICB2YXIgdHlwZU5hbWUgPSBpby5maWxlT2JqZWN0TWFwW2ZpbGVuYW1lXTtcbiAgICB2YXIgVHlwZSA9IGFwaS50eXBlc1t0eXBlTmFtZV07XG4gICAgaWYoVHlwZSkge1xuICAgICAgaW8uaW5jcmVtZW50RmlsZXNUb0xvYWQoKTtcbiAgICAgIGFwaS5yZWFkRnJvbUZpbGUoVHlwZSwgZiwgZnVuY3Rpb24oKSB7XG4gICAgICAgIGlvLmRlY3JlbWVudEZpbGVzVG9Mb2FkKCk7XG5cbiAgICAgICAgaWYoaW8uY291bnRGaWxlc1RvTG9hZCgpID09PSAwKSB7XG4gICAgICAgICAgYXBpLndpcmVVcE9iamVjdHMoKTtcbiAgICAgICAgICByZW5kZXIubGlzdHMoKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgICBvdXRwdXQucHVzaCgnPGxpPjxzdHJvbmc+JywgZXNjYXBlKGYubmFtZSksICc8L3N0cm9uZz4gKCcsIGYudHlwZSB8fCAnbi9hJywgJykgLSAnLFxuICAgICAgICAgICAgICAgIGYuc2l6ZSwgJyBieXRlcywgbGFzdCBtb2RpZmllZDogJyxcbiAgICAgICAgICAgICAgICBmLmxhc3RNb2RpZmllZERhdGUgPyBmLmxhc3RNb2RpZmllZERhdGUudG9Mb2NhbGVEYXRlU3RyaW5nKCkgOiAnbi9hJyxcbiAgICAgICAgICAgICAgICAnPC9saT4nKTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICBvdXRwdXQucHVzaCgnPGxpPkVSUk9SOiBObyBoYW5kbGVyIGZvciBmaWxlIDxzdHJvbmc+JyAsIGVzY2FwZShmLm5hbWUpLCAnPC9zdHJvbmc+PC9saT4nKTtcbiAgICB9XG4gIH1cbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2xpc3QnKS5pbm5lckhUTUwgPSAnPHVsPicgKyBvdXRwdXQuam9pbignJykgKyAnPC91bD4nO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcblx0aGFuZGxlcnM6IHtcblx0XHRkcmFnT3ZlcjogaGFuZGxlRHJhZ092ZXIsXG5cdFx0ZHJhZ0VuZDogaGFuZGxlRHJhZ0VuZCxcblx0XHRkcmFnRHJvcDogaGFuZGxlRHJhZ0Ryb3Bcblx0fVxufTsiLCJ2YXIgYXBpID0gcmVxdWlyZSgnLi4vYXBpJyk7XG52YXIgQ2x1bXAgPSByZXF1aXJlKCcuLi9vYmplY3RzL2NsdW1wJyk7XG5cbmZ1bmN0aW9uIFJvdXRlTm9kZShub2RlKSB7XG4gIHRoaXMubm9kZSA9IG5vZGU7XG4gIHRoaXMuY2hpbGRyZW4gPSBbXTtcbn1cblxuZnVuY3Rpb24gcGF0aHNUb05vZGVVSSgpIHtcblxuICB2YXIgdHlwZSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCd0eXBlJyk7XG4gIHR5cGUgPSB0eXBlLm9wdGlvbnNbdHlwZS5zZWxlY3RlZEluZGV4XS52YWx1ZTtcblxuICB2YXIgb3BlcmF0aW9uID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ29wZXJhdGlvbicpO1xuICBvcGVyYXRpb24gPSBvcGVyYXRpb24ub3B0aW9uc1tvcGVyYXRpb24uc2VsZWN0ZWRJbmRleF0udmFsdWU7XG5cbiAgdmFyIGlkID0gcHJvbXB0KFwiSWQgb2YgXCIrdHlwZSk7XG5cbiAgaWYoIWlkKSB7ICAvLyBDYW5jZWxsZWQgZGlhbG9ndWVcbiAgICByZXR1cm47XG4gIH1cblxuICB2YXIgaXRlbSA9IGFwaS5saWJyYXJ5W3R5cGVdLmlkKGlkKTtcblxuICBpZighaXRlbSkge1xuICAgIGFsZXJ0KFwiQ291bGQgbm90IGZpbmQgXCIrdHlwZStcIiBcIitpZCk7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgdmFyIHJvb3QgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcInF1ZXJ5LXRyZWVcIik7XG4gIHJvb3QuaW5uZXJIVE1MID0gXCJcIjtcblxuICB2YXIgdGl0bGUgPSAkKCcucGFuZS5xdWVyeSAucGFuZS10aXRsZScpLnRleHQoXCJRdWVyeTogXCIraXRlbS50b1N0cmluZygpKTtcblxuICB2YXIgcm91dGVzID0gcGF0aHNUb05vZGUoaXRlbSwge30pO1xuXG4gIGlmKHJvdXRlcyAmJiByb3V0ZXMuY2hpbGRyZW4ubGVuZ3RoKSB7XG5cbiAgICByb3V0ZXMgPSBmaWx0ZXJQYXRoc1RvTm9kZShyb3V0ZXMsIG9wZXJhdGlvbik7XG5cbiAgICB2YXIgdG9wX2NoaWxkcmVuID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInVsXCIpO1xuICAgIHRvcF9jaGlsZHJlbi5jbGFzc05hbWUgKz0gXCJjbHVtcC1saXN0IHNtYWxsXCI7XG5cbiAgICByb3V0ZXMuY2hpbGRyZW4uZm9yRWFjaChmdW5jdGlvbihjaGlsZF9yb3V0ZSkge1xuICAgICAgdmFyIHRyZWUgPSByZW5kZXJQYXRoc1RvTm9kZShjaGlsZF9yb3V0ZSwgW10pO1xuICAgICAgdG9wX2NoaWxkcmVuLmFwcGVuZENoaWxkKHRyZWUpO1xuICAgIH0pO1xuXG4gICAgcm9vdC5hcHBlbmRDaGlsZCh0b3BfY2hpbGRyZW4pO1xuICB9XG4gIGVsc2Uge1xuICAgIGFsZXJ0KFwiVGhpcyBcIit0eXBlK1wiIGlzIGEgcm9vdCBub2RlIHdpdGggbm8gcGFyZW50cyB0aGF0IHNhdGlzZnkgdGhlIGNvbmRpdGlvbnNcIik7XG4gIH1cbiAgXG59XG5cbmZ1bmN0aW9uIHBhdGhzVG9Ob2RlKG5vZGUsIHNlZW4sIHBhcmVudCkge1xuXG4gIGlmKHNlZW5bbm9kZS5JZF0pIHsgICAvLyBEb24ndCByZWN1cnNlIGludG8gbm9kZXMgd2UndmUgYWxyZWFkeSBzZWVuXG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgdmFyIGFuY2VzdHJ5ID0gSlNPTi5wYXJzZShKU09OLnN0cmluZ2lmeShzZWVuKSk7XG4gIGFuY2VzdHJ5W25vZGUuSWRdID0gdHJ1ZTtcblxuICB2YXIgdGhpc19ub2RlID0gbmV3IFJvdXRlTm9kZSgvKm5vZGUubGlua1RvRXZlbnQgPyBub2RlLmxpbmtUb0V2ZW50IDoqLyBub2RlKTsgLy8gSWYgdGhpcyBub2RlIGlzIGp1c3QgYSBsaW5rIHRvIGFub3RoZXIgb25lLCBza2lwIG92ZXIgdGhlIHVzZWxlc3MgbGlua1xuXG4gIGlmKG5vZGUgaW5zdGFuY2VvZiBhcGkudHlwZXMuU3Bhd25lZEVudGl0eSkge1xuICAgIHJldHVybiB0aGlzX25vZGU7ICAgLy8gTGVhZiBub2RlIGluIHRyZWVcbiAgfVxuICBlbHNlIGlmKG5vZGUgaW5zdGFuY2VvZiBhcGkudHlwZXMuRXZlbnQgJiYgbm9kZS50YWcgPT09IFwidXNlXCIpIHtcbiAgICByZXR1cm4gdGhpc19ub2RlOyAgIC8vIExlYWYgbm9kZSBpbiB0cmVlXG4gIH1cbiAgZWxzZSBpZihub2RlIGluc3RhbmNlb2YgYXBpLnR5cGVzLkV2ZW50ICYmIHBhcmVudCBpbnN0YW5jZW9mIGFwaS50eXBlcy5FdmVudCAmJiAocGFyZW50LnRhZyA9PT0gXCJraWxsZWRcIiB8fCBwYXJlbnQudGFnID09PSBcInBhY2lmaWVkXCIpKSB7IC8vIElmIHRoaXMgaXMgYW4gZXZlbnQgdGhhdCdzIHJlYWNoYWJsZSBieSBraWxsaW5nIGEgbW9uc3RlciwgZG9uJ3QgcmVjdXJzZSBhbnkgb3RoZXIgY2F1c2VzIChhcyB0aGV5J3JlIHVzdWFsbHkgbWlzbGVhZGluZy9jaXJjdWxhcilcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgZWxzZSBpZiAobm9kZSBpbnN0YW5jZW9mIGFwaS50eXBlcy5Qb3J0KSB7XG4gICAgcmV0dXJuIG5ldyBSb3V0ZU5vZGUobm9kZS5hcmVhKTtcbiAgfVxuICBlbHNlIGlmKG5vZGUubGltaXRlZFRvQXJlYSAmJiBub2RlLmxpbWl0ZWRUb0FyZWEuSWQgIT09IDEwMTk1Nikge1xuICAgIHZhciBhcmVhX25hbWUgPSBub2RlLmxpbWl0ZWRUb0FyZWEuTmFtZS50b0xvd2VyQ2FzZSgpO1xuICAgIHZhciBldmVudF9uYW1lID0gbm9kZS5OYW1lLnRvTG93ZXJDYXNlKCk7XG4gICAgaWYoYXJlYV9uYW1lLmluZGV4T2YoZXZlbnRfbmFtZSkgIT09IC0xIHx8IGV2ZW50X25hbWUuaW5kZXhPZihhcmVhX25hbWUpICE9PSAtMSkgeyAgLy8gSWYgQXJlYSBoYXMgc2ltaWxhciBuYW1lIHRvIEV2ZW50LCBpZ25vcmUgdGhlIGV2ZW50IGFuZCBqdXN0IHN1YnN0aXR1dGUgdGhlIGFyZWFcbiAgICAgIHJldHVybiBuZXcgUm91dGVOb2RlKG5vZGUubGltaXRlZFRvQXJlYSk7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgdGhpc19ub2RlLmNoaWxkcmVuLnB1c2gobmV3IFJvdXRlTm9kZShub2RlLmxpbWl0ZWRUb0FyZWEpKTsgICAvLyBFbHNlIGluY2x1ZGUgYm90aCB0aGUgQXJlYSBhbmQgdGhlIEV2ZW50XG4gICAgICByZXR1cm4gdGhpc19ub2RlO1xuICAgIH1cbiAgICBcbiAgfVxuICBlbHNlIHtcbiAgICBmb3IodmFyIGk9MDsgaTxub2RlLnBhcmVudHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciB0aGVfcGFyZW50ID0gbm9kZS5wYXJlbnRzW2ldO1xuICAgICAgdmFyIHN1YnRyZWUgPSBwYXRoc1RvTm9kZSh0aGVfcGFyZW50LCBhbmNlc3RyeSwgbm9kZSk7XG4gICAgICBpZihzdWJ0cmVlKSB7XG4gICAgICAgIHRoaXNfbm9kZS5jaGlsZHJlbi5wdXNoKHN1YnRyZWUpO1xuICAgICAgfVxuICAgIH1cbiAgICBpZighdGhpc19ub2RlLmNoaWxkcmVuLmxlbmd0aCkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiB0aGlzX25vZGU7XG59XG5cbmZ1bmN0aW9uIGZpbHRlclBhdGhzVG9Ob2RlKHJvdXRlcywgb3BlcmF0aW9uKSB7XG4gIC8vIEZpbHRlciByb3V0ZXMgYnkgb3BlcmF0aW9uXG4gIGlmKHJvdXRlcyAmJiByb3V0ZXMuY2hpbGRyZW4gJiYgb3BlcmF0aW9uICE9PSBcImFueVwiKSB7XG4gICAgcm91dGVzLmNoaWxkcmVuID0gcm91dGVzLmNoaWxkcmVuLmZpbHRlcihmdW5jdGlvbihyb3V0ZV9ub2RlKSB7XG5cbiAgICAgIGx1bXAgPSByb3V0ZV9ub2RlLm5vZGU7XG5cbiAgICAgIGlmKG9wZXJhdGlvbiA9PT0gXCJhZGRpdGl2ZVwiKSB7XG4gICAgICAgIHJldHVybiBsdW1wLmlzT25lT2YoW2FwaS50eXBlcy5RdWFsaXR5RWZmZWN0LCBhcGkudHlwZXMuQXZhaWxhYmlsaXR5XSkgJiYgbHVtcC5pc0FkZGl0aXZlKCk7XG4gICAgICB9XG4gICAgICBlbHNlIGlmKG9wZXJhdGlvbiA9PT0gXCJzdWJ0cmFjdGl2ZVwiKSB7XG4gICAgICAgIHJldHVybiBsdW1wLmlzT25lT2YoW2FwaS50eXBlcy5RdWFsaXR5RWZmZWN0LCBhcGkudHlwZXMuQXZhaWxhYmlsaXR5XSkgJiYgbHVtcC5pc1N1YnRyYWN0aXZlKCk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICByZXR1cm4gcm91dGVzO1xufVxuXG5mdW5jdGlvbiByZW5kZXJQYXRoc1RvTm9kZShyb3V0ZU5vZGUsIGFuY2VzdHJ5KSB7XG4gIFxuICBpZighKHJvdXRlTm9kZSBpbnN0YW5jZW9mIFJvdXRlTm9kZSkpIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIHZhciBlbGVtZW50ID0gcm91dGVOb2RlLm5vZGUudG9Eb20oXCJzbWFsbFwiLCBmYWxzZSk7XG4gIFxuICB2YXIgY2hpbGRfbGlzdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJ1bFwiKTtcbiAgY2hpbGRfbGlzdC5jbGFzc05hbWUgKz0gXCJjbHVtcC1saXN0IHNtYWxsIGNoaWxkLWxpc3RcIjtcblxuICB2YXIgbmV3X2FuY2VzdHJ5ID0gYW5jZXN0cnkuc2xpY2UoKTtcbiAgbmV3X2FuY2VzdHJ5LnB1c2gocm91dGVOb2RlLm5vZGUpO1xuICByb3V0ZU5vZGUuY2hpbGRyZW4uZm9yRWFjaChmdW5jdGlvbihjaGlsZF9yb3V0ZSwgaW5kZXgsIGNoaWxkcmVuKSB7XG4gICAgdmFyIGNoaWxkX2NvbnRlbnQgPSByZW5kZXJQYXRoc1RvTm9kZShjaGlsZF9yb3V0ZSwgbmV3X2FuY2VzdHJ5KTtcbiAgICBjaGlsZF9saXN0LmFwcGVuZENoaWxkKGNoaWxkX2NvbnRlbnQpO1xuICB9KTtcblxuICBpZihyb3V0ZU5vZGUuY2hpbGRyZW4ubGVuZ3RoKSB7XG4gICAgZWxlbWVudC5hcHBlbmRDaGlsZChjaGlsZF9saXN0KTtcbiAgfVxuICBlbHNlIHtcbiAgICB2YXIgZGVzY3JpcHRpb24gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwibGlcIik7XG4gICAgZGVzY3JpcHRpb24uaW5uZXJIVE1MID0gJzxzcGFuIGNsYXNzPVwicm91dGUtZGVzY3JpcHRpb25cIj5ISU5UOiAnICsgZGVzY3JpYmVSb3V0ZShuZXdfYW5jZXN0cnkpICsgJzwvc3Bhbj4nO1xuXG4gICAgdmFyIHJlcXNUaXRsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2g1Jyk7XG4gICAgcmVxc1RpdGxlLmlubmVySFRNTCA9IFwiUmVxdWlyZW1lbnRzXCI7XG4gICAgZGVzY3JpcHRpb24uYXBwZW5kQ2hpbGQocmVxc1RpdGxlKTtcblxuICAgIHZhciB0b3RhbF9yZXF1aXJlbWVudHMgPSBnZXRSb3V0ZVJlcXVpcmVtZW50cyhuZXdfYW5jZXN0cnkpO1xuICAgIFxuICAgIGRlc2NyaXB0aW9uLmFwcGVuZENoaWxkKHRvdGFsX3JlcXVpcmVtZW50cy50b0RvbShcInNtYWxsXCIsIGZhbHNlKSk7XG4gICAgZWxlbWVudC5hcHBlbmRDaGlsZChkZXNjcmlwdGlvbik7XG4gIH1cblxuICByZXR1cm4gZWxlbWVudDtcbn1cblxuZnVuY3Rpb24gbG93ZXIodGV4dCkge1xuICByZXR1cm4gdGV4dC5zbGljZSgwLDEpLnRvTG93ZXJDYXNlKCkrdGV4dC5zbGljZSgxKTtcbn1cblxuZnVuY3Rpb24gZGVzY3JpYmVSb3V0ZShhbmNlc3RyeSkge1xuICB2YXIgYSA9IGFuY2VzdHJ5LnNsaWNlKCkucmV2ZXJzZSgpO1xuXG4gIHZhciBndWlkZSA9IFwiXCI7XG4gIGlmKGFbMF0gaW5zdGFuY2VvZiBhcGkudHlwZXMuQXJlYSkge1xuICAgIGlmKGFbMV0gaW5zdGFuY2VvZiBhcGkudHlwZXMuRXZlbnQpIHtcbiAgICAgIGd1aWRlID0gXCJTZWVrIFwiK2FbMV0uTmFtZStcIiBpbiBcIithWzBdLk5hbWU7XG4gICAgICBpZihhWzJdIGluc3RhbmNlb2YgYXBpLnR5cGVzLkludGVyYWN0aW9uKSB7XG4gICAgICAgIGd1aWRlICs9IFwiIGFuZCBcIjtcbiAgICAgICAgaWYoXCJcXFwiJ1wiLmluZGV4T2YoYVsyXS5OYW1lWzBdKSAhPT0gLTEpIHtcbiAgICAgICAgICBndWlkZSArPSBcImV4Y2xhaW0gXCI7XG4gICAgICAgIH1cbiAgICAgICAgZ3VpZGUgKz0gbG93ZXIoYVsyXS5OYW1lKTtcbiAgICAgIH1cbiAgICAgIGd1aWRlICs9IFwiLlwiO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIGd1aWRlID0gXCJUcmF2ZWwgdG8gXCIrYVswXS5OYW1lO1xuXG4gICAgICBpZihhWzFdIGluc3RhbmNlb2YgYXBpLnR5cGVzLkludGVyYWN0aW9uKSB7XG4gICAgICAgIGd1aWRlICs9IFwiIGFuZCBcIitsb3dlcihhWzFdLk5hbWUpO1xuICAgICAgfVxuICAgICAgZWxzZSBpZihhWzFdIGluc3RhbmNlb2YgYXBpLnR5cGVzLkV4Y2hhbmdlICYmIGFbMl0gaW5zdGFuY2VvZiBhcGkudHlwZXMuU2hvcCkge1xuICAgICAgICBndWlkZSArPSBcIiBhbmQgbG9vayBmb3IgdGhlIFwiK2FbMl0uTmFtZStcIiBFbXBvcml1bSBpbiBcIithWzFdLk5hbWU7XG4gICAgICB9XG5cbiAgICAgIGd1aWRlICs9IFwiLlwiO1xuICAgIH1cbiAgfVxuICBlbHNlIGlmKGFbMF0gaW5zdGFuY2VvZiBhcGkudHlwZXMuU3Bhd25lZEVudGl0eSkge1xuICAgIGd1aWRlID0gXCJGaW5kIGFuZCBiZXN0IGEgXCIrYVswXS5IdW1hbk5hbWU7XG4gICAgaWYoYVsyXSBpbnN0YW5jZW9mIGFwaS50eXBlcy5JbnRlcmFjdGlvbikge1xuICAgICAgZ3VpZGUgKz0gXCIsIHRoZW4gXCIgKyBsb3dlcihhWzJdLk5hbWUpO1xuICAgIH1cbiAgICBndWlkZSArPSBcIi5cIjtcbiAgfVxuICBlbHNlIGlmKGFbMF0gaW5zdGFuY2VvZiBhcGkudHlwZXMuRXZlbnQgJiYgYVswXS50YWcgPT09IFwidXNlXCIgJiYgIShhWzFdIGluc3RhbmNlb2YgYXBpLnR5cGVzLlF1YWxpdHlSZXF1aXJlbWVudCkpIHtcbiAgICBpZihhWzBdLk5hbWUubWF0Y2goL15cXHMqU3BlYWsvaSkpIHtcbiAgICAgIGd1aWRlID0gYVswXS5OYW1lO1xuICAgIH1cbiAgICBlbHNlIGlmKGFbMF0uTmFtZS5tYXRjaCgvXlxccypBL2kpKSB7XG4gICAgICBndWlkZSA9IFwiQWNxdWlyZSBcIitsb3dlcihhWzBdLk5hbWUpO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIGd1aWRlID0gXCJGaW5kIGEgXCIrbG93ZXIoYVswXS5OYW1lKTtcbiAgICB9XG4gICAgZ3VpZGUgKz0gXCIgYW5kIFwiICsgbG93ZXIoYVsxXS5OYW1lKSArIFwiLlwiO1xuICB9XG5cbiAgcmV0dXJuIGd1aWRlO1xufVxuXG5mdW5jdGlvbiBkZXRhaWxSb3V0ZShhbmNlc3RyeSkge1xuICB2YXIgYSA9IGFuY2VzdHJ5LnNsaWNlKCkucmV2ZXJzZSgpO1xuXG4gIHZhciBndWlkZSA9IFwiXCI7XG4gIGlmKGFbMF0gaW5zdGFuY2VvZiBhcGkudHlwZXMuQXJlYSkge1xuICAgIGlmKGFbMV0gaW5zdGFuY2VvZiBhcGkudHlwZXMuRXZlbnQpIHtcbiAgICAgIGd1aWRlID0gXCJZb3UgbXVzdCB0cmF2ZWwgdG8gXCIrYVswXS5OYW1lK1wiIGFuZCBsb29rIGZvciBcIithWzFdLk5hbWUrXCIuXCI7XG4gICAgICBpZihhWzJdIGluc3RhbmNlb2YgYXBpLnR5cGVzLkludGVyYWN0aW9uKSB7XG4gICAgICAgIGd1aWRlICs9IFwiICBXaGVuIHlvdSBmaW5kIGl0IHlvdSBzaG91bGQgXCI7XG4gICAgICAgIGlmKFwiXFxcIidcIi5pbmRleE9mKGFbMl0uTmFtZVswXSkgIT09IC0xKSB7XG4gICAgICAgICAgZ3VpZGUgKz0gXCJzYXkgXCI7XG4gICAgICAgIH1cbiAgICAgICAgZ3VpZGUgKz0gbG93ZXIoYVsyXS5OYW1lKTtcbiAgICAgIH1cbiAgICAgIGd1aWRlICs9IFwiLlwiO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIGd1aWRlID0gXCJNYWtlIGZvciBcIithWzBdLk5hbWU7XG5cbiAgICAgIGlmKGFbMV0gaW5zdGFuY2VvZiBhcGkudHlwZXMuSW50ZXJhY3Rpb24pIHtcbiAgICAgICAgZ3VpZGUgKz0gXCIgYW5kIFwiK2xvd2VyKGFbMV0uTmFtZSk7XG4gICAgICB9XG4gICAgICBlbHNlIGlmKGFbMV0gaW5zdGFuY2VvZiBhcGkudHlwZXMuRXhjaGFuZ2UgJiYgYVsyXSBpbnN0YW5jZW9mIGFwaS50eXBlcy5TaG9wKSB7XG4gICAgICAgIGd1aWRlICs9IFwiLiAgVXBvbiBhcnJpdmFsIGdvIHRvIFwiK2FbMV0uTmFtZStcIiwgYW5kIGxvb2sgZm9yIHRoZSBzaG9wIFwiK2FbMl0uTmFtZXM7XG4gICAgICB9XG5cbiAgICAgIGd1aWRlICs9IFwiLlwiO1xuICAgIH1cbiAgfVxuICBlbHNlIGlmKGFbMF0gaW5zdGFuY2VvZiBhcGkudHlwZXMuU3Bhd25lZEVudGl0eSkge1xuICAgIGd1aWRlID0gXCJZb3UgbXVzdCBodW50IHRoZSBteXRoaWNhbCB6ZWUtcGVyaWwga25vd24gYXMgdGhlIFwiK2FbMF0uSHVtYW5OYW1lK1wiLCBlbmdhZ2UgaXQgaW4gYmF0dGxlIGFuZCBkZWZlYXQgaXQuXCI7XG4gICAgaWYoYVsyXSBpbnN0YW5jZW9mIGFwaS50eXBlcy5JbnRlcmFjdGlvbikge1xuICAgICAgZ3VpZGUgKz0gXCIgIE9uY2UgeW91IGhhdmUgY29ucXVlcmVkIGl0IHlvdSBtdXN0IFwiICsgbG93ZXIoYVsyXS5OYW1lKSArIFwiIHRvIGhlbHAgc2VjdXJlIHlvdXIgcHJpemUuXCI7XG4gICAgfVxuICB9XG4gIGVsc2UgaWYoYVswXSBpbnN0YW5jZW9mIGFwaS50eXBlcy5FdmVudCAmJiBhWzBdLnRhZyA9PT0gXCJ1c2VcIiAmJiAhKGFbMV0gaW5zdGFuY2VvZiBhcGkudHlwZXMuUXVhbGl0eVJlcXVpcmVtZW50KSkge1xuICAgIGlmKGFbMF0uTmFtZS5tYXRjaCgvXlxccypTcGVhay9pKSkge1xuICAgICAgZ3VpZGUgPSBcIkZpcnN0IHlvdSBtdXN0IFwiK2xvd2VyKGFbMF0uTmFtZSk7XG4gICAgfVxuICAgIGVsc2UgaWYoYVswXS5OYW1lLm1hdGNoKC9eXFxzKkEvaSkpIHtcbiAgICAgIGd1aWRlID0gXCJTb3VyY2UgXCIrbG93ZXIoYVswXS5OYW1lKTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICBndWlkZSA9IFwiVHJ5IHRvIGxvY2F0ZSBhIFwiK2xvd2VyKGFbMF0uTmFtZSk7XG4gICAgfVxuICAgIGd1aWRlICs9IFwiLCBhbmQgdGhlbiBcIiArIGxvd2VyKGFbMV0uTmFtZSkgKyBcIi5cIjtcbiAgfVxuXG4gIHJldHVybiBndWlkZTtcbn1cblxuZnVuY3Rpb24gZ2V0Um91dGVSZXF1aXJlbWVudHMoYW5jZXN0cnkpIHtcblxuICB2YXIgcmVxcyA9IHt9O1xuXG4gIC8vIEFuY2VzdHJ5IGlzIG9yZGVyZWQgZnJvbSBsYXN0LT5maXJzdCwgc28gaXRlcmF0ZSBiYWNrd2FyZHMgZnJvbSBmaW5hbCBlZmZlY3QgLT4gaW5pdGlhbCBjYXVzZVxuICBhbmNlc3RyeS5mb3JFYWNoKGZ1bmN0aW9uKHN0ZXApIHtcbiAgICAvKiBTaW1wbGlmaWNhdGlvbjogaWYgYW4gZXZlbnQgbW9kaWZpZXMgYSBxdWFsaXR5IHRoZW4gYXNzdW1lIHRoYXQgbGF0ZXIgcmVxdWlyZW1lbnRzXG4gICAgb24gdGhlIHNhbWUgcXVhbGl0eSBhcmUgcHJvYmFibHkgc2F0aXNmaWVkIGJ5IHRoYXQgbW9kaWZpY2F0aW9uIChlZywgd2hlbiBxdWFsaXRpZXNcbiAgICBhcmUgaW5jcmVtZW50ZWQvZGVjcmVtZW50ZWQgdG8gY29udHJvbCBzdG9yeS1xdWVzdCBwcm9ncmVzcykuICovXG4gICAgaWYoc3RlcC5xdWFsaXRpZXNBZmZlY3RlZCkge1xuICAgICAgc3RlcC5xdWFsaXRpZXNBZmZlY3RlZC5mb3JFYWNoKGZ1bmN0aW9uKGVmZmVjdCkge1xuICAgICAgICBkZWxldGUocmVxc1tlZmZlY3QuYXNzb2NpYXRlZFF1YWxpdHkuSWRdKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgICAvLyBOb3cgYWRkIGFueSByZXF1aXJlbWVudHMgZm9yIHRoZSBjdXJyZW50IHN0YWdlIChlYXJsaWVyIHJlcXVpcmVtZW50cyBvdmVyd3JpdGUgbGF0ZXIgb25lcyBvbiB0aGUgc2FtZSBxdWFsaXR5KVxuICAgIGlmKHN0ZXAucXVhbGl0aWVzUmVxdWlyZWQpIHtcbiAgICAgIHN0ZXAucXVhbGl0aWVzUmVxdWlyZWQuZm9yRWFjaChmdW5jdGlvbihyZXEpIHtcbiAgICAgICAgaWYocmVxLmFzc29jaWF0ZWRRdWFsaXR5KSB7IC8vIENoZWNrIHRoaXMgaXMgYSB2YWxpZCBRdWFsaXR5UmVxdWlyZW1lbnQsIGFuZCBub3Qgb25lIG9mIHRoZSBoYWxmLWZpbmlzaGVkIGRlYnVnIGVsZW1lbnRzIHJlZmVycmluZyB0byBhbm9uLWV4aXN0YW50IFF1YWxpdHlcbiAgICAgICAgICByZXFzW3JlcS5hc3NvY2lhdGVkUXVhbGl0eS5JZF0gPSByZXE7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cbiAgfSk7XG5cbiAgdmFyIHJlc3VsdCA9IE9iamVjdC5rZXlzKHJlcXMpLm1hcChmdW5jdGlvbihrZXkpIHsgcmV0dXJuIHJlcXNba2V5XTsgfSk7XG5cbiAgcmV0dXJuIG5ldyBDbHVtcChyZXN1bHQsIGFwaS50eXBlcy5RdWFsaXR5UmVxdWlyZW1lbnQpO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgUm91dGVOb2RlOiBSb3V0ZU5vZGUsXG4gIHBhdGhzVG9Ob2RlVUk6IHBhdGhzVG9Ob2RlVUksXG4gIHBhdGhzVG9Ob2RlOiBwYXRoc1RvTm9kZSxcbiAgZmlsdGVyUGF0aHNUb05vZGU6IGZpbHRlclBhdGhzVG9Ob2RlLFxuICByZW5kZXJQYXRoc1RvTm9kZTogcmVuZGVyUGF0aHNUb05vZGUsXG4gIGRlc2NyaWJlUm91dGU6IGRlc2NyaWJlUm91dGUsXG4gIGRldGFpbFJvdXRlOiBkZXRhaWxSb3V0ZSxcbiAgZ2V0Um91dGVSZXF1aXJlbWVudHM6IGdldFJvdXRlUmVxdWlyZW1lbnRzXG59OyIsInZhciBhcGkgPSByZXF1aXJlKCcuLi9hcGknKTtcblxuZnVuY3Rpb24gcmVuZGVyTGlzdHMoKSB7XG4gIE9iamVjdC5rZXlzKGFwaS5sb2FkZWQpLmZvckVhY2goZnVuY3Rpb24odHlwZSkge1xuICAgIHJlbmRlckxpc3QoYXBpLmxvYWRlZFt0eXBlXSk7IC8vIE9ubHkgZGlzcGxheSBkaXJlY3RseSBsb2FkZWQgKHJvb3QtbGV2ZWwpIEx1bXBzLCB0byBwcmV2ZW50IHRoZSBsaXN0IGJlY29taW5nIHVud2llbGR5XG4gIH0pO1xufVxuXG5mdW5jdGlvbiByZW5kZXJMaXN0KGNsdW1wKSB7XG5cdHZhciByb290ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoY2x1bXAudHlwZS5uYW1lLnRvTG93ZXJDYXNlKCkrXCItbGlzdFwiKTtcbiAgaWYocm9vdCkge1xuXHQgcm9vdC5hcHBlbmRDaGlsZChjbHVtcC50b0RvbSgpKTtcbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcblx0bGlzdDogcmVuZGVyTGlzdCxcblx0bGlzdHM6IHJlbmRlckxpc3RzXG59OyJdfQ==
