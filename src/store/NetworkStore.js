import _ from 'lodash';
import { types, addMiddleware, onAction, applyAction, unprotect, getRoot } from "mobx-state-tree"

/**
 * TODO 
 * - isConnect false => true 가 될 경우 actionQueue를 순차적으로 실행한다.
 *   try 
 * - isConnect true => false 가 될 경우 actionQueue에 쌓아놓는다.
 */

const offlineMethodNames = [];

const withOfflineArgs = (func) => (...args) => func(...args, { meta: { offline: { retry: 1, isRollback: false } } });

const NetworkStore = types.model({
    isConnected: types.optional(types.boolean, true),
    actionQueue: types.optional(types.array(types.frozen), []),
    timeout: types.optional(types.number, 3000),
    checkConnectionInterval: types.optional(types.number, 3)
}).actions(self => {
    const addActionQueue = (call, next) => {
        self.actionQueue.push({
            call, next
        });
    };
    const callAction = () => {
        unprotect(getRoot(self));
        if (self.actionQueue.length === 0) {
            return;
        }
        const { call, next } = self.actionQueue[0];
        console.log(call, next);
        next(call);
    }
    const afterCreate = () => {
        setInterval(self.callAction, self.timeout);
    }
    return {
        addActionQueue,
        callAction,
        afterCreate
    };
});

const disposer = (networkStore) => _.partial(addMiddleware, _, (call, next, abort) => {
    console.log(`action ${call.name} was invoked`);

    if (call.name === "addActionQueue") {
        return next(call);
    }
    console.log(call, next);
    const args = call.args;
    if (_.isEmpty(_.last(args).meta)) {
        console.log('empty?');
        return next(call);
    }
    const meta = _.last(args).meta;
    if (!networkStore.isConnected) {
        networkStore.addActionQueue(call, next);
        abort("is not connected");
        return;
    }
    try {
        return next(call);
    } catch (e) {
        const { offline: { retry } } = meta;
        const nextRetry = retry + 1;
        const nextArgs = [..._.slice(args, 0, args.length - 1),
        { meta: { offline: { retry: nextRetry, isRollback: nextRetry > networkStore.checkConnectionInterval } } }];
        console.log(retry);
        applyAction(call.context, {
            name: call.name,
            args: nextArgs
        });
    }
});

export { withOfflineArgs, NetworkStore, disposer as addNetworkMiddleware };
