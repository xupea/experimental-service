import { State, StateType, UpdateType } from "./update";

export abstract class AbstractUpdateService {
	private _state: State = State.Uninitialized;

	get state(): State {
		return this._state;
	}

	protected setState(state: State): void {
		this._state = state;
	}

	constructor() {
		this.initialize();
	}

	protected async initialize(): Promise<void> {
		const updateMode = "manual";

		this.setState(State.Idle(this.getUpdateType()));

		if (updateMode === "manual") {
			return;
		} else if (updateMode === "start") {
			setTimeout(() => this.checkForUpdates(false), 30 * 1000);
		} else {
			this.scheduleCheckForUpdates(30 * 1000);
		}
	}

	private scheduleCheckForUpdates(delay = 60 * 60 * 1000): void {
		return timeout(delay)
			.then(() => this.checkForUpdates(false))
			.then(() => {
				// Check again after 1 hour
				return this.scheduleCheckForUpdates(60 * 60 * 1000);
			});
	}

	async checkForUpdates(explicit: boolean): Promise<void> {
		if (this.state.type !== StateType.Idle) {
			return;
		}

		this.doCheckForUpdates(explicit);
	}

	protected getUpdateType(): UpdateType {
		return UpdateType.Archive;
	}

	protected abstract doCheckForUpdates(context: any): void;
}
