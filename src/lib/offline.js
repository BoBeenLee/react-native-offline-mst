import _ from "lodash";
import { AppState, AsyncStorage, AppStateStatus } from "react-native";
import { reaction, autorun } from "mobx";
import {
    types,
    flow,
    addMiddleware,
    onAction,
    applyAction,
    applySnapshot,
    addDisposer,
    getRoot,
    getPath,
    getPathParts
} from "mobx-state-tree";
import { delay } from "bluebird";

/**
 * - isConnect false => true 가 될 경우 actionQueue를 순차적으로 실행한다.
 * - isConnect true => false 가 될 경우 actionQueue에 쌓아놓는다.
 */

const withOfflineArgs = func => (...args) =>
    func(...args, { meta: { offline: { retry: 1, isRollback: false } } });

const withOfflineStore = (Store, name) => {
    const OfflineStore = types.model("offlineStore", {
        offlineStore: types.optional(Offline, {})
    });
    return types.compose(Store, OfflineStore).named(name);
};

const persistStore = async store => {
    try {
        // console.log(store.toJSON().offlineStore);
        await AsyncStorage.setItem("@root", JSON.stringify(store.toJSON()));
    } catch (error) {
        // Error saving data
    }
};

const rehydrateStore = async store => {
    try {
        const value = await AsyncStorage.getItem("@root");
        if (value !== null) {
            applySnapshot(store, JSON.parse(value));
        }
    } catch (error) {
        // Error retrieving data
    }
};

const callActionWithRetry = (callback, params, retryCount) => {
    try {
        callback(params);
    } catch (error) {
        const { args, name } = params;
        const meta = _.get(_.last(args), "meta", null);
        const {
            offline: { retry }
        } = meta;
        const nextRetry = retry + 1;
        const nextArgs = [
            ..._.slice(args, 0, args.length - 1),
            {
                meta: {
                    offline: { retry: nextRetry, isRollback: nextRetry > retryCount }
                }
            }
        ];
        callback({
            name: name,
            args: nextArgs
        });
    }
};

const Offline = types
    .model({
        isConnected: types.optional(types.boolean, true),
        actionQueue: types.optional(types.array(types.string), []),
        timeout: types.optional(types.number, 3000),
        queueInterval: types.optional(types.number, 1000),
        retryCount: types.optional(types.number, 1)
    })
    .actions(self => {
        const addActionQueue = call => {
            self.actionQueue.push(JSON.stringify({
                name: call.name,
                args: call.args,
                pathParts: getPathParts(call.context),
            }));
        };
        const callActionQueue = flow(function* () {
            let restActionQueue = self.actionQueue.peek();
            self.actionQueue = [];

            while (restActionQueue.length !== 0) {
                const callJSON = restActionQueue.shift();
                const { name, args, pathParts } = JSON.parse(callJSON);
                yield delay(self.queueInterval);
                callActionWithRetry(
                    ({ name, args }) =>
                        applyAction(_.get(getRoot(self), pathParts), {
                            name,
                            args
                        }),
                    { name, args },
                    self.retryCount
                );
            }
        });

        const afterCreate = () => {
            rehydrateStore(getRoot(self));
            AppState.addEventListener("change", state => {
                if (state === "inactive") {
                    persistStore(getRoot(self));
                }
            });
            const connectedDisposer = reaction(
                () => self.isConnected,
                () => {
                    if (self.isConnected) {
                        self.callActionQueue();
                    }
                }
            );
            addDisposer(self, connectedDisposer);
        };

        const setIsConnected = isConnected => {
            self.isConnected = isConnected;
        };

        return {
            addActionQueue,
            callActionQueue,
            afterCreate,
            setIsConnected
        };
    });

const addOfflineMiddleware = offlineStore =>
    _.partial(addMiddleware, _, (call, next, abort) => {
        // console.log(`action ${call.name} was invoked`, call.args);

        if (call.name === "addActionQueue") {
            return next(call);
        }
        const meta = _.get(_.last(call.args), "meta", null);
        if (_.isEmpty(meta)) {
            return next(call);
        }
        if (!offlineStore.isConnected) {
            offlineStore.addActionQueue(call);
            abort("disconnected");
            return;
        }
        callActionWithRetry((params) => params.context ?
            next(params) : applyAction(call.context, { name: params.name, args: params.args }),
            call, offlineStore.retryCount);
    });

export { withOfflineArgs, withOfflineStore, addOfflineMiddleware };
