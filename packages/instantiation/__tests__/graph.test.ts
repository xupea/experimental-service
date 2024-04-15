import { Graph } from "../lib/graph";

let graph: Graph<string>;

beforeEach(() => {
	graph = new Graph<string>((s) => s);
});

describe("Graph", () => {
	test("is possible to lookup nodes that don't exist", () => {
		expect(graph.lookup("ddd")).toBeUndefined();
	});

	test("inserts nodes when not there yet", () => {
		expect(graph.lookup("ddd")).toBeUndefined();
		expect(graph.lookupOrInsertNode("ddd").data).toBe("ddd");
		expect(graph.lookup("ddd")!.data).toBe("ddd");
	});

	test("can remove nodes and get length", () => {
		expect(graph.isEmpty()).toBeTruthy();
		expect(graph.lookup("ddd")).toBeUndefined();
		expect(graph.lookupOrInsertNode("ddd").data).toBe("ddd");
		expect(!graph.isEmpty()).toBeTruthy();
		graph.removeNode("ddd");
		expect(graph.lookup("ddd")).toBeUndefined();
		expect(graph.isEmpty()).toBeTruthy();
	});

	test("root", () => {
		graph.insertEdge("1", "2");
		let roots = graph.roots();
		console.log((graph as any)._nodes)
		expect(roots.length).toBe(1);
		expect(roots[0].data).toBe("2");

		graph.insertEdge("2", "1");
		roots = graph.roots();
		expect(roots.length).toBe(0);
	});

	test('root complex', () => {
		graph.insertEdge('1', '2');
		graph.insertEdge('1', '3');
		graph.insertEdge('3', '4');

		const roots = graph.roots();
		expect(roots.length).toBe(2);
		expect(['2', '4'].every(n => roots.some(node => node.data === n))).toBeTruthy();
	});
});
