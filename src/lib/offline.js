import _ from 'lodash';
import { reaction, autorun } from 'mobx';
import { types, addMiddleware, onAction, applyAction, unprotect, getRoot, addDisposer } from "mobx-state-tree"

/**
 * TODO 
 * - isConnect false => true 가 될 경우 actionQueue를 순차적으로 실행한다.
 *   try 
 * - isConnect true => false 가 될 경우 actionQueue에 쌓아놓는다.
 */

const withOfflineArgs = (func) => (...args) => func(...args, { meta: { offline: { retry: 1, isRollback: false } } });

const withOfflineStore = (Store) => {
    const OfflineStore = types.model({
        offlineStore: types.optional(Offline, {})
    });
    return types.compose(Store, OfflineStore);
};

const callActionWithRetry = (call, next, retryCount) => {
    const args = call.args;
    const meta = _.get(_.last(args), "meta", null);
    try {
        return next(call);
    } catch (error) {
        const { offline: { retry } } = meta;
        const nextRetry = retry + 1;
        const nextArgs = [..._.slice(args, 0, args.length - 1),
        { meta: { offline: { retry: nextRetry, isRollback: nextRetry > retryCount } } }];
        console.log(retry);
        applyAction(call.context, {
            name: call.name,
            args: nextArgs
        });
    }
};

const Offline = types.model({
    isConnected: types.optional(types.boolean, true),
    actionQueue: types.optional(types.array(types.frozen), []),
    timeout: types.optional(types.number, 3000),
    checkInterval: types.optional(types.number, 3000),
    retryCount: types.optional(types.number, 1)
}).actions(self => {
    const addActionQueue = (call, next) => {
        self.actionQueue.push({
            call, next
        });
    };
    const callActionQueue = () => {
        unprotect(getRoot(self));
        if (self.actionQueue.length === 0) {
            return;
        }
        let restActionQueue = self.actionQueue.peek();
        while (restActionQueue.length !== 0) {
            const { call, next } = restActionQueue.shift();
            console.log(restActionQueue, call, next);
            callActionWithRetry(call, next, self.retryCount);
        }
        self.actionQueue = [];
    }

    const afterCreate = () => {
        const connectedDisposer = reaction(() => self.isConnected,
            () => {
                if (self.isConnected) {
                    self.callActionQueue();
                }
            })
        addDisposer(self, connectedDisposer);
    }

    const setIsConnected = (isConnected) => {
        self.isConnected = isConnected;
    }

    return {
        addActionQueue,
        callActionQueue,
        afterCreate,
        setIsConnected
    };
});

const addOfflineMiddleware = (offlineStore) => _.partial(addMiddleware, _, (call, next, abort) => {
    console.log(`action ${call.name} was invoked`, call.args);

    if (call.name === "addActionQueue") {
        return next(call);
    }
    const meta = _.get(_.last(call.args), "meta", null);
    if (_.isEmpty(meta)) {
        return next(call);
    }
    if (!offlineStore.isConnected) {
        offlineStore.addActionQueue(call, next);
        abort("disconnected");
        return;
    }
    callActionWithRetry(call, next, offlineStore.retryCount);
});

export { withOfflineArgs, withOfflineStore, addOfflineMiddleware };
