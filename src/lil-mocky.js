const THROW_MARKER = Symbol('mockyThrow');

function mockBuilder(builder) {
	return builder.build();
}

function functionBuilder(body) {
	const options = {
		async: false,
		body: body,
		args: [],
		select: [],
		original: undefined,
		defaultRet: { has: false, value: undefined },
		rets: new Map()
	};

	return {
		__mockyFunction: true,
		async: function() {
			options.async = true;
			return this;
		},
		args: function(...args) {
			options.args = args;
			return this;
		},
		pick: function(...indexes) {
			options.select = indexes;
			return this;
		},
		original: function(fn) {
			options.original = fn;
			return this;
		},
		static: function() {
			this.__mockyStatic = true;
			return this;
		},
		ret: function(value, ...rest) {
			if (rest.length === 0) {
				options.defaultRet = { has: true, value };
			} else {
				options.rets.set(rest[0], value);
			}
			return this;
		},
		build: function(parent, key) {
			const state = { parent };
			const mock = createFunction(state, options);

			if (parent)
				Object.defineProperty(parent, key, { value: mock });

			return wireFunction(parent ? parent[key] : mock, state, options);
		}
	};
}

function wireFunction(mock, state, options = {}) {
	mock.ret = (value, ...rest) => {
		if (rest.length === 0) {
			state.defaultRet = { has: true, value };
		} else {
			state.rets.set(rest[0], value);
		}
	};
	mock.throw = (error, ...rest) => {
		const wrapped = { [THROW_MARKER]: true, error };
		if (rest.length === 0) {
			state.defaultRet = { has: true, value: wrapped };
		} else {
			state.rets.set(rest[0], wrapped);
		}
	};
	Object.defineProperty(mock, 'calls', { get: () => state.calls, configurable: true });
	mock.reset = () => {
		state.defaultRet = { ...options.defaultRet };
		state.rets = new Map(options.rets);
		state.calls = [];
		state.data = {};
		mock.data = state.data;
	};
	mock.reset();

	return mock;
}

function createFunction(state, options) {
	if (options.async) {
		return async function() {
			return getFunctionBody(this, state, options, Array.from(arguments));
		};
	} else {
		return function() {
			return getFunctionBody(this, state, options, Array.from(arguments));
		};
	}
}

function getFunctionBody(parent, state, options, rawArgs) {
	const args = deepClone(getFunctionArgs(rawArgs, options));
	state.calls.push(args);
	const call = state.calls.length - 1;

	let ret;

	if (state.rets.has(call)) {
		ret = state.rets.get(call);
	} else if (state.defaultRet.has) {
		ret = state.defaultRet.value;
	}

	if (ret?.[THROW_MARKER])
		throw ret.error;

	if (options.body) {
		return options.body({
			self: state.parent || parent,
			data: state.data,
			call: call,
			args: args,
			rawArgs: rawArgs,
			original: options.original,
			ret: ret
		});
	} else {
		return ret;
	}
}

function getFunctionArgs(callArgs, options) {
	let args = null;

	if (options.select.length == 1) {
		args = callArgs[options.select[0]];
	} else if (options.args.length) {
		args = {};

		for (let i = 0; i < options.args.length; i++) {
			if (options.select.length && !options.select.includes(i))
				continue;

			let argName = '';
			let defaultValue = undefined;

			if (typeof options.args[i] == 'string') {
				argName = options.args[i];
			} else {
				[argName, defaultValue] = Object.entries(options.args[i])[0];
			}

			args[argName] = callArgs[i] !== undefined ? callArgs[i] : defaultValue;
		}
	} else {
		args = Array.from(callArgs);
	}

	return args;
}

function objectBuilder(props) {
	const options = { props };

	return {
		__mockyObject: true,
		build: function(parent, key) {
			const mock = createObjectWithProps(options.props);

			if (parent)
				Object.defineProperty(parent, key, { value: mock });

			return wireObject(parent ? parent[key] : mock, props);
		}
	};
}

