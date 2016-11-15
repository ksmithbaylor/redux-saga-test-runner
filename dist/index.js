'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _deepEqual = require('deep-equal');

var _deepEqual2 = _interopRequireDefault(_deepEqual);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var UNINITIALIZED = Symbol();
var WRAPPED = Symbol();

var SagaRunner = function () {
  // things to reply with
  function SagaRunner(saga) {
    _classCallCheck(this, SagaRunner);

    this.replies = new Map();
    this.tantrums = new Map();
    this.expectations = [];
    this.yieldedValues = UNINITIALIZED;
    this.alwaysThrow = UNINITIALIZED;
    this.alwaysReturn = UNINITIALIZED;
    this.currentState = UNINITIALIZED;

    this.assertValidSaga(arguments);
    this.saga = saga;
  } // things to throw :)


  _createClass(SagaRunner, [{
    key: 'expects',
    value: function expects(value) {
      this.assertHasNotRun('cannot call `expects` after `run`');
      var expectation = wrapValue(value, this.currentState);
      this.expectations.push(expectation);
      return {
        returns: this.returnsForExpectation.bind(this, expectation),
        throws: this.throwsForExpectation.bind(this, expectation)
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
      return noMoreMethodsAfter('returns');
    }
  }, {
    key: 'returnsForExpectation',
    value: function returnsForExpectation(expectation, reply) {
      this.assertHasNotRun('cannot call `returns` after `run`');
      this.replies.set(expectation, reply);
      return noMoreMethodsAfter('returns');
    }
  }, {
    key: 'throwsForExpectation',
    value: function throwsForExpectation(expectation, reply) {
      this.assertHasNotRun('cannot call `throws` after `run`');
      this.tantrums.set(expectation, reply);
      return noMoreMethodsAfter('throws');
    }
  }, {
    key: 'setState',
    value: function setState(state) {
      this.currentState = state;
    }
  }, {
    key: 'run',
    value: function run(t) {
      var _this = this;

      this.assertHasNotRun('only allowed to run once');
      this.yieldedValues = [];

      var iterator = this.alwaysThrow === UNINITIALIZED ? this.saga.next() : this.saga.throw(this.alwaysThrow);

      var _loop = function _loop() {
        var yieldedValue = wrapValue(iterator.value, UNINITIALIZED);
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

      if (t) {
        this.runAssertions(t);
      }
    }
  }, {
    key: 'yielded',
    value: function yielded(value) {
      this.assertAlreadyRan('must call `run` before checking yielded values');
      return arrayDeepEqualIncludes(this.yieldedValues, value);
    }
  }, {
    key: 'runAssertions',
    value: function runAssertions(t) {
      var _this2 = this;

      this.assertValidTestObject(t);
      this.assertAlreadyRan('must call `run` before checking yielded values');
      var success = true;
      this.expectations.forEach(function (expectation) {
        var yieldedThisOne = _this2.yielded(expectation);
        t.assert(yieldedThisOne, 'yielded ' + JSON.stringify(expectation));
        if (!yieldedThisOne) {
          success = false;
        }
      });
      return success;
    }

    //----------------------------------------------------------------------------
    // Assertions for internal use

  }, {
    key: 'assertValidSaga',
    value: function assertValidSaga(args) {
      if (args.length !== 1) {
        error('Must pass exactly one argument (the saga instance) to the constructor');
      }

      var saga = args[0];

      if (saga && saga.constructor && saga.constructor.name === 'GeneratorFunction') {
        error('Make sure to call the saga to get an instance, ' + 'not pass in the generator function itself');
      }

      if (!saga || (typeof saga === 'undefined' ? 'undefined' : _typeof(saga)) !== 'object' || !saga.constructor || saga.constructor[Symbol.toStringTag] !== 'GeneratorFunction') {
        error('Invalid constructor argument');
      }
    }
  }, {
    key: 'assertAlreadyRan',
    value: function assertAlreadyRan(message) {
      if (this.yieldedValues === UNINITIALIZED) {
        error(message);
      }
    }
  }, {
    key: 'assertHasNotRun',
    value: function assertHasNotRun(message) {
      if (this.yieldedValues !== UNINITIALIZED) {
        error(message);
      }
    }
  }, {
    key: 'assertValidTestObject',
    value: function assertValidTestObject(t) {
      ['assert', 'deepEqual'].forEach(function (method) {
        if (!(method in t) || typeof t[method] !== 'function') {
          error('Test object must have a method called `' + method + '`');
        }
      });
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

        if (areEqual(key, relevantKey)) {
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
    return areEqual(member, value);
  });
}

function areEqual(candidate, lookingFor) {
  if (!hasProp(candidate, WRAPPED)) candidate = wrapValue(candidate, {});
  if (!hasProp(lookingFor, WRAPPED)) lookingFor = wrapValue(lookingFor, {});

  if (hasProp(candidate.value, 'SELECT') && hasProp(lookingFor.value, 'SELECT')) {
    return selectorIsEqual(candidate, lookingFor);
  }

  return (0, _deepEqual2.default)(candidate.value, lookingFor.value);
}

function selectorIsEqual(candidate, lookingFor) {
  return (0, _deepEqual2.default)(candidate.value.SELECT.selector(lookingFor.state), lookingFor.value.SELECT.selector(lookingFor.state));
}

function error(message) {
  throw new Error('SagaRunner: ' + message);
}

function hasProp(obj, prop) {
  return obj !== null && (typeof obj === 'undefined' ? 'undefined' : _typeof(obj)) === 'object' && prop in obj;
}

function wrapValue(value, state) {
  var _ref;

  return _ref = {}, _defineProperty(_ref, WRAPPED, true), _defineProperty(_ref, 'value', value), _defineProperty(_ref, 'state', state), _ref;
}

function noMoreMethodsAfter(last) {
  var ret = {};
  Object.getOwnPropertyNames(SagaRunner.prototype).forEach(function (method) {
    Object.defineProperty(ret, method, {
      get: function get() {
        error('No chained method calls allowed after `' + last + '`');
      }
    });
  });
  return ret;
}

exports.default = SagaRunner;