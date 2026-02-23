# lil-mocky

A lightweight JavaScript mocking library for testing. Create mock functions, objects, and classes with call tracking and return value control. Includes spy functionality for tracking calls to existing methods.

## 🎯 Features

- 🪶 **Lightweight**: Minimal dependencies, focused on core mocking functionality
- 🔧 **Flexible**: Builder pattern for composable mock configuration
- 📊 **Call Tracking**: Automatic tracking of all function calls with deep-cloned arguments
- 🎭 **Spy Support**: Track calls to existing methods while preserving or replacing behavior
- 🏗️ **Class Mocks**: Per-instance mock configuration for complex class testing
- ✅ **Simple API**: Clean, intuitive API that's easy to learn and use

## 📥 Installation

```bash
npm install lil-mocky
```

## 🚀 Quick Start

```javascript
const { expect } = require('chai');
const mocky = require('lil-mocky');

describe('User Service', () => {
  it('calls the callback with user data', () => {
    // Create a mock function
    const callback = mocky.fn().args('user').build();

    // Call it in your code
    callback({ name: 'Alice', age: 30 });

    // Verify it was called correctly
    expect(callback.calls[0]).to.deep.equal({
      user: { name: 'Alice', age: 30 }
    });
    expect(callback.calls.length).to.equal(1);
  });
});
```

**Shorthand synonyms** are available for all builders:

| Full name | Shorthand |
|-----------|-----------|
| `mocky.function()` | `mocky.fn()` |
| `mocky.object()` | `mocky.obj()` |
| `mocky.class()` | `mocky.cls()` |
| `Mock.instance()` | `Mock.inst()` |

---

### 🔨 Function Mocks

Mock functions for testing callbacks and handlers:

```javascript
// Testing code that accepts a callback
function processUsers(users, onComplete) {
  const processed = users.map(u => ({ ...u, processed: true }));
  onComplete(processed);
}

// Create mock callback with named arguments
const onComplete = mocky.fn().args('result').build();

// Run the code under test
processUsers([{ name: 'Alice' }], onComplete);

// Verify the callback was called correctly
expect(onComplete.calls[0]).to.deep.equal({
  result: [{ name: 'Alice', processed: true }]
});
expect(onComplete.calls.length).to.equal(1);
```

**Common patterns:**

```javascript
// Mock with return value
const mock = mocky.fn().build();
mock.ret('success');
const result = mock();
expect(result).to.equal('success');

// Set return value before build
const mock = mocky.fn().ret('success').build();
mock(); // Returns 'success'

// Mock async functions
const fetchData = mocky.fn().args('url').async().build();
fetchData.ret({ data: [1, 2, 3] });
const result = await fetchData('/api/data');
expect(result.data).to.deep.equal([1, 2, 3]);

// Arguments with defaults
const logger = mocky.fn().args('message', { level: 'info' }).build();
logger('Test message');
expect(logger.calls[0]).to.deep.equal({
  message: 'Test message',
  level: 'info'
});
```

#### .ret() - Set Return Values

Configure what the mock returns when called:

```javascript
const mock = mocky.fn().build();

// Simple return value
mock.ret('hello');
mock(); // Returns 'hello'

// Any value type — including falsy values
mock.ret(null);
mock.ret(0);
mock.ret(false);
mock.ret('');
mock.ret([1, 2, 3]);
mock.ret({ data: 'value' });

// Different return per call (0-indexed)
mock.ret('first', 0);   // First call
mock.ret('second', 1);  // Second call
mock.ret('default');     // All other calls (no index = default)

mock(); // 'first'
mock(); // 'second'
mock(); // 'default'
mock(); // 'default'
```

**ret() on builder:** You can set return values before `.build()`:

```javascript
const mock = mocky.fn().ret('pre-configured').build();
mock(); // Returns 'pre-configured'

// Per-call values work too
const mock = mocky.fn().ret('default').ret('first', 0).build();

// Builder values are restored on reset
mock.ret('override');
mock.reset();
mock(); // Returns 'pre-configured' again
```

