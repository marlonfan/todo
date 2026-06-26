import { Muya } from '../../../muya';
import { ITaskListItemMeta } from '../../../state/types';
import { default as TreeNode } from '../../base/treeNode';
declare class TaskListCheckbox extends TreeNode {
    private _checked;
    private _eventIds;
    static blockName: string;
    static create(muya: Muya, meta: ITaskListItemMeta): TaskListCheckbox;
    get path(): (string | number)[];
    get isContainerBlock(): boolean;
    constructor(muya: Muya, { checked }: ITaskListItemMeta);
    listen(): void;
    update: (checked: boolean, source?: string) => void;
    detachDOMEvents(): void;
    remove(_source: string): this;
    getState(): void;
}
export default TaskListCheckbox;
