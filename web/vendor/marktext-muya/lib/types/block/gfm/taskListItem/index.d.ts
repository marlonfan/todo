import { Muya } from '../../../muya';
import { ITaskListItemMeta, ITaskListItemState } from '../../../state/types';
import { TBlockPath } from '../../types';
import { LinkedList } from '../../base/linkedList/linkedList';
import { default as Parent } from '../../base/parent';
declare class TaskListItem extends Parent {
    children: LinkedList<Parent>;
    meta: ITaskListItemMeta;
    static blockName: string;
    static create(muya: Muya, state: ITaskListItemState): TaskListItem;
    get path(): TBlockPath;
    get checked(): boolean;
    set checked(checked: boolean);
    constructor(muya: Muya, { meta }: ITaskListItemState);
    getState(): ITaskListItemState;
}
export default TaskListItem;
