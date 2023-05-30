import { memoize } from "../lib/decorators"


describe('Decorators', () => {
	test('memoize should memoize methods', () => {
		class Foo {
			count = 0

			constructor(private _answer: number | null | undefined) {}

			@memoize
			answer() {
				this.count++
				return this._answer
			}
		}

		const foo = new Foo(42)
		expect(foo.count).toBe(0)

		expect(foo.answer()).toBe(42)

		expect(foo.count).toBe(1)

		expect(foo.answer()).toBe(42)

		expect(foo.count).toBe(1)
	})
})
