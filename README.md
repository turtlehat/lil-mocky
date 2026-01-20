# lil-mocky

A lightweight JavaScript mocking library for testing. Create mock functions, objects, classes, and properties with call tracking and return value control. Includes spy functionality for tracking calls to existing methods.

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
const mocky = require('lil-mocky');

// Create a simple mock function
const mock = mocky.function().args('name', 'age').build();
mock.ret('success');

mock('Alice', 30);

console.log(mock.calls(0)); // { name: 'Alice', age: 30 }
console.log(mock.calls().length); // 1

// Spy on an existing method
const obj = { greet: (name) => `Hello, ${name}!` };
const spy = mocky.spy(obj, 'greet');

obj.greet('World');
console.log(spy.calls(0)); // ['World']
spy.restore();
```

## 📖 API Reference

### 🔨 Function Mocks

Create mock functions with configurable argument tracking and return values:

```javascript
// Basic function mock
const mock = mocky.function().build();
mock.ret('return value');

// Named arguments
const mock = mocky.function().args('x', 'y').build();
mock('hello', 'world');
mock.calls(0); // { x: 'hello', y: 'world' }

// Arguments with defaults
const mock = mocky.function().args('name', { age: 18 }).build();
mock('Alice');
mock.calls(0); // { name: 'Alice', age: 18 }

// Select specific arguments
const mock = mocky.function().argSelect(1).build();
mock('first', 'second', 'third');
mock.calls(0); // 'second'

// Custom function body
const mock = mocky.function((context) => {
  return context.args.x + context.args.y;
}).args('x', 'y').build();
mock.ret(100); // Can still override via ret
mock(5, 3); // Returns 100

// Async functions
const mock = mocky.function().async().build();
await mock(); // Returns a promise
```

### 📦 Object Mocks

Create mock objects with nested mocks and plain properties:

```javascript
const mock = mocky.object({
  method: mocky.function().args('input'),
  nested: mocky.object({
    deepMethod: mocky.function()
  }),
  counter: 0,
  name: 'Alice'
}).build();

mock.method.ret('result');
mock.method('test');
mock.method.calls(0); // { input: 'test' }

// Modify properties
mock.counter = 100;
mock.name = 'Bob';
mock.addedProp = 'new';

// Reset restores everything
mock.reset();
// - Nested mocks cleared (method.calls() = [])
// - Plain properties restored (counter = 0, name = 'Alice')
// - Added properties deleted (addedProp removed)

// Symbol properties are fully supported
const mock = mocky.object({
  [Symbol.iterator]: mocky.function(),
  [Symbol.toStringTag]: 'CustomMock'
}).build();

mock[Symbol.iterator].ret('value');
mock[Symbol.iterator](); // Returns 'value'
```

### 🏛️ Class Mocks

Create mock classes with per-instance configuration:

```javascript
const Mock = mocky.class({
  constructor: mocky.function().args('name'),
  greet: mocky.function().args('greeting')
}).build();

// Pre-configure instance behavior
Mock.inst(0).greet.ret('Hello!');
Mock.inst(1).greet.ret('Hola!');

const instance1 = new Mock('Alice');
const instance2 = new Mock('Bob');

instance1.greet('Hi'); // Returns 'Hello!'
instance2.greet('Hi'); // Returns 'Hola!'

// Access instance mocks after creation
Mock.inst(0).constructor.calls(0); // { name: 'Alice' }
Mock.numInsts(); // 2
```

### 🔍 Spy Function

Track calls to existing methods while optionally replacing their implementation:

```javascript
// Basic spy - calls through to original
const obj = { add: (a, b) => a + b };
const spy = mocky.spy(obj, 'add');

obj.add(2, 3); // Returns 5
spy.calls(0); // [2, 3]

// Override return value
spy.ret(100);
obj.add(2, 3); // Returns 100

// Spy with custom replacement
const spy = mocky.spy(obj, 'add', mocky.function((context) => {
  const result = context.original.apply(context.self, context.rawArgs);
  return result * 2; // Double the result
}).args('a', 'b'));

obj.add(5, 3); // Returns 16 (5+3)*2
spy.calls(0); // { a: 5, b: 3 }

// Restore original method
spy.restore();
obj.add(2, 3); // Returns 5 again

// Spy on class prototypes
class MyClass {
  doThing() { return 'original'; }
}

const spy = mocky.spy(MyClass.prototype, 'doThing');
const instance = new MyClass();
instance.doThing(); // Calls through to original
spy.calls().length; // 1
spy.restore();
```

## 🎨 Advanced Usage

### Understanding .ret() vs Custom Implementations

**Use `.ret()` for static return values:**

```javascript
const mock = mocky.function().build();
mock.ret(42); // Returns 42 for all calls
mock.ret(null, 1); // Returns null for first call only
mock.ret([1, 2, 3]); // Returns the array

