export type EditorNode =
	| { type: "quote"; model: string; text: string }
	| { type: "attachment"; id: string }
	| { type: "command"; name: string; value?: string }
	| {
			type: "paste";
			text: string;
			lines: number;
			language: string | null;
			collapsed: boolean;
	  };
