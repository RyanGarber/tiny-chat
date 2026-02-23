declare module "slate" {
    interface BaseElement {
        type: string;
        hidden?: boolean;
    }

    interface BaseText {
        bold?: boolean;
        italic?: boolean;
        code?: boolean;
        strikethrough?: boolean;
        heading?: number;
        link?: boolean;
    }

    interface BaseRange {
        bold?: boolean;
        italic?: boolean;
        code?: boolean;
        strikethrough?: boolean;
        heading?: number;
        link?: boolean;
        syntax?: boolean;
    }
}

export default 1;