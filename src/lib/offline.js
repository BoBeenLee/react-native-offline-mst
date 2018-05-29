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
 * TODO
 * - isConnect false => true 가 될 경우 actionQueue를 순차적으로 실행한다.
 *   try
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

const callActionWithRetry = (supplier, call, retryCount) => {
  try {
    return supplier();
  } catch (error) {
    const args = call.args;
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
    applyAction(call.context, {
      name: call.name,
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
      console.log(getPathParts(call.context));
      self.actionQueue.push(JSON.stringify({
          name: call.name,
          args: call.args,
          pathParts: getPathParts(call.context),
      }));
    };
    const callActionQueue = flow(function*() {
      let restActionQueue = self.actionQueue.peek();
      while (restActionQueue.length !== 0) {
        const callJSON = restActionQueue.shift();
        const { name, args, pathParts } = JSON.parse(callJSON);
        // console.log(call);
        // console.log(restActionQueue, call, next);
        yield delay(self.queueInterval);
        callActionWithRetry(
          () =>
            applyAction(_.get(self, pathParts), {
              name,
              args
            }),
          call,
          self.retryCount
        );
      }
      self.actionQueue = [];
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
    callActionWithRetry(() => next(call), call, offlineStore.retryCount);
  });

export { withOfflineArgs, withOfflineStore, addOfflineMiddleware };
