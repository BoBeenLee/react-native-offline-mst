import { types } from "mobx-state-tree"
import { withOfflineStore, addOfflineMiddleware } from '../lib/offline';
import { TodoStore } from './TodoStore';

const Store = types.model({
    todoStore: types.optional(TodoStore, {})
});
const StorewithOffline = withOfflineStore(Store);
const store = StorewithOffline.create();
addOfflineMiddleware(store.offlineStore)(store);

export { store };
