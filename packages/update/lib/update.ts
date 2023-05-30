export interface IUpdate {
	version: string;
	productVersion: string;
	supportsFastUpdate?: boolean;
	url?: string;
	hash?: string;
}

export const enum StateType {
	Uninitialized = "uninitialized",
	Idle = "idle",
	CheckingForUpdates = "checking for updates",
	AvailableForDownload = "available for download",
	Downloading = "downloading",
	Downloaded = "downloaded",
	Updating = "updating",
	Ready = "ready",
}

export const enum UpdateType {
	Setup,
	Archive,
	Snap,
}

export type Uninitialized = { type: StateType.Uninitialized };
export type Idle = {
	type: StateType.Idle;
	updateType: UpdateType;
	error?: string;
};
export type CheckingForUpdates = {
	type: StateType.CheckingForUpdates;
	explicit: boolean;
};
export type AvailableForDownload = {
	type: StateType.AvailableForDownload;
	update: IUpdate;
};
export type Downloading = { type: StateType.Downloading; update: IUpdate };
export type Downloaded = { type: StateType.Downloaded; update: IUpdate };
export type Updating = { type: StateType.Updating; update: IUpdate };
export type Ready = { type: StateType.Ready; update: IUpdate };

export type State =
	| Uninitialized
	| Idle
	| CheckingForUpdates
	| AvailableForDownload
	| Downloading
	| Downloaded
	| Updating
	| Ready;

export const State = {
	Uninitialized: { type: StateType.Uninitialized } as Uninitialized,
	Idle: (updateType: UpdateType, error?: string) =>
		({ type: StateType.Idle, updateType, error } as Idle),
	CheckingForUpdates: (explicit: boolean) =>
		({ type: StateType.CheckingForUpdates, explicit } as CheckingForUpdates),
	AvailableForDownload: (update: IUpdate) =>
		({ type: StateType.AvailableForDownload, update } as AvailableForDownload),
	Downloading: (update: IUpdate) =>
		({ type: StateType.Downloading, update } as Downloading),
	Downloaded: (update: IUpdate) =>
		({ type: StateType.Downloaded, update } as Downloaded),
	Updating: (update: IUpdate) =>
		({ type: StateType.Updating, update } as Updating),
	Ready: (update: IUpdate) => ({ type: StateType.Ready, update } as Ready),
};
