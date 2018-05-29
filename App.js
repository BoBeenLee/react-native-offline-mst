import React from 'react';
import { SafeAreaView } from 'react-native';
import { Provider } from "mobx-react/native";

import MainScreen from './src/screens/MainScreen';
import { store } from './src/store/Store';
import { setupReactotron } from './ReactotronConfig';

setupReactotron(store);

export default class App extends React.Component {
  render() {
    return (
      <SafeAreaView>
        <Provider store={store}>
          <MainScreen />
        </Provider>
      </SafeAreaView>
    );
  }
}
