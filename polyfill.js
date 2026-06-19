if (typeof global.File === 'undefined') {
  global.File = class File extends global.Blob {
    constructor(parts, filename, options = {}) {
      super(parts, options);
      this.name = filename;
      this.lastModified = options.lastModified || Date.now();
    }
  };
}

// Polyfill ES2023 Array methods missing in Node.js < 20
if (typeof Array.prototype.toReversed === 'undefined') {
  Array.prototype.toReversed = function() {
    return [...this].reverse();
  };
}

if (typeof Array.prototype.toSorted === 'undefined') {
  Array.prototype.toSorted = function(compareFn) {
    return [...this].sort(compareFn);
  };
}

if (typeof Array.prototype.toSpliced === 'undefined') {
  Array.prototype.toSpliced = function(start, deleteCount, ...items) {
    const arr = [...this];
    const actualStart = start < 0 ? Math.max(this.length + start, 0) : Math.min(start, this.length);
    const actualDeleteCount = deleteCount === undefined ? this.length - actualStart : Math.max(Math.min(deleteCount, this.length - actualStart), 0);
    arr.splice(actualStart, actualDeleteCount, ...items);
    return arr;
  };
}

if (typeof Array.prototype.with === 'undefined') {
  Array.prototype.with = function(index, value) {
    const arr = [...this];
    const n = arr.length;
    let i = index >> 0;
    if (i < 0) i += n;
    if (i < 0 || i >= n) throw new RangeError('Invalid index');
    arr[i] = value;
    return arr;
  };
}
