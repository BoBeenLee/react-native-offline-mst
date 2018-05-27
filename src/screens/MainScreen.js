import _ from 'lodash';
import React, { Component } from 'react';
import styled from "styled-components";
import { observer, inject } from "mobx-react";

const Container = styled.View`
`;

const RandomButton = styled.Button``;

const NormalText = styled.Text``;

@inject("store")
@observer
class MainScreen extends Component {
    render() {
        const { store: { todoStore: { addTodoWithOffline, todos } } } = this.props;
        return (
            <Container>
                <RandomButton onPress={() => addTodoWithOffline("Test")} title="addTodo" />
                {_.map(todos, (todo, index) => {
                    return <NormalText key={index}>{todo.name}</NormalText>
                })}
            </Container>
        );
    }
}

export default (MainScreen);
