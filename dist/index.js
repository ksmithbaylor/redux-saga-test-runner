'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

require('babel-polyfill');

var _deepEqual = require('deep-equal');

var _deepEqual2 = _interopRequireDefault(_deepEqual);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var noMoreMethodsAfter = function noMoreMethodsAfter(last) {
  return new Proxy({}, {
    // Sort of like method_missing in ruby
    get: function get() {
      return function () {
        throw new Error('SagaRunner: no chained method calls allowed after `' + last + '`');
      };
    }
  });
};

var UNINITIALIZED = Symbol();

var SagaRunner = function () {
  // things to throw :)
  function SagaRunner(saga) {
    _classCallCheck(this, SagaRunner);

    this.replies = new Map();
    this.tantrums = new Map();
    this.expectations = [];
    this.yieldedValues = UNINITIALIZED;
    this.alwaysThrow = UNINITIALIZED;
    this.alwaysReturn = UNINITIALIZED;

    this.assertValidSaga(arguments);
    this.saga = saga;
  } // things to reply with


  _createClass(SagaRunner, [{
    key: 'expects',
    value: function expects(value) {
      this.assertHasNotRun('cannot call `expects` after `run`');
      this.expectations.push(value);
      return {
        returns: this.returnsForExpectation.bind(this, value),
        throws: this.throwsForExpectation.bind(this, value)
      };
    }
  }, {
    key: 'throws',
    value: function throws(reply) {
      this.assertHasNotRun('cannot call `throws` after `run`');
      this.alwaysThrow = reply;
      return noMoreMethodsAfter('throws');
    }
  }, {
    key: 'returns',
    value: function returns(reply) {
      this.assertHasNotRun('cannot call `returns` after `run`');
      this.alwaysReturn = reply;
      return noMoreMethodsAfter('throws');
    }
  }, {
    key: 'returnsForExpectation',
    value: function returnsForExpectation(value, reply) {
      this.assertHasNotRun('cannot call `returns` after `run`');
      this.replies.set(value, reply);
      return noMoreMethodsAfter('returns');
    }
  }, {
    key: 'throwsForExpectation',
    value: function throwsForExpectation(value, reply) {
      this.assertHasNotRun('cannot call `throws` after `run`');
      this.tantrums.set(value, reply);
      return noMoreMethodsAfter('throws');
    }
  }, {
    key: 'run',
    value: function run() {
      var _this = this;

      this.assertHasNotRun('only allowed to run once');
      this.yieldedValues = [];

      var iterator = this.alwaysThrow === UNINITIALIZED ? this.saga.next() : this.saga.throw(this.alwaysThrow);

      var _loop = function _loop() {
        var yieldedValue = iterator.value;
        _this.yieldedValues.push(yieldedValue);

        // Convenience functions for this yieldedValue
        var valueIn = function valueIn(map) {
          return mapDeepEqualHas(map, yieldedValue);
        }; // eslint-disable-line no-loop-func
        var getFrom = function getFrom(map) {
          return mapDeepEqualGet(map, yieldedValue);
        }; // eslint-disable-line no-loop-func

        if (_this.alwaysReturn !== UNINITIALIZED) {
          iterator = _this.saga.next(_this.alwaysReturn);
        } else if (valueIn(_this.tantrums)) {
          iterator = _this.saga.throw(getFrom(_this.tantrums));
        } else if (valueIn(_this.replies)) {
          iterator = _this.saga.next(getFrom(_this.replies));
        } else {
          iterator = _this.saga.next();
        }
      };

      while (!iterator.done) {
        _loop();
      }
    }
  }, {
    key: 'yielded',
    value: function yielded(value) {
      this.assertAlreadyRan('must call `run` before checking yielded values');
      return arrayDeepEqualIncludes(this.yieldedValues, value);
    }
  }, {
    key: 'yieldedAllExpected',
    value: function yieldedAllExpected() {
      this.assertAlreadyRan('must call `run` before checking yielded values');
      return this.expectations.every(this.yielded.bind(this));
    }

    //----------------------------------------------------------------------------
    // Assertions for internal use

  }, {
    key: 'assertValidSaga',
    value: function assertValidSaga(args) {
      if (args.length !== 1) {
        // didn't pass any arguments, or passed too many
        throw new Error('SagaRunner: must pass exactly one argument (the saga ' + 'instance) to the constructor');
      }

      var saga = args[0];

      if (saga && saga.constructor && saga.constructor.name === 'GeneratorFunction') {
        throw new Error('SagaRunner: make sure to call the saga to get an ' + 'instance, not pass in the generator function itself');
      }

      if (!saga || (typeof saga === 'undefined' ? 'undefined' : _typeof(saga)) !== 'object' || !saga.constructor || saga.constructor[Symbol.toStringTag] !== 'GeneratorFunction') {
        throw new Error('SagaRunner: invalid constructor argument');
      }
    }
  }, {
    key: 'assertAlreadyRan',
    value: function assertAlreadyRan(message) {
      if (this.yieldedValues === UNINITIALIZED) {
        throw new Error('SagaRunner: ' + message);
      }
    }
  }, {
    key: 'assertHasNotRun',
    value: function assertHasNotRun(message) {
      if (this.yieldedValues !== UNINITIALIZED) {
        throw new Error('SagaRunner: ' + message);
      }
    }
  }]);

  return SagaRunner;
}();

var mapDeepEqualHas = mapDeepEqualIterate(function () {
  return true;
}, function () {
  return false;
});

var mapDeepEqualGet = mapDeepEqualIterate(function (map, relevantKey) {
  return map.get(relevantKey);
}, function () {
  return undefined;
});

function mapDeepEqualIterate(ifPresent, ifNotPresent) {
  return function mapIterator(map, relevantKey) {
    var _iteratorNormalCompletion = true;
    var _didIteratorError = false;
    var _iteratorError = undefined;

    try {
      for (var _iterator = map.keys()[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
        var key = _step.value;

        if ((0, _deepEqual2.default)(key, relevantKey)) {
          return ifPresent(map, key);
        }
      }
    } catch (err) {
      _didIteratorError = true;
      _iteratorError = err;
    } finally {
      try {
        if (!_iteratorNormalCompletion && _iterator.return) {
          _iterator.return();
        }
      } finally {
        if (_didIteratorError) {
          throw _iteratorError;
        }
      }
    }

    return ifNotPresent(map, relevantKey);
  };
}

function arrayDeepEqualIncludes(array, value) {
  return array.some(function (member) {
    return (0, _deepEqual2.default)(member, value);
  });
}

exports.default = SagaRunner;