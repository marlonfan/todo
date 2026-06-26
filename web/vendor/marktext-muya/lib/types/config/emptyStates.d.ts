declare const emptyStates: {
    paragraph: {
        name: string;
        text: string;
    };
    'thematic-break': {
        name: string;
        text: string;
    };
    frontmatter: {
        name: string;
        text: string;
        meta: {
            lang: string;
            style: string;
        };
    };
    'atx-heading': {
        name: string;
        meta: {
            level: number;
        };
        text: string;
    };
    table: {
        name: string;
        children: {
            name: string;
            children: {
                name: string;
                meta: {
                    align: string;
                };
                text: string;
            }[];
        }[];
    };
    'math-block': {
        name: string;
        text: string;
        meta: {
            mathStyle: string;
        };
    };
    'html-block': {
        name: string;
        text: string;
    };
    'code-block': {
        name: string;
        meta: {
            type: string;
            lang: string;
        };
        text: string;
    };
    'block-quote': {
        name: string;
        children: {
            name: string;
            text: string;
        }[];
    };
    'order-list': {
        name: string;
        meta: {
            start: number;
            loose: boolean;
            delimiter: string;
        };
        children: {
            name: string;
            children: {
                name: string;
                text: string;
            }[];
        }[];
    };
    'bullet-list': {
        name: string;
        meta: {
            marker: string;
            loose: boolean;
        };
        children: {
            name: string;
            children: {
                name: string;
                text: string;
            }[];
        }[];
    };
    'task-list': {
        name: string;
        meta: {
            marker: string;
            loose: boolean;
        };
        children: {
            name: string;
            meta: {
                checked: boolean;
            };
            children: {
                name: string;
                text: string;
            }[];
        }[];
    };
    diagram: {
        name: string;
        text: string;
        meta: {
            lang: string;
            type: string;
        };
    };
};
export default emptyStates;
