import _ from 'lodash';
import React, { Component } from 'react';
import styled from "styled-components";
import { observer, inject } from "mobx-react";

const Container = styled.View`
`;

const RandomButton = styled.Button``;

const ConnectedButton = styled.Button``;

const NormalText = styled.Text``;

@inject("store")
@observer
class MainScreen extends Component {
    render() {
        const { store: { todoStore: { addTodoWithOffline, todos }, offlineStore: { isConnected, setIsConnected } } } = this.props;
        return (
            <Container>
                <RandomButton title="addTodo" onPress={() => addTodoWithOffline("Test")} />
                {_.map(todos, (todo, index) => {
                    return <NormalText key={index}>{todo.name}</NormalText>
                })}

                <ConnectedButton title={`${isConnected ? 'online' : 'offline'}`} onPress={() => setIsConnected(!isConnected)} />
            </Container>
        );
    }
}

export default (MainScreen);
