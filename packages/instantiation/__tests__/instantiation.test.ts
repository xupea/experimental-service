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

describe("InstantiationService", () => {
	// test("should be defined", () => {
	// 	const IService1 = createDecorator<IService1>("logService");

	// 	class Service1Consumer {
	// 		constructor(@IService1 service1: IService1) {
	// 			expect(service1).toBeTruthy();
	// 			expect(service1.c).toStrictEqual(1);
	// 		}
	// 	}

	// 	expect(true).toBe(true);
	// });
	test("SyncDesc - no deps", () => {
		const collection = new ServiceCollection();
		const service = new InstantiationService(collection);

		collection.set(IService1, new SyncDescriptor<IService1>(Service1));

		service.invokeFunction((accessor) => {
			const service1 = accessor.get(IService1);
			expect(service1).toBeTruthy();
			expect(service1.c).toStrictEqual(1);

			const service2 = accessor.get(IService1);
			expect(service1).toStrictEqual(service2);
		});
	});
});
