import { types } from "mobx-state-tree"
import { withOfflineArgs } from '../lib/offline';

const Todo = types.model({
    name: "",
    done: false
});

const TodoStore = types.model({
    todos: types.optional(types.array(Todo), [])
}).actions(self => {
    const addTodo = (name, { meta }) => {
        const { offline: { isRollback } } = meta;
        console.log(meta);
        if (isRollback) {
            self.todos.push(Todo.create({ name }));
            return;
        }
        throw new Error("Fail");
        self.todos.push(Todo.create({ name }));
    };

    const addTodoWithOffline = withOfflineArgs((...args) => {
        return self.addTodo(...args);
    });
    return { addTodoWithOffline, addTodo };
});

export { TodoStore };
