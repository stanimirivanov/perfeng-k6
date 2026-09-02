import { createServer } from 'node:http';

export async function fixture(mode = 'ok') {
  const server = createServer((request, response) => {
    request.resume();
    const path = new URL(request.url, 'http://fixture').pathname;
    let status = 200;
    let body = {};
    if (path === '/api/v1/cart' && request.method === 'GET') {
      status = mode === 'cart-failure' ? 500 : 200;
      body = { cartId: 'example-cart' };
    } else if (path === '/api/v1/checkout' && request.method === 'POST') {
      status = 201;
      body = mode === 'missing-order' ? {} : { orderId: 'fixture-order' };
    } else if (path === '/api/v1/search' && request.method === 'GET') {
      status = mode === 'search-failure' ? 500 : 200;
      body = { results: ['fixture-result'] };
    } else if (/^\/api\/v1\/users\/[^/]+\/preferences$/.test(path) && request.method === 'PUT') {
      status = mode === 'preferences-failure' ? 500 : 200;
      body = { updated: true };
    } else if (/^\/api\/v1\/users\/[^/]+$/.test(path) && request.method === 'GET') {
      body = { id: 'fixture-user' };
    } else {
      status = 404;
    }
    response.writeHead(status, { 'Content-Type': 'application/json' });
    response.end(mode === 'malformed-order' && path === '/api/v1/checkout' ? 'not-json' : JSON.stringify(body));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { server, url: `http://127.0.0.1:${server.address().port}` };
}
