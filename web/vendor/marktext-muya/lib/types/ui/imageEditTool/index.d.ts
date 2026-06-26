import { Muya } from '../../index';
import { IBaseOptions } from '../types';
import { default as BaseFloat } from '../baseFloat';
/**
 * Image state interface containing source, alt text and title
 */
interface IState {
    /** Image source URL or file path */
    src: string;
    /** Image alternative text */
    alt: string;
    /** Image title */
    title: string;
}
/**
 * Image edit tool options
 */
type Options = {
    /** Custom image path picker function */
    imagePathPicker?: () => Promise<string>;
    /** Image upload action handler */
    imageAction?: (state: IState) => Promise<string>;
} & IBaseOptions;
/**
 * Image edit tool for editing image source, alt text and title
 * Provides a float UI to edit image properties with optional file picker and upload support
 */
export declare class ImageEditTool extends BaseFloat {
    options: Options;
    static pluginName: string;
    /** Previous virtual node for patching */
    private _oldVNode;
    /** Current image information including token and ID */
    private _imageInfo;
    /** The block containing the image */
    private _block;
    /** Current editing state */
    private _state;
    /** Container element for the image selector */
    private _imageSelectorContainer;
    /**
     * Create image edit tool instance
     * @param muya - Muya editor instance
     * @param options - Tool options including image picker and upload handler
     */
    constructor(muya: Muya, options?: Options);
    /**
     * Listen to image selector events
     * Handles showing/hiding the tool and initializing state from image info
     */
    listen(): void;
    /**
     * Normalize file protocol in image source
     * Removes file:// or file:/// prefix for local paths
     */
    private _normalizeFileProtocol;
    /**
     * Focus and select the src input element
     */
    private _focusSrcInput;
    /**
     * Handle input change for image source
     * @param event - Input event
     */
    private _handleSrcInput;
    /**
     * Handle Enter key press to confirm changes
     * @param event - Keyboard event
     */
    private _handleEnter;
    /**
     * Confirm and apply image changes
     */
    private _handleConfirm;
    /**
     * Replace image asynchronously
     * Handles two scenarios:
     * 1. Direct replacement: when src is a URL or no imageAction provided
     * 2. Upload flow: when src is a local path and imageAction is available
     * @param param - Image state object
     * @param param.alt - Image alt text
     * @param param.src - Image source (local path or URL)
     * @param param.title - Image title
     */
    private _replaceImageAsync;
    /**
     * Replace image directly without upload
     * Only replaces if values have changed
     */
    private _replaceImageDirect;
    /**
     * Replace image with upload flow
     * Shows loading state, uploads the image, then replaces with uploaded URL
     */
    private _replaceImageWithUpload;
    /**
     * Handle click on "more" button to open file picker
     * Updates the src input with selected path
     */
    private _handleMoreClick;
    /**
     * Render the image edit tool UI
     * Creates virtual DOM with file picker button (optional), src input and confirm button
     */
    private _render;
}
export {};
