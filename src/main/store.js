import Store from 'electron-store';

const schema = {
  collectionsPath: {
    type: 'string',
    default: ''
  }
};

const store = new Store({
  schema,
  projectName: 'workflow-runner'
});
export default store;
