/** Input or configuration problem; message is user-facing (usually `file:line: …`). */
export class ExportError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "ExportError";
	}
}
