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
		it('will reset function state including calls, returns and data', async () => {
			const mock = mocky.create(mocky.function((context) => {
				context.state.data.counter = (context.state.data.counter || 0) + 1;
				return context.ret;
			}).args('arg'));
			mock.ret('test-ret');

			mock('call1');
			mock('call2');

			expect(mock.calls().length).to.equal(2);
			expect(mock.data('counter')).to.equal(2);

			mock.reset();

			expect(mock.calls().length).to.equal(0);
			expect(mock('call3')).to.equal(undefined); // Return values cleared
			expect(mock.data('counter')).to.equal(1); // Restarted from scratch
			expect(mock.data()).to.deep.equal({ counter: 1 });
		});
		it('will provide context with call, args, ret, state and data', async () => {
			const mock = mocky.create(mocky.function((context) => {
				context.state.data.allItems = context.state.data.allItems || [];
				context.state.data.allItems.push(...context.args.items);
				return {
					call: context.call,
					args: context.args,
					ret: context.ret,
					hasState: typeof context.state === 'object',
					hasData: typeof context.state.data === 'object'
				};
			}).args('items'));
			mock.ret('custom-ret');

			const result = mock(['a', 'b']);

			expect(result.call).to.equal(1);
			expect(result.args).to.deep.equal({ items: ['a', 'b'] });
			expect(result.ret).to.equal('custom-ret');
			expect(result.hasState).to.equal(true);
			expect(result.hasData).to.equal(true);

			// Data accumulates across calls
			mock(['c']);
			expect(mock.data('allItems')).to.deep.equal(['a', 'b', 'c']);
		});
		it('will be async function', async () => {
			const mock = mocky.function().args('x').async().build();
			mock.ret('async-result');

			const result = mock('test');

			expect(result).to.be.a('promise');
			expect(await result).to.equal('async-result');
			expect(mock.calls(0)).to.deep.equal({ x: 'test' });
		});
		it('will return different values per call index', () => {
			const mock = mocky.function().build();

			mock.ret('default');
			mock.ret('first', 1);
			mock.ret('second', 2);

			expect(mock()).to.equal('first');
			expect(mock()).to.equal('second');
			expect(mock()).to.equal('default');
			expect(mock()).to.equal('default');
		});
		it('will use onRet handler for return value', () => {
			const mock = mocky.function().args('x', 'y').build();

			mock.onRet((args) => args.x + args.y);

			expect(mock(2, 3)).to.equal(5);
			expect(mock(10, 20)).to.equal(30);
		});
		it('will use onRet handler per call index', () => {
			const mock = mocky.function().args('x').build();

			mock.onRet((args) => args.x * 10);
			mock.onRet((args) => args.x * 100, 1);

			expect(mock(5)).to.equal(500);  // call 1 handler
			expect(mock(5)).to.equal(50);   // default handler
		});
		it('will throw error when ret is an Error', () => {
			const mock = mocky.function().build();

			mock.ret(new Error('test error'));

			expect(() => mock()).to.throw('test error');
			expect(mock.calls().length).to.equal(1);
		});
		it('will provide rawArgs in context', () => {
			const mock = mocky.function((context) => {
				return context.rawArgs;
			}).args('first').build();

			const result = mock('a', 'b', 'c');

			expect(result).to.deep.equal(['a', 'b', 'c']);
		});
		it('will provide original function in context', () => {
			const original = (x) => x * 2;
			const mock = mocky.function((context) => {
				return context.original(context.args.x) + 100;
			}).args('x').original(original).build();

			expect(mock(5)).to.equal(110);  // (5 * 2) + 100
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
		it('will reset all property types to initial values', async () => {
			const mock = mocky.create(mocky.object({
				counter: 42,
				name: 'Alice',
				method: mocky.function(),
				accessor: mocky.property()
			}));

			// Modify all properties
			mock.counter = 100;
			mock.name = 'Bob';
			mock.method.ret('test');
			mock.method();
			mock.accessor = 'value';

			// Add dynamic property
			mock.added = 'new';

			mock.reset();

			// Plain values reset
			expect(mock.counter).to.equal(42);
			expect(mock.name).to.equal('Alice');

			// Methods reset
			expect(mock.method.calls().length).to.equal(0);

			// mocky.property() resets to undefined
			expect(mock.accessor).to.equal(undefined);

			// Dynamic properties deleted
			expect(mock.added).to.equal(undefined);
			expect('added' in mock).to.equal(false);
		});
		it('will support Symbol properties and reset them correctly', async () => {
			const customSymbol = Symbol('custom');
			const addedSymbol = Symbol('added');

			const mock = mocky.create(mocky.object({
				[Symbol.iterator]: mocky.function(),
				[customSymbol]: 'initialValue'
			}));

			// Verify Symbol properties work
			expect(typeof mock[Symbol.iterator]).to.equal('function');
			expect(mock[customSymbol]).to.equal('initialValue');

			// Configure and use Symbol function
			mock[Symbol.iterator].ret('iteratorResult');
			expect(mock[Symbol.iterator]()).to.equal('iteratorResult');
			expect(mock[Symbol.iterator].calls().length).to.equal(1);

			// Modify Symbol value and add dynamic Symbol
			mock[customSymbol] = 'modifiedValue';
			mock[addedSymbol] = 'added';

			// Reset
			mock.reset();

			// Symbol function mock was reset
			expect(mock[Symbol.iterator].calls().length).to.equal(0);
			expect(mock[Symbol.iterator]()).to.equal(undefined);

			// Symbol plain property was restored
			expect(mock[customSymbol]).to.equal('initialValue');

			// Dynamic Symbol property was deleted
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

		it('will store data on description via context.self in constructor', async () => {
			const Counter = mocky.create(mocky.class({
				_count: 0,
				_initialized: false,
				constructor: mocky.function((context) => {
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

		it('will reset plain value properties to initial values', async () => {
			const Mock = mocky.create(mocky.class({
				name: null,
				count: 0
			}));

			// Create and modify instances
			const inst1 = new Mock();
			inst1.name = 'first';
			inst1.count = 10;

			const inst2 = new Mock();
			inst2.name = 'second';
			inst2.count = 20;

			expect(Mock.numInsts()).to.equal(2);
			expect(Mock.inst(0).name).to.equal('first');
			expect(Mock.inst(1).count).to.equal(20);

			// Reset
			Mock.reset();

			expect(Mock.numInsts()).to.equal(0);

			// After reset, descriptions are fresh with initial values
			expect(Mock.inst(0).name).to.equal(null);
			expect(Mock.inst(0).count).to.equal(0);

			// New instance gets initial values
			const inst3 = new Mock();
			expect(inst3.name).to.equal(null);
			expect(inst3.count).to.equal(0);
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

		it('will support class inheritance with super calls', () => {
			const Mock = mocky.create(mocky.class({
				mockInitialized: false,
				mockValue: null,
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
				getValue(x) {
					const parentResult = super.getValue(x);
					return `child-${parentResult}`;
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

			// Child's overridden method calls super and wraps result
			const result = child.getValue('test');
			expect(result).to.equal('child-mock-value');
			expect(Mock.inst().getValue.calls(0)).to.deep.equal({ x: 'test' });
		});

		it('will not expose __mockyInst in deep equal comparisons', () => {
			const Mock = mocky.create(mocky.class({
				name: null,
				constructor: mocky.function((context) => {
					context.self.name = context.args.name;
				}).args('name')
			}));

			const instance = new Mock('test');

			expect(instance).to.deep.equal({ name: 'test' });
		});

		it('will sync plain value members between instance and Mock.inst()', () => {
			const Mock = mocky.create(mocky.class({
				name: null,
				count: 0
			}));

			const inst = new Mock();

			// Initial values from definition
			expect(inst.name).to.equal(null);
			expect(inst.count).to.equal(0);

			// Setting on instance syncs to Mock.inst()
			inst.name = 'test';
			inst.count = 42;
			expect(Mock.inst(0).name).to.equal('test');
			expect(Mock.inst(0).count).to.equal(42);

			// Setting on Mock.inst() syncs to instance
			Mock.inst(0).name = 'changed';
			expect(inst.name).to.equal('changed');
		});

		it('will isolate plain value members between class instances', () => {
			const Mock = mocky.create(mocky.class({
				value: null
			}));

			const inst1 = new Mock();
			const inst2 = new Mock();

			inst1.value = 'first';
			inst2.value = 'second';

			expect(inst1.value).to.equal('first');
			expect(inst2.value).to.equal('second');
			expect(Mock.inst(0).value).to.equal('first');
			expect(Mock.inst(1).value).to.equal('second');
		});

		it('will allow pre-configuring plain value members before instantiation', () => {
			const Mock = mocky.create(mocky.class({
				config: null
			}));

			// Pre-configure before instantiation
			Mock.inst(0).config = 'preset-value';

			const inst = new Mock();
			expect(inst.config).to.equal('preset-value');
		});

		it('will support mixing plain values and methods in class', () => {
			const Mock = mocky.create(mocky.class({
				name: null,
				greet: mocky.function().args('greeting')
			}));

			Mock.inst().greet.ret('Hello!');

			const inst = new Mock();
			inst.name = 'World';

			expect(inst.name).to.equal('World');
			expect(Mock.inst(0).name).to.equal('World');
			expect(inst.greet('Hi')).to.equal('Hello!');
			expect(Mock.inst().greet.calls(0)).to.deep.equal({ greeting: 'Hi' });
		});

		it('will support nested objects with methods', () => {
			const Mock = mocky.create(mocky.class({
				db: mocky.object({
					query: mocky.function().args('sql'),
					close: mocky.function()
				})
			}));

			Mock.inst(0).db.query.ret({ rows: ['a', 'b'] });
			Mock.inst(0).db.close.ret(true);

			const inst = new Mock();

			expect(inst.db.query('SELECT *')).to.deep.equal({ rows: ['a', 'b'] });
			expect(inst.db.close()).to.equal(true);
			expect(Mock.inst(0).db.query.calls(0)).to.deep.equal({ sql: 'SELECT *' });
		});

		it('will access mock helpers directly on instance methods', () => {
			const Mock = mocky.create(mocky.class({
				run: mocky.function().args('arg')
			}));

			const inst = new Mock();

			// Configure via instance
			inst.run.ret('test-ret');
			expect(inst.run('hello')).to.equal('test-ret');

			// Access calls via instance
			expect(inst.run.calls(0)).to.deep.equal({ arg: 'hello' });
			expect(inst.run.calls().length).to.equal(1);

			// Reset via instance
			inst.run.reset();
			expect(inst.run.calls().length).to.equal(0);
		});
	});

	describe('static', () => {
		it('will support static methods on class mocks', () => {
			const Mock = mocky.cls({
				staticMethod: mocky.fn().args('x').static(),
				instanceMethod: mocky.fn().args('y'),
			}).build();

			Mock.staticMethod('test');
			expect(Mock.staticMethod.calls(0)).to.deep.equal({ x: 'test' });
		});
		it('will not expose static methods on instances', () => {
			const Mock = mocky.cls({
				staticMethod: mocky.fn().static(),
				instanceMethod: mocky.fn(),
			}).build();

			const inst = new Mock();
			expect(inst.staticMethod).to.equal(undefined);
			expect(typeof inst.instanceMethod).to.equal('function');
		});
		it('will reset static methods on class reset', () => {
			const Mock = mocky.cls({
				staticMethod: mocky.fn().args('x').static(),
			}).build();

			Mock.staticMethod.ret('value');
			Mock.staticMethod('test');
			expect(Mock.staticMethod.calls().length).to.equal(1);

			Mock.reset();
			expect(Mock.staticMethod.calls().length).to.equal(0);
			expect(Mock.staticMethod('test')).to.equal(undefined);
		});
		it('will support ret and throw on static methods', () => {
			const Mock = mocky.cls({
				getValue: mocky.fn().static(),
				getError: mocky.fn().static(),
			}).build();

			Mock.getValue.ret('static-value');
			expect(Mock.getValue()).to.equal('static-value');

			Mock.getError.throw(new Error('static-error'));
			expect(() => Mock.getError()).to.throw('static-error');
		});
	});

	describe('ctx.self', () => {
		it('will provide mock object as ctx.self for object mocks', () => {
			const mock = mocky.obj({
				setHandler: mocky.fn((ctx) => {
					ctx.self.handler = ctx.args.fn;
				}).args('fn'),
			}).build();

			const handler = () => 'handled';
			mock.setHandler(handler);

			expect(mock.handler).to.equal(handler);
		});
		it('will provide description as ctx.self for class mocks', () => {
			const Mock = mocky.cls({
				setHandler: mocky.fn((ctx) => {
					ctx.self.handler = ctx.args.fn;
				}).args('fn'),
			}).build();

			const inst = new Mock();
			const handler = () => 'handled';
			inst.setHandler(handler);

			// handler should be on the description, accessible via inst()
			expect(Mock.inst(0).handler).to.equal(handler);
		});
		it('will clean up ctx.self properties on object reset', () => {
			const mock = mocky.obj({
				setHandler: mocky.fn((ctx) => {
					ctx.self.handler = ctx.args.fn;
				}).args('fn'),
			}).build();

			mock.setHandler(() => 'handled');
			expect(mock.handler).to.be.a('function');

			mock.reset();
			expect(mock.handler).to.equal(undefined);
		});
		it('will clean up ctx.self properties on class reset', () => {
			const Mock = mocky.cls({
				setHandler: mocky.fn((ctx) => {
					ctx.self.handler = ctx.args.fn;
				}).args('fn'),
			}).build();

			const inst = new Mock();
			inst.setHandler(() => 'handled');
			expect(Mock.inst(0).handler).to.be.a('function');

			Mock.reset();
			// descriptions cleared entirely
			expect(Mock.inst(0).handler).to.equal(undefined);
		});
	});

	describe('ctx.data', () => {
		it('will provide ctx.data as direct access to state data', () => {
			const mock = mocky.fn((ctx) => {
				ctx.data.count = (ctx.data.count || 0) + 1;
				return ctx.data.count;
			}).build();

			expect(mock()).to.equal(1);
			expect(mock()).to.equal(2);
			expect(mock.data('count')).to.equal(2);
		});
		it('will clear ctx.data on reset', () => {
			const mock = mocky.fn((ctx) => {
				ctx.data.value = 'set';
			}).build();

			mock();
			expect(mock.data('value')).to.equal('set');

			mock.reset();
			mock();
			expect(mock.data('value')).to.equal('set');
			expect(mock.data()).to.deep.equal({ value: 'set' });
		});
	});

	describe('ret on builder', () => {
		it('will set return value on builder before build()', () => {
			const mock = mocky.fn().ret('pre-configured').build();
			expect(mock()).to.equal('pre-configured');
		});
		it('will set per-call return value on builder', () => {
			const mock = mocky.fn().ret('default').ret('first', 1).build();
			expect(mock()).to.equal('first');
			expect(mock()).to.equal('default');
		});
		it('will allow ret() override after build()', () => {
			const mock = mocky.fn().ret('builder-value').build();
			mock.ret('override');
			expect(mock()).to.equal('override');
		});
		it('will restore builder ret values on reset', () => {
			const mock = mocky.fn().ret('builder-value').build();
			mock.ret('override');
			mock.reset();
			expect(mock()).to.equal('builder-value');
		});
	});

	describe('throw', () => {
		it('will throw an Error via mock.throw()', () => {
			const mock = mocky.function().build();
			mock.throw(new Error('thrown'));

			expect(() => mock()).to.throw('thrown');
			expect(mock.calls().length).to.equal(1);
		});
		it('will throw a non-Error value via mock.throw()', () => {
			const mock = mocky.function().build();
			mock.throw('string error');

			expect(() => mock()).to.throw('string error');
		});
		it('will throw on specific call index', () => {
			const mock = mocky.function().build();
			mock.ret('default');
			mock.throw(new Error('first call'), 1);

			expect(() => mock()).to.throw('first call');
			expect(mock()).to.equal('default');
		});
		it('will clear throw on reset', () => {
			const mock = mocky.function().build();
			mock.throw(new Error('thrown'));

			expect(() => mock()).to.throw('thrown');

			mock.reset();
			expect(mock()).to.equal(undefined);
		});
	});

	describe('synonyms', () => {
		it('will use mocky.fn() as synonym for mocky.function()', () => {
			const mock = mocky.fn().args('x').build();
			mock.ret('result');

			expect(mock(1)).to.equal('result');
			expect(mock.calls(0)).to.deep.equal({ x: 1 });
		});
		it('will use mocky.obj() as synonym for mocky.object()', () => {
			const mock = mocky.obj({
				run: mocky.fn().args('arg')
			}).build();

			mock.run.ret('test');
			expect(mock.run('hello')).to.equal('test');
			expect(mock.run.calls(0)).to.deep.equal({ arg: 'hello' });
		});
		it('will use mocky.cls() as synonym for mocky.class()', () => {
			const Mock = mocky.cls({
				method: mocky.fn().args('x')
			}).build();

			Mock.inst().method.ret('value');
			const inst = new Mock();
			expect(inst.method('test')).to.equal('value');
		});
		it('will use Mock.instance() as synonym for Mock.inst()', () => {
			const Mock = mocky.class({
				method: mocky.function().args('x')
			}).build();

			Mock.instance().method.ret('value');
			const inst = new Mock();
			expect(inst.method('test')).to.equal('value');
			expect(Mock.instance(0).method.calls(0)).to.deep.equal({ x: 'test' });
		});
		it('will use .pick() as synonym for .argSelect()', () => {
			const mock = mocky.function().pick(1).build();
			mock.ret('result');

			mock('first', { test: 'data' }, 'third');
			expect(mock.calls(0)).to.deep.equal({ test: 'data' });
		});
	});

	describe('spy', () => {
		it('will spy on method, call through, track calls and preserve this', () => {
			const obj = {
				value: 42,
				greet: function(name) {
					return `Hello, ${name}!`;
				},
				getValue: function() {
					return this.value;
				}
			};

			const greetSpy = mocky.spy(obj, 'greet');
			const valueSpy = mocky.spy(obj, 'getValue');

			// Calls through to original
			expect(obj.greet('World')).to.equal('Hello, World!');
			expect(obj.greet('Test')).to.equal('Hello, Test!');

			// Tracks multiple calls
			expect(greetSpy.calls().length).to.equal(2);
			expect(greetSpy.calls(0)).to.deep.equal(['World']);
			expect(greetSpy.calls(1)).to.deep.equal(['Test']);

			// Preserves this context
			expect(obj.getValue()).to.equal(42);
			expect(valueSpy.calls().length).to.equal(1);

			greetSpy.restore();
			valueSpy.restore();
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

		it('will spy with plain function replacement and args', () => {
			const obj = {
				add: function(a, b) {
					return a + b;
				}
			};

			const spy = mocky.spy(obj, 'add', (ctx) => {
				return ctx.original.apply(ctx.self, ctx.rawArgs) * 10;
			}, ['x', 'y']);

			const result = obj.add(3, 4);

			expect(result).to.equal(70);
			expect(spy.calls(0)).to.deep.equal({ x: 3, y: 4 });

			spy.restore();
		});
		it('will spy with plain function replacement without args', () => {
			const obj = {
				getValue: function() { return 42; }
			};

			const spy = mocky.spy(obj, 'getValue', (ctx) => {
				return ctx.original.apply(ctx.self, ctx.rawArgs) + 1;
			});

			expect(obj.getValue()).to.equal(43);
			expect(spy.calls().length).to.equal(1);

			spy.restore();
		});
		it('will spy with replacement function and provide context.original', () => {
			const obj = {
				add: function(a, b) {
					return a + b;
				}
			};

			// Replacement with args and context.original
			const spy = mocky.spy(obj, 'add', mocky.function((context) => {
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
