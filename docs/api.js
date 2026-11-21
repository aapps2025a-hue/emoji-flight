// Firebase handles accounts and saves directly; no local /api server is needed.
let backend;
window.flightRequest = async (path, options = {}) => {
 if(!backend)backend=import('./firebase-backend.js').catch(()=>{
  backend=null;throw new Error('Could not load Firebase. Check your internet connection and reload the page.');
 });
 return (await backend).request(path, options);
};
