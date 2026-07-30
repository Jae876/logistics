import login from '../api/login.js';
import geofences from '../api/admin/geofences.js';

const makeRes = () => {
  let status = 200;
  let body = null;
  return {
    status(code) {
      status = code;
      return this;
    },
    json(obj) {
      body = obj;
      return this;
    },
    end() {
      return this;
    },
    _result() {
      return { status, body };
    }
  };
};

const run = async () => {
  const loginRes = makeRes();
  await login({ method: 'POST', body: { user: 'admin', pass: 'jameslevinn' } }, loginRes);
  console.log('login:', loginRes._result());
  const token = loginRes._result().body?.token;
  const gfRes = makeRes();
  await geofences({ method: 'GET', headers: { authorization: token ? `Bearer ${token}` : '' } }, gfRes);
  console.log('geofences:', gfRes._result());
};

run().catch((err) => {
  console.error('error:', err);
  process.exit(1);
});
