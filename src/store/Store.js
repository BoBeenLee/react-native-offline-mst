import { types } from "mobx-state-tree"
import { NetworkStore, addNetworkMiddleware } from './NetworkStore';
import { TodoStore } from './TodoStore';

const Store = types.model({
    todoStore: types.optional(TodoStore, {}),
    networkStore: types.optional(NetworkStore, {})
});

let store = Store.create();
addNetworkMiddleware(store.networkStore)(store.todoStore);

export { store };
