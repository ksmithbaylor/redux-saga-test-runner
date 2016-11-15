import test from 'tape-catch';
import { scenario, scenarioOutline } from 'tape-scenario';
import complexSaga, { complexHelper } from './fixtures/complexSaga';
import { select, put, fork, spawn, take, call } from 'redux-saga/effects';

import SagaRunner from '../src';

function *emptySaga() {}
function *countToThreeSaga() {
  yield 1;
  yield 2;
  yield 3;
}
function *catchSaga() {
  try {
    yield 'hello';
    yield 'question';
    yield 'never reached';
  } catch (err) {
    yield 'caught';
  }
}
const grabBag = [
  null, undefined, 42, 'hello', {}, [], Symbol(),
  { a: 1 }, Object.create(null),
  function foo() {}, function *bar() {}
];
const fakeT = { assert() {}, deepEqual() {} };

test('SagaRunner: constructor sets valid saga correctly', t => {
  const sagaInstance = emptySaga();
  const runner = new SagaRunner(sagaInstance);

  t.equal(runner.saga, sagaInstance);
  t.end();
});

scenario(test, 'SagaRunner: invalid constructor arguments: ', {
  'no arguments': {
    error: /Must pass exactly one argument/
  },
  'raw (uncalled) generator function': {
    sagas: [emptySaga, countToThreeSaga],
    error: /Make sure to call the saga/
  },
  'other random input': {
    sagas: [null, undefined, 42, 'hello', {}, Object.create(null), Symbol()],
    error: /Invalid constructor argument/
  }

}, (t, { sagas, error }) => {
  if (sagas) {
    sagas.forEach(saga => {
      t.throws(() => new SagaRunner(saga), error);
    });
  } else {
    t.throws(() => new SagaRunner(), error);
  }
  t.end();
});

test('SagaRunner: empty run does not cause exceptions', t => {
  const runner = new SagaRunner(emptySaga());
  t.doesNotThrow(() => {
    runner.run();
  });
  t.end();
});

test('SagaRunner: throws if calling methods in incorrect orders', t => {
  const runner = new SagaRunner(emptySaga());
  t.throws(() => runner.yielded(42), /must call `run` before checking/);
  t.throws(() => runner.runAssertions(fakeT), /must call `run` before checking/);
  runner.run();
  t.throws(() => runner.expects(42), /cannot call `expects` after `run`/);
  t.throws(() => runner.returns(42), /cannot call `returns` after `run`/);
  t.throws(() => runner.throws(42), /cannot call `throws` after `run`/);
  t.end();
});

scenarioOutline(test, 'SagaRunner: can provide an answer for yielded values: ', {
  question: grabBag
}, (t, { question }) => {
  function *echoSaga() {
    const answer = yield question;
    yield answer;
  }

  const expected = Symbol();
  const runner = new SagaRunner(echoSaga());
  runner.expects(question).returns(expected);
  runner.run();

  t.assert(runner.yielded(expected));
  t.end();
});

test('SagaRunner: can throw in response to a specific value', t => {
  const runner = new SagaRunner(catchSaga());
  runner.expects('hello');
  runner.expects('question').throws();
  runner.expects('caught');
  runner.run();

  t.assert(runner.runAssertions(fakeT));
  t.assert(!runner.yielded('never reached'));
  t.end();
});

test('SagaRunner: can throw an exception unconditionally', t => {
  const error = Symbol();
  const runner = new SagaRunner(catchSaga());
  runner.expects('caught')
  runner.throws();
  runner.run();

  t.assert(runner.runAssertions(fakeT));
  t.assert(!runner.yielded('hello'));
  t.assert(!runner.yielded('question'));
  t.assert(!runner.yielded('never reached'));
  t.end();
});

test('SagaRunner: only allows one of {returns,throws} to be chained', t => {
  const runner = new SagaRunner(emptySaga());
  t.throws(
    () => runner.expects(1).returns(2).throws(3),
    /No chained method calls allowed after `returns`/
  );
  t.throws(
    () => runner.expects(1).throws(2).returns(3),
    /No chained method calls allowed after `throws`/
  );
  t.throws(
    () => runner.expects(1).returns(2).throws(3),
    /No chained method calls allowed after `returns`/
  );
  t.throws(
    () => runner.expects(1).throws(2).returns(3),
    /No chained method calls allowed after `throws`/
  );
  t.end();
});

test('SagaRunner: detects if not all expected values were yielded', t => {
  const incompleteRunner = new SagaRunner(emptySaga());
  incompleteRunner.expects(1).returns(2);
  incompleteRunner.run();

  t.assert(!incompleteRunner.runAssertions(fakeT));

  const completeRunner = new SagaRunner(countToThreeSaga());
  completeRunner.expects(1).returns('one');
  completeRunner.expects(2).returns('two');
  completeRunner.expects(3).returns('three');
  completeRunner.run();

  t.assert(completeRunner.runAssertions(fakeT));
  t.end();
});

scenario(test, 'SagaRunner: assertValidTestObject ', {
  'with a valid object': {
    testObject: { assert() {}, deepEqual() {} },
    shouldThrow: false
  },
  'with an empty object': {
    testObject: {},
    shouldThrow: true
  },
  'with non-method members': {
    testObject: { assert: true, deepEqual: 'lol' },
    shouldThrow: true
  }
}, (t, { testObject, shouldThrow }) => {
  const runner = new SagaRunner(emptySaga());
  if (shouldThrow) {
    t.throws(
      () => runner.assertValidTestObject(testObject),
      /Test object must have a method called/
    );
  } else {
    t.doesNotThrow(() => runner.assertValidTestObject(testObject));
  }
  t.end()
});

test(test, 'SagaRunner: testing a select', t => {
  let selectorCalledWith = null;
  const selector = state => {
    selectorCalledWith = state;
    return state.number;
  }

  const runner = new SagaRunner(complexSaga());
  runner.setState({ number: 42 });
  runner.expects(select(selector));
  runner.run();
  t.assert(runner.runAssertions(fakeT));
  t.deepEqual(selectorCalledWith, { number: 42 });

  t.end();
});
