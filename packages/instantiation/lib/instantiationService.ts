import { SyncDescriptor } from "./descriptors";
import { Graph } from "./graph";
import {
	IInstantiationService,
	ServiceIdentifier,
	ServicesAccessor,
	_util,
} from "./instantiation";
import { ServiceCollection } from "./serviceCollection";

const _enableAllTracing = true;

export class InstantiationService implements IInstantiationService {
	readonly _serviceBrand: undefined;

	constructor(
		private readonly _services = new ServiceCollection(),
		private readonly _strict = false,
		private readonly _parent?: InstantiationService,
		private readonly _enableTracing = _enableAllTracing
	) {
		this._services.set(IInstantiationService, this);
	}

	invokeFunction<R, TS extends any[] = []>(
		fn: (accessor: ServicesAccessor, ...args: TS) => R,
		...args: TS
	): R {
		const _trace = Trace.traceInvocation(this._enableTracing, fn);

		try {
			const accessor: ServicesAccessor = {
				get: <T>(id: ServiceIdentifier<T>) => {
					const result = this._getOrCreateServiceInstance(id, _trace);
					if (!result) {
						throw new Error(`[invokeFunction] unknown service '${id}'`);
					}
					return result;
				},
			};
			return fn(accessor, ...args);
		} finally {
			_trace.stop();
			console.log(Trace.all);
		}
	}

	private _createInstance<T>(ctor: any, args: any[] = [], _trace: Trace): T {
		// arguments defined by service decorators
		const serviceDependencies = _util
			.getServiceDependencies(ctor)
			.sort((a, b) => a.index - b.index);
		const serviceArgs: any[] = [];
		for (const dependency of serviceDependencies) {
			const service = this._getOrCreateServiceInstance(dependency.id, _trace);
			if (!service) {
				// this._throwIfStrict(`[createInstance] ${ctor.name} depends on UNKNOWN service ${dependency.id}.`, false);
			}
			serviceArgs.push(service);
		}

		const firstServiceArgPos =
			serviceDependencies.length > 0
				? serviceDependencies[0].index
				: args.length;

		// check for argument mismatches, adjust static args if needed
		if (args.length !== firstServiceArgPos) {
			console.trace(
				`[createInstance] First service dependency of ${
					ctor.name
				} at position ${firstServiceArgPos + 1} conflicts with ${
					args.length
				} static arguments`
			);

			const delta = firstServiceArgPos - args.length;
			if (delta > 0) {
				args = args.concat(new Array(delta));
			} else {
				args = args.slice(0, firstServiceArgPos);
			}
		}

		// now create the instance
		return Reflect.construct<any, T>(ctor, args.concat(serviceArgs));
	}

	private _setServiceInstance<T>(id: ServiceIdentifier<T>, instance: T): void {
		if (this._services.get(id) instanceof SyncDescriptor) {
			this._services.set(id, instance);
		} else if (this._parent) {
			this._parent._setServiceInstance(id, instance);
		} else {
			throw new Error("illegalState - setting UNKNOWN service instance");
		}
	}

	private _getServiceInstanceOrDescriptor<T>(
		id: ServiceIdentifier<T>
	): T | SyncDescriptor<T> {
		const instanceOrDesc = this._services.get(id);
		if (!instanceOrDesc && this._parent) {
			return this._parent._getServiceInstanceOrDescriptor(id);
		} else {
			return instanceOrDesc;
		}
	}

	protected _getOrCreateServiceInstance<T>(
		id: ServiceIdentifier<T>,
		_trace: Trace
	): T {
		const thing = this._getServiceInstanceOrDescriptor(id);

		if (thing instanceof SyncDescriptor) {
			return this._safeCreateAndCacheServiceInstance(
				id,
				thing,
				_trace.branch(id, true)
			);
		} else {
			_trace.branch(id, false);
			return thing;
		}
	}

	private readonly _activeInstantiations = new Set<ServiceIdentifier<any>>();

	private _safeCreateAndCacheServiceInstance<T>(
		id: ServiceIdentifier<T>,
		desc: SyncDescriptor<T>,
		_trace: Trace
	): T {
		if (this._activeInstantiations.has(id)) {
			throw new Error(
				`illegal state - RECURSIVELY instantiating service '${id}'`
			);
		}

		this._activeInstantiations.add(id);

		try {
			return this._createAndCacheServiceInstance(id, desc, _trace);
		} finally {
			this._activeInstantiations.delete(id);
		}
	}

