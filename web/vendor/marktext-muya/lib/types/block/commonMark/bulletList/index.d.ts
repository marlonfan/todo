import { Muya } from '../../../muya';
import { IBulletListState } from '../../../state/types';
import { LinkedList } from '../../base/linkedList/linkedList';
import { default as Parent } from '../../base/parent';
declare class BulletList extends Parent {
    children: LinkedList<Parent>;
    static blockName: string;
    static create(muya: Muya, state: IBulletListState): BulletList;
    get path(): (string | number)[];
    meta: IBulletListState['meta'];
    constructor(muya: Muya, { meta }: IBulletListState);
    getState(): IBulletListState;
}
export default BulletList;