// ❌ WRONG - .ret() stores the value, doesn't call functions
mock.ret(() => someLogic()); // Returns the function itself!
```

**Use custom implementations for dynamic logic:**

```javascript
// ✅ RIGHT - custom implementation for dynamic behavior
const mock = mocky.function((context) => {
  // Access context.ret to allow overriding via .ret()
  if (context.ret !== undefined)
    return context.ret;

  // Your custom logic
  return context.args.x * 2;
}).args('x').build();

mock(5); // Returns 10 (uses custom logic)
mock.ret(100); // Override for all calls
mock(5); // Returns 100 (ignores custom logic)
```

**When to use each:**
- **`.ret(value)`**: Simple values, different returns per call number, test-time configuration
- **Custom implementation**: Dynamic computation, access to arguments/context, fallback patterns

### Return Values Per Call

Configure different return values for each call:

```javascript
const mock = mocky.function().build();

mock.ret('default'); // Call 0 = default for all calls
mock.ret('first', 1); // Call 1 = first actual call
mock.ret('second', 2); // Call 2 = second actual call

mock(); // Returns 'first' (call 1)
mock(); // Returns 'second' (call 2)
mock(); // Returns 'default' (call 3 falls back to call 0)
```

**Important**: Call numbers are **1-indexed** (first call is 1, not 0). Call 0 is the default fallback for all calls.

### Dynamic Return Values

Use handlers for dynamic return values based on arguments:

```javascript
const mock = mocky.function().args('x').build();

mock.onRet((args) => args.x * 2);

mock(5); // Returns 10
mock(3); // Returns 6
```

### Error Throwing

Return an Error instance to make the mock throw:

```javascript
const mock = mocky.function().build();
mock.ret(new Error('Test error'));

mock(); // Throws 'Test error'
```

### Custom Context

Access full context in custom function bodies:

```javascript
const mock = mocky.function((context) => {
  // context.self - The 'this' context
  // context.state - Internal state object
  // context.call - Call number (1-indexed)
  // context.args - Processed arguments
  // context.rawArgs - Unprocessed arguments array
  // context.original - Original function (if set via .original())
  // context.ret - Configured return value

  return context.ret || 'default';
}).args('x', 'y').build();
```

### Resetting Mocks

All mocks support `.reset()` to clear state:

```javascript
const mock = mocky.function().build();
mock.ret('value');
mock('test');

mock.calls().length; // 1

mock.reset();

mock.calls().length; // 0
mock(); // Returns undefined (ret cleared)
```

### Working with Null and Undefined

Both `null` and `undefined` are valid property values:

```javascript
const mock = mocky.object({
  nullValue: null,        // Explicitly null
  undefinedValue: undefined, // Explicitly undefined (or just omit)
  zeroValue: 0,          // Falsy but valid
  emptyString: '',       // Falsy but valid
  method: mocky.function()
}).build();

// All properties are accessible
mock.nullValue;        // null
mock.undefinedValue;   // undefined

// Reset restores all initial values including null/undefined
mock.nullValue = 'changed';
mock.reset();
mock.nullValue;        // null (restored)
```

## 💡 Common Patterns

### Fallback Pattern

Combine custom implementation with `.ret()` for flexible mocking:

```javascript
const mock = mocky.function((context) => {
  // Allow test to override via .ret()
  if (context.ret !== undefined)
    return context.ret;

  // Default behavior
  return context.args.x * 2;
}).args('x').build();

// Uses default behavior
mock(5); // Returns 10

// Override for specific test
mock.ret(999);
mock(5); // Returns 999
```

### Simulating Async Operations

Mock IndexedDB-style async requests:

```javascript
const openRequest = mocky.function((context) => {
  const request = {
    result: null,
    onsuccess: null,
    onerror: null
  };

  setTimeout(() => {
    if (context.ret !== undefined)
      request.result = context.ret;
    request.onsuccess?.();
  }, 0);

  return request;
}).build();

// In test
openRequest.ret({ objectStoreNames: ['store1', 'store2'] });
const req = openRequest();
req.onsuccess = () => {
  console.log(req.result); // { objectStoreNames: [...] }
};
```

### Conditional Behavior

Throw errors or return values based on arguments:

```javascript
const mock = mocky.function((context) => {
  if (context.args.shouldFail)
    throw new Error('Simulated failure');

  return context.ret || 'default success';
}).args('shouldFail').build();

// Normal operation
mock(false); // Returns 'default success'

// Simulate failure
try {
  mock(true); // Throws error
} catch (e) {
  console.log('Caught:', e.message);
}

