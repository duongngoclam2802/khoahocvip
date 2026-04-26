import { arrayUnion } from 'firebase/firestore';
try {
  arrayUnion();
  console.log("Success");
} catch (e) {
  console.log("Error:", e.message);
}
