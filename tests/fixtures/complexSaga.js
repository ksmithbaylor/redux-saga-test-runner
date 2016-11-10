import { select, put, fork, spawn, take, call } from 'redux-saga/effects';

function *complexHelper(arg) {
  yield 123;
}

function *complexSaga() {
  try {
    const number = yield select(state => state.number);
    yield put({ type: 'NUMBER_CHANGED', number: number + 1 });

    const { fruit } = take('FRUIT_CHOSEN');
    yield call(complexHelper, fruit);
    yield fork(complexHelper, fruit),
    yield spawn(complexHelper, fruit)

    yield "I don't care about this";
  } catch (err) {
    yield put({ type: 'UH_OH' });
  }
}

export default complexSaga;
export { complexHelper };