**Important:** `.ret()` stores the value - it doesn't call functions:

```javascript
// ❌ WRONG - returns the function itself
mock.ret(() => compute());

// ✅ RIGHT - use custom implementation for dynamic behavior
const mock = mocky.fn((ctx) => {
  return compute();
}).build();
```

#### .throw() - Throw Errors

Explicit error throwing, parallel to `.ret()`:

```javascript
const mock = mocky.fn().build();

mock.throw(new Error('Something went wrong'));
mock(); // Throws 'Something went wrong'

// Non-Error values work too
mock.throw('string error');

// Per-call throwing (0-indexed)
mock.throw(new Error('first call only'), 0);
mock.ret('default');

mock(); // Throws 'first call only'
mock(); // Returns 'default'
```

#### .calls - Verify Arguments

Check what arguments were passed to the mock. `calls` is a getter that returns the array of all calls:

```javascript
const mock = mocky.fn().args('name', 'age').build();

mock('Alice', 30);
mock('Bob', 25);

// Get specific call
mock.calls[0]; // { name: 'Alice', age: 30 }
mock.calls[1]; // { name: 'Bob', age: 25 }

// Get all calls
mock.calls; // [{ name: 'Alice', age: 30 }, { name: 'Bob', age: 25 }]
mock.calls.length; // 2

// Without .args() config, returns raw arguments array
const rawMock = mocky.fn().build();
rawMock('a', 'b', 'c');
rawMock.calls[0]; // ['a', 'b', 'c']
```

#### .data - Custom State

`data` is a plain object on the mock for storing custom state. It persists across calls and is cleared on reset:

```javascript
const mock = mocky.fn((ctx) => {
  ctx.data.count = (ctx.data.count || 0) + 1;
  return ctx.data.count;
}).build();

mock(); // 1
mock(); // 2
mock.data.count; // 2

mock.reset();
mock.data; // {} (cleared)
```

#### .reset() - Clear State

Reset the mock back to its initial state:

```javascript
const mock = mocky.fn().build();
mock.ret('value');
mock('test');

mock.calls.length; // 1

mock.reset();

// Everything cleared
mock.calls.length; // 0
mock(); // Returns undefined (ret cleared)
```

#### Using context for Custom Implementations

For dynamic behavior, pass a function that receives a `context` object:

```javascript
const mock = mocky.fn((ctx) => {
  // Your custom logic here
  return ctx.args.x * 2;
}).args('x').build();

mock(5); // Returns 10
```

**Context properties:**

```javascript
const mock = mocky.fn((ctx) => {
  ctx.self       // The mockable surface (mock object or class description)
  ctx.args       // Named arguments (from .args() config)
  ctx.rawArgs    // Raw arguments array (before .args() processing)
  ctx.ret        // Value set via .ret()
  ctx.call       // Call index (0-indexed)
  ctx.data       // Custom state object (persists across calls, cleared on reset)
  ctx.original   // Original function (available in spies)

  return someValue;
}).args('param1', 'param2').build();
```

**Override pattern** - Allow `.ret()` to override default behavior:

```javascript
const compute = mocky.fn((ctx) => {
  // Check if .ret() was called
  if (ctx.ret !== undefined)
    return ctx.ret;

  // Default logic
  return ctx.args.x * ctx.args.y;
}).args('x', 'y').build();

compute(5, 3); // Returns 15 (default logic)

compute.ret(999); // Override
compute(5, 3); // Returns 999
```

**Conditional behavior** - Different logic based on arguments:

```javascript
const validator = mocky.fn((ctx) => {
  if (ctx.args.value === null)
    throw new Error('Value cannot be null');

  if (ctx.args.value.length < 3)
    return { valid: false, error: 'Too short' };

  return { valid: true };
}).args('value').build();

validator('ab'); // { valid: false, error: 'Too short' }
validator('abc'); // { valid: true }
```

