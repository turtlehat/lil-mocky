const { expect } = require('chai');
const mocky = require('../src/lil-mocky.js');


describe('lil-mocky', () => {
	describe('function', () => {
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
		// it('will be object with property', async () => {
		// 	const mock = mocky.create(mocky.object({
		// 		accessor: mocky.property()
		// 	}));
		// 	mock.accessor = 'testValue';
		// });
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
	});
});