// Override return value
mock.ret('custom');
mock(false); // Returns 'custom'
```

### Progressive Call Responses

Simulate different responses for sequential calls:

```javascript
const fetch = mocky.function().args('url').build();

// First call: loading
fetch.ret({ status: 'loading' }, 1);
// Second call: success
fetch.ret({ status: 'success', data: [1, 2, 3] }, 2);
// Third call: cached
fetch.ret({ status: 'cached', data: [1, 2, 3] }, 3);

fetch('/api'); // { status: 'loading' }
fetch('/api'); // { status: 'success', data: [...] }
fetch('/api'); // { status: 'cached', data: [...] }
```

### Complex Object with Multiple Mock Types

```javascript
const mockDB = mocky.object({
  // Simple mock - configure with .ret() in tests
  get: mocky.function().args('key'),

  // Mock with custom logic and fallback
  getOrDefault: mocky.function((context) => {
    return context.ret || context.args.defaultValue;
  }).args('key', 'defaultValue'),

  // Async mock
  fetch: mocky.function((context) => {
    return Promise.resolve(context.ret || null);
  }).args('url'),

  // Plain properties
  connected: true,
  retryCount: 0
}).build();

// In tests
mockDB.get.ret('cached-value');
mockDB.fetch.ret({ data: [1, 2, 3] });

mockDB.get('key'); // 'cached-value'
mockDB.getOrDefault('missing', 'fallback'); // 'fallback'
await mockDB.fetch('/api'); // { data: [1, 2, 3] }

// Reset everything for next test
mockDB.reset();
```

## 🧪 Testing with Mocha/Chai

```javascript
const { expect } = require('chai');
const mocky = require('lil-mocky');

describe('My Module', () => {
  it('calls the API with correct parameters', () => {
    const api = {
      fetch: (url, options) => { /* real implementation */ }
    };

    const spy = mocky.spy(api, 'fetch', mocky.function().args('url', 'options'));
    spy.ret(Promise.resolve({ data: 'test' }));

    // Test your code that calls api.fetch()
    myModule.doSomething(api);

    expect(spy.calls(0)).to.deep.equal({
      url: '/api/endpoint',
      options: { method: 'POST' }
    });

    spy.restore();
  });
});
```

## 🔄 Comparison with Jest

lil-mocky provides similar functionality to Jest mocks but with a builder-based API:

| Jest | lil-mocky |
|------|-----------|
| `jest.fn()` | `mocky.function().build()` |
| `mock.mockReturnValue(val)` | `mock.ret(val)` |
| `mock.mock.calls[0][0]` | `mock.calls(0)` |
| `jest.spyOn(obj, 'method')` | `mocky.spy(obj, 'method')` |
| `spy.mockRestore()` | `spy.restore()` |

**Key differences:**
- **Builder pattern**: lil-mocky uses chainable builders for configuration
- **Named arguments**: Built-in support for named argument tracking
- **Per-instance class mocks**: Configure different behavior for each class instance
- **Simpler API**: Fewer concepts to learn, more predictable behavior

## 📝 Notes

### Breaking Changes

**v1.x**: Functions without `.args()` configuration now return an arguments array in `.calls()` instead of `null`. This enables spy functionality but may affect existing code that expects `null`.

### Builder vs. Built Mocks

- Builders have methods like `.args()`, `.async()`, `.build()`
- Built mocks have methods like `.ret()`, `.calls()`, `.reset()`
- Call `.build()` to convert a builder to a mock

```javascript
// Builder (not yet usable as a mock)
const builder = mocky.function().args('x');

// Built mock (ready to use)
const mock = builder.build();
mock.ret('value');
```

**Note**: `mocky.create(builder)` also exists for backwards compatibility - it's just a wrapper that calls `.build()`.

### Built Mocks Are Immutable

Once a mock is built, its properties are read-only and cannot be reassigned:

```javascript
const mock = mocky.object({
  method: mocky.function()
}).build();

// ❌ WRONG - will throw an error
mock.method = () => 'new implementation'; // TypeError!

// ✅ RIGHT - define everything during building
const mock = mocky.object({
  method: mocky.function((context) => 'implementation')
}).build();

// You CAN modify plain property values
const mock = mocky.object({
  counter: 0,
  method: mocky.function()
}).build();

mock.counter = 10; // ✅ OK - plain properties are mutable
mock.method = null; // ❌ ERROR - mock functions are read-only
```

**Why?** This prevents accidental bugs and ensures `.reset()` works correctly by maintaining the original mock structure.

## 📄 License

MIT

## 🤝 Contributing

Contributions welcome! Please open an issue or PR on GitHub.
