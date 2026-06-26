import { Muya } from '../../../muya';
import { ITaskListMeta, ITaskListState } from '../../../state/types';
import { default as Parent } from '../../base/parent';
declare class TaskList extends Parent {
    meta: ITaskListMeta;
    static blockName: string;
    static create(muya: Muya, state: ITaskListState): TaskList;
    get path(): (string | number)[];
    constructor(muya: Muya, { meta }: ITaskListState);
    /**
     * Auto move checked list item to the end of task list.
     */
    orderIfNecessary(): void;
    getState(): ITaskListState;
}
export default TaskList;
