export class SyncDescriptor<T> {
	readonly ctor: any;
	readonly staticArguments: any[];

	constructor(
		ctor: new (...args: any[]) => T,
		staticArguments: any[] = [],
	) {
		this.ctor = ctor;
		this.staticArguments = staticArguments;
	}
}


// no constructor parameter
export interface SyncDescriptor0<T> {
	readonly ctor: new () => T;
}
