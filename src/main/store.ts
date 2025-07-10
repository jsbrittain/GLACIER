import Store from 'electron-store';

interface StoreSchema {
  collectionsPath: string;
}

const store = new Store<StoreSchema>({
  schema: {
    collectionsPath: {
      type: 'string',
      default: ''
    }
  },
  name: 'IceFlow'
});

export default store;
