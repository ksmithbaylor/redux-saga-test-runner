import test from 'tape';
import SagaRunner from '../src';

import complexSaga, { complexHelper } from './fixtures/complexSaga';
import { select, put, take, fork, spawn, call } from 'redux-saga/effects';

test('Complex Saga: successful', t => {
  const runner = new SagaRunner(complexSaga());
  runner.expects(select(state => state.number)).returns(42);
  runner.expects(put({ type: 'NUMBER_CHANGED', number: 43 }));
  runner.expects(take('FRUIT_CHOSEN')).returns({ fruit: 'apple' });
  runner.expects(fork(complexHelper, 'apple'));
  runner.expects(spawn(complexHelper, 'apple'));
  runner.expects(call(complexHelper, 'apple'));
  runner.run(t);
  t.end();
});

test('Complex Saga: exception', t => {
  const runner = new SagaRunner(complexSaga());
  runner.expects(take('FRUIT_CHOSEN')).throws(new Error());
  runner.expects(put({ type: 'UH_OH' }));
  runner.run(t);
  t.end();
});