**Stateful mocks** - Track state across calls:

```javascript
const counter = mocky.fn((ctx) => {
  ctx.data.count = (ctx.data.count || 0) + 1;
  return ctx.data.count;
}).build();

counter(); // 1
counter(); // 2
counter(); // 3

counter.reset(); // Clears ctx.data
counter(); // 1
```

**Call-specific behavior** - Different logic per call:

```javascript
const fetcher = mocky.fn((ctx) => {
  if (ctx.call === 0)
    return { status: 'loading' };

  if (ctx.call === 1)
    return { status: 'success', data: [1, 2, 3] };

  return { status: 'cached' };
}).build();

fetcher(); // { status: 'loading' }
fetcher(); // { status: 'success', ... }
fetcher(); // { status: 'cached' }
```

---

### 📦 Object Mocks

Mock objects for testing APIs, databases, and services:

```javascript
// Mock an API client
const api = mocky.obj({
  get: mocky.fn().args('url'),
  post: mocky.fn().args('url', 'data'),
  baseURL: 'https://api.example.com',
  timeout: 5000
}).build();

// Configure responses
api.get.ret({ status: 200, data: { users: [] } });
api.post.ret({ status: 201, data: { id: 123 } });

// Test your code that uses the API
async function createUser(apiClient, userData) {
  const response = await apiClient.post('/users', userData);
  return response.data;
}

const result = await createUser(api, { name: 'Alice' });

// Verify the API was called correctly
expect(api.post.calls[0]).to.deep.equal({
  url: '/users',
  data: { name: 'Alice' }
});
expect(result).to.deep.equal({ id: 123 });
```

**Nested mocks for complex structures:**

```javascript
const db = mocky.obj({
  users: mocky.obj({
    findById: mocky.fn().args('id'),
    create: mocky.fn().args('userData')
  }),
  connected: true
}).build();

db.users.findById.ret({ id: 1, name: 'Alice' });
const user = await db.users.findById(1);
```

**Symbol properties (advanced):**

```javascript
const iterable = mocky.obj({
  [Symbol.iterator]: mocky.fn()
}).build();

iterable[Symbol.iterator].ret('iterator');
```

#### Object .reset() Behavior

Calling `.reset()` on an object mock:
- Calls `.reset()` on all nested mocks (clears calls and return values)
- Restores plain properties to their initial values
- Deletes any properties added after creation

```javascript
const api = mocky.obj({
  get: mocky.fn(),
  baseURL: 'https://api.example.com',
  timeout: 5000
}).build();

api.get.ret('response');
api.get('test');
api.baseURL = 'https://other.com';
api.timeout = 10000;
api.newProp = 'added';

api.reset();

// After reset:
// - api.get.calls is []
// - api.get return values cleared
// - api.baseURL is 'https://api.example.com' (restored)
// - api.timeout is 5000 (restored)
// - api.newProp is deleted
```

---

### 🏛️ Class Mocks

Mock classes with per-instance behavior - perfect for services that get instantiated:

```javascript
// Mock a Logger class that gets instantiated per module
const Logger = mocky.cls({
  constructor: mocky.fn().args('moduleName'),
  info: mocky.fn().args('message'),
  error: mocky.fn().args('message'),
  level: 'info'
}).build();

// Test code that creates multiple logger instances
class UserService {
  constructor() {
    this.logger = new Logger('UserService');
  }

  async createUser(data) {
    this.logger.info('Creating user');
    // ... create user logic
    return { id: 1, ...data };
  }
}

class AuthService {
  constructor() {
    this.logger = new Logger('AuthService');
  }

  login(username) {
    this.logger.info('User logging in');
    // ... auth logic
  }
}

// Create the services (each creates its own Logger instance)
const userService = new UserService();
const authService = new AuthService();

await userService.createUser({ name: 'Alice' });
authService.login('alice');

// Verify each instance was used correctly
expect(Logger.inst(0).constructor.calls[0]).to.deep.equal({
  moduleName: 'UserService'
});
expect(Logger.inst(0).info.calls[0]).to.deep.equal({
  message: 'Creating user'
});

expect(Logger.inst(1).constructor.calls[0]).to.deep.equal({
  moduleName: 'AuthService'
});
expect(Logger.inst(1).info.calls[0]).to.deep.equal({
  message: 'User logging in'
});

expect(Logger.insts.length).to.equal(2);
```

