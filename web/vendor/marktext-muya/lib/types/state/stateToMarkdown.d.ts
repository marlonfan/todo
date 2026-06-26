import { IAtxHeadingState, IBlockQuoteState, IBulletListState, ICodeBlockState, IDiagramState, IFootnoteBlockState, IFrontmatterState, IHtmlBlockState, IListItemState, IMathBlockState, IOrderListState, IParagraphState, ISetextHeadingState, ITableState, ITaskListItemState, ITaskListState, IThematicBreakState, TState } from './types';
export interface IExportMarkdownOptions {
    listIndentation: number | string;
}
export default class ExportMarkdown {
    private _listType;
    private _isLooseParentList;
    private _listIndentation;
    private _listIndentationCount;
    constructor({ listIndentation, }?: IExportMarkdownOptions);
    generate(states: TState[]): string;
    convertStatesToMarkdown(states: TState[], indent?: string, listIndent?: string): string;
    insertLineBreak(result: unknown[], indent: string): void;
    serializeFrontMatter(state: IFrontmatterState): string;
    serializeTextParagraph(state: IParagraphState | IThematicBreakState, indent: string): string;
    serializeAtxHeading(state: IAtxHeadingState, indent: string): string;
    serializeSetextHeading(state: ISetextHeadingState, indent: string): string;
    serializeCodeBlock(state: ICodeBlockState, indent: string): string;
    serializeHtmlBlock(state: IHtmlBlockState, indent: string): string;
    serializeMathBlock(state: IMathBlockState, indent: string): string;
    serializeDiagramBlock(state: IDiagramState, indent: string): string;
    serializeBlockquote(state: IBlockQuoteState, indent: string): string;
    serializeFootnote(state: IFootnoteBlockState, indent: string): string;
    serializeTable(state: ITableState, indent: string): string;
    serializeList(state: IBulletListState | IOrderListState | ITaskListState, indent: string, listIndent: string): string;
    serializeListItem(state: IListItemState | ITaskListItemState, indent: string): string;
}
