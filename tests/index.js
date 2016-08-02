import test from 'tape-catch';
import { scenario, scenarioOutline } from 'tape-scenario';

import SagaRunner from '../src';

function *emptySaga() {}
function *countToThreeSaga() {
  yield 1;
  yield 2;
  yield 3;
}
const grabBag = [
  null, undefined, 42, 'hello', {}, [], Symbol(),
  { a: 1 }, Object.create(null),
  function foo() {}, function *bar() {}
];

test('SagaRunner: constructor sets valid saga correctly', t => {
  const sagaInstance = emptySaga();
  const runner = new SagaRunner(sagaInstance);

  t.equal(runner.saga, sagaInstance);
  t.end();
});

scenario(test, 'SagaRunner: invalid constructor arguments: ', {
  'no arguments': {
    error: /must pass exactly one argument/
  },
  'raw (uncalled) generator function': {
    sagas: [emptySaga, countToThreeSaga],
    error: /make sure to call the saga/
  },
  'other random input': {
    sagas: [null, undefined, 42, 'hello', {}, Object.create(null), Symbol()],
    error: /invalid constructor argument/
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
  t.throws(() => runner.yieldedAllExpected(), /must call `run` before checking/);
  runner.run();
  t.throws(() => runner.expects(42), /cannot call `expects` after `run`/);
  t.throws(() => runner.returns(42), /cannot call `returns` after `run`/);
  t.throws(() => runner.throws(42), /cannot call `throws` after `run`/);
  t.end();
});

scenarioOutline(test, 'SagaRunner: can provide an answer for yielded values', {
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

scenarioOutline(test, 'SagaRunner: can throw in response to values', {
  question: grabBag
}, (t, { question }) => {
  const neverReached = Symbol();

  function *echoSaga() {
    try {
      yield question;
      yield neverReached;
    } catch (thing) {
      yield thing;
    }
  }

  const expected = Symbol();
  const runner = new SagaRunner(echoSaga());
  runner.expects(question).throws(expected);
  runner.run();

  t.assert(runner.yielded(question));
  t.assert(runner.yielded(expected));
  t.assert(!runner.yielded(neverReached));
  t.end();
});

test('SagaRunner: only allows one of {returns,throws} to be chained', t => {
  const runner = new SagaRunner(emptySaga());
  t.throws(
    () => runner.expects(1).returns(2).throws(3),
    /no chained method calls allowed after `returns`/
  );
  t.throws(
    () => runner.expects(1).throws(2).returns(3),
    /no chained method calls allowed after `throws`/
  );
  t.end();
});

test('SagaRunner: detects if not all expected values were yielded', t => {
  const incompleteRunner = new SagaRunner(emptySaga());
  incompleteRunner.expects(1).returns(2);
  incompleteRunner.run();

  t.deepEqual(incompleteRunner.expectations, [1]);
  t.assert(!incompleteRunner.yieldedAllExpected());

  const completeRunner = new SagaRunner(countToThreeSaga());
  completeRunner.expects(1).returns('one');
  completeRunner.expects(2).returns('two');
  completeRunner.expects(3).returns('three');
  completeRunner.run();

  t.deepEqual(completeRunner.expectations, [1, 2, 3]);
  t.assert(completeRunner.yieldedAllExpected());
  t.end();
});
