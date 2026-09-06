global.window = {
  Date: global.Date,
  timeDrift: 0,
  myConfirmedWrites: new Set(),
  localStorage: {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {}
  },
  dispatchEvent: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  location: { href: 'http://localhost' }
};
global.localStorage = global.window.localStorage;
global.navigator = { onLine: true };
