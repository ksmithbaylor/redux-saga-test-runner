import 'babel-polyfill';
import deepEqual from 'deep-equal';

const noMoreMethodsAfter = last => new Proxy({}, {
  // Sort of like method_missing in ruby
  get() {
    return () => {
      throw new Error(`SagaRunner: no chained method calls allowed after \`${last}\``);
    };
  }
});

const UNINITIALIZED = Symbol();

class SagaRunner {
  replies = new Map();  // things to reply with
  tantrums = new Map(); // things to throw :)
  expectations = [];
  yieldedValues = UNINITIALIZED;
  alwaysThrow = UNINITIALIZED;
  alwaysReturn = UNINITIALIZED;

  constructor(saga) {
    this.assertValidSaga(arguments);
    this.saga = saga;
  }

  expects(value) {
    this.assertHasNotRun('cannot call `expects` after `run`');
    this.expectations.push(value);
    return {
      returns: this.returnsForExpectation.bind(this, value),
      throws: this.throwsForExpectation.bind(this, value)
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
    return noMoreMethodsAfter('throws');
  }

  returnsForExpectation(value, reply) {
    this.assertHasNotRun('cannot call `returns` after `run`');
    this.replies.set(value, reply);
    return noMoreMethodsAfter('returns');
  }

  throwsForExpectation(value, reply) {
    this.assertHasNotRun('cannot call `throws` after `run`');
    this.tantrums.set(value, reply);
    return noMoreMethodsAfter('throws');
  }

  run() {
    this.assertHasNotRun('only allowed to run once');
    this.yieldedValues = [];

    let iterator = this.saga.next();
    while (!iterator.done) {
      const yieldedValue = iterator.value;
      this.yieldedValues.push(yieldedValue);

      // Convenience functions for this yieldedValue
      const valueIn = map => mapDeepEqualHas(map, yieldedValue); // eslint-disable-line no-loop-func
      const getFrom = map => mapDeepEqualGet(map, yieldedValue); // eslint-disable-line no-loop-func

      if (this.alwaysThrow !== UNINITIALIZED) {
        iterator = this.saga.throw(this.alwaysThrow);
      } else if (this.alwaysReturn !== UNINITIALIZED) {
        iterator = this.saga.next(this.alwaysReturn);
      } else if (valueIn(this.tantrums)) {
        iterator = this.saga.throw(getFrom(this.tantrums));
      } else if (valueIn(this.replies)) {
        iterator = this.saga.next(getFrom(this.replies));
      } else {
        iterator = this.saga.next();
      }
    }
  }

  yielded(value) {
    this.assertAlreadyRan('must call `run` before checking yielded values');
    return arrayDeepEqualIncludes(this.yieldedValues, value);
  }

  yieldedAllExpected() {
    this.assertAlreadyRan('must call `run` before checking yielded values');
    return this.expectations.every(this.yielded.bind(this));
  }

  //----------------------------------------------------------------------------
  // Assertions for internal use

  assertValidSaga(args) {
    if (args.length !== 1) { // didn't pass any arguments, or passed too many
      throw new Error('SagaRunner: must pass exactly one argument (the saga ' +
                      'instance) to the constructor');
    }

    const saga = args[0];

    if (saga
        && saga.constructor
        && saga.constructor.name === 'GeneratorFunction') {
      throw new Error('SagaRunner: make sure to call the saga to get an ' +
                      'instance, not pass in the generator function itself');
    }

    if (!saga
        || typeof saga !== 'object'
        || !saga.constructor
        || saga.constructor[Symbol.toStringTag] !== 'GeneratorFunction') {
      throw new Error('SagaRunner: invalid constructor argument');
    }
  }

  assertAlreadyRan(message) {
    if (this.yieldedValues === UNINITIALIZED) {
      throw new Error(`SagaRunner: ${message}`);
    }
  }

  assertHasNotRun(message) {
    if (this.yieldedValues !== UNINITIALIZED) {
      throw new Error(`SagaRunner: ${message}`);
    }
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
      if (deepEqual(key, relevantKey)) {
        return ifPresent(map, relevantKey);
      }
    }
    return ifNotPresent(map, relevantKey);
  };
}

function arrayDeepEqualIncludes(array, value) {
  return array.some(member => deepEqual(member, value));
}

export default SagaRunner;
