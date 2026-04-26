try {
  try {
    console.log(x);
  } catch (e) {
    console.log("Inner catch:", e.message);
  }
  const x = 5;
  console.log("After x declaration:", x);
} catch (e) {
  console.log("Outer catch:", e.message);
}
