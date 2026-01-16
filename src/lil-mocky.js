function mockBuilder(builder) {
	return builder.build();
}

function functionBuilder(body) {
	const options = {
		async: false,
		body: body,
		args: [],
		select: [],
		original: undefined
	};

	return {
		async: function() {
			options.async = true;
			return this;
		},
		args: function(...args) {
			options.args = args;
			return this;
		},
		argSelect: function(...indexes) {
			options.select = indexes;
			return this;
		},
		original: function(fn) {
			options.original = fn;
			return this;
		},
		build: function(parent, key) {
			const state = {};
			const mock = createFunction(state, options);

			if (parent)
				Object.defineProperty(parent, key, { value: mock });

			return wireFunction(parent ? parent[key] : mock, state);
		}
	};
}

function wireFunction(mock, state) {
	mock.ret = (value, call = 0) => {
		state.rets[call] = value;
	};
	mock.onRet = (handler, call = 0) => {
		state.retHandlers[call] = handler;
	};
	mock.calls = (call) => {
		return call !== undefined ? state.calls[call] : state.calls;
	}
	mock.reset = () => {
		state.rets = [];
		state.retHandlers = [];
		state.calls = [];
		state.data = {};
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
	const call = state.calls.length;

	let ret;

	if (state.rets[call]) {
		ret = state.rets[call];
	} else if (state.retHandlers[call]) {
		ret = state.retHandlers[call](args);
	} else if (state.rets[0]) {
		ret = state.rets[0];
	} else if (state.retHandlers[0]) {
		ret = state.retHandlers[0](args);
	}

	if (ret instanceof Error)
		throw ret;

	if (options.body) {
		return options.body({
			self: parent,
			state: state,
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
		// NOTE: Previously returned null. Now returns array (may break backwards compatibility).
		args = Array.from(callArgs);
	}

	return args;
}

function objectBuilder(props) {
	const options = { props };

	return {
		build: function(parent, key) {
			const mock = createObjectWithProps(options.props);

			if (parent)
				Object.defineProperty(parent, key, { value: mock });
			
			return wireObject(parent ? parent[key] : mock);
		}
	};
}

function wireObject(mock) {
	mock.reset = () => {
		for (const key of Object.getOwnPropertyNames(mock)) {
			if (typeof mock[key].reset == 'function')
				mock[key].reset();
		}
	};

	return mock;
}

function createObjectWithProps(props) {
	const object = {};

	for (const key in props) {
		const prop = props[key];

		if (typeof prop.build == 'function') {
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
	return function() {
		const index = state.numInstances;

		if (!state.descriptions[index])
			state.descriptions[index] = createObjectWithProps(options.members);

		Object.defineProperties(this, Object.getOwnPropertyDescriptors(state.descriptions[index]));

		if (typeof state.descriptions[index].constructor === 'function')
			state.descriptions[index].constructor.call(this, ...arguments);

		state.numInstances++;
	};
}

function wireClass(Mock, state, options) {
	Mock.inst = (index = 0) => {
		if (!state.descriptions[index])
			state.descriptions[index] = createObjectWithProps(options.members);

		return state.descriptions[index];
	};
	Mock.numInsts = () => {
		return state.numInstances;
	};
	Mock.reset = () => {
		state.descriptions = [];
		state.numInstances = 0;
		state.data = {};
	};
	Mock.reset();

	return Mock;
}

function propertyBuilder() {
	return {
		build: function(parent, key) {
			const state = {};

			if (parent) {
				parent[key] = {};
				wireProperty(parent[key], state);
				Object.defineProperty(parent, key, {
					get: () => {
						return state.value;
					},
					set: (value) => {
						state.value = value;
					}
				});
			}
		}
	};
}

function wireProperty(mock, state) {
	mock.reset = () => {
		state.value = undefined;
	};

	return mock;
}

function deepClone(target) {
	if (typeof target === 'object') {
		if (Array.isArray(target)) {
			return target.map(deepClone);
		} else if (target?.constructor === Object) {
			const clone = {};

			for (const key in target) {
				clone[key] = deepClone(target[key]);
			}

			return clone;
		}
	}

	return target;
}

function createSpy(object, key, replacement) {
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
	object: objectBuilder,
	class: classBuilder,
	property: propertyBuilder,
};
