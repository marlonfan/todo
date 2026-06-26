import { Muya } from '../../index';
import { IBaseOptions } from '../types';
import { default as BaseFloat } from '../baseFloat';
/**
 * Inline format toolbar for text formatting
 * Provides quick access to text formatting options like bold, italic, etc.
 * Appears when text is selected
 */
export declare class InlineFormatToolbar extends BaseFloat {
    static pluginName: string;
    /** Previous virtual node for patching */
    private _oldVNode;
    /** The block containing the selected text */
    private _block;
    /** Currently applied formats in the selection */
    private _formats;
    /** Toolbar configuration options */
    options: IBaseOptions;
    /** Format tool icons configuration */
    private _icons;
    /** Container element for the format toolbar */
    private _formatContainer;
    /**
     * Create inline format toolbar instance
     * @param muya - Muya editor instance
     * @param options - Toolbar options
     */
    constructor(muya: Muya, options?: {});
    /**
     * Listen to format picker events and keyboard shortcuts
     */
    listen(): void;
    /**
     * Handle keyboard events for format shortcuts and toolbar hiding
     * @param event - Keyboard event
     * @param editor - Editor instance
     */
    private _handleKeydown;
    /**
     * Hide toolbar when an editing key is pressed
     * @param key - Key name
     * @param metaKey - Meta key state
     * @param ctrlKey - Control key state
     */
    private _hideOnEditingKey;
    /**
     * Handle format keyboard shortcuts
     * @param event - Keyboard event
     * @param key - Key name
     * @param shiftKey - Shift key state
     * @param anchorBlock - Anchor block
     */
    private _handleFormatShortcut;
    /**
     * Render the format toolbar UI
     */
    private _render;
    /**
     * Create a format icon item
     * @param icon - Icon configuration
     * @param formats - Currently applied formats
     * @param i18n - Internationalization instance
     */
    private _createIconItem;
    /**
     * Handle format item selection
     * @param event - Click event
     * @param item - Selected format tool icon
     */
    private _selectItem;
}
