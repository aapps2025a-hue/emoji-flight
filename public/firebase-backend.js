import {initializeApp} from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-app.js';
import {getAuth,createUserWithEmailAndPassword,signInWithEmailAndPassword,signOut} from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js';
import {getFirestore,doc,runTransaction,serverTimestamp} from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-firestore.js';
import {firebaseConfig} from './firebase-config.js';
const app=initializeApp(firebaseConfig),auth=getAuth(app),db=getFirestore(app);
const ready=auth.authStateReady();
function failure(message,status){const error=new Error(message);error.status=status;return error;}
function currentUser(){if(!auth.currentUser)throw failure('Please sign in again.',401);return auth.currentUser;}
async function load(){
 const user=auth.currentUser;if(!user)return {username:null};
 const ref=doc(db,'players',user.uid);
 const data=await runTransaction(db,async tx=>{
  const snapshot=await tx.get(ref);
  if(!snapshot.exists())return {save:{},revision:0};
  const meta=snapshot.data();
  if(!Number.isInteger(meta.chunks)||meta.chunks<1||meta.chunks>40)throw Error('Your saved data has an invalid format.');
  const chunks=await Promise.all(Array.from({length:meta.chunks},(_,i)=>tx.get(doc(ref,'chunks',String(i)))));
  if(chunks.some(c=>!c.exists()))throw Error('Your save is incomplete. Please try again.');
  return {save:JSON.parse(chunks.map(c=>c.data().text).join('')),revision:meta.revision};
 });
 return {username:user.email,...data};
}
async function save(data){
 const user=currentUser(),ref=doc(db,'players',user.uid);
 const json=JSON.stringify(data.save);
 if(json.length>4000000)throw Error('Your airline images are too large. Use smaller logos.');
 const chunks=json.match(/[\s\S]{1,100000}/gu)||['{}'];
 return runTransaction(db,async tx=>{
  const snapshot=await tx.get(ref),previous=snapshot.exists()?snapshot.data():{revision:0,chunks:0};
  if(previous.revision!==data.revision)throw failure('A newer save exists in another tab. Reload to load it.',409);
  const revision=previous.revision+1;
  chunks.forEach((text,i)=>tx.set(doc(ref,'chunks',String(i)),{text}));
  for(let i=chunks.length;i<previous.chunks;i++)tx.delete(doc(ref,'chunks',String(i)));
  tx.set(ref,{revision,chunks:chunks.length,updatedAt:serverTimestamp()});
  return {revision};
 });
}
export async function request(path,options={}){
 try{
  await ready;
  const data=options.body?JSON.parse(options.body):{};
  if(path==='/api/me')return await load();
  if(path==='/api/register'){
   await createUserWithEmailAndPassword(auth,data.username.trim(),data.password);return {ok:true};
  }
  if(path==='/api/login'){
   await signInWithEmailAndPassword(auth,data.username.trim(),data.password);return {ok:true};
  }
  if(path==='/api/logout'){await signOut(auth);return {ok:true};}
  if(path==='/api/save')return await save(data);
  throw Error('Unknown account action.');
 }catch(error){
  const messages={
   'auth/invalid-credential':'Email or password is incorrect.',
   'auth/email-already-in-use':'This email already has an account. Choose Sign in.',
   'auth/invalid-email':'Enter a valid email address.',
   'auth/weak-password':'Choose a stronger password with at least 10 characters.',
   'auth/operation-not-allowed':'Email/password sign-in must be enabled in this Firebase project.',
   'auth/configuration-not-found':'Firebase Authentication needs its initial setup in the project console.',
   'auth/network-request-failed':'Cannot reach Firebase. Check your internet connection and try again.',
   'auth/too-many-requests':'Too many attempts. Please wait and try again.',
   'permission-denied':'Firebase denied access to this save. Check that you are signed in and the game security rules are deployed.',
   'unavailable':'The database is temporarily unavailable. Your unsaved progress is still in this tab.'
  };
  if(messages[error.code])throw failure(messages[error.code],error.code==='permission-denied'?403:undefined);
  throw error;
 }
}
