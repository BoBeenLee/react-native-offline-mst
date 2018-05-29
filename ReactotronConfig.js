import Reactotron from 'reactotron-react-native'
import { mst } from "reactotron-mst";

const setupReactotron = (store) => {
    Reactotron
        .configure() // controls connection & communication settings
        .useReactNative() // add all built-in react native plugins
        .use(mst())
        .connect(); // let's connect!
    Reactotron.trackMstNode(store);
};

export { setupReactotron };