**Accessing mock helpers on instances:**

You can access `.calls`, `.ret()`, and `.reset()` directly on instance methods:

```javascript
const Logger = mocky.cls({
  info: mocky.fn().args('message')
}).build();

const logger = new Logger();
logger.info('test message');

// Access calls directly on the instance
expect(logger.info.calls[0]).to.deep.equal({ message: 'test message' });

// Configure returns on the instance
logger.info.ret('logged');
expect(logger.info('another')).to.equal('logged');

// Reset via instance
logger.info.reset();
expect(logger.info.calls.length).to.equal(0);
```

**Pre-configuring instances:**

```javascript
// Configure behavior BEFORE instances are created
const Database = mocky.cls({
  constructor: mocky.fn().args('connectionString'),
  query: mocky.fn().args('sql'),
  pool: mocky.obj({
    acquire: mocky.fn(),
    release: mocky.fn()
  })
}).build();

// First instance returns user data
Database.inst(0).query.ret([{ id: 1, name: 'Alice' }]);
// Second instance returns empty results
Database.inst(1).query.ret([]);

const db1 = new Database('postgres://primary');
const db2 = new Database('postgres://replica');

const users = await db1.query('SELECT * FROM users'); // [{ id: 1, ... }]
const empty = await db2.query('SELECT * FROM users'); // []
```

#### Instance Access

Access all instances via the `insts` (or `instances`) getter:

```javascript
const Mock = mocky.cls({
  method: mocky.fn()
}).build();

const inst1 = new Mock();
const inst2 = new Mock();

Mock.insts.length;    // 2
Mock.instances.length; // 2 (synonym)
```

Use `Mock.inst(n)` to access or pre-configure a specific instance (lazy-creates if needed):

```javascript
Mock.inst(0);  // First instance
Mock.inst(1);  // Second instance
```

#### Using ctx.self for Instance State

`ctx.self` is the "mockable surface" — the object that holds the mock's state. For class mocks, this is the description object (what `Mock.inst(n)` returns), not the raw class instance. Properties you want to access via `ctx.self` should be defined as members:

```javascript
const Counter = mocky.cls({
  _count: 0,
  _initialized: false,
  constructor: mocky.fn((ctx) => {
    ctx.self._count = ctx.args.initial || 0;
    ctx.self._initialized = true;
  }).args('initial'),

  increment: mocky.fn((ctx) => {
    ctx.self._count++;
    return ctx.self._count;
  }),

  getCount: mocky.fn((ctx) => {
    return ctx.self._count;
  })
}).build();

const counter = new Counter(10);
counter.increment(); // 11
counter.increment(); // 12
counter.getCount();  // 12

// Each instance has its own state
const counter2 = new Counter(100);
counter2.increment(); // 101
counter.getCount();   // Still 12
```

#### Static Methods

Mark methods as static with `.static()` — they live on the class itself, not on instances:

```javascript
const WebSocket = mocky.cls({
  CONNECTING: mocky.fn().ret(0).static(),
  OPEN: mocky.fn().ret(1).static(),
  send: mocky.fn().args('data'),
}).build();

WebSocket.CONNECTING(); // 0
WebSocket.OPEN();       // 1

const ws = new WebSocket();
ws.send('hello');
ws.staticMethod; // undefined — not on instances

// Static methods are reset with the class
WebSocket.reset();
```

