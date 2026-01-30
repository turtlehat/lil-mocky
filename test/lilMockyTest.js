const { expect } = require('chai');
const mocky = require('../src/lil-mocky.js');


describe('lil-mocky', () => {
	describe('function', () => {
		it('will build directly without mocky.create', async () => {
			const mock = mocky.function().args('x', 'y').build();
			mock.ret('result');

			expect(mock(1, 2)).to.equal('result');
			expect(mock.calls(0)).to.deep.equal({ x: 1, y: 2 });
		});
		it('will be a function with args', async () => {
			const mock = mocky.create(mocky.function().args('firstArg', { secondArg: 'testDefault' }));
			mock.ret('testRet');

			expect(mock('testArg')).to.equal('testRet');
			expect(mock.calls(0)).to.deep.equal({
				firstArg: 'testArg',
				secondArg: 'testDefault'
			});
			expect(mock.calls().length).to.equal(1);
		});
		it('will be a function with custom return', async () => {
			const mock = mocky.create(mocky.function((context) => {
				return context.ret;
			}).args('firstArg'));
			mock.ret('testRet');

			expect(mock('testArg')).to.equal('testRet');
			expect(mock.calls(0)).to.deep.equal({ firstArg: 'testArg' });
			expect(mock.calls().length).to.equal(1);
		});
		it('will use argSelect with single index to return raw argument', async () => {
			const mock = mocky.create(mocky.function().argSelect(1));
			mock.ret('testRet');

			const result = mock('first', { test: 'data' }, 'third');

			expect(result).to.equal('testRet');
			// When argSelect has single index, calls returns the raw argument
			expect(mock.calls(0)).to.deep.equal({ test: 'data' });
		});
		it('will use argSelect with multiple indexes to filter named args', async () => {
			const mock = mocky.create(mocky.function().args('first', 'second', 'third').argSelect(0, 2));

			mock('value1', 'value2', 'value3');

			// Only first and third are captured
			expect(mock.calls(0)).to.deep.equal({
				first: 'value1',
				third: 'value3'
			});
		});
		it('will deep clone arguments to prevent mutation', async () => {
			const mock = mocky.create(mocky.function().args('data'));

			const obj = { nested: { value: 'original' } };
			mock(obj);

			// Mutate the original
			obj.nested.value = 'mutated';

			// Stored call should be unchanged
			expect(mock.calls(0).data.nested.value).to.equal('original');
		});
		it('will reset function state', async () => {
			const mock = mocky.create(mocky.function().args('arg'));
			mock.ret('first-ret');

			mock('call1');
			mock('call2');

			expect(mock.calls().length).to.equal(2);

			mock.reset();

			expect(mock.calls().length).to.equal(0);
			expect(mock('call3')).to.equal(undefined); // Return values cleared
		});
		it('will access all context properties in custom body', async () => {
			const mock = mocky.create(mocky.function((context) => {
				return {
					call: context.call,
					args: context.args,
					ret: context.ret,
					hasState: typeof context.state === 'object',
					hasData: typeof context.state.data === 'object'
				};
			}).args('testArg'));
			mock.ret('custom-ret');

			const result = mock('test-value');

			expect(result.call).to.equal(1); // First call
			expect(result.args).to.deep.equal({ testArg: 'test-value' });
			expect(result.ret).to.equal('custom-ret');
			expect(result.hasState).to.equal(true);
			expect(result.hasData).to.equal(true);
		});
	});

	describe('object', () => {
		it('will be object with function', async () => {
			const mock = mocky.create(mocky.object({
				run: mocky.function().args('firstArg')
			}));

			mock.run.ret('testRet');
			expect(mock.run('testArg')).to.equal('testRet');
			expect(mock.run.calls(0)).to.deep.equal({ firstArg: 'testArg' });
			expect(mock.run.calls().length).to.equal(1);
		});
		it('will be object with nested object and function', async () => {
			const mock = mocky.create(mocky.object({
				sub: mocky.object({
					run: mocky.function().args('firstArg')
				})
			}));
			mock.sub.run.ret('testRet');

			expect(mock.sub.run('testArg')).to.equal('testRet');
			expect(mock.sub.run.calls(0)).to.deep.equal({ firstArg: 'testArg' });
			expect(mock.sub.run.calls().length).to.equal(1);
		});
		it('will reset all nested mocks when object is reset', async () => {
			const mock = mocky.create(mocky.object({
				method1: mocky.function().args('arg'),
				nested: mocky.object({
					method2: mocky.function().args('arg')
				})
			}));

			mock.method1.ret('ret1');
			mock.nested.method2.ret('ret2');

			mock.method1('call1');
			mock.nested.method2('call2');

			expect(mock.method1.calls().length).to.equal(1);
			expect(mock.nested.method2.calls().length).to.equal(1);

			// Reset should propagate to all nested mocks
			mock.reset();

			expect(mock.method1.calls().length).to.equal(0);
			expect(mock.nested.method2.calls().length).to.equal(0);
			expect(mock.method1('test')).to.equal(undefined);
			expect(mock.nested.method2('test')).to.equal(undefined);
		});
		it('will be object with property getter and setter', async () => {
			const mock = mocky.create(mocky.object({
				accessor: mocky.property()
			}));

			// Initial value should be undefined
			expect(mock.accessor).to.equal(undefined);

			// Set a value
			mock.accessor = 'testValue';
			expect(mock.accessor).to.equal('testValue');

			// Change the value
			mock.accessor = 'newValue';
			expect(mock.accessor).to.equal('newValue');
		});
		it('will have property reset limitation', async () => {
			const mock = mocky.create(mocky.object({
				accessor: mocky.property()
			}));

			mock.accessor = 'testValue';
			expect(mock.accessor).to.equal('testValue');

			// Note: Property reset doesn't work through object.reset() because
			// the wired object with reset() is replaced by defineProperty
			// This is a known limitation of the property builder
			mock.reset();

			// Property value persists after reset (known limitation)
			expect(mock.accessor).to.equal('testValue');
		});
		it('will reset plain properties to initial values', async () => {
			const mock = mocky.create(mocky.object({
				counter: 0,
				name: 'Alice',
				method: mocky.function()
			}));

			mock.counter = 100;
			mock.name = 'Bob';
			mock.method.ret('test');
			mock.method();

			mock.reset();

			expect(mock.counter).to.equal(0);
			expect(mock.name).to.equal('Alice');
			expect(mock.method.calls().length).to.equal(0);
		});
		it('will delete properties added after creation', async () => {
			const mock = mocky.create(mocky.object({
				initial: 'value'
			}));

			mock.added = 'new';
			expect(mock.added).to.equal('new');

			mock.reset();

			expect(mock.initial).to.equal('value');
			expect(mock.added).to.equal(undefined);
			expect('added' in mock).to.equal(false);
		});
		it('will reset object with mixed property types', async () => {
			const mock = mocky.create(mocky.object({
				counter: 42,
				method: mocky.function(),
				accessor: mocky.property()
			}));

			mock.counter = 100;
			mock.method.ret('test');
			mock.method();
			mock.accessor = 'value';

			mock.reset();

			expect(mock.counter).to.equal(42);
			expect(mock.method.calls().length).to.equal(0);
			expect(mock.accessor).to.equal('value');
		});
		it('will support Symbol properties', async () => {
			const customSymbol = Symbol('custom');

			const mock = mocky.create(mocky.object({
				[Symbol.iterator]: mocky.function(),
				[customSymbol]: 'symbolValue',
				regularProp: 'regularValue'
			}));

			// Verify Symbol.iterator exists and is a function
			expect(typeof mock[Symbol.iterator]).to.equal('function');

			// Verify custom symbol property exists
			expect(mock[customSymbol]).to.equal('symbolValue');

			// Verify regular property exists
			expect(mock.regularProp).to.equal('regularValue');

			// Configure and use Symbol.iterator
			mock[Symbol.iterator].ret('iteratorResult');
			expect(mock[Symbol.iterator]()).to.equal('iteratorResult');
			expect(mock[Symbol.iterator].calls().length).to.equal(1);
		});
		it('will reset Symbol properties correctly', async () => {
			const customSymbol = Symbol('custom');

			const mock = mocky.create(mocky.object({
				[Symbol.iterator]: mocky.function().args('arg'),
				[customSymbol]: 'initialValue',
				regularProp: 'initial'
			}));

			// Modify all properties
			mock[Symbol.iterator].ret('testRet');
			mock[Symbol.iterator]('testArg');
			mock[customSymbol] = 'modifiedValue';
			mock.regularProp = 'modified';

			// Verify modifications
			expect(mock[Symbol.iterator]('testArg')).to.equal('testRet');
			expect(mock[Symbol.iterator].calls().length).to.equal(2);
			expect(mock[customSymbol]).to.equal('modifiedValue');
			expect(mock.regularProp).to.equal('modified');

			// Reset
			mock.reset();

			// Verify Symbol function mock was reset
			expect(mock[Symbol.iterator].calls().length).to.equal(0);
			expect(mock[Symbol.iterator]()).to.equal(undefined);

			// Verify Symbol plain property was restored
			expect(mock[customSymbol]).to.equal('initialValue');

			// Verify regular property was restored
			expect(mock.regularProp).to.equal('initial');
		});
		it('will delete Symbol properties added after creation', async () => {
			const initialSymbol = Symbol('initial');
			const addedSymbol = Symbol('added');

			const mock = mocky.create(mocky.object({
				[initialSymbol]: 'initial'
			}));

			// Add a Symbol property after creation
			mock[addedSymbol] = 'added';
			expect(mock[addedSymbol]).to.equal('added');

			// Reset
			mock.reset();

			// Initial Symbol property should remain
			expect(mock[initialSymbol]).to.equal('initial');

			// Added Symbol property should be deleted
			expect(mock[addedSymbol]).to.equal(undefined);
			expect(Object.getOwnPropertySymbols(mock).includes(addedSymbol)).to.equal(false);
		});
		it('will handle null and undefined property values', async () => {
			const mock = mocky.create(mocky.object({
				nullProp: null,
				undefinedProp: undefined,
				zeroProp: 0,
				falseProp: false,
				emptyStringProp: ''
			}));

			// Verify initial values
			expect(mock.nullProp).to.equal(null);
			expect(mock.undefinedProp).to.equal(undefined);
			expect(mock.zeroProp).to.equal(0);
			expect(mock.falseProp).to.equal(false);
			expect(mock.emptyStringProp).to.equal('');

			// Modify values
			mock.nullProp = 'changed';
			mock.undefinedProp = 'changed';
			mock.zeroProp = 100;
			mock.falseProp = true;
			mock.emptyStringProp = 'changed';

			// Reset
			mock.reset();

			// Verify restored to initial values
			expect(mock.nullProp).to.equal(null);
			expect(mock.undefinedProp).to.equal(undefined);
			expect(mock.zeroProp).to.equal(0);
			expect(mock.falseProp).to.equal(false);
			expect(mock.emptyStringProp).to.equal('');
		});
	});

	describe('class', () => {
		it('will be class with constructor and method', async () => {
			const Mock = mocky.create(mocky.class({
				constructor: mocky.function().args('initArg'),
				run: mocky.function().args('firstArg')
			}));
			Mock.inst().run.ret('testRet');

			const mockInstance = new Mock('testOption');
			expect(Mock.inst().constructor.calls(0)).to.deep.equal({ initArg: 'testOption' });
			expect(Mock.inst().constructor.calls().length).to.equal(1);

			expect(mockInstance.run('testArg')).to.equal('testRet');
			expect(Mock.inst().run.calls(0)).to.deep.equal({ firstArg: 'testArg' });
			expect(Mock.inst().run.calls().length).to.equal(1);
		});

		it('will be class with constructor and builder methods', async () => {
			const Mock = mocky.create(mocky.class({
				index: mocky.function((context) => {
					return context.self;
				}).args('index'),
				namespace: mocky.function((context) => {
					return context.self;
				}).args('namespace'),
				query: mocky.function((context) => {
					return context.self;
				}).args('query')
			}));

			const mockInstance = new Mock();
			mockInstance.index('test-index').namespace('test-namespace').query({ test: 'query' });
			expect(Mock.inst().index.calls(0)).to.deep.equal({ index: 'test-index' });
			expect(Mock.inst().index.calls().length).to.equal(1);
			expect(Mock.inst().namespace.calls(0)).to.deep.equal({ namespace: 'test-namespace' });
			expect(Mock.inst().namespace.calls().length).to.equal(1);
			expect(Mock.inst().query.calls(0)).to.deep.equal({ query: { test: 'query' } });
			expect(Mock.inst().query.calls().length).to.equal(1);
		});

		it('will demonstrate that state.data is per-method, not shared', async () => {
			const Counter = mocky.create(mocky.class({
				constructor: mocky.function((context) => {
					// state.data here is separate from other methods
					context.state.data.constructorData = 'set in constructor';
				}).args('startValue'),
				getConstructorData: mocky.function((context) => {
					// This state.data is different from constructor's state.data
					return context.state.data.constructorData; // Will be undefined
				})
			}));

			const counter = new Counter(10);
			// This will be undefined because each method has its own state.data
			expect(counter.getConstructorData()).to.equal(undefined);
		});

		it('will store data on instance via context.self in constructor', async () => {
			const Counter = mocky.create(mocky.class({
				constructor: mocky.function((context) => {
					// Store data directly on the instance
					context.self._count = context.args.startValue || 0;
					context.self._initialized = true;
				}).args('startValue'),
				increment: mocky.function((context) => {
					context.self._count++;
					return context.self._count;
				}),
				getCount: mocky.function((context) => {
					return context.self._count;
				}),
				isInitialized: mocky.function((context) => {
					return context.self._initialized;
				})
			}));

			const counter1 = new Counter(10);
			expect(counter1._initialized).to.equal(true);
			expect(counter1.isInitialized()).to.equal(true);
			expect(counter1.getCount()).to.equal(10);
			expect(counter1.increment()).to.equal(11);
			expect(counter1.increment()).to.equal(12);
			expect(counter1.getCount()).to.equal(12);

			// Second instance should have separate data
			const counter2 = new Counter(5);
			expect(counter2.getCount()).to.equal(5);
			expect(counter2.increment()).to.equal(6);

			// First instance should be unaffected
			expect(counter1.getCount()).to.equal(12);
		});

		it('will track number of instances created with numInsts', async () => {
			const Mock = mocky.create(mocky.class({
				constructor: mocky.function().args('value')
			}));

			expect(Mock.numInsts()).to.equal(0);

			const inst1 = new Mock('first');
			expect(Mock.numInsts()).to.equal(1);

			const inst2 = new Mock('second');
			expect(Mock.numInsts()).to.equal(2);

			const inst3 = new Mock('third');
			expect(Mock.numInsts()).to.equal(3);
		});

		it('will reset all instances and counters', async () => {
			const Mock = mocky.create(mocky.class({
				constructor: mocky.function().args('value'),
				run: mocky.function().args('arg')
			}));

			Mock.inst(0).run.ret('first-ret');
			Mock.inst(1).run.ret('second-ret');

			const inst1 = new Mock('first');
			const inst2 = new Mock('second');

			expect(inst1.run('test')).to.equal('first-ret');
			expect(inst2.run('test')).to.equal('second-ret');
			expect(Mock.numInsts()).to.equal(2);
			expect(Mock.inst(0).run.calls().length).to.equal(1);

			// Reset should clear everything
			Mock.reset();

			expect(Mock.numInsts()).to.equal(0);

			// After reset, new instances start from index 0 again
			const inst3 = new Mock('third');
			expect(Mock.numInsts()).to.equal(1);
			// Returns should be cleared
			expect(inst3.run('test')).to.equal(undefined);
			// Calls should be cleared
			expect(Mock.inst(0).run.calls().length).to.equal(1); // Just this one call
		});

		it('will pre-configure instances before instantiation', async () => {
			const Mock = mocky.create(mocky.class({
				run: mocky.function().args('arg')
			}));

			// Configure instances before they're created
			Mock.inst(0).run.ret('first-value');
			Mock.inst(1).run.ret('second-value');
			Mock.inst(2).run.ret('third-value');

			const inst1 = new Mock();
			const inst2 = new Mock();
			const inst3 = new Mock();

			expect(inst1.run('test')).to.equal('first-value');
			expect(inst2.run('test')).to.equal('second-value');
			expect(inst3.run('test')).to.equal('third-value');
		});

		it('will support async methods', async () => {
			const Mock = mocky.create(mocky.class({
				fetchData: mocky.function().args('id').async()
			}));

			Mock.inst().fetchData.ret('async-result');

			const inst = new Mock();
			const result = await inst.fetchData('test-id');

			expect(result).to.equal('async-result');
			expect(Mock.inst().fetchData.calls(0)).to.deep.equal({ id: 'test-id' });
		});

		it('will throw errors from class methods', async () => {
			const Mock = mocky.create(mocky.class({
				throwError: mocky.function().args('message')
			}));

			const testError = new Error('Test error');
			Mock.inst().throwError.ret(testError);

			const inst = new Mock();

			expect(() => inst.throwError('fail')).to.throw('Test error');
			expect(Mock.inst().throwError.calls(0)).to.deep.equal({ message: 'fail' });
		});

		it('will handle onRet handlers in class methods', async () => {
			const Mock = mocky.create(mocky.class({
				calculate: mocky.function().args('x', 'y')
			}));

			Mock.inst().calculate.onRet((args) => {
				return args.x + args.y;
			});

			const inst = new Mock();

			expect(inst.calculate(5, 3)).to.equal(8);
			expect(inst.calculate(10, 20)).to.equal(30);
		});

		it('will handle different return values per call', async () => {
			const Mock = mocky.create(mocky.class({
				getValue: mocky.function()
			}));

			Mock.inst().getValue.ret('default');
			Mock.inst().getValue.ret('first-call', 1);
			Mock.inst().getValue.ret('second-call', 2);

			const inst = new Mock();

			expect(inst.getValue()).to.equal('first-call');
			expect(inst.getValue()).to.equal('second-call');
			expect(inst.getValue()).to.equal('default'); // Falls back to call 0
		});

		it('will allow a class to extend the mock class', () => {
			const Mock = mocky.create(mocky.class({
				getValue: mocky.function().args('x')
			}));

			Mock.inst().getValue.ret('mock-value');

			class Child extends Mock {
			}

			const child = new Child();
			expect(child.getValue('test')).to.equal('mock-value');
			expect(Mock.inst().getValue.calls(0)).to.deep.equal({ x: 'test' });
		});

		it('will allow child class to override mock method and call super', () => {
			const Mock = mocky.create(mocky.class({
				getValue: mocky.function().args('x')
			}));

			Mock.inst().getValue.ret('mock-value');

			class Child extends Mock {
				getValue(x) {
					const parentResult = super.getValue(x);
					return `child-${parentResult}`;
				}
			}

			const child = new Child();
			const result = child.getValue('test');

			// Child's method should run and wrap the parent's result
			expect(result).to.equal('child-mock-value');
			expect(Mock.inst().getValue.calls(0)).to.deep.equal({ x: 'test' });
		});

		it('will allow child class to call super in constructor', () => {
			const Mock = mocky.create(mocky.class({
				constructor: mocky.function((context) => {
					context.self.mockInitialized = true;
					context.self.mockValue = context.args.value;
				}).args('value'),
				getValue: mocky.function().args('x')
			}));

			Mock.inst().getValue.ret('mock-value');

			class Child extends Mock {
				constructor(value) {
					super(value);
					this.childInitialized = true;
					this.childValue = value * 2;
				}
			}

			const child = new Child(10);

			// Mock constructor should have run
			expect(child.mockInitialized).to.equal(true);
			expect(child.mockValue).to.equal(10);
			expect(Mock.inst().constructor.calls(0)).to.deep.equal({ value: 10 });

			// Child constructor should have run after
			expect(child.childInitialized).to.equal(true);
			expect(child.childValue).to.equal(20);

			// Methods should still work
			expect(child.getValue('test')).to.equal('mock-value');
		});
	});

	describe('spy', () => {
		it('will spy on method and call through to original', () => {
			const obj = {
				greet: function(name) {
					return `Hello, ${name}!`;
				}
			};

			const spy = mocky.spy(obj, 'greet');

			const result = obj.greet('World');

			expect(result).to.equal('Hello, World!');
			expect(spy.calls().length).to.equal(1);
			expect(spy.calls(0)).to.deep.equal(['World']);
		});

		it('will track multiple calls to spied method', () => {
			const obj = {
				add: function(a, b) {
					return a + b;
				}
			};

			const spy = mocky.spy(obj, 'add');

			expect(obj.add(2, 3)).to.equal(5);
			expect(obj.add(10, 20)).to.equal(30);

			expect(spy.calls().length).to.equal(2);
			expect(spy.calls(0)).to.deep.equal([2, 3]);
			expect(spy.calls(1)).to.deep.equal([10, 20]);
		});

		it('will override return value with ret() while still tracking', () => {
			const obj = {
				getValue: function() {
					return 'original';
				}
			};

			const spy = mocky.spy(obj, 'getValue');
			spy.ret('overridden');

			const result = obj.getValue();

			expect(result).to.equal('overridden');
			expect(spy.calls().length).to.equal(1);
		});

		it('will spy with replacement function', () => {
			const obj = {
				calculate: function(x, y) {
					return x * y;
				}
			};

			const spy = mocky.spy(obj, 'calculate', mocky.function().args('x', 'y'));
			spy.ret(100);

			const result = obj.calculate(5, 3);

			expect(result).to.equal(100);
			expect(spy.calls(0)).to.deep.equal({ x: 5, y: 3 });
		});

		it('will restore original method', () => {
			const obj = {
				doThing: function() {
					return 'original';
				}
			};

			const spy = mocky.spy(obj, 'doThing');
			spy.ret('spied');

			expect(obj.doThing()).to.equal('spied');

			spy.restore();

			expect(obj.doThing()).to.equal('original');
		});

		it('will spy on class prototype method', () => {
			class MyClass {
				greet(name) {
					return `Hello, ${name}`;
				}
			}

			const spy = mocky.spy(MyClass.prototype, 'greet');

			const instance = new MyClass();
			const result = instance.greet('Test');

			expect(result).to.equal('Hello, Test');
			expect(spy.calls().length).to.equal(1);
			expect(spy.calls(0)).to.deep.equal(['Test']);

			spy.restore();
		});

		it('will spy with custom replacement body that calls through', () => {
			const obj = {
				multiply: function(a, b) {
					return a * b;
				}
			};

			const original = obj.multiply;
			const spy = mocky.spy(obj, 'multiply', mocky.function((context) => {
				const result = original.apply(context.self, context.rawArgs);
				return result * 2; // Double the result
			}));

			const result = obj.multiply(3, 4);

			expect(result).to.equal(24); // (3 * 4) * 2
			expect(spy.calls().length).to.equal(1);

			spy.restore();
		});

		it('will preserve this context when spying', () => {
			const obj = {
				value: 42,
				getValue: function() {
					return this.value;
				}
			};

			const spy = mocky.spy(obj, 'getValue');

			const result = obj.getValue();

			expect(result).to.equal(42);
			expect(spy.calls().length).to.equal(1);

			spy.restore();
		});

		it('will provide context.original in replacement builder', () => {
			const obj = {
				add: function(a, b) {
					return a + b;
				}
			};

			const spy = mocky.spy(obj, 'add', mocky.function((context) => {
				// Call original and modify result
				const originalResult = context.original.apply(context.self, context.rawArgs);
				return originalResult * 10;
			}).args('x', 'y'));

			const result = obj.add(3, 4);

			expect(result).to.equal(70); // (3 + 4) * 10
			expect(spy.calls(0)).to.deep.equal({ x: 3, y: 4 });

			spy.restore();
		});
	});
});
