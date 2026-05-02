import { Velocity } from "./dist/index.mjs";

const fetchData = async () => {
  try {
    const controller = new AbortController();
    setTimeout(() => {
        console.log("Aborting now!");
        controller.abort(new Error("My custom abort reason"));
    }, 5);
    const api = new Velocity();
    console.log("Starting request...");
    const response = await api.get(
      "https://mocki.io/v1/5a7ed5d3-3132-4b36-b87a-dff4da8a2a30",
      {
        signal: controller.signal,
      },
    );
    console.log("Response:", response);
  } catch (err) {
    console.log("Caught Error:", err);
  }
};
fetchData();
