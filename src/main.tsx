import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { bootDemo } from "./lib/demo-loader";
import "./globals.css";

bootDemo();
createRoot(document.getElementById("root")!).render(<App />);