function wireObject(mock, initialProps) {
	const initialMocks = new Set();
	const initialValues = new Map();

	for (const key of Reflect.ownKeys(initialProps)) {
		const prop = initialProps[key];
		if (typeof prop?.build === 'function') {
			initialMocks.add(key);
		} else {
			initialValues.set(key, prop);
		}
	}

	mock.reset = () => {
		for (const key of Reflect.ownKeys(mock)) {
			if (key === 'reset') continue;

			if (initialMocks.has(key)) {
				if (typeof mock[key]?.reset === 'function')
					mock[key].reset();
			} else if (initialValues.has(key)) {
				mock[key] = initialValues.get(key);
			} else {
				delete mock[key];
			}
		}
	};

	return mock;
}

function createObjectWithProps(props) {
	const object = {};

	for (const key of Reflect.ownKeys(props)) {
		const prop = props[key];

		if (typeof prop?.build == 'function') {
			prop.build(object, key);
		} else {
			object[key] = prop;
		}
	}

	return object;
}

function classBuilder(members) {
	const options = { members };

	return {
		__mockyClass: true,
		build: function(parent, key) {
			const state = {};
			const Mock = createClass(state, options);

			if (parent)
				Object.defineProperty(parent, key, { value: Mock });

			return wireClass(parent ? parent[key] : Mock, state, options);
		}
	};
}

function createClass(state, options) {
	const Mock = function() {
		const index = state.numInstances;

		if (!state.descriptions[index])
			state.descriptions[index] = createObjectWithProps(options.members);

		Object.defineProperty(this, '__mockyInst', { value: index });

		if (typeof state.descriptions[index].constructor === 'function')
			state.descriptions[index].constructor.call(this, ...arguments);

		state.numInstances++;
	};

	state.statics = [];

	for (const key of Reflect.ownKeys(options.members)) {
		if (key === 'constructor')
			continue;

		const member = options.members[key];

		if (member?.__mockyStatic) {
			member.build(Mock, key);
			state.statics.push(key);
			continue;
		}

		Object.defineProperty(Mock.prototype, key, {
			get: function() {
				return state.descriptions[this.__mockyInst][key];
			},
			set: function(value) {
				state.descriptions[this.__mockyInst][key] = value;
			},
			enumerable: true,
			configurable: true
		});
	}

	return Mock;
}

function wireClass(Mock, state, options) {
	Mock.instance = Mock.inst = (index = 0) => {
		if (!state.descriptions[index])
			state.descriptions[index] = createObjectWithProps(options.members);

		return state.descriptions[index];
	};
	Object.defineProperty(Mock, 'instCount', { get: () => state.numInstances, configurable: true });
	Object.defineProperty(Mock, 'instanceCount', { get: () => state.numInstances, configurable: true });
	Mock.reset = () => {
		state.descriptions = [];
		state.numInstances = 0;
		state.data = {};
		for (const key of state.statics) {
			if (typeof Mock[key]?.reset === 'function')
				Mock[key].reset();
		}
	};
	Mock.reset();

	return Mock;
}

function deepClone(target) {
	if (typeof target === 'object') {
		if (Array.isArray(target)) {
			return target.map(deepClone);
		} else if (target?.constructor === Object) {
			const clone = {};

			for (const key of Reflect.ownKeys(target)) {
				clone[key] = deepClone(target[key]);
			}

			return clone;
		}
	}

	return target;
}

function createSpy(object, key, replacement, argNames) {
	if (typeof replacement === 'function' && !replacement.__mockyFunction) {
		const body = replacement;
		replacement = functionBuilder(body);
		if (argNames) replacement = replacement.args(...argNames);
	}

	if (!replacement) {
		replacement = functionBuilder((ctx) => {
			if (ctx.ret !== undefined)
				return ctx.ret;

			return ctx.original.apply(ctx.self, ctx.rawArgs);
		});
	}

	const original = object[key];
	const spyFn = replacement.original(original).build();
	spyFn.restore = () => {
		object[key] = original;
	};
	object[key] = spyFn;

	return spyFn;
}

module.exports = {
	spy: createSpy,
	create: mockBuilder,
	function: functionBuilder,
	fn: functionBuilder,
	object: objectBuilder,
	obj: objectBuilder,
	class: classBuilder,
	cls: classBuilder,
};