	private _createAndCacheServiceInstance<T>(
		id: ServiceIdentifier<T>,
		desc: SyncDescriptor<T>,
		_trace: Trace
	): T {
		type Triple = {
			id: ServiceIdentifier<any>;
			desc: SyncDescriptor<any>;
			_trace: Trace;
		};
		const graph = new Graph<Triple>((data) => data.id.toString());

		let cycleCount = 0;

		const stack = [{ id, desc, _trace }];

		while (stack.length) {
			const item = stack.pop()!;
			graph.lookupOrInsertNode(item);

			if (cycleCount++ > 1000) {
				throw new Error(`cycle detected`);
			}

			for (const dependency of _util.getServiceDependencies(item.desc.ctor)) {
				const instanceOrDesc = this._getServiceInstanceOrDescriptor(
					dependency.id
				);

				if (!instanceOrDesc) {
					throw new Error(
						`[createInstance] ${item.id} depends on ${dependency.id} which is NOT registered.`
					);
				}

				if (instanceOrDesc instanceof SyncDescriptor) {
					const d = {
						id: dependency.id,
						desc: instanceOrDesc,
						_trace: item._trace.branch(dependency.id, true),
					};
					graph.insertEdge(item, d);
					stack.push(d);
				}
			}
		}

		while (true) {
			const roots = graph.roots();

			if (roots.length === 0) {
				if (!graph.isEmpty()) {
					throw new Error(
						`Cannot resolve cyclic dependency between ${graph.toString()}`
					);
				}

				break;
			}

			for (const { data } of roots) {
				const instanceOrDesc = this._getServiceInstanceOrDescriptor(data.id);

				if (instanceOrDesc instanceof SyncDescriptor) {
					const instance = this._createServiceInstanceWithOwner(
						data.id,
						data.desc.ctor,
						data.desc.staticArguments,
						data.desc.supportsDelayedInstantiation,
						data._trace
					);
					this._setServiceInstance(data.id, instance);
				}

				graph.removeNode(data);
			}
		}

		return <T>this._getServiceInstanceOrDescriptor(id);
	}

	private _createServiceInstanceWithOwner<T>(
		id: ServiceIdentifier<T>,
		ctor: any,
		args: any[] = [],
		supportsDelayedInstantiation: boolean,
		_trace: Trace
	): T {
		if (this._services.get(id) instanceof SyncDescriptor) {
			return this._createServiceInstance(
				id,
				ctor,
				args,
				supportsDelayedInstantiation,
				_trace
			);
		} else if (this._parent) {
			return this._parent._createServiceInstanceWithOwner(
				id,
				ctor,
				args,
				supportsDelayedInstantiation,
				_trace
			);
		} else {
			throw new Error(
				`illegalState - creating UNKNOWN service instance ${ctor.name}`
			);
		}
	}

	private _createServiceInstance<T>(
		id: ServiceIdentifier<T>,
		ctor: any,
		args: any[] = [],
		supportsDelayedInstantiation: boolean,
		_trace: Trace
	): T {
		if (!supportsDelayedInstantiation) {
			// eager instantiation
			return this._createInstance(ctor, args, _trace);
		} else {
			const child = new InstantiationService(undefined, this._strict, this);
			return <T>new Proxy(Object.create(null), {
				get(target: any, key: PropertyKey): any {},
				set(_target: T, p: PropertyKey, value: any): boolean {
					return true;
				},
				getPrototypeOf(_target: T) {
					return ctor.prototype;
				},
			});
		}
	}
}

const enum TraceType {
	None = 0,
	Creation = 1,
	Invocation = 2,
	Branch = 3,
}

export class Trace {
	static all = new Set<string>();

	private static readonly _None = new (class extends Trace {
		constructor() {
			super(TraceType.None, null);
		}
		override stop() {}
		override branch() {
			return this;
		}
	})();

	static traceInvocation(_enableTracing: boolean, ctor: any): Trace {
		return !_enableTracing
			? Trace._None
			: new Trace(
					TraceType.Invocation,
					ctor.name || new Error().stack!.split("\n").slice(3, 4).join("\n")
			  );
	}

	static traceCreation(_enableTracing: boolean, ctor: any): Trace {
		return !_enableTracing
			? Trace._None
			: new Trace(TraceType.Creation, ctor.name);
	}

	private static _totals: number = 0;
	private readonly _start: number = Date.now();
	private readonly _dep: [ServiceIdentifier<any>, boolean, Trace?][] = [];

	private constructor(readonly type: TraceType, readonly name: string | null) {}

	branch(id: ServiceIdentifier<any>, first: boolean): Trace {
		const child = new Trace(TraceType.Branch, id.toString());
		this._dep.push([id, first, child]);
		return child;
	}

	stop() {
		const dur = Date.now() - this._start;
		Trace._totals += dur;

		let causedCreation = false;

		function printChild(n: number, trace: Trace) {
			const res: string[] = [];
			const prefix = new Array(n + 1).join("\t");
			for (const [id, first, child] of trace._dep) {
				if (first && child) {
					causedCreation = true;
					res.push(`${prefix}CREATES -> ${id}`);
					const nested = printChild(n + 1, child);
					if (nested) {
						res.push(nested);
					}
				} else {
					res.push(`${prefix}uses -> ${id}`);
				}
			}
			return res.join("\n");
		}

		const lines = [
			`${this.type === TraceType.Creation ? "CREATE" : "CALL"} ${this.name}`,
			`${printChild(1, this)}`,
			`DONE, took ${dur.toFixed(2)}ms (grand total ${Trace._totals.toFixed(
				2
			)}ms)`,
		];

		if (dur > 2 || causedCreation) {
			Trace.all.add(lines.join("\n"));
		}
	}
}
