import { SyncDescriptor } from "../lib/descriptors";
import { createDecorator } from "../lib/instantiation";
import { InstantiationService } from "../lib/instantiationService";
import { ServiceCollection } from "../lib/serviceCollection";

const IService1 = createDecorator<IService1>("service1");

interface IService1 {
	c: number;
}

class Service1 implements IService1 {
	c = 1;
}

const IService2 = createDecorator<IService2>('service2');

interface IService2 {
	readonly _serviceBrand: undefined;
	d: boolean;
}

class Service2 implements IService2 {
	declare readonly _serviceBrand: undefined;
	d = true;
}

const IService3 = createDecorator<IService3>('service3');

interface IService3 {
	readonly _serviceBrand: undefined;
	s: string;
}

class Service3 implements IService3 {
	declare readonly _serviceBrand: undefined;
	s = 'farboo';
}

const IDependentService = createDecorator<IDependentService>('dependentService');

interface IDependentService {
	readonly _serviceBrand: undefined;
	name: string;
}

class DependentService implements IDependentService {
	declare readonly _serviceBrand: undefined;
	constructor(@IService1 service: IService1) {
		expect(service.c).toBe(1);
	}

	name = 'farboo';
}

class Service1Consumer {
	constructor(@IService1 service1: IService1) {
		expect(service1).toBeDefined();
		expect(service1.c).toStrictEqual(1);
	}
}

describe("InstantiationService", () => {
	test("instantiate with invokeFunction", () => {
		const collection = new ServiceCollection();
		const service = new InstantiationService(collection);

		collection.set(IService1, new SyncDescriptor<IService1>(Service1));
		collection.set(IDependentService, new SyncDescriptor<IDependentService>(DependentService));

		service.invokeFunction(accessor => {
			const d = accessor.get(IDependentService);
			expect(d).toBeDefined();
			expect(d.name).toBe('farboo');
		});
	});

	test('instantiate with createInstance', function () {
		const collection = new ServiceCollection();
		const service = new InstantiationService(collection);
		collection.set(IService1, new Service1());
		collection.set(IService2, new Service2());
		collection.set(IService3, new Service3());

		// @ts-ignore
		service.createInstance(Service1Consumer);
	});
});
