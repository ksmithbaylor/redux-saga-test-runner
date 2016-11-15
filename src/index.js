import deepEqual from 'deep-equal';

const UNINITIALIZED = Symbol();
const WRAPPED = Symbol();

class SagaRunner {
  replies = new Map();  // things to reply with
  tantrums = new Map(); // things to throw :)
  expectations = [];
  yieldedValues = UNINITIALIZED;
  alwaysThrow = UNINITIALIZED;
  alwaysReturn = UNINITIALIZED;
  currentState = UNINITIALIZED;

  constructor(saga) {
    this.assertValidSaga(arguments);
    this.saga = saga;
  }

  expects(value) {
    this.assertHasNotRun('cannot call `expects` after `run`');
    const expectation = wrapValue(value, this.currentState);
    this.expectations.push(expectation);
    return {
      returns: this.returnsForExpectation.bind(this, expectation),
      throws: this.throwsForExpectation.bind(this, expectation)
    };
  }

  throws(reply) {
    this.assertHasNotRun('cannot call `throws` after `run`');
    this.alwaysThrow = reply;
    return noMoreMethodsAfter('throws');
  }

  returns(reply) {
    this.assertHasNotRun('cannot call `returns` after `run`');
    this.alwaysReturn = reply;
    return noMoreMethodsAfter('returns');
  }

  returnsForExpectation(expectation, reply) {
    this.assertHasNotRun('cannot call `returns` after `run`');
    this.replies.set(expectation, reply);
    return noMoreMethodsAfter('returns');
  }

  throwsForExpectation(expectation, reply) {
    this.assertHasNotRun('cannot call `throws` after `run`');
    this.tantrums.set(expectation, reply);
    return noMoreMethodsAfter('throws');
  }

  setState(state) {
    this.currentState = state;
  }

  run(t) {
    this.assertHasNotRun('only allowed to run once');
    this.yieldedValues = [];

    let iterator = (this.alwaysThrow === UNINITIALIZED)
      ? this.saga.next()
      : this.saga.throw(this.alwaysThrow);

    while (!iterator.done) {
      const yieldedValue = wrapValue(iterator.value, UNINITIALIZED);
      this.yieldedValues.push(yieldedValue);

      // Convenience functions for this yieldedValue
      const valueIn = map => mapDeepEqualHas(map, yieldedValue); // eslint-disable-line no-loop-func
      const getFrom = map => mapDeepEqualGet(map, yieldedValue); // eslint-disable-line no-loop-func

      if (this.alwaysReturn !== UNINITIALIZED) {
        iterator = this.saga.next(this.alwaysReturn);
      } else if (valueIn(this.tantrums)) {
        iterator = this.saga.throw(getFrom(this.tantrums));
      } else if (valueIn(this.replies)) {
        iterator = this.saga.next(getFrom(this.replies));
      } else {
        iterator = this.saga.next();
      }
    }

    if (t) {
      this.runAssertions(t);
    }
  }

  yielded(value) {
    this.assertAlreadyRan('must call `run` before checking yielded values');
    return arrayDeepEqualIncludes(this.yieldedValues, value);
  }

  runAssertions(t) {
    this.assertValidTestObject(t);
    this.assertAlreadyRan('must call `run` before checking yielded values');
    let success = true;
    this.expectations.forEach(expectation => {
      const yieldedThisOne = this.yielded(expectation);
      t.assert(yieldedThisOne, `yielded ${JSON.stringify(expectation)}`);
      if (!yieldedThisOne) {
        success = false;
      }
    });
    return success;
  }

  //----------------------------------------------------------------------------
  // Assertions for internal use

  assertValidSaga(args) {
    if (args.length !== 1) {
      error('Must pass exactly one argument (the saga instance) to the constructor');
    }

    const saga = args[0];

    if (saga
        && saga.constructor
        && saga.constructor.name === 'GeneratorFunction') {
      error('Make sure to call the saga to get an instance, ' +
            'not pass in the generator function itself');
    }

    if (!saga
        || typeof saga !== 'object'
        || !saga.constructor
        || saga.constructor[Symbol.toStringTag] !== 'GeneratorFunction') {
      error('Invalid constructor argument');
    }
  }

  assertAlreadyRan(message) {
    if (this.yieldedValues === UNINITIALIZED) {
      error(message);
    }
  }

  assertHasNotRun(message) {
    if (this.yieldedValues !== UNINITIALIZED) {
      error(message);
    }
  }

  assertValidTestObject(t) {
    ['assert', 'deepEqual'].forEach(method => {
      if (!(method in t) || typeof t[method] !== 'function') {
        error(`Test object must have a method called \`${method}\``);
      }
    });
  }
}

const mapDeepEqualHas = mapDeepEqualIterate(
  () => true,
  () => false
);

const mapDeepEqualGet = mapDeepEqualIterate(
  (map, relevantKey) => map.get(relevantKey),
  () => undefined
);

function mapDeepEqualIterate(ifPresent, ifNotPresent) {
  return function mapIterator(map, relevantKey) {
    for (const key of map.keys()) {
      if (areEqual(key, relevantKey)) {
        return ifPresent(map, key);
      }
    }
    return ifNotPresent(map, relevantKey);
  };
}

function arrayDeepEqualIncludes(array, value) {
  return array.some(member => areEqual(member, value));
}

function areEqual(candidate, lookingFor) {
  if (!hasProp(candidate, WRAPPED)) candidate = wrapValue(candidate, {});
  if (!hasProp(lookingFor, WRAPPED)) lookingFor = wrapValue(lookingFor, {});

  if (hasProp(candidate.value, 'SELECT') && hasProp(lookingFor.value, 'SELECT')) {
    return selectorIsEqual(candidate, lookingFor);
  }

  return deepEqual(candidate.value, lookingFor.value);
}

function selectorIsEqual(candidate, lookingFor) {
  return deepEqual(
    candidate.value.SELECT.selector(lookingFor.state),
    lookingFor.value.SELECT.selector(lookingFor.state)
  );
}

function error(message) {
  throw new Error(`SagaRunner: ${message}`);
}

function hasProp(obj, prop) {
  return obj !== null && typeof obj === 'object' && prop in obj;
}

function wrapValue(value, state) {
  return { [WRAPPED]: true, value, state };
}

function noMoreMethodsAfter(last) {
  const ret = {};
  Object.getOwnPropertyNames(SagaRunner.prototype).forEach(method => {
    Object.defineProperty(ret, method, {
      get() {
        error(`No chained method calls allowed after \`${last}\``);
      }
    });
  });
  return ret;
}

export default SagaRunner;
