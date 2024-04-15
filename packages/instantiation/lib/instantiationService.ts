import { SyncDescriptor, SyncDescriptor0 } from "./descriptors";
import { Graph } from "./graph";
import {
	GetLeadingNonServiceArgs,
	IInstantiationService,
	ServiceIdentifier,
	ServicesAccessor,
	_util,
} from "./instantiation";
import { ServiceCollection } from "./serviceCollection";

export class InstantiationService implements IInstantiationService {
	readonly _serviceBrand: undefined;

	private readonly _children = new Set<InstantiationService>();

	constructor(
		private readonly _services = new ServiceCollection(),
		private readonly _strict = false,
		private readonly _parent?: InstantiationService
	) {
		this._services.set(IInstantiationService, this);
	}

	createChild(services: ServiceCollection): IInstantiationService {
		const result = new (class extends InstantiationService {})(
			services,
			this._strict,
			this
		);
		this._children.add(result);
		return result;
	}

	invokeFunction<R, TS extends any[] = []>(
		fn: (accessor: ServicesAccessor, ...args: TS) => R,
		...args: TS
	): R {
		try {
			const accessor: ServicesAccessor = {
				get: <T>(id: ServiceIdentifier<T>) => {
					const result = this._getOrCreateServiceInstance(id);
					if (!result) {
						throw new Error(`[invokeFunction] unknown service '${id}'`);
					}
					return result;
				},
			};
			return fn(accessor, ...args);
		} finally {
			console.log("invokeFunction finally");
		}
	}

	createInstance<T>(descriptor: SyncDescriptor0<T>): T;
	createInstance<
		Ctor extends new (...args: any[]) => any,
		R extends InstanceType<Ctor>
	>(
		ctor: Ctor,
		...args: GetLeadingNonServiceArgs<ConstructorParameters<Ctor>>
	): R;
	createInstance(
		ctorOrDescriptor: any | SyncDescriptor<any>,
		...rest: any[]
	): any {
		let result: any;
		if (ctorOrDescriptor instanceof SyncDescriptor) {
			result = this._createInstance(
				ctorOrDescriptor.ctor,
				ctorOrDescriptor.staticArguments.concat(rest)
			);
		} else {
			result = this._createInstance(ctorOrDescriptor, rest);
		}
		return result;
	}

	private _createInstance<T>(ctor: any, args: any[] = []): T {
		// arguments defined by service decorators
		const serviceDependencies = _util
			.getServiceDependencies(ctor)
			.sort((a, b) => a.index - b.index);
		const serviceArgs: any[] = [];
		for (const dependency of serviceDependencies) {
			const service = this._getOrCreateServiceInstance(dependency.id);
			if (!service) {
				throw new Error(
					`[createInstance] ${ctor.name} depends on UNKNOWN service ${dependency.id}.`
				);
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

	protected _getOrCreateServiceInstance<T>(id: ServiceIdentifier<T>): T {
		const thing = this._getServiceInstanceOrDescriptor(id);

		if (thing instanceof SyncDescriptor) {
			return this._safeCreateAndCacheServiceInstance(id, thing);
		} else {
			return thing;
		}
	}

	private readonly _activeInstantiations = new Set<ServiceIdentifier<any>>();

	private _safeCreateAndCacheServiceInstance<T>(
		id: ServiceIdentifier<T>,
		desc: SyncDescriptor<T>
	): T {
		if (this._activeInstantiations.has(id)) {
			throw new Error(
				`illegal state - RECURSIVELY instantiating service '${id}'`
			);
		}

		this._activeInstantiations.add(id);

		try {
			return this._createAndCacheServiceInstance(id, desc);
		} finally {
			this._activeInstantiations.delete(id);
		}
	}

	private _createAndCacheServiceInstance<T>(
		id: ServiceIdentifier<T>,
		desc: SyncDescriptor<T>
	): T {
		type Triple = {
			id: ServiceIdentifier<any>;
			desc: SyncDescriptor<any>;
		};
		const graph = new Graph<Triple>((data) => data.id.toString());

		let cycleCount = 0;

		const stack = [{ id, desc }];

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
						data.desc.staticArguments
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
		args: any[] = []
	): T {
		if (this._services.get(id) instanceof SyncDescriptor) {
			return this._createServiceInstance(id, ctor, args);
		} else if (this._parent) {
			return this._parent._createServiceInstanceWithOwner(id, ctor, args);
		} else {
			throw new Error(
				`illegalState - creating UNKNOWN service instance ${ctor.name}`
			);
		}
	}

	private _createServiceInstance<T>(
		id: ServiceIdentifier<T>,
		ctor: any,
		args: any[] = []
	): T {
		return this._createInstance(ctor, args);
	}
}
