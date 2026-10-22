const React = require('react');

const View = (props) => React.createElement('div', props, props.children);
const Text = (props) => React.createElement('span', props, props.children);
const TextInput = (props) => React.createElement('input', props);
const TouchableOpacity = (props) => React.createElement('button', props, props.children);
const ScrollView = (props) => React.createElement('div', props, props.children);
const FlatList = (props) => {
  const elements = (props.data || []).map((item, idx) =>
    props.renderItem ? props.renderItem({ item, index: idx }) : null
  );
  return React.createElement('div', null, elements);
};
const ActivityIndicator = () => React.createElement('div', null);
const StyleSheet = {
  create: (styles) => styles,
};
const Platform = {
  OS: 'ios',
  select: (obj) => obj.ios || obj.default,
};
const Alert = {
  alert: jest.fn(),
};
const Linking = {
  openURL: jest.fn().mockResolvedValue(true),
  canOpenURL: jest.fn().mockResolvedValue(true),
  getInitialURL: jest.fn().mockResolvedValue(null),
  addEventListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
};

module.exports = {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  Platform,
  Alert,
  Linking,
};