#### Class .reset() Behavior

Calling `.reset()` on a class mock:
- Clears all instance configurations
- Resets instance counter to 0
- Resets all static methods
- Next instantiation starts fresh at instance 0

```javascript
const Mock = mocky.cls({
  method: mocky.fn()
}).build();

Mock.inst(0).method.ret('value');
const instance1 = new Mock();
const instance2 = new Mock();

Mock.insts.length; // 2

Mock.reset();

// After reset:
// - All instance configurations cleared
// - Mock.insts.length is 0
// - Next instantiation starts fresh at instance 0
```

---

### 🔍 Spy Function

Track calls to existing methods without breaking their behavior:

```javascript
// Spy on an existing object's method
const emailService = {
  send: (to, subject, body) => {
    // Real implementation that sends email
    console.log(`Sending email to ${to}`);
    return { sent: true, id: '12345' };
  }
};

// Create a spy - calls through to original by default
const spy = mocky.spy(emailService, 'send');

// Test code that uses the email service
function notifyUser(user, message) {
  return emailService.send(user.email, 'Notification', message);
}

const result = notifyUser({ email: 'alice@example.com' }, 'Hello!');

// Verify the method was called correctly
expect(spy.calls[0]).to.deep.equal([
  'alice@example.com',
  'Notification',
  'Hello!'
]);
expect(result).to.deep.equal({ sent: true, id: '12345' });

// Clean up
spy.restore();
```

**Override return value:**

```javascript
const cache = {
  get: (key) => localStorage.getItem(key)
};

const spy = mocky.spy(cache, 'get');
spy.ret('mocked-value'); // Override return value

const value = cache.get('user-data'); // Returns 'mocked-value'
spy.restore();
```

**Spy with custom replacement:**

Pass a plain function and optional argument names directly:

```javascript
const obj = {
  add: (a, b) => a + b
};

// Plain function + args array (no need to wrap in mocky.fn())
const spy = mocky.spy(obj, 'add', (ctx) => {
  return ctx.original.apply(ctx.self, ctx.rawArgs) * 10;
}, ['x', 'y']);

obj.add(3, 4); // 70 — (3 + 4) * 10
spy.calls[0];  // { x: 3, y: 4 }

spy.restore();
```

You can also use a full builder for more control:

```javascript
const spy = mocky.spy(analytics, 'track', mocky.fn((ctx) => {
  console.log('Analytics called:', ctx.rawArgs);
  ctx.original.apply(ctx.self, ctx.rawArgs);
}).args('event', 'data'));
```

**Spy on class prototypes (affects all instances):**

```javascript
class HttpClient {
  request(url, options) {
    return fetch(url, options);
  }
}

const spy = mocky.spy(HttpClient.prototype, 'request');

const client1 = new HttpClient();
const client2 = new HttpClient();

client1.request('/api/users', { method: 'GET' });
client2.request('/api/posts', { method: 'GET' });

// Both instances' calls are tracked
expect(spy.calls.length).to.equal(2);
spy.restore();
```

---

## 🔄 Coming from Jest?

Migration guide for Jest users:

| Jest | lil-mocky |
|------|-----------|
| `jest.fn()` | `mocky.fn().build()` |
| `mock.mockReturnValue(val)` | `mock.ret(val)` |
| `mock.mock.calls[0][0]` | `mock.calls[0]` |
| `jest.spyOn(obj, 'method')` | `mocky.spy(obj, 'method')` |
| `spy.mockRestore()` | `spy.restore()` |

**Key differences:**
- **Builder pattern**: Explicit configuration via chainable builders before `.build()`
- **Named arguments**: Built-in support for named argument tracking with `.args()`
- **Per-instance class mocks**: Configure different behavior for each class instance
- **Simpler API**: Fewer concepts, more predictable behavior

---

## 📄 License

MIT

## 🤝 Contributing

Contributions welcome! Please open an issue or PR on GitHub.
