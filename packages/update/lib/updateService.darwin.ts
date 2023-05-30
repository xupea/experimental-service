import * as electron from "electron";
import { AbstractUpdateService } from "./abstractUpdateService";
import { State } from "./update";

export class DarwinUpdateService extends AbstractUpdateService {
	protected doCheckForUpdates(context: any): void {
		this.setState(State.CheckingForUpdates(context));

		electron.autoUpdater.checkForUpdates();
	}
}
